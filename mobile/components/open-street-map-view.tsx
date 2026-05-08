import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import { WebView } from "react-native-webview";

type MapListing = {
  id: string;
  latitude: number;
  longitude: number;
  priceShort: string;
};

type MapOverlayPoint = {
  latitude: number;
  longitude: number;
};

type MapCluster = MapOverlayPoint & {
  label: string;
};

type OpenStreetMapViewProps = {
  listings: readonly MapListing[];
  selectedId: string;
  cluster: MapCluster;
  focusPoint: MapOverlayPoint;
  onSelect: (id: string) => void;
};

const mapFrameStyle = { flex: 1 } as const;
const vietnamBounds = {
  northEast: [23.95, 111.2],
  southWest: [7.6, 101.2],
} as const;

const WEB_FALLBACK_MARKERS = [
  { bottom: 282, label: "450k", left: 226, selected: false },
  { bottom: 244, label: "680k", left: 152, selected: true },
  { bottom: 182, label: "1.2M", left: 292, selected: false },
] as const;

const clusterBadgeStyle = {
  alignItems: "center",
  backgroundColor: "#2454EA",
  borderColor: "#FFFFFF",
  borderRadius: 999,
  borderWidth: 4,
  height: 76,
  justifyContent: "center",
  left: 88,
  position: "absolute",
  top: 154,
  width: 76,
} as const;

const focusPinStyle = {
  alignItems: "center",
  backgroundColor: "#FFFFFF",
  borderColor: "rgba(114,122,147,0.72)",
  borderRadius: 999,
  borderWidth: 3,
  height: 30,
  justifyContent: "center",
  left: 37,
  position: "absolute",
  top: 346,
  width: 30,
} as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildMapHtml({
  cluster,
  focusPoint,
  listings,
  selectedId,
}: {
  cluster: MapCluster;
  focusPoint: MapOverlayPoint;
  listings: readonly MapListing[];
  selectedId: string;
}) {
  const serializedListings = JSON.stringify(listings);
  const serializedSelectedId = JSON.stringify(selectedId);
  const serializedCluster = JSON.stringify(cluster);
  const serializedFocus = JSON.stringify(focusPoint);
  const serializedBounds = JSON.stringify(vietnamBounds);

  return `<!DOCTYPE html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html,
      body,
      #map {
        height: 100%;
        margin: 0;
        overflow: hidden;
        width: 100%;
      }

      body {
        background: #dbeefe;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .leaflet-container {
        background: #dbeefe;
      }

      .leaflet-control-zoom {
        display: none;
      }

      .leaflet-control-attribution {
        background: rgba(255, 255, 255, 0.92) !important;
        border-radius: 999px !important;
        bottom: 206px !important;
        box-shadow: 0 8px 18px rgba(20, 27, 52, 0.12);
        color: #5f6988 !important;
        font-size: 11px !important;
        padding: 6px 10px !important;
        right: 12px !important;
      }

      .leaflet-control-attribution a {
        color: #2454ea !important;
      }

      .leaflet-bottom.leaflet-right {
        bottom: 0;
        right: 0;
      }

      .price-icon,
      .cluster-icon,
      .focus-icon {
        align-items: center;
        display: flex;
        justify-content: center;
      }

      .price-pill {
        align-items: center;
        background: rgba(255, 255, 255, 0.96);
        border-radius: 999px;
        box-shadow: 0 10px 24px rgba(20, 27, 52, 0.12);
        color: #141b34;
        display: inline-flex;
        font-size: 17px;
        font-weight: 700;
        justify-content: center;
        letter-spacing: -0.02em;
        min-width: 92px;
        padding: 14px 20px;
      }

      .price-pill.is-selected {
        background: #ff7a1a;
        border: 4px solid #ffffff;
        color: #3d240d;
        font-size: 20px;
        min-width: 138px;
        padding: 18px 26px;
      }

      .cluster-pill {
        align-items: center;
        background: #2454ea;
        border: 4px solid #ffffff;
        border-radius: 999px;
        box-shadow: 0 14px 30px rgba(36, 84, 234, 0.28);
        color: #ffffff;
        display: inline-flex;
        font-size: 20px;
        font-weight: 800;
        height: 68px;
        justify-content: center;
        width: 68px;
      }

      .focus-pill {
        align-items: center;
        background: rgba(255, 255, 255, 0.96);
        border: 3px solid rgba(114, 122, 147, 0.84);
        border-radius: 999px;
        box-shadow: 0 8px 20px rgba(20, 27, 52, 0.12);
        display: inline-flex;
        height: 28px;
        justify-content: center;
        width: 28px;
      }

      .focus-pill::after {
        background: #727a93;
        border-radius: 999px;
        content: "";
        display: block;
        height: 10px;
        width: 10px;
      }

      .leaflet-div-icon {
        background: transparent;
        border: 0;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>

    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const listings = ${serializedListings};
      const cluster = ${serializedCluster};
      const focusPoint = ${serializedFocus};
      const vietnamBounds = ${serializedBounds};
      let selectedId = ${serializedSelectedId};
      const markerRefs = {};
      let readyNotified = false;

      const allowedBounds = L.latLngBounds(vietnamBounds.southWest, vietnamBounds.northEast);
      const map = L.map("map", {
        attributionControl: true,
        maxBounds: allowedBounds,
        maxBoundsViscosity: 0.2,
        minZoom: 5,
        maxZoom: 17.5,
        preferCanvas: true,
        zoomControl: false,
        zoomSnap: 0.25,
      });

      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        keepBuffer: 1,
        maxZoom: 19,
        updateWhenIdle: true,
      }).addTo(map);

      const defaultVietnamView = L.latLngBounds([[8.5, 102.5], [23.3, 109.8]]);
      map.fitBounds(defaultVietnamView, {
        maxZoom: 6.1,
        paddingBottomRight: [28, 224],
        paddingTopLeft: [28, 112],
      });

      function notifyReady() {
        if (readyNotified) {
          return;
        }

        readyNotified = true;
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "ready" }));
      }

      tiles.once("load", notifyReady);
      tiles.on("tileerror", () => {
        window.setTimeout(notifyReady, 180);
      });
      map.whenReady(() => {
        window.setTimeout(notifyReady, 900);
      });
      window.setTimeout(notifyReady, 2400);

      function createPriceIcon(priceShort, isSelected) {
        const safePrice = ${escapeHtml.toString()}(priceShort);
        const className = isSelected ? "price-pill is-selected" : "price-pill";

        return L.divIcon({
          className: "price-icon",
          html: '<div class="' + className + '">' + safePrice + "</div>",
          iconAnchor: [isSelected ? 69 : 46, isSelected ? 31 : 22],
          iconSize: [isSelected ? 138 : 92, isSelected ? 62 : 44],
        });
      }

      function syncSelection(nextSelectedId) {
        selectedId = nextSelectedId;

        listings.forEach((item) => {
          const marker = markerRefs[item.id];
          if (!marker) {
            return;
          }

          marker.setIcon(createPriceIcon(item.priceShort, item.id === selectedId));
          marker.setZIndexOffset(item.id === selectedId ? 1200 : 0);
        });
      }

      listings.forEach((item) => {
        const marker = L.marker([item.latitude, item.longitude], {
          icon: createPriceIcon(item.priceShort, item.id === selectedId),
        }).addTo(map);

        marker.on("click", () => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({ id: item.id, type: "select" }));
          syncSelection(item.id);
        });

        markerRefs[item.id] = marker;
      });

      L.marker([cluster.latitude, cluster.longitude], {
        icon: L.divIcon({
          className: "cluster-icon",
          html: '<div class="cluster-pill">' + ${escapeHtml.toString()}(cluster.label) + "</div>",
          iconAnchor: [34, 34],
          iconSize: [68, 68],
        }),
      }).addTo(map);

      L.marker([focusPoint.latitude, focusPoint.longitude], {
        interactive: false,
        icon: L.divIcon({
          className: "focus-icon",
          html: '<div class="focus-pill"></div>',
          iconAnchor: [14, 14],
          iconSize: [28, 28],
        }),
      }).addTo(map);

      window.setSelectedMarker = syncSelection;

      function handleMessage(rawData) {
        try {
          const payload = JSON.parse(rawData);
          if (payload && payload.type === "select" && typeof payload.id === "string") {
            syncSelection(payload.id);
          }
        } catch (error) {
          // Ignore malformed messages from host.
        }
      }

      document.addEventListener("message", (event) => handleMessage(event.data));
      window.addEventListener("message", (event) => handleMessage(event.data));
    </script>
  </body>
</html>`;
}

function WebMapFallback() {
  return (
    <View style={{ backgroundColor: "#D9F1E6", flex: 1 }}>
      <View
        style={{
          backgroundColor: "rgba(111, 167, 217, 0.16)",
          borderRadius: 999,
          height: 340,
          left: -80,
          position: "absolute",
          top: -40,
          width: 300,
        }}
      />
      <View
        style={{
          backgroundColor: "rgba(111, 167, 217, 0.2)",
          borderRadius: 999,
          height: 460,
          position: "absolute",
          right: -110,
          top: 80,
          width: 420,
        }}
      />
      <View
        style={{
          backgroundColor: "rgba(114,122,147,0.42)",
          borderRadius: 999,
          height: 8,
          left: 16,
          position: "absolute",
          top: 250,
          transform: [{ rotate: "48deg" }],
          width: 320,
        }}
      />
      <View
        style={{
          backgroundColor: "rgba(114,122,147,0.32)",
          borderRadius: 999,
          height: 8,
          left: 72,
          position: "absolute",
          top: 460,
          transform: [{ rotate: "-14deg" }],
          width: 280,
        }}
      />

      <View style={clusterBadgeStyle}>
        <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "700" }}>12</Text>
      </View>

      {WEB_FALLBACK_MARKERS.map((marker) => (
        <View
          key={marker.label}
          style={{
            alignItems: "center",
            backgroundColor: marker.selected ? "#FF7A1A" : "rgba(255,255,255,0.96)",
            borderColor: marker.selected ? "#FFFFFF" : "transparent",
            borderRadius: 999,
            borderWidth: marker.selected ? 4 : 0,
            bottom: marker.bottom,
            left: marker.left,
            minWidth: marker.selected ? 138 : 92,
            paddingHorizontal: marker.selected ? 26 : 18,
            paddingVertical: marker.selected ? 16 : 12,
            position: "absolute",
            shadowColor: "#162334",
            shadowOpacity: 0.14,
            shadowRadius: 12,
          }}
        >
          <Text
            style={{
              color: marker.selected ? "#3D240D" : "#141B34",
              fontSize: marker.selected ? 20 : 17,
              fontWeight: "700",
            }}
          >
            {marker.label}
          </Text>
        </View>
      ))}

      <View style={focusPinStyle} />
    </View>
  );
}

function MapLoadingState() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "rgba(241, 247, 255, 0.96)",
        bottom: 0,
        justifyContent: "center",
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
      }}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.94)",
          borderRadius: 22,
          borderCurve: "continuous",
          gap: 10,
          paddingHorizontal: 22,
          paddingVertical: 18,
          boxShadow: "0 16px 34px rgba(20, 27, 52, 0.12)",
        }}
      >
        <ActivityIndicator color="#2454EA" size="small" />
        <Text selectable style={{ color: "#51607D", fontSize: 14, fontWeight: "500" }}>
          Đang tải bản đồ Việt Nam...
        </Text>
      </View>
    </View>
  );
}

export function OpenStreetMapView({
  listings,
  selectedId,
  cluster,
  focusPoint,
  onSelect,
}: OpenStreetMapViewProps) {
  const webViewRef = useRef<WebView>(null);
  const initialSelectedIdRef = useRef(selectedId);
  const [hasFailed, setHasFailed] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  const html = useMemo(
    () =>
      buildMapHtml({
        cluster,
        focusPoint,
        listings,
        selectedId: initialSelectedIdRef.current,
      }),
    [cluster, focusPoint, listings]
  );

  useEffect(() => {
    if (process.env.EXPO_OS === "web" || hasFailed || isMapReady) {
      return;
    }

    const watchdog = setTimeout(() => {
      setHasFailed(true);
    }, 5500);

    return () => {
      clearTimeout(watchdog);
    };
  }, [hasFailed, html, isMapReady]);

  useEffect(() => {
    webViewRef.current?.injectJavaScript(`
      window.setSelectedMarker && window.setSelectedMarker(${JSON.stringify(selectedId)});
      true;
    `);
  }, [selectedId]);

  if (process.env.EXPO_OS === "web") {
    return <WebMapFallback />;
  }

  if (hasFailed) {
    return <WebMapFallback />;
  }

  return (
    <View style={mapFrameStyle}>
      <WebView
        ref={webViewRef}
        domStorageEnabled
        javaScriptEnabled
        onError={() => {
          setHasFailed(true);
          setIsMapReady(true);
        }}
        onHttpError={() => {
          setHasFailed(true);
          setIsMapReady(true);
        }}
        onLoadStart={() => {
          setHasFailed(false);
          setIsMapReady(false);
        }}
        onMessage={(event: WebViewMessageEvent) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data);

            if (payload?.type === "ready") {
              setIsMapReady(true);
              return;
            }

            if (payload?.type === "select" && typeof payload.id === "string") {
              onSelect(payload.id);
            }
          } catch (error) {
            // Ignore malformed bridge messages from the map.
          }
        }}
        originWhitelist={["*"]}
        overScrollMode="never"
        renderLoading={() => <MapLoadingState />}
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        source={{ html }}
        startInLoadingState
        style={mapFrameStyle}
      />

      {!isMapReady ? <MapLoadingState /> : null}
    </View>
  );
}
