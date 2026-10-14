import "dotenv/config";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { FastifyRequest, FastifyReply } from "fastify";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
  throw new Error(
    "JWT_SECRET must be set in .env and be at least 16 characters long."
  );
}

const TOKEN_TTL = "8h";

export interface JwtPayload {
  adminId: string;
  username: string;
}

/**
 * Hash a plaintext password with argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

/**
 * Verify a plaintext password against an argon2 hash.
 */
export async function verifyPassword(
  hash: string,
  password: string
): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Sign a JWT for an authenticated admin.
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: TOKEN_TTL });
}

/**
 * Verify a JWT. Throws if invalid or expired.
 */
export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET as string);
  if (typeof decoded === "string") {
    throw new Error("Invalid token payload");
  }
  return decoded as JwtPayload;
}

/**
 * Fastify preHandler that requires a valid Bearer token.
 * Attaches the payload to req.admin for downstream handlers.
 */
export async function requireAdmin(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing or malformed Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    req.admin = verifyToken(token);
  } catch {
    reply.code(401).send({ error: "Invalid or expired token" });
    return;
  }
}