/**
 * BigQuery-backed read tools.
 *
 *  - bq_catalog_search   \u2014 fuzzy match against the embedded catalog JSON
 *  - bq_describe_table   \u2014 return full column list for a specific table
 *  - bq_dry_run          \u2014 validate a SQL string via BQ dry run
 *
 * The catalog is loaded once at boot (see `loadCatalog()`) from a JSON
 * file colocated with this module. The loader copes with the catalog
 * living next to the compiled JS (runtime: `dist/tools/data-catalog.json`)
 * OR next to the TS source during local dev via tsx.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type {
  Catalog,
  CatalogColumn,
  CatalogDataset,
  CatalogTable,
  ToolHandler,
} from './types.js';
import { err, ok } from './types.js';

/* ---------- catalog loader ---------- */

const HERE = dirname(fileURLToPath(import.meta.url));

export function loadCatalog(): Catalog {
  // Try same dir first (compiled output ships data-catalog.json next to
  // index.js). Fall back to the src dir when running under tsx.
  const candidates = [
    join(HERE, 'data-catalog.json'),
    join(HERE, '..', '..', 'src', 'tools', 'data-catalog.json'),
  ];
  for (const p of candidates) {
    try {
      const raw = readFileSync(p, 'utf8');
      return JSON.parse(raw) as Catalog;
    } catch {
      // try next
    }
  }
  throw new Error(
    `data-catalog.json not found; looked in: ${candidates.join(', ')}`,
  );
}

/* ---------- bq_catalog_search ---------- */

type SearchInput = { query: string; limit?: number };

type SearchHit = {
  dataset: string;
  table: string;
  table_description: string | null;
  dataset_description: string | null;
  num_columns: number;
  matched_columns: Array<{
    name: string;
    type: string;
    description: string | null;
  }>;
  score: number;
};

type SearchResult = {
  query: string;
  total_hits: number;
  hits: SearchHit[];
};

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase();
}

/** Very cheap scoring: substring hits in table name > description > column names. */
function scoreTable(
  q: string,
  dsName: string,
  ds: CatalogDataset,
  tName: string,
  t: CatalogTable,
): { score: number; matchedCols: CatalogColumn[] } {
  const needle = q.toLowerCase();
  let score = 0;
  if (norm(tName).includes(needle)) score += 10;
  if (norm(dsName).includes(needle)) score += 4;
  if (norm(t.description).includes(needle)) score += 5;
  if (norm(ds.description).includes(needle)) score += 2;
  const matchedCols = t.columns.filter(
    (c) => norm(c.name).includes(needle) || norm(c.description).includes(needle),
  );
  score += Math.min(matchedCols.length, 5) * 1;
  return { score, matchedCols };
}

export const bqCatalogSearch: ToolHandler<SearchInput, SearchResult> = async (
  input,
  deps,
) => {
  const q = (input.query ?? '').trim();
  if (!q) return err('query must be a non-empty string');
  const limit = Math.max(1, Math.min(input.limit ?? 20, 50));

  const hits: SearchHit[] = [];
  for (const [dsName, ds] of Object.entries(deps.catalog.datasets)) {
    for (const [tName, t] of Object.entries(ds.tables)) {
      const { score, matchedCols } = scoreTable(q, dsName, ds, tName, t);
      if (score <= 0) continue;
      hits.push({
        dataset: dsName,
        table: tName,
        table_description: t.description ?? null,
        dataset_description: ds.description ?? null,
        num_columns: t.columns.length,
        matched_columns: matchedCols.slice(0, 8).map((c) => ({
          name: c.name,
          type: c.type,
          description: c.description ?? null,
        })),
        score,
      });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, limit);

  deps.logger.info(
    { tool: 'bq_catalog_search', query: q, total_hits: hits.length, returned: top.length },
    'catalog_search',
  );
  return ok({ query: q, total_hits: hits.length, hits: top });
};

/* ---------- bq_describe_table ---------- */

type DescribeInput = { dataset: string; table: string };
type DescribeResult = {
  project: string;
  dataset: string;
  table: string;
  description: string | null;
  num_rows: number | null;
  num_columns: number;
  columns: Array<{
    name: string;
    type: string;
    mode: string | null;
    description: string | null;
  }>;
};

export const bqDescribeTable: ToolHandler<DescribeInput, DescribeResult> = async (
  input,
  deps,
) => {
  const ds = deps.catalog.datasets[input.dataset];
  if (!ds) {
    return err(
      `dataset "${input.dataset}" not found. Known: ${Object.keys(deps.catalog.datasets).join(', ')}`,
      'not_found',
    );
  }
  const t = ds.tables[input.table];
  if (!t) {
    const known = Object.keys(ds.tables).slice(0, 20).join(', ');
    return err(
      `table "${input.table}" not found in dataset "${input.dataset}". First 20: ${known}`,
      'not_found',
    );
  }
  const numRows =
    typeof t.numRows === 'number'
      ? t.numRows
      : typeof t.numRows === 'string'
        ? Number(t.numRows)
        : null;
  deps.logger.info(
    { tool: 'bq_describe_table', dataset: input.dataset, table: input.table },
    'describe_table',
  );
  return ok({
    project: deps.catalog.project,
    dataset: input.dataset,
    table: input.table,
    description: t.description ?? null,
    num_rows: Number.isFinite(numRows) ? (numRows as number) : null,
    num_columns: t.columns.length,
    columns: t.columns.map((c) => ({
      name: c.name,
      type: c.type,
      mode: c.mode ?? null,
      description: c.description ?? null,
    })),
  });
};

/* ---------- bq_dry_run ---------- */

type DryRunInput = { sql: string };
type DryRunResult = {
  ok: true;
  bytes_processed: number;
  statement_type: string | null;
  referenced_tables: string[];
};

export const bqDryRun: ToolHandler<DryRunInput, DryRunResult> = async (
  input,
  deps,
) => {
  const sql = (input.sql ?? '').trim();
  if (!sql) return err('sql must be a non-empty string');
  try {
    const [job] = await deps.bq.createQueryJob({
      query: sql,
      dryRun: true,
      useLegacySql: false,
    });
    const md = job.metadata;
    const stats = md?.statistics ?? {};
    const qstats = stats.query ?? {};
    const referenced = Array.isArray(qstats.referencedTables)
      ? qstats.referencedTables.map(
          (r: { projectId?: string; datasetId?: string; tableId?: string }) =>
            `${r.projectId ?? ''}.${r.datasetId ?? ''}.${r.tableId ?? ''}`,
        )
      : [];
    const bytes = Number(qstats.totalBytesProcessed ?? stats.totalBytesProcessed ?? 0);
    deps.logger.info(
      { tool: 'bq_dry_run', bytes, referenced_count: referenced.length },
      'dry_run_ok',
    );
    return ok({
      ok: true,
      bytes_processed: Number.isFinite(bytes) ? bytes : 0,
      statement_type: (qstats.statementType as string | undefined) ?? null,
      referenced_tables: referenced,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    deps.logger.warn({ tool: 'bq_dry_run', error: msg }, 'dry_run_failed');
    return err(msg, 'invalid_sql');
  }
};
