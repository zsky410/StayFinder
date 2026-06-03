import { Feather } from "@expo/vector-icons";
import { OSMView, TILE_CONFIGS, type MarkerConfig } from "expo-osm-sdk";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const MAP_INITIAL_ZOOM = 13.6;
const MAP_MODAL_INITIAL_ZOOM = 14.2;
const MAP_LANDMARK_LIMIT = 5;
const MAP_STYLE_URL = TILE_CONFIGS.openfreemapPositron.styleUrl;
const MAP_ATTRIBUTION = TILE_CONFIGS.openfreemapPositron.attribution;

function isValidCoordinate(latitude: unknown, longitude: unknown) {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    typeof longitude === "number" &&
    Number.isFinite(longitude)
  );
}

function formatMapDistanceLabel(distanceLabel: string | undefined) {
  if (!distanceLabel) {
    return "Landmark tham chiếu";
  }

  const normalized = distanceLabel
    .replace(/\s*(đi xe|đường đi|ước tính)\s*$/i, "")
    .trim();

  return normalized ? `cách ${normalized}` : "Landmark tham chiếu";
}

export function DetailLocationMap({
  latitude,
  longitude,
  title,
  landmarks = [],
}: DetailLocationMapProps) {
  const hasCoordinates = isValidCoordinate(latitude, longitude);
  const insets = useSafeAreaInsets();
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);

  const visibleLandmarks = useMemo(
    () =>
      landmarks
        .filter((landmark) => isValidCoordinate(landmark.latitude, landmark.longitude))
        .filter((landmark) => landmark.latitude !== latitude || landmark.longitude !== longitude)
        .slice(0, MAP_LANDMARK_LIMIT),
    [landmarks, latitude, longitude],
  );

  const markers = useMemo<MarkerConfig[]>(() => {
    if (!hasCoordinates) {
      return [];
    }

    return [
      {
        id: "place",
        coordinate: { latitude: latitude as number, longitude: longitude as number },
        title: title || "Địa điểm",
        description: "Địa điểm đang xem",
        infoWindow: {
          title: title || "Địa điểm",
          description: "Địa điểm đang xem",
          backgroundColor: "#FFFFFF",
          borderColor: "#D8E0F3",
          borderRadius: 14,
          maxWidth: 220,
        },
        zIndex: 10,
      },
      ...visibleLandmarks.map((landmark, index) => ({
        id: `landmark-${landmark.key || index}`,
        coordinate: {
          latitude: landmark.latitude,
          longitude: landmark.longitude,
        },
        title: landmark.name,
        description: formatMapDistanceLabel(landmark.distanceLabel),
        infoWindow: {
          title: landmark.name,
          description: formatMapDistanceLabel(landmark.distanceLabel),
          backgroundColor: "#FFFFFF",
          borderColor: "#F2D49B",
          borderRadius: 14,
          maxWidth: 220,
        },
        zIndex: 5,
      })),
    ];
  }, [hasCoordinates, latitude, longitude, title, visibleLandmarks]);

  const labeledPoints = useMemo(() => {
    if (!hasCoordinates) {
      return [];
    }

    return [
      {
        id: "place",
        label: title || "Địa điểm",
        coordinate: { latitude: latitude as number, longitude: longitude as number },
        kind: "place" as const,
      },
      ...visibleLandmarks.map((landmark) => ({
        id: `landmark-${landmark.key}`,
        label: landmark.name,
        sublabel: formatMapDistanceLabel(landmark.distanceLabel),
        coordinate: { latitude: landmark.latitude, longitude: landmark.longitude },
        kind: "landmark" as const,
      })),
    ];
  }, [hasCoordinates, latitude, longitude, title, visibleLandmarks]);

  if (!hasCoordinates) {
    return (
      <View style={styles.emptyMap}>
        <Text style={styles.emptyText}>
          Địa điểm này hiện chưa có tọa độ để hiển thị bản đồ.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OSMView
        initialCenter={{ latitude: latitude as number, longitude: longitude as number }}
        initialZoom={MAP_INITIAL_ZOOM}
        markers={markers}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled
        showsCompass={false}
        showsScale
        showsZoomControls={false}
        showUserLocation={false}
        style={styles.map}
        styleUrl={MAP_STYLE_URL}
        zoomEnabled
      />

      <Pressable
        onPress={() => {
          setIsMapModalVisible(true);
        }}
        style={({ pressed }) => [styles.openMapButton, pressed && styles.openMapButtonPressed]}
      >
        <Feather color="#17233F" name="maximize-2" size={13} />
        <Text style={styles.openMapButtonText}>Mở bản đồ</Text>
      </Pressable>

      <View pointerEvents="none" style={styles.placeBadge}>
        <Feather color="#2B58E8" name="map-pin" size={11} />
        <Text numberOfLines={1} style={styles.placeBadgeText}>
          {title || "Địa điểm"}
        </Text>
      </View>

      {visibleLandmarks.length ? (
        <View pointerEvents="none" style={styles.landmarkBadge}>
          <View style={styles.landmarkDot} />
          <Text numberOfLines={1} style={styles.landmarkBadgeText}>
            {visibleLandmarks.length} landmark gần đây
          </Text>
        </View>
      ) : null}

      <View pointerEvents="none" style={styles.attributionBadge}>
        <Text numberOfLines={1} style={styles.attributionText}>
          {MAP_ATTRIBUTION}
        </Text>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setIsMapModalVisible(false)}
        transparent
        visible={isMapModalVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingTop: Math.max(insets.top, 12) + 10 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.modalTitle}>
                  Bản đồ vị trí
                </Text>
                <Text numberOfLines={1} style={styles.modalSubtitle}>
                  Kéo bản đồ để xem hướng landmark quanh địa điểm
                </Text>
              </View>
              <Pressable onPress={() => setIsMapModalVisible(false)} style={styles.closeButton}>
                <Feather color="#17233F" name="x" size={20} />
              </Pressable>
            </View>

            <View style={styles.modalMapFrame}>
              <OSMView
                initialCenter={{ latitude: latitude as number, longitude: longitude as number }}
                initialZoom={MAP_MODAL_INITIAL_ZOOM}
                markers={markers}
                pitchEnabled={false}
                rotateEnabled={false}
                scrollEnabled
                showsCompass
                showsScale
                showsZoomControls
                showUserLocation={false}
                style={styles.modalMap}
                styleUrl={MAP_STYLE_URL}
                zoomEnabled
              />
            </View>

            <View style={[styles.modalLegend, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <Text style={styles.modalLegendTitle}>Các điểm trên bản đồ</Text>
              <View style={styles.modalLegendList}>
                {labeledPoints.map((point) => (
                  <View key={`legend-${point.id}`} style={styles.modalLegendItem}>
                    <View
                      style={[
                        styles.modalLegendDot,
                        point.kind === "place" ? styles.placeLabelDot : styles.landmarkLabelDot,
                      ]}
                    />
                    <Text numberOfLines={1} style={styles.modalLegendText}>
                      {point.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  attributionBadge: {
    backgroundColor: "rgba(255,255,255,0.84)",
    borderRadius: 6,
    bottom: 6,
    maxWidth: "78%",
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: "absolute",
    right: 6,
  },
  attributionText: {
    color: "#55627F",
    fontSize: 8,
    fontWeight: "500",
  },
  container: {
    backgroundColor: "#EAF0FA",
    borderRadius: 18,
    height: 220,
    overflow: "hidden",
    position: "relative",
  },
  emptyMap: {
    alignItems: "center",
    backgroundColor: "#EAF0FA",
    borderRadius: 18,
    height: 220,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 20,
  },
  emptyText: {
    color: "#55627F",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
  },
  landmarkBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderColor: "rgba(245, 158, 11, 0.25)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    left: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: "absolute",
    top: 46,
  },
  landmarkBadgeText: {
    color: "#17233F",
    fontSize: 11,
    fontWeight: "700",
  },
  landmarkDot: {
    backgroundColor: "#F59E0B",
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  map: {
    height: "100%",
    width: "100%",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#F3F6FD",
    borderRadius: 999,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  labelLayer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  landmarkLabelDot: {
    backgroundColor: "#F59E0B",
  },
  landmarkMapLabel: {
    borderColor: "rgba(245, 158, 11, 0.28)",
  },
  mapLabel: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    maxWidth: 170,
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: "absolute",
    transform: [{ translateX: -14 }, { translateY: -34 }],
  },
  mapLabelDot: {
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  mapLabelSubtext: {
    color: "#6D7690",
    fontSize: 9,
    fontWeight: "600",
    lineHeight: 12,
  },
  mapLabelText: {
    color: "#17233F",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
  },
  modalBackdrop: {
    backgroundColor: "rgba(10, 18, 34, 0.35)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  modalLegend: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  modalLegendDot: {
    borderRadius: 999,
    height: 9,
    width: 9,
  },
  modalLegendItem: {
    alignItems: "center",
    backgroundColor: "#F7F9FE",
    borderRadius: 999,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  modalLegendList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  modalLegendText: {
    color: "#17233F",
    fontSize: 12,
    fontWeight: "700",
    maxWidth: 150,
  },
  modalLegendTitle: {
    color: "#55627F",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalMap: {
    height: "100%",
    width: "100%",
  },
  modalMapFrame: {
    backgroundColor: "#EAF0FA",
    flex: 1,
    overflow: "hidden",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "88%",
    overflow: "hidden",
  },
  modalSubtitle: {
    color: "#6D7690",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  modalTitle: {
    color: "#17233F",
    fontSize: 18,
    fontWeight: "800",
  },
  openMapButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: "rgba(28, 42, 74, 0.1)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: "absolute",
    right: 12,
    top: 12,
  },
  openMapButtonPressed: {
    opacity: 0.82,
  },
  openMapButtonText: {
    color: "#17233F",
    fontSize: 11,
    fontWeight: "800",
  },
  placeBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.96)",
    borderColor: "rgba(43, 88, 232, 0.16)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    left: 12,
    maxWidth: 190,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: "absolute",
    top: 12,
  },
  placeBadgeText: {
    color: "#17233F",
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  placeLabelDot: {
    backgroundColor: "#2B58E8",
  },
  placeMapLabel: {
    borderColor: "rgba(43, 88, 232, 0.22)",
    zIndex: 20,
  },
});
