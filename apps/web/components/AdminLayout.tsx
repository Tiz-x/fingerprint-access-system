import { useState } from "react";
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  function handleLogout() {
    setShowLogoutModal(true);
  }

  function confirmLogout() {
    setShowLogoutModal(false);
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

            {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)", // Darker overlay
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(4px)", // Smooth glass effect
          }}
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              margin: "1rem",
              background: "#1e293b", 
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "1.5rem",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)", // Deep shadow
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, fontSize: 20, color: "white" }}>Sign out?</h2>
            <p style={{ color: "#94a3b8", marginTop: "0.75rem", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              Are you sure you want to sign out of the administration panel?
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button 
                className="btn btn-quiet" 
                onClick={() => setShowLogoutModal(false)}
                style={{ padding: "0.5rem 1rem" }}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                onClick={confirmLogout} 
                style={{ background: "red", color: "white", padding: "0.5rem 1rem", border: "none" }}
              >
                Yes, sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}