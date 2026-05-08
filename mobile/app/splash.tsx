import { useEffect } from "react";
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

const splashLogo = require("../assets/branding/splash-logo.png");

export default function SplashRoute() {
  const router = useRouter();
  const logoScale = useSharedValue(0.98);

  useEffect(() => {
    logoScale.value = withRepeat(
      withTiming(1.04, { duration: 1350, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );

    const timeout = setTimeout(() => {
      router.replace("/home");
    }, 1700);

    return () => clearTimeout(timeout);
  }, [logoScale, router]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

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
