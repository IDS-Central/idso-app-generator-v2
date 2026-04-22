# Phase Plan

Concrete tasks for each phase. Each task ends in a tangible deliverable.

---

## Phase 0 — Discovery — DONE

- [x] Read `IDS-Central/idso-app-template` end to end (scripts, CLAUDE.md, CLAUDE-standards.md, cloudbuild.yaml, Dockerfile, app.config.json).
- [ ] - [x] Sample 3–5 representative IDSO repos (`data-mapping`, `reconciliation-dashboard`, `apps-hub`, `sage-gl-sync`, `ids-pnl-forecaster`, `ids-reappt-notifier`, `ids-call-tracking`).
- [ ] - [x] Produce `docs/IDSO-APP-CONVENTIONS.md`.
- [ ] - [x] Propose initial tool schema (`docs/TOOL-SCHEMA.md`).
- [ ] - [x] Log locked decisions (`docs/DECISIONS.md`).

- [ ] Deliverable: this repo's `docs/` folder.

- [ ] ---

- [ ] ## Phase 1 — Backend skeleton

- [ ] Goal: a deployed Cloud Run backend service that (1) verifies Google ID tokens, (2) reads secrets, (3) can authenticate as the GitHub App, (4) logs structured events, (5) enforces per-user monthly token caps. No Anthropic loop yet; no tools yet.

- [ ] ### Phase 1 tasks

- [ ] 1. **Project scaffold.** Node 20 + TypeScript strict. Express or Fastify (pick one, document). `backend/package.json`, `backend/tsconfig.json`, `backend/Dockerfile` (node:20-alpine, multi-stage, port 8080, `/api/health`), `backend/src/index.ts`.
- [ ] 2. **`cloudbuild.yaml` for the backend.** Mirrors generated-app pattern.
- [ ] 3. **ID token verification middleware.** Verifies against Google JWKs, asserts `hd === 'independencedso.com'` and `email_verified`. Attaches `{authEmail, sub}` to the request context. Returns 401 JSON on failure.
- [ ] 4. **Secret Manager client.** Thin wrapper with 5-min cache (mirrors generated-app `src/lib/secrets.ts`). Loads `anthropic-api-key`, `github-app-id`, `github-app-private-key`, `github-app-installation-id`.
- [ ] 5. **GitHub App registration.** Register the App on `IDS-Central` via the GitHub App manifest flow (deliverable: `backend/github-app/manifest.json`). Document the install URL. Store credentials as secrets. Implement App → installation access token exchange in `backend/src/github/app.ts`.
- [ ] 6. **Structured Cloud Logging.** Every request logs `{authEmail, path, method, status, latencyMs, requestId}`. Use `@google-cloud/logging` or the structured JSON stdout → Cloud Logging path.
- [ ] 7. **Token-usage tracking store.** Append-only records `{authEmail, buildId, tokensIn, tokensOut, timestampMs}` written as log entries AND to a BigQuery table `ops.token_usage` for querying. Per-user monthly cap check on each request (configurable via `IDSO_USER_MONTHLY_CAP_TOKENS`).
- [ ] 8. **Health endpoint and `/whoami` endpoint.** `/api/health` returns `{data: {status: "healthy"}}`. `/api/whoami` returns `{data: {email, hd}}` when authenticated, 401 otherwise. Used to validate the auth pipeline end to end.
- [ ] 9. **Dedicated service account.** `idso-app-generator-v2@central-workspace.iam.gserviceaccount.com` with the permissions from `ARCHITECTURE.md`.
- [ ] 10. **Deploy manually** (one-time, by an admin) to `idso-app-generator-v2-backend-dev`.

- [ ] Phase 1 exit criteria:
- [ ] - A curl to `/api/health` returns 200 anonymously.
- [ ] - A curl to `/api/whoami` with a valid Workspace ID token returns the email.
- [ ] - A curl to `/api/whoami` with a non-Workspace ID token returns 401.
- [ ] - Cloud Logging shows structured entries for every request.

- [ ] ---

- [ ] ## Phase 2 — Tool layer and build loop

- [ ] Goal: the backend can accept a build request, run an Anthropic tool-use loop, enforce the plan-approval gate and budget caps, invoke every tool in `TOOL-SCHEMA.md`, stream progress to a caller, retry on build failure up to 3 times.

- [ ] ### Phase 2 tasks

- [ ] 1. **Typed tool schema.** Translate `docs/TOOL-SCHEMA.md` into JSON Schema + TypeScript types in `backend/src/tools/schema.ts`.
- [ ] 2. **Tool dispatcher.** `backend/src/tools/dispatch.ts`. Validates args, enforces `requiresApprovedPlan` and `requiresNoProjectWideSecretAccessor` rules, logs the call, invokes the implementation. Rejects unknown tools.
- [ ] 3. **Tool implementations.** One file per tool family:
- [ ]    - `backend/src/tools/github.ts` — all `github_*` tools via Octokit authenticated as the GitHub App.
- [ ]       - `backend/src/tools/secrets.ts` — `secret_*` tools via `@google-cloud/secret-manager`.
- [ ]      - `backend/src/tools/iam.ts` — `iam_*` tools via `@google-cloud/iam` and Resource Manager.
- [ ]     - `backend/src/tools/cloudrun.ts` — `cloud_run_*` tools via `@google-cloud/run`.
- [ ]    - `backend/src/tools/cloudbuild.ts` — `cloud_build_*` tools via `@google-cloud/cloudbuild`.
- [ ]       - `backend/src/tools/sql.ts` — `sql_*` tools via Cloud SQL Admin API.
- [ ]      - `backend/src/tools/bq.ts` — `bq_*` tools via `@google-cloud/bigquery`.
- [ ]     - `backend/src/tools/oauth.ts` — `oauth_add_redirect_uri` via GCP OAuth Brand API.
- [ ]    - `backend/src/tools/logs.ts` — `read_build_logs`, `read_cloud_run_logs`.
- [ ]       - `backend/src/tools/sandbox.ts` — `run_in_build_sandbox` via Cloud Run Jobs.
- [ ]      - `backend/src/tools/plan.ts` — `plan_present` and budget tools.
- [ ]     - `backend/src/tools/ownership.ts` — `list_user_apps`, `write_owner_file`.
- [ ] 4. **Anthropic tool-use loop.** `backend/src/loop/run.ts`. Streaming. Load system prompt from `IDSO-APP-CONVENTIONS.md` + role-specific instructions. On `tool_use` stop reason, dispatch tools, append results, loop. On `end_turn`, exit.
- [ ] 5. **Plan-approval gate.** Dispatcher rejects mutating tools until a `plan_approved` event has arrived for the current build. Plan object stored in an in-memory + BigQuery-backed session store keyed by `buildId`.
- [ ] 6. **Build session store.** `builds` table in BigQuery: `{buildId, authEmail, startedAt, endedAt, status, plan, tokensUsed, tokensCost, finalRepoUrl, finalCloudRunUrl}`.
- [ ] 7. **Streaming endpoint.** `POST /api/builds` — accepts user's description, starts a build, returns an SSE stream. Event types: `plan_proposed`, `plan_approved`, `plan_rejected`, `tool_call_started`, `tool_call_completed`, `tool_call_failed`, `budget_soft_cap_hit`, `build_succeeded`, `build_failed`. Also supports resumption: `POST /api/builds/{id}/approve-plan`, `POST /api/builds/{id}/continue` (for budget re-approval), `POST /api/builds/{id}/cancel`.
- [ ] 8. **Retry/repair loop.** On `cloud_build_wait` returning FAILURE, automatically call `read_build_logs`, append log tail to the conversation, let Claude propose a fix, commit it, resubmit. Bounded to 3 repair attempts per build.
- [ ] 9. **Post-deploy verification.** After `cloud_run_deploy` + successful `/api/health`, call `cloud_run_curl_protected` on `/api/app/anything`. Require 401. If 200, roll back revision and fail the build.
- [ ] 10. **Tests.** Unit tests for tool validators. Integration test: a dry-run build that only uses `plan_present` and read-only tools, run against real Anthropic API.

- [ ] Phase 2 exit criteria:
- [ ] - A build request that says "list my apps" runs end to end without mutations, returns a list.
- [ ] - A build request that says "create a supply-requests app" produces a plan, blocks on approval, and (on approval in a test harness) creates a real repo, provisions a real Cloud SQL DB, deploys a real Cloud Run service, and the resulting URL returns 200 on `/api/health` and 401 on a protected path.
- [ ] - A deliberate syntax error injected into a generated file causes a Cloud Build failure that the repair loop fixes.

- [ ] ---

- [ ] ## Phase 3 — Frontend

- [ ] Goal: real users can sign in, describe an app, approve a plan, watch it build, and see their apps.

- [ ] ### Phase 3 tasks

- [ ] 1. **Frontend scaffold.** Next.js App Router, TypeScript strict, Tailwind. Same auth conventions as generated apps (`src/lib/auth.ts`, `src/lib/session.ts`, `src/middleware.ts` copied verbatim).
- [ ] 2. **Login flow.** `/login`, `/api/auth/login`, `/api/auth/authorize`, `/api/auth/logout`, `/api/auth/me`. Uses shared IDSO OAuth client.
- [ ] 3. **Chat page.** `/` — chat UI with input, streaming response area, plan approval card, approve/reject buttons. Connects to backend's `/api/builds` SSE.
- [ ] 4. **Streaming tool call timeline.** Each `tool_call_started` / `tool_call_completed` event renders as a row: tool name, status icon, collapsible result. Friendly language — not raw JSON.
- [ ] 5. **Budget re-approval modal.** Shown on `budget_soft_cap_hit`. Shows tokens used, estimated remaining cost, continue/cancel buttons.
- [ ] 6. **"Your apps" dashboard.** `/apps` — lists repos from `list_user_apps`. Each card shows name, description, Cloud Run URL, last modified.
- [ ] 7. **App detail view.** `/apps/{repo}` — shows repo details, deploy history (from Cloud Run revisions), link to open a new chat scoped to that app for modifications.
- [ ] 8. **Error recovery UX.** Failed build page: plain-English summary, excerpt of the log that caused it, "retry," "revise plan," and "contact admin" buttons.
- [ ] 9. **Dockerfile + cloudbuild.yaml** for the frontend. Deploy to `idso-app-generator-v2-frontend-dev` and `-prod`.

- [ ] Phase 3 exit criteria:
- [ ] - A non-technical IDSO staffer signs in, types "I need a form to collect supply requests for each practice and approve them weekly," sees a plan, clicks approve, watches the build stream, receives a working Cloud Run URL at the end.
- [ ] - "Your apps" shows the created app.

- [ ] ---

- [ ] ## Phase 4 — Polish

- [ ] ### Phase 4 tasks

- [ ] 1. **Admin endpoint for departed users.** List repos where `createdBy` is a user no longer in Workspace. Admin can transfer collaborator permissions or mark repos as orphaned. No deletes.
- [ ] 2. **Per-user cost reporting.** `/admin/usage` — monthly totals per user from the `token_usage` log.
- [ ] 3. **Error recovery polish.** Retry from saved checkpoint rather than start-over when possible.
- [ ] 4. **End-user documentation.** `/help` in the app. A short "what to ask for" guide, a "what the generator will and won't do" page, a "how to modify an existing app" guide.
- [ ] 5. **Python pipeline archetype.** Add `python:3.12-slim` Dockerfile, authlib/Flask auth pattern, Pub/Sub trigger wiring as a second archetype. Update the plan schema to accept `archetype: "nextjs_web"|"python_pipeline"`. Update system prompt.
- [ ] 6. **Teardown tools (admin only).** `admin_delete_repo`, `admin_delete_cloud_run_service`, `admin_revoke_app_sa_bindings`. Behind a separate `roles/roles/idso.generatorAdmin` IAM check.
- [ ] 7. **Cost caps per org and per month.** Hard stop at monthly aggregate budget with admin alert.

- [ ] ---

- [ ] ## Open items tracked outside phases

- [ ] - **Model selection revisit.** After Phase 2 has real data, revisit Sonnet vs. Opus for planning (D-012).
- [ ] - **Backend language revisit.** At start of Phase 1, confirm Node/TS vs. Python/FastAPI (D-011).
- [ ] - **OAuth brand permission minimum.** Phase 1 discovery: find the narrowest IAM role that allows adding authorized redirect URIs without allowing creating new OAuth clients. If no such role exists, document workaround.
- [ ] 
