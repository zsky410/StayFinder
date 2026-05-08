import { Feather } from "@expo/vector-icons";
import { Image, Pressable, View } from "react-native";

import { theme } from "@/constants/theme";

const brandHeaderLogo = require("../assets/branding/logo-header.png");

type BrandHeaderProps = {
  bellColor?: string;
  bellSize?: number;
  logoHeight?: number;
  logoWidth?: number;
  onPressBell?: () => void;
  showNotificationDot?: boolean;
};

export function BrandHeader({
  bellColor = theme.colors.ink,
  bellSize = 22,
  logoHeight = 38,
  logoWidth = 150,
  onPressBell,
  showNotificationDot = false,
}: BrandHeaderProps) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
      <Image
        resizeMode="contain"
        source={brandHeaderLogo}
        style={{
          height: logoHeight,
          width: logoWidth,
        }}
      />

      <Pressable
        onPress={onPressBell}
        style={({ pressed }) => ({
          alignItems: "center",
          height: Math.max(42, bellSize + 18),
          justifyContent: "center",
          opacity: pressed ? 0.72 : 1,
          width: Math.max(42, bellSize + 18),
        })}
      >
        <Feather color={bellColor} name="bell" size={bellSize} />

        {showNotificationDot ? (
          <View
            style={{
              backgroundColor: theme.colors.coral,
              borderColor: theme.colors.surface,
              borderRadius: 999,
              borderWidth: 2,
              height: 12,
              position: "absolute",
              right: 5,
              top: 5,
              width: 12,
            }}
          />
        ) : null}
      </Pressable>
    </View>
  );
}
