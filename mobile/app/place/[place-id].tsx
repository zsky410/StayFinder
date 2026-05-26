import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Linking,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SafeImage, SafeImageBackground } from "@/components/safe-image";
import { DetailLocationMap } from "@/components/detail-location-map";
import { theme } from "@/constants/theme";
import {
  fetchPlaceDetail,
  fetchReviewSummary,
  type AiReviewSummary,
  type PlaceDetail,
} from "@/lib/stayfinder";
import {
  derivePlaceTags,
  filterUsableImageUrls,
  formatDistanceMeters,
  formatLocation,
  formatPriceText,
  formatRating,
  getImageSource,
  getNearestLandmark,
  pickAmenityLabels,
} from "@/lib/stayfinder-ui";

const detailHeroImage = require("../../assets/results/detail-hero.jpg");

function getPlaceId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function AmenityIcon({
  label,
  size = 20,
}: {
  label: string;
  size?: number;
}) {
  const normalized = normalizeText(label);

  if (normalized.includes("wifi")) {
    return <Feather color={theme.colors.accent} name="wifi" size={size} />;
  }
  if (normalized.includes("do xe") || normalized.includes("bai do xe")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="parking" size={size + 2} />;
  }
  if (normalized.includes("dieu hoa")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="snowflake" size={size} />;
  }
  if (normalized.includes("ho boi") || normalized.includes("be boi")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="pool" size={size} />;
  }
  if (normalized.includes("bep")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="stove" size={size} />;
  }
  if (normalized.includes("an sang") || normalized.includes("nha hang") || normalized.includes("ca phe")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="silverware-fork-knife" size={size} />;
  }
  if (normalized.includes("giat")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="washing-machine" size={size} />;
  }

  return <Feather color={theme.colors.accent} name="check-circle" size={size - 1} />;
}

function DetailTagIcon({ tag }: { tag: string }) {
  const normalized = normalizeText(tag);

  if (normalized.includes("gia dinh")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="account-group-outline" size={16} />;
  }
  if (normalized.includes("bep")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="stove" size={16} />;
  }
  if (normalized.includes("bien")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="waves" size={16} />;
  }
  if (normalized.includes("ho boi")) {
    return <MaterialCommunityIcons color={theme.colors.accent} name="pool" size={16} />;
  }
  if (normalized.includes("wifi")) {
    return <Feather color={theme.colors.accent} name="wifi" size={16} />;
  }
  if (normalized.includes("trung tam")) {
    return <Feather color={theme.colors.accent} name="map-pin" size={16} />;
  }

  return <Feather color={theme.colors.accent} name="tag" size={16} />;
}

async function tryOpenUrl(url: string | null | undefined) {
  const cleaned = String(url || "").trim();
  if (!cleaned) {
    return;
  }

  const supported = await Linking.canOpenURL(cleaned);
  if (supported) {
    await Linking.openURL(cleaned);
  }
}

function SkeletonBlock({
  height,
  radius = 16,
  style,
  width = "100%",
}: {
  height: number;
  radius?: number;
  style?: ViewStyle;
  width?: DimensionValue;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: "#E8EDF7",
          borderRadius: radius,
          height,
          width,
        },
        style,
      ]}
    />
  );
}

function PlaceDetailSkeleton({
  bottomInset,
  topInset,
}: {
  bottomInset: number;
  topInset: number;
}) {
  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: 120,
        }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ backgroundColor: "#DCE5F2", height: 348 }}>
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 18,
              paddingTop: Math.max(topInset + 10, 24),
            }}
          >
            <SkeletonBlock height={42} radius={999} width={42} />
            <SkeletonBlock height={42} radius={999} width={42} />
          </View>

          <View style={{ alignItems: "flex-end", marginTop: "auto", paddingBottom: 14, paddingHorizontal: 16 }}>
            <SkeletonBlock height={40} radius={18} width={116} />
          </View>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            marginTop: -26,
            paddingHorizontal: 16,
            paddingTop: 18,
          }}
        >
          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
            <View style={{ flex: 1, gap: 10, paddingTop: 4 }}>
              <SkeletonBlock height={26} radius={12} width="88%" />
              <SkeletonBlock height={26} radius={12} width="62%" />
            </View>
            <SkeletonBlock height={66} radius={16} width={104} />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <SkeletonBlock height={18} radius={9} width={120} />
            <SkeletonBlock height={18} radius={9} width={112} />
          </View>

          <View style={{ gap: 8, marginTop: 16 }}>
            <SkeletonBlock height={18} radius={9} width="56%" />
            <SkeletonBlock height={22} radius={11} width="82%" />
          </View>

          <SkeletonBlock height={24} radius={12} style={{ marginTop: 18 }} width={110} />

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={index} height={36} radius={12} width={index % 2 === 0 ? 92 : 118} />
            ))}
          </View>

          <SkeletonBlock height={156} radius={16} style={{ marginTop: 22 }} />

          <View style={{ gap: 18, marginTop: 34 }}>
            <SkeletonBlock height={24} radius={12} width={96} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {Array.from({ length: 9 }).map((_, index) => (
                <View
                  key={index}
                  style={{
                    alignItems: "flex-start",
                    flexDirection: "row",
                    gap: 6,
                    marginBottom: 14,
                    minHeight: 34,
                    width: "31.5%",
                  }}
                >
                  <SkeletonBlock height={18} radius={9} width={18} />
                  <SkeletonBlock height={16} radius={8} style={{ marginTop: 1 }} width="72%" />
                </View>
              ))}
            </View>
          </View>

          <View style={{ gap: 16, marginTop: 34 }}>
            <SkeletonBlock height={24} radius={12} width={52} />
            <SkeletonBlock height={220} radius={18} />
            <SkeletonBlock height={18} radius={9} width="78%" />
            <SkeletonBlock height={286} radius={18} />
          </View>

          <View style={{ gap: 16, marginTop: 34 }}>
            <SkeletonBlock height={24} radius={12} width={68} />
            {Array.from({ length: 2 }).map((_, index) => (
              <SkeletonBlock key={index} height={132} radius={18} />
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.98)",
          borderTopColor: theme.colors.chipBorder,
          borderTopWidth: 1,
          bottom: 0,
          flexDirection: "row",
          gap: 12,
          left: 0,
          paddingBottom: Math.max(bottomInset, 12),
          paddingHorizontal: 16,
          paddingTop: 12,
          position: "absolute",
          right: 0,
        }}
      >
        <SkeletonBlock height={52} radius={14} width={68} />
        <SkeletonBlock height={52} radius={14} width={68} />
        <SkeletonBlock height={52} radius={18} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export default function PlaceDetailRoute() {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{ "place-id"?: string | string[] }>();
  const placeId = getPlaceId(params["place-id"]);
  const galleryScrollRef = useRef<ScrollView>(null);

  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
  const [galleryModalIndex, setGalleryModalIndex] = useState<number | null>(null);
  const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiReviewSummary | null>(null);
  const [isAiSummaryLoading, setIsAiSummaryLoading] = useState(false);
  const [aiSummaryError, setAiSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadPlace() {
      if (!placeId) {
        setErrorMessage("Thiếu place id để tải chi tiết.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      setAiSummary(null);
      setAiSummaryError(null);

      try {
        const payload = await fetchPlaceDetail(placeId);
        if (isActive) {
          setPlace(payload);
          setAiSummary(payload.ai_review_summary);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : "Không tải được place detail.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadPlace().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [placeId]);

  const generateAiSummary = useCallback(
    async () => {
      const targetPlaceId = place?.place_id || placeId;
      if (!targetPlaceId || isAiSummaryLoading) {
        return;
      }

      setIsAiSummaryLoading(true);
      setAiSummaryError(null);

      try {
        const summary = await fetchReviewSummary(targetPlaceId, {
          refresh: false,
          useLlm: true,
        });
        setAiSummary({
          summary_text: summary.summary_text,
          bullets: summary.bullets || [],
          model: summary.model,
          prompt_version: summary.prompt_version,
          source_review_count: summary.source_review_count,
          metadata: summary.metadata || {},
          updated_at: summary.updated_at,
          source: summary.source,
        });
      } catch (error) {
        setAiSummaryError(
          error instanceof Error ? error.message : "Không sinh được AI tóm tắt.",
        );
      } finally {
        setIsAiSummaryLoading(false);
      }
    },
    [place?.place_id, placeId, isAiSummaryLoading],
  );

  useEffect(() => {
    if (!place) {
      return;
    }
    if (aiSummary || isAiSummaryLoading || aiSummaryError) {
      return;
    }
    generateAiSummary().catch(() => undefined);
  }, [place, aiSummary, isAiSummaryLoading, aiSummaryError, generateAiSummary]);

  const nearestLandmark = useMemo(() => getNearestLandmark(place?.landmark_metrics), [place]);
  const tags = useMemo(() => (place ? derivePlaceTags(place) : []), [place]);
  const amenityLabels = useMemo(() => (place ? pickAmenityLabels(place) : []), [place]);
  const reviewImageSet = useMemo(() => {
    const urls = (place?.reviews_sample || []).flatMap((review) => filterUsableImageUrls(review.images || []));

    return new Set(urls);
  }, [place]);
  const galleryImages = useMemo(() => {
    const coverImageUrl = String(place?.cover_image || "").trim();
    const uniqueUrls = filterUsableImageUrls([place?.cover_image, ...(place?.gallery || [])]);

    return uniqueUrls.filter((url) => url === coverImageUrl || !reviewImageSet.has(url));
  }, [place, reviewImageSet]);
  const selectedGalleryIndex =
    galleryModalIndex === null
      ? 0
      : Math.min(Math.max(galleryModalIndex, 0), Math.max(galleryImages.length - 1, 0));
  const isGalleryModalVisible = galleryModalIndex !== null && galleryImages.length > 0;
  const galleryModalImageHeight = Math.max(
    260,
    viewportHeight - Math.max(insets.top, 24) - Math.max(insets.bottom, 16) - 158,
  );
  const heroSource = useMemo(() => {
    const heroImageUrl = galleryImages[0] || place?.cover_image || null;
    return getImageSource(heroImageUrl, detailHeroImage);
  }, [galleryImages, place]);
  const reviewsToRender = useMemo(() => {
    if (!place) {
      return [];
    }
    return isReviewsExpanded ? place.reviews_sample : place.reviews_sample.slice(0, 2);
  }, [isReviewsExpanded, place]);
  const openGalleryModal = useCallback((index: number) => {
    setGalleryModalIndex(index);
  }, []);
  const closeGalleryModal = useCallback(() => {
    setGalleryModalIndex(null);
  }, []);
  const handleGalleryMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(viewportWidth, 1));
      setGalleryModalIndex(Math.min(Math.max(nextIndex, 0), Math.max(galleryImages.length - 1, 0)));
    },
    [galleryImages.length, viewportWidth],
  );

  useEffect(() => {
    if (!isGalleryModalVisible) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      galleryScrollRef.current?.scrollTo({
        animated: false,
        x: selectedGalleryIndex * viewportWidth,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [isGalleryModalVisible, selectedGalleryIndex, viewportWidth]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <PlaceDetailSkeleton bottomInset={insets.bottom} topInset={insets.top} />
      </>
    );
  }

  if (!place || errorMessage) {
    return (
      <View style={{ alignItems: "center", backgroundColor: theme.colors.page, flex: 1, justifyContent: "center", padding: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="dark" />
        <Text selectable style={{ color: theme.colors.coral, fontSize: 18, fontWeight: "700", textAlign: "center" }}>
          Không tải được chi tiết địa điểm
        </Text>
        <Text selectable style={{ color: theme.colors.ink, fontSize: 14, lineHeight: 22, marginTop: 10, textAlign: "center" }}>
          {errorMessage || "Dữ liệu chi tiết đang trống."}
        </Text>
        <Pressable
          onPress={() => router.replace("/results")}
          style={({ pressed }) => ({
            backgroundColor: theme.colors.accent,
            borderRadius: 14,
            marginTop: 18,
            opacity: pressed ? 0.85 : 1,
            paddingHorizontal: 18,
            paddingVertical: 12,
          })}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>Về trang kết quả</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="dark" />

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingBottom: Math.max(insets.bottom + 112, 128),
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ position: "relative" }}>
          <SafeImageBackground
            fallbackSource={detailHeroImage}
            source={heroSource}
            style={{ height: 348, justifyContent: "space-between" }}
          >
            <View
              style={{
                backgroundColor: "rgba(12, 18, 36, 0.18)",
                bottom: 0,
                left: 0,
                position: "absolute",
                right: 0,
                top: 0,
              }}
            />
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: 18,
                paddingTop: Math.max(insets.top + 10, 24),
              }}
            >
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/results"))}
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.94)",
                  borderRadius: 999,
                  height: 42,
                  justifyContent: "center",
                  width: 42,
                }}
              >
                <Feather color={theme.colors.ink} name="arrow-left" size={22} />
              </Pressable>

              <Pressable
                onPress={() => tryOpenUrl(place.website)}
                style={{
                  alignItems: "center",
                  backgroundColor: "rgba(255,255,255,0.94)",
                  borderRadius: 999,
                  height: 42,
                  justifyContent: "center",
                  opacity: place.website ? 1 : 0.6,
                  width: 42,
                }}
              >
                <Feather color={theme.colors.ink} name="share-2" size={19} />
              </Pressable>
            </View>
          </SafeImageBackground>
        </View>

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            marginTop: -26,
            paddingHorizontal: 16,
            paddingTop: 18,
          }}
        >
          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12, justifyContent: "space-between" }}>
            <Text
              selectable
              style={{
                color: theme.colors.ink,
                flex: 1,
                fontSize: 21,
                fontWeight: "700",
                lineHeight: 31,
                paddingTop: 4,
              }}
            >
              {place.title}
            </Text>

            <View style={{ alignItems: "center", flexDirection: "row", flexShrink: 0, gap: 6, paddingTop: 8 }}>
              <Feather color={theme.colors.sun} name="star" size={16} />
              <Text selectable style={{ color: theme.colors.sun, fontSize: 16, fontWeight: "700" }}>
                {formatRating(place.rating)}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: "center", flexDirection: "row", gap: 10, marginTop: 10 }}>
            <Feather color={theme.colors.ink} name="map-pin" size={16} />
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "500" }}>
              {nearestLandmark ? formatDistanceMeters(nearestLandmark.distance_m) : "Chưa có metric"}
            </Text>
            <Text selectable style={{ color: "#8A92A9", fontSize: 16 }}>•</Text>
            <Text selectable style={{ color: theme.colors.accent, fontSize: 15, fontWeight: "600" }}>
              {nearestLandmark?.landmark_name || formatLocation(place)}
            </Text>
          </View>

          <View style={{ gap: 4, marginTop: 14 }}>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 14, lineHeight: 22 }}>
              {formatLocation(place)}
            </Text>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, lineHeight: 22 }}>
              {place.address || "Địa chỉ đang được cập nhật từ dataset."}
            </Text>
          </View>

          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 6, marginTop: 18 }}>
            <Text selectable style={{ color: theme.colors.sun, fontSize: 19, fontWeight: "700" }}>
              {formatPriceText(place.price_text)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 20 }}>
            {tags.map((tag) => (
              <View
                key={tag}
                style={{
                  alignItems: "center",
                  backgroundColor: "#F6F8FF",
                  borderColor: theme.colors.chipBorder,
                  borderRadius: 12,
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 7,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                }}
              >
                <DetailTagIcon tag={tag} />
                <Text selectable style={{ color: theme.colors.ink, fontSize: 14, fontWeight: "500" }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={{
              backgroundColor: "#EDF3FF",
              borderColor: "#D9E5FF",
              borderRadius: 16,
              borderWidth: 1,
              marginTop: 18,
              padding: 16,
              position: "relative",
            }}
          >
            <View
              style={{
                backgroundColor: theme.colors.accent,
                borderRadius: 999,
                flexDirection: "row",
                gap: 6,
                left: 16,
                paddingHorizontal: 12,
                paddingVertical: 6,
                position: "absolute",
                top: -12,
              }}
            >
              <MaterialCommunityIcons color="#FFFFFF" name="star-four-points-outline" size={15} />
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "600" }}>AI Tóm tắt đánh giá</Text>
            </View>

            <View style={{ gap: 14, marginTop: 30 }}>
              <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
                <Feather
                  color={aiSummaryError ? theme.colors.coral : theme.colors.accent}
                  name={aiSummaryError ? "alert-circle" : "check-circle"}
                  size={22}
                  style={{ marginTop: 1 }}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text selectable style={{ color: theme.colors.ink, fontSize: 16, fontWeight: "600" }}>
                    Tóm tắt AI từ review
                  </Text>
                  {isAiSummaryLoading && !aiSummary ? (
                    <Text style={{ color: theme.colors.muted, fontSize: 14, lineHeight: 22 }}>
                      Đang tóm tắt review bằng AI... có thể mất vài giây.
                    </Text>
                  ) : aiSummaryError ? (
                    <Text style={{ color: theme.colors.coral, fontSize: 14, lineHeight: 22 }}>
                      {aiSummaryError}
                    </Text>
                  ) : (
                    <Text selectable style={{ color: theme.colors.ink, fontSize: 15, lineHeight: 23 }}>
                      {aiSummary?.summary_text || "Chưa có AI summary cho địa điểm này."}
                    </Text>
                  )}
                </View>
              </View>

              {aiSummary?.bullets?.length ? (
                <>
                  <View style={{ backgroundColor: "#D7DFF5", height: 1 }} />
                  <View style={{ gap: 10 }}>
                    {aiSummary.bullets.slice(0, 5).map((bullet) => (
                      <View key={bullet} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                        <MaterialCommunityIcons color={theme.colors.accent} name="star-four-points-outline" size={16} />
                        <Text selectable style={{ color: theme.colors.ink, flex: 1, fontSize: 14, lineHeight: 22 }}>
                          {bullet}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              ) : null}

              <View
                style={{
                  alignItems: "center",
                  borderTopColor: "#D7DFF5",
                  borderTopWidth: aiSummary?.bullets?.length ? 0 : 1,
                  flexDirection: "row",
                  gap: 10,
                  paddingTop: aiSummary?.bullets?.length ? 4 : 12,
                }}
              >
                <Text style={{ color: theme.colors.muted, flex: 1, fontSize: 12, lineHeight: 18 }}>
                  {aiSummary
                    ? "Dựa trên nội dung review thực tế từ dataset."
                    : "AI sẽ tự tạo tóm tắt khi địa điểm chưa có cache."}
                </Text>
              </View>
            </View>
          </View>

          {amenityLabels.length ? (
            <View style={{ gap: 18, marginTop: 34 }}>
              <View style={{ alignItems: "baseline", flexDirection: "row", gap: 10 }}>
                <Text selectable style={{ color: theme.colors.ink, fontSize: 20, fontWeight: "700" }}>
                  Tiện nghi
                </Text>
                <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "500" }}>
                  {amenityLabels.length} mục
                </Text>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                }}
              >
                {amenityLabels.map((label) => (
                  <View
                    key={label}
                    style={{
                      alignItems: "flex-start",
                      flexDirection: "row",
                      gap: 6,
                      marginBottom: 14,
                      minHeight: 34,
                      width: "31.5%",
                    }}
                  >
                    <View
                      style={{
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: 18,
                        width: 18,
                      }}
                    >
                      <AmenityIcon label={label} size={17} />
                    </View>
                    <Text
                      selectable
                      numberOfLines={3}
                      style={{
                        color: theme.colors.ink,
                        flex: 1,
                        fontSize: 12.5,
                        fontWeight: "500",
                        lineHeight: 18,
                      }}
                    >
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 16, marginTop: 34 }}>
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
              <Text selectable style={{ color: theme.colors.ink, fontSize: 20, fontWeight: "700" }}>
                Ảnh
              </Text>
              {galleryImages.length > 4 ? (
                <Pressable onPress={() => setIsGalleryExpanded((current) => !current)}>
                  <Text selectable style={{ color: theme.colors.accent, fontSize: 13, fontWeight: "600" }}>
                    {isGalleryExpanded ? "Thu gọn" : `Xem tất cả ${galleryImages.length} ảnh`}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 12, paddingRight: 4 }}>
                {galleryImages.length ? (
                  (isGalleryExpanded ? galleryImages : galleryImages.slice(0, 6)).map((imageUrl, index) => (
                    <Pressable
                      accessibilityLabel={`Mở ảnh ${index + 1}`}
                      key={`${index}-${imageUrl}`}
                      onPress={() => openGalleryModal(index)}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.9 : 1,
                      })}
                    >
                      <SafeImage
                        fallbackSource={detailHeroImage}
                        source={getImageSource(imageUrl, detailHeroImage)}
                        style={{
                          backgroundColor: "#E9EEF8",
                          borderRadius: 18,
                          height: 128,
                          width: 188,
                        }}
                      />
                    </Pressable>
                  ))
                ) : (
                  <View
                    style={{
                      alignItems: "center",
                      backgroundColor: "#F8FAFF",
                      borderColor: theme.colors.chipBorder,
                      borderRadius: 18,
                      borderWidth: 1,
                      flexDirection: "row",
                      gap: 14,
                      padding: 12,
                    }}
                  >
                    <SafeImage
                      fallbackSource={detailHeroImage}
                      source={detailHeroImage}
                      style={{
                        borderRadius: 16,
                        height: 112,
                        width: 160,
                      }}
                    />
                    <View style={{ flex: 1, gap: 6, maxWidth: 150 }}>
                      <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "700" }}>
                        Chưa có ảnh nguồn
                      </Text>
                      <Text selectable style={{ color: theme.colors.muted, fontSize: 13, lineHeight: 20 }}>
                        Place này hiện không có `image_url` và cũng chưa có item nào trong `place_images`.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>

          {place.reviews_sample.length ? (
            <View style={{ gap: 16, marginTop: 34 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <Text selectable style={{ color: theme.colors.ink, fontSize: 20, fontWeight: "700" }}>
                  Review
                </Text>
                {place.reviews_sample.length > 2 ? (
                  <Pressable onPress={() => setIsReviewsExpanded((current) => !current)}>
                    <Text selectable style={{ color: theme.colors.accent, fontSize: 13, fontWeight: "600" }}>
                      {isReviewsExpanded ? "Thu gọn" : `Xem thêm ${place.reviews_sample.length} review`}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={{ gap: 12 }}>
                {reviewsToRender.map((review, index) => {
                  const reviewText = review.review_text || review.text_translated || "";

                  return (
                    <View
                      key={`${index}-${reviewText.slice(0, 24)}`}
                      style={{
                        backgroundColor: "#F8FAFF",
                        borderColor: theme.colors.chipBorder,
                        borderRadius: 16,
                        borderWidth: 1,
                        gap: 10,
                        padding: 14,
                      }}
                    >
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                        <Feather color={theme.colors.sun} name="star" size={14} />
                        <Text selectable style={{ color: theme.colors.ink, fontSize: 13, fontWeight: "600" }}>
                          {review.stars || "-"} / 5
                        </Text>
                        {typeof review.likes_count === "number" && review.likes_count > 0 ? (
                          <>
                            <Text selectable style={{ color: "#A1A8BD", fontSize: 12 }}>•</Text>
                            <Text selectable style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "500" }}>
                              {review.likes_count} lượt hữu ích
                            </Text>
                          </>
                        ) : null}
                      </View>

                      {reviewText ? (
                        <Text selectable style={{ color: theme.colors.ink, fontSize: 14, lineHeight: 22 }}>
                          {reviewText}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={{ gap: 16, marginTop: 34 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 20, fontWeight: "700" }}>
              Vị trí
            </Text>
            <DetailLocationMap latitude={place.lat} longitude={place.lng} title={place.title} />
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, lineHeight: 23 }}>
              {place.address || formatLocation(place)}
            </Text>

            {place.landmark_metrics.length ? (
              <View
                style={{
                  borderColor: theme.colors.chipBorder,
                  borderRadius: 18,
                  borderWidth: 1,
                  overflow: "hidden",
                }}
              >
                {place.landmark_metrics.slice(0, 5).map((metric, index) => (
                  <View
                    key={metric.landmark_slug}
                    style={{
                      alignItems: "center",
                      backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F8FAFF",
                      flexDirection: "row",
                      justifyContent: "space-between",
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <Text selectable style={{ color: theme.colors.ink, flex: 1, fontSize: 14, fontWeight: "500" }}>
                      {metric.landmark_name}
                    </Text>
                    <Text selectable style={{ color: theme.colors.accent, fontSize: 14, fontWeight: "700" }}>
                      {formatDistanceMeters(metric.distance_m)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View
                style={{
                  alignItems: "center",
                  borderColor: theme.colors.chipBorder,
                  borderRadius: 18,
                  borderWidth: 1,
                  justifyContent: "center",
                  minHeight: 72,
                  paddingHorizontal: 16,
                }}
              >
                <Text selectable style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "500" }}>
                  Chưa có mốc địa điểm gần đây cho nơi này.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={closeGalleryModal}
        transparent
        visible={isGalleryModalVisible}
      >
        <View
          style={{
            backgroundColor: "rgba(5, 9, 22, 0.96)",
            flex: 1,
            paddingBottom: Math.max(insets.bottom, 16),
            paddingTop: Math.max(insets.top, 20),
          }}
        >
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>
              {selectedGalleryIndex + 1} / {galleryImages.length}
            </Text>
            <Pressable
              accessibilityLabel="Đóng ảnh"
              hitSlop={10}
              onPress={closeGalleryModal}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.16)",
                borderRadius: 999,
                height: 40,
                justifyContent: "center",
                opacity: pressed ? 0.8 : 1,
                width: 40,
              })}
            >
              <Feather color="#FFFFFF" name="x" size={22} />
            </Pressable>
          </View>

          <ScrollView
            ref={galleryScrollRef}
            horizontal
            onMomentumScrollEnd={handleGalleryMomentumEnd}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, height: galleryModalImageHeight }}
          >
            {galleryImages.map((imageUrl, index) => (
              <View
                key={`modal-${index}-${imageUrl}`}
                style={{
                  alignItems: "center",
                  height: galleryModalImageHeight,
                  justifyContent: "center",
                  width: viewportWidth,
                }}
              >
                <SafeImage
                  fallbackSource={detailHeroImage}
                  resizeMode="contain"
                  source={getImageSource(imageUrl, detailHeroImage)}
                  style={{
                    height: galleryModalImageHeight,
                    width: viewportWidth,
                  }}
                />
              </View>
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{
              gap: 10,
              paddingHorizontal: 16,
              paddingTop: 14,
            }}
          >
            {galleryImages.map((imageUrl, index) => {
              const isSelected = index === selectedGalleryIndex;

              return (
                <Pressable
                  accessibilityLabel={`Chọn ảnh ${index + 1}`}
                  key={`thumb-${index}-${imageUrl}`}
                  onPress={() => setGalleryModalIndex(index)}
                  style={({ pressed }) => ({
                    borderColor: isSelected ? "#FFFFFF" : "rgba(255,255,255,0.22)",
                    borderRadius: 12,
                    borderWidth: isSelected ? 2 : 1,
                    opacity: pressed ? 0.78 : 1,
                    padding: 2,
                  })}
                >
                  <SafeImage
                    fallbackSource={detailHeroImage}
                    source={getImageSource(imageUrl, detailHeroImage)}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.12)",
                      borderRadius: 9,
                      height: 58,
                      width: 76,
                    }}
                  />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <View
        style={{
          backgroundColor: "rgba(255,255,255,0.98)",
          borderTopColor: theme.colors.chipBorder,
          borderTopWidth: 1,
          boxShadow: "0 -8px 24px rgba(36, 84, 234, 0.08)",
          bottom: 0,
          flexDirection: "row",
          gap: 12,
          left: 0,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingHorizontal: 16,
          paddingTop: 12,
          position: "absolute",
          right: 0,
        }}
      >
        <Pressable
          disabled={!place.phone}
          onPress={() => tryOpenUrl(place.phone ? `tel:${place.phone}` : null)}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: "#EDF3FF",
            borderRadius: 14,
            height: 52,
            justifyContent: "center",
            opacity: pressed ? 0.85 : place.phone ? 1 : 0.55,
            width: 68,
          })}
        >
          <Feather color={theme.colors.accent} name="phone" size={20} />
        </Pressable>

        <Pressable
          disabled={!place.lat || !place.lng}
          onPress={() =>
            tryOpenUrl(
              place.lat && place.lng
                ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
                : null,
            )
          }
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: "#EDF3FF",
            borderRadius: 14,
            height: 52,
            justifyContent: "center",
            opacity: pressed ? 0.85 : place.lat && place.lng ? 1 : 0.55,
            width: 68,
          })}
        >
          <MaterialCommunityIcons color={theme.colors.accent} name="navigation-variant-outline" size={21} />
        </Pressable>

        <Pressable
          disabled={!place.website}
          onPress={() => tryOpenUrl(place.website)}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: theme.colors.accent,
            borderRadius: 14,
            flex: 1,
            flexDirection: "row",
            gap: 10,
            justifyContent: "center",
            opacity: pressed ? 0.85 : place.website ? 1 : 0.6,
          })}
        >
          <Feather color="#FFFFFF" name="globe" size={20} />
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
            {place.website ? "Mở website" : "Chưa có website"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
