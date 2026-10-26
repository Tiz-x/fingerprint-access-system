import { fakeBridge } from "./fakeBridge.js";
import { realBridge } from "./realBridge.js";
import type { BridgeClient } from "./types.js";

const useReal = process.env.USE_REAL_BRIDGE === "true";

export const bridge: BridgeClient = useReal ? realBridge : fakeBridge;