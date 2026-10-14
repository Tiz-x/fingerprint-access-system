import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifyPassword, signToken, requireAdmin } from "../auth.js";
import { logAdminAction } from "../audit.js";

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/auth/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      const parsed = LoginBody.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request body" });
      }

      const { username, password } = parsed.data;

      const admin = await prisma.admin.findUnique({ where: { username } });

      if (!admin) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const ok = await verifyPassword(admin.passwordHash, password);
      if (!ok) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      const token = signToken({
        adminId: admin.id,
        username: admin.username,
      });

      await logAdminAction(admin.id, "LOGIN");

      return reply.send({
        token,
        admin: { id: admin.id, username: admin.username },
      });
    }
  );

  app.get("/auth/me", { preHandler: requireAdmin }, async (req, reply) => {
    const payload = req.admin!;
    const admin = await prisma.admin.findUnique({
      where: { id: payload.adminId },
      select: { id: true, username: true, createdAt: true },
    });
    if (!admin) {
      return reply.code(401).send({ error: "Admin no longer exists" });
    }
    return reply.send({ admin });
  });
}