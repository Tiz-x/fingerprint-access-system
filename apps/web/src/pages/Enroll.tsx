import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";

type Phase = "form" | "scanning" | "done" | "error";

interface CreatedUser {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function Enroll() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [role, setRole] = useState("user");
  const [scans, setScans] = useState(4);

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedUser | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setPhase("scanning");
    setError(null);

    try {
      const res = await api<{ user: CreatedUser; scansUsed: number }>(
        "/users/enroll",
        {
          method: "POST",
          body: { name: name.trim(), role, scans },
        }
      );
      setCreated(res.user);
      setPhase("done");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Enrollment failed. Is the API running?");
      }
      setPhase("error");
    }
  }

  function reset() {
    setName("");
    setRole("user");
    setScans(4);
    setCreated(null);
    setError(null);
    setPhase("form");
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Enroll User</h1>

      {phase === "form" && (
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{ maxWidth: 480 }}
        >
          <label style={{ display: "block", marginBottom: "1rem" }}>
            <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
              Full name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alice Smith"
              autoFocus
              required
            />
          </label>

          <label style={{ display: "block", marginBottom: "1rem" }}>
            <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
              Role
            </span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <label style={{ display: "block", marginBottom: "1.5rem" }}>
            <span style={{ display: "block", marginBottom: 4, fontSize: 14 }}>
              Number of scans ({scans})
            </span>
            <input
              type="range"
              min={1}
              max={10}
              value={scans}
              onChange={(e) => setScans(Number(e.target.value))}
            />
            <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              More scans = stronger template. 4 is a good balance.
            </div>
          </label>

          <button type="submit" disabled={!name.trim()}>
            Start Enrollment
          </button>
        </form>
      )}

      {phase === "scanning" && (
        <div
          className="card"
          style={{
            maxWidth: 480,
            textAlign: "center",
            padding: "3rem 2rem",
          }}
        >
          <div
            style={{
              fontSize: 56,
              marginBottom: "1rem",
              animation: "pulse 1.2s ease-in-out infinite",
            }}
          >
            ☝
          </div>
          <h2 style={{ margin: "0 0 0.5rem" }}>Place finger on scanner</h2>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Capturing {scans} scan{scans === 1 ? "" : "s"} for {name}...
          </p>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.4; }
              50% { opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {phase === "done" && created && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div
            style={{
              display: "inline-block",
              background: "rgba(34,197,94,0.15)",
              color: "var(--success)",
              padding: "0.3rem 0.7rem",
              borderRadius: 6,
              fontSize: 13,
              marginBottom: "1rem",
            }}
          >
            Enrolled
          </div>
          <h2 style={{ margin: "0 0 0.5rem" }}>{created.name}</h2>
          <p style={{ color: "var(--muted)", marginTop: 0 }}>
            Role: {created.role}
          </p>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            ID: <code>{created.id}</code>
          </p>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem" }}>
            <button onClick={() => navigate("/admin/users")}>
              Back to Users
            </button>
            <button className="secondary" onClick={reset}>
              Enroll Another
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div
            style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid var(--danger)",
              color: "var(--danger)",
              padding: "0.8rem 1rem",
              borderRadius: 6,
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            Check that the API and scanner bridge are running, then try again.
          </p>
          <button className="secondary" onClick={reset}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}