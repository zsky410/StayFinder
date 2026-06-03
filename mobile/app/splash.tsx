import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter } from "expo-router";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useAuth } from "@/lib/auth";

import AuthRoute from "./auth";

const splashLogo = require("../assets/branding/splash-logo.png");

export default function SplashRoute() {
  const router = useRouter();
  const { isAuthenticated, isInitializing } = useAuth();
  const [isSplashFinished, setIsSplashFinished] = useState(false);
  const [shouldShowAuth, setShouldShowAuth] = useState(false);
  const logoScale = useSharedValue(0.98);

  useEffect(() => {
    logoScale.value = withRepeat(
      withTiming(1.04, { duration: 1350, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [logoScale]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setIsSplashFinished(true);
    }, 1700);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!isSplashFinished || isInitializing) {
      return;
    }

    if (isAuthenticated) {
      router.replace("/(tabs)/home");
      return;
    }

    setShouldShowAuth(true);
  }, [isAuthenticated, isInitializing, isSplashFinished, router]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  if (shouldShowAuth) {
    return <AuthRoute />;
  }

  return (
    <View style={{ backgroundColor: "#FFFFFF", flex: 1 }}>
      <Stack.Screen options={{ gestureEnabled: false, headerShown: false }} />
      <StatusBar style="dark" />

      <View
        style={{
          alignItems: "center",
          flex: 1,
          justifyContent: "center",
        }}
      >
        <Animated.View style={logoAnimatedStyle}>
          <Image
            resizeMode="contain"
            source={splashLogo}
            style={{
              height: 214,
              width: 214,
            }}
          />
        </Animated.View>
      </View>
    </View>
  );
}
