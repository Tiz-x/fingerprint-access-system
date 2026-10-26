import type {
  BridgeClient,
  BridgeErrorCode,
  CaptureResult,
  EnrollResult,
  IdentifyResult,
  HealthResult,
} from "./types.js";

const BASE_URL = process.env.BRIDGE_URL ?? "http://127.0.0.1:8765";
const SECRET = process.env.BRIDGE_SECRET ?? "super-secret-bridge-key";

type Raw = { ok?: boolean; error?: string; [key: string]: any };

async function call(
  path: string,
  method: "GET" | "POST",
  body: unknown,
  timeoutMs: number
): Promise<Raw> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Bridge-Secret": SECRET },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return await res.json().catch(() => ({ ok: false, error: "BAD_RESPONSE" }));
  } catch (err: any) {
    if (err?.name === "TimeoutError") return { ok: false, error: "BRIDGE_TIMEOUT" };
    return { ok: false, error: "BRIDGE_UNREACHABLE" };
  }
}

// Translate the C# bridge's error strings into the codes the rest of the API uses.
function mapError(code?: string): BridgeErrorCode {
  const c = code ?? "";
  if (c === "TIMEOUT_NO_FINGER") return "NO_FINGER";
  if (c === "WORKER_TIMEOUT" || c === "BRIDGE_TIMEOUT") return "TIMEOUT";
  if (c.startsWith("POOR_QUALITY")) return "POOR_QUALITY";
  if (c === "DEVICE_NOT_FOUND" || c.startsWith("OPEN_FAILED")) return "DEVICE_NOT_FOUND";
  if (c === "BRIDGE_UNREACHABLE") return "BRIDGE_UNREACHABLE";
  console.warn(`[bridge] unmapped error from bridge: ${c}`);
  return "BRIDGE_ERROR";
}

export const realBridge: BridgeClient = {
  async capture(): Promise<CaptureResult> {
    // A person has to press a finger, so allow 45 s.
    const r = await call("/capture", "POST", {}, 45_000);
    if (!r.ok) return { ok: false, error: mapError(r.error) };
    // The bridge only returns captures it judged GOOD quality.
    return { ok: true, fmd: r.fmd, quality: 100 };
  },

  async enroll(scans: number): Promise<EnrollResult> {
    // Each scan can take up to ~40 s including the pause between scans.
    const r = await call("/enroll", "POST", { scans }, scans * 40_000 + 10_000);
    if (!r.ok) return { ok: false, error: mapError(r.error) };
    return { ok: true, fmd: r.fmd, scansUsed: r.scansUsed ?? scans };
  },

  async identify(probe, candidates): Promise<IdentifyResult> {
    const r = await call("/identify", "POST", { probe, candidates }, 20_000);
    if (!r.ok) {
      if (r.error === "INVALID_FMD") return { ok: false, error: "INVALID_FMD" };
      if (r.error === "BRIDGE_UNREACHABLE") return { ok: false, error: "BRIDGE_UNREACHABLE" };
      return { ok: false, error: "BRIDGE_ERROR" };
    }
    return { ok: true, match: r.match ?? null };
  },

  async health(): Promise<HealthResult> {
    const r = await call("/health", "GET", undefined, 10_000);
    if (!r.ok) return { ok: true, deviceConnected: false, sdkVersion: "bridge-offline" };
    return { ok: true, deviceConnected: !!r.deviceConnected, sdkVersion: String(r.sdkVersion ?? "unknown") };
  },
};