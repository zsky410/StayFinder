import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import { defaultMapListingId, mapListings, mapOverlayPoints } from "@/data/demo-stays";
import { OpenStreetMapView } from "@/components/open-street-map-view";

export default function MapTabRoute() {
  const insets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string>(defaultMapListingId);

  const selectedListing = mapListings.find((item) => item.id === selectedId) ?? mapListings[0];

  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <StatusBar style="dark" />

      <OpenStreetMapView
        cluster={mapOverlayPoints.cluster}
        focusPoint={mapOverlayPoints.focus}
        listings={mapListings}
        onSelect={setSelectedId}
        selectedId={selectedId}
      />

      <View
        pointerEvents="box-none"
        style={{
          left: 0,
          paddingHorizontal: 16,
          position: "absolute",
          right: 0,
          top: Math.max(insets.top + 8, 16),
        }}
      >
        <View
          style={{
            alignItems: "center",
            backgroundColor: "rgba(255,255,255,0.96)",
            borderRadius: 999,
            borderCurve: "continuous",
            flexDirection: "row",
            gap: 12,
            minHeight: 62,
            paddingLeft: 16,
            paddingRight: 8,
            boxShadow: "0 16px 34px rgba(20, 27, 52, 0.12)",
          }}
        >
          <Feather color={theme.colors.muted} name="search" size={21} />

          <Pressable
            onPress={() => router.push("/results")}
            style={{ flex: 1, minHeight: 62, justifyContent: "center" }}
          >
            <Text selectable style={{ color: "#B8BDD0", fontSize: 15, fontWeight: "500" }}>
              Tìm kiếm khu vực...
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/filter-sheet")}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: "#EDF3FF",
              borderRadius: 999,
              height: 46,
              justifyContent: "center",
              opacity: pressed ? 0.72 : 1,
              width: 46,
            })}
          >
            <Feather color={theme.colors.ink} name="sliders" size={20} />
          </Pressable>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={{
          bottom: Math.max(insets.bottom + 106, 122),
          left: 0,
          paddingHorizontal: 16,
          position: "absolute",
          right: 0,
        }}
      >
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.98)",
            borderRadius: 24,
            borderCurve: "continuous",
            flexDirection: "row",
            overflow: "hidden",
            boxShadow: "0 18px 34px rgba(20, 27, 52, 0.16)",
          }}
        >
          <View style={{ position: "relative" }}>
            <Image source={selectedListing.image} style={{ height: 124, width: 96 }} />

            <View
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.94)",
                borderRadius: 999,
                borderCurve: "continuous",
                flexDirection: "row",
                gap: 5,
                left: 10,
                paddingHorizontal: 8,
                paddingVertical: 5,
                position: "absolute",
                top: 10,
              }}
            >
              <Feather color={theme.colors.sun} name="star" size={12} />
              <Text selectable style={{ color: theme.colors.ink, fontSize: 11, fontWeight: "600" }}>
                {selectedListing.rating}
              </Text>
            </View>
          </View>

          <View style={{ flex: 1, gap: 8, justifyContent: "space-between", padding: 11 }}>
            <View style={{ gap: 6 }}>
              <Text selectable numberOfLines={2} style={{ color: theme.colors.ink, fontSize: 16, fontWeight: "700", lineHeight: 21 }}>
                {selectedListing.title}
              </Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                <Feather color={theme.colors.muted} name="map-pin" size={14} />
                <Text selectable style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "500" }}>
                  {selectedListing.district}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ gap: 2 }}>
                <Text selectable style={{ color: theme.colors.sun, fontSize: 15, fontWeight: "700" }}>
                  {selectedListing.price}
                </Text>
                <Text selectable style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "500" }}>
                  /đêm
                </Text>
              </View>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/place/[place-id]",
                    params: { "place-id": selectedListing.detailId },
                  })
                }
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: theme.colors.accent,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  justifyContent: "center",
                  minHeight: 44,
                  minWidth: 92,
                  opacity: pressed ? 0.82 : 1,
                  paddingHorizontal: 10,
                })}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>Xem chi tiết</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
