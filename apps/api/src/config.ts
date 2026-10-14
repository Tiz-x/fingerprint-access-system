import "dotenv/config";

/**
 * Maximum dissimilarity score that still counts as a match.
 * Lower score = better match. Anything above this = DENIED.
 *
 * The bridge returns a dissimilarity value; the actual scale depends on
 * which SDK version is used. 25000 is a reasonable starting point for the
 * DigitalPersona SDK's default threshold. Tune this in Phase 7 with real
 * tests once you have the hardware.
 */
export const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD ?? 25000);

export const UNLOCK_SECONDS = Number(process.env.UNLOCK_SECONDS ?? 5);