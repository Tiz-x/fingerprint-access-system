import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { CircleCheck, CircleX, RefreshCw } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { describeLog, formatDateTime, type LogRow } from "../lib/format";

interface Health {
  deviceConnected: boolean;
  sdkVersion: string;
}
type HealthState = Health | "checking" | "api-down";
type Light = "ok" | "down" | "checking";

function StatusRow({ label, detail, light }: { label: string; detail: string; light: Light }) {
  const tone = light === "ok" ? "ok" : light === "down" ? "bad" : "neutral";
  const word = light === "ok" ? "Working" : light === "down" ? "Not responding" : "Checking";
  return (
    <li>
      <div>
        <div className="status-label">{label}</div>
        <div className="hint">{detail}</div>
      </div>
      <span className={`chip chip-${tone}`}>{word}</span>
    </li>
  );
}

export default function Dashboard() {
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [today, setToday] = useState({ granted: 0, denied: 0 });
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [health, setHealth] = useState<HealthState>("checking");
  const [healthTick, setHealthTick] = useState(0);

  // Load users and recent attempts. Re-runs whenever something happens at the door.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [l, u] = await Promise.all([
          api<{ logs: LogRow[] }>("/logs"),
          api<{ users: { id: string }[] }>("/users"),
        ]);
        if (cancelled) return;
        const sorted = [...l.logs].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        const todays = sorted.filter((x) => new Date(x.timestamp) >= midnight);
        setLogs(sorted);
        setUserCount(u.users.length);
        setToday({
          granted: todays.filter((x) => x.result === "GRANTED").length,
          denied: todays.filter((x) => x.result !== "GRANTED").length,
        });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't load the dashboard");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // Live updates from the access screen
  useEffect(() => {
    const socket = io("/", { path: "/socket.io" });
    const bump = () => setTick((t) => t + 1);
    socket.on("door:unlock", bump);
    socket.on("door:denied", bump);
    return () => {
      socket.disconnect();
    };
  }, []);

  // Scanner health: checked on load and when you press "Check again"
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<Health>("/bridge/health", { auth: false });
        if (!cancelled) setHealth(res);
      } catch {
        if (!cancelled) setHealth("api-down");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [healthTick]);

  const apiLight: Light = health === "checking" ? "checking" : health === "api-down" ? "down" : "ok";
  const bridgeLight: Light =
    typeof health === "string"
      ? health === "checking" ? "checking" : "down"
      : health.sdkVersion === "bridge-offline" ? "down" : "ok";
  const readerLight: Light =
    typeof health === "string"
      ? health === "checking" ? "checking" : "down"
      : health.deviceConnected ? "ok" : "down";

  const recent = logs?.slice(0, 8) ?? [];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">What is happening at the door right now.</p>
        </div>
      </div>

      {error && (
        <div className="notice-bad" role="alert">
          {error}
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Enrolled users</div>
          <div className="stat-value">{userCount ?? "-"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Let in today</div>
          <div className="stat-value ok">{logs ? today.granted : "-"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Denied today</div>
          <div className="stat-value bad">{logs ? today.denied : "-"}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Scanner</div>
          <div className={`stat-value ${readerLight === "ok" ? "ok" : readerLight === "down" ? "bad" : ""}`}>
            {readerLight === "ok" ? "Ready" : readerLight === "down" ? "Offline" : "..."}
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <section className="panel" aria-labelledby="recent-title">
          <div className="panel-head">
            <span id="recent-title">Recent activity</span>
            <Link to="/admin/logs" className="btn btn-quiet btn-sm">
              Open the full log
            </Link>
          </div>
          {logs === null && !error && <p className="loading">Loading...</p>}
          {logs && recent.length === 0 && (
            <div className="empty">
              <strong>No attempts yet</strong>
              <span>Open the access screen and scan a finger. It will show up here.</span>
            </div>
          )}
          {recent.length > 0 && (
            <ul className="feed">
              {recent.map((l) => {
                const granted = l.result === "GRANTED";
                return (
                  <li key={l.id}>
                    {granted ? (
                      <CircleCheck className="feed-icon ok" size={20} aria-label="Let in" />
                    ) : (
                      <CircleX className="feed-icon bad" size={20} aria-label="Denied" />
                    )}
                    <div className="feed-main">
                      <div>{describeLog(l)}</div>
                      {l.score !== null && <div className="hint num">Match score {l.score}</div>}
                    </div>
                    <time className="feed-time" dateTime={l.timestamp}>
                      {formatDateTime(l.timestamp)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="system-title">
          <div className="panel-head">
            <span id="system-title">System</span>
          </div>
          <ul className="status-list">
            <StatusRow
              label="Access service"
              detail="Handles sign in, users and decisions"
              light={apiLight}
            />
            <StatusRow
              label="Scanner bridge"
              detail={apiLight === "down" ? "Can't be checked while the service is down" : "Program that talks to the scanner"}
              light={bridgeLight}
            />
            <StatusRow
              label="Fingerprint reader"
              detail={apiLight === "down" ? "Can't be checked while the service is down" : "The USB device on this computer"}
              light={readerLight}
            />
          </ul>
          <div className="panel-foot">
            <button
              className="btn btn-quiet btn-sm"
              onClick={() => {
                setHealth("checking");
                setHealthTick((t) => t + 1);
              }}
            >
              <RefreshCw size={16} aria-hidden="true" />
              Check again
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}