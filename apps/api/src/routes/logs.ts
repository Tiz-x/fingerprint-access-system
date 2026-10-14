import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { requireAdmin } from "../auth.js";

export async function logRoutes(app: FastifyInstance): Promise<void> {
  app.get("/logs", { preHandler: requireAdmin }, async (_req, reply) => {
    const logs = await prisma.accessLog.findMany({
      orderBy: { timestamp: "desc" },
      take: 500,
      include: {
        user: { select: { id: true, name: true } },
      },
    });
    return reply.send({ logs });
  });
}