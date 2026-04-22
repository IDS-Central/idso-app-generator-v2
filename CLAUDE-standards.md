# IDSO Coding Standards — v2 (supersedes v1 `idso-app-template/CLAUDE-standards.md`)

This file is the canonical IDSO standards doc. It applies to (a) this repo, `idso-app-generator-v2`, and (b) every app the generator creates. For the generator's authoritative spec of what *generated apps* must follow, see `docs/IDSO-APP-CONVENTIONS.md` — that doc is loaded into the generator's Anthropic system prompt.

`CLAUDE-standards.md` from v1 is the source material. Everything in v1 applies here unless explicitly superseded below.

---

## v2 supersedes / modifies v1

### S-001 — Single backend Anthropic API key (supersedes v1's "No shared Anthropic API keys")

v1 said each user has their own Anthropic key in Secret Manager. v2 uses a single backend key (`anthropic-api-key`), accessible only to the backend service account. Users never see or handle an Anthropic key. Cost attribution is via authenticated email in Cloud Logging on every API call.

Rationale: v2's users are non-technical and interact with the generator through a web UI, not a CLI. There is no per-user context that could hold a per-user key. The generator backend is the only principal that calls Anthropic.

### S-002 — Repo naming is code-enforced (supersedes v1's "All repos follow the pattern `idso-{app-name}`" — was advisory)

v1 documented the pattern but did not enforce it (see `data-mapping`, `reconciliation-dashboard`, `apps-hub`). v2's `github_create_repo` tool rejects any name that doesn't match `^idso-[a-z][a-z0-9-]{2,29}$`. Legacy repos that don't match are never managed by the generator.

### S-003 — OAuth redirect URIs are added automatically

v1 required a human admin to add each new Cloud Run URL to the shared OAuth client's authorized redirect URIs. v2's backend SA has the permission to do this via `oauth_add_redirect_uri`. Admins no longer touch the OAuth client for standard generator output.

### S-004 — Plan approval is a code-enforced gate

v1's "summarize and confirm" was an instruction in the system prompt. v2's tool dispatcher rejects any mutating tool until `plan_present` has returned `approved: true`. The UI surfaces the plan; the code enforces the gate.

### S-005 — Ownership is GitHub collaborator + topic, not a separate users table

v2 tracks ownership via GitHub repo topics (`generated-by-idso-app-generator-v2`, `created-by-{sanitized-email}`) and a committed `.idso/owner.json`, plus the fact that the requesting user is added as a collaborator on their own repo. No separate users or apps table. Offboarding happens via Google Workspace deprovisioning.

### S-006 — No `--dangerously-skip-permissions` or equivalent in backend contexts

v1's Claude Code session runs with `--dangerously-skip-permissions` because it's a per-user shell. v2's backend is a shared service with broad GCP rights and **never** exposes arbitrary shell. The only shell-like tool (`run_in_build_sandbox`) uses a hard-coded command whitelist and runs in an ephemeral Cloud Build step.

### S-007 — Data tier is explicitly chosen per app at plan time

v1 provisions Cloud SQL unconditionally. v2 evaluates the app description, picks BigQuery direct (for dimensional / reference data) or Cloud SQL via Prisma (for transactional / interactive), states the choice and reason in the plan, and only provisions on user approval. See `docs/IDSO-APP-CONVENTIONS.md` §6 for the decision rule.

---

## Carried forward from v1 unchanged

These rules from v1 `CLAUDE-standards.md` apply verbatim and are not repeated here in full. See `docs/IDSO-APP-CONVENTIONS.md` for the merged, expanded version.

- Org: `IDS-Central` on GitHub, `central-workspace` on GCP, `us-central1` region, npm package manager.
- - Tech stack: Next.js (App Router) + TypeScript strict + Tailwind; Python 3.12-slim only for pipelines (Phase 4+).
  - - Cloud Run service naming `{app}-{service}-{env}`, no version suffixes.
    - - Service account naming `idso-{app}@central-workspace.iam.gserviceaccount.com`.
      - - Secrets in Secret Manager with `{app}-{secret}` naming; per-secret IAM; never project-level `secretAccessor`.
        - - Auth via `google-auth-library`; shared OAuth client; `hd=independencedso.com`; `idso_session` AES-256-GCM cookie.
          - - Every data-modifying endpoint runs `requireAuth()` first and records `updated_by`.
            - - Every Prisma model and BQ table includes `created_at`, `updated_at`, `updated_by`.
              - - Never commit secrets, never use `SELECT *` in prod queries, never use string interpolation in SQL.
                - - Structured Cloud Logging with `authEmail` on every authenticated request.
                  - - Multi-stage Dockerfile, `node:20-alpine`, port 8080, `/api/health`, `output: 'standalone'`.
                    - - Cloud Build with `logging: CLOUD_LOGGING_ONLY`, images pushed to `us-central1-docker.pkg.dev/central-workspace/idso-apps`.
                      - - Env vars prefixed `IDSO_` (exceptions: `SECRET_KEY`, `SESSION_LIFETIME_HOURS`).
                        - - Zod validation on every request body; consistent response shapes (`{data: T}` / `{error: string}`).
                          - - No `any`; prefer interfaces for object shapes, types for unions.
                            - - Named exports except for Next.js pages/layouts.
                             
                              - ---

                              ## How to propose a new standard

                              Open a PR that adds an entry here (or to `docs/DECISIONS.md` if the change is a decision rather than a rule), updates `docs/IDSO-APP-CONVENTIONS.md` if it affects generated apps, and updates `backend/src/tools/` validators if it affects the generator's tool surface. All three must move together.
                              
