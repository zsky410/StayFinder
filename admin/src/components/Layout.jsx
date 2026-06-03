import { NavLink } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { api } from "../api.js";
import {
  IconAi,
  IconDashboard,
  IconLandmarks,
  IconLogout,
  IconPlaces,
  IconUsers,
} from "./icons.jsx";

const NAV = [
  { to: "/", label: "Dashboard", Icon: IconDashboard, end: true },
  { to: "/places", label: "Địa điểm", Icon: IconPlaces },
  { to: "/landmarks", label: "Landmarks", Icon: IconLandmarks },
  { to: "/ai-config", label: "Cấu hình AI", Icon: IconAi },
  { to: "/users", label: "Người dùng", Icon: IconUsers },
];

export default function Layout({ children }) {
  const { logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.png" alt="StayFinder" className="brand-img" />
          <span className="brand-tag">Admin</span>
        </div>

        <div className="nav-section">Quản lý</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <span className="nav-icon">
                <Icon />
              </span>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div style={{ marginBottom: 10, wordBreak: "break-all" }}>API: {api.base}</div>
          <button className="btn btn-sm btn-ghost" onClick={logout} style={{ width: "100%", justifyContent: "center" }}>
            <IconLogout width={16} height={16} />
            Đăng xuất
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}

export function PageHead({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div style={{ display: "flex", gap: 10 }}>{actions}</div> : null}
    </div>
  );
}
