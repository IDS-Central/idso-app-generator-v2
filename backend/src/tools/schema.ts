/**
 * Typed tool registry for the generator's Anthropic tool-use loop.
 *
 * Each tool has:
 *   - name          : stable identifier the LLM will reference
 *   - description   : short sentence the LLM sees when picking tools
 *   - input_schema  : JSON Schema (draft-07 subset) describing parameters
 *   - side_effect   : 'read' | 'write' \u2014 write tools require user approval
 *                     before the loop executes them
 *
 * The shape of each entry matches what `@anthropic-ai/sdk` expects under
 *   `client.messages.create({ tools: [...] })`
 * so we can spread `toAnthropicTools()` directly into that payload.
 *
 * Handlers live in sibling files (`./bq`, `./iam`, `./github`, `./cloud`)
 * and are wired together by `./registry.ts` in a later commit.
 */

export type JsonSchema = {
  type?:
    | 'string'
    | 'number'
    | 'integer'
    | 'boolean'
    | 'object'
    | 'array'
    | 'null';
  description?: string;
  enum?: readonly string[];
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: unknown;
};

export type ToolSideEffect = 'read' | 'write';

export type ToolSpec = {
  readonly name: string;
  readonly description: string;
  readonly input_schema: JsonSchema;
  readonly side_effect: ToolSideEffect;
};

/* ---------- individual tool specs ---------- */

export const BQ_CATALOG_SEARCH: ToolSpec = {
  name: 'bq_catalog_search',
  description:
    'Search the reconciliation-dashboard BigQuery catalog. Returns datasets, tables, and columns whose names or descriptions match the query. Use this first whenever a user asks for data-driven apps so you know which tables exist before planning.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: {
        type: 'string',
        description:
          'Free-text query, e.g. "net production", "payroll", "bank txn", "gl journal". Matched against dataset/table/column names and descriptions.',
        minLength: 1,
        maxLength: 200,
      },
      limit: {
        type: 'integer',
        description: 'Maximum tables to return. Default 20, max 50.',
        minimum: 1,
        maximum: 50,
        default: 20,
      },
    },
    required: ['query'],
  },
  side_effect: 'read',
};

export const BQ_DESCRIBE_TABLE: ToolSpec = {
  name: 'bq_describe_table',
  description:
    'Return the full column list (name, type, mode, description) and catalog description for a single table in reconciliation-dashboard. Call this after bq_catalog_search to confirm a table has the fields you need.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      dataset: {
        type: 'string',
        description:
          'BigQuery dataset, e.g. "ADP_system", "Dentira_system", "PMS_system", "Sage_system_v2", "dim_mappings".',
        minLength: 1,
      },
      table: {
        type: 'string',
        description: 'Table name inside the dataset.',
        minLength: 1,
      },
    },
    required: ['dataset', 'table'],
  },
  side_effect: 'read',
};

export const BQ_DRY_RUN: ToolSpec = {
  name: 'bq_dry_run',
  description:
    'Validate a SQL query against reconciliation-dashboard via a BigQuery dry run. Returns success, bytes processed estimate, and error message if the query is invalid. Use to sanity-check generated SQL before surfacing it in a plan.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      sql: {
        type: 'string',
        description:
          'Standard SQL query. Must reference fully qualified tables as `reconciliation-dashboard.<dataset>.<table>`.',
        minLength: 1,
        maxLength: 20000,
      },
    },
    required: ['sql'],
  },
  side_effect: 'read',
};

export const IAM_CREATE_SA: ToolSpec = {
  name: 'iam_create_sa',
  description:
    'Create a per-app runtime service account named idso-<app_name>-runtime@reconciliation-dashboard.iam.gserviceaccount.com and grant it ONLY roles/bigquery.dataViewer + roles/bigquery.jobUser on the reconciliation-dashboard project. No other roles are ever attached. Requires user approval.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      app_name: {
        type: 'string',
        description:
          'Kebab-case app identifier, e.g. "doctor-net-production". Becomes the SA prefix.',
        pattern: '^[a-z][a-z0-9-]{1,28}[a-z0-9]$',
      },
    },
    required: ['app_name'],
  },
  side_effect: 'write',
};

export const GH_CREATE_REPO: ToolSpec = {
  name: 'gh_create_repo',
  description:
    'Create a new private GitHub repository under the IDS-Central org seeded from the idso-app-template. Returns the new repo URL and default branch. Requires user approval.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      app_name: {
        type: 'string',
        description:
          'Kebab-case app identifier. Becomes the repo name idso-app-<app_name>.',
        pattern: '^[a-z][a-z0-9-]{1,28}[a-z0-9]$',
      },
      description: {
        type: 'string',
        description:
          'One-line human description of what the generated app does.',
        maxLength: 200,
      },
    },
    required: ['app_name', 'description'],
  },
  side_effect: 'write',
};

export const CLOUDBUILD_CREATE_TRIGGER: ToolSpec = {
  name: 'cloudbuild_create_trigger',
  description:
    'Create a Cloud Build trigger in us-central1 that builds and deploys the generated app repo to Cloud Run on every push to main. Uses the project-standard naming idso-app-<app_name>-<env>. Requires user approval.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      app_name: {
        type: 'string',
        pattern: '^[a-z][a-z0-9-]{1,28}[a-z0-9]$',
        description: 'Kebab-case app identifier.',
      },
      env: {
        type: 'string',
        enum: ['dev', 'prod'],
        description:
          'Deployment environment. "dev" uses a -dev Cloud Run service suffix; "prod" uses no suffix.',
      },
      github_repo: {
        type: 'string',
        description:
          'Full GitHub repo path, e.g. "IDS-Central/idso-app-doctor-net-production".',
        pattern: '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$',
      },
    },
    required: ['app_name', 'env', 'github_repo'],
  },
  side_effect: 'write',
};

export const CLOUDRUN_DEPLOY: ToolSpec = {
  name: 'cloudrun_deploy',
  description:
    'Trigger an immediate Cloud Build run for an existing generated app (bypasses waiting for the next git push). Returns the build id. Requires user approval.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      app_name: {
        type: 'string',
        pattern: '^[a-z][a-z0-9-]{1,28}[a-z0-9]$',
      },
      env: {
        type: 'string',
        enum: ['dev', 'prod'],
      },
    },
    required: ['app_name', 'env'],
  },
  side_effect: 'write',
};

export const ASK_USER: ToolSpec = {
  name: 'ask_user',
  description:
    'Ask the human operator a clarifying question and pause the loop until they answer. Use this for ambiguous business metrics (e.g. "what counts as net production?") or when multiple candidate tables could satisfy a request. Do NOT use this to request permission for write tools \u2014 approvals happen automatically.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      question: {
        type: 'string',
        description:
          'The question to show the user. Be concrete and list the options you are choosing between if relevant.',
        minLength: 1,
        maxLength: 1000,
      },
    },
    required: ['question'],
  },
  side_effect: 'read',
};

/* ---------- registry ---------- */

export const TOOL_REGISTRY: readonly ToolSpec[] = [
  BQ_CATALOG_SEARCH,
  BQ_DESCRIBE_TABLE,
  BQ_DRY_RUN,
  IAM_CREATE_SA,
  GH_CREATE_REPO,
  CLOUDBUILD_CREATE_TRIGGER,
  CLOUDRUN_DEPLOY,
  ASK_USER,
] as const;

export type ToolName = (typeof TOOL_REGISTRY)[number]['name'];

/**
 * Shape Anthropic's tool-use API expects. Drop this directly into
 * `client.messages.create({ tools })`.
 */
export type AnthropicToolDef = {
  name: string;
  description: string;
  input_schema: JsonSchema;
};

export function toAnthropicTools(): AnthropicToolDef[] {
  return TOOL_REGISTRY.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

export function getTool(name: string): ToolSpec | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}

export function isWriteTool(name: string): boolean {
  const t = getTool(name);
  return t?.side_effect === 'write';
}
