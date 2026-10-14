import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      navigate("/admin/users");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "Invalid credentials" : err.message);
      } else {
        setError("Network error. Is the API running?");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: "100%", maxWidth: 380 }}
      >
        <h1 style={{ margin: "0 0 0.5rem" }}>Admin Login</h1>
        <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: "1.5rem" }}>
          Fingerprint Access Control
        </p>

        <label style={{ display: "block", marginBottom: "1rem" }}>
          <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
            Username
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
          />
        </label>

        <label style={{ display: "block", marginBottom: "1.5rem" }}>
          <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
            Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid var(--danger)",
              color: "var(--danger)",
              padding: "0.6rem 0.8rem",
              borderRadius: 6,
              marginBottom: "1rem",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}