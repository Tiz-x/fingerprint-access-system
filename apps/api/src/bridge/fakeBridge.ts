import { randomBytes, randomUUID } from "node:crypto";
import type {
  BridgeClient,
  CaptureResult,
  EnrollResult,
  IdentifyResult,
  HealthResult,
} from "./types.js";

// In-memory: probe string -> userId, so identify() can pretend to match.
const probeToUser = new Map<string, string>();

function makeFmd(): string {
  return randomBytes(256).toString("base64");
}

export const fakeBridge: BridgeClient = {
  async capture(): Promise<CaptureResult> {
    // 90% success, 10% simulated bad scan.
    if (Math.random() < 0.1) {
      return { ok: false, error: "POOR_QUALITY" };
    }
    const fmd = makeFmd();
    // Remember this probe so identify() has something to match.
    const fakeUserId = `probe-${randomUUID()}`;
    probeToUser.set(fmd, fakeUserId);
    return { ok: true, fmd, quality: 80 + Math.floor(Math.random() * 20) };
  },

  async enroll(scans: number): Promise<EnrollResult> {
    if (scans < 1 || scans > 10) {
      return { ok: false, error: "POOR_QUALITY" };
    }
    const fmd = makeFmd();
    return { ok: true, fmd, scansUsed: scans };
  },

  async identify(
    probe: string,
    candidates: { userId: string; fmd: string }[]
  ): Promise<IdentifyResult> {
    if (!probe || probe.length < 8) {
      return { ok: false, error: "INVALID_FMD" };
    }
    // Pretend: if any candidate's fmd is in our fake map with matching user, match it.
    for (const c of candidates) {
      if (probe === c.fmd) {
        return { ok: true, match: { userId: c.userId, score: 100 + Math.floor(Math.random() * 500) } };
      }
    }
    // Otherwise, pick the first candidate with a fake score (simulates best-match behavior).
    if (candidates.length > 0) {
      return {
        ok: true,
        match: {
          userId: candidates[0].userId,
          score: 800 + Math.floor(Math.random() * 1200),
        },
      };
    }
    return { ok: true, match: null };
  },

  async health(): Promise<HealthResult> {
    return { ok: true, deviceConnected: true, sdkVersion: "fake-1.0.0" };
  },

  async cancelScan(): Promise<void> {
    // No-op for the fake bridge.
  },
};