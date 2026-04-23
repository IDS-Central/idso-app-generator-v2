/**
 * Handler interface for tool-use dispatch.
 *
 * A ToolHandler is a pure(-ish) function that takes a validated input
 * object (shape enforced by the LLM against the JSON Schema in
 * `./schema.ts`, and re-validated at dispatch time) and returns a
 * JSON-serialisable result. The Anthropic tool-use loop wraps the
 * result into a tool_result content block for the next turn.
 *
 * Handlers receive `deps` so they can be constructed once at boot with
 * clients (BigQuery, GitHub, IAM, \u2026) and a logger, then called many
 * times per request without reconstruction.
 */

import type { Logger } from 'pino';
import type { BigQuery } from '@google-cloud/bigquery';

export type ToolHandlerDeps = {
  /** pino child logger scoped to the current session+turn. */
  logger: Logger;
  /** BQ client authenticated as the generator's own runtime SA. */
  bq: BigQuery;
  /** Loaded data-catalog.json content. */
  catalog: Catalog;
};

/* ---------- catalog shape (mirrors scripts/build-catalog.js output) ---------- */

export type CatalogColumn = {
  name: string;
  type: string;
  mode?: string | null;
  description?: string | null;
};

export type CatalogTable = {
  tableId: string;
  type?: string;
  description?: string | null;
  numRows?: number | string;
  numBytes?: number | string;
  lastModifiedTime?: string;
  location?: string;
  columns: CatalogColumn[];
};

export type CatalogDataset = {
  description?: string | null;
  tables: Record<string, CatalogTable>;
};

export type Catalog = {
  project: string;
  generatedAt: string;
  datasets: Record<string, CatalogDataset>;
};

/* ---------- handler result envelope ---------- */

export type ToolOk<T = unknown> = {
  ok: true;
  result: T;
};

export type ToolErr = {
  ok: false;
  error: string;
  /** Optional error code for programmatic handling (e.g. 'needs_approval'). */
  code?: string;
};

export type ToolResult<T = unknown> = ToolOk<T> | ToolErr;

export type ToolHandler<I = unknown, O = unknown> = (
  input: I,
  deps: ToolHandlerDeps,
) => Promise<ToolResult<O>>;

export function ok<T>(result: T): ToolOk<T> {
  return { ok: true, result };
}

export function err(error: string, code?: string): ToolErr {
  return code ? { ok: false, error, code } : { ok: false, error };
}
