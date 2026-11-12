import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { bridge } from "../bridge/index.js";
import { encryptTemplate } from "../crypto/templates.js";
import { requireAdmin } from "../auth.js";
import { logAdminAction } from "../audit.js";
import { findDuplicate } from "../enrollCheck.js";

const EnrollBody = z.object({
  name: z.string()
    .min(3, "Name is too short")
    .max(100)
    .refine((val) => val.trim().includes(" "), {
      message: "Please provide a full name (First and Last name)",
    }),
  role: z.string().min(1).max(50).default("user"),
});
// Array of finger names for error messages
const FINGER_NAMES = [
  "Right Thumb", "Right Index", "Right Middle", "Right Ring", "Right Pinky",
  "Left Thumb", "Left Index", "Left Middle", "Left Ring", "Left Pinky"
];

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/users/enroll",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const parsed = EnrollBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request body" });
      }
      const { name, role } = parsed.data;
      const adminId = req.admin!.adminId;

      // 1. Capture 10 fingers
      const result = await bridge.enroll(10);
      if (!result.ok) {
        return reply.code(502).send({ error: "Enrollment failed at scanner", reason: result.error });
      }

      if (result.fmds.length !== 10) {
        return reply.code(502).send({ error: "Did not capture all 10 fingers", reason: "SCANS_MISMATCH" });
      }

      // 2. Check if any of the 10 fingers match each other (Duplicate check)
      for (let i = 0; i < result.fmds.length; i++) {
        for (let j = i + 1; j < result.fmds.length; j++) {
          // Ask the bridge to compare finger i to finger j
          const match = await bridge.identify(result.fmds[i], [
            { userId: "temp", fmd: result.fmds[j] }
          ]);
          
          // If they match (score < threshold), they used the same finger twice
          if (match.ok && match.match && match.match.score < 25000) {
            const finger1 = FINGER_NAMES[i];
            const finger2 = FINGER_NAMES[j];
            await logAdminAction(adminId, "ENROLL_BLOCKED_DUPLICATE_FINGER", null, `${finger1} matches ${finger2}`);
            return reply.code(400).send({
              error: `You scanned the same finger twice. ${finger1} matches ${finger2}. Please scan 10 different fingers.`,
              reason: "DUPLICATE_FINGER_IN_BATCH",
            });
          }
        }
      }

      // 3. Check against existing database users
      for (let i = 0; i < result.fmds.length; i++) {
        try {
          const dup = await findDuplicate(result.fmds[i]);
          if (dup) {
            await logAdminAction(adminId, "ENROLL_BLOCKED_DUPLICATE", dup.userId, `attempted name=${name} on finger ${FINGER_NAMES[i]}`);
            return reply.code(409).send({
              error: `${FINGER_NAMES[i]} is already enrolled as ${dup.name}`,
              reason: "ALREADY_ENROLLED",
              existingName: dup.name,
            });
          }
        } catch {
          return reply.code(502).send({ error: "Couldn't check existing fingerprints", reason: "BRIDGE_ERROR" });
        }
      }

      // 4. Encrypt and save all 10 templates
      const encryptedTemplates = result.fmds.map((fmd) => {
        const enc = encryptTemplate(fmd);
        return {
          fmd: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
        };
      });

      const user = await prisma.user.create({
        data: {
          name,
          role,
          templates: {
            create: encryptedTemplates,
          },
        },
        select: { id: true, name: true, role: true, createdAt: true },
      });

      await logAdminAction(adminId, "ENROLL", user.id, `name=${name}, fingers=10`);

      return reply.code(201).send({ user, scansUsed: 10 });
    }
  );

  // GET /users — list users, no templates
  app.get("/users", { preHandler: requireAdmin }, async (_req, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ users });
  });

  // DELETE /users/:id — delete a user (templates cascade)
  app.delete(
    "/users/:id",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const params = z.object({ id: z.string().min(1) }).safeParse(req.params);
      if (!params.success) {
        return reply.code(400).send({ error: "Invalid user id" });
      }

      try {
        await prisma.user.delete({ where: { id: params.data.id } });
      } catch {
        return reply.code(404).send({ error: "User not found" });
      }

      await logAdminAction(req.admin!.adminId, "DELETE_USER", params.data.id);

      return reply.code(204).send();
    }
  );
}