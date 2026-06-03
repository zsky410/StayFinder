import { useEffect, useState } from "react";
import { api } from "../api.js";
import { PageHead } from "../components/Layout.jsx";
import { ConfirmDialog, Empty, ErrorBox, Modal, Spinner, useToast } from "../components/ui.jsx";

const PAGE_SIZE = 20;

function UserForm({ user, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    display_name: user.display_name || "",
    email: user.email || "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const payload = { display_name: form.display_name, email: form.email };
    if (form.password.trim()) {
      payload.password = form.password;
    }
    try {
      await api.updateUser(user.id, payload);
      toast.success("Đã cập nhật người dùng");
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Chỉnh sửa người dùng"
      onClose={onClose}
      maxWidth={480}
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
        <div className="field">
          <label className="field-label">Tên hiển thị</label>
          <input className="input" value={form.display_name} onChange={set("display_name")} />
        </div>
        <div className="field">
          <label className="field-label">Email</label>
          <input className="input" value={form.email} onChange={set("email")} />
        </div>
        <div className="field">
          <label className="field-label">Đặt lại mật khẩu (để trống nếu giữ nguyên)</label>
          <input className="input" type="password" value={form.password} onChange={set("password")} placeholder="Mật khẩu mới" />
        </div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);

  const load = async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const data = await api.listUsers({ q: search, page, limit: PAGE_SIZE });
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

  const confirmDelete = async () => {
    setActionBusy(true);
    try {
      await api.deleteUser(deleting.id);
      toast.success("Đã xoá người dùng");
      setDeleting(null);
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  const confirmRevoke = async () => {
    setActionBusy(true);
    try {
      const res = await api.revokeUserSessions(revoking.id);
      toast.success(`Đã thu hồi ${res.revoked_sessions} phiên đăng nhập`);
      setRevoking(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <>
      <PageHead title="Người dùng" subtitle={`${total.toLocaleString("vi-VN")} tài khoản trong app`} />

      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <input className="input search" placeholder="Tìm theo email hoặc tên..." value={q} onChange={(e) => setQ(e.target.value)} />
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
        <Empty>Không tìm thấy người dùng nào.</Empty>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Email</th>
                  <th>Phiên hoạt động</th>
                  <th>Ngày tạo</th>
                  <th style={{ textAlign: "right" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <div className="avatar">{(user.display_name || user.email || "?").charAt(0).toUpperCase()}</div>
                        <span className="cell-strong">{user.display_name}</span>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {user.active_sessions > 0 ? (
                        <span className="badge badge-green">{user.active_sessions} phiên</span>
                      ) : (
                        <span className="badge badge-gray">0</span>
                      )}
                    </td>
                    <td className="cell-dim">{new Date(user.created_at).toLocaleDateString("vi-VN")}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => setEditing(user)}>
                          Sửa
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => setRevoking(user)}
                          disabled={!user.active_sessions}
                          title="Đăng xuất tất cả thiết bị"
                        >
                          Thu hồi
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => setDeleting(user)}>
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
        <UserForm
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          message={`Xoá tài khoản "${deleting.email}"? Mọi dữ liệu phiên sẽ bị xoá theo.`}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
          busy={actionBusy}
        />
      ) : null}

      {revoking ? (
        <ConfirmDialog
          title="Thu hồi phiên đăng nhập"
          message={`Đăng xuất tất cả thiết bị của "${revoking.email}"?`}
          confirmText="Thu hồi"
          onConfirm={confirmRevoke}
          onClose={() => setRevoking(null)}
          busy={actionBusy}
        />
      ) : null}
    </>
  );
}
