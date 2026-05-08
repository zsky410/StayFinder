import { Link, Stack, useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { PlaceholderScreen } from "@/components/placeholder-screen";
import { theme } from "@/constants/theme";

function getPlaceId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "demo-place";
  }

  return value ?? "demo-place";
}

export default function PlaceDetailRoute() {
  const params = useLocalSearchParams<{ "place-id"?: string | string[] }>();
  const placeId = getPlaceId(params["place-id"]);

  return (
    <>
      <Stack.Screen options={{ title: "Place Detail" }} />
      <PlaceholderScreen
        badge="Stack"
        title="Place Detail"
        description="Màn chi tiết nơi ở đã có route riêng để test stack navigation. Chưa có UI thật, nhưng đã sẵn chỗ cho gallery, tiện ích, review mẫu, landmark metrics và AI summary."
        accent={theme.colors.accent}
        footerNote="Place ID demo sẽ giúp bạn map tiếp với GET /places/:id sau khi bước UI chi tiết bắt đầu."
      >
        <View
          style={{
            gap: 12,
            borderRadius: 24,
            borderCurve: "continuous",
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: 20,
            boxShadow: "0 12px 32px rgba(22, 41, 48, 0.08)",
          }}
        >
          <Text selectable style={{ color: theme.colors.ink, fontSize: 18, fontWeight: "700" }}>
            Place ID demo
          </Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 23 }}>
            {placeId}
          </Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 23 }}>
            Block dự kiến: gallery, thông tin cơ bản, tiện ích, review sample, AI summary, khoảng cách tới landmark,
            CTA gọi điện và mở Google Maps.
          </Text>
        </View>

        <Link href={`/ai-review/${placeId}`} asChild>
          <Pressable
            style={({ pressed }) => ({
              borderRadius: 20,
              borderCurve: "continuous",
              backgroundColor: pressed ? theme.colors.accentPressed : theme.colors.ink,
              paddingHorizontal: 18,
              paddingVertical: 16,
            })}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
              Mở AI Review Summary demo
            </Text>
          </Pressable>
        </Link>
      </PlaceholderScreen>
    </>
  );
}
