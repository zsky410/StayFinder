import { Stack, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { PlaceholderScreen } from "@/components/placeholder-screen";
import { theme } from "@/constants/theme";

function getPlaceId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "demo-place";
  }

  return value ?? "demo-place";
}

export default function AiReviewRoute() {
  const params = useLocalSearchParams<{ "place-id"?: string | string[] }>();
  const placeId = getPlaceId(params["place-id"]);

  return (
    <>
      <Stack.Screen options={{ title: "AI Review Summary" }} />
      <PlaceholderScreen
        badge="AI block"
        title="AI Review Summary"
        description="Màn này đại diện cho block AI review summary trong Phase 4. Hiện mới là placeholder để khóa route và kiểm tra flow từ Detail sang AI Summary."
        accent={theme.colors.coral}
        footerNote="Sau này màn này có thể lấy dữ liệu từ GET /places/:id hoặc POST /ai/review-summary tùy chiến lược cache của bạn."
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
            Tại đây sau này có thể render: summary_text, bullets và timestamp cache của AI block.
          </Text>
        </View>
      </PlaceholderScreen>
    </>
  );
}
