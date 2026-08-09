import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Encrypts hevy_api_key/anthropic_api_key at rest so a database-only leak
// (a stolen backup, a leaked Supabase service-role key, dashboard access
// without app-deploy access) can't read them in plaintext. This does NOT
// protect against the app's own deployed server code, which still decrypts
// a key in memory each time it calls Hevy/Anthropic on the user's behalf --
// see README.md's caveat.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit GCM nonce, the recommended size

// Legacy plaintext values (any real Hevy/Anthropic key) will never match
// this shape, so decryptSecret can tell them apart from a real envelope.
const ENVELOPE_PATTERN = /^v1:([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+):([A-Za-z0-9+/=]+)$/;

export class SecretDecryptionError extends Error {
  name = "SecretDecryptionError";
}

function getEncryptionKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("SETTINGS_ENCRYPTION_KEY is not set");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded)");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(value: string): string {
  const key = getEncryptionKey();
  const match = value.match(ENVELOPE_PATTERN);
  if (!match) return value; // legacy plaintext -- see schema.sql migration note

  const [, ivB64, authTagB64, ciphertextB64] = match;
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    throw new SecretDecryptionError("Failed to decrypt stored secret (wrong key or corrupted data)");
  }
}
