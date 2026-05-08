import { Text, View } from "react-native";

import { PlaceholderScreen } from "@/components/placeholder-screen";
import { theme } from "@/constants/theme";

export default function ChatTabRoute() {
  return (
    <PlaceholderScreen
      badge="Chat AI"
      title="Chatbot"
      description="Tab này khóa trước flow chat lưu trú + local context. Sau này nó sẽ gọi thẳng endpoint POST /chat/query từ backend Phase 3."
      accent={theme.colors.ink}
      footerNote="Prompt gợi ý nên dùng tiếng Việt có dấu, ví dụ: cho tôi gợi ý nơi ở view đẹp ven sông Hàn."
    >
      <View style={{ gap: 12 }}>
        {[
          "cho tôi gợi ý nơi ở view đẹp ven sông Hàn",
          "khách sạn gần Cầu Rồng cho gia đình",
          "homestay gần biển có chỗ đậu xe",
        ].map((prompt) => (
          <View
            key={prompt}
            style={{
              borderRadius: 20,
              borderCurve: "continuous",
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 16,
              boxShadow: "0 10px 24px rgba(22, 41, 48, 0.08)",
            }}
          >
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, lineHeight: 22 }}>
              {prompt}
            </Text>
          </View>
        ))}
      </View>
    </PlaceholderScreen>
  );
}
