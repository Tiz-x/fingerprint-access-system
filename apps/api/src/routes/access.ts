import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { bridge } from "../bridge/index.js";
import { decryptTemplate } from "../crypto/templates.js";
import { MATCH_THRESHOLD, UNLOCK_SECONDS } from "../config.js";
import { emitUnlock, emitDenied } from "../realtime.js";

export async function accessRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/access/verify",
    {
      config: {
        rateLimit: { max: 30, timeWindow: "1 minute" },
      },
    },
    async (_req, reply) => {
      const timestamp = new Date().toISOString();

      // 1. Capture a finger via the bridge
      const capture = await bridge.capture();
      if (!capture.ok) {
        // Nobody touched the scanner, or the scanner is offline. That isn't an
        // access attempt, so don't log it or announce a denial.
        const notAnAttempt = [
          "NO_FINGER",
          "TIMEOUT",
          "BRIDGE_UNREACHABLE",
          "DEVICE_NOT_FOUND",
          "BRIDGE_ERROR",
        ];
        if (notAnAttempt.includes(capture.error)) {
          return reply.code(200).send({ granted: false, reason: capture.error });
        }

        await prisma.accessLog.create({
          data: { result: "DENIED", reason: capture.error },
        });
        emitDenied({ granted: false, reason: capture.error, timestamp });
        return reply.code(200).send({ granted: false, reason: capture.error });
      }

      // 2. Load all templates, decrypt them
      const rows = await prisma.template.findMany({
        include: { user: { select: { id: true, name: true } } },
      });

      if (rows.length === 0) {
        await prisma.accessLog.create({
          data: { result: "DENIED", reason: "NO_TEMPLATES" },
        });
        emitDenied({ granted: false, reason: "NO_TEMPLATES", timestamp });
        return reply
          .code(200)
          .send({ granted: false, reason: "NO_TEMPLATES" });
      }

      const candidates = rows.map((r) => ({
        userId: r.user.id,
        fmd: decryptTemplate({
          ciphertext: r.fmd,
          iv: r.iv,
          authTag: r.authTag,
        }),
      }));

      // 3. Ask the bridge to find the best match
      const identify = await bridge.identify(capture.fmd, candidates);
      if (!identify.ok) {
        await prisma.accessLog.create({
          data: { result: "DENIED", reason: identify.error },
        });
        emitDenied({ granted: false, reason: identify.error, timestamp });
        return reply
          .code(200)
          .send({ granted: false, reason: identify.error });
      }

      // 4. Apply threshold
      const match = identify.match;
      if (!match || match.score > MATCH_THRESHOLD) {
        const score = match?.score ?? null;
        await prisma.accessLog.create({
          data: { result: "DENIED", reason: "NO_MATCH", score },
        });
        emitDenied({ granted: false, reason: "NO_MATCH", timestamp });
        return reply
          .code(200)
          .send({ granted: false, reason: "NO_MATCH", score });
      }

      // 5. Grant: log, emit unlock
      const user = rows.find((r) => r.user.id === match.userId)!.user;

      await prisma.accessLog.create({
        data: {
          result: "GRANTED",
          userId: user.id,
          score: match.score,
        },
      });

      emitUnlock({
        granted: true,
        userId: user.id,
        userName: user.name,
        score: match.score,
        unlockSeconds: UNLOCK_SECONDS,
        timestamp,
      });

      return reply.send({
        granted: true,
        user: { id: user.id, name: user.name },
        score: match.score,
        unlockSeconds: UNLOCK_SECONDS,
      });
    }
  );
}