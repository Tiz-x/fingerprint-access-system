import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import AdminLayout from "../components/AdminLayout";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Enroll from "./pages/Enroll";
import Logs from "./pages/Logs";
import Access from "./pages/Access";
import { useAuth } from "./lib/auth";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();
  if (loading) return <p className="loading">Loading...</p>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/access" replace />} />
      <Route path="/admin/login" element={<Login />} />

      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="enroll" element={<Enroll />} />
        <Route path="logs" element={<Logs />} />
      </Route>

      <Route path="/access" element={<Access />} />
    </Routes>
  );
}