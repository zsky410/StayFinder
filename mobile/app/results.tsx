import { Text, View } from "react-native";

import { DemoLinkCard } from "@/components/demo-link-card";
import { PlaceholderScreen } from "@/components/placeholder-screen";
import { theme } from "@/constants/theme";

export default function ResultsRoute() {
  return (
    <PlaceholderScreen
      badge="Kết quả"
      title="Results List"
      description="Màn danh sách kết quả hiện đã được tách khỏi bottom tabs để flow điều hướng ổn định hơn. Đây là điểm vào phù hợp cho search, quick filters và section Xem tất cả từ Home."
      accent={theme.colors.sun}
      footerNote="Bước tiếp theo có thể nối màn này với GET /places, sort, filter sheet và deeplink từ AI Chat."
    >
      <View
        style={{
          gap: 10,
          borderRadius: 24,
          borderCurve: "continuous",
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: 18,
          boxShadow: "0 12px 32px rgba(22, 41, 48, 0.08)",
        }}
      >
        <Text selectable style={{ color: theme.colors.ink, fontSize: 18, fontWeight: "700" }}>
          Điều hướng Phase 4
        </Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 23 }}>
          Từ đây bạn có thể mở filter modal hoặc đi tiếp vào detail. Sau này màn này sẽ là nơi render list card và map
          sync theo plan.
        </Text>
      </View>

      <DemoLinkCard
        href="/filter-sheet"
        eyebrow="Modal"
        title="Mở Filter Sheet"
        description="Demo nhanh luồng filter dạng modal từ màn Results."
      />
      <DemoLinkCard
        href={{ pathname: "/place/[place-id]", params: { "place-id": "demo-my-khe" } }}
        eyebrow="Stack"
        title="Mở Place Detail mẫu"
        description="Màn detail mẫu để test back navigation từ Results sang Detail."
      />
    </PlaceholderScreen>
  );
}
