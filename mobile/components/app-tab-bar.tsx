import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";

const TAB_CONFIG = {
  home: { label: "Trang chủ", kind: "home" },
  chat: { label: "AI Chat", kind: "chat" },
  saved: { label: "Đã lưu", kind: "saved" },
  profile: { label: "Cá nhân", kind: "profile" },
} as const;

function TabIcon({
  kind,
  color,
}: {
  kind: (typeof TAB_CONFIG)[keyof typeof TAB_CONFIG]["kind"];
  color: string;
}) {
  if (kind === "chat") {
    return <MaterialCommunityIcons color={color} name="star-four-points-outline" size={20} />;
  }

  const iconByKind = {
    home: "home",
    saved: "heart",
    profile: "user",
  } as const;

  return <Feather color={color} name={iconByKind[kind]} size={20} />;
}

export function AppTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View
      style={{
        backgroundColor: theme.colors.tabBackground,
        borderTopColor: theme.colors.border,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        borderTopWidth: 1,
        bottom: 0,
        left: 0,
        paddingBottom: Math.max(insets.bottom, 10),
        paddingHorizontal: 12,
        paddingTop: 10,
        position: "absolute",
        right: 0,
      }}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {state.routes.map((route, index) => {
          const config = TAB_CONFIG[route.name as keyof typeof TAB_CONFIG];

          if (!config) {
            return null;
          }

          const isFocused = route.name === activeRouteName || (activeRouteName === "results" && route.name === "home");
          const descriptor = descriptors[route.key];

          const onPress = () => {
            const event = navigation.emit({
              canPreventDefault: true,
              target: route.key,
              type: "tabPress",
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              target: route.key,
              type: "tabLongPress",
            });
          };

          return (
            <Pressable
              accessibilityHint={descriptor.options.tabBarAccessibilityLabel}
              accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              key={route.key}
              onLongPress={onLongPress}
              onPress={onPress}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: isFocused ? theme.colors.accent : "transparent",
                borderRadius: 18,
                borderCurve: "continuous",
                flex: 1,
                gap: 6,
                justifyContent: "center",
                minHeight: 70,
                opacity: pressed ? 0.82 : 1,
                paddingHorizontal: 4,
                paddingVertical: 8,
              })}
            >
              <TabIcon color={isFocused ? "#FFFFFF" : theme.colors.muted} kind={config.kind} />
              <Text
                numberOfLines={1}
                style={{
                  color: isFocused ? "#FFFFFF" : theme.colors.muted,
                  fontSize: 10.5,
                  fontWeight: isFocused ? "700" : "500",
                  lineHeight: 13,
                  textAlign: "center",
                }}
              >
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
