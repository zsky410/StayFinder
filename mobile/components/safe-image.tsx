import { useEffect, useState, type ReactNode } from "react";
import {
  Image,
  ImageBackground,
  type ImageBackgroundProps,
  type ImageProps,
  type ImageSourcePropType,
} from "react-native";

type SafeImageProps = Omit<ImageProps, "source"> & {
  source: ImageSourcePropType;
  fallbackSource: ImageSourcePropType;
};

type SafeImageBackgroundProps = Omit<ImageBackgroundProps, "source"> & {
  children?: ReactNode;
  source: ImageSourcePropType;
  fallbackSource: ImageSourcePropType;
};

function useSafeSource(source: ImageSourcePropType, fallbackSource: ImageSourcePropType) {
  const [resolvedSource, setResolvedSource] = useState<ImageSourcePropType>(source);

  useEffect(() => {
    setResolvedSource(source);
  }, [source]);

  function handleError() {
    setResolvedSource(fallbackSource);
  }

  return { resolvedSource, handleError };
}

export function SafeImage({ fallbackSource, source, ...props }: SafeImageProps) {
  const { resolvedSource, handleError } = useSafeSource(source, fallbackSource);

  return <Image {...props} onError={handleError} source={resolvedSource} />;
}

export function SafeImageBackground({
  children,
  fallbackSource,
  source,
  ...props
}: SafeImageBackgroundProps) {
  const { resolvedSource, handleError } = useSafeSource(source, fallbackSource);

  return (
    <ImageBackground {...props} onError={handleError} source={resolvedSource}>
      {children}
    </ImageBackground>
  );
}
