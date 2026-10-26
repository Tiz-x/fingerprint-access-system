import { useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleX, Download, RefreshCw, ScrollText, Search } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { formatDateTime, reasonText, type LogRow } from "../lib/format";

type Filter = "ALL" | "GRANTED" | "DENIED";

// Spreadsheet programs run text starting with = + - @ as formulas, so defuse those.
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function exportCsv(rows: LogRow[]) {
  const header = ["Time", "User", "Result", "Score", "Reason"];
  const lines = rows.map((l) =>
    [
      new Date(l.timestamp).toISOString(),
      l.user?.name ?? "",
      l.result,
      l.score === null ? "" : String(l.score),
      l.reason ?? "",
    ]
      .map(csvCell)
      .join(",")
  );
  const text = "\uFEFF" + [header.map(csvCell).join(","), ...lines].join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `access-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Logs() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ logs: LogRow[] }>("/logs");
        if (cancelled) return;
        setLogs(
          [...res.logs].sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        );
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load the log");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const shown = useMemo(() => {
    if (!logs) return null;
    const q = query.trim().toLowerCase();
    return logs.filter((l) => {
      if (filter === "GRANTED" && l.result !== "GRANTED") return false;
      if (filter === "DENIED" && l.result === "GRANTED") return false;
      if (q && !(l.user?.name ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [logs, filter, query]);

  const filters: { key: Filter; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "GRANTED", label: "Let in" },
    { key: "DENIED", label: "Denied" },
  ];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Access log</h1>
          <p className="page-sub">Every attempt at the door, newest first.</p>
        </div>
        <div className="toolbar-end">
          <button className="btn btn-quiet" onClick={() => setTick((t) => t + 1)}>
            <RefreshCw size={17} aria-hidden="true" />
            Refresh
          </button>
          <button
            className="btn"
            onClick={() => shown && exportCsv(shown)}
            disabled={!shown || shown.length === 0}
          >
            <Download size={17} aria-hidden="true" />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="notice-bad" role="alert">
          {error}
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="Filter by result">
            {filters.map((f) => (
              <button
                key={f.key}
                className={filter === f.key ? "is-on" : ""}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search by name"
              aria-label="Search the log by name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="hint num">
            Showing {shown?.length} of {logs.length}
          </span>
        </div>
      )}

      {logs === null && !error && <p className="loading">Loading...</p>}

      {logs && logs.length === 0 && (
        <div className="panel empty">
          <ScrollText size={28} aria-hidden="true" />
          <strong>No attempts recorded yet</strong>
          <span>Attempts from the access screen will appear here.</span>
        </div>
      )}

      {shown && logs && logs.length > 0 && (
        <div className="panel table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Result</th>
                <th>Match score</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="cell-muted">
                    Nothing matches these filters.
                  </td>
                </tr>
              )}
              {shown.map((l) => {
                const granted = l.result === "GRANTED";
                return (
                  <tr key={l.id}>
                    <td className="cell-muted num">{formatDateTime(l.timestamp)}</td>
                    <td>{l.user?.name ?? <span className="cell-muted">Unknown</span>}</td>
                    <td>
                      <span className={`chip ${granted ? "chip-ok" : "chip-bad"}`}>
                        {granted ? (
                          <CircleCheck size={14} aria-hidden="true" />
                        ) : (
                          <CircleX size={14} aria-hidden="true" />
                        )}
                        {granted ? "Let in" : "Denied"}
                      </span>
                    </td>
                    <td className="cell-muted num">{l.score ?? "n/a"}</td>
                    <td className="cell-muted">{granted ? "" : reasonText(l.reason)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}