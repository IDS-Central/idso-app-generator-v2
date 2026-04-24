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
  minItems?: number;
  maxItems?: number;
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

export const PLAN_PRESENT: ToolSpec = {
  name: 'plan_present',
  description:
    'Present a structured build plan to the user for review. Returns a plan_id and a rendered markdown summary. This is a read-only surfacing tool; actual plan_approved gating happens out-of-band via /approve.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      app_name: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,28}[a-z0-9]$' },
      summary: { type: 'string', maxLength: 2000 },
      steps: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            tool: { type: 'string', maxLength: 100 },
            summary: { type: 'string', maxLength: 500 },
            side_effect: { type: 'string', enum: ['read', 'write'] },
          },
          required: ['tool', 'summary', 'side_effect'],
        },
      },
      estimated_monthly_cost_usd: { type: 'number', minimum: 0, maximum: 1000000 },
      required_confirmations: { type: 'array', items: { type: 'string', maxLength: 200 }, maxItems: 20 },
    },
    required: ['app_name', 'steps'],
  },
  side_effect: 'read',
};

export const BUDGET_CHECK: ToolSpec = {
  name: 'budget_check',
  description:
    'Best-effort month-to-date usage tally for an app_name, computed from the local builds table. Returns ok even when tally is unavailable (note field carries the reason).',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      app_name: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,28}[a-z0-9]$' },
      month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'YYYY-MM; defaults to current UTC month.' },
    },
    required: ['app_name'],
  },
  side_effect: 'read',
};

export const OAUTH_ADD_REDIRECT_URI: ToolSpec = {
  name: 'oauth_add_redirect_uri',
  description:
    'Add a redirect URI to the existing GCP OAuth 2.0 Client (IAM OAuth Clients API) so the generated app can complete OAuth flows. Idempotent if the URI is already present.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      client_id: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,128}$', description: 'OAuth client id (last segment of oauthClients/<id>).' },
      redirect_uri: { type: 'string', pattern: '^https?://[^\\s]{1,2000}$', maxLength: 2048 },
    },
    required: ['client_id', 'redirect_uri'],
  },
  side_effect: 'write',
};

export const RUN_IN_BUILD_SANDBOX: ToolSpec = {
  name: 'run_in_build_sandbox',
  description:
    'Trigger an ephemeral Cloud Run Job execution inside the pre-provisioned idso-build-sandbox template. Use for short build steps that need shell tooling outside Cloud Build (e.g. prisma migrate checks, static analysis). Returns execution_name and initial state.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      script: { type: 'string', minLength: 1, maxLength: 16384, description: 'Bash script to execute. Runs under /bin/bash -c.' },
      env: {
        type: 'object',
        additionalProperties: { type: 'string', maxLength: 4096 },
        description: 'Environment variables. Keys must match ^[A-Z][A-Z0-9_]{0,63}$.',
      },
      timeout_seconds: { type: 'integer', minimum: 30, maximum: 900, default: 300 },
    },
    required: ['script'],
  },
  side_effect: 'write',
};

export const SQL_CREATE_INSTANCE: ToolSpec = {
  name: 'sql_create_instance',
  description:
    'Create a Cloud SQL PostgreSQL instance in us-central1. Long-running (5-10 minutes). Idempotent on ALREADY_EXISTS. Returns the operation_name to poll.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      instance_name: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,79}$' },
      tier: { type: 'string', pattern: '^db-[a-z0-9-]{2,60}$', default: 'db-f1-micro', description: 'Cloud SQL tier; e.g. db-f1-micro, db-custom-1-3840.' },
      database_version: { type: 'string', pattern: '^POSTGRES_[0-9]{2}$|^MYSQL_[0-9]_[0-9]$', default: 'POSTGRES_15' },
      root_password: { type: 'string', minLength: 12, maxLength: 128, description: 'Initial root/postgres password. Store in Secret Manager separately.' },
    },
    required: ['instance_name', 'root_password'],
  },
  side_effect: 'write',
};

export const SQL_CREATE_DATABASE: ToolSpec = {
  name: 'sql_create_database',
  description:
    'Create a database inside an existing Cloud SQL instance. Idempotent on ALREADY_EXISTS.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      instance_name: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,79}$' },
      database_name: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_]{0,62}$' },
    },
    required: ['instance_name', 'database_name'],
  },
  side_effect: 'write',
};

export const SQL_CREATE_USER: ToolSpec = {
  name: 'sql_create_user',
  description:
    'Create a user on an existing Cloud SQL instance. Either pass iam_email (IAM-authenticated user, preferred for service accounts) OR user_name+password (built-in user). Idempotent on ALREADY_EXISTS.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      instance_name: { type: 'string', pattern: '^[a-z][a-z0-9-]{0,79}$' },
      iam_email: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', description: 'For IAM-authenticated users; auto-detects service accounts.' },
      user_name: { type: 'string', pattern: '^[a-zA-Z_][a-zA-Z0-9_.-]{0,62}$' },
      password: { type: 'string', minLength: 12, maxLength: 128, description: 'Required when user_name is used (no iam_email).' },
    },
    required: ['instance_name'],
  },
  side_effect: 'write',
};

export const CLOUD_RUN_CURL_PROTECTED: ToolSpec = {
  name: 'cloud_run_curl_protected',
  description:
    'Hit a Cloud Run endpoint with no auth and assert it returns a specific status code (default 401). Post-deploy guard that confirms a protected route is actually protected. Fails loudly if the wrong status is returned.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      url: { type: 'string', pattern: '^https://[^\\s]{1,2048}$', description: 'Full https URL of the protected endpoint.' },
      expected_status: { type: 'integer', minimum: 100, maximum: 599, default: 401 },
    },
    required: ['url'],
  },
  side_effect: 'read',
};

export const CLOUD_RUN_CURL_HEALTH: ToolSpec = {
  name: 'cloud_run_curl_health',
  description:
    'Hit a Cloud Run /api/health endpoint and assert HTTP 200. Lightweight post-deploy smoke test.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      url: { type: 'string', pattern: '^https://[^\\s]{1,2048}$' },
    },
    required: ['url'],
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

export const CLOUD_BUILD_WAIT: ToolSpec = {
  name: 'cloud_build_wait',
  description:
    'Poll a Cloud Build build_id until it reaches a terminal state (SUCCESS, FAILURE, INTERNAL_ERROR, TIMEOUT, CANCELLED, EXPIRED) or the client-side timeout elapses. Read-only: safe to call without approval.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      build_id: {
        type: 'string',
        description: 'Cloud Build build id to poll.',
      },
      timeout_sec: {
        type: 'number',
        description:
          'Client-side polling timeout in seconds. Default 900 (15 min), hard ceiling 1800 (30 min).',
      },
    },
    required: ['build_id'],
  },
  side_effect: 'read',
};

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
  PLAN_PRESENT,
  BUDGET_CHECK,
  OAUTH_ADD_REDIRECT_URI,
  RUN_IN_BUILD_SANDBOX,
  SQL_CREATE_INSTANCE,
  SQL_CREATE_DATABASE,
  SQL_CREATE_USER,
  CLOUD_RUN_CURL_PROTECTED,
  CLOUD_RUN_CURL_HEALTH,
  ASK_USER,
  CLOUD_BUILD_WAIT,
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
