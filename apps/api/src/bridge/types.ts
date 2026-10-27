export type BridgeErrorCode =
  | "NO_FINGER"
  | "POOR_QUALITY"
  | "DEVICE_NOT_FOUND"
  | "TIMEOUT"
  | "BRIDGE_UNREACHABLE"
  | "BRIDGE_ERROR";

export type CaptureResult =
  | { ok: true; fmd: string; quality: number }
  | { ok: false; error: BridgeErrorCode };

export type EnrollResult =
  | { ok: true; fmd: string; scansUsed: number }
  | { ok: false; error: BridgeErrorCode | "SCANS_MISMATCH" };

export type IdentifyResult =
  | { ok: true; match: { userId: string; score: number } | null }
  | { ok: false; error: "INVALID_FMD" | "DEVICE_NOT_FOUND" | "BRIDGE_UNREACHABLE" | "BRIDGE_ERROR" };

export type HealthResult = {
  ok: true;
  deviceConnected: boolean;
  sdkVersion: string;
};

export interface BridgeClient {
  capture(): Promise<CaptureResult>;
  enroll(scans: number): Promise<EnrollResult>;
  identify(probe: string, candidates: { userId: string; fmd: string }[]): Promise<IdentifyResult>;
  health(): Promise<HealthResult>;
  cancelScan(): Promise<void>;
}