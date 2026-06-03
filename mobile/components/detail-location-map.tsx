import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Pressable, Text, View } from "react-native";

export type DetailLocationMapLandmark = {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceLabel?: string;
};

type DetailLocationMapProps = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  title?: string | null;
  landmarks?: DetailLocationMapLandmark[];
};

const MAP_TILE_ZOOM = 15;
const MIN_MAP_TILE_ZOOM = 13;
const MAX_MAP_TILE_ZOOM = 18;
const TILE_GRID_RADIUS = 1;
const MAP_LANDMARK_LIMIT = 5;
const PINCH_ZOOM_IN_THRESHOLD = 1.12;
const PINCH_ZOOM_OUT_THRESHOLD = 0.88;

type TileProvider = {
  name: string;
  attribution: string;
  buildUrl: (zoom: number, x: number, y: number) => string;
};

const TILE_PROVIDERS: TileProvider[] = [
  {
    name: "carto-voyager",
    attribution: "© OpenStreetMap, © CARTO",
    buildUrl: (zoom, x, y) =>
      `https://basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${x}/${y}.png`,
  },
  {
    name: "carto-positron",
    attribution: "© OpenStreetMap, © CARTO",
    buildUrl: (zoom, x, y) =>
      `https://basemaps.cartocdn.com/light_all/${zoom}/${x}/${y}.png`,
  },
  {
    name: "arcgis-street",
    attribution: "© Esri, OSM",
    buildUrl: (zoom, x, y) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${zoom}/${y}/${x}`,
  },
];

function projectToTilePoint(latitude: number, longitude: number, zoom: number) {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const worldScale = 2 ** zoom;

  return {
    x: ((longitude + 180) / 360) * worldScale,
    y:
      ((1 -
        Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) /
        2) *
      worldScale,
  };
}

type TileGridResult = {
  pinLeftPercent: number;
  pinTopPercent: number;
  tiles: {
    key: string;
    leftPercent: number;
    topPercent: number;
    zoom: number;
    tileX: number;
    tileY: number;
  }[];
  visibleTileSpan: number;
};

function buildTileGrid(latitude: number, longitude: number, zoom: number): TileGridResult {
  const projected = projectToTilePoint(latitude, longitude, zoom);
  const visibleTileSpan = TILE_GRID_RADIUS * 2 + 1;
  const worldScale = 2 ** zoom;
  const viewportLeft = projected.x - visibleTileSpan / 2;
  const viewportTop = projected.y - visibleTileSpan / 2;
  const viewportRight = projected.x + visibleTileSpan / 2;
  const viewportBottom = projected.y + visibleTileSpan / 2;
  const firstTileX = Math.floor(viewportLeft);
  const firstTileY = Math.floor(viewportTop);
  const lastTileX = Math.ceil(viewportRight) - 1;
  const lastTileY = Math.ceil(viewportBottom) - 1;

  const tiles: TileGridResult["tiles"] = [];

  for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
    if (tileY < 0 || tileY >= worldScale) {
      continue;
    }

    for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
      const wrappedTileX = ((tileX % worldScale) + worldScale) % worldScale;

      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        leftPercent: ((tileX - viewportLeft) / visibleTileSpan) * 100,
        topPercent: ((tileY - viewportTop) / visibleTileSpan) * 100,
        zoom,
        tileX: wrappedTileX,
        tileY,
      });
    }
  }

  return {
    pinLeftPercent: 50,
    pinTopPercent: 50,
    tiles,
    visibleTileSpan,
  };
}

function buildMarkerPosition(
  centerLatitude: number,
  centerLongitude: number,
  latitude: number,
  longitude: number,
  zoom: number,
) {
  const center = projectToTilePoint(centerLatitude, centerLongitude, zoom);
  const point = projectToTilePoint(latitude, longitude, zoom);
  const visibleTileSpan = TILE_GRID_RADIUS * 2 + 1;
  const leftPercent = ((point.x - (center.x - visibleTileSpan / 2)) / visibleTileSpan) * 100;
  const topPercent = ((point.y - (center.y - visibleTileSpan / 2)) / visibleTileSpan) * 100;

  return {
    leftPercent,
    topPercent,
    isVisible:
      leftPercent >= -6 &&
      leftPercent <= 106 &&
      topPercent >= -6 &&
      topPercent <= 106,
  };
}

function getTouchDistance(touches: readonly { pageX: number; pageY: number }[]) {
  if (touches.length < 2) {
    return null;
  }

  const [firstTouch, secondTouch] = touches;
  const deltaX = firstTouch.pageX - secondTouch.pageX;
  const deltaY = firstTouch.pageY - secondTouch.pageY;

  return Math.hypot(deltaX, deltaY);
}

export function DetailLocationMap({
  latitude,
  longitude,
  title,
  landmarks = [],
}: DetailLocationMapProps) {
  const hasCoordinates =
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude);

  const [zoom, setZoom] = useState(MAP_TILE_ZOOM);
  const zoomRef = useRef(MAP_TILE_ZOOM);
  const pinchDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    setZoom(MAP_TILE_ZOOM);
    zoomRef.current = MAP_TILE_ZOOM;
  }, [latitude, longitude]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const tileGrid = useMemo(() => {
    if (!hasCoordinates) {
      return null;
    }

    return buildTileGrid(latitude as number, longitude as number, zoom);
  }, [hasCoordinates, latitude, longitude, zoom]);

  const landmarkMarkers = useMemo(() => {
    if (!hasCoordinates) {
      return [];
    }

    return landmarks
      .filter(
        (landmark) =>
          Number.isFinite(landmark.latitude) &&
          Number.isFinite(landmark.longitude) &&
          (landmark.latitude !== latitude || landmark.longitude !== longitude),
      )
      .slice(0, MAP_LANDMARK_LIMIT)
      .map((landmark) => ({
        ...landmark,
        ...buildMarkerPosition(
          latitude as number,
          longitude as number,
          landmark.latitude,
          landmark.longitude,
          zoom,
        ),
      }))
      .filter((landmark) => landmark.isVisible);
  }, [hasCoordinates, landmarks, latitude, longitude, zoom]);

  const [providerIndex, setProviderIndex] = useState(0);
  const [failedTileCount, setFailedTileCount] = useState(0);
  const [loadedTileCount, setLoadedTileCount] = useState(0);

  useEffect(() => {
    setProviderIndex(0);
    setFailedTileCount(0);
    setLoadedTileCount(0);
  }, [tileGrid]);

  const provider = TILE_PROVIDERS[Math.min(providerIndex, TILE_PROVIDERS.length - 1)];
  const totalTiles = tileGrid?.tiles.length ?? 0;
  const pinLeftPercent = tileGrid?.pinLeftPercent ?? 50;
  const pinTopPercent = tileGrid?.pinTopPercent ?? 50;
  const labelLeftPercent = Math.max(24, Math.min(76, pinLeftPercent));
  const labelTopPercent = Math.max(14, Math.min(78, pinTopPercent + 8));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2,
        onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2,
        onPanResponderGrant: (event) => {
          pinchDistanceRef.current = getTouchDistance(event.nativeEvent.touches);
        },
        onPanResponderMove: (event) => {
          const distance = getTouchDistance(event.nativeEvent.touches);

          if (!distance) {
            pinchDistanceRef.current = null;
            return;
          }

          if (!pinchDistanceRef.current) {
            pinchDistanceRef.current = distance;
            return;
          }

          const scale = distance / pinchDistanceRef.current;

          if (scale >= PINCH_ZOOM_IN_THRESHOLD && zoomRef.current < MAX_MAP_TILE_ZOOM) {
            const nextZoom = Math.min(MAX_MAP_TILE_ZOOM, zoomRef.current + 1);
            zoomRef.current = nextZoom;
            pinchDistanceRef.current = distance;
            setZoom(nextZoom);
            return;
          }

          if (scale <= PINCH_ZOOM_OUT_THRESHOLD && zoomRef.current > MIN_MAP_TILE_ZOOM) {
            const nextZoom = Math.max(MIN_MAP_TILE_ZOOM, zoomRef.current - 1);
            zoomRef.current = nextZoom;
            pinchDistanceRef.current = distance;
            setZoom(nextZoom);
          }
        },
        onPanResponderRelease: () => {
          pinchDistanceRef.current = null;
        },
        onPanResponderTerminate: () => {
          pinchDistanceRef.current = null;
        },
      }),
    [],
  );

  useEffect(() => {
    if (!totalTiles) {
      return;
    }
    if (failedTileCount >= totalTiles && providerIndex < TILE_PROVIDERS.length - 1) {
      setProviderIndex((current) => current + 1);
      setFailedTileCount(0);
      setLoadedTileCount(0);
    }
  }, [failedTileCount, providerIndex, totalTiles]);

  if (!hasCoordinates) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#EAF0FA",
          borderRadius: 18,
          height: 220,
          justifyContent: "center",
          overflow: "hidden",
          paddingHorizontal: 20,
        }}
      >
        <Text style={{ color: "#55627F", fontSize: 14, fontWeight: "500", textAlign: "center" }}>
          Địa điểm này hiện chưa có tọa độ để hiển thị bản đồ.
        </Text>
      </View>
    );
  }

  const tileSizePercent = `${100 / (tileGrid?.visibleTileSpan ?? 3)}%` as const;
  const allTilesFailed =
    totalTiles > 0 &&
    failedTileCount >= totalTiles &&
    providerIndex >= TILE_PROVIDERS.length - 1 &&
    loadedTileCount === 0;

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        backgroundColor: "#EAF0FA",
        borderRadius: 18,
        height: 220,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <View
        style={{
          backgroundColor: "#DDE6F4",
          height: "100%",
          position: "relative",
          width: "100%",
        }}
      >
        {tileGrid?.tiles.map((tile) => (
          <Image
            fadeDuration={120}
            key={`${provider.name}-${tile.key}`}
            onError={() => setFailedTileCount((current) => current + 1)}
            onLoad={() => setLoadedTileCount((current) => current + 1)}
            source={{ uri: provider.buildUrl(tile.zoom, tile.tileX, tile.tileY) }}
            style={{
              height: tileSizePercent,
              left: `${tile.leftPercent}%`,
              position: "absolute",
              top: `${tile.topPercent}%`,
              width: tileSizePercent,
            }}
          />
        ))}
      </View>

      <View
        style={{
          gap: 8,
          position: "absolute",
          right: 12,
          top: 12,
        }}
      >
        <Pressable
          disabled={zoom >= MAX_MAP_TILE_ZOOM}
          onPress={() =>
            setZoom((current) => {
              const nextZoom = Math.min(MAX_MAP_TILE_ZOOM, current + 1);
              zoomRef.current = nextZoom;
              return nextZoom;
            })
          }
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.96)",
            borderColor: "rgba(28, 42, 74, 0.1)",
            borderRadius: 12,
            borderWidth: 1,
            height: 34,
            justifyContent: "center",
            opacity: pressed ? 0.8 : zoom >= MAX_MAP_TILE_ZOOM ? 0.45 : 1,
            width: 34,
          })}
        >
          <Feather color="#17233F" name="plus" size={16} />
        </Pressable>

        <Pressable
          disabled={zoom <= MIN_MAP_TILE_ZOOM}
          onPress={() =>
            setZoom((current) => {
              const nextZoom = Math.max(MIN_MAP_TILE_ZOOM, current - 1);
              zoomRef.current = nextZoom;
              return nextZoom;
            })
          }
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.96)",
            borderColor: "rgba(28, 42, 74, 0.1)",
            borderRadius: 12,
            borderWidth: 1,
            height: 34,
            justifyContent: "center",
            opacity: pressed ? 0.8 : zoom <= MIN_MAP_TILE_ZOOM ? 0.45 : 1,
            width: 34,
          })}
        >
          <Feather color="#17233F" name="minus" size={16} />
        </Pressable>
      </View>

      <View
        pointerEvents="none"
        style={{
          alignItems: "center",
          bottom: 0,
          justifyContent: "center",
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      >
        {landmarkMarkers.map((landmark, index) => {
          const labelLeftPercent = Math.max(18, Math.min(82, landmark.leftPercent));
          const labelTopPercent = Math.max(8, Math.min(82, landmark.topPercent + 5));

          return (
            <View
              key={landmark.key}
              style={{ bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "#FFFFFF",
                  borderColor: "#F59E0B",
                  borderRadius: 999,
                  borderWidth: 2,
                  height: 14,
                  justifyContent: "center",
                  left: `${landmark.leftPercent}%`,
                  position: "absolute",
                  top: `${landmark.topPercent}%`,
                  transform: [{ translateX: -7 }, { translateY: -7 }],
                  width: 14,
                }}
              >
                <View
                  style={{
                    backgroundColor: "#F59E0B",
                    borderRadius: 999,
                    height: 6,
                    width: 6,
                  }}
                />
              </View>
              {index < 3 ? (
                <View
                  style={{
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.94)",
                    borderColor: "rgba(245, 158, 11, 0.28)",
                    borderRadius: 999,
                    borderWidth: 1,
                    flexDirection: "row",
                    gap: 3,
                    left: `${labelLeftPercent}%`,
                    maxWidth: 132,
                    paddingHorizontal: 7,
                    paddingVertical: 4,
                    position: "absolute",
                    top: `${labelTopPercent}%`,
                    transform: [{ translateX: -58 }],
                  }}
                >
                  <Feather color="#B45309" name="map-pin" size={9} />
                  <Text numberOfLines={1} style={{ color: "#17233F", flexShrink: 1, fontSize: 9, fontWeight: "700" }}>
                    {landmark.distanceLabel ? `${landmark.name} • ${landmark.distanceLabel}` : landmark.name}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}

        <View
          style={{
            backgroundColor: "rgba(43, 88, 232, 0.18)",
            borderRadius: 999,
            height: 54,
            left: `${pinLeftPercent}%`,
            position: "absolute",
            top: `${pinTopPercent}%`,
            transform: [{ translateX: -27 }, { translateY: -27 }],
            width: 54,
          }}
        />
        <View
          style={{
            alignItems: "center",
            backgroundColor: "#2B58E8",
            borderColor: "#FFFFFF",
            borderRadius: 999,
            borderWidth: 3,
            height: 18,
            justifyContent: "center",
            left: `${pinLeftPercent}%`,
            position: "absolute",
            top: `${pinTopPercent}%`,
            transform: [{ translateX: -9 }, { translateY: -9 }],
            width: 18,
          }}
        />
        <View
          style={{
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.96)",
            borderColor: "rgba(28, 42, 74, 0.1)",
            borderRadius: 999,
            borderWidth: 1,
            flexDirection: "row",
            gap: 4,
            left: `${labelLeftPercent}%`,
            maxWidth: 180,
            paddingHorizontal: 8,
            paddingVertical: 5,
            position: "absolute",
            top: `${labelTopPercent}%`,
            transform: [{ translateX: -82 }],
          }}
        >
          <Feather color="#2B58E8" name="map-pin" size={11} />
          <Text numberOfLines={1} style={{ color: "#17233F", flexShrink: 1, fontSize: 10, fontWeight: "600" }}>
            {title || "Địa điểm"}
          </Text>
        </View>

        {allTilesFailed ? (
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              borderRadius: 999,
              bottom: 14,
              paddingHorizontal: 10,
              paddingVertical: 6,
              position: "absolute",
            }}
          >
            <Text style={{ color: "#55627F", fontSize: 12, fontWeight: "500" }}>
              Không tải được bản đồ.
            </Text>
          </View>
        ) : null}
      </View>

      <View
        pointerEvents="none"
        style={{
          backgroundColor: "rgba(255,255,255,0.78)",
          borderRadius: 6,
          bottom: 6,
          paddingHorizontal: 6,
          paddingVertical: 2,
          position: "absolute",
          right: 6,
        }}
      >
        <Text style={{ color: "#55627F", fontSize: 9, fontWeight: "500" }}>
          {provider.attribution}
        </Text>
      </View>
    </View>
  );
}
