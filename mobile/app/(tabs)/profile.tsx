import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandHeader } from "@/components/brand-header";
import { theme } from "@/constants/theme";
import { sharedAssets } from "@/data/demo-stays";
import { useAuth } from "@/lib/auth";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

type StatItem = {
  label: string;
  value: string;
};

type MenuItem = {
  icon: FeatherIconName;
  label: string;
  onPress?: () => void;
  subtitle: string;
};

const profileUser = {
  avatar: sharedAssets.avatar,
  handle: "@minhanh.travel",
  joinedAt: "Thành viên từ 05/2026",
  location: "Đà Nẵng",
  name: "Minh Anh",
} as const;

const stats = [
  { label: "Đã lưu", value: "12" },
  { label: "Chat AI", value: "28" },
  { label: "Gợi ý", value: "9" },
] satisfies StatItem[];

const menuItems = [
  {
    icon: "heart",
    label: "Địa điểm đã lưu",
    onPress: () => router.push("/(tabs)/saved"),
    subtitle: "Xem lại các chỗ ở yêu thích",
  },
  {
    icon: "message-circle",
    label: "Chat AI",
    onPress: () => router.push("/(tabs)/chat"),
    subtitle: "Tiếp tục tư vấn tìm nơi ở",
  },
  {
    icon: "sliders",
    label: "Bộ lọc tìm kiếm",
    onPress: () => router.push("/(tabs)/results"),
    subtitle: "Khu vực, loại hình và tiện nghi",
  },
] satisfies MenuItem[];

function StatCard({ item }: { item: StatItem }) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.border,
        borderRadius: 18,
        borderCurve: "continuous",
        borderWidth: 1,
        flex: 1,
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 16,
      }}
    >
      <Text selectable style={{ color: theme.colors.ink, fontSize: 22, fontWeight: "800" }}>
        {item.value}
      </Text>
      <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "600" }}>
        {item.label}
      </Text>
    </View>
  );
}

function MenuRow({ item }: { item: MenuItem }) {
  return (
    <Pressable
      onPress={item.onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        flexDirection: "row",
        gap: 14,
        minHeight: 70,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
      })}
    >
      <View
        style={{
          alignItems: "center",
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: 14,
          borderCurve: "continuous",
          height: 40,
          justifyContent: "center",
          width: 40,
        }}
      >
        <Feather color={theme.colors.accent} name={item.icon} size={19} />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "700" }}>
          {item.label}
        </Text>
        <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 13 }}>
          {item.subtitle}
        </Text>
      </View>

      <Feather color="#B4BCD2" name="chevron-right" size={20} />
    </Pressable>
  );
}

export default function ProfileTabRoute() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isInitializing, signOut, user } = useAuth();
  const displayName = user?.display_name || "Khách StayFinder";
  const displayEmail = user?.email || "Đăng nhập để đồng bộ trải nghiệm";
  const joinedAt = user?.created_at
    ? `Thành viên từ ${new Date(user.created_at).toLocaleDateString("vi-VN", {
        month: "2-digit",
        year: "numeric",
      })}`
    : "Chưa đăng nhập";

  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <StatusBar style="dark" />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: 18,
          paddingBottom: Math.max(insets.bottom + 120, 138),
          paddingHorizontal: 18,
          paddingTop: Math.max(insets.top + 10, 22),
        }}
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader
          bellColor={theme.colors.accent}
          bellSize={26}
          logoHeight={44}
          logoWidth={188}
          onPressBell={() => router.push("/(tabs)/chat")}
          showNotificationDot
        />

        <View
          style={{
            alignItems: "center",
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: 28,
            borderCurve: "continuous",
            borderWidth: 1,
            gap: 16,
            padding: 22,
            boxShadow: "0 14px 34px rgba(20, 27, 52, 0.08)",
          }}
        >
          <Image
            source={profileUser.avatar}
            style={{
              borderColor: theme.colors.surfaceMuted,
              borderRadius: 44,
              borderWidth: 4,
              height: 88,
              width: 88,
            }}
          />

          <View style={{ alignItems: "center", gap: 5 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 26, fontWeight: "800", lineHeight: 31 }}>
              {displayName}
            </Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "600" }}>
              {displayEmail}
            </Text>
          </View>

          <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <Feather color={theme.colors.muted} name="map-pin" size={14} />
              <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>
                {profileUser.location}
              </Text>
            </View>
            <View style={{ backgroundColor: theme.colors.border, height: 14, width: 1 }} />
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13 }}>
              {joinedAt}
            </Text>
          </View>

          {isAuthenticated ? (
            <Pressable
              onPress={() => router.push("/(tabs)/results")}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: theme.colors.accent,
                borderRadius: 16,
                borderCurve: "continuous",
                flexDirection: "row",
                gap: 8,
                justifyContent: "center",
                minHeight: 48,
                opacity: pressed ? 0.82 : 1,
                paddingHorizontal: 18,
                width: "100%",
              })}
            >
              <Feather color="#FFFFFF" name="edit-3" size={17} />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "800" }}>Sửa hồ sơ</Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={isInitializing}
              onPress={() => router.push("/splash")}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: theme.colors.accent,
                borderRadius: 16,
                borderCurve: "continuous",
                flexDirection: "row",
                gap: 8,
                justifyContent: "center",
                minHeight: 48,
                opacity: pressed || isInitializing ? 0.82 : 1,
                paddingHorizontal: 18,
                width: "100%",
              })}
            >
              <Feather color="#FFFFFF" name="log-in" size={17} />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "800" }}>Đăng nhập / Đăng ký</Text>
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {stats.map((item) => (
            <StatCard item={item} key={item.label} />
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <Text selectable style={{ color: theme.colors.ink, fontSize: 18, fontWeight: "700" }}>
            Tài khoản
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: 24,
              borderCurve: "continuous",
              borderWidth: 1,
              overflow: "hidden",
            }}
          >
            {menuItems.map((item, index) => (
              <View key={item.label}>
                <MenuRow item={item} />
                {index < menuItems.length - 1 ? (
                  <View style={{ backgroundColor: theme.colors.border, height: 1, marginLeft: 70 }} />
                ) : null}
              </View>
            ))}
          </View>
        </View>

        {isAuthenticated ? (
          <Pressable
            onPress={() => {
              signOut().catch(() => undefined);
            }}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: "#FFF4F4",
              borderColor: "#F0CECE",
              borderRadius: 18,
              borderWidth: 1,
              flexDirection: "row",
              gap: 10,
              justifyContent: "center",
              minHeight: 52,
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <Feather color={theme.colors.coral} name="log-out" size={17} />
            <Text style={{ color: theme.colors.coral, fontSize: 15, fontWeight: "800" }}>Đăng xuất</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
