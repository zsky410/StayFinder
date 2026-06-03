import { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead } from "../components/Layout.jsx";
import { ConfirmDialog, Empty, ErrorBox, Modal, Spinner, useToast } from "../components/ui.jsx";

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  place_id: "",
  type_slug: "",
  type_label: "",
  title: "",
  description: "",
  address: "",
  neighborhood: "",
  district: "",
  city: "",
  phone: "",
  website: "",
  lat: "",
  lng: "",
  rating: "",
  reviews_count: "",
  price_text: "",
  image_url: "",
  amenity_labels: "",
  gallery: "",
};

function toNum(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toList(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function PlaceForm({ initial, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (isEdit) {
      api
        .getPlace(initial.id)
        .then((detail) => {
          if (!active) return;
          setForm({
            place_id: detail.place_id || "",
            type_slug: detail.type_slug || "",
            type_label: detail.type_label || "",
            title: detail.title || "",
            description: detail.description || "",
            address: detail.address || "",
            neighborhood: detail.neighborhood || "",
            district: detail.district || "",
            city: detail.city || "",
            phone: detail.phone || "",
            website: detail.website || "",
            lat: detail.lat ?? "",
            lng: detail.lng ?? "",
            rating: detail.rating ?? "",
            reviews_count: detail.reviews_count ?? "",
            price_text: detail.price_text || "",
            image_url: detail.cover_image || "",
            amenity_labels: (detail.amenities || []).map((a) => a.label).join(", "),
            gallery: (detail.gallery || []).join("\n"),
          });
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
    return () => {
      active = false;
    };
  }, [initial, isEdit]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!isEdit && (!form.place_id.trim() || !form.type_slug.trim())) {
      setError("place_id và type_slug là bắt buộc khi tạo mới.");
      return;
    }
    setBusy(true);
    setError("");

    const payload = {
      type_label: form.type_label || null,
      title: form.title || null,
      description: form.description || null,
      address: form.address || null,
      neighborhood: form.neighborhood || null,
      district: form.district || null,
      city: form.city || null,
      phone: form.phone || null,
      website: form.website || null,
      lat: toNum(form.lat),
      lng: toNum(form.lng),
      rating: toNum(form.rating),
      reviews_count: toNum(form.reviews_count),
      price_text: form.price_text || null,
      image_url: form.image_url || null,
      amenity_labels: toList(form.amenity_labels),
      gallery: toList(form.gallery),
    };

    try {
      if (isEdit) {
        await api.updatePlace(initial.id, payload);
        toast.success("Đã cập nhật địa điểm");
      } else {
        await api.createPlace({
          ...payload,
          place_id: form.place_id.trim(),
          type_slug: form.type_slug.trim(),
        });
        toast.success("Đã tạo địa điểm");
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={isEdit ? "Chỉnh sửa địa điểm" : "Thêm địa điểm"}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || loading} form="place-form">
            {busy ? "Đang lưu..." : "Lưu"}
          </button>
        </>
      }
    >
      {loading ? (
        <Spinner />
      ) : (
        <form id="place-form" onSubmit={submit}>
          {error ? <div className="error-banner">{error}</div> : null}

          <div className="field-row">
            <div className="field">
              <label className="field-label">place_id {isEdit ? "" : "*"}</label>
              <input className="input" value={form.place_id} onChange={set("place_id")} disabled={isEdit} />
            </div>
            <div className="field">
              <label className="field-label">type_slug {isEdit ? "" : "*"}</label>
              <input className="input" value={form.type_slug} onChange={set("type_slug")} placeholder="hotel / homestay / ..." disabled={isEdit} />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Tên (title)</label>
            <input className="input" value={form.title} onChange={set("title")} />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">type_label</label>
              <input className="input" value={form.type_label} onChange={set("type_label")} placeholder="Khách sạn" />
            </div>
            <div className="field">
              <label className="field-label">Giá (price_text)</label>
              <input className="input" value={form.price_text} onChange={set("price_text")} />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Địa chỉ</label>
            <input className="input" value={form.address} onChange={set("address")} />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Phường (neighborhood)</label>
              <input className="input" value={form.neighborhood} onChange={set("neighborhood")} />
            </div>
            <div className="field">
              <label className="field-label">Quận (district)</label>
              <input className="input" value={form.district} onChange={set("district")} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Thành phố</label>
              <input className="input" value={form.city} onChange={set("city")} />
            </div>
            <div className="field">
              <label className="field-label">Điện thoại</label>
              <input className="input" value={form.phone} onChange={set("phone")} />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Website</label>
            <input className="input" value={form.website} onChange={set("website")} />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Lat</label>
              <input className="input" value={form.lat} onChange={set("lat")} inputMode="decimal" />
            </div>
            <div className="field">
              <label className="field-label">Lng</label>
              <input className="input" value={form.lng} onChange={set("lng")} inputMode="decimal" />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="field-label">Rating</label>
              <input className="input" value={form.rating} onChange={set("rating")} inputMode="decimal" />
            </div>
            <div className="field">
              <label className="field-label">Số đánh giá</label>
              <input className="input" value={form.reviews_count} onChange={set("reviews_count")} inputMode="numeric" />
            </div>
          </div>

          <div className="field">
            <label className="field-label">Ảnh đại diện (image_url)</label>
            <input className="input" value={form.image_url} onChange={set("image_url")} />
          </div>

          <div className="field">
            <label className="field-label">Tiện ích (phân cách bằng dấu phẩy)</label>
            <input className="input" value={form.amenity_labels} onChange={set("amenity_labels")} placeholder="Wi-Fi, Hồ bơi, Bữa sáng" />
          </div>

          <div className="field">
            <label className="field-label">Gallery (mỗi URL một dòng)</label>
            <textarea className="textarea" value={form.gallery} onChange={set("gallery")} />
          </div>

          <div className="field">
            <label className="field-label">Mô tả</label>
            <textarea className="textarea" value={form.description} onChange={set("description")} />
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function Places() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [editing, setEditing] = useState(null); // {id} or {} for new
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const data = await api.listPlaces({ q: search, page, limit: PAGE_SIZE, sort: "rating_desc" });
      setState({ loading: false, error: null, data });
    } catch (error) {
      setState({ loading: false, error, data: null });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  const total = state.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const items = state.data?.items ?? [];

  const submitSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(q.trim());
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await api.deletePlace(deleting.id);
      toast.success("Đã xoá địa điểm");
      setDeleting(null);
      if (items.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        load();
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <PageHead
        title="Địa điểm"
        subtitle={`${total.toLocaleString("vi-VN")} địa điểm trong hệ thống`}
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            + Thêm địa điểm
          </button>
        }
      />

      <form className="toolbar" onSubmit={submitSearch}>
        <input
          className="input search"
          placeholder="Tìm theo tên, địa chỉ, khu vực..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn" type="submit">
          Tìm
        </button>
        {search ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setQ("");
              setSearch("");
              setPage(1);
            }}
          >
            Xoá lọc
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={load} style={{ marginLeft: "auto" }}>
          ↻ Làm mới
        </button>
      </form>

      {state.loading ? (
        <Spinner />
      ) : state.error ? (
        <ErrorBox error={state.error} onRetry={load} />
      ) : items.length === 0 ? (
        <Empty>Không tìm thấy địa điểm nào.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Loại</th>
                  <th>Khu vực</th>
                  <th>Rating</th>
                  <th>Giá</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((place) => (
                  <tr key={place.id}>
                    <td>
                      <div className="cell-strong">{place.title || "(chưa có tên)"}</div>
                      <div className="cell-dim">{place.address || place.place_id}</div>
                    </td>
                    <td>
                      <span className="badge badge-gray">{place.type_slug}</span>
                    </td>
                    <td>{place.district || place.neighborhood || "—"}</td>
                    <td>
                      {place.rating != null ? (
                        <span>
                          ⭐ {Number(place.rating).toFixed(1)}{" "}
                          <span className="cell-dim">({place.reviews_count ?? 0})</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{place.price_text || <span className="muted">—</span>}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => setEditing({ id: place.id })}>
                          Sửa
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => setDeleting(place)}>
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <span>
              Trang {page}/{totalPages}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Trước
              </button>
              <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Sau →
              </button>
            </div>
          </div>
        </>
      )}

      {editing ? (
        <PlaceForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          message={`Xoá địa điểm "${deleting.title || deleting.place_id}"? Hành động này không thể hoàn tác.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={deleteBusy}
        />
      ) : null}
    </>
  );
}
