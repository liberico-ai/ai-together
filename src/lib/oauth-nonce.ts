import crypto from "crypto";

/**
 * In-memory TTL cache for OAuth state nonces.
 * Maps nonce → { userId, expiresAt }
 * Nonces auto-expire after TTL to prevent memory leaks.
 */
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface NonceEntry {
  userId: string;
  expiresAt: number;
}

const nonceStore = new Map<string, NonceEntry>();

/** Periodic cleanup of expired nonces */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of nonceStore) {
    if (entry.expiresAt < now) nonceStore.delete(key);
  }
}, 60_000); // Clean every 60s

/**
 * Generate a random nonce and store it with the user ID.
 * Returns the nonce string to be used as OAuth state.
 */
export function createOAuthNonce(userId: string): string {
  const nonce = crypto.randomBytes(32).toString("hex");
  nonceStore.set(nonce, {
    userId,
    expiresAt: Date.now() + NONCE_TTL_MS,
  });
  return nonce;
}

/**
 * Validate and consume a nonce. Returns the userId if valid, null otherwise.
 * Nonce is deleted after use (one-time use).
 */
export function consumeOAuthNonce(nonce: string): string | null {
  const entry = nonceStore.get(nonce);
  if (!entry) return null;
  nonceStore.delete(nonce);
  if (entry.expiresAt < Date.now()) return null;
  return entry.userId;
}
