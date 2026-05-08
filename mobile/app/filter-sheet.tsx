import { Stack } from "expo-router";
import { Text, View } from "react-native";

import { PlaceholderScreen } from "@/components/placeholder-screen";
import { theme } from "@/constants/theme";

export default function FilterSheetRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Filter Sheet" }} />
      <PlaceholderScreen
        badge="Modal"
        title="Filter Sheet"
        description="Đây là modal placeholder cho bộ lọc. Tạm thời mới dùng để xác nhận navigation, presentation và vị trí route trong Phase 4."
        accent={theme.colors.sun}
        footerNote="Các nhóm filter dự kiến: loại hình, khu vực, rating, tiện ích, gần landmark."
      >
        <View style={{ gap: 10 }}>
          {["Loại hình", "Khu vực", "Rating", "Tiện ích", "Gần landmark"].map((item) => (
            <View
              key={item}
              style={{
                borderRadius: 18,
                borderCurve: "continuous",
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: 16,
              }}
            >
              <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "500" }}>
                {item}
              </Text>
            </View>
          ))}
        </View>
      </PlaceholderScreen>
    </>
  );
}
