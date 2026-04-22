/**
 * Anthropic client wrapper.
 *
 * In Phase 1 we only construct the client and expose a thin `ping()` that does
 * a minimal messages.create call to prove the key works end-to-end. The full
 * tool-use loop is Phase 2.
 *
 * Token-usage accounting is centralized here: every call emits an
 * `anthropic_usage` log line with authenticated_email, model, input_tokens,
 * output_tokens. No prompt or response content is logged.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Logger } from './logger.js';

const DEFAULT_MODEL = 'claude-sonnet-4-5';

export interface AnthropicDeps {
    apiKey: string;
    logger: Logger;
}

export function createAnthropicClient(deps: AnthropicDeps) {
    const client = new Anthropic({ apiKey: deps.apiKey });

  async function ping(authenticatedEmail: string): Promise<{ model: string; ok: true }> {
        const response = await client.messages.create({
                model: DEFAULT_MODEL,
                max_tokens: 16,
                messages: [{ role: 'user', content: 'Respond with the single word: ok' }],
        });

      deps.logger.info(
        {
                  authenticated_email: authenticatedEmail,
                  anthropic_model: DEFAULT_MODEL,
                  input_tokens: response.usage.input_tokens,
                  output_tokens: response.usage.output_tokens,
        },
              'anthropic_usage',
            );

      return { model: DEFAULT_MODEL, ok: true };
  }

  return { ping };
}
