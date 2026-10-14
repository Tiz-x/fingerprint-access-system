import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import AdminLayout from "../components/AdminLayout";
import { useAuth } from "./lib/auth";
import Users from "./pages/Users";
import Enroll from "./pages/Enroll";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  if (loading) return <div style={{ padding: "2rem" }}>Loading...</div>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      <p style={{ color: "var(--muted)" }}>{hint}</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin/login" replace />} />
      <Route path="/admin/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/admin/users" replace />} />
        <Route path="users" element={<Users />} />
        <Route path="enroll" element={<Enroll />} />
        <Route
          path="logs"
          element={
            <Placeholder
              title="Access Logs"
              hint="Log viewer coming in Step 5.11."
            />
          }
        />
      </Route>

      <Route
        path="/access"
        element={
          <Placeholder
            title="Access Screen"
            hint="Full-screen fingerprint access coming in Step 5.12."
          />
        }
      />
    </Routes>
  );
}