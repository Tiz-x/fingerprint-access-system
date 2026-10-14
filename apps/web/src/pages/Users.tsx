import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";

interface User {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ users: User[] }>("/users");
        if (!cancelled) {
          setUsers(res.users);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load users");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(user: User) {
    const ok = window.confirm(
      `Delete "${user.name}"? Their fingerprint templates will also be deleted.`
    );
    if (!ok) return;

    setDeleting(user.id);
    try {
      await api(`/users/${user.id}`, { method: "DELETE" });
      setUsers((prev) => prev?.filter((u) => u.id !== user.id) ?? null);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Delete failed");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1 style={{ margin: 0 }}>Users</h1>
        <Link to="/admin/enroll">
          <button>+ Enroll User</button>
        </Link>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid var(--danger)",
            color: "var(--danger)",
            padding: "0.6rem 0.8rem",
            borderRadius: 6,
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {users === null && !error && (
        <p style={{ color: "var(--muted)" }}>Loading...</p>
      )}

      {users && users.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            No users enrolled yet.
          </p>
          <Link
            to="/admin/enroll"
            style={{ display: "inline-block", marginTop: "1rem" }}
          >
            <button>Enroll the first user</button>
          </Link>
        </div>
      )}

      {users && users.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0b1220", textAlign: "left" }}>
                <th style={th}>Name</th>
                <th style={th}>Role</th>
                <th style={th}>Enrolled</th>
                <th style={{ ...th, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={td}>{u.name}</td>
                  <td style={{ ...td, color: "var(--muted)" }}>{u.role}</td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 14 }}>
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      className="danger"
                      onClick={() => handleDelete(u)}
                      disabled={deleting === u.id}
                    >
                      {deleting === u.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "0.75rem 1rem",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--muted)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const td: React.CSSProperties = {
  padding: "0.75rem 1rem",
  fontSize: 15,
};