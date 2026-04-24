/**
 * Secret Manager client with 5-minute in-memory cache.
 * Pulls secrets from Google Secret Manager at runtime.
 * Never bake secrets into the image or env files.
 */
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();
const cache = new Map<string, { value: string; expiresAt: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getSecret(name: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(name);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const project = process.env.IDSO_GCP_PROJECT;
  if (!project) {
    throw new Error('IDSO_GCP_PROJECT env var is required to access Secret Manager');
  }

  const [version] = await client.accessSecretVersion({
    name: `projects/${project}/secrets/${name}/versions/latest`,
  });
  const payload = version.payload?.data?.toString();
  if (!payload) {
    throw new Error(`Secret ${name} has no payload`);
  }

  cache.set(name, { value: payload, expiresAt: now + TTL_MS });
  return payload;
}

/** For tests only; production code should never clear. */
export function _clearSecretCache(): void {
  cache.clear();
}
