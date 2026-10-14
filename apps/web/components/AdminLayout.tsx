import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../src/lib/auth";

const navItems = [
  { to: "/admin/users", label: "Users" },
  { to: "/admin/enroll", label: "Enroll" },
  { to: "/admin/logs", label: "Access Logs" },
];

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          background: "#111827",
          borderRight: "1px solid var(--border)",
          padding: "1.5rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Fingerprint</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Access Control</div>
        </div>

        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              padding: "0.55rem 0.8rem",
              borderRadius: 6,
              textDecoration: "none",
              color: isActive ? "white" : "var(--text)",
              background: isActive ? "var(--accent)" : "transparent",
              fontSize: 15,
            })}
          >
            {item.label}
          </NavLink>
        ))}

        <div style={{ flex: 1 }} />

        <NavLink
          to="/access"
          style={{
            padding: "0.55rem 0.8rem",
            borderRadius: 6,
            textDecoration: "none",
            color: "var(--success)",
            fontSize: 14,
            border: "1px solid var(--border)",
            textAlign: "center",
          }}
        >
          → Open Access Screen
        </NavLink>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            height: 56,
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 1.5rem",
            background: "#0b1220",
          }}
        >
          <div style={{ color: "var(--muted)", fontSize: 14 }}>
            {admin ? `Signed in as ${admin.username}` : "Not signed in"}
          </div>
          <button className="secondary" onClick={handleLogout}>
            Logout
          </button>
        </header>

        <main style={{ flex: 1, padding: "2rem", overflow: "auto" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}