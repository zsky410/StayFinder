import {
  Search,
  SlidersHorizontal,
  MapPinned,
  Globe,
  Phone,
  ReceiptText,
} from "lucide-react";

export default function FilterSidebar({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  typeCounts,
  minScore,
  onMinScoreChange,
  sortBy,
  onSortByChange,
  hasPriceOnly,
  onHasPriceOnlyChange,
  hasWebsiteOnly,
  onHasWebsiteOnlyChange,
  hasPhoneOnly,
  onHasPhoneOnlyChange,
  totalPlaces,
  filteredPlaces,
  pagePlaces,
  currentPage,
  totalPages,
  datasetLabel,
}) {
  const scoreOptions = [2.5, 3, 3.5, 4, 4.5];
  const toggleItems = [
    {
      label: "Có giá",
      icon: ReceiptText,
      checked: hasPriceOnly,
      onChange: onHasPriceOnlyChange,
    },
    {
      label: "Có website",
      icon: Globe,
      checked: hasWebsiteOnly,
      onChange: onHasWebsiteOnlyChange,
    },
    {
      label: "Có điện thoại",
      icon: Phone,
      checked: hasPhoneOnly,
      onChange: onHasPhoneOnlyChange,
    },
  ];

  return (
    <div className="panel-card overflow-hidden">
      <div className="border-b border-line px-5 py-5">
        <div className="flex items-center gap-3 text-ink">
          <div className="rounded-full bg-foam p-2 text-tide">
            <SlidersHorizontal size={18} />
          </div>
          <div>
            <p className="font-display text-xl font-semibold">Bộ lọc khám phá</p>
            <p className="text-sm text-ink/65">
              Lọc trên index nhẹ, còn dữ liệu chi tiết sẽ chỉ tải khi người dùng mở xem.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-5 py-5">
        <label className="block">
          <span className="section-label">Tìm kiếm nhanh</span>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3">
            <Search size={17} className="text-ink/40" />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Tên, khu vực, địa chỉ, category..."
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/35"
            />
          </div>
        </label>

        <div>
          <span className="section-label">Loại hình</span>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onTypeFilterChange("all")}
              className={typeFilter === "all" ? "filter-pill-active" : "filter-pill"}
            >
              Tất cả
              <span className="text-ink/50">{totalPlaces}</span>
            </button>
            {typeCounts.map((type) => (
              <button
                key={type.name}
                type="button"
                onClick={() => onTypeFilterChange(type.name)}
                className={
                  typeFilter === type.name ? "filter-pill-active" : "filter-pill"
                }
              >
                {type.name}
                <span className="text-ink/50">{type.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <label className="block">
            <span className="section-label">Điểm tối thiểu</span>
            <select
              value={minScore}
              onChange={(event) => onMinScoreChange(Number(event.target.value))}
              className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none"
            >
              {scoreOptions.map((score) => (
                <option key={score} value={score}>
                  Từ {score} sao
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="section-label">Sắp xếp</span>
            <select
              value={sortBy}
              onChange={(event) => onSortByChange(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none"
            >
              <option value="recommended">Gợi ý tốt nhất</option>
              <option value="reviews">Nhiều review nhất</option>
              <option value="rating">Điểm cao nhất</option>
              <option value="price">Ưu tiên nơi có giá</option>
              <option value="az">Tên A-Z</option>
            </select>
          </label>
        </div>

        <div>
          <span className="section-label">Điều kiện nhanh</span>
          <div className="mt-3 grid gap-3">
            {toggleItems.map((item) => {
              const Icon = item.icon;
              return (
                <label
                  key={item.label}
                  className="flex cursor-pointer items-center justify-between rounded-2xl border border-line bg-white px-4 py-3"
                >
                  <span className="flex items-center gap-3 text-sm text-ink">
                    <span className="rounded-full bg-shell p-2 text-tide">
                      <Icon size={15} />
                    </span>
                    {item.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(event) => item.onChange(event.target.checked)}
                    className="h-4 w-4 accent-tide"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-dashed border-line bg-shell px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <MapPinned size={16} className="text-coral" />
            Tập dữ liệu đang dùng
          </div>
          <p className="mt-2 text-sm text-ink/65">{datasetLabel}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white px-3 py-3">
              <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Tổng</p>
              <p className="mt-1 text-sm font-medium text-ink">{totalPlaces} địa điểm</p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-3">
              <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Khớp filter</p>
              <p className="mt-1 text-sm font-medium text-ink">{filteredPlaces} mục</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-ink/62">
            Trang {currentPage}/{totalPages} · đang render {pagePlaces} địa điểm
          </p>
        </div>
      </div>
    </div>
  );
}
