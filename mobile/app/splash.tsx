import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter } from "expo-router";

import { theme } from "@/constants/theme";

export default function SplashRoute() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace("/home");
    }, 1400);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.page }}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <StatusBar style="dark" />

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -120,
          right: -40,
          width: 280,
          height: 280,
          borderRadius: 999,
          backgroundColor: theme.colors.accent,
          opacity: 0.14,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -90,
          left: -50,
          width: 220,
          height: 220,
          borderRadius: 999,
          backgroundColor: theme.colors.sun,
          opacity: 0.18,
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingTop: 84,
          paddingBottom: 32,
        }}
      >
        <View style={{ gap: 18 }}>
          <View
            style={{
              alignSelf: "flex-start",
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: theme.colors.ink,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }}>
              STAYFINDER PHASE 4
            </Text>
          </View>

          <Text
            selectable
            style={{
              color: theme.colors.ink,
              fontSize: 44,
              fontWeight: "800",
              lineHeight: 48,
            }}
          >
            StayFinder
          </Text>
          <Text
            selectable
            style={{
              color: theme.colors.muted,
              fontSize: 17,
              lineHeight: 26,
              maxWidth: 320,
            }}
          >
            Demo mobile Android-first cho luồng tìm nơi ở tại Đà Nẵng, bắt đầu từ splash rồi đi vào Home và
            các tab chính.
          </Text>
        </View>

        <View
          style={{
            gap: 16,
            borderRadius: 28,
            borderCurve: "continuous",
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: 22,
            boxShadow: "0 16px 40px rgba(22, 41, 48, 0.10)",
          }}
        >
          <View style={{ gap: 8 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 22, fontWeight: "700" }}>
              Splash Screen
            </Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 23 }}>
              App sẽ tự chuyển sang tab Trang chủ sau khoảng 1.4 giây. Bạn cũng có thể bấm nút bên dưới để vào
              nhanh màn demo.
            </Text>
          </View>

          <Pressable
            onPress={() => router.replace("/home")}
            style={({ pressed }) => ({
              borderRadius: 20,
              borderCurve: "continuous",
              backgroundColor: pressed ? theme.colors.accentPressed : theme.colors.accent,
              paddingHorizontal: 18,
              paddingVertical: 16,
            })}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700", textAlign: "center" }}>
              Vào Trang chủ demo
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
