/**
 * Edge-runtime-safe session decryption.
 * Uses the Web Crypto API (available in Next.js middleware / Edge runtime).
 * This module must NOT import anything from 'node:crypto' or Node-only modules.
 * Matches the cookie format produced by session.ts:
 *   base64url(iv[12] || authTag[16] || ciphertext)
 * Key = SHA-256(SECRET_KEY).
 */

const IV_LEN = 12;
const TAG_LEN = 16;

export interface SessionDataEdge {
  email: string;
  name?: string;
  picture?: string;
  idToken: string;
  issuedAt: number;
  expiresAt: number;
}

function base64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SECRET_KEY;
  if (!secret || secret.length < 16) {
    throw new Error('SECRET_KEY env var is required and must be at least 16 chars');
  }
  const enc = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['decrypt']);
}

export async function decryptSessionEdge(cookieValue: string): Promise<SessionDataEdge | null> {
  try {
    const buf = base64urlToBytes(cookieValue);
    if (buf.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = buf.slice(0, IV_LEN);
    // Web Crypto AES-GCM expects ciphertext || authTag concatenated.
    const ctAndTag = buf.slice(IV_LEN);
    const key = await getKey();
    const plaintextBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ctAndTag,
    );
    const plaintext = new TextDecoder().decode(plaintextBuf);
    const parsed = JSON.parse(plaintext) as SessionDataEdge;
    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
