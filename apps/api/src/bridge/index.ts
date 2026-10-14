import { fakeBridge } from "./fakeBridge.js";
import type { BridgeClient } from "./types.js";

const useReal = process.env.USE_REAL_BRIDGE === "true";

// Real bridge client will be added in Phase 4.
export const bridge: BridgeClient = useReal
  ? (() => {
      throw new Error("Real bridge not implemented yet. Set USE_REAL_BRIDGE=false.");
    })()
  : fakeBridge;