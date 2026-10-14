import "dotenv/config";
import { encryptTemplate, decryptTemplate } from "./templates.js";

const original = "this-is-a-fake-fingerprint-template-" + "x".repeat(200);

const enc = encryptTemplate(original);
console.log("Ciphertext (first 60 chars):", enc.ciphertext.slice(0, 60));
console.log("IV:", enc.iv);
console.log("Auth tag:", enc.authTag);

const decrypted = decryptTemplate(enc);
console.log("Round-trip matches:", decrypted === original);

// Tamper test
const tampered = { ...enc, ciphertext: "A" + enc.ciphertext.slice(1) };
try {
  decryptTemplate(tampered);
  console.log("ERROR: tampered data decrypted! (should not happen)");
} catch {
  console.log("Tamper detection works: decryption failed as expected.");
}