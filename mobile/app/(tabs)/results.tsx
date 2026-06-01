import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandHeader } from "@/components/brand-header";
import { SafeImage } from "@/components/safe-image";
import { theme } from "@/constants/theme";
import {
  fetchFiltersMeta,
  fetchPlaces,
  stayfinderApiBaseUrl,
  type FiltersMeta,
  type PlacesQuery,
  type PlaceSummary,
} from "@/lib/stayfinder";
import {
  derivePlaceTags,
  formatLocation,
  formatRating,
  formatReviewCount,
  getImageSource,
} from "@/lib/stayfinder-ui";

const resultFallbackImages = [
  require("../../assets/results/ocean-villa.jpg"),
  require("../../assets/results/sunrise-boutique.jpg"),
  require("../../assets/results/coral-studio.jpg"),
] as const;
const RESULT_PAGE_SIZE = 50;

type SortOption = "rating_desc" | "reviews_desc" | "distance_asc" | "title_asc";
type ResultsFiltersState = {
  queryText: string;
  selectedType: string | null;
  selectedDistrict: string | null;
  selectedAmenity: string | null;
  selectedLandmark: string | null;
  sort: SortOption;
};

function areFiltersEqual(left: ResultsFiltersState, right: ResultsFiltersState) {
  return (
    left.queryText === right.queryText &&
    left.selectedType === right.selectedType &&
    left.selectedDistrict === right.selectedDistrict &&
    left.selectedAmenity === right.selectedAmenity &&
    left.selectedLandmark === right.selectedLandmark &&
    left.sort === right.sort
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function buildStateFromParams(
  params: Partial<Record<"q" | "type" | "district" | "amenity" | "landmark" | "sort", string | string[]>>,
): ResultsFiltersState {
  const sortParam = firstParam(params.sort) as SortOption;
  const allowedSorts: SortOption[] = ["rating_desc", "reviews_desc", "distance_asc", "title_asc"];

  return {
    queryText: firstParam(params.q),
    selectedType: firstParam(params.type) || null,
    selectedDistrict: firstParam(params.district) || null,
    selectedAmenity: firstParam(params.amenity) || null,
    selectedLandmark: firstParam(params.landmark) || null,
    sort: allowedSorts.includes(sortParam) ? sortParam : "rating_desc",
  };
}

function Header() {
  return <BrandHeader bellSize={18} logoHeight={34} logoWidth={146} />;
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: selected ? "#EDF3FF" : "#E9EFFB",
        borderColor: selected ? theme.colors.accent : "transparent",
        borderRadius: 10,
        borderCurve: "continuous",
        borderWidth: 1,
        flexDirection: "row",
        gap: 6,
        opacity: pressed ? 0.85 : 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
      })}
    >
      {selected ? <Feather color={theme.colors.accent} name="check" size={14} /> : null}
      <Text
        selectable
        style={{
          color: selected ? theme.colors.accent : theme.colors.muted,
          fontSize: 12,
          fontWeight: selected ? "600" : "500",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AmenityRow({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: checked ? theme.colors.accent : theme.colors.surface,
          borderColor: checked ? theme.colors.accent : theme.colors.chipBorder,
          borderRadius: 5,
          borderWidth: 1,
          height: 18,
          justifyContent: "center",
          width: 18,
        }}
      >
        {checked ? <Feather color="#FFFFFF" name="check" size={12} /> : null}
      </View>
      <Text selectable style={{ color: checked ? theme.colors.ink : theme.colors.muted, fontSize: 15, fontWeight: "500" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ResultCard({
  item,
  fallbackImage,
}: {
  item: PlaceSummary;
  fallbackImage: typeof resultFallbackImages[number];
}) {
  const chips = derivePlaceTags(item).slice(0, 2);

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/place/[place-id]",
          params: { "place-id": item.place_id },
        })
      }
      style={({ pressed }) => ({
        borderRadius: 18,
        opacity: pressed ? 0.94 : 1,
        paddingBottom: 4,
      })}
    >
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.chipBorder,
          borderRadius: 18,
          borderCurve: "continuous",
          borderWidth: 1,
          boxShadow: "0 12px 24px rgba(25, 38, 74, 0.08)",
          overflow: "hidden",
        }}
      >
        <View>
          <SafeImage
            fallbackSource={fallbackImage}
            source={getImageSource(item.cover_image, fallbackImage)}
            style={{ height: 138, width: "100%" }}
          />

          <View
            style={{
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.92)",
              borderColor: "#EDF0F8",
              borderRadius: 999,
              borderCurve: "continuous",
              borderWidth: 1,
              flexDirection: "row",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 5,
              position: "absolute",
              right: 8,
              top: 8,
            }}
          >
            <Feather color={theme.colors.sun} name="star" size={11} />
            <Text selectable style={{ color: theme.colors.ink, fontSize: 11, fontWeight: "600" }}>
              {formatRating(item.rating)}
            </Text>
          </View>

          <Pressable
            style={{
              alignItems: "center",
              backgroundColor: "rgba(255,255,255,0.92)",
              borderRadius: 999,
              bottom: 8,
              height: 30,
              justifyContent: "center",
              position: "absolute",
              right: 8,
              width: 30,
            }}
          >
            <Feather color={theme.colors.muted} name="heart" size={15} />
          </Pressable>
        </View>

        <View style={{ gap: 8, paddingHorizontal: 12, paddingBottom: 12, paddingTop: 12 }}>
          <Text
            numberOfLines={2}
            selectable
            style={{
              color: theme.colors.ink,
              fontSize: 15,
              fontWeight: "700",
              lineHeight: 21,
              minHeight: 42,
            }}
          >
            {item.title}
          </Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <Feather color={theme.colors.muted} name="map-pin" size={12} />
            <Text selectable numberOfLines={1} style={{ color: theme.colors.muted, fontSize: 12, fontWeight: "500" }}>
              {formatLocation(item)}
            </Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5, minHeight: 29 }}>
            {chips.map((chip) => (
              <View
                key={chip}
                style={{
                  backgroundColor: "#E8F0FF",
                  borderRadius: 6,
                  paddingHorizontal: 7,
                  paddingVertical: 4,
                }}
              >
                <Text numberOfLines={1} style={{ color: theme.colors.ink, fontSize: 9.5, fontWeight: "600" }}>
                  {chip}
                </Text>
              </View>
            ))}
          </View>

          <View
            style={{
              alignItems: "flex-end",
              borderTopColor: "rgba(140, 147, 168, 0.18)",
              borderTopWidth: 1,
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 4,
              paddingTop: 10,
            }}
          >
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text numberOfLines={1} selectable style={{ color: "#8C93A8", fontSize: 11, fontWeight: "500" }}>
                {formatReviewCount(item.reviews_count)}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/place/[place-id]",
                  params: { "place-id": item.place_id },
                })
              }
              style={({ pressed }) => ({
                backgroundColor: theme.colors.accent,
                borderRadius: 8,
                borderCurve: "continuous",
                opacity: pressed ? 0.85 : 1,
                paddingHorizontal: 10,
                paddingVertical: 7,
              })}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>Chi tiết</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const sortOptions: Array<{ label: string; value: SortOption }> = [
  { label: "Rating cao", value: "rating_desc" },
  { label: "Nhiều review", value: "reviews_desc" },
  { label: "Gần nhất", value: "distance_asc" },
  { label: "Tên A-Z", value: "title_asc" },
];

function buildPlacesQuery(filters: ResultsFiltersState, page: number): PlacesQuery {
  return {
    q: filters.queryText.trim() || undefined,
    typeSlugs: filters.selectedType ? [filters.selectedType] : undefined,
    districts: filters.selectedDistrict ? [filters.selectedDistrict] : undefined,
    amenityLabels: filters.selectedAmenity ? [filters.selectedAmenity] : undefined,
    landmarkSlugs: filters.selectedLandmark ? [filters.selectedLandmark] : undefined,
    sort: filters.sort,
    limit: RESULT_PAGE_SIZE,
    page,
  };
}

export default function ResultsRoute() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    q?: string | string[];
    type?: string | string[];
    district?: string | string[];
    amenity?: string | string[];
    landmark?: string | string[];
    sort?: string | string[];
  }>();

  const qParam = firstParam(params.q);
  const typeParam = firstParam(params.type);
  const districtParam = firstParam(params.district);
  const amenityParam = firstParam(params.amenity);
  const landmarkParam = firstParam(params.landmark);
  const sortParam = firstParam(params.sort);

  const paramState = useMemo(
    () =>
      buildStateFromParams({
        q: qParam,
        type: typeParam,
        district: districtParam,
        amenity: amenityParam,
        landmark: landmarkParam,
        sort: sortParam,
      }),
    [amenityParam, districtParam, landmarkParam, qParam, sortParam, typeParam],
  );

  const [filters, setFilters] = useState<ResultsFiltersState>(paramState);
  const [requestFilters, setRequestFilters] = useState<ResultsFiltersState>(paramState);
  const [meta, setMeta] = useState<FiltersMeta | null>(null);
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMetaLoading, setIsMetaLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasMorePlaces = places.length < total;
  const placeRows = useMemo(() => {
    const rows: PlaceSummary[][] = [];

    for (let index = 0; index < places.length; index += 2) {
      rows.push(places.slice(index, index + 2));
    }

    return rows;
  }, [places]);

  useEffect(() => {
    setFilters((current) => (areFiltersEqual(current, paramState) ? current : paramState));
    setRequestFilters((current) => (areFiltersEqual(current, paramState) ? current : paramState));
  }, [paramState]);

  useEffect(() => {
    let isActive = true;

    async function loadMeta() {
      setIsMetaLoading(true);

      try {
        const payload = await fetchFiltersMeta();
        if (isActive) {
          setMeta(payload);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : "Không tải được meta filter.");
        }
      } finally {
        if (isActive) {
          setIsMetaLoading(false);
        }
      }
    }

    loadMeta().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadPlaces() {
      setIsLoading(true);
      setErrorMessage(null);
      setPlaces([]);
      setTotal(0);
      setCurrentPage(1);

      try {
        const payload = await fetchPlaces(buildPlacesQuery(requestFilters, 1));

        if (!isActive) {
          return;
        }

        setPlaces(payload.items);
        setTotal(payload.total);
        setCurrentPage(payload.page);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setErrorMessage(error instanceof Error ? error.message : "Không tải được kết quả tìm kiếm.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadPlaces().catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [requestFilters]);

  async function loadMorePlaces() {
    if (isLoading || isLoadingMore || !hasMorePlaces) {
      return;
    }

    setIsLoadingMore(true);
    setErrorMessage(null);

    try {
      const payload = await fetchPlaces(buildPlacesQuery(requestFilters, currentPage + 1));
      setPlaces((currentPlaces) => {
        const seen = new Set(currentPlaces.map((place) => place.id));
        const nextItems = payload.items.filter((place) => !seen.has(place.id));
        return [...currentPlaces, ...nextItems];
      });
      setTotal(payload.total);
      setCurrentPage(payload.page);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không tải thêm được kết quả.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  function applyFilters() {
    setRequestFilters({ ...filters });
  }

  function resetFilters() {
    const emptyState: ResultsFiltersState = {
      queryText: "",
      selectedType: null,
      selectedDistrict: null,
      selectedAmenity: null,
      selectedLandmark: null,
      sort: "rating_desc",
    };

    setFilters(emptyState);
    setRequestFilters(emptyState);
  }

  return (
    <View style={{ backgroundColor: theme.colors.page, flex: 1 }}>
      <StatusBar style="dark" />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          gap: 16,
          paddingBottom: Math.max(insets.bottom + 108, 122),
          paddingHorizontal: 16,
          paddingTop: Math.max(insets.top + 8, 16),
        }}
        showsVerticalScrollIndicator={false}
      >
        <Header />

        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.chipBorder,
            borderRadius: 18,
            borderWidth: 1,
            gap: 20,
            padding: 16,
            boxShadow: "0 10px 24px rgba(25, 38, 74, 0.06)",
          }}
        >
          <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <Feather color={theme.colors.accent} name="sliders" size={17} />
              <Text selectable style={{ color: theme.colors.ink, fontSize: 16, fontWeight: "600" }}>
                Tìm kiếm & bộ lọc
              </Text>
            </View>
            <Pressable onPress={resetFilters}>
              <Text selectable style={{ color: theme.colors.accent, fontSize: 12, fontWeight: "500" }}>
                Xóa bộ lọc
              </Text>
            </Pressable>
          </View>

          <View style={{ backgroundColor: theme.colors.chipBorder, height: 1 }} />

          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "600" }}>
              Từ khóa
            </Text>
            <View
              style={{
                alignItems: "center",
                backgroundColor: "#F7F9FF",
                borderColor: theme.colors.chipBorder,
                borderRadius: 14,
                borderWidth: 1,
                flexDirection: "row",
                paddingHorizontal: 14,
              }}
            >
              <Feather color={theme.colors.muted} name="search" size={16} />
              <TextInput
                onChangeText={(queryText) => setFilters((current) => ({ ...current, queryText }))}
                onSubmitEditing={applyFilters}
                placeholder="Tìm theo tên, khu vực, địa chỉ..."
                placeholderTextColor="#A1A8BD"
                returnKeyType="search"
                selectionColor={theme.colors.accent}
                style={{
                  color: theme.colors.ink,
                  flex: 1,
                  fontSize: 14,
                  minHeight: 48,
                  paddingHorizontal: 10,
                }}
                value={filters.queryText}
              />
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "600" }}>
              Landmark
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(meta?.landmarks || []).slice(0, 6).map((landmark) => (
                <FilterChip
                  key={landmark.slug}
                  label={landmark.name}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      selectedLandmark:
                        current.selectedLandmark === landmark.slug ? null : landmark.slug,
                    }))
                  }
                  selected={filters.selectedLandmark === landmark.slug}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "600" }}>
              Khu vực
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(meta?.districts || []).slice(0, 6).map((district) => (
                <FilterChip
                  key={district.value}
                  label={district.value}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      selectedDistrict:
                        current.selectedDistrict === district.value ? null : district.value,
                    }))
                  }
                  selected={filters.selectedDistrict === district.value}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "600" }}>
              Loại hình
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(meta?.types || []).slice(0, 6).map((type) => (
                <FilterChip
                  key={type.value}
                  label={type.label}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      selectedType: current.selectedType === type.value ? null : type.value,
                    }))
                  }
                  selected={filters.selectedType === type.value}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "600" }}>
              Tiện ích
            </Text>
            <View style={{ gap: 10 }}>
              {(meta?.amenities || []).slice(0, 5).map((amenity) => (
                <AmenityRow
                  checked={filters.selectedAmenity === amenity.label}
                  key={amenity.slug}
                  label={amenity.label}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      selectedAmenity:
                        current.selectedAmenity === amenity.label ? null : amenity.label,
                    }))
                  }
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 15, fontWeight: "600" }}>
              Sắp xếp
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {sortOptions.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.label}
                  onPress={() =>
                    setFilters((current) => ({
                      ...current,
                      sort: option.value,
                    }))
                  }
                  selected={filters.sort === option.value}
                />
              ))}
            </View>
          </View>

          <Pressable
            onPress={applyFilters}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: theme.colors.accent,
              borderRadius: 12,
              justifyContent: "center",
              minHeight: 54,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "600" }}>Xem kết quả</Text>
          </Pressable>
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 20, fontWeight: "700" }}>
              {isLoading ? "Đang tìm..." : `Tìm thấy ${total} địa điểm`}
            </Text>
            {!isLoading && total > 0 ? (
              <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "500" }}>
                Đang hiển thị {places.length}/{total} địa điểm
              </Text>
            ) : null}
            {requestFilters.queryText ? (
              <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "500" }}>
                Kết quả cho: “{requestFilters.queryText}”
              </Text>
            ) : null}
          </View>
          <MaterialCommunityIcons color={theme.colors.ink} name="swap-vertical" size={18} />
        </View>

        {isMetaLoading ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.surface,
              borderRadius: 18,
              gap: 10,
              padding: 18,
            }}
          >
            <ActivityIndicator color={theme.colors.accent} />
            <Text selectable style={{ color: theme.colors.muted, fontSize: 14 }}>
              Đang nạp metadata cho bộ lọc...
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View
            style={{
              backgroundColor: "#FFF4F4",
              borderColor: "#F0CECE",
              borderRadius: 18,
              borderWidth: 1,
              gap: 10,
              padding: 18,
            }}
          >
            <Text selectable style={{ color: theme.colors.coral, fontSize: 15, fontWeight: "700" }}>
              Không tải được kết quả
            </Text>
            <Text selectable style={{ color: theme.colors.ink, fontSize: 14, lineHeight: 22 }}>
              {errorMessage}
            </Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 12, lineHeight: 18 }}>
              API: {stayfinderApiBaseUrl}
            </Text>
            <Pressable
              onPress={applyFilters}
              style={({ pressed }) => ({
                alignSelf: "flex-start",
                backgroundColor: theme.colors.coral,
                borderRadius: 12,
                opacity: pressed ? 0.8 : 1,
                paddingHorizontal: 14,
                paddingVertical: 10,
              })}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "600" }}>Tải lại</Text>
            </Pressable>
          </View>
        ) : null}

        {isLoading ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.surface,
              borderRadius: 18,
              gap: 12,
              padding: 22,
            }}
          >
            <ActivityIndicator color={theme.colors.accent} />
            <Text selectable style={{ color: theme.colors.muted, fontSize: 14, fontWeight: "500" }}>
              Đang lấy danh sách chỗ ở từ backend...
            </Text>
          </View>
        ) : places.length ? (
          <View style={{ gap: 14 }}>
            {placeRows.map((row, rowIndex) => (
              <View
                key={`row-${rowIndex}`}
                style={{
                  flexDirection: "row",
                  gap: 14,
                  justifyContent: "space-between",
                }}
              >
                {row.map((item, itemIndex) => (
                  <View key={item.id} style={{ width: "48.2%" }}>
                    <ResultCard
                      fallbackImage={
                        resultFallbackImages[(rowIndex * 2 + itemIndex) % resultFallbackImages.length]
                      }
                      item={item}
                    />
                  </View>
                ))}
                {row.length === 1 ? <View style={{ width: "48.2%" }} /> : null}
              </View>
            ))}
            {hasMorePlaces ? (
              <Pressable
                onPress={loadMorePlaces}
                style={({ pressed }) => ({
                  alignItems: "center",
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.accent,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  flexDirection: "row",
                  gap: 10,
                  justifyContent: "center",
                  minHeight: 54,
                  opacity: pressed || isLoadingMore ? 0.76 : 1,
                })}
              >
                {isLoadingMore ? <ActivityIndicator color={theme.colors.accent} /> : null}
                <Text selectable style={{ color: theme.colors.accent, fontSize: 15, fontWeight: "700" }}>
                  {isLoadingMore ? "Đang tải thêm..." : `Tải thêm (${places.length}/${total})`}
                </Text>
              </Pressable>
            ) : (
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: theme.colors.surfaceMuted,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                }}
              >
                <Text selectable style={{ color: theme.colors.muted, fontSize: 13, fontWeight: "600" }}>
                  Đã hiển thị đủ {total} địa điểm
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View
            style={{
              alignItems: "center",
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.chipBorder,
              borderRadius: 18,
              borderWidth: 1,
              gap: 10,
              padding: 22,
            }}
          >
            <Feather color={theme.colors.muted} name="search" size={20} />
            <Text selectable style={{ color: theme.colors.ink, fontSize: 16, fontWeight: "600" }}>
              Không có kết quả phù hợp
            </Text>
            <Text selectable style={{ color: theme.colors.muted, fontSize: 14, lineHeight: 22, textAlign: "center" }}>
              Thử bỏ bớt landmark, đổi loại hình, hoặc xóa tiện ích bắt buộc để nới phạm vi tìm.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
