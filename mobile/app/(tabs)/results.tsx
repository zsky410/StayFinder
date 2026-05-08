import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { sharedAssets, resultCards, resultFilters } from "@/data/demo-stays";
import { theme } from "@/constants/theme";

function Header() {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
        <Image source={sharedAssets.avatar} style={{ borderRadius: 18, height: 36, width: 36 }} />
        <Text selectable style={{ color: theme.colors.accent, fontSize: 24, fontWeight: "800" }}>
          StayFinder VN
        </Text>
      </View>

      <Feather color={theme.colors.ink} name="bell" size={18} />
    </View>
  );
}

function FilterChip({
  label,
  selected,
}: {
  label: string;
  selected?: boolean;
}) {
  return (
    <Pressable
      style={{
        alignItems: "center",
        backgroundColor: selected ? "#EDF3FF" : "#E9EFFB",
        borderColor: selected ? theme.colors.accent : "transparent",
        borderRadius: 10,
        borderCurve: "continuous",
        borderWidth: 1,
        flexDirection: "row",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      {selected ? <Feather color={theme.colors.accent} name="check" size={14} /> : null}
      <Text
        style={{
          color: selected ? theme.colors.accent : theme.colors.muted,
          fontSize: 12,
          fontWeight: selected ? "700" : "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AmenityRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: checked ? theme.colors.accent : theme.colors.surface,
          borderColor: checked ? theme.colors.accent : theme.colors.chipBorder,
          borderRadius: 5,
          borderWidth: 1,
          height: 18,
          justifyContent: "center",
          width: 18,
        }}
      >
        {checked ? <Feather color="#FFFFFF" name="check" size={12} /> : null}
      </View>
      <Text selectable style={{ color: checked ? theme.colors.ink : theme.colors.muted, fontSize: 15, fontWeight: "500" }}>
        {label}
      </Text>
    </View>
  );
}

function PriceSlider() {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ height: 26, justifyContent: "center", paddingHorizontal: 2 }}>
        <View
          style={{
            backgroundColor: "#D9E4FF",
            borderRadius: 999,
            height: 6,
          }}
        />
        <View
          style={{
            backgroundColor: theme.colors.accent,
            borderRadius: 999,
            height: 6,
            left: "10%",
            position: "absolute",
            right: "28%",
          }}
        />
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderColor: theme.colors.accent,
            borderRadius: 999,
            borderWidth: 1.5,
            boxShadow: "0 6px 14px rgba(36, 84, 234, 0.16)",
            height: 22,
            left: "8%",
            position: "absolute",
            width: 22,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: 999,
              height: 7,
              left: 6,
              position: "absolute",
              top: 6,
              width: 7,
            }}
          />
        </View>
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderColor: theme.colors.accent,
            borderRadius: 999,
            borderWidth: 1.5,
            boxShadow: "0 6px 14px rgba(36, 84, 234, 0.16)",
            height: 22,
            position: "absolute",
            right: "26%",
            width: 22,
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.accent,
              borderRadius: 999,
              height: 7,
              left: 6,
              position: "absolute",
              top: 6,
              width: 7,
            }}
          />
        </View>
      </View>

      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text selectable style={{ color: theme.colors.ink, fontSize: 12, fontWeight: "500" }}>
          200k
        </Text>
        <Text selectable style={{ color: theme.colors.ink, fontSize: 12, fontWeight: "500" }}>
          2.000k+
        </Text>
      </View>
    </View>
  );
}

function ResultCard({
  item,
}: {
  item: (typeof resultCards)[number];
}) {
  const badgeTone =
    item.badge?.tone === "blue"
      ? { bg: theme.colors.accent, fg: "#FFFFFF" }
      : { bg: "#FF7A1A", fg: "#FFFFFF" };

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/place/[place-id]", params: { "place-id": item.id } })}
      style={({ pressed }) => ({
        borderRadius: 18,
        opacity: pressed ? 0.94 : 1,
        paddingBottom: 4,
      })}
    >
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.chipBorder,
          borderRadius: 18,
          borderCurve: "continuous",
          borderWidth: 1,
          boxShadow: "0 12px 24px rgba(25, 38, 74, 0.08)",
          overflow: "hidden",
        }}
      >
        <View>
          <Image source={item.image} style={{ height: 210, width: "100%" }} />

          {item.badge ? (
            <View
              style={{
                alignItems: "center",
                backgroundColor: badgeTone.bg,
                borderBottomRightRadius: 10,
                borderTopLeftRadius: 18,
                flexDirection: "row",
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 6,
                position: "absolute",
                left: 0,
                top: 0,
              }}
            >
              <MaterialCommunityIcons
                color={badgeTone.fg}
                name={item.badge.tone === "blue" ? "fire" : "waves"}
                size={13}
              />
              <Text style={{ color: badgeTone.fg, fontSize: 11, fontWeight: "700" }}>{item.badge.label}</Text>
            </View>
          ) : null}

          <View
            style={{
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.92)",
              borderColor: "#EDF0F8",
              borderRadius: 999,
              borderCurve: "continuous",
              borderWidth: 1,
              flexDirection: "row",
              gap: 5,
              paddingHorizontal: 9,
              paddingVertical: 6,
              position: "absolute",
              right: 10,
              top: 10,
            }}
          >
            <Feather color={theme.colors.sun} name="star" size={12} />
            <Text selectable style={{ color: theme.colors.ink, fontSize: 12, fontWeight: "700" }}>
              {item.rating}
            </Text>
          </View>

          <Pressable
            style={{
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.92)",
              borderRadius: 999,
              bottom: 10,
              height: 32,
              justifyContent: "center",
              position: "absolute",
              right: 10,
              width: 32,
            }}
          >
            <Feather color={theme.colors.muted} name="heart" size={16} />
          </Pressable>
        </View>

        <View style={{ gap: 8, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 14 }}>
          <Text selectable style={{ color: theme.colors.ink, fontSize: 18, fontWeight: "800" }}>
            {item.title}
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <Feather color={theme.colors.muted} name="map-pin" size={13} />
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "500" }}>
              {item.location}
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 6 }}>
            {item.chips.map((chip) => (
              <View
                key={chip}
                style={{
                  backgroundColor: "#E8F0FF",
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ color: theme.colors.ink, fontSize: 10, fontWeight: "700" }}>{chip}</Text>
              </View>
            ))}
          </View>

          <View
            style={{
              alignItems: "flex-end",
              borderTopColor: "rgba(140, 147, 168, 0.18)",
              borderTopWidth: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 4,
              paddingTop: 12,
            }}
          >
            <View style={{ gap: 3 }}>
              {item.oldPrice ? (
                <Text
                  selectable
                  style={{
                    color: "#8C93A8",
                    fontSize: 12,
                    fontWeight: "500",
                    textDecorationLine: "line-through",
                  }}
                >
                  {item.oldPrice}
                </Text>
              ) : (
                <View />
              )}
              <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 2 }}>
                <Text selectable style={{ color: theme.colors.sun, fontSize: 16, fontWeight: "800" }}>
                  {item.price}
                </Text>
                <Text selectable style={{ color: theme.colors.ink, fontSize: 14, fontWeight: "500" }}>
                  /đêm
                </Text>
              </View>
            </View>

            <Pressable
              style={{
                backgroundColor: theme.colors.accent,
                borderRadius: 8,
                borderCurve: "continuous",
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>Đặt ngay</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function ResultsRoute() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <StatusBar style="dark" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: 16,
          paddingBottom: Math.max(insets.bottom + 108, 122),
          paddingHorizontal: 16,
          paddingTop: Math.max(insets.top + 8, 16),
        }}
        showsVerticalScrollIndicator={false}
      >
        <Header />

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.chipBorder,
            borderRadius: 18,
            borderWidth: 1,
            gap: 20,
            padding: 16,
            boxShadow: "0 10px 24px rgba(25, 38, 74, 0.06)",
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Feather color={theme.colors.accent} name="sliders" size={17} />
              <Text selectable style={{ color: theme.colors.ink, fontSize: 16, fontWeight: "700" }}>
                Bộ lọc
              </Text>
            </View>
            <Text selectable style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "600" }}>
              Xóa bộ lọc
            </Text>
          </View>

          <View style={{ backgroundColor: theme.colors.chipBorder, height: 1 }} />

          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "700" }}>
              Khu vực
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {resultFilters.zones.map((zone, index) => (
                <FilterChip key={zone} label={zone} selected={index === 0} />
              ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "700" }}>
              Khoảng giá
            </Text>
            <PriceSlider />
          </View>

          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "700" }}>
              Loại hình
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {resultFilters.types.map((type, index) => (
                <FilterChip key={type} label={type} selected={index === 0} />
              ))}
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "700" }}>
              Tiện ích
            </Text>
            <View style={{ gap: 10 }}>
              {resultFilters.amenities.map((item) => (
                <AmenityRow checked={item.checked} key={item.label} label={item.label} />
              ))}
            </View>
          </View>

          <Pressable
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.accent,
              borderRadius: 12,
              minHeight: 54,
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>Áp dụng</Text>
          </Pressable>
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <Text selectable style={{ color: theme.colors.ink, fontSize: 20, fontWeight: "800" }}>
            Tìm thấy 34 địa điểm
          </Text>
          <MaterialCommunityIcons color={theme.colors.ink} name="swap-vertical" size={18} />
        </View>

        <View style={{ gap: 14 }}>
          {resultCards.map((item) => (
            <ResultCard item={item} key={item.id} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
