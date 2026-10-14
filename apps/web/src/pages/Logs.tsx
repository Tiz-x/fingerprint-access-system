import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";

interface LogRow {
  id: string;
  timestamp: string;
  userId: string | null;
  result: string;
  score: number | null;
  reason: string | null;
  user: { id: string; name: string } | null;
}

export default function Logs() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ logs: LogRow[] }>("/logs");
        if (!cancelled) {
          setLogs(res.logs);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load logs");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Access Logs</h1>

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

      {logs === null && !error && (
        <p style={{ color: "var(--muted)" }}>Loading...</p>
      )}

      {logs && logs.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--muted)", margin: 0 }}>
            No access attempts recorded yet.
          </p>
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0b1220", textAlign: "left" }}>
                <th style={th}>Time</th>
                <th style={th}>User</th>
                <th style={th}>Result</th>
                <th style={th}>Score</th>
                <th style={th}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 14 }}>
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                  <td style={td}>{l.user?.name ?? "—"}</td>
                  <td style={td}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.2rem 0.6rem",
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 600,
                        background:
                          l.result === "GRANTED"
                            ? "rgba(34,197,94,0.15)"
                            : "rgba(239,68,68,0.15)",
                        color:
                          l.result === "GRANTED"
                            ? "var(--success)"
                            : "var(--danger)",
                      }}
                    >
                      {l.result}
                    </span>
                  </td>
                  <td style={{ ...td, color: "var(--muted)" }}>
                    {l.score ?? "—"}
                  </td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 14 }}>
                    {l.reason ?? "—"}
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