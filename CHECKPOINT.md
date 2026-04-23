# idso-app-generator-v2  Deployment Checkpoint

> This file is the single source of truth for deployment state. Update it every
> time the deployed surface changes (new image, service rename, new secret, etc.).

## Status: Backend scaffold + CI/CD live; data catalog committed with dataset+table descriptions overlay. Phase 2 engine build in progress: tool registry + all four read-tool handlers shipped and green in CI. Next: BQ-backed session store, then the Anthropic tool-use loop, then the SSE chat endpoint, then write-tool handlers.

## Project
- GCP project display name: `central-workspace`
- GCP project **ID** (use in commands): `reconciliation-dashboard`
- PROJECT_NUMBER: `142054839786`
- REGION: `us-central1`
- BACKEND_SA: `idso-app-generator-v2@reconciliation-dashboard.iam.gserviceaccount.com`
- GitHub org/repo: `IDS-Central/idso-app-generator-v2`

## Backend Service (Cloud Run)  renamed per CLAUDE.md convention
- Service name: `idso-app-generator-v2-backend-dev`
- Current revision: `idso-app-generator-v2-backend-dev-00001-xx9` (100% traffic)
- Current image: `us-central1-docker.pkg.dev/reconciliation-dashboard/idso-apps/app-generator-v2-backend:dd46005`
- Service URL: `https://idso-app-generator-v2-backend-dev-142054839786.us-central1.run.app`
- Ingress: internal + authenticated (default; invoker required)
- Invoker: `user:nghia@independencedso.com`

### Env vars on the service (not prefixed IDSO_  code reads these names directly)
- `PROJECT_ID=reconciliation-dashboard`
- `REGION=us-central1`
- `ALLOWED_HD=independencedso.com`
- `GITHUB_APP_ID=3469712`
- `GITHUB_APP_CLIENT_ID=Iv23liENpmH0xcNIoxzY`
- `GITHUB_APP_INSTALLATION_ID=126241513`
- `GOOGLE_OAUTH_CLIENT_ID_SECRET=oauth-client-id`           (Secret Manager secret name)
- `GOOGLE_OAUTH_CLIENT_SECRET_SECRET=oauth-client-secret`   (Secret Manager secret name)
- `ANTHROPIC_API_KEY_SECRET=anthropic-api-key`              (Secret Manager secret name)
- `GITHUB_APP_CLIENT_SECRET_SECRET=github-app-client-secret`(Secret Manager secret name)
- `GITHUB_APP_PRIVATE_KEY_SECRET=github-app-private-key`    (Secret Manager secret name)
- `LOG_LEVEL=info`

Backend code fetches the secret *values* from Secret Manager at startup using
these env vars as secret names, rather than using Cloud Run's valueFrom bindings.

### Secrets in Secret Manager
- `anthropic-api-key`
- `oauth-client-id`  (Web OAuth client used for ID-token audience verification)
- `oauth-client-secret`
- `github-app-client-secret`
- `github-app-private-key`

## Endpoints verified
- `GET /livez`  200 `{"status":"ok"}` (unauthenticated liveness probe; authed invoker required to reach)
- `GET /me`     401 `{"error":"verify_failed"}` when called with a gcloud ID token  CORRECT.
                 Will return the user profile when called with a real Web-OAuth ID
                 token from the frontend (audience = `oauth-client-id` value).

## GFE interception bug (resolved)
Google Front End intercepts the exact path `/healthz` on `*.run.app` URLs and
returns an HTML 404 before the request reaches the container. Renamed the route
to `/livez`. `/HEALTHZ` (uppercase), `/livez`, `/health`, `/ping` all reach the
container  only the literal lowercase `/healthz` is intercepted.

## Git state
- Local commit on `main`: `dd46005`  fix(backend): rename /healthz to /livez
  (GFE intercepts /healthz); cloudbuild logging + TS logger casts
- **Pushed to origin/main** (commits dd46005 + ddf8f36) on 2026-04-22 via gh auth (account `ids-nghia-dang`).

## Cloud Build
- Config: `backend/cloudbuild.yaml`
- Correct invocation (must pass substitution):
  ```
  gcloud builds submit --config=backend/cloudbuild.yaml \
    --substitutions=_IMAGE_TAG=$(git rev-parse --short HEAD) \
    backend
  ```
- **GitHub trigger live**: `idso-app-generator-v2-backend-dev` (us-central1) on push to main with filter `backend/**`. Uses SA `idso-app-generator-v2@`. Substitution `_IMAGE_TAG=$SHORT_SHA`. First successful build: commit 3be4c43 (2026-04-23), revision `idso-app-generator-v2-backend-dev-00002-9vp`.

## Cloud Run redeploy (minimal  reuses existing env/secret bindings)
```
gcloud run deploy idso-app-generator-v2-backend-dev \
  --region=us-central1 \
  --image=us-central1-docker.pkg.dev/reconciliation-dashboard/idso-apps/app-generator-v2-backend:<TAG> \
  --quiet
```

## Phase 3  Frontend scope (see docs/PHASE-PLAN.md and frontend/README.md)
- Next.js App Router, TypeScript strict, Tailwind, Node 20 alpine
- Service name target: `idso-app-generator-v2-frontend-dev`
- Routes: `/`, `/login`, `/apps`, `/apps/[repo]`, `/api/auth/{login,authorize,logout,me}`
- Components: chat/ChatInput, chat/StreamingTimeline, chat/PlanApprovalCard,
  chat/BudgetReapprovalModal, apps/AppCard
- Lib: auth.ts, session.ts, backend.ts (typed SSE client), middleware.ts
- Auth: `google-auth-library` server-side, `hd=independencedso.com`,
  `idso_session` AES-256-GCM cookie

## Data catalog (Phase 1.5, 2026-04-23)

Snapshot of the BigQuery warehouse at `reconciliation-dashboard` is now part of the repo:

- `docs/DATA-CATALOG.md` - human-readable inventory.
- `docs/data-catalog.json` - machine-readable, will be loaded by the generator at plan time.
- `scripts/build-catalog.js` - converts raw `bq show --format=prettyjson` files into the catalog artifacts.
- `scripts/refresh-catalog.sh` - end-to-end: `bq ls` + `bq show` + builder. Re-run whenever the warehouse schema changes.

Initial snapshot: 5 datasets (`ADP_system`, `Dentira_system`, `PMS_system`, `Sage_system_v2`, `dim_mappings`), 80 tables, 764 columns. Built at commit `d0a7b12`.

New rules added to `docs/IDSO-APP-CONVENTIONS.md`:
- Every generated app gets its own runtime SA with `roles/bigquery.dataViewer` + `roles/bigquery.jobUser` only, scoped to `reconciliation-dashboard`.
- Authenticated users are assumed to be corporate-level staff and see all data (no RLS, no practice-level scoping).
- Claude must ask the user for an explicit formula whenever a business metric is ambiguous (e.g., "net production"), and must capture the answer as a commented SQL view in the generated repo.

These rules change Phase 2 scope: the tool list must include `bq_catalog_search` / `bq_describe_table` so Claude can ground plans in real tables, and `iam_create_sa` must provision per-app runtime SAs with the warehouse read roles.


## Phase 2 engine (2026-04-23)

Option A (the catalog-aware tool-use backend) is underway.  Three commits on main so far, all green in Cloud Build:

- `193a700` feat(backend): typed tool registry for Anthropic tool-use loop
  - `backend/src/tools/schema.ts` defines eight tool specs tagged read|write:
    - read: `bq_catalog_search`, `bq_describe_table`, `bq_dry_run`, `ask_user`
    - write: `iam_create_sa`, `gh_create_repo`, `cloudbuild_create_trigger`, `cloudrun_deploy`
  - `toAnthropicTools()` exports the shape `client.messages.create({ tools })` expects.
  - `isWriteTool()` drives the loop's approval gate (write tools pause for user approval).
  - No npm deps added; pure TypeScript types.

- `c5d2e96` feat(backend): read-tool handlers
  - `backend/src/tools/types.ts` — `ToolHandler` interface + `Catalog` type matching the `scripts/build-catalog.js` output shape (`datasets` is keyed by dataset name, `tables` is keyed by table name).
  - `backend/src/tools/bq.ts` — three real handlers plus `loadCatalog()` (dev: reads `src/tools/data-catalog.json`; prod: reads `dist/tools/data-catalog.json`).
  - `backend/src/tools/ask.ts` — ask_user handler returning `{ pending: true, question }`.
  - `backend/src/tools/registry.ts` — `dispatch(name, input, deps)` routing known tools to handlers, returning a clear `not_implemented` error for write tools until commit 2b.
  - `backend/src/tools/data-catalog.json` — embedded copy of `docs/data-catalog.json` so the container is self-contained.
  - Dependency bump: `@google-cloud/bigquery` `^7.9.0`.
  - Dockerfile: copies `src/tools/*.json` into `dist/tools/` during the build stage so `loadCatalog()` finds the file at runtime.
  - Sanity-tested locally: `bq_catalog_search({query:"payroll"})` returns 6 hits, top hit is `ADP_system.adp_payroll_output` with the overlay description.

### Phase 2 commits still to ship

1. BQ-backed session store (commit 3): dataset `idso_app_generator`, tables `sessions` and `turns`, write-ahead semantics so every tool call is durable and replayable across request boundaries.
2. Anthropic tool-use loop (commit 4): wraps `messages.create` in a plan → approve → execute loop, calls the dispatcher, persists every step through the session store.
3. SSE chat endpoint (commit 5): `POST /chat` that streams `thought` / `tool_call` / `tool_result` / `approval_needed` / `ask_user` events.
4. Write-tool handlers (commit 2b — deferred until after the approval-gated loop is in place): `iam_create_sa`, `gh_create_repo`, `cloudbuild_create_trigger`, `cloudrun_deploy`.

### Known gaps

- Two PMS_system tables (`BankPayerList_Normalised`, `BankTxn_Normalised`) lack descriptions in the catalog overlay. Everything else in the warehouse (78 of 80 tables) has dataset- and table-level descriptions.
- The backend image is now ~3x the size it was after the BQ client was added; acceptable for dev, worth revisiting if cold starts regress.

### Phase 2 commit 4 (2026-04-23): Anthropic tool-use loop + bootstrap on boot

**Commit:** `b2b1cbb` `feat(backend): Anthropic tool-use loop with approval gating + bootstrap session store on boot`
**Build:** `caa9f25e-1390-449d-b04f-a7bc4a0a74ce` SUCCESS
**Revision:** `idso-app-generator-v2-backend-dev-00006-rcr` (deployed 2026-04-23T04:07:28Z)

**What landed:**

- `backend/src/agent/loop.ts` (new, 239 lines)
  - `runAgentLoop({anthropic, logger, store, toolDeps, systemPrompt, model?}, sessionId): Promise<LoopResult>`
  - Hydrates message history from `session_turns` each iteration  **stateless caller, all state in BQ**
  - Read tools dispatched immediately via `dispatch(name, input, toolDeps)`
  - Write tools require an `approved` row in `session_turns` (role=`approval`) keyed by `tool_use_id`; otherwise returns `{status: 'awaiting_approval', toolUseId, toolName, toolInput}` and pauses
  - Returns `{status: 'completed', finalText}` when the model stops calling tools
  - Hard ceiling `MAX_ITERATIONS=12` to prevent infinite spin
  - Persists every step (`assistant`, `tool_call`, `tool_result`) via `SessionStore.appendTurn`

- `backend/src/index.ts` boot sequence now:
  1. `loadConfig()`
  2. `createRootLogger()`
  3. `loadSecrets()`
  4. `new BigQuery({projectId})`
  5. **`await bootstrapSessionStore({bq, logger})`**  creates dataset + tables idempotently
  6. **`new SessionStore({bq, logger, project, dataset: config.sessionDataset})`**
  7. `createAnthropicClient()` (now exposes `.client` alongside `.ping`)
  8. `createAuth()`
  9. Routes + `app.listen()`

- `backend/src/anthropic.ts`: `createAnthropicClient` returns `{ ping, client }` so the loop can call `client.messages.create`.
- `backend/src/config.ts`: new `Config.sessionDataset: string` field, env `SESSION_DATASET`, default `'idso_app_generator'`.

**Runtime verification (revision 00006-rcr logs):**

```
boot_config_loaded
boot_secrets_loaded
session_store_ready          <-- bootstrap succeeded
boot_listening
Server listening at http://0.0.0.0:8080
```

**BQ verification:**

```
$ bq ls reconciliation-dashboard:idso_app_generator
  tableId   Type    Time Partitioning            Clustered Fields
  --------- ------- ---------------------------- --------------------------
  sessions  TABLE   DAY (field: created_at)      user_email, session_id
  turns     TABLE   DAY (field: created_at)      session_id, turn_number
```

**TypeScript fixes applied during commit 4 development:**

- `dispatch()` is **positional** `(name, input, deps)`, not destructured
- `getLatestApproval()` returns `TurnRow | null` (the row), not the approval state directly  extract via `row?.approval_state`
- `Config` interface in `config.ts` had to be extended (not just the loader)  TS error TS2353
- `ToolHandlerDeps` lives in `tools/types.ts`, not `tools/registry.ts`

**Phase 2 commits remaining:**

- Commit 5 of 6: SSE chat endpoint that exposes `runAgentLoop()` over `/v1/chat/:sessionId/stream` (GET) + `/v1/chat/:sessionId/turn` (POST) + `/v1/chat/:sessionId/approve` (POST)
- Commit 2b (deferred): Write-tool handlers (IAM SA create, GitHub repo create, Cloud Build trigger create, Cloud Run deploy)
- Commit 6 of 6: Final CHECKPOINT + PHASE-PLAN update + smoke-test recipe

**Open items / known gaps:**

- Backend SA already has BQ Admin (user confirmed 2026-04-23)  bootstrap works end-to-end
- Loop currently uses a placeholder `systemPrompt` from caller; commit 5 will wire the real generator-aware prompt that references the catalog
- 2 PMS_system tables (`BankPayerList_Normalised`, `BankTxn_Normalised`) still without descriptions in the catalog (intentional gap, see Phase 1.6)

