import { Tabs } from "expo-router";

import { AppTabBar } from "@/components/app-tab-bar";
import { theme } from "@/constants/theme";

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="home"
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          backgroundColor: theme.colors.page,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Trang chủ",
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Bản đồ",
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat AI",
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Đã lưu",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Cá nhân",
        }}
      />
    </Tabs>
  );
}
