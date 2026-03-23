import { useDeferredValue, useEffect, useState, startTransition } from "react";
import {
  Building2,
  Compass,
  Globe2,
  LayoutPanelTop,
  MapPinned,
  PhoneCall,
  Scale,
  Star,
} from "lucide-react";
import CompareSheet from "./components/CompareSheet";
import FilterSidebar from "./components/FilterSidebar";
import PaginationBar from "./components/PaginationBar";
import PlaceCard from "./components/PlaceCard";
import PlaceDetailDrawer from "./components/PlaceDetailDrawer";
import { formatReviewsCount, normalizePlace } from "./lib/places";

const DATASET_BASE_URL = "/data/batch-082743";
const DATA_URL = `${DATASET_BASE_URL}/index.json`;
const ITEMS_PER_PAGE = 20;

function getDetailUrl(slug) {
  return `${DATASET_BASE_URL}/details/${slug}.json`;
}

function StatCard({ label, value, note, icon: Icon, accent = "text-tide" }) {
  return (
    <div className="rounded-[30px] border border-white/70 bg-white/80 px-5 py-5 shadow-card backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-ink/42">{label}</p>
          <p className="mt-3 font-display text-[2rem] leading-none text-ink">{value}</p>
          <p className="mt-2 text-sm text-ink/62">{note}</p>
        </div>
        <div className={`rounded-full bg-shell p-3 ${accent}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState("all");
  const [minScore, setMinScore] = useState(2.5);
  const [sortBy, setSortBy] = useState("recommended");
  const [hasPriceOnly, setHasPriceOnly] = useState(false);
  const [hasWebsiteOnly, setHasWebsiteOnly] = useState(false);
  const [hasPhoneOnly, setHasPhoneOnly] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailCache, setDetailCache] = useState({});
  const [loadedDetailSlugs, setLoadedDetailSlugs] = useState({});
  const [loadingDetailSlugs, setLoadingDetailSlugs] = useState({});
  const [detailErrors, setDetailErrors] = useState({});

  useEffect(() => {
    let active = true;

    async function loadPlaces() {
      try {
        const response = await fetch(DATA_URL);
        if (!response.ok) {
          throw new Error(`Failed to load dataset index: ${response.status}`);
        }

        const rawPlaces = await response.json();
        if (!active) return;
        setPlaces(rawPlaces.map(normalizePlace));
      } catch (error) {
        console.error("Failed to load places", error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPlaces();

    return () => {
      active = false;
    };
  }, []);

  const normalizedSearch = deferredSearch.trim().toLowerCase();

  useEffect(() => {
    setCurrentPage(1);
  }, [normalizedSearch, typeFilter, minScore, sortBy, hasPriceOnly, hasWebsiteOnly, hasPhoneOnly]);

  async function ensureDetailChunk(slug) {
    if (!slug || loadedDetailSlugs[slug] || loadingDetailSlugs[slug]) {
      return;
    }

    setLoadingDetailSlugs((current) => ({ ...current, [slug]: true }));
    setDetailErrors((current) => {
      if (!current[slug]) return current;
      const next = { ...current };
      delete next[slug];
      return next;
    });

    try {
      const response = await fetch(getDetailUrl(slug));
      if (!response.ok) {
        throw new Error(`Failed to load detail file: ${response.status}`);
      }

      const rawPlaces = await response.json();
      const normalizedPlaces = rawPlaces.map(normalizePlace);

      setDetailCache((current) => {
        const next = { ...current };
        normalizedPlaces.forEach((place) => {
          next[place.placeId] = place;
        });
        return next;
      });
      setLoadedDetailSlugs((current) => ({ ...current, [slug]: true }));
    } catch (error) {
      console.error("Failed to load place details", error);
      setDetailErrors((current) => ({
        ...current,
        [slug]: "Không tải được dữ liệu chi tiết cho nhóm địa điểm này.",
      }));
    } finally {
      setLoadingDetailSlugs((current) => {
        const next = { ...current };
        delete next[slug];
        return next;
      });
    }
  }

  const allTypeCountsMap = places.reduce((accumulator, place) => {
    accumulator[place.typeNormalized] = (accumulator[place.typeNormalized] || 0) + 1;
    return accumulator;
  }, {});

  const typeCounts = Object.entries(allTypeCountsMap)
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count);

  let filteredPlaces = [...places];

  if (normalizedSearch) {
    filteredPlaces = filteredPlaces.filter((place) => {
      const haystack =
        place.searchableText ||
        [
          place.title,
          place.address,
          place.neighborhood,
          place.typeNormalized,
          place.categoryName,
          ...(place.categories || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }

  filteredPlaces = filteredPlaces.filter((place) => {
    if ((place.totalScore ?? 0) < minScore) return false;
    if (typeFilter !== "all" && place.typeNormalized !== typeFilter) return false;
    if (hasPriceOnly && !place.priceValue && !place.displayPrice?.includes("US$")) return false;
    if (hasWebsiteOnly && !place.website) return false;
    if (hasPhoneOnly && !place.phone) return false;
    return true;
  });

  filteredPlaces.sort((left, right) => {
    if (sortBy === "rating") {
      return (right.totalScore ?? 0) - (left.totalScore ?? 0);
    }
    if (sortBy === "reviews") {
      return (right.reviewsCount ?? 0) - (left.reviewsCount ?? 0);
    }
    if (sortBy === "price") {
      if (left.priceValue == null && right.priceValue == null) return 0;
      if (left.priceValue == null) return 1;
      if (right.priceValue == null) return -1;
      return left.priceValue - right.priceValue;
    }
    if (sortBy === "az") {
      return left.title.localeCompare(right.title, "vi");
    }
    return (
      (right.totalScore ?? 0) * 1000 +
      (right.reviewsCount ?? 0) -
      ((left.totalScore ?? 0) * 1000 + (left.reviewsCount ?? 0))
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredPlaces.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const pageStartIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedPlaces = filteredPlaces.slice(pageStartIndex, pageStartIndex + ITEMS_PER_PAGE);
  const pageStart = filteredPlaces.length ? pageStartIndex + 1 : 0;
  const pageEnd = Math.min(pageStartIndex + ITEMS_PER_PAGE, filteredPlaces.length);

  const selectedPlaceSummary = places.find((place) => place.placeId === selectedPlaceId) || null;
  const selectedPlace = (selectedPlaceId && detailCache[selectedPlaceId]) || selectedPlaceSummary || null;
  const selectedPlaceSlug = selectedPlaceSummary?.crawlCategorySlug || null;
  const selectedPlaceLoading =
    Boolean(selectedPlaceId) &&
    Boolean(selectedPlaceSlug) &&
    !detailCache[selectedPlaceId] &&
    Boolean(loadingDetailSlugs[selectedPlaceSlug]);
  const selectedPlaceError =
    selectedPlaceSlug && !detailCache[selectedPlaceId] ? detailErrors[selectedPlaceSlug] : null;

  const comparedPlaces = places.filter((place) => compareIds.includes(place.placeId));
  const totalReviews = places.reduce((sum, place) => sum + (place.reviewsCount || 0), 0);
  const averageScore =
    places.length > 0
      ? (places.reduce((sum, place) => sum + (place.totalScore || 0), 0) / places.length).toFixed(2)
      : "0.00";
  const crawlTypeCount = new Set(
    places
      .map((place) => place.crawlCategorySlug || place.crawlCategoryLabel || null)
      .filter(Boolean)
  ).size;
  const pricedPlaces = places.filter((place) => place.priceValue != null).length;
  const websitePlaces = places.filter((place) => place.website).length;
  const phonePlaces = places.filter((place) => place.phone).length;
  const reviewImagePlaces = places.filter((place) => (place.reviewImageCount || 0) > 0).length;
  const datasetLabel = crawlTypeCount
    ? `Batch 082743 · index nhẹ + ${crawlTypeCount} file detail theo loại hình`
    : "Batch 082743 · Index nhẹ cho web";

  function handleOpenDetails(placeId) {
    const targetPlace = places.find((place) => place.placeId === placeId);
    startTransition(() => setSelectedPlaceId(placeId));
    if (targetPlace?.crawlCategorySlug) {
      void ensureDetailChunk(targetPlace.crawlCategorySlug);
    }
  }

  function handleToggleCompare(placeId) {
    startTransition(() => {
      setCompareIds((current) => {
        if (current.includes(placeId)) {
          return current.filter((id) => id !== placeId);
        }
        if (current.length >= 3) {
          return [...current.slice(1), placeId];
        }
        return [...current, placeId];
      });
    });
  }

  function handleRetrySelectedPlaceDetails() {
    if (selectedPlaceSlug) {
      void ensureDetailChunk(selectedPlaceSlug);
    }
  }

  return (
    <div className="min-h-screen bg-shell text-ink">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(217,123,92,0.16),transparent_30%),radial-gradient(circle_at_85%_18%,rgba(15,91,95,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.75),rgba(247,243,234,0.98))]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.07] [background-size:14px_14px] bg-grain" />

      <header className="relative z-10 border-b border-white/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/80 p-3 text-tide shadow-sm">
              <Compass size={19} />
            </div>
            <div>
              <p className="font-display text-[1.45rem] leading-none">Da Nang Stay Atlas</p>
              <p className="mt-1 text-sm text-ink/62">
                Trang chủ tải index nhẹ, dữ liệu chi tiết chỉ fetch khi cần
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <span className="top-pill">Light Theme MVP</span>
            <span className="top-pill">React + Tailwind v3</span>
            <span className="top-pill">Pagination + On-demand detail</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-6">
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="hero-panel overflow-hidden">
            <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-coral/15 blur-3xl" />
            <div className="absolute bottom-0 left-12 h-32 w-32 rounded-full bg-tide/15 blur-3xl" />

            <div className="relative max-w-3xl">
              <p className="text-xs uppercase tracking-[0.32em] text-tide/80">
                Progressive loading for large datasets
              </p>
              <h1 className="mt-5 max-w-3xl font-display text-[3.2rem] leading-[0.88] tracking-tight text-ink sm:text-[4.2rem]">
                Trang chủ chỉ tải phần cần thiết, còn chi tiết sẽ fetch đúng lúc người dùng mở xem.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-ink/72 sm:text-lg">
                Bản web hiện dùng một lớp index nhẹ để lọc, sort và phân trang nhanh hơn, sau đó
                mới tải file detail theo từng loại hình khi người dùng mở drawer. Cách này hợp với
                hành vi thực tế hơn vì user thường filter trước, thay vì lướt hết toàn bộ danh sách.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <span className="hero-chip">
                  <Building2 size={15} />
                  {places.length || 0} địa điểm
                </span>
                <span className="hero-chip">
                  <MapPinned size={15} />
                  {crawlTypeCount || 0} loại hình crawl
                </span>
                <span className="hero-chip">
                  <LayoutPanelTop size={15} />
                  {reviewImagePlaces || 0} nơi có review ảnh
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Điểm trung bình"
              value={averageScore}
              note={`Tính trên toàn bộ ${places.length || 0} địa điểm trong index`}
              icon={Star}
            />
            <StatCard
              label="Tổng review"
              value={formatReviewsCount(totalReviews)}
              note="Dùng để test sort, trust signal và ranking"
              icon={LayoutPanelTop}
              accent="text-coral"
            />
            <StatCard
              label="Có giá"
              value={pricedPlaces}
              note="Nguồn từ giá trực tiếp hoặc best offer trong dữ liệu tóm tắt"
              icon={Globe2}
              accent="text-amber"
            />
            <StatCard
              label="Có liên hệ"
              value={`${websitePlaces}/${phonePlaces}`}
              note="Website / số điện thoại để test CTA trên card và detail"
              icon={PhoneCall}
              accent="text-tide"
            />
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="xl:sticky xl:top-6 xl:self-start">
            <FilterSidebar
              search={search}
              onSearchChange={setSearch}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              typeCounts={typeCounts}
              minScore={minScore}
              onMinScoreChange={setMinScore}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              hasPriceOnly={hasPriceOnly}
              onHasPriceOnlyChange={setHasPriceOnly}
              hasWebsiteOnly={hasWebsiteOnly}
              onHasWebsiteOnlyChange={setHasWebsiteOnly}
              hasPhoneOnly={hasPhoneOnly}
              onHasPhoneOnlyChange={setHasPhoneOnly}
              totalPlaces={places.length}
              filteredPlaces={filteredPlaces.length}
              pagePlaces={paginatedPlaces.length}
              currentPage={currentPage}
              totalPages={totalPages}
              datasetLabel={datasetLabel}
            />
          </div>

          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ink/45">Result view</p>
                <h2 className="mt-2 font-display text-[2.35rem] leading-none">
                  {loading ? "Đang tải dữ liệu..." : `${filteredPlaces.length} địa điểm phù hợp`}
                </h2>
                {!loading ? (
                  <p className="mt-2 text-sm text-ink/60">
                    Trang {currentPage}/{totalPages} · đang hiển thị {pageStart}-{pageEnd}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {typeCounts.slice(0, 4).map((type) => (
                  <span key={type.name} className="top-pill">
                    {type.name} · {type.count}
                  </span>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="panel-card overflow-hidden">
                    <div className="aspect-[1.25/1] animate-pulse bg-mist" />
                    <div className="space-y-3 px-5 py-5">
                      <div className="h-4 w-24 animate-pulse rounded-full bg-mist" />
                      <div className="h-8 w-3/4 animate-pulse rounded-full bg-mist" />
                      <div className="h-20 animate-pulse rounded-[24px] bg-mist" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredPlaces.length ? (
              <>
                <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                  {paginatedPlaces.map((place, index) => (
                    <PlaceCard
                      key={place.placeId}
                      place={place}
                      index={index}
                      isCompared={compareIds.includes(place.placeId)}
                      onOpen={handleOpenDetails}
                      onToggleCompare={handleToggleCompare}
                    />
                  ))}
                </div>

                <PaginationBar
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => startTransition(() => setCurrentPage(page))}
                />
              </>
            ) : (
              <div className="panel-card flex min-h-[340px] flex-col items-center justify-center px-6 py-10 text-center">
                <div className="rounded-full bg-shell p-4 text-coral">
                  <Compass size={26} />
                </div>
                <p className="mt-5 font-display text-3xl text-ink">Không có kết quả phù hợp</p>
                <p className="mt-3 max-w-md text-sm leading-7 text-ink/65">
                  Hãy nới filter hoặc bỏ bớt điều kiện. Phần này rất hợp để test UX empty state
                  cho app Android sau này.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      <PlaceDetailDrawer
        place={selectedPlace}
        onClose={() => setSelectedPlaceId(null)}
        onToggleCompare={handleToggleCompare}
        isCompared={selectedPlace ? compareIds.includes(selectedPlace.placeId) : false}
        loadingDetails={selectedPlaceLoading}
        detailError={selectedPlaceError}
        onRetryDetails={handleRetrySelectedPlaceDetails}
      />

      <CompareSheet
        places={comparedPlaces}
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        onRemove={(placeId) =>
          setCompareIds((current) => current.filter((id) => id !== placeId))
        }
      />

      {compareIds.length ? (
        <button
          type="button"
          onClick={() => setCompareOpen(true)}
          className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-3 rounded-full bg-ink px-5 py-4 text-sm font-semibold text-white shadow-panel transition hover:bg-tide"
        >
          <Scale size={17} />
          So sánh {compareIds.length} địa điểm
        </button>
      ) : null}
    </div>
  );
}
