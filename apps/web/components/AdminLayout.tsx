import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  DoorOpen,
  Fingerprint,
  LayoutDashboard,
  LogOut,
  ScrollText,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "../src/lib/auth";

const nav = [
  { to: "/admin/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", Icon: Users },
  { to: "/admin/enroll", label: "Enroll a user", Icon: UserPlus },
  { to: "/admin/logs", label: "Access log", Icon: ScrollText },
];

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Fingerprint size={22} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <div className="brand-name">Fingerprint access</div>
            <div className="brand-sub">Administration</div>
          </div>
        </div>

        <nav className="nav" aria-label="Main">
          {nav.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to}>
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <Link className="kiosk-link" to="/access">
  <DoorOpen size={18} aria-hidden="true" />
  Open the access screen
</Link>
          <div className="whoami">
            <div>
              <div className="whoami-name">{admin?.username ?? ""}</div>
              <div className="whoami-role">Administrator</div>
            </div>
            <button className="icon-btn" onClick={handleLogout} aria-label="Sign out" title="Sign out">
              <LogOut size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}