import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, type ImageProps, type ImageSourcePropType, Text, View } from "react-native";

import { theme } from "@/constants/theme";

type CardPreviewImageProps = Omit<ImageProps, "source"> & {
  source: ImageSourcePropType | null;
};

export function CardPreviewImage({ source, style, ...props }: CardPreviewImageProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [source]);

  if (!source || hasError) {
    return (
      <View
        style={[
          {
            alignItems: "center",
            backgroundColor: "#EEF2FA",
            borderColor: "rgba(140, 147, 168, 0.22)",
            borderWidth: 1,
            justifyContent: "center",
            overflow: "hidden",
          },
          style,
        ]}
      >
        <MaterialCommunityIcons color={theme.colors.muted} name="image-off-outline" size={28} />
        <Text
          selectable
          style={{
            color: theme.colors.muted,
            fontSize: 11,
            fontWeight: "600",
            marginTop: 6,
          }}
        >
          Chưa có ảnh
        </Text>
      </View>
    );
  }

  return <Image {...props} onError={() => setHasError(true)} source={source} style={style} />;
}
