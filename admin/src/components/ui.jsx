import { createContext, useCallback, useContext, useEffect, useState } from "react";

export function Spinner({ label = "Đang tải..." }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <div>{label}</div>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  const message = error?.message || String(error || "Đã xảy ra lỗi");
  return (
    <div className="error-box">
      <div style={{ marginBottom: 10 }}>⚠️ {message}</div>
      {onRetry ? (
        <button className="btn btn-sm" onClick={onRetry}>
          Thử lại
        </button>
      ) : null}
    </div>
  );
}

export function Empty({ children = "Chưa có dữ liệu." }) {
  return <div className="empty">{children}</div>;
}

export function Modal({ title, onClose, children, footer, maxWidth }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={maxWidth ? { maxWidth } : undefined}>
        <div className="modal-head">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export const CHART_PALETTE = [
  "#1f51e0",
  "#ff6a1a",
  "#4a78f5",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#7c3aed",
  "#ec4899",
  "#ef4444",
  "#14b8a6",
];

export function BarChart({ data, max, colored = false, emptyText = "Không có dữ liệu" }) {
  const rows = data || [];
  if (!rows.length) {
    return <div className="muted" style={{ fontSize: 13 }}>{emptyText}</div>;
  }
  const peak = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div>
      {rows.map((row, i) => (
        <div className="bar-row" key={row.label}>
          <div className="bar-label" title={row.label}>
            {row.label}
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${Math.max(2, (row.value / peak) * 100)}%`,
                ...(colored
                  ? { background: CHART_PALETTE[i % CHART_PALETTE.length] }
                  : {}),
              }}
            />
          </div>
          <div className="bar-value">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export function ColumnChart({ data, emptyText = "Không có dữ liệu" }) {
  const rows = data || [];
  if (!rows.length) {
    return <div className="muted" style={{ fontSize: 13 }}>{emptyText}</div>;
  }
  const peak = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="col-chart">
      {rows.map((row, i) => (
        <div className="col-item" key={row.label}>
          <div className="col-bar-wrap">
            <div
              className="col-bar"
              style={{
                height: `${Math.max(4, (row.value / peak) * 100)}%`,
                background: `linear-gradient(180deg, ${CHART_PALETTE[i % CHART_PALETTE.length]}, ${CHART_PALETTE[i % CHART_PALETTE.length]}bb)`,
              }}
            >
              <span className="col-bar-val">{row.value}</span>
            </div>
          </div>
          <div className="col-label" title={row.label}>
            {row.label}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data, size = 184, thickness = 30, centerLabel = "Tổng", emptyText = "Không có dữ liệu" }) {
  const rows = (data || []).filter((r) => r.value > 0);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  if (!total) {
    return <div className="muted" style={{ fontSize: 13 }}>{emptyText}</div>;
  }

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;

  return (
    <div className="donut-wrap">
      <div className="donut-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="var(--panel-2)"
              strokeWidth={thickness}
            />
            {rows.map((row, i) => {
              const fraction = row.value / total;
              const dash = fraction * circumference;
              const seg = (
                <circle
                  key={row.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={CHART_PALETTE[i % CHART_PALETTE.length]}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-acc}
                  strokeLinecap="butt"
                  style={{ transition: "stroke-dasharray 0.5s ease" }}
                />
              );
              acc += dash;
              return seg;
            })}
          </g>
        </svg>
        <div className="donut-center-text">
          <div>
            <div className="donut-total">{total.toLocaleString("vi-VN")}</div>
            <div className="donut-total-label">{centerLabel}</div>
          </div>
        </div>
      </div>

      <div className="legend">
        {rows.map((row, i) => (
          <div className="legend-item" key={row.label}>
            <span className="legend-dot" style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
            <span className="legend-name" title={row.label}>
              {row.label}
            </span>
            <span className="legend-val">{row.value}</span>
            <span className="legend-pct">{Math.round((row.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const toast = {
    success: (m) => push(m, "success"),
    error: (m) => push(m, "error"),
    info: (m) => push(m, "info"),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className={`toast ${t.type}`} key={t.id}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ConfirmDialog({ title = "Xác nhận", message, confirmText = "Xoá", onConfirm, onClose, busy }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      maxWidth={420}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Huỷ
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Đang xử lý..." : confirmText}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>{message}</p>
    </Modal>
  );
}
