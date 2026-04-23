/**
 * Static backend configuration.
 *
 * All non-sensitive identifiers (project id, region, OAuth audience, GitHub App id,
 * GitHub App client id, GitHub App installation id) live in environment variables.
 *
 * All sensitive values (Anthropic key, GitHub App client secret, GitHub App private key,
 * OAuth client secret) live in GCP Secret Manager and are loaded at startup by
 * ./secrets.ts — never from environment variables.
 *
 * Required env vars at startup:
 *   PROJECT_ID                    -> reconciliation-dashboard
 *   REGION                        -> us-central1
 *   GOOGLE_OAUTH_CLIENT_ID_SECRET -> Secret Manager secret name (e.g. oauth-client-id)
 *   GITHUB_APP_ID                 -> numeric GitHub App id
 *   GITHUB_APP_CLIENT_ID          -> GitHub App client id (Iv23li...)
 *   GITHUB_APP_INSTALLATION_ID    -> numeric GitHub App installation id on IDS-Central
 *   ALLOWED_HD                    -> 'independencedso.com'
 *
 * Optional:
 *   PORT                          -> defaults to 8080 (Cloud Run injects this)
 *   LOG_LEVEL                     -> defaults to 'info'
 */

export interface Config {
    projectId: string;
    region: string;
    port: number;
    logLevel: string;
  sessionDataset: string;

  /** The Google Workspace domain required on every ID token. */
  allowedHd: string;

  /**
     * Name of the Secret Manager secret whose contents is the OAuth client id.
     * We resolve it at runtime so the ID-token verifier can use the client id as the audience.
     */
  googleOauthClientIdSecret: string;

  githubAppId: string;
    githubAppClientId: string;
    githubAppInstallationId: string;

  /** Secret Manager secret names for sensitive values. */
  secretNames: {
      anthropicApiKey: string;
      oauthClientSecret: string;
      githubAppClientSecret: string;
      githubAppPrivateKey: string;
  };
}

function required(name: string): string {
    const value = process.env[name];
    if (!value || value.trim() === '') {
          throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function optional(name: string, fallback: string): string {
    const value = process.env[name];
    return value && value.trim() !== '' ? value : fallback;
}

export function loadConfig(): Config {
    return {
          projectId: required('PROJECT_ID'),
          region: optional('REGION', 'us-central1'),
          port: Number(optional('PORT', '8080')),
          logLevel: optional('LOG_LEVEL', 'info'),
    sessionDataset: optional('SESSION_DATASET', 'idso_app_generator'),
          allowedHd: optional('ALLOWED_HD', 'independencedso.com'),

          googleOauthClientIdSecret: optional('GOOGLE_OAUTH_CLIENT_ID_SECRET', 'oauth-client-id'),

          githubAppId: required('GITHUB_APP_ID'),
          githubAppClientId: required('GITHUB_APP_CLIENT_ID'),
          githubAppInstallationId: required('GITHUB_APP_INSTALLATION_ID'),

          secretNames: {
                  anthropicApiKey: optional('ANTHROPIC_API_KEY_SECRET', 'anthropic-api-key'),
                  oauthClientSecret: optional('OAUTH_CLIENT_SECRET_SECRET', 'oauth-client-secret'),
                  githubAppClientSecret: optional(
                            'GITHUB_APP_CLIENT_SECRET_SECRET',
                            'github-app-client-secret',
                          ),
                  githubAppPrivateKey: optional('GITHUB_APP_PRIVATE_KEY_SECRET', 'github-app-private-key'),
          },
    };
}
