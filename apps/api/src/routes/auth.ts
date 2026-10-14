import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifyPassword, signToken } from "../auth.js";

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/login", async (req, reply) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request body" });
    }

    const { username, password } = parsed.data;

    const admin = await prisma.admin.findUnique({ where: { username } });

    // Same generic error whether the user exists or not — don't leak which.
    if (!admin) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const ok = await verifyPassword(admin.passwordHash, password);
    if (!ok) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = signToken({ adminId: admin.id, username: admin.username });

    return reply.send({
      token,
      admin: { id: admin.id, username: admin.username },
    });
  });
}