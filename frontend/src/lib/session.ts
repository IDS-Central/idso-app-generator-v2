/**
 * Session cookie crypto: AES-256-GCM.
 * Cookie value format: base64(iv || authTag || ciphertext)
 *   iv       = 12 bytes (GCM standard)
 *   authTag  = 16 bytes
 *   ciphertext = variable
 * Key: SHA-256(SECRET_KEY). 32 bytes.
 *
 * This module uses Node.js crypto and must NOT be imported from middleware
 * (which runs in the Edge runtime). See session-edge.ts for the Web Crypto
 * equivalent used in middleware.ts.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const IV_LEN = 12;
const TAG_LEN = 16;

export interface SessionData {
  email: string;
  name?: string;
  picture?: string;
  idToken: string;    // Google ID token, forwarded to backend
  issuedAt: number;   // epoch ms
  expiresAt: number;  // epoch ms
}

function getKey(): Buffer {
  const secret = process.env.SECRET_KEY;
  if (!secret || secret.length < 16) {
    throw new Error('SECRET_KEY env var is required and must be at least 16 chars');
  }
  return createHash('sha256').update(secret).digest();
}

export function encryptSession(data: SessionData): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(data), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64url');
}

export function decryptSession(cookieValue: string): SessionData | null {
  try {
    const key = getKey();
    const buf = Buffer.from(cookieValue, 'base64url');
    if (buf.length < IV_LEN + TAG_LEN + 1) return null;
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString('utf8')) as SessionData;
    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = 'idso_session';
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours
