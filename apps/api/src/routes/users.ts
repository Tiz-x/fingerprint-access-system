import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { bridge } from "../bridge/index.js";
import { encryptTemplate } from "../crypto/templates.js";
import { requireAdmin } from "../auth.js";
import { logAdminAction } from "../audit.js";
import { findDuplicate } from "../enrollCheck.js";

const EnrollBody = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(50).default("user"),
  scans: z.number().int().min(2).max(8).default(4),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // POST /users/enroll — capture via bridge, encrypt, save
  app.post(
    "/users/enroll",
    { preHandler: requireAdmin },
    async (req, reply) => {
      const parsed = EnrollBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request body" });
      }
      const { name, role, scans } = parsed.data;
const adminId = req.admin!.adminId;

async function rejectDuplicate(dup: { userId: string; name: string }) {
  await logAdminAction(adminId, "ENROLL_BLOCKED_DUPLICATE", dup.userId, `attempted name=${name}`);
  return reply.code(409).send({
    error: `This fingerprint is already enrolled as ${dup.name}`,
    reason: "ALREADY_ENROLLED",
    existingName: dup.name,
  });
}

// 1. One quick scan first: is this finger already enrolled?
const probe = await bridge.capture();
if (!probe.ok) {
  return reply.code(502).send({ error: "Couldn't read the finger", reason: probe.error });
}
try {
  const dup = await findDuplicate(probe.fmd);
  if (dup) return await rejectDuplicate(dup);
} catch {
  return reply.code(502).send({ error: "Couldn't check existing fingerprints", reason: "BRIDGE_ERROR" });
}

// 2. Now the full enrollment scans
const result = await bridge.enroll(scans);
if (!result.ok) {
  return reply.code(502).send({
    error: "Enrollment failed at scanner",
    reason: result.error,
  });
}

// 3. Safety net: the finger might have been swapped during the enrollment scans
try {
  const dup = await findDuplicate(result.fmd);
  if (dup) return await rejectDuplicate(dup);
} catch {
  return reply.code(502).send({ error: "Couldn't check existing fingerprints", reason: "BRIDGE_ERROR" });
}

      const enc = encryptTemplate(result.fmd);

      const user = await prisma.user.create({
        data: {
          name,
          role,
          templates: {
            create: {
              fmd: enc.ciphertext,
              iv: enc.iv,
              authTag: enc.authTag,
            },
          },
        },
        select: { id: true, name: true, role: true, createdAt: true },
      });

      await logAdminAction(
        req.admin!.adminId,
        "ENROLL",
        user.id,
        `name=${name}`
      );

      return reply.code(201).send({ user, scansUsed: result.scansUsed });
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

      await logAdminAction(
        req.admin!.adminId,
        "DELETE_USER",
        params.data.id
      );

      return reply.code(204).send();
    }
  );
}