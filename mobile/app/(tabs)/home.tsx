import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandHeader } from "@/components/brand-header";
import { SafeImage } from "@/components/safe-image";
import { theme } from "@/constants/theme";
import { fetchPlaces, stayfinderApiBaseUrl, type PlaceSummary } from "@/lib/stayfinder";
import {
  buildDistanceLabel,
  formatLocation,
  formatPriceText,
  formatRating,
  getImageSource,
} from "@/lib/stayfinder-ui";

const heroImage = require("../../assets/home/hero.jpg");
const featuredFallbackImages = [
  require("../../assets/home/featured-beach.jpg"),
  require("../../assets/home/featured-villa.jpg"),
] as const;
const nearbyFallbackImages = [
  require("../../assets/home/nearby-hotel.jpg"),
  require("../../assets/home/nearby-homestay.jpg"),
  require("../../assets/home/featured-beach.jpg"),
] as const;
const liveSearchFallbackImage = require("../../assets/results/coral-studio.jpg");
const LIVE_SEARCH_MIN_QUERY_LENGTH = 2;
const LIVE_SEARCH_LIMIT = 5;
const LIVE_SEARCH_DEBOUNCE_MS = 140;
const LIVE_SEARCH_CACHE_TTL_MS = 45_000;
const RECENT_SEARCH_LIMIT = 5;

const quickFilters = [
  {
    label: "Khách sạn",
    icon: "bed-king-outline" as const,
    typeSlug: "hotel",
  },
  {
    label: "Homestay",
    icon: "home-city-outline" as const,
    typeSlug: "homestay",
  },
  {
    label: "Nhà nghỉ",
    icon: "bed-outline" as const,
    typeSlug: "nha-nghi",
  },
] as const;

function normalizeVietnameseText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function renderHighlightedText(text: string, query: string) {
  const rawText = String(text || "");
  const rawQuery = String(query || "").trim();

  if (!rawText || !rawQuery) {
    return rawText;
  }

  const normalizedText = normalizeVietnameseText(rawText);
  const normalizedQuery = normalizeVietnameseText(rawQuery);
  const startIndex = normalizedText.indexOf(normalizedQuery);

  if (startIndex < 0) {
    return rawText;
  }

  const endIndex = startIndex + rawQuery.length;

  return (
    <>
      {rawText.slice(0, startIndex)}
      <Text style={{ color: theme.colors.accent, fontWeight: "800" }}>
        {rawText.slice(startIndex, endIndex)}
      </Text>
      {rawText.slice(endIndex)}
    </>
  );
}

function SectionHeader({ title, actionLabel }: { title: string; actionLabel?: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
      <Text selectable style={{ color: theme.colors.ink, fontSize: 18, fontWeight: "700" }}>
        {title}
      </Text>
      {actionLabel ? (
        <Text selectable style={{ color: theme.colors.accent, fontSize: 13, fontWeight: "600" }}>
          {actionLabel}
        </Text>
      ) : null}
    </View>
  );
}

function SearchBar({
  value,
  onChangeText,
  onOpenFilters,
  onSubmit,
  onFocus,
  onBlur,
  onClose,
  showCloseButton,
}: {
  value: string;
  onChangeText: (nextValue: string) => void;
  onOpenFilters: () => void;
  onSubmit: () => void;
  onFocus?: TextInputProps["onFocus"];
  onBlur?: TextInputProps["onBlur"];
  onClose?: () => void;
  showCloseButton?: boolean;
}) {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.chipBorder,
        borderRadius: 20,
        borderWidth: 1,
        boxShadow: "0 10px 24px rgba(20, 27, 52, 0.05)",
        flexDirection: "row",
        overflow: "hidden",
        paddingLeft: 18,
      }}
    >
      <Feather color={theme.colors.muted} name="search" size={22} />

      <TextInput
        onBlur={onBlur}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onSubmitEditing={onSubmit}
        placeholder="Bạn muốn tìm chỗ ở khu nào?"
        placeholderTextColor="#C2C7DA"
        returnKeyType="search"
        selectionColor={theme.colors.accent}
        style={{
          color: theme.colors.ink,
          flex: 1,
          fontSize: 17,
          fontWeight: "500",
          minHeight: 62,
          paddingHorizontal: 14,
        }}
        value={value}
      />

      <Pressable
        onPress={showCloseButton ? onClose : onOpenFilters}
        style={({ pressed }) => ({
          alignItems: "center",
          justifyContent: "center",
          minHeight: 62,
          opacity: pressed ? 0.65 : 1,
          paddingHorizontal: 18,
        })}
      >
        <Feather color={theme.colors.muted} name={showCloseButton ? "x" : "sliders"} size={22} />
      </Pressable>
    </View>
  );
}

function LiveSearchItem({
  place,
  onPress,
  query,
}: {
  place: PlaceSummary;
  onPress: () => void;
  query: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        borderRadius: 16,
        borderCurve: "continuous",
        flexDirection: "row",
        gap: 12,
        opacity: pressed ? 0.88 : 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
      })}
    >
      <SafeImage
        fallbackSource={liveSearchFallbackImage}
        source={getImageSource(place.cover_image, liveSearchFallbackImage)}
        style={{
          borderRadius: 12,
          height: 62,
          width: 62,
        }}
      />

      <View style={{ flex: 1, gap: 5 }}>
        <Text
          selectable
          numberOfLines={2}
          style={{ color: theme.colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 19 }}
        >
          {renderHighlightedText(place.title, query)}
        </Text>
        <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 12.5, fontWeight: "500" }}>
          {renderHighlightedText(formatLocation(place), query)}
        </Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
            <Feather color={theme.colors.sun} name="star" size={12} />
            <Text selectable style={{ color: theme.colors.ink, fontSize: 12, fontWeight: "600" }}>
              {formatRating(place.rating)}
            </Text>
          </View>
          <Text selectable numberOfLines={1} style={{ color: theme.colors.sun, flex: 1, fontSize: 12.5, fontWeight: "700" }}>
            {formatPriceText(place.price_text)}
          </Text>
        </View>
      </View>

      <Feather color={theme.colors.muted} name="arrow-up-right" size={16} />
    </Pressable>
  );
}

function QuickFilterChip({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: theme.colors.chipBackground,
        borderColor: "transparent",
        borderRadius: 14,
        borderWidth: 1.5,
        flex: 1,
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        minHeight: 48,
        opacity: pressed ? 0.8 : 1,
        paddingHorizontal: 12,
      })}
    >
      <MaterialCommunityIcons color={theme.colors.ink} name={icon} size={18} />
      <Text
        selectable
        style={{
          color: theme.colors.ink,
          fontSize: 15,
          fontWeight: "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FeaturedCard({
  width,
  place,
  fallbackImage,
}: {
  width: number;
  place: PlaceSummary;
  fallbackImage: ImageSourcePropType;
}) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/place/[place-id]",
          params: { "place-id": place.place_id },
        })
      }
      style={({ pressed }) => ({
        borderRadius: 22,
        borderCurve: "continuous",
        marginRight: 14,
        opacity: pressed ? 0.92 : 1,
        paddingBottom: 8,
        width,
      })}
    >
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 22,
          borderCurve: "continuous",
          boxShadow: "0 12px 28px rgba(20, 27, 52, 0.10)",
        }}
      >
        <View style={{ borderRadius: 22, borderCurve: "continuous", overflow: "hidden" }}>
          <View>
            <SafeImage
              fallbackSource={fallbackImage}
              source={getImageSource(place.cover_image, fallbackImage)}
              style={{ height: 186, width: "100%" }}
            />
            <View
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: 14,
                borderCurve: "continuous",
                flexDirection: "row",
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 8,
                position: "absolute",
                right: 12,
                top: 12,
              }}
            >
              <Feather color={theme.colors.sun} name="star" size={14} />
              <Text selectable style={{ color: theme.colors.ink, fontSize: 14, fontWeight: "600" }}>
                {formatRating(place.rating)}
              </Text>
            </View>
          </View>

          <View style={{ gap: 7, minHeight: 122, paddingHorizontal: 12, paddingBottom: 14, paddingTop: 12 }}>
            <Text
              selectable
              numberOfLines={2}
              style={{
                color: theme.colors.ink,
                fontSize: 17,
                fontWeight: "700",
                lineHeight: 24,
                minHeight: 48,
              }}
            >
              {place.title}
            </Text>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <Feather color={theme.colors.muted} name="map-pin" size={15} />
              <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "500" }}>
                {formatLocation(place)}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 4 }}>
              <Text selectable numberOfLines={1} style={{ color: theme.colors.sun, fontSize: 18, fontWeight: "700" }}>
                {formatPriceText(place.price_text)}
              </Text>
              <Text selectable style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "500" }}>
                tham khảo
              </Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function NearbyCard({
  place,
  fallbackImage,
}: {
  place: PlaceSummary;
  fallbackImage: ImageSourcePropType;
}) {
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/place/[place-id]",
          params: { "place-id": place.place_id },
        })
      }
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: 20,
        borderCurve: "continuous",
        flexDirection: "row",
        gap: 14,
        opacity: pressed ? 0.94 : 1,
        overflow: "hidden",
        padding: 10,
        boxShadow: "0 12px 28px rgba(20, 27, 52, 0.08)",
      })}
    >
      <SafeImage
        fallbackSource={fallbackImage}
        source={getImageSource(place.cover_image, fallbackImage)}
        style={{
          borderRadius: 14,
          height: 104,
          width: 104,
        }}
      />

      <View style={{ flex: 1, gap: 8, justifyContent: "center" }}>
        <View style={{ alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }}>
          <Text
            selectable
            numberOfLines={2}
            style={{ color: theme.colors.ink, flex: 1, fontSize: 18, fontWeight: "700", lineHeight: 23 }}
          >
            {place.title}
          </Text>
          <View
            style={{
              alignItems: "center",
              backgroundColor: "#FFF5EB",
              borderRadius: 10,
              borderCurve: "continuous",
              flexDirection: "row",
              gap: 5,
              marginLeft: 12,
              paddingHorizontal: 8,
              paddingVertical: 5,
            }}
          >
            <Feather color={theme.colors.sun} name="star" size={12} />
            <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "600" }}>
              {formatRating(place.rating)}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
          <Feather color={theme.colors.muted} name="map" size={14} />
          <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "500" }}>
            {buildDistanceLabel(place)}
          </Text>
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
          <Feather color={theme.colors.muted} name="map-pin" size={14} />
          <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, flex: 1, fontSize: 13, fontWeight: "500" }}>
            {formatLocation(place)}
          </Text>
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
          <Feather color={theme.colors.sun} name="tag" size={14} />
          <Text selectable numberOfLines={1} style={{ color: theme.colors.sun, flex: 1, fontSize: 14, fontWeight: "700" }}>
            {formatPriceText(place.price_text)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function SectionLoadingCard() {
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        borderRadius: 22,
        borderCurve: "continuous",
        gap: 12,
        justifyContent: "center",
        minHeight: 144,
        padding: 20,
      }}
    >
      <ActivityIndicator color={theme.colors.accent} />
      <Text selectable style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "500" }}>
        Đang tải dữ liệu thật từ StayFinder...
      </Text>
    </View>
  );
}

export default function HomeTabRoute() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const featuredCardWidth = Math.min(width * 0.62, 250);
  const liveSearchCacheRef = useRef<
    Map<string, { items: PlaceSummary[]; cachedAt: number }>
  >(new Map());

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const [isSearchPanelOpen, setIsSearchPanelOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [featuredPlaces, setFeaturedPlaces] = useState<PlaceSummary[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const trimmedSearchQuery = searchQuery.trim();
  const shouldShowLiveSearch = trimmedSearchQuery.length >= LIVE_SEARCH_MIN_QUERY_LENGTH;
  const hasLiveSearchResults = searchResults.length > 0;
  const showLiveSearchPanel =
    isSearchPanelOpen &&
    ((shouldShowLiveSearch &&
      (isSearching || hasLiveSearchResults || searchErrorMessage !== null)) ||
      (!shouldShowLiveSearch && recentSearches.length > 0));

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, LIVE_SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  useEffect(() => {
    let isActive = true;

    async function loadHomeData() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [featuredResponse, nearbyResponse] = await Promise.all([
          fetchPlaces({ limit: 6, sort: "price_available_desc" }),
          fetchPlaces({
            landmarkSlugs: ["dragon-bridge"],
            limit: 3,
            sort: "price_available_desc",
          }),
        ]);

        if (!isActive) {
          return;
        }

        setFeaturedPlaces(featuredResponse.items);
        setNearbyPlaces(nearbyResponse.items);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Không tải được dữ liệu từ backend.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadHomeData().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    if (debouncedSearchQuery.length < LIVE_SEARCH_MIN_QUERY_LENGTH) {
      setSearchResults([]);
      setSearchErrorMessage(null);
      setIsSearching(false);
      return () => {
        isActive = false;
      };
    }

    async function loadLiveSearchResults() {
      const cachedEntry = liveSearchCacheRef.current.get(debouncedSearchQuery);
      if (cachedEntry && Date.now() - cachedEntry.cachedAt < LIVE_SEARCH_CACHE_TTL_MS) {
        setSearchResults(cachedEntry.items);
        setSearchErrorMessage(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setSearchErrorMessage(null);

      try {
        const payload = await fetchPlaces({
          q: debouncedSearchQuery,
          limit: LIVE_SEARCH_LIMIT,
          sort: "rating_desc",
        });

        if (!isActive) {
          return;
        }

        setSearchResults(payload.items);
        liveSearchCacheRef.current.set(debouncedSearchQuery, {
          items: payload.items,
          cachedAt: Date.now(),
        });
      } catch (error) {
        if (!isActive) {
          return;
        }

        setSearchErrorMessage(
          error instanceof Error ? error.message : "Không tải được gợi ý realtime.",
        );
      } finally {
        if (isActive) {
          setIsSearching(false);
        }
      }
    }

    loadLiveSearchResults().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [debouncedSearchQuery]);

  useEffect(() => {
    if (!isSearchPanelOpen) {
      return;
    }

    const currentQuery = searchQuery.trim();
    if (currentQuery.length < LIVE_SEARCH_MIN_QUERY_LENGTH) {
      return;
    }

    const cachedEntry = liveSearchCacheRef.current.get(currentQuery);
    if (cachedEntry && Date.now() - cachedEntry.cachedAt < LIVE_SEARCH_CACHE_TTL_MS) {
      setSearchResults(cachedEntry.items);
      setSearchErrorMessage(null);
      setIsSearching(false);
      return;
    }

    if (debouncedSearchQuery !== currentQuery) {
      setDebouncedSearchQuery(currentQuery);
    }
  }, [debouncedSearchQuery, isSearchPanelOpen, searchQuery]);

  function openResults(params: Record<string, string>) {
    router.push({
      pathname: "/results",
      params,
    });
  }

  function submitSearch() {
    const q = trimmedSearchQuery;
    if (q) {
      setRecentSearches((current) => {
        const next = [q, ...current.filter((item) => item !== q)];
        return next.slice(0, RECENT_SEARCH_LIMIT);
      });
      setIsSearchPanelOpen(false);
    }
    openResults(q ? { q } : {});
  }

  function openPlace(placeId: string) {
    setIsSearchPanelOpen(false);
    router.push({
      pathname: "/place/[place-id]",
      params: { "place-id": placeId },
    });
  }

  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <StatusBar style="dark" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: 20,
          paddingBottom: 140,
          paddingHorizontal: 20,
          paddingTop: Math.max(insets.top + 8, 18),
        }}
        showsVerticalScrollIndicator={false}
      >
        <BrandHeader
          bellSize={24}
          logoHeight={46}
          logoWidth={192}
          onPressBell={() => router.push("/chat")}
          showNotificationDot
        />

        <View style={{ zIndex: 20 }}>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "600", letterSpacing: 0.7 }}>
            TÌM KIẾM
          </Text>
          <View style={{ gap: 10, position: "relative" }}>
            <SearchBar
              onBlur={undefined}
              onChangeText={(nextValue) => {
                setSearchQuery(nextValue);
                setIsSearchPanelOpen(true);
              }}
              onFocus={() => setIsSearchPanelOpen(true)}
              onClose={() => setIsSearchPanelOpen(false)}
              onOpenFilters={submitSearch}
              onSubmit={submitSearch}
              showCloseButton={showLiveSearchPanel}
              value={searchQuery}
            />

            {showLiveSearchPanel ? (
              <View
                style={{
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.chipBorder,
                  borderRadius: 20,
                  borderWidth: 1,
                  boxShadow: "0 18px 34px rgba(20, 27, 52, 0.10)",
                  left: 0,
                  overflow: "hidden",
                  position: "absolute",
                  right: 0,
                  top: 72,
                  zIndex: 10,
                }}
              >
                {!shouldShowLiveSearch && recentSearches.length > 0 ? (
                  <View style={{ paddingBottom: 10, paddingTop: 10 }}>
                    <View
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingBottom: 8,
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text selectable style={{ color: theme.colors.muted, fontSize: 11.5, fontWeight: "600" }}>
                        Tìm gần đây
                      </Text>
                      <Pressable onPress={() => setRecentSearches([])}>
                        <Text selectable style={{ color: theme.colors.accent, fontSize: 12.5, fontWeight: "700" }}>
                          Xóa
                        </Text>
                      </Pressable>
                    </View>
                    {recentSearches.map((item, index) => (
                      <Pressable
                        key={item}
                        onPress={() => {
                            setSearchQuery(item);
                            setDebouncedSearchQuery(item);
                            setIsSearchPanelOpen(true);
                        }}
                        style={({ pressed }) => ({
                          borderTopColor: index === 0 ? "transparent" : "rgba(140, 147, 168, 0.14)",
                          borderTopWidth: 1,
                          opacity: pressed ? 0.82 : 1,
                          paddingHorizontal: 14,
                          paddingVertical: 13,
                        })}
                      >
                        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                          <Feather color={theme.colors.muted} name="clock" size={14} />
                          <Text selectable style={{ color: theme.colors.ink, flex: 1, fontSize: 13.5, fontWeight: "600" }}>
                            {item}
                          </Text>
                          <Feather color={theme.colors.muted} name="arrow-up-left" size={14} />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : searchErrorMessage && !hasLiveSearchResults ? (
                  <View style={{ gap: 8, padding: 16 }}>
                    <Text selectable style={{ color: theme.colors.coral, fontSize: 13.5, fontWeight: "700" }}>
                      {searchErrorMessage}
                    </Text>
                    <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 18 }}>
                      API: {stayfinderApiBaseUrl}
                    </Text>
                  </View>
                ) : hasLiveSearchResults ? (
                  <View style={{ paddingBottom: 6, paddingTop: 6 }}>
                    <View
                      style={{
                        alignItems: "center",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingBottom: 6,
                        paddingHorizontal: 14,
                      }}
                    >
                      <Text selectable style={{ color: theme.colors.muted, fontSize: 11.5, fontWeight: "600" }}>
                        {isSearching ? "Đang cập nhật..." : `${searchResults.length} gợi ý`}
                      </Text>
                      <Pressable
                        onPress={() => {
                          setIsSearchPanelOpen(false);
                          submitSearch();
                        }}
                      >
                        <Text selectable style={{ color: theme.colors.accent, fontSize: 12.5, fontWeight: "700" }}>
                          Xem tất cả
                        </Text>
                      </Pressable>
                    </View>
                    {searchResults.map((place, index) => (
                      <View
                        key={place.id}
                        style={{
                          borderTopColor: index === 0 ? "transparent" : "rgba(140, 147, 168, 0.14)",
                          borderTopWidth: 1,
                        }}
                      >
                        <LiveSearchItem onPress={() => openPlace(place.place_id)} place={place} query={trimmedSearchQuery} />
                      </View>
                    ))}
                    {isSearching ? (
                      <View
                        style={{
                          alignItems: "center",
                          flexDirection: "row",
                          gap: 8,
                          justifyContent: "center",
                          paddingHorizontal: 14,
                          paddingTop: 8,
                        }}
                      >
                        <ActivityIndicator color={theme.colors.accent} size="small" />
                        <Text selectable style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "500" }}>
                          Làm mới gợi ý...
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View style={{ gap: 8, padding: 16 }}>
                    <Text selectable style={{ color: theme.colors.muted, fontSize: 13.5, lineHeight: 20 }}>
                      Chưa có địa điểm nào khớp với từ khóa hiện tại.
                    </Text>
                    <Pressable
                      onPress={() => {
                          setIsSearchPanelOpen(false);
                        submitSearch();
                      }}
                    >
                      <Text selectable style={{ color: theme.colors.accent, fontSize: 12.5, fontWeight: "700" }}>
                        Mở trang kết quả đầy đủ
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        </View>

        <Pressable
          onPress={() => openResults({})}
          style={({ pressed }) => ({
            borderRadius: 24,
            borderCurve: "continuous",
            overflow: "hidden",
            opacity: pressed ? 0.95 : 1,
            boxShadow: "0 14px 30px rgba(20, 27, 52, 0.14)",
          })}
        >
          <ImageBackground source={heroImage} style={{ height: 238, justifyContent: "flex-end" }}>
            <View
              style={{
                backgroundColor: "rgba(16, 24, 48, 0.18)",
                bottom: 0,
                left: 0,
                position: "absolute",
                right: 0,
                top: 0,
              }}
            />
            <View style={{ gap: 8, padding: 22 }}>
              <Text
                selectable
                style={{
                  color: "#FFFFFF",
                  fontSize: 22,
                  fontWeight: "700",
                  lineHeight: 32,
                  maxWidth: 240,
                  textShadowColor: "rgba(0, 0, 0, 0.28)",
                  textShadowOffset: { width: 0, height: 2 },
                  textShadowRadius: 4,
                }}
              >
                Tìm chỗ lưu trú{"\n"}tại Đà Nẵng
              </Text>
              <Text selectable style={{ color: "rgba(255,255,255,0.92)", fontSize: 14, lineHeight: 22 }}>
                {featuredPlaces.length
                  ? `Đang có ${featuredPlaces.length}+ gợi ý nổi bật lấy trực tiếp từ dataset thật.`
                  : "Khám phá dữ liệu thật từ backend StayFinder thay cho mock demo."}
              </Text>
            </View>
          </ImageBackground>
        </Pressable>

        <View style={{ gap: 14 }}>
          <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "600", letterSpacing: 0.7 }}>
            BỘ LỌC NHANH
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {quickFilters.map((item) => (
              <QuickFilterChip
                icon={item.icon}
                key={item.label}
                label={item.label}
                onPress={() => openResults({ type: item.typeSlug })}
              />
            ))}
          </View>
        </View>

        {errorMessage ? (
          <View
            style={{
              backgroundColor: "#FFF4F4",
              borderColor: "#F0CECE",
              borderRadius: 20,
              borderWidth: 1,
              gap: 10,
              padding: 18,
            }}
          >
            <Text selectable style={{ color: theme.colors.coral, fontSize: 15, fontWeight: "700" }}>
              Không tải được dữ liệu trang chủ
            </Text>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 14, lineHeight: 22 }}>
              {errorMessage}
            </Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 18 }}>
              API: {stayfinderApiBaseUrl}
            </Text>
            <Pressable
              onPress={() => {
                setIsLoading(true);
                setErrorMessage(null);
                setFeaturedPlaces([]);
                setNearbyPlaces([]);
              }}
              style={({ pressed }) => ({
                alignSelf: "flex-start",
                backgroundColor: theme.colors.coral,
                borderRadius: 12,
                opacity: pressed ? 0.8 : 1,
                paddingHorizontal: 14,
                paddingVertical: 10,
              })}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={{ gap: 14 }}>
          <Pressable onPress={() => openResults({ sort: "rating_desc" })}>
            <SectionHeader actionLabel="XEM TẤT CẢ" title="Nổi bật" />
          </Pressable>
          {isLoading ? (
            <SectionLoadingCard />
          ) : (
            <ScrollView
              contentContainerStyle={{ paddingBottom: 10, paddingLeft: 2, paddingRight: 18, paddingTop: 2 }}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {featuredPlaces.map((place, index) => (
                <FeaturedCard
                  fallbackImage={featuredFallbackImages[index % featuredFallbackImages.length]}
                  key={place.id}
                  place={place}
                  width={featuredCardWidth}
                />
              ))}
            </ScrollView>
          )}
        </View>

        <View style={{ gap: 14 }}>
          <SectionHeader title="Gần Cầu Rồng" />
          {isLoading ? (
            <SectionLoadingCard />
          ) : (
            <View style={{ gap: 16 }}>
              {nearbyPlaces.map((place, index) => (
                <NearbyCard
                  fallbackImage={nearbyFallbackImages[index % nearbyFallbackImages.length]}
                  key={place.id}
                  place={place}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
