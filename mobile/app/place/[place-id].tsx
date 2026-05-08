import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { detailByPlaceId, type DetailPlaceId } from "@/data/demo-stays";
import { theme } from "@/constants/theme";

function getPlaceId(value: string | string[] | undefined): DetailPlaceId {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate && candidate in detailByPlaceId) {
    return candidate as DetailPlaceId;
  }

  return "demo-bien-xanh";
}

function AmenityIcon({ icon }: { icon: string }) {
  if (icon === "wifi") {
    return <Feather color={theme.colors.accent} name="wifi" size={24} />;
  }

  if (icon === "parking") {
    return <MaterialCommunityIcons color={theme.colors.accent} name="parking" size={26} />;
  }

  if (icon === "television") {
    return <MaterialCommunityIcons color={theme.colors.accent} name="television" size={24} />;
  }

  if (icon === "snowflake") {
    return <MaterialCommunityIcons color={theme.colors.accent} name="snowflake" size={24} />;
  }

  if (icon === "pool") {
    return <MaterialCommunityIcons color={theme.colors.accent} name="pool" size={24} />;
  }

  if (icon === "stove") {
    return <MaterialCommunityIcons color={theme.colors.accent} name="stove" size={24} />;
  }

  if (icon === "washing-machine") {
    return <MaterialCommunityIcons color={theme.colors.accent} name="washing-machine" size={24} />;
  }

  if (icon === "silverware-fork-knife") {
    return <MaterialCommunityIcons color={theme.colors.accent} name="silverware-fork-knife" size={24} />;
  }

  return <Feather color={theme.colors.accent} name="circle" size={20} />;
}

function DetailTagIcon({ tag }: { tag: string }) {
  if (tag.toLowerCase().includes("thú cưng")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="paw" size={16} />;
  }

  if (tag.toLowerCase().includes("bếp")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="stove" size={16} />;
  }

  if (tag.toLowerCase().includes("biển")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="waves" size={16} />;
  }

  if (tag.toLowerCase().includes("hồ bơi")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="pool" size={16} />;
  }

  if (tag.toLowerCase().includes("view")) {
    return <Feather color={theme.colors.accent} name="eye" size={16} />;
  }

  if (tag.toLowerCase().includes("ăn sáng")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="silverware-fork-knife" size={16} />;
  }

  if (tag.toLowerCase().includes("wifi")) {
    return <Feather color={theme.colors.accent} name="wifi" size={16} />;
  }

  if (tag.toLowerCase().includes("máy giặt")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="washing-machine" size={16} />;
  }

  return <Feather color={theme.colors.accent} name="tag" size={16} />;
}

function FauxMap() {
  return (
    <View
      style={{
        backgroundColor: "#6CB8D2",
        borderRadius: 18,
        borderCurve: "continuous",
        height: 220,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          backgroundColor: "#EFE6DA",
          borderRadius: 80,
          height: 320,
          left: 108,
          opacity: 0.95,
          position: "absolute",
          top: -58,
          transform: [{ rotate: "10deg" }],
          width: 158,
        }}
      />
      <View
        style={{
          backgroundColor: "#F6EFE7",
          height: 22,
          left: 74,
          opacity: 0.98,
          position: "absolute",
          top: 88,
          transform: [{ rotate: "-17deg" }],
          width: 258,
        }}
      />
      <View
        style={{
          backgroundColor: "#F6EFE7",
          height: 14,
          left: 20,
          opacity: 0.95,
          position: "absolute",
          top: 142,
          transform: [{ rotate: "16deg" }],
          width: 214,
        }}
      />
      <View
        style={{
          backgroundColor: "#B8D9B6",
          borderRadius: 24,
          height: 78,
          left: 14,
          position: "absolute",
          top: 16,
          width: 116,
        }}
      />
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.3)",
          height: 2,
          left: 150,
          position: "absolute",
          top: 12,
          transform: [{ rotate: "88deg" }],
          width: 208,
        }}
      />
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.3)",
          height: 2,
          left: 92,
          position: "absolute",
          top: 106,
          transform: [{ rotate: "-20deg" }],
          width: 220,
        }}
      />
      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.28)",
          height: 2,
          left: 36,
          position: "absolute",
          top: 156,
          transform: [{ rotate: "18deg" }],
          width: 176,
        }}
      />
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#2B58E8",
          borderRadius: 999,
          bottom: 54,
          height: 52,
          justifyContent: "center",
          left: 170,
          position: "absolute",
          width: 52,
          boxShadow: "0 10px 24px rgba(36, 84, 234, 0.3)",
        }}
      >
        <Feather color="#FFFFFF" name="map-pin" size={22} />
      </View>
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#E44747",
          borderRadius: 999,
          height: 18,
          justifyContent: "center",
          left: 200,
          position: "absolute",
          top: 72,
          width: 18,
        }}
      >
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 999,
            height: 6,
            width: 6,
          }}
        />
      </View>
    </View>
  );
}

export default function PlaceDetailRoute() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ "place-id"?: string | string[] }>();
  const place = detailByPlaceId[getPlaceId(params["place-id"])];

  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 112, 128),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: "relative" }}>
          <ImageBackground source={place.heroImage} style={{ height: 348, justifyContent: "space-between" }}>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                paddingTop: Math.max(insets.top + 10, 24),
              }}
            >
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.94)",
                  borderRadius: 999,
                  height: 42,
                  justifyContent: "center",
                  width: 42,
                }}
              >
                <Feather color={theme.colors.ink} name="arrow-left" size={22} />
              </Pressable>

              <Pressable
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.94)",
                  borderRadius: 999,
                  height: 42,
                  justifyContent: "center",
                  width: 42,
                }}
              >
                <Feather color={theme.colors.ink} name="share-2" size={19} />
              </Pressable>
            </View>

            <View style={{ alignItems: "flex-end", paddingBottom: 14, paddingHorizontal: 16 }}>
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.96)",
                  borderRadius: 18,
                  borderCurve: "continuous",
                  flexDirection: "row",
                  gap: 8,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <MaterialCommunityIcons color={theme.colors.ink} name="image-multiple-outline" size={18} />
                <Text selectable style={{ color: theme.colors.ink, fontSize: 14, fontWeight: "700" }}>
                  {place.photoCount}
                </Text>
              </View>
            </View>
          </ImageBackground>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            marginTop: -26,
            paddingHorizontal: 16,
            paddingTop: 18,
          }}
        >
          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
            <Text
              selectable
              style={{
                color: theme.colors.ink,
                flex: 1,
                fontSize: 21,
                fontWeight: "800",
                lineHeight: 31,
                paddingTop: 4,
              }}
            >
              {place.title}
            </Text>

            <View
              style={{
                backgroundColor: "#E8F0FF",
                borderRadius: 16,
                borderCurve: "continuous",
                minWidth: 104,
                paddingHorizontal: 12,
                paddingVertical: 10,
                boxShadow: "0 6px 14px rgba(20, 27, 52, 0.05)",
              }}
            >
              <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                <Feather color={theme.colors.sun} name="star" size={16} />
                <Text selectable style={{ color: theme.colors.sun, fontSize: 16, fontWeight: "800" }}>
                  {place.rating}
                </Text>
              </View>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "500", marginTop: 6 }}>
                {place.reviewsCount}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: "center", flexDirection: "row", gap: 10, marginTop: 10 }}>
            <Feather color={theme.colors.ink} name="map-pin" size={16} />
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "500" }}>
              {place.distance}
            </Text>
            <Text selectable style={{ color: "#8A92A9", fontSize: 16 }}>•</Text>
            <Text selectable style={{ color: theme.colors.accent, fontSize: 15, fontWeight: "700" }}>
              {place.mapLabel}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 6, marginTop: 18 }}>
            <Text selectable style={{ color: theme.colors.sun, fontSize: 19, fontWeight: "800" }}>
              {place.price}
            </Text>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 16, fontWeight: "500" }}>
              / đêm
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
            {place.tags.map((tag) => (
              <View
                key={tag}
                style={{
                  alignItems: "center",
                  backgroundColor: "#F6F8FF",
                  borderColor: theme.colors.chipBorder,
                  borderRadius: 12,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 7,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                }}
              >
                <DetailTagIcon tag={tag} />
                <Text selectable style={{ color: theme.colors.ink, fontSize: 14, fontWeight: "600" }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={{
              backgroundColor: "#EDF3FF",
              borderColor: "#D9E5FF",
              borderRadius: 16,
              borderWidth: 1,
              marginTop: 18,
              padding: 16,
              position: "relative",
            }}
          >
            <View
              style={{
                backgroundColor: theme.colors.accent,
                borderRadius: 999,
                flexDirection: "row",
                gap: 6,
                left: 16,
                paddingHorizontal: 12,
                paddingVertical: 6,
                position: "absolute",
                top: -12,
              }}
            >
              <MaterialCommunityIcons color="#FFFFFF" name="star-four-points-outline" size={15} />
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>AI Tóm tắt đánh giá</Text>
            </View>

            <View style={{ gap: 14, marginTop: 30 }}>
              <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                <Feather color={theme.colors.accent} name="check-circle" size={22} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text selectable style={{ color: theme.colors.ink, fontSize: 16, fontWeight: "800" }}>
                    {place.summary.positiveTitle}
                  </Text>
                  <Text selectable style={{ color: theme.colors.ink, fontSize: 15, lineHeight: 23 }}>
                    {place.summary.positiveText}
                  </Text>
                </View>
              </View>

              <View style={{ backgroundColor: "#D7DFF5", height: 1 }} />

              <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                <MaterialCommunityIcons color="#C24E0D" name="alert-circle-outline" size={22} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text selectable style={{ color: theme.colors.ink, fontSize: 16, fontWeight: "800" }}>
                    {place.summary.cautionTitle}
                  </Text>
                  <Text selectable style={{ color: theme.colors.ink, fontSize: 15, lineHeight: 23 }}>
                    {place.summary.cautionText}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={{ gap: 18, marginTop: 34 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 20, fontWeight: "800" }}>
              Tiện nghi
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {place.amenities.map((amenity) => (
                <View key={amenity.label} style={{ alignItems: "center", flex: 1, gap: 10 }}>
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: "#EDF3FF",
                      borderRadius: 999,
                      height: 56,
                      justifyContent: "center",
                      width: 56,
                    }}
                  >
                    <AmenityIcon icon={amenity.icon} />
                  </View>
                  <Text
                    selectable
                    style={{ color: theme.colors.ink, fontSize: 13, fontWeight: "500", lineHeight: 18, textAlign: "center" }}
                  >
                    {amenity.label}
                  </Text>
                </View>
              ))}
            </View>

            <Pressable
              style={{
                alignItems: "center",
                borderColor: theme.colors.chipBorder,
                borderRadius: 12,
                borderWidth: 1,
                minHeight: 52,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: theme.colors.accent, fontSize: 16, fontWeight: "700" }}>
                Xem tất cả 24 tiện nghi
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: 16, marginTop: 34 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 20, fontWeight: "800" }}>
              Vị trí
            </Text>
            <FauxMap />
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, lineHeight: 23 }}>
              {place.locationDescription}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.98)",
          borderTopColor: theme.colors.chipBorder,
          borderTopWidth: 1,
          boxShadow: "0 -8px 24px rgba(36, 84, 234, 0.08)",
          bottom: 0,
          flexDirection: "row",
          gap: 12,
          left: 0,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingHorizontal: 16,
          paddingTop: 12,
          position: "absolute",
          right: 0,
        }}
      >
        <Pressable
          style={{
            alignItems: "center",
            backgroundColor: "#EDF3FF",
            borderRadius: 14,
            height: 52,
            justifyContent: "center",
            width: 68,
          }}
        >
          <Feather color={theme.colors.accent} name="phone" size={20} />
        </Pressable>

        <Pressable
          style={{
            alignItems: "center",
            backgroundColor: "#EDF3FF",
            borderRadius: 14,
            height: 52,
            justifyContent: "center",
            width: 68,
          }}
        >
          <MaterialCommunityIcons color={theme.colors.accent} name="navigation-variant-outline" size={21} />
        </Pressable>

        <Pressable
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.accent,
            borderRadius: 14,
            flex: 1,
            flexDirection: "row",
            gap: 10,
            justifyContent: "center",
          }}
        >
          <Feather color="#FFFFFF" name="bookmark" size={20} />
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>Lưu địa điểm</Text>
        </Pressable>
      </View>
    </View>
  );
}
