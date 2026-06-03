import { useState } from "react";
import { useAuth } from "../auth.jsx";
import { useToast } from "../components/ui.jsx";

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const [token, setTokenInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(token);
      toast.success("Đăng nhập thành công");
    } catch (err) {
      const message =
        err?.status === 401
          ? "Admin token không đúng."
          : err?.status === 503
            ? "Backend chưa cấu hình ADMIN_API_TOKEN."
            : err?.message || "Đăng nhập thất bại.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="panel login-card" onSubmit={submit}>
        <img src="/logo-mark.png" alt="StayFinder" className="login-logo-img" />
        <h1 style={{ margin: "0 0 4px", fontSize: 20, textAlign: "center" }}>Admin Console</h1>
        <p className="page-sub" style={{ marginTop: 0, marginBottom: 22, textAlign: "center" }}>
          Nhập admin token để truy cập console quản trị.
        </p>

        <div className="field">
          <label className="field-label">Admin token</label>
          <input
            className="input"
            type="password"
            value={token}
            autoFocus
            placeholder="ADMIN_API_TOKEN"
            onChange={(e) => setTokenInput(e.target.value)}
          />
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
          {busy ? "Đang kiểm tra..." : "Đăng nhập"}
        </button>

        <p className="muted" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
          Token là giá trị <code>ADMIN_API_TOKEN</code> trong file <code>.env</code> của backend.
        </p>
      </form>
    </div>
  );
}
