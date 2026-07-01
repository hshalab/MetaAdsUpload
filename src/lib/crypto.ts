import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

// ─── Secret encryption at rest (AES-256-GCM) ─────────────────────────────────
// Format: enc:v1:<iv b64>:<authTag b64>:<ciphertext b64>
// Key: TOKEN_ENCRYPTION_KEY env — 64-char hex, base64(32 bytes), or any string
// (hashed to 32 bytes with SHA-256).
//
// Values are lazily migrated: plaintext rows are re-encrypted the next time
// they're written. Without a key configured, encryption is a no-op (with a
// one-time warning) so nothing breaks before the env var is set.

const PREFIX = "enc:v1:";
let warnedMissingKey = false;

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  try {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  } catch { /* fall through */ }
  return createHash("sha256").update(raw).digest();
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) {
    if (!warnedMissingKey) {
      console.warn("TOKEN_ENCRYPTION_KEY not set — Meta tokens are stored in plaintext. Set it to enable encryption at rest.");
      warnedMissingKey = true;
    }
    return plaintext;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value; // legacy plaintext row
  const key = getKey();
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required to decrypt stored tokens but is not set");
  }
  const [ivB64, tagB64, ctB64] = value.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
