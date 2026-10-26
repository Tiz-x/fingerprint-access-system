import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Trash2, UserPlus, Users as UsersIcon } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { formatDateTime } from "../lib/format";

interface User {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
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
        setError(err instanceof ApiError ? err.message : "Couldn't load users");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!users) return null;
    return q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users;
  }, [users, query]);

  async function handleDelete(user: User) {
    setDeleting(user.id);
    try {
      await api(`/users/${user.id}`, { method: "DELETE" });
      setUsers((prev) => prev?.filter((u) => u.id !== user.id) ?? null);
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't delete that user");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Users</h1>
          <p className="page-sub">People whose fingerprints can open the door.</p>
        </div>
        <Link to="/admin/enroll" className="btn">
          <UserPlus size={18} aria-hidden="true" />
          Enroll a user
        </Link>
      </div>

      {error && (
        <div className="notice-bad" role="alert">
          {error}
        </div>
      )}

      {users && users.length > 0 && (
        <div className="toolbar">
          <div className="search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by name"
              aria-label="Search users by name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="hint num">
            {shown?.length} of {users.length}
          </span>
        </div>
      )}

      {users === null && !error && <p className="loading">Loading...</p>}

      {users && users.length === 0 && (
        <div className="panel empty">
          <UsersIcon size={28} aria-hidden="true" />
          <strong>No one is enrolled yet</strong>
          <span>Enroll the first person to let them through the door.</span>
          <Link to="/admin/enroll" className="btn">
            Enroll the first user
          </Link>
        </div>
      )}

      {shown && users && users.length > 0 && (
        <div className="panel table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Enrolled</th>
                <th className="cell-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={4} className="cell-muted">
                    No one matches "{query}".
                  </td>
                </tr>
              )}
              {shown.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>
                    <span className="chip chip-neutral" style={{ textTransform: "capitalize" }}>
                      {u.role}
                    </span>
                  </td>
                  <td className="cell-muted num">{formatDateTime(u.createdAt)}</td>
                  <td className="cell-right">
                    {confirmId === u.id ? (
                      <span style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
                        <span className="hint">Delete them and their fingerprint?</span>
                        <button className="btn btn-quiet btn-sm" onClick={() => setConfirmId(null)}>
                          Keep
                        </button>
                        <button
                          className="btn btn-danger-solid btn-sm"
                          onClick={() => handleDelete(u)}
                          disabled={deleting === u.id}
                        >
                          {deleting === u.id ? "Deleting..." : "Delete"}
                        </button>
                      </span>
                    ) : (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setConfirmId(u.id)}
                        aria-label={`Delete ${u.name}`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        Delete
                      </button>
                    )}
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