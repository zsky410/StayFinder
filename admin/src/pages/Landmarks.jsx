import { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead } from "../components/Layout.jsx";
import { ConfirmDialog, Empty, ErrorBox, Modal, Spinner, useToast } from "../components/ui.jsx";

const EMPTY = { slug: "", name: "", kind: "", lat: "", lng: "", metadata: "" };

function toNum(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function LandmarkForm({ initial, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState(() =>
    isEdit
      ? {
          slug: initial.slug || "",
          name: initial.name || "",
          kind: initial.kind || "",
          lat: initial.lat ?? "",
          lng: initial.lng ?? "",
          metadata: initial.metadata ? JSON.stringify(initial.metadata, null, 2) : "",
        }
      : EMPTY,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!isEdit && (!form.slug.trim() || !form.name.trim())) {
      setError("slug và name là bắt buộc.");
      return;
    }
    let metadata;
    if (form.metadata.trim()) {
      try {
        metadata = JSON.parse(form.metadata);
      } catch {
        setError("Metadata phải là JSON hợp lệ.");
        return;
      }
    }
    setBusy(true);
    setError("");
    const payload = {
      name: form.name || null,
      kind: form.kind || null,
      lat: toNum(form.lat),
      lng: toNum(form.lng),
    };
    if (metadata !== undefined) payload.metadata = metadata;

    try {
      if (isEdit) {
        await api.updateLandmark(initial.id, payload);
        toast.success("Đã cập nhật landmark");
      } else {
        await api.createLandmark({ ...payload, slug: form.slug.trim() });
        toast.success("Đã tạo landmark");
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
      title={isEdit ? "Chỉnh sửa landmark" : "Thêm landmark"}
      onClose={onClose}
      maxWidth={520}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Đang lưu..." : "Lưu"}
          </button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error ? <div className="error-banner">{error}</div> : null}
        <div className="field-row">
          <div className="field">
            <label className="field-label">slug {isEdit ? "" : "*"}</label>
            <input className="input" value={form.slug} onChange={set("slug")} disabled={isEdit} placeholder="dragon-bridge" />
          </div>
          <div className="field">
            <label className="field-label">kind</label>
            <input className="input" value={form.kind} onChange={set("kind")} placeholder="bridge / beach / airport" />
          </div>
        </div>
        <div className="field">
          <label className="field-label">Tên (name) {isEdit ? "" : "*"}</label>
          <input className="input" value={form.name} onChange={set("name")} />
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
        <div className="field">
          <label className="field-label">Metadata (JSON)</label>
          <textarea className="textarea" value={form.metadata} onChange={set("metadata")} placeholder='{"note": "..."}' />
        </div>
      </form>
    </Modal>
  );
}

export default function Landmarks() {
  const toast = useToast();
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    setState({ loading: true, error: null, items: [] });
    try {
      const data = await api.listLandmarks();
      setState({ loading: false, error: null, items: data.items || [] });
    } catch (error) {
      setState({ loading: false, error, items: [] });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await api.deleteLandmark(deleting.id);
      toast.success("Đã xoá landmark");
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <PageHead
        title="Landmarks"
        subtitle={`${state.items.length} mốc địa lý`}
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            + Thêm landmark
          </button>
        }
      />

      {state.loading ? (
        <Spinner />
      ) : state.error ? (
        <ErrorBox error={state.error} onRetry={load} />
      ) : state.items.length === 0 ? (
        <Empty>Chưa có landmark nào.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên</th>
                <th>Slug</th>
                <th>Loại</th>
                <th>Toạ độ</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((lm) => (
                <tr key={lm.id}>
                  <td className="cell-strong">{lm.name}</td>
                  <td>
                    <span className="badge badge-gray">{lm.slug}</span>
                  </td>
                  <td>{lm.kind || "—"}</td>
                  <td className="cell-dim">
                    {lm.lat != null && lm.lng != null ? `${Number(lm.lat).toFixed(4)}, ${Number(lm.lng).toFixed(4)}` : "—"}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-sm" onClick={() => setEditing(lm)}>
                        Sửa
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => setDeleting(lm)}>
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <LandmarkForm
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
          message={`Xoá landmark "${deleting.name}"?`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={deleteBusy}
        />
      ) : null}
    </>
  );
}
