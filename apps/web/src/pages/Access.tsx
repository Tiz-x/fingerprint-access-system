import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import { api, ApiError } from "../lib/api";

type Phase = "idle" | "scanning" | "granted" | "denied" | "error";

interface UnlockEvent {
  granted: true;
  userId: string;
  userName: string;
  score: number;
  unlockSeconds: number;
  timestamp: string;
}

interface DeniedEvent {
  granted: false;
  reason: string;
  timestamp: string;
}

export default function Access() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [userName, setUserName] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const relockTimer = useRef<number | null>(null);
  const tickTimer = useRef<number | null>(null);

  // Connect to Socket.IO once
  useEffect(() => {
    const socket = io("/", { path: "/socket.io" });
    socketRef.current = socket;

    socket.on("door:unlock", (evt: UnlockEvent) => {
      setUserName(evt.userName);
      setReason(null);
      setPhase("granted");
      setCountdown(evt.unlockSeconds);

      // Tick the countdown
      if (tickTimer.current) window.clearInterval(tickTimer.current);
      tickTimer.current = window.setInterval(() => {
        setCountdown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);

      // Relock after unlockSeconds
      if (relockTimer.current) window.clearTimeout(relockTimer.current);
      relockTimer.current = window.setTimeout(() => {
        setPhase("idle");
        setUserName(null);
        setCountdown(0);
        if (tickTimer.current) window.clearInterval(tickTimer.current);
      }, evt.unlockSeconds * 1000);
    });

    socket.on("door:denied", (evt: DeniedEvent) => {
      setReason(evt.reason);
      setPhase("denied");
      window.setTimeout(() => setPhase("idle"), 3000);
    });

    return () => {
      socket.disconnect();
      if (relockTimer.current) window.clearTimeout(relockTimer.current);
      if (tickTimer.current) window.clearInterval(tickTimer.current);
    };
  }, []);

  async function triggerScan() {
    if (phase !== "idle") return;
    setPhase("scanning");
    setReason(null);
    try {
      await api("/access/verify", { method: "POST", body: {}, auth: false });
      // Result comes via WebSocket; don't set phase here.
    } catch (err) {
      if (err instanceof ApiError) setReason(err.message);
      else setReason("Cannot reach API");
      setPhase("error");
      window.setTimeout(() => setPhase("idle"), 3000);
    }
  }

  const bg =
    phase === "granted"
      ? "linear-gradient(160deg, #052e16, #0f172a)"
      : phase === "denied" || phase === "error"
      ? "linear-gradient(160deg, #450a0a, #0f172a)"
      : "linear-gradient(160deg, #0f172a, #1e1b4b)";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: bg,
        transition: "background 0.4s",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        color: "white",
      }}
    >
      {phase === "idle" && (
        <>
          <div style={{ fontSize: 120, marginBottom: "1.5rem" }}>☝</div>
          <h1 style={{ margin: 0, fontSize: 42, fontWeight: 600 }}>
            Place finger on scanner
          </h1>
          <p style={{ color: "var(--muted)", marginTop: "1rem", fontSize: 18 }}>
            Access will be granted or denied automatically
          </p>
          <button
            onClick={triggerScan}
            style={{ marginTop: "3rem", padding: "1rem 2.5rem", fontSize: 18 }}
          >
            Simulate Scan
          </button>
          <Link
            to="/admin/login"
            style={{
              marginTop: "3rem",
              color: "var(--muted)",
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Admin login →
          </Link>
        </>
      )}

      {phase === "scanning" && (
        <>
          <div
            style={{
              fontSize: 120,
              marginBottom: "1.5rem",
              animation: "pulse 1.2s ease-in-out infinite",
            }}
          >
            ☝
          </div>
          <h1 style={{ margin: 0, fontSize: 42 }}>Scanning...</h1>
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 0.3; transform: scale(0.98); }
              50% { opacity: 1; transform: scale(1.02); }
            }
          `}</style>
        </>
      )}

      {phase === "granted" && (
        <>
          <div style={{ fontSize: 120, marginBottom: "1rem" }}>🔓</div>
          <h1
            style={{
              margin: 0,
              fontSize: 48,
              color: "var(--success)",
              fontWeight: 700,
            }}
          >
            Access Granted
          </h1>
          <p style={{ fontSize: 28, marginTop: "1rem", marginBottom: "2rem" }}>
            Welcome, {userName}
          </p>
          <div
            style={{
              fontSize: 20,
              color: "var(--muted)",
            }}
          >
            Door unlocks for {countdown}s
          </div>
          <div
            style={{
              marginTop: "2rem",
              width: 200,
              height: 8,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "var(--success)",
                width: `${(countdown / 5) * 100}%`,
                transition: "width 1s linear",
              }}
            />
          </div>
        </>
      )}

      {(phase === "denied" || phase === "error") && (
        <>
          <div style={{ fontSize: 120, marginBottom: "1rem" }}>🔒</div>
          <h1
            style={{
              margin: 0,
              fontSize: 48,
              color: "var(--danger)",
              fontWeight: 700,
            }}
          >
            Access Denied
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 20, marginTop: "1rem" }}>
            {reason === "NO_MATCH"
              ? "Fingerprint not recognized"
              : reason === "NO_TEMPLATES"
              ? "No users enrolled yet"
              : reason === "POOR_QUALITY"
              ? "Poor scan quality, try again"
              : reason ?? "Unknown error"}
          </p>
        </>
      )}
    </div>
  );
}