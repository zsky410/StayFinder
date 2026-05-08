import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

import { theme } from "@/constants/theme";

type PlaceholderScreenProps = {
  badge: string;
  title: string;
  description: string;
  accent?: string;
  footerNote?: string;
  children?: ReactNode;
};

export function PlaceholderScreen({
  badge,
  title,
  description,
  accent = theme.colors.accent,
  footerNote,
  children,
}: PlaceholderScreenProps) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.page }}>
      <View
        style={{
          pointerEvents: "none",
          position: "absolute",
          top: -70,
          right: -30,
          width: 180,
          height: 180,
          borderRadius: 999,
          backgroundColor: accent,
          opacity: 0.12,
        }}
      />
      <View
        style={{
          pointerEvents: "none",
          position: "absolute",
          top: 120,
          left: -60,
          width: 160,
          height: 160,
          borderRadius: 999,
          backgroundColor: theme.colors.ink,
          opacity: 0.05,
        }}
      />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 28,
          gap: 16,
        }}
      >
        <View
          style={{
            gap: 14,
            borderRadius: 28,
            borderCurve: "continuous",
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: 22,
            boxShadow: "0 16px 40px rgba(22, 41, 48, 0.10)",
          }}
        >
          <View
            style={{
              alignSelf: "flex-start",
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: accent,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700", letterSpacing: 0.4 }}>{badge}</Text>
          </View>

          <Text selectable style={{ color: theme.colors.ink, fontSize: 30, fontWeight: "800", lineHeight: 34 }}>
            {title}
          </Text>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 16, lineHeight: 24 }}>
            {description}
          </Text>
        </View>

        {children ? <View style={{ gap: 14 }}>{children}</View> : null}

        {footerNote ? (
          <View
            style={{
              borderRadius: 22,
              borderCurve: "continuous",
              backgroundColor: theme.colors.surfaceMuted,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 18,
            }}
          >
            <Text selectable style={{ color: theme.colors.ink, fontSize: 14, lineHeight: 22 }}>
              {footerNote}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
