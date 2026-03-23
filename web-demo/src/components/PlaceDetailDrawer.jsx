import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe,
  Images,
  Landmark,
  MapPinned,
  Phone,
  Star,
  X,
} from "lucide-react";
import { formatReviewScore } from "../lib/places";

function Lightbox({ lightbox, onClose, onChangeIndex }) {
  if (!lightbox) return null;

  const { images, index, title } = lightbox;
  const activeImage = images[index];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-ink/80 backdrop-blur-md"
        onClick={onClose}
        aria-label="Đóng popup ảnh"
      />

      <div className="relative z-10 flex h-full w-full max-w-6xl flex-col px-4 py-5 md:px-8">
        <div className="mb-4 flex items-center justify-between gap-4 text-white">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/60">Xem ảnh chi tiết</p>
            <p className="mt-2 text-sm text-white/90">{title}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white/12 px-3 py-2 text-sm text-white/90">
              {index + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white/12 p-3 text-white transition hover:bg-white/18"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[28px] border border-white/10 bg-black/30">
          {images.length > 1 ? (
            <button
              type="button"
              onClick={() => onChangeIndex(index - 1)}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/12 p-3 text-white transition hover:bg-white/18"
            >
              <ChevronLeft size={18} />
            </button>
          ) : null}

          <img
            src={activeImage}
            alt={`${title} ${index + 1}`}
            className="max-h-full max-w-full object-contain"
          />

          {images.length > 1 ? (
            <button
              type="button"
              onClick={() => onChangeIndex(index + 1)}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/12 p-3 text-white transition hover:bg-white/18"
            >
              <ChevronRight size={18} />
            </button>
          ) : null}
        </div>

        {images.length > 1 ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {images.map((image, imageIndex) => (
              <button
                key={`${title}-${imageIndex}`}
                type="button"
                onClick={() => onChangeIndex(imageIndex)}
                className={`overflow-hidden rounded-[18px] border transition ${
                  imageIndex === index
                    ? "border-coral shadow-card"
                    : "border-white/12 opacity-80 hover:opacity-100"
                }`}
              >
                <img src={image} alt={`${title} thumb ${imageIndex + 1}`} className="h-16 w-20 object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ReviewMedia({ review, placeTitle, onOpenLightbox }) {
  if (!review.reviewImageUrls?.length) return null;

  const previewImages = review.reviewImageUrls.slice(0, 3);
  const moreImages = review.reviewImageUrls.length - previewImages.length;

  return (
    <div className="mt-4">
      <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-shell px-3 py-1 text-xs font-medium text-ink/65">
        <Camera size={13} />
        Ảnh review
      </div>
      <div
        className={`grid gap-2 ${
          previewImages.length === 1 ? "grid-cols-1" : previewImages.length === 2 ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {previewImages.map((image, imageIndex) => {
          const isLastPreview = imageIndex === previewImages.length - 1;
          return (
            <button
              key={`${review.reviewId}-media-${imageIndex}`}
              type="button"
              onClick={() =>
                onOpenLightbox(
                  review.reviewImageUrls,
                  imageIndex,
                  `${placeTitle} • Ảnh từ review`
                )
              }
              className="group relative overflow-hidden rounded-[18px] border border-line bg-shell"
            >
              <img
                src={image}
                alt={`${placeTitle} review ${imageIndex + 1}`}
                className="aspect-[1.08/1] h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
              {moreImages > 0 && isLastPreview ? (
                <div className="absolute inset-0 flex items-center justify-center bg-ink/42 text-lg font-semibold text-white backdrop-blur-[1px]">
                  +{moreImages}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PlaceDetailDrawer({
  place,
  onClose,
  onToggleCompare,
  isCompared,
  loadingDetails = false,
  detailError = null,
  onRetryDetails,
}) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    setActiveImageIndex(0);
    setLightbox(null);
  }, [place?.placeId]);

  useEffect(() => {
    if (!lightbox) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setLightbox(null);
      }
      if (event.key === "ArrowLeft" && lightbox.images.length > 1) {
        setLightbox((current) =>
          current
            ? {
                ...current,
                index: (current.index - 1 + current.images.length) % current.images.length,
              }
            : current
        );
      }
      if (event.key === "ArrowRight" && lightbox.images.length > 1) {
        setLightbox((current) =>
          current
            ? {
                ...current,
                index: (current.index + 1) % current.images.length,
              }
            : current
        );
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightbox]);

  const galleryImages = place?.galleryImages?.length
    ? place.galleryImages
    : place?.coverImage
      ? [place.coverImage]
      : [];
  const activeImage = galleryImages[activeImageIndex] || place?.coverImage || place?.imageUrl;
  const openingMeta = place?.openingMeta;
  const reviewPriorityList = place?.reviewList || [];
  const visibleReviews = [
    ...reviewPriorityList.filter((review) => review.reviewImageUrls?.length),
    ...reviewPriorityList.filter((review) => !review.reviewImageUrls?.length),
  ].slice(0, 5);

  function openLightbox(images, index, title) {
    if (!images?.length) return;
    setLightbox({
      images,
      index,
      title,
    });
  }

  function changeLightboxIndex(nextIndex) {
    setLightbox((current) =>
      current
        ? {
            ...current,
            index: (nextIndex + current.images.length) % current.images.length,
          }
        : current
    );
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 transition ${
          place ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-ink/45 backdrop-blur-sm transition ${
            place ? "opacity-100" : "opacity-0"
          }`}
          onClick={onClose}
        />

        <aside
          className={`absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-pearl shadow-panel transition duration-500 ${
            place ? "translate-x-0" : "translate-x-full"
          }`}
        >
          {place ? (
            <>
              <div className="relative aspect-[1.35/1] overflow-hidden">
                {activeImage ? (
                  <button
                    type="button"
                    onClick={() => openLightbox(galleryImages, activeImageIndex, `${place.title} • Ảnh địa điểm`)}
                    className="h-full w-full cursor-zoom-in"
                  >
                    <img
                      src={activeImage}
                      alt={place.title}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex h-full items-center justify-center bg-shell text-ink/50">
                    Không có ảnh
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/20 to-transparent" />
                <button
                  type="button"
                  onClick={onClose}
                  className="absolute right-5 top-5 rounded-full bg-white/90 p-3 text-ink shadow-sm transition hover:bg-white"
                >
                  <X size={18} />
                </button>

                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-ink">
                      {place.typeNormalized}
                    </span>
                    {place.hotelStars ? (
                      <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-medium backdrop-blur">
                        {place.hotelStars}
                      </span>
                    ) : null}
                    {galleryImages.length > 1 ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-black/25 px-3 py-1 text-xs font-medium backdrop-blur">
                        <Images size={13} />
                        {galleryImages.length} ảnh địa điểm
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-4 max-w-xl font-display text-[2.7rem] leading-[0.92] tracking-tight">
                    {place.title}
                  </h2>
                  <p className="mt-3 flex items-center gap-2 text-sm text-white/82">
                    <MapPinned size={15} />
                    {place.address || place.displayAddress}
                  </p>
                </div>
              </div>

              {galleryImages.length > 1 ? (
                <div className="border-b border-line/70 px-6 py-4 md:px-8">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-ink/42">
                      Ảnh địa điểm
                    </p>
                    <p className="text-xs text-ink/52">Nguồn ảnh địa điểm tách riêng với ảnh review</p>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {galleryImages.slice(0, 9).map((image, imageIndex) => (
                      <button
                        key={`${place.placeId}-gallery-${imageIndex}`}
                        type="button"
                        onClick={() => setActiveImageIndex(imageIndex)}
                        className={`overflow-hidden rounded-[18px] border transition ${
                          activeImageIndex === imageIndex
                            ? "border-coral shadow-card"
                            : "border-line opacity-85 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={image}
                          alt={`${place.title} gallery ${imageIndex + 1}`}
                          className="h-20 w-24 object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-8 px-6 py-6 md:px-8">
                {loadingDetails ? (
                  <div className="rounded-[24px] border border-dashed border-tide/25 bg-[#edf6f5] px-4 py-4 text-sm text-tide">
                    Đang tải dữ liệu chi tiết theo loại hình cho địa điểm này. Ảnh review, booking
                    và phần mô tả đầy đủ sẽ xuất hiện ngay khi tải xong.
                  </div>
                ) : null}

                {detailError ? (
                  <div className="rounded-[24px] border border-dashed border-coral/25 bg-[#fff5f1] px-4 py-4 text-sm text-ink/78">
                    Không tải được dữ liệu chi tiết lúc này.
                    {onRetryDetails ? (
                      <button
                        type="button"
                        onClick={onRetryDetails}
                        className="ml-2 font-semibold text-coral"
                      >
                        Thử lại
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="detail-stat">
                    <p className="detail-label">Điểm đánh giá</p>
                    <p className="detail-value inline-flex items-center gap-2">
                      <Star size={16} className="fill-current text-amber" />
                      {place.totalScore ?? "N/A"}
                    </p>
                  </div>
                  <div className="detail-stat">
                    <p className="detail-label">Số review</p>
                    <p className="detail-value">{place.reviewsCount || 0}</p>
                  </div>
                  <div className="detail-stat">
                    <p className="detail-label">Giá hiển thị</p>
                    <p className="detail-value">{place.displayPrice}</p>
                  </div>
                  <div className="detail-stat">
                    <p className="detail-label">Nguồn tốt nhất</p>
                    <p className="detail-value">{place.bestOffer?.title || "-"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleCompare(place.placeId)}
                    className={`action-pill ${
                      isCompared ? "bg-coral text-white" : "bg-shell text-ink"
                    }`}
                  >
                    {isCompared ? "Đã thêm vào so sánh" : "Thêm vào so sánh"}
                  </button>
                  <a href={place.url} target="_blank" rel="noreferrer" className="action-pill">
                    <MapPinned size={15} />
                    Mở Google Maps
                  </a>
                  {place.website ? (
                    <a
                      href={place.website}
                      target="_blank"
                      rel="noreferrer"
                      className="action-pill"
                    >
                      <Globe size={15} />
                      Website
                    </a>
                  ) : null}
                  {place.phone ? (
                    <a href={`tel:${place.phone}`} className="action-pill">
                      <Phone size={15} />
                      {place.phone}
                    </a>
                  ) : null}
                </div>

                <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="panel-inner">
                    <p className="section-title">Tóm tắt hiển thị</p>
                    <p className="mt-4 text-sm leading-7 text-ink/78">
                      {place.displayDescription || "Chưa có mô tả ngắn để hiển thị."}
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <div className="info-row">
                        <Landmark size={16} className="text-coral" />
                        <div>
                          <p className="info-row-label">Category gốc</p>
                          <p className="info-row-value">{place.categoryName || "Chưa rõ"}</p>
                        </div>
                      </div>
                      <div className="info-row">
                        <Clock3 size={16} className="text-coral" />
                        <div>
                          <p className="info-row-label">Giờ hôm nay</p>
                          <p className="info-row-value">
                            {openingMeta?.hasData
                              ? openingMeta.primaryLabel
                              : loadingDetails
                                ? "Đang tải dữ liệu chi tiết..."
                                : "Chưa có dữ liệu"}
                          </p>
                        </div>
                      </div>
                      <div className="info-row sm:col-span-2">
                        <Clock3 size={16} className="text-coral" />
                        <div>
                          <p className="info-row-label">Check-in demo</p>
                          <p className="info-row-value">
                            {place.checkInDate || "Chưa có"} - {place.checkOutDate || "Chưa có"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {place.popularTimesLiveText ? (
                      <div className="mt-6 rounded-[24px] bg-shell px-4 py-4 text-sm text-ink/75">
                        <span className="font-semibold text-ink">Tình trạng hiện tại:</span>{" "}
                        {place.popularTimesLiveText}
                      </div>
                    ) : null}
                  </div>

                  <div className="panel-inner">
                    <p className="section-title">Tiện ích và thời gian</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {place.amenities.length ? (
                        place.amenities.map((amenity) => (
                          <span key={amenity} className="chip-soft">
                            {amenity}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-ink/55">Chưa có dữ liệu tiện ích.</span>
                      )}
                    </div>

                    <div className="mt-6 rounded-[24px] border border-line bg-white px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Địa chỉ</p>
                      <p className="mt-2 text-sm leading-6 text-ink/78">{place.address}</p>
                    </div>

                    <div className="mt-4 rounded-[24px] border border-line bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
                            Giờ mở cửa / đóng cửa
                          </p>
                          {openingMeta?.hasData ? (
                            <div className="mt-3">
                              {openingMeta.isAllDay ? (
                                <p className="font-display text-[1.7rem] leading-none text-tide">
                                  24/7
                                </p>
                              ) : openingMeta.openTime && openingMeta.closeTime ? (
                                <div className="space-y-2">
                                  <p className="font-display text-[1.4rem] leading-none text-ink">
                                    Mở {openingMeta.openTime}
                                  </p>
                                  <p className="text-sm font-medium text-ink/68">
                                    Đóng {openingMeta.closeTime}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm leading-6 text-ink/78">
                                  {openingMeta.todayHours}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="mt-3 text-sm leading-6 text-ink/58">
                              {loadingDetails
                                ? "Đang tải dữ liệu giờ mở/đóng cho địa điểm này."
                                : "Chưa có dữ liệu giờ mở/đóng cho địa điểm này."}
                            </p>
                          )}
                        </div>
                        <div className="rounded-full bg-shell p-3 text-coral">
                          <Clock3 size={16} />
                        </div>
                      </div>

                      {openingMeta?.hasData ? (
                        <div className="mt-4 space-y-2">
                          {openingMeta.weekly.slice(0, 7).map((entry) => (
                            <div
                              key={`${place.placeId}-${entry.day}`}
                              className={`flex items-center justify-between rounded-2xl px-3 py-2 text-sm ${
                                entry.day === openingMeta.todayDay ? "bg-shell" : "bg-pearl"
                              }`}
                            >
                              <span className="font-medium text-ink">{entry.day}</span>
                              <span className="text-ink/62">{entry.hours}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="panel-inner">
                  <div className="flex items-center justify-between gap-3">
                    <p className="section-title">Nguồn giá và booking</p>
                    <span className="text-xs uppercase tracking-[0.22em] text-ink/40">
                      {place.hotelAds?.length || (loadingDetails ? "đang tải" : 0)} nguồn
                    </span>
                  </div>

                  {place.hotelAds?.length ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {place.hotelAds.slice(0, 4).map((offer) => (
                        <a
                          key={`${place.placeId}-${offer.title}-${offer.url}`}
                          href={offer.url || offer.googleUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-[24px] border border-line bg-white px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-card"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-ink">{offer.title}</p>
                              <p className="mt-1 text-xs text-ink/55">
                                {offer.isOfficialSite ? "Official site" : "OTA / đối tác"}
                              </p>
                            </div>
                            <ArrowUpRight size={16} className="text-ink/40" />
                          </div>
                          <p className="mt-4 font-display text-2xl text-tide">
                            {offer.price || "Xem giá"}
                          </p>
                        </a>
                      ))}
                    </div>
                  ) : loadingDetails ? (
                    <p className="mt-4 text-sm text-ink/58">Đang tải danh sách nguồn booking...</p>
                  ) : (
                    <p className="mt-4 text-sm text-ink/58">Địa điểm này chưa có dữ liệu booking.</p>
                  )}
                </section>

                <section className="panel-inner">
                  <div className="flex items-center justify-between gap-3">
                    <p className="section-title">Review và ảnh review</p>
                    <span className="text-xs uppercase tracking-[0.22em] text-ink/40">
                      Hiển thị tối đa 5 review
                    </span>
                  </div>
                  {visibleReviews.length ? (
                    <div className="mt-4 space-y-3">
                      {visibleReviews.map((review) => (
                        <div
                          key={review.reviewId}
                          className="rounded-[24px] border border-line bg-white px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-ink/42">
                            <span>{review.reviewOrigin || "Google"}</span>
                            <span className="h-1 w-1 rounded-full bg-ink/25" />
                            <span>{formatReviewScore(review)}</span>
                            {review.publishAt ? (
                              <>
                                <span className="h-1 w-1 rounded-full bg-ink/25" />
                                <span>{review.publishAt}</span>
                              </>
                            ) : null}
                          </div>
                          <p className="mt-3 text-sm leading-7 text-ink/78">
                            {review.displayText || "Review này không có text, nhưng có ảnh để demo UI."}
                          </p>
                          <ReviewMedia
                            review={review}
                            placeTitle={place.title}
                            onOpenLightbox={openLightbox}
                          />
                        </div>
                      ))}
                    </div>
                  ) : loadingDetails ? (
                    <p className="mt-4 text-sm text-ink/58">
                      Đang tải review và ảnh review cho địa điểm này...
                    </p>
                  ) : (
                    <p className="mt-4 text-sm text-ink/58">
                      Chưa có review text hoặc ảnh để render trong phần demo.
                    </p>
                  )}
                </section>
              </div>
            </>
          ) : null}
        </aside>
      </div>

      <Lightbox
        lightbox={lightbox}
        onClose={() => setLightbox(null)}
        onChangeIndex={changeLightboxIndex}
      />
    </>
  );
}
