import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Fingerprint,
  Lock,
  LockOpen,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { api, ApiError } from "../lib/api";

type View =
  | { kind: "ready" }
  | { kind: "granted"; name: string; seconds: number }
  | { kind: "denied" }
  | { kind: "unclear" }
  | { kind: "empty" }
  | { kind: "offline"; detail: string };

type Tone = "idle" | "ok" | "bad" | "warn" | "off";

interface VerifyResponse {
  granted: boolean;
  reason?: string;
  user?: { id: string; name: string };
  unlockSeconds?: number;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Tells the bridge to stop waiting for a finger and close the small scanner window.
function releaseScanner() {
  void fetch("/api/access/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    keepalive: true, // lets the request finish even while the page is closing
  }).catch(() => {});
}

// Open /access?preview=granted (or denied, unclear, empty, offline, ready)
// to look at a screen without scanning anything.
const PREVIEWS: Record<string, View> = {
  ready: { kind: "ready" },
  granted: { kind: "granted", name: "Amina Okafor", seconds: 5 },
  denied: { kind: "denied" },
  unclear: { kind: "unclear" },
  empty: { kind: "empty" },
  offline: { kind: "offline", detail: "The scanner bridge isn't running on this computer." },
};
const previewKey = new URLSearchParams(window.location.search).get("preview");
const PREVIEW: View | undefined = previewKey ? PREVIEWS[previewKey] : undefined;

const OFFLINE_DETAIL: Record<string, string> = {
  BRIDGE_UNREACHABLE: "The scanner bridge isn't running on this computer.",
  DEVICE_NOT_FOUND: "Plug the fingerprint reader into a USB port.",
  BRIDGE_ERROR: "The reader reported an error.",
};

const GLYPH: Record<Tone, LucideIcon> = {
  idle: Fingerprint,
  ok: Check,
  bad: X,
  warn: CircleAlert,
  off: TriangleAlert,
};

const LED_TEXT: Record<Tone, string> = {
  idle: "Ready",
  ok: "Unlocked",
  bad: "Denied",
  warn: "Try again",
  off: "Offline",
};

function toneOf(v: View): Tone {
  switch (v.kind) {
    case "granted":
      return "ok";
    case "denied":
      return "bad";
    case "unclear":
    case "empty":
      return "warn";
    case "offline":
      return "off";
    default:
      return "idle";
  }
}

function describe(v: View): { title: string; sub: string } {
  switch (v.kind) {
    case "granted":
      return {
        title: `Welcome, ${v.name}`,
        sub: "Come in. The door locks again by itself.",
      };
    case "denied":
      return {
        title: "Fingerprint not recognized",
        sub: "Try again. If it keeps failing, ask an administrator to enroll you.",
      };
    case "unclear":
      return {
        title: "That scan wasn't clear",
        sub: "Press your finger flat on the glass and hold still for a moment.",
      };
    case "empty":
      return {
        title: "No one is enrolled yet",
        sub: "An administrator needs to enroll people before the door can open.",
      };
    case "offline":
      return { title: "Reader not available", sub: v.detail };
    default:
      return {
        title: "Place your finger on the reader",
        sub: "The door unlocks when your fingerprint is recognized.",
      };
  }
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="clock">
      <time className="clock-time num" dateTime={now.toISOString()}>
        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </time>
      <span className="clock-date">
        {now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
      </span>
    </div>
  );
}

function Countdown({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const t = window.setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="countdown">
      <p>Locks again in {left} s</p>
      <div className="countdown-bar">
        <div className="countdown-fill" style={{ animationDuration: `${seconds}s` }} />
      </div>
    </div>
  );
}

export default function Access() {
  const [view, setView] = useState<View>(PREVIEW ?? { kind: "ready" });
  const mounted = useRef(false);
  const running = useRef(false);
  const navigate = useNavigate();

  function goBack() {
    mounted.current = false;
    releaseScanner();
    navigate("/admin");
  }

  async function runLoop() {
    while (mounted.current) {
      let pause: number;
      try {
        const res = await api<VerifyResponse>("/access/verify", {
          method: "POST",
          body: {},
          auth: false,
        });
        if (!mounted.current) break;

        if (res.granted) {
          const seconds = res.unlockSeconds ?? 5;
          setView({ kind: "granted", name: res.user?.name ?? "", seconds });
          pause = seconds * 1000 + 600;
        } else {
          switch (res.reason) {
            case "NO_FINGER":
            case "TIMEOUT":
              setView({ kind: "ready" }); // nobody there, listen again
              pause = 300;
              break;
            case "POOR_QUALITY":
              setView({ kind: "unclear" });
              pause = 2500;
              break;
            case "NO_TEMPLATES":
              setView({ kind: "empty" });
              pause = 6000;
              break;
            case "BRIDGE_UNREACHABLE":
            case "DEVICE_NOT_FOUND":
            case "BRIDGE_ERROR":
              setView({ kind: "offline", detail: OFFLINE_DETAIL[res.reason] ?? "" });
              pause = 5000;
              break;
            default:
              setView({ kind: "denied" });
              pause = 3500;
          }
        }
      } catch (err) {
        if (!mounted.current) break;
        setView({
          kind: "offline",
          detail:
            err instanceof ApiError ? err.message : "The access service isn't responding.",
        });
        pause = 5000;
      }

      await sleep(pause);
      if (!mounted.current) break;
      setView((v) => (v.kind === "offline" ? v : { kind: "ready" }));
    }
  }

  useEffect(() => {
    if (PREVIEW) return; // preview mode never touches the scanner
    mounted.current = true;
    if (!running.current) {
      running.current = true;
      void runLoop();
    }
    window.addEventListener("pagehide", releaseScanner);
    return () => {
      mounted.current = false;
      window.removeEventListener("pagehide", releaseScanner);
      releaseScanner();
    };
  }, []);

  const tone = toneOf(view);
  const { title, sub } = describe(view);
  const Glyph = GLYPH[tone];
  const unlocked = view.kind === "granted";

  return (
    <div className="kiosk" data-tone={tone}>
      <div className="kiosk-left">
        <header className="kiosk-top">
          <div className="kiosk-brand">
            <span className="kiosk-brand-mark">
              <Fingerprint size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
            Door access
          </div>
          <Clock />
        </header>

        <section className="kiosk-copy" aria-live="polite">
          <span className="lock-pill">
            {unlocked ? (
              <LockOpen size={16} aria-hidden="true" />
            ) : (
              <Lock size={16} aria-hidden="true" />
            )}
            {unlocked ? "Door unlocked" : "Door locked"}
          </span>
          <h1 className="kiosk-title">{title}</h1>
          <p className="kiosk-sub">{sub}</p>
          {view.kind === "granted" && <Countdown seconds={view.seconds} />}
        </section>

        <footer className="kiosk-foot">
          <button type="button" className="kiosk-back" onClick={goBack}>
            <ArrowLeft size={18} aria-hidden="true" />
            Back to administration
          </button>
        </footer>
      </div>

      <div className="kiosk-wall" aria-hidden="true">
        <div className="device">
          <div className="device-status">
            <span className="device-led" />
            {LED_TEXT[tone]}
          </div>
          <div className="sensor">
            <span className="sensor-ring sensor-ring-a" />
            <span className="sensor-ring sensor-ring-b" />
            <span className="sensor-face">
              <Glyph size={72} strokeWidth={1.1} />
            </span>
          </div>
          <div className="device-slot" />
        </div>
      </div>
    </div>
  );
}