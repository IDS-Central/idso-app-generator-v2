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

  const anthropic = createAnthropicClient({
        apiKey: secrets.anthropicApiKey,
        logger: logger as any,
  });
    // Force a reference so the linter doesn't warn; real use comes in Phase 2.
  void anthropic;

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

  const address = await app.listen({ host: '0.0.0.0', port: config.port });
    logger.info({ address }, 'boot_listening');
}

main().catch((err) => {
    // eslint-disable-next-line no-console
               console.error({ severity: 'CRITICAL', message: 'boot_failed', error: String(err) });
    process.exit(1);
});
