import { Link, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";

type DemoLinkCardProps = {
  href: Href;
  title: string;
  description: string;
  eyebrow: string;
};

export function DemoLinkCard({ href, title, description, eyebrow }: DemoLinkCardProps) {
  return (
    <Link href={href} asChild>
      <Pressable
        style={({ pressed }) => ({
          borderRadius: 24,
          borderCurve: "continuous",
          backgroundColor: pressed ? theme.colors.surfacePressed : theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
          padding: 18,
          gap: 10,
          boxShadow: "0 12px 32px rgba(22, 41, 48, 0.08)",
        })}
      >
        <View
          style={{
            alignSelf: "flex-start",
            borderRadius: 999,
            borderCurve: "continuous",
            backgroundColor: theme.colors.surfaceMuted,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }}
        >
          <Text style={{ color: theme.colors.ink, fontSize: 12, fontWeight: "700", letterSpacing: 0.4 }}>
            {eyebrow}
          </Text>
        </View>

        <Text selectable style={{ color: theme.colors.ink, fontSize: 18, fontWeight: "700" }}>
          {title}
        </Text>
        <Text selectable style={{ color: theme.colors.muted, fontSize: 15, lineHeight: 22 }}>
          {description}
        </Text>
      </Pressable>
    </Link>
  );
}
