import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { bridge } from "../bridge/index.js";
import { encryptTemplate } from "../crypto/templates.js";
import { requireAdmin } from "../auth.js";

const EnrollBody = z.object({
  name: z.string().min(1).max(100),
  role: z.string().min(1).max(50).default("user"),
  scans: z.number().int().min(1).max(10).default(4),
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

      const result = await bridge.enroll(scans);
      if (!result.ok) {
        return reply.code(502).send({
          error: "Enrollment failed at scanner",
          reason: result.error,
        });
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

      return reply.code(201).send({ user, scansUsed: result.scansUsed });
    }
  );

  // GET /users — list users, no templates
  app.get(
    "/users",
    { preHandler: requireAdmin },
    async (_req, reply) => {
      const users = await prisma.user.findMany({
        select: { id: true, name: true, role: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      return reply.send({ users });
    }
  );

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
        return reply.code(204).send();
      } catch {
        return reply.code(404).send({ error: "User not found" });
      }
    }
  );
}