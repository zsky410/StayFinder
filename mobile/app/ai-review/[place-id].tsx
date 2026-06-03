import { useEffect } from "react";

import { router, useLocalSearchParams } from "expo-router";

function getPlaceId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default function AiReviewRoute() {
  const params = useLocalSearchParams<{ "place-id"?: string | string[] }>();
  const placeId = getPlaceId(params["place-id"]);

  useEffect(() => {
    if (!placeId) {
      router.replace("/(tabs)/home");
      return;
    }

    router.replace({
      pathname: "/place/[place-id]",
      params: { "place-id": placeId },
    });
  }, [placeId]);

  return null;
}
