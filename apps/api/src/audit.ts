import { prisma } from "./db.js";

export async function logAdminAction(
  adminId: string,
  action: string,
  target: string | null = null,
  details: string | null = null
): Promise<void> {
  await prisma.adminAudit.create({
    data: { adminId, action, target, details },
  });
}