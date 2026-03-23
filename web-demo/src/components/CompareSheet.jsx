import { ArrowUpRight, X } from "lucide-react";

const FIELD_ROWS = [
  { label: "Loại hình", accessor: (place) => place.typeNormalized },
  { label: "Điểm", accessor: (place) => place.totalScore ?? "N/A" },
  { label: "Số review", accessor: (place) => place.reviewsCount || 0 },
  { label: "Giá hiển thị", accessor: (place) => place.displayPrice },
  { label: "Website", accessor: (place) => (place.website ? "Có" : "Không") },
  { label: "Điện thoại", accessor: (place) => (place.phone ? place.phone : "Chưa có") },
  {
    label: "Tiện ích",
    accessor: (place) =>
      place.amenities.length ? place.amenities.slice(0, 3).join(", ") : "Chưa có",
  },
  {
    label: "Nguồn giá tốt nhất",
    accessor: (place) => place.bestOffer?.title || (place.price ? "Google" : "Chưa có"),
  },
];

export default function CompareSheet({ places, open, onClose, onRemove }) {
  return (
    <div
      className={`fixed inset-0 z-50 transition ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
    >
      <div
        className={`absolute inset-0 bg-ink/35 backdrop-blur-sm transition ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 mx-auto max-h-[88vh] w-full max-w-7xl rounded-t-[36px] bg-pearl px-5 pb-6 pt-5 shadow-panel transition duration-500 md:px-8 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-[2rem] leading-none text-ink">Bảng so sánh demo</p>
            <p className="mt-2 text-sm text-ink/65">
              Đây là logic MVP để bạn test compare flow trước khi port sang Android.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-shell p-3 text-ink transition hover:bg-mist"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 overflow-x-auto">
          <div
            className="grid min-w-[880px] gap-4"
            style={{ gridTemplateColumns: `220px repeat(${places.length}, minmax(0, 1fr))` }}
          >
            <div className="rounded-[28px] border border-dashed border-line bg-shell px-4 py-4">
              <p className="text-xs uppercase tracking-[0.22em] text-ink/42">Field</p>
              <p className="mt-2 font-display text-2xl text-ink">So sánh nhanh</p>
            </div>

            {places.map((place) => (
              <div
                key={place.placeId}
                className="overflow-hidden rounded-[28px] border border-line bg-white"
              >
                <div className="aspect-[1.4/1] overflow-hidden">
                  {place.imageUrl ? (
                    <img
                      src={place.imageUrl}
                      alt={place.title}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-shell text-sm text-ink/45">
                      Không có ảnh
                    </div>
                  )}
                </div>
                <div className="space-y-3 px-4 py-4">
                  <p className="font-display text-2xl leading-none text-ink">{place.title}</p>
                  <p className="text-sm text-ink/62">{place.displayAddress}</p>
                  <div className="flex items-center justify-between gap-3">
                    <a
                      href={place.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-tide"
                    >
                      Maps
                      <ArrowUpRight size={15} />
                    </a>
                    <button
                      type="button"
                      onClick={() => onRemove(place.placeId)}
                      className="text-sm text-coral"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {FIELD_ROWS.map((field) => (
              <div key={field.label} className="contents">
                <div className="rounded-[24px] bg-shell px-4 py-4 text-sm font-medium text-ink">
                  {field.label}
                </div>
                {places.map((place) => (
                  <div
                    key={`${place.placeId}-${field.label}`}
                    className="rounded-[24px] border border-line bg-white px-4 py-4 text-sm leading-6 text-ink/78"
                  >
                    {field.accessor(place)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
