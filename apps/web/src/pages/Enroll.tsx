import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CircleCheck, Fingerprint } from "lucide-react";
import { api, ApiError } from "../lib/api";

type Phase = "form" | "scanning" | "done" | "error";

interface CreatedUser {
  id: string;
  name: string;
  role: string;
  createdAt: string;
}

function explain(err: unknown): string {
  if (!(err instanceof ApiError)) return "Couldn't reach the access service. Check that it is running.";
  const reason = (err.data as { reason?: string } | null)?.reason;
  switch (reason) {
    case "NO_FINGER":
    case "TIMEOUT":
      return "No finger was detected in time. Press your finger on the scanner as soon as the scanner window appears.";
    case "POOR_QUALITY":
      return "One of the scans was too unclear. Press flat and firmly, and keep the finger still.";
    case "BRIDGE_UNREACHABLE":
      return "The scanner bridge isn't running on this computer. Start it, then try again.";
    case "DEVICE_NOT_FOUND":
      return "The fingerprint reader isn't connected. Plug it into a USB port and try again.";
    case "ALREADY_ENROLLED": {
      const who = (err.data as { existingName?: string } | null)?.existingName;
      return who
        ? `This fingerprint is already enrolled as ${who}. Each finger can belong to only one person. Use a different finger, or delete ${who} first.`
        : "This fingerprint is already enrolled. Each finger can belong to only one person.";
    }
    case "DUPLICATE_FINGER_IN_BATCH": {
      return err.message;
    }
    default:
      return err.message;
  }
}

export default function Enroll() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [role, setRole] = useState("user");

  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedUser | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== "scanning") return;
    const start = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Ensure at least two words (First and Last name)
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) {
      setError("Please enter a full name (First and Last name).");
      setPhase("error");
      return;
    }

    setElapsed(0);
    setError(null);
    setPhase("scanning");

    try {
      const res = await api<{ user: CreatedUser; scansUsed: number }>("/users/enroll", {
        method: "POST",
        body: { name: name.trim(), role },
      });
      setCreated(res.user);
      setPhase("done");
    } catch (err) {
      setError(explain(err));
      setPhase("error");
    }
  }

  function reset() {
    setName("");
    setRole("user");
    setCreated(null);
    setError(null);
    setPhase("form");
  }

  return (
    <div className="enroll-wrap">
      <div className="page-head">
        <div>
          <h1>Enroll a user</h1>
          <p className="page-sub">Scan a finger so this person can open the door.</p>
        </div>
      </div>

      {phase === "form" && (
        <form className="panel panel-body" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Full name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="For example, Amina Okafor"
              maxLength={100}
              autoFocus
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </label>

          <div className="field">
            <span className="field-label">Capture Process</span>
            <p className="hint" style={{ marginTop: "0.25rem", marginBottom: "1.25rem" }}>
              For security, the system will prompt you to scan <strong>all 10 fingers</strong> one by one. This ensures the person's full biometric profile is registered.
            </p>
          </div>

          <p className="hint" style={{ marginBottom: "1.25rem" }}>
            Close the access screen on this computer first. It keeps the scanner busy and can steal a scan.
          </p>

          <button className="btn" type="submit" disabled={!name.trim()}>
            <Fingerprint size={18} aria-hidden="true" />
            Start scanning
          </button>
        </form>
      )}

      {phase === "scanning" && (
        <div className="panel panel-body" aria-live="polite">
          <div className="scan-head">
            <Fingerprint size={44} strokeWidth={1.25} className="pulse" aria-hidden="true" />
            <div>
              <h2>Scanning {name}</h2>
              <p className="hint num">
                10 scans, {elapsed} s elapsed
              </p>
            </div>
          </div>
          <ol className="steps">
            <li>A small "Scanner ready" window appears in the bottom-right corner of the screen.</li>
            <li>Place your <strong>Right Thumb</strong> on the glass, hold for 2 seconds, then lift.</li>
            <li>Place your <strong>Right Index</strong> finger, then lift.</li>
            <li>Place your <strong>Right Middle</strong> finger, then lift.</li>
            <li>Place your <strong>Right Ring</strong> finger, then lift.</li>
            <li>Place your <strong>Right Pinky</strong> finger, then lift.</li>
            <li>Place your <strong>Left Thumb</strong> on the glass, then lift.</li>
            <li>Place your <strong>Left Index</strong> finger, then lift.</li>
            <li>Place your <strong>Left Middle</strong> finger, then lift.</li>
            <li>Place your <strong>Left Ring</strong> finger, then lift.</li>
            <li>Place your <strong>Left Pinky</strong> finger, then lift. Done.</li>
          </ol>
        </div>
      )}

      {phase === "done" && created && (
        <div className="panel panel-body">
          <div className="done-head">
            <CircleCheck size={22} aria-hidden="true" />
            {created.name} is enrolled
          </div>
          <dl className="kv">
            <dt>Role</dt>
            <dd style={{ textTransform: "capitalize" }}>{created.role}</dd>
            <dt>ID</dt>
            <dd className="num">{created.id}</dd>
          </dl>
          <div className="actions">
            <button className="btn" onClick={() => navigate("/admin/users")}>
              View users
            </button>
            <button className="btn btn-quiet" onClick={reset}>
              Enroll another person
            </button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="panel panel-body">
          <div className="notice-bad" role="alert">
            {error}
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn" onClick={() => setPhase("form")}>
              Try again
            </button>
            <Link to="/admin/users" className="btn btn-quiet">
              Back to users
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}