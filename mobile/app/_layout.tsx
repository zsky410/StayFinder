import { ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import "react-native-reanimated";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

import { navigationTheme } from "@/constants/theme";
import { theme } from "@/constants/theme";

export const unstable_settings = {
  initialRouteName: "splash",
};

export default function RootLayout() {
  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: theme.colors.page,
          },
          headerStyle: {
            backgroundColor: theme.colors.page,
          },
          headerShadowVisible: false,
          headerTintColor: theme.colors.ink,
          headerTitleStyle: {
            fontWeight: "600",
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="splash" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="filter-sheet" options={{ presentation: "modal" }} />
        <Stack.Screen name="place/[place-id]" options={{ headerShown: false }} />
        <Stack.Screen name="ai-review/[place-id]" options={{ title: "AI Review Summary" }} />
      </Stack>
    </ThemeProvider>
  );
}
