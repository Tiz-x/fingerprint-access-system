import { prisma } from "./db.js";
import { bridge } from "./bridge/index.js";
import { decryptTemplate } from "./crypto/templates.js";
import { MATCH_THRESHOLD } from "./config.js";

export interface Duplicate {
  userId: string;
  name: string;
  score: number;
}

/**
 * Compares a fingerprint against every enrolled template.
 * Returns the person it already belongs to, or null if it is new.
 * Throws if the check itself fails, so we never enroll on a failed check.
 */
export async function findDuplicate(probeFmd: string): Promise<Duplicate | null> {
  const rows = await prisma.template.findMany({
    include: { user: { select: { id: true, name: true } } },
  });
  if (rows.length === 0) return null;

  const candidates = rows.map((r) => ({
    userId: r.user.id,
    fmd: decryptTemplate({ ciphertext: r.fmd, iv: r.iv, authTag: r.authTag }),
  }));

  const res = await bridge.identify(probeFmd, candidates);
  if (!res.ok) throw new Error(`Duplicate check failed: ${res.error}`);
  if (!res.match) return null;

  // Same rule as the access screen: a score at or below the threshold is a match.
  if (res.match.score > MATCH_THRESHOLD) return null;

  const owner = rows.find((r) => r.user.id === res.match!.userId)?.user;
  if (!owner) return null;
  return { userId: owner.id, name: owner.name, score: res.match.score };
}