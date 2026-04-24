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

export const SECRET_CREATE: ToolSpec = {
  name: 'secret_create',
  description:
    'Create a Secret Manager secret in reconciliation-dashboard with automatic replication. Idempotent on ALREADY_EXISTS. If initial_value is provided, also adds an initial version.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      secret_id: {
        type: 'string',
        description: 'Secret ID (letters, digits, _ and - allowed). Becomes projects/PROJECT/secrets/<id>.',
        pattern: '^[a-zA-Z_][a-zA-Z0-9_-]{0,254}$',
      },
      initial_value: {
        type: 'string',
        description: 'Optional UTF-8 plaintext to store as the first version.',
        maxLength: 65536,
      },
    },
    required: ['secret_id'],
  },
  side_effect: 'write',
};

export const SECRET_ADD_VERSION: ToolSpec = {
  name: 'secret_add_version',
  description:
    'Add a new version (UTF-8 plaintext payload) to an existing Secret Manager secret.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      secret_id: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_-]{0,254}$' },
      value: { type: 'string', minLength: 1, maxLength: 65536 },
    },
    required: ['secret_id', 'value'],
  },
  side_effect: 'write',
};

export const SECRET_ACCESS: ToolSpec = {
  name: 'secret_access',
  description:
    'Access the payload of a Secret Manager secret version. Default version is "latest".',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      secret_id: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_-]{0,254}$' },
      version: { type: 'string', description: 'Version id or "latest". Defaults to "latest".' },
    },
    required: ['secret_id'],
  },
  side_effect: 'read',
};

export const LIST_USER_APPS: ToolSpec = {
  name: 'list_user_apps',
  description:
    'List all idso-app-* Cloud Run services in the project. Returns app name, env (dev/prod), service name, URL, and latest ready revision for each.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
  side_effect: 'read',
};

export const WRITE_OWNER_FILE: ToolSpec = {
  name: 'write_owner_file',
  description:
    'Write or overwrite .idso/owner.json in the IDS-Central/idso-app-<app_name> GitHub repo. Records owner email and notes for provenance across sessions.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      app_name: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,28}[a-z0-9]$' },
      owner_email: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', maxLength: 254 },
      notes: { type: 'string', maxLength: 1000 },
    },
    required: ['app_name', 'owner_email'],
  },
  side_effect: 'write',
};

export const READ_BUILD_LOGS: ToolSpec = {
  name: 'read_build_logs',
  description:
    'Read Cloud Logging entries for a specific Cloud Build id. Returns the most recent log lines ordered newest-first.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      build_id: { type: 'string', pattern: '^[0-9a-f-]{16,64}$', description: 'Cloud Build build id (UUID).' },
      limit: { type: 'integer', minimum: 1, maximum: 1000, default: 200 },
    },
    required: ['build_id'],
  },
  side_effect: 'read',
};

export const READ_CLOUD_RUN_LOGS: ToolSpec = {
  name: 'read_cloud_run_logs',
  description:
    'Read Cloud Logging entries for a specific Cloud Run service. Optionally scope to a single revision_name. Returns the most recent log lines ordered newest-first.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      service_name: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,62}[a-z0-9]$' },
      revision_name: { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,63}$' },
      limit: { type: 'integer', minimum: 1, maximum: 1000, default: 200 },
    },
    required: ['service_name'],
  },
  side_effect: 'read',
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
  SECRET_CREATE,
  SECRET_ADD_VERSION,
  SECRET_ACCESS,
  LIST_USER_APPS,
  WRITE_OWNER_FILE,
  READ_BUILD_LOGS,
  READ_CLOUD_RUN_LOGS,
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
