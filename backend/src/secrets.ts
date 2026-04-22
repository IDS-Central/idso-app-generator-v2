/**
 * Secret Manager client.
 *
 * Loads all sensitive values exactly once at process startup and holds them in memory.
 * If any required secret is missing or returns empty, startup fails hard.
 *
 * The backend Cloud Run SA must have roles/secretmanager.secretAccessor granted
 * per-secret (not project-wide) on each secret referenced here. See
 * docs/PHASE-1-KICKOFF.md step 4.
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import type { Config } from './config.js';

export interface LoadedSecrets {
    anthropicApiKey: string;
    oauthClientId: string;
    oauthClientSecret: string;
    githubAppClientSecret: string;
    githubAppPrivateKey: string;
}

const client = new SecretManagerServiceClient();

async function accessSecret(projectId: string, name: string): Promise<string> {
    const [version] = await client.accessSecretVersion({
          name: `projects/${projectId}/secrets/${name}/versions/latest`,
    });
    const payload = version.payload?.data;
    if (!payload) {
          throw new Error(`Secret ${name} has no payload on its latest version`);
    }
    const value = payload.toString();
    if (value.trim() === '') {
          throw new Error(`Secret ${name} latest version is empty`);
    }
    return value;
}

export async function loadSecrets(config: Config): Promise<LoadedSecrets> {
    const [
          anthropicApiKey,
          oauthClientId,
          oauthClientSecret,
          githubAppClientSecret,
          githubAppPrivateKey,
        ] = await Promise.all([
          accessSecret(config.projectId, config.secretNames.anthropicApiKey),
          accessSecret(config.projectId, config.googleOauthClientIdSecret),
          accessSecret(config.projectId, config.secretNames.oauthClientSecret),
          accessSecret(config.projectId, config.secretNames.githubAppClientSecret),
          accessSecret(config.projectId, config.secretNames.githubAppPrivateKey),
        ]);

  return {
        anthropicApiKey,
        oauthClientId,
        oauthClientSecret,
        githubAppClientSecret,
        githubAppPrivateKey,
  };
}
