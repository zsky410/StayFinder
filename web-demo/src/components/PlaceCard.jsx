import { Globe, MapPinned, Phone, Star, Scale, ArrowUpRight, Images } from "lucide-react";

function typeAccent(type) {
  switch (type) {
    case "Homestay":
      return "bg-[#f4ede1] text-[#8a5a18]";
    case "Căn hộ":
      return "bg-[#e6f2ef] text-[#0f5b5f]";
    case "Resort":
      return "bg-[#eef3fb] text-[#295d90]";
    case "Villa":
      return "bg-[#fbe9e4] text-[#b55b3d]";
    case "Nhà nghỉ":
      return "bg-[#efe8f7] text-[#6b4f8f]";
    default:
      return "bg-shell text-ink";
  }
}

export default function PlaceCard({
  place,
  index,
  isCompared,
  onOpen,
  onToggleCompare,
}) {
  const previewImages = place.galleryImages.slice(0, 3);

  return (
    <article
      className="panel-card group overflow-hidden animate-rise"
      style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
    >
      <div className="relative aspect-[1.25/1] overflow-hidden">
        {place.coverImage ? (
          <img
            src={place.coverImage}
            alt={place.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-foam to-shell text-sm text-ink/45">
            Không có ảnh
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${typeAccent(place.typeNormalized)}`}>
            {place.typeNormalized}
          </span>
          {place.hotelStars ? (
            <span className="rounded-full bg-white/88 px-3 py-1 text-xs font-medium text-ink shadow-sm backdrop-blur">
              {place.hotelStars}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onToggleCompare(place.placeId)}
          className={`absolute right-4 top-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-sm transition ${
            isCompared
              ? "bg-coral text-white"
              : "bg-white/88 text-ink backdrop-blur hover:bg-white"
          }`}
        >
          <Scale size={14} />
          {isCompared ? "Đã chọn" : "So sánh"}
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 backdrop-blur">
              <Star size={14} className="fill-current" />
              {place.totalScore ?? "N/A"}
            </span>
            <span className="text-white/85">{place.reviewsCount || 0} review</span>
            {place.galleryCount > 1 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-white/90 backdrop-blur">
                <Images size={13} />
                {place.galleryCount} ảnh
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 font-display text-[1.7rem] leading-none tracking-tight">
            {place.title}
          </h3>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">Khu vực</p>
            <p className="mt-1 text-sm text-ink/75">{place.displayAddress}</p>
          </div>
          <div className="rounded-2xl bg-shell px-3 py-2 text-right">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Giá</p>
            <p className="mt-1 text-sm font-semibold text-ink">{place.displayPrice}</p>
          </div>
        </div>

        <p className="min-h-[52px] text-sm leading-6 text-ink/75">
          {place.displayDescription || "Đang dùng dữ liệu crawl thô, chưa có mô tả ngắn."}
        </p>

        {previewImages.length > 1 ? (
          <div
            className={`grid gap-2 ${
              previewImages.length === 2 ? "grid-cols-2" : "grid-cols-3"
            }`}
          >
            {previewImages.map((image, imageIndex) => (
              <div
                key={`${place.placeId}-preview-${imageIndex}`}
                className="relative aspect-[1.15/1] overflow-hidden rounded-[18px] border border-line"
              >
                <img
                  src={image}
                  alt={`${place.title} ${imageIndex + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
                {imageIndex === previewImages.length - 1 && place.galleryCount > previewImages.length ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/38 font-semibold text-white backdrop-blur-[1px]">
                    +{place.galleryCount - previewImages.length}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {place.amenities.length ? (
            place.amenities.slice(0, 3).map((amenity) => (
              <span key={amenity} className="chip-soft">
                {amenity}
              </span>
            ))
          ) : (
            <span className="chip-soft">Chưa có tiện ích nổi bật</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-ink/60">
          <div className="rounded-2xl bg-shell px-3 py-3">
            <p className="uppercase tracking-[0.2em] text-ink/40">Rank</p>
            <p className="mt-1 text-sm font-semibold text-ink">{place.rank ?? "-"}</p>
          </div>
          <div className="rounded-2xl bg-shell px-3 py-3">
            <p className="uppercase tracking-[0.2em] text-ink/40">Nguồn giá</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {place.bestOffer?.title || (place.price ? "Google" : "-")}
            </p>
          </div>
          <div className="rounded-2xl bg-shell px-3 py-3">
            <p className="uppercase tracking-[0.2em] text-ink/40">Ảnh</p>
            <p className="mt-1 text-sm font-semibold text-ink">{place.imagesCount || 0}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          {place.website ? (
            <a
              href={place.website}
              target="_blank"
              rel="noreferrer"
              className="icon-link"
            >
              <Globe size={14} />
              Website
            </a>
          ) : null}
          {place.phone ? (
            <a href={`tel:${place.phone}`} className="icon-link">
              <Phone size={14} />
              Gọi
            </a>
          ) : null}
          <a href={place.url} target="_blank" rel="noreferrer" className="icon-link">
            <MapPinned size={14} />
            Google Maps
          </a>
        </div>

        <button
          type="button"
          onClick={() => onOpen(place.placeId)}
          className="inline-flex w-full items-center justify-between rounded-2xl border border-ink/10 bg-ink px-4 py-3 text-sm font-medium text-white transition hover:bg-tide"
        >
          Xem chi tiết địa điểm
          <ArrowUpRight size={16} />
        </button>
      </div>
    </article>
  );
}
