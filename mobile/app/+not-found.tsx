import { Link, Stack } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Không tìm thấy màn hình" }} />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: theme.colors.page,
          padding: 24,
        }}
      >
        <Text selectable style={{ color: theme.colors.ink, fontSize: 21, fontWeight: "600", textAlign: "center" }}>
          Route này chưa tồn tại trong demo Phase 4.
        </Text>

        <Link href="/home" asChild>
          <Pressable
            style={({ pressed }) => ({
              borderRadius: 18,
              borderCurve: "continuous",
              backgroundColor: pressed ? theme.colors.accentPressed : theme.colors.accent,
              paddingHorizontal: 18,
              paddingVertical: 14,
            })}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>Quay về Home</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}
