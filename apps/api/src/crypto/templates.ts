import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard is 12 bytes

function getKey(): Buffer {
  const hex = process.env.TEMPLATE_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "TEMPLATE_KEY must be 64 hex characters (32 bytes). Check your .env file."
    );
  }
  return Buffer.from(hex, "hex");
}

export interface EncryptedTemplate {
  ciphertext: string; // base64
  iv: string;         // base64
  authTag: string;    // base64
}

/**
 * Encrypts a plaintext fingerprint template (base64 FMD from the bridge).
 */
export function encryptTemplate(plaintext: string): EncryptedTemplate {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

/**
 * Decrypts a stored template back to the original base64 FMD string.
 * Throws if the ciphertext, IV, or auth tag have been tampered with.
 */
export function decryptTemplate(enc: EncryptedTemplate): string {
  const key = getKey();
  const iv = Buffer.from(enc.iv, "base64");
  const authTag = Buffer.from(enc.authTag, "base64");
  const ciphertext = Buffer.from(enc.ciphertext, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}