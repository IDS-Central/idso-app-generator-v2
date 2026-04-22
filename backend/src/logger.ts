/**
 * Structured logger.
 *
 * Emits JSON lines to stdout in the shape Google Cloud Logging ingests natively.
 * Every log line must carry the authenticated user's email whenever we have it,
 * which is enforced by attaching the email via the request-scoped child logger
 * in auth.ts and logging through that, not through the root logger.
 *
 * Do not log secret values. Do not log ID tokens. Do not log full Anthropic request
 * bodies (they may contain repo contents or user data). Log only:
 *   - authenticated_email
 *   - request method + path + status + duration
 *   - tool_name + tool_call_id + outcome (for tool calls)
 *   - anthropic_model + input_tokens + output_tokens (for token accounting)
 */

import pino from 'pino';

export type Logger = pino.Logger;

export function createRootLogger(level: string): Logger {
    return pino({
          level,
          // Map pino levels to Google Cloud Logging severities.
          formatters: {
                  level(label) {
                            const map: Record<string, string> = {
                                        trace: 'DEBUG',
                                        debug: 'DEBUG',
                                        info: 'INFO',
                                        warn: 'WARNING',
                                        error: 'ERROR',
                                        fatal: 'CRITICAL',
                            };
                            return { severity: map[label] ?? 'DEFAULT' };
                  },
          },
          // Cloud Logging expects `message`, not `msg`.
          messageKey: 'message',
          // Do not log `hostname` / `pid` — Cloud Run already tags them.
          base: { service: 'app-generator-v2-backend' },
          timestamp: () => `,"time":"${new Date().toISOString()}"`,
    });
}
