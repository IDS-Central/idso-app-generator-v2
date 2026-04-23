/**
 * Idempotent bootstrap for the session store.
 *
 * Called once during backend boot (from index.ts after the BQ client
 * is constructed). Reads schema.sql from disk and runs it as a single
 * BQ job. BigQuery supports multi-statement jobs, so the whole file
 * goes through in one round trip.
 *
 * Because every statement is CREATE ... IF NOT EXISTS, this is safe to
 * call every boot. On first boot it creates the dataset and two
 * tables; on subsequent boots it's a near-noop.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { BigQuery } from '@google-cloud/bigquery';
import type { Logger } from 'pino';

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadSchemaSql(): string {
  // Same dual-location trick as loadCatalog(): compiled output (dist/)
  // or direct TS run via tsx (src/).
  const candidates = [
    join(HERE, 'schema.sql'),
    join(HERE, '..', '..', 'src', 'session', 'schema.sql'),
  ];
  for (const p of candidates) {
    try {
      return readFileSync(p, 'utf8');
    } catch {
      // try next
    }
  }
  throw new Error(
    `session/schema.sql not found; looked in: ${candidates.join(', ')}`,
  );
}

export type BootstrapDeps = {
  bq: BigQuery;
  logger: Logger;
};

export async function bootstrapSessionStore(
  deps: BootstrapDeps,
): Promise<void> {
  const sql = loadSchemaSql();
  const log = deps.logger.child({ component: 'session_bootstrap' });
  const start = Date.now();
  try {
    const [job] = await deps.bq.createQueryJob({
      query: sql,
      useLegacySql: false,
    });
    await job.getQueryResults();
    const ms = Date.now() - start;
    log.info({ job_id: job.id, ms }, 'session_store_ready');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log.error({ err: msg }, 'session_store_bootstrap_failed');
    throw e;
  }
}
