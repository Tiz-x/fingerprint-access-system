import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Fingerprint, LogIn } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ApiError } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      navigate("/admin/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "That username or password is wrong." : err.message);
      } else {
        setError("Couldn't reach the access service. Check that it is running.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <aside className="login-brand">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark">
            <Fingerprint size={22} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div>
            <div className="brand-name">Fingerprint access</div>
            <div className="brand-sub">Administration</div>
          </div>
        </div>
        <div>
          <h2 className="login-statement">Only enrolled fingerprints open the door.</h2>
          <p className="login-note">
            Enroll people, review every attempt, and remove access the moment it is no longer needed.
          </p>
        </div>
        <span />
      </aside>

      <div className="login-form-wrap">
        <form className="login-form" onSubmit={handleSubmit}>
          <h1>Administrator sign in</h1>
          <p className="page-sub">Use the account you were given to manage access.</p>

          <label className="field">
            <span className="field-label">Username</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ paddingRight: "2.5rem", width: "100%" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  position: "absolute",
                  right: "0.5rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--muted)",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && (
            <div className="notice-bad" role="alert">
              {error}
            </div>
          )}

          <button className="btn btn-block" type="submit" disabled={busy}>
            <LogIn size={18} aria-hidden="true" />
            {busy ? "Signing in..." : "Sign in"}
          </button>

          <Link to="/access" className="login-back">
            Go to the access screen
          </Link>
        </form>
      </div>
    </div>
  );
}