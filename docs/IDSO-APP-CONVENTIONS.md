# IDSO App Conventions

This is the authoritative conventions document the v2 generator uses when planning and building new apps. It is loaded into the backend's system prompt for Claude. Every generated app must conform; deviations require explicit user approval at the plan stage.

This doc merges `CLAUDE-standards.md` from v1, the rules from the v2 project brief, and observed patterns in existing IDSO repos (with legacy repos excluded where they diverge).

---

## 1. Organization constants

| Constant | Value |
|---|---|
| GCP project | `central-workspace` |
| Region | `us-central1` |
| GitHub org | `IDS-Central` |
| Artifact Registry | `us-central1-docker.pkg.dev/central-workspace/idso-apps` |
| Shared Cloud SQL instance | `idso-shared` (Postgres 15) |
| Shared OAuth client | one OAuth Client ID used by all IDSO apps, set to "Internal" in GCP Console |
| Allowed email domain | `independencedso.com` |
| Package manager | `npm` |

## 2. Naming rules

### Repo name
- Pattern: `idso-{app-name}`.
- - App name regex: `^[a-z][a-z0-9-]{2,29}$` (lowercase, hyphens, 3–30 chars, starts with a letter).
  - - Always private.
    - - Always in `IDS-Central` org.
      - - **Legacy repos** in the org that don't follow `idso-*` (e.g. `data-mapping`, `reconciliation-dashboard`, `apps-hub`, `sage-gl-sync`, `ids-*`) predate v2 and are not managed by the generator.
       
        - ### Cloud Run service name
        - - Pattern: `{app}-{service}-{env}`.
          - - Default single-service app: `{app}-app-dev`.
            - - Multi-service app: `{app}-{role}-{env}` (e.g. `pipelines-sage-api-sync-dev`).
              - - Never include version numbers. Use Cloud Run revisions for versioning and rollbacks.
               
                - ### Service account
                - - Pattern: `idso-{app}@central-workspace.iam.gserviceaccount.com`.
                  - - One per app.
                   
                    - ### Database (if Cloud SQL tier chosen)
                    - - Database name: `idso_{app_underscored}` (hyphens replaced with underscores).
                      - - DB user: same as database name.
                       
                        - ### Secrets
                        - - Per-app: `{app}-{secret-name}` (e.g. `{app}-db-url`, `{app}-encryption-key`).
                          - - Per-app session key: `idso-{app}-secret-key`.
                            - - Shared: `idso-oauth-client-id`, `idso-oauth-client-secret`.
                              - - Backend-only (not per-app): `anthropic-api-key`, `github-app-id`, `github-app-private-key`, `github-app-installation-id`.
                               
                                - ### Env vars
                                - - Prefix: `IDSO_`.
                                  - - Exceptions: `SECRET_KEY`, `SESSION_LIFETIME_HOURS`.
                                    - - Never commit `.env` files. `.env.example` with placeholders is fine.
                                     
                                      - ## 3. Stack — default archetype (Next.js web app)
                                     
                                      - - Next.js (App Router) with TypeScript `"strict": true`, no `any`.
                                        - - React with Tailwind CSS.
                                          - - Backend/API: Next.js API routes in the same repo.
                                            - - ORM (if Cloud SQL tier): Prisma.
                                              - - BigQuery client (if BQ tier): `@google-cloud/bigquery`.
                                                - - Dockerfile: `node:20-alpine`, multi-stage, port 8080, standalone output.
                                                  - - Cloud Run: `--allow-unauthenticated` at the infra level; auth is enforced entirely by the app's middleware.
                                                    - - Cloud Build trigger on push to `main`.
                                                     
                                                      - ## 4. Stack — secondary archetype (Python pipeline), deferred to Phase 4
                                                     
                                                      - - `python:3.12-slim` base image.
                                                        - - Used only for data pipelines / ETL / Pub-Sub-triggered workers.
                                                          - - Not supported by v2 in Phases 1–3. The plan-approval gate rejects pipeline requests until the Phase 4 work lands.
                                                           
                                                            - ## 5. Auth (required in every generated Next.js app)
                                                           
                                                            - - Google OAuth 2.0 via `google-auth-library`.
                                                              - - Shared `idso-oauth-client-id` and `idso-oauth-client-secret` pulled from Secret Manager at runtime.
                                                                - - Redirect URI: `https://{cloud-run-url}/api/auth/authorize`. Backend generator adds it to the shared OAuth client automatically via `oauth_add_redirect_uri` tool.
                                                                  - - `hd` claim on the ID token must equal `IDSO_ALLOWED_DOMAIN` (= `independencedso.com`). `email_verified` must be true.
                                                                    - - Session cookie: `idso_session`. Value is `base64(iv + authTag + ciphertext)`, AES-256-GCM, key derived from `SECRET_KEY` via SHA-256. `Secure`, `HttpOnly`, `SameSite=Lax`.
                                                                      - - Two crypto paths in the template: Node.js `crypto` for route handlers, Web Crypto API for middleware (Edge runtime).
                                                                        - - Middleware enforces auth on every non-public route. Public routes: `/login`, `/api/auth/*`, `/api/health`, `/api/setup`. 401 JSON for unauthenticated API requests, redirect to `/login` for browser requests.
                                                                          - - `requireAuth(request)` must be the first statement in every data-modifying API route handler.
                                                                            - - Every data-modifying operation must record `updated_by` from the authenticated user via `auditCreate` / `auditUpdate` / `auditUpsert`.
                                                                              - - Dev bypass: `IDSO_OAUTH_BYPASS_AUTH=true` in local dev only. Must be absent or `false` in every deployed environment. The generator rejects a plan that asks for it to be set in deploy env.
                                                                               
                                                                                - ### Locked auth files (copy verbatim from template)
                                                                                - - `src/lib/auth.ts`, `src/lib/session.ts`
                                                                                  - - `src/app/api/auth/login/route.ts`
                                                                                    - - `src/app/api/auth/authorize/route.ts`
                                                                                      - - `src/app/api/auth/logout/route.ts`
                                                                                        - - `src/app/api/auth/me/route.ts`
                                                                                          - - `src/middleware.ts` (app-specific `PUBLIC_ROUTES` additions allowed)
                                                                                           
                                                                                            - ## 6. Data tier — chosen per app at plan time
                                                                                           
                                                                                            - The plan must state which tier and why. Two valid choices:
                                                                                           
                                                                                            - ### (a) BigQuery direct — dimensional / reference data
                                                                                            - - Small, infrequently-changing mapping or lookup data.
                                                                                              - - Read/write directly from the app using `@google-cloud/bigquery`.
                                                                                                - - Dataset name is per-app, declared in `CLAUDE-app.md` and env var `IDSO_BQ_DATASET`.
                                                                                                  - - Every table must include `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP()), `updated_at`, `updated_by`.
                                                                                                    - - Never use `SELECT *` in production queries.
                                                                                                      - - Always use parameterized queries. No string interpolation or f-strings in SQL.
                                                                                                        - - Cache read-heavy results with short TTLs where latency matters.
                                                                                                         
                                                                                                          - ### (b) Cloud SQL (shared `idso-shared` Postgres) via Prisma — transactional / interactive
                                                                                                          - - Fast per-row reads and writes, user workflow state, approval queues, reconciliation confirmations.
                                                                                                            - - Database name: `idso_{app_underscored}`. One DB per app on the shared instance.
                                                                                                              - - Data flows to BigQuery via scheduled sync for reporting (out of scope for the generator; set up by data team).
                                                                                                                - - Every Prisma model must include:
                                                                                                                  -   ```prisma
                                                                                                                        id         String   @id @default(uuid())
                                                                                                                        created_at DateTime @default(now())
                                                                                                                        updated_at DateTime @updatedAt
                                                                                                                        updated_by String
                                                                                                                        ```
                                                                                                                      - All writes go through `auditCreate` / `auditUpdate` / `auditUpsert` from `src/lib/audit.ts`.
                                                                                                                      - - Never use string interpolation in raw SQL. Use Prisma's query builder or parameterized `$queryRaw`.
                                                                                                                       
                                                                                                                        - ### Decision rule at plan time
                                                                                                                        - - User workflow with rapid interactive edits, queues, confirmations → **Cloud SQL**.
                                                                                                                          - - Static mapping/lookup tables, reference data shared with pipelines or other apps → **BigQuery direct**.
                                                                                                                            - - Both → Cloud SQL for the interactive surface, plus a BigQuery dataset for the reference tables. Both get provisioned.
                                                                                                                             
                                                                                                                              - ## 7. Secrets
                                                                                                                             
                                                                                                                              - - All secrets in Google Secret Manager. Never in code, env files, or container images.
                                                                                                                                - - Pulled at runtime via `src/lib/secrets.ts` with a 5-minute in-memory cache.
                                                                                                                                  - - Per-secret IAM only. `secretmanager.secretAccessor` is granted to the app's SA on each specific secret it needs. **Never** granted at the project level.
                                                                                                                                    - - Per-app secrets the generator always provisions (Cloud SQL tier): `{app}-db-url`, `{app}-encryption-key`, `idso-{app}-secret-key`.
                                                                                                                                      - - Per-app secrets the generator always provisions (BQ tier): `idso-{app}-secret-key`.
                                                                                                                                        - - Per-app secrets for third-party integrations (APIs, webhooks, tokens): `{app}-{name}`, created via the `secret_create` tool on user approval.
                                                                                                                                          - - Shared secrets all apps get access to: `idso-oauth-client-id`, `idso-oauth-client-secret`.
                                                                                                                                           
                                                                                                                                            - ## 8. IAM — default roles for the app SA
                                                                                                                                           
                                                                                                                                            - - `roles/cloudsql.client` (if Cloud SQL tier)
                                                                                                                                              - - `roles/bigquery.dataViewer` + `roles/bigquery.jobUser` (BQ tier or Cloud SQL + reporting sync)
                                                                                                                                                - - `roles/logging.logWriter` (implicit on Cloud Run; grant explicitly for jobs)
                                                                                                                                                  - - `roles/secretmanager.secretAccessor` on each specific secret the app reads (per-secret, not project-wide)
                                                                                                                                                   
                                                                                                                                                    - Any additional role requires explicit user approval at the plan stage.
                                                                                                                                                   
                                                                                                                                                    - ## 9. Cloud Run — browser-facing service defaults
                                                                                                                                                   
                                                                                                                                                    - - `--allow-unauthenticated` at the Cloud Run IAM level (browsers can't send Google IAM identity tokens).
                                                                                                                                                      - - App-level auth is therefore **mandatory** on every non-public route. The generator's post-deploy verification must confirm this by curling a protected route and asserting 401.
                                                                                                                                                        - - Port 8080, health check at `/api/health`.
                                                                                                                                                          - - Environment variables: sourced from Cloud Run env + Secret Manager references (`--set-secrets=NAME=secret:latest`). Never baked into the image.
                                                                                                                                                            - - Service-to-service (backend-to-backend) uses Cloud Run IAM auth, not `allUsers`.
                                                                                                                                                             
                                                                                                                                                              - ## 10. Logging
                                                                                                                                                             
                                                                                                                                                              - - Google Cloud Logging, structured JSON.
                                                                                                                                                                - - Every authenticated request logs: `authEmail`, `requestId`, `path`, `method`, `status`, `latencyMs`.
                                                                                                                                                                  - - Every generator API call also logs: `buildId`, `tool`, `argsSummary`, `tokensIn`, `tokensOut`, `outcome`.
                                                                                                                                                                    - - Cloud Build set to `logging: CLOUD_LOGGING_ONLY`.
                                                                                                                                                                     
                                                                                                                                                                      - ## 11. File structure — Next.js single-service app
                                                                                                                                                                     
                                                                                                                                                                      - ```
                                                                                                                                                                        idso-{app}/
                                                                                                                                                                        ├── src/
                                                                                                                                                                        │   ├── app/
                                                                                                                                                                        │   │   ├── (protected)/<feature>/page.tsx         ← generated per feature
                                                                                                                                                                        │   │   ├── api/app/<resource>/route.ts            ← generated per resource
                                                                                                                                                                        │   │   ├── api/auth/{login,authorize,logout,me}/route.ts  ← LOCKED
                                                                                                                                                                        │   │   ├── api/health/route.ts                    ← LOCKED
                                                                                                                                                                        │   │   ├── api/setup/route.ts                     ← LOCKED
                                                                                                                                                                        │   │   ├── layout.tsx                             ← customize metadata only
                                                                                                                                                                        │   │   ├── login/layout.tsx                       ← LOCKED
                                                                                                                                                                        │   │   ├── login/page.tsx                         ← customize heading only
                                                                                                                                                                        │   │   └── page.tsx                               ← customize dashboard content
                                                                                                                                                                        │   ├── components/
                                                                                                                                                                        │   │   ├── AppShell.tsx                           ← LOCKED
                                                                                                                                                                        │   │   ├── AuthProvider.tsx                       ← LOCKED
                                                                                                                                                                        │   │   ├── Sidebar.tsx                            ← customize heading only
                                                                                                                                                                        │   │   ├── DataTable.tsx                          ← LOCKED
                                                                                                                                                                        │   │   ├── DashboardCard.tsx                      ← LOCKED
                                                                                                                                                                        │   │   ├── BulkActionBar.tsx                      ← LOCKED
                                                                                                                                                                        │   │   ├── FormField.tsx                          ← LOCKED
                                                                                                                                                                        │   │   ├── LoadingState.tsx                       ← LOCKED
                                                                                                                                                                        │   │   └── app/<feature>/<Component>.tsx          ← generated
                                                                                                                                                                        │   ├── config/
                                                                                                                                                                        │   │   ├── nav.ts                                 ← customize
                                                                                                                                                                        │   │   └── <name>.ts                              ← generated for reference data
                                                                                                                                                                        │   ├── lib/
                                                                                                                                                                        │   │   ├── auth.ts, session.ts, secrets.ts, errors.ts  ← LOCKED
                                                                                                                                                                        │   │   ├── db.ts, audit.ts, crypto.ts             ← LOCKED (Cloud SQL tier)
                                                                                                                                                                        │   │   └── bq.ts                                  ← LOCKED (BQ tier; analog of db.ts)
                                                                                                                                                                        │   ├── middleware.ts                              ← LOCKED (add to PUBLIC_ROUTES only)
                                                                                                                                                                        │   └── types/
                                                                                                                                                                        │       ├── auth.ts                                ← LOCKED
                                                                                                                                                                        │       └── app/<entity>.ts                        ← generated
                                                                                                                                                                        ├── prisma/schema.prisma                           ← customize (Cloud SQL tier only)
                                                                                                                                                                        ├── .idso/owner.json                               ← generated (ownership metadata)
                                                                                                                                                                        ├── app.config.json                                ← generated
                                                                                                                                                                        ├── CLAUDE.md                                      ← copied from generator's template
                                                                                                                                                                        ├── CLAUDE-standards.md                            ← copied from generator's template
                                                                                                                                                                        ├── CLAUDE-app.md                                  ← generated per app
                                                                                                                                                                        ├── Dockerfile                                     ← LOCKED
                                                                                                                                                                        ├── cloudbuild.yaml                                ← LOCKED (update _SERVICE_NAME only)
                                                                                                                                                                        ├── next.config.ts                                 ← LOCKED (must include output: 'standalone')
                                                                                                                                                                        ├── tsconfig.json                                  ← LOCKED
                                                                                                                                                                        ├── package.json                                   ← LOCKED base, app deps added on approval
                                                                                                                                                                        └── README.md                                      ← generated
                                                                                                                                                                        ```
                                                                                                                                                                        
                                                                                                                                                                        ## 12. Required patterns for generated code
                                                                                                                                                                        
                                                                                                                                                                        ### API route
                                                                                                                                                                        ```typescript
                                                                                                                                                                        import { NextRequest, NextResponse } from 'next/server';
                                                                                                                                                                        import { requireAuth, isAuthError } from '@/lib/auth';
                                                                                                                                                                        import { unauthorized, badRequest, serverError } from '@/lib/errors';
                                                                                                                                                                        import { auditCreate } from '@/lib/audit';
                                                                                                                                                                        import { z } from 'zod';

                                                                                                                                                                        const CreateSchema = z.object({ /* ... */ });

                                                                                                                                                                        export async function POST(request: NextRequest) {
                                                                                                                                                                          const auth = await requireAuth(request);
                                                                                                                                                                          if (isAuthError(auth)) return unauthorized();
                                                                                                                                                                          try {
                                                                                                                                                                            const body = await request.json();
                                                                                                                                                                            const parsed = CreateSchema.safeParse(body);
                                                                                                                                                                            if (!parsed.success) return badRequest(parsed.error.issues[0].message);
                                                                                                                                                                            const record = await auditCreate('task', parsed.data, auth.email);
                                                                                                                                                                            return NextResponse.json({ data: record });
                                                                                                                                                                          } catch (err) { return serverError(err); }
                                                                                                                                                                        }
                                                                                                                                                                        ```
                                                                                                                                                                        
                                                                                                                                                                        ### Response shapes
                                                                                                                                                                        - Success: `{ data: T }`.
                                                                                                                                                                        - - Error: `{ error: string }` with appropriate HTTP status.
                                                                                                                                                                         
                                                                                                                                                                          - ### Exports
                                                                                                                                                                          - - Named exports everywhere except Next.js pages/layouts.
                                                                                                                                                                           
                                                                                                                                                                            - ## 13. Ownership metadata
                                                                                                                                                                           
                                                                                                                                                                            - Every generated repo gets:
                                                                                                                                                                           
                                                                                                                                                                            - - GitHub topics: `generated-by-idso-app-generator-v2`, `created-by-{sanitized-email}`.
                                                                                                                                                                              - - Committed file `.idso/owner.json`:
                                                                                                                                                                                -   ```json
                                                                                                                                                                                      {
                                                                                                                                                                                        "repo": "IDS-Central/idso-{app}",
                                                                                                                                                                                        "createdBy": "jane@independencedso.com",
                                                                                                                                                                                        "createdAt": "2026-05-01T18:22:00Z",
                                                                                                                                                                                        "generatorVersion": "2.0.0"
                                                                                                                                                                                      }
                                                                                                                                                                                      ```
                                                                                                                                                                                    - The requesting user is added as a collaborator with `push` permission on their new repo immediately after creation.
                                                                                                                                                                                 
                                                                                                                                                                                    - The "Your apps" dashboard lists repos where the authenticated user is a collaborator AND the repo has the `generated-by-idso-app-generator-v2` topic. `.idso/owner.json` is a tamper-evident fallback.
                                                                                                                                                                                 
                                                                                                                                                                                    - ## 14. Things the generator must never do
                                                                                                                                                                                 
                                                                                                                                                                                    - - Never modify any file marked LOCKED in §11.
                                                                                                                                                                                      - - Never use `--dangerously-skip-permissions` or equivalent arbitrary-shell escape hatches in backend-run contexts.
                                                                                                                                                                                        - - Never commit secrets, `.env` files, or real `DATABASE_URL`s.
                                                                                                                                                                                          - - Never grant `secretmanager.secretAccessor` project-wide.
                                                                                                                                                                                            - - Never create a new OAuth client per app.
                                                                                                                                                                                              - - Never skip the plan-approval gate before mutating GitHub or GCP resources.
                                                                                                                                                                                                - - Never exceed the per-build token budget without an explicit user re-approval event.
                                                                                                                                                                                                  - - Never return secrets to Claude as tool output — only confirm creation / binding.
                                                                                                                                                                                                    - - Never read or modify repos that don't have the `generated-by-idso-app-generator-v2` topic (legacy safety).
                                                                                                                                                                                                      - - Never use `SELECT *` in generated production queries.
                                                                                                                                                                                                        - - Never use string interpolation in generated SQL.
                                                                                                                                                                                                          - - Never deploy a browser-facing Cloud Run service without confirming auth middleware returns 401 on a protected route.
                                                                                                                                                                                                            - 

---

## Data warehouse access rules (added 2026-04-23)

IDSO operates a central BigQuery data warehouse in project `reconciliation-dashboard`. The generator uses this as its primary source of truth for generated-app data needs.

### Catalog

- `docs/data-catalog.json` is the machine-readable inventory of datasets, tables, columns, and types in `reconciliation-dashboard`. The generator MUST load this at plan time and reference it when proposing any app that reads IDSO data.
- `docs/DATA-CATALOG.md` is the human-readable version of the same data.
- Regenerate both with `scripts/refresh-catalog.sh`. Do not hand-edit.
- Claude MUST NOT hallucinate table or column names. If the user asks for data that the catalog does not contain, the generator must say so and ask the user to clarify or point to the right dataset, rather than inventing tables.

### Per-app service account

Every generated app that needs to read warehouse data gets its own dedicated service account with the minimum required roles:

- `roles/bigquery.dataViewer` on `reconciliation-dashboard` (read rows)
- `roles/bigquery.jobUser` on `reconciliation-dashboard` (run queries, billed to reconciliation-dashboard)

The generator MUST create this SA during provisioning (tool: `iam_create_sa`) and MUST NOT share or reuse SAs across generated apps. Naming: `idso-{app-name}-runtime@reconciliation-dashboard.iam.gserviceaccount.com`.

Generated apps do NOT get `bigquery.admin`, `bigquery.dataEditor`, or any write role on the warehouse. If a generated app needs its own writeable tables, it creates them in its own dataset (named `idso_{app_name}`) owned by the app's SA, not in the shared warehouse datasets.

### Audience

All generated apps may assume the authenticated user is a corporate-level IDSO staffer and is authorised to see all data in the warehouse. There is no row-level security, no practice-level scoping, and no PII redaction at the app layer. Auth is still required (OAuth + `hd=independencedso.com`), but once a user is in, they see everything the app is designed to show.

### Ambiguous business metrics

Many IDSO metrics ("net production", "collections rate", "production per op hour", "adjusted EBITDA", etc.) have multiple valid definitions depending on context. The generator MUST NOT assume a definition. When the user's request contains a business metric that could be computed more than one way, Claude MUST:

1. Detect the ambiguity during planning (before emitting `plan_proposed`).
2. Ask the user to state the exact formula, in plain English or SQL.
3. Capture the user's answer in the generated repo as a commented SQL view (e.g., `sql/metrics/net_production.sql`) with a header comment naming the user who defined it and the date.
4. Reference that view from the app code  never recompute the metric inline in a report.

This makes every metric auditable and re-editable by the user later.
