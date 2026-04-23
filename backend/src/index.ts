/**
 * Entrypoint for the idso-app-generator-v2 backend.
 *
 * Boot sequence (fail hard on any step):
 *   1. Load env-var config (config.ts).
 *   2. Load secrets from Secret Manager in parallel (secrets.ts).
 *   3. Initialize structured logger (logger.ts).
 *   4. Construct Anthropic client (anthropic.ts).
 *   5. Construct auth layer with OAuth client id as audience (auth.ts).
 *   6. Register routes: GET /livez (unauthed), GET /me (authed).
 *   7. Listen on PORT.
 *
 * Phase 1 intentionally omits:
 *   - Anthropic tool-use loop
 *   - GitHub App JWT + installation token minting
 *   - Any tool implementations (create_github_repo, deploy_cloud_run, etc.)
 *   - Any persistent storage
 *   - Any frontend
 *
 * Those land in Phase 2 and Phase 3.
 */

import Fastify from 'fastify';
import { loadConfig } from './config.js';
import { loadSecrets } from './secrets.js';
import { createRootLogger } from './logger.js';
import { createAuth } from './auth.js';
import { createAnthropicClient } from './anthropic.js';
import { registerLivezRoute } from './routes/livez.js';
import { registerMeRoute } from './routes/me.js';
import { registerChatRoutes } from './routes/chat.js';
import { DEFAULT_SYSTEM_PROMPT } from './agent/prompt.js';

import { BigQuery } from '@google-cloud/bigquery';
import { bootstrapSessionStore } from './session/bootstrap.js';
import { SessionStore } from './session/store.js';
import { loadCatalog } from './tools/bq.js';
import { buildIamClient } from './tools/iam.js';
import { buildGithubClient } from './tools/github.js';

async function main(): Promise<void> {
    const config = loadConfig();
    const logger = createRootLogger(config.logLevel);

  logger.info(
    {
            project_id: config.projectId,
            region: config.region,
            github_app_id: config.githubAppId,
            github_app_installation_id: config.githubAppInstallationId,
    },
        'boot_config_loaded',
      );

  const secrets = await loadSecrets(config);
    logger.info({ secrets_loaded: 5 }, 'boot_secrets_loaded');


  const bq = new BigQuery({ projectId: config.projectId });
  await bootstrapSessionStore({ bq, logger });
  const sessionStore = new SessionStore({
    bq,
    logger,
    project: config.projectId,
    dataset: config.sessionDataset,
  });
  const anthropic = createAnthropicClient({
        apiKey: secrets.anthropicApiKey,
        logger: logger as any,
  });
  const auth = createAuth({
        config,
        oauthClientId: secrets.oauthClientId,
  });

  const app = Fastify({
        logger: logger as any,
        disableRequestLogging: false,
        trustProxy: true,
        bodyLimit: 1024 * 1024, // 1 MB — chat turns are tiny; generated-file payloads stay server-side
  });

  registerLivezRoute(app);
    registerMeRoute(app, { auth });

  const catalog = loadCatalog();
  const tableCount = Object.values(catalog.datasets).reduce((n, d) => n + Object.keys(d.tables).length, 0);
  app.log.info({ datasets: Object.keys(catalog.datasets).length, tables: tableCount, generated_at: catalog.generatedAt }, 'catalog_loaded');

  // IAM client for write tools (iam_create_sa, later cloudbuild/cloudrun).
  // Built at boot so we fail fast if ADC is broken; safe even if the tool is never invoked.
  const iamClient = await buildIamClient(config.projectId);
  app.log.info({ project_id: iamClient.projectId }, 'iam_client_ready');

// GitHub App client for write tools (gh_create_repo, etc.).
// Config requires appId + installationId + clientId as env vars; private key
// comes from Secret Manager via loadSecrets().
const ghClient = buildGithubClient({
  appId: config.githubAppId,
  installationId: config.githubAppInstallationId,
  privateKeyPem: secrets.githubAppPrivateKey,
  org: 'IDS-Central',
  seedRepo: 'idso-app-template-v2',
});
app.log.info(
  {
    gh_app_id: config.githubAppId,
    gh_installation_id: config.githubAppInstallationId,
    seed_repo: 'IDS-Central/idso-app-template-v2',
  },
  'github_client_ready',
);

  const devBypassEmail = (process.env.AUTH_DEV_BYPASS_EMAIL ?? '').trim();
  const devBypass = (process.env.ALLOW_DEV_AUTH_BYPASS === '1' && devBypassEmail)
    ? { email: devBypassEmail }
    : null;
  if (devBypass) {
    app.log.warn({ email: devBypass.email }, 'auth_dev_bypass_enabled');
  }

  registerChatRoutes(app, {
    auth,
    anthropic: anthropic.client,
    store: sessionStore,
    toolDeps: { bq, catalog, logger, iam: iamClient, gh: ghClient },
    logger,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    devBypass,
  });
  const address = await app.listen({ host: '0.0.0.0', port: config.port });
    logger.info({ address }, 'boot_listening');
}

main().catch((err) => {
    // eslint-disable-next-line no-console
               console.error({ severity: 'CRITICAL', message: 'boot_failed', error: String(err) });
    process.exit(1);
});
