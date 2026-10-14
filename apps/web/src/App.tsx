import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import { useAuth } from "./lib/auth";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  if (loading) return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<Login />} />
      <Route
        path="/admin/users"
        element={
          <RequireAuth>
            <div style={{ padding: "2rem" }}>
              <h1>Users</h1>
              <p style={{ color: "var(--muted)" }}>
                User management coming in Step 5.9.
              </p>
            </div>
          </RequireAuth>
        }
      />
    </Routes>
  );
}