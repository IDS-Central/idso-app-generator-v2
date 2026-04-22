# V1 Summary — What `idso-app-template` Does and Why v2 Replaces It

This document summarizes the v1 app generator (`IDS-Central/idso-app-template`) so anyone working on v2 knows exactly what they're replacing. v2 preserves v1's best ideas (locked/customize/create file taxonomy, shared OAuth client, per-secret IAM, app.config.json as source of truth) and closes v1's gaps (Cloud Shell dependency, no plan-approval gate, no automatic build-failure repair, no per-build budget, no web UI, manual OAuth-redirect-URI step).

## 1. Entry point — `scripts/startup.sh`

Runs from inside a cloned `idso-app-template` repo in Cloud Shell. Does:

1. Opens `teachme` tutorial panel (`.cloudshell/tutorial.md`) if running in Cloud Shell.
2. 2. Verifies `gcloud auth list` has an active account; sets project to `central-workspace`.
   3. 3. Ensures GitHub CLI (`gh`) is installed and authenticated as the user's own GitHub account ("for auditability").
      4. 4. Ensures Claude Code is installed (`npm install -g @anthropic-ai/claude-code`).
         5. 5. **Pulls a per-user Anthropic API key** from Secret Manager. Email is sanitized: `jane.doe@company.com` → `jane-doe--company--com`. Secret name: `anthropic-api-key-{sanitized-email}`. If missing, prints admin commands to create it.
            6. 6. Scans `$HOME/idso-*/` for existing app directories. For each, reads description from `CLAUDE-app.md` and Cloud Run URL from `gcloud run services describe {app}-app-dev`.
               7. 7. Displays a numbered menu: pick a number to `cd` into an existing app, or `N` to create a new one.
                  8. 8. Launches `claude --dangerously-skip-permissions` in the chosen directory.
                    
                     9. **v2 replacement:** Domain-locked SSO in the web UI. "Your apps" dashboard queries GitHub for repos where the requesting user is a collaborator. No per-user Anthropic key — one backend key, attribution via authenticated email in logs.
                    
                     10. ## 2. Provisioning — `scripts/provision.sh <app-name>`
                    
                     11. Strict name regex: `^[a-z][a-z0-9-]{2,29}$`. Then 9 steps:
                    
                     12. | Step | Action |
                     13. |---|---|
                     14. | 1 | Set GCP project to `central-workspace` |
                     15. | 2 | Create service account `idso-{app}@central-workspace.iam.gserviceaccount.com` |
                     16. | 3 | Grant project-level roles: `cloudsql.client`, `bigquery.dataViewer`, `bigquery.jobUser` |
                     17. | 4 | Ensure shared Cloud SQL instance `idso-shared` (Postgres 15, db-f1-micro) exists |
                     18. | 5 | Create database `idso_{app_underscored}` and user with random 32-byte password |
                     19. | 6 | Create secrets: `{app}-db-url`, `{app}-encryption-key`, `idso-{app}-secret-key` |
                     20. | 7 | Grant per-secret `secretmanager.secretAccessor` to the app SA on its own 3 secrets plus shared `idso-oauth-client-id` and `idso-oauth-client-secret` |
                     21. | 8 | `gh repo create IDS-Central/idso-{app}` from template, `--private --clone` |
                     22. | 9 | Create Cloud Build trigger on push to `main`; ensure `idso-apps` Artifact Registry exists |
                    
                     23. **v2 replacement:** Typed tools (`iam_create_service_account`, `iam_grant_role`, `sql_create_database`, `secret_create`, `secret_grant_access`, `github_create_repo`, `cloud_build_create_trigger`) called from the Anthropic tool-use loop. Same effect, no bash, auditable per-call.
                    
                     24. ## 3. Deploy — `scripts/deploy.sh`
                    
                     25. Reads app name from `app.config.json`. Runs `npx prisma generate`, then `gcloud builds submit --config cloudbuild.yaml`. `cloudbuild.yaml` is a 3-step Cloud Build: docker build → docker push → `gcloud run deploy {app}-app-dev --allow-unauthenticated --port 8080`. Finally curls `/api/health` and prints the URL.
                    
                     26. **v2 replacement:** `cloud_build_submit` + `cloud_build_wait` tools. On failure, `read_build_logs` feeds the log tail back to Claude, which edits the repo and submits again. Bounded by per-build token budget.
                    
                     27. ## 4. The AI loop — `CLAUDE.md` (v1's system prompt)
                    
                     28. Claude Code runs with `--dangerously-skip-permissions` and follows four phases:
                    
                     29. - **Phase 0 — Determine intent.** Read `CLAUDE-app.md` in the current directory. If it has real content, it's an existing app (ask "what would you like to change?"). If it's still the stub template, treat as new app.
                         - - **Phase 1 — Gather requirements (new apps).** One question at a time: what should it do, what should we call it, what data does it need, what's your email domain. Then summarize and confirm.
                           - - **Phase 2 — Provision.** Run `bash scripts/provision.sh {APP_NAME}`, then `cd` into the new repo.
                             - - **Phase 3 — Build.** In order: fill `app.config.json`, write `CLAUDE-app.md`, customize `src/app/layout.tsx`, `src/app/login/page.tsx`, `src/components/Sidebar.tsx`, `src/config/nav.ts`, `prisma/schema.prisma`; create files in `src/app/(protected)/`, `src/app/api/app/`, `src/components/app/`, `src/types/app/`; update dashboard; `npm install && npx prisma generate && npm run build`; commit and push.
                               - - **Phase 4 — Deploy.** `npx prisma db push`, `bash scripts/deploy.sh`. Verify health. Tell user an admin must add the Cloud Run URL as an OAuth redirect URI.
                                
                                 - **v2 replacement:** Same phase structure, but Phase 1's "summary and confirm" becomes a first-class plan-approval gate in the UI. Phase 4's manual OAuth-redirect-URI step is automated via a typed tool.
                                
                                 - ## 5. The conventions — `CLAUDE-standards.md` (v1's rules)
                                
                                 - Canonical rules: Next.js/TS App Router, Google OAuth via google-auth-library, shared OAuth client set to "Internal" in GCP Console, AES-256-GCM session cookie named `idso_session`, BigQuery for dimensional data and Cloud SQL for transactional, repo pattern `idso-{app-name}`, Cloud Run service pattern `{app}-{service}`, env vars prefixed `IDSO_`, per-secret IAM, every Prisma model has `created_at/updated_at/updated_by`, every data-modifying endpoint calls `requireAuth()` and records `updated_by`, never hardcode secrets, never use `SELECT *` in prod, never use project-level `secretmanager.secretAccessor`, never use a shared GitHub PAT or Anthropic key.
                                
                                 - **v2 adoption:** Carried forward verbatim with two edits: (a) v2 uses a single backend Anthropic key (contradicts v1's "no shared Anthropic API keys" rule — justified because the generator itself isn't a per-app context); (b) repo naming `idso-{app-name}` is now enforced by the generator, not just documented.
                                
                                 - ## 6. The template — locked / customize / create taxonomy
                                
                                 - v1's cleanest idea. Three buckets:
                                
                                 - - **Locked (never modify):** `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/db.ts`, `src/lib/audit.ts`, `src/lib/crypto.ts`, `src/lib/secrets.ts`, `src/lib/errors.ts`, `src/middleware.ts`, `src/components/AuthProvider.tsx`, `src/components/AppShell.tsx`, `src/app/api/auth/{login,authorize,logout,me}/route.ts`, `src/app/api/health/route.ts`, `src/app/api/setup/route.ts`, `src/app/login/layout.tsx`, `src/types/auth.ts`, `Dockerfile`, `cloudbuild.yaml`, `scripts/*.sh`.
                                   - - **Customize per app:** `src/app/layout.tsx` (metadata), `src/app/page.tsx` (dashboard), `src/app/login/page.tsx` (heading), `src/components/Sidebar.tsx` (heading), `src/config/nav.ts` (nav items), `prisma/schema.prisma` (models), `app.config.json` (metadata), `CLAUDE-app.md` (context).
                                     - - **Create new per app:** `src/app/(protected)/<feature>/page.tsx`, `src/app/api/app/<resource>/route.ts`, `src/components/app/<feature>/<Component>.tsx`, `src/types/app/<entity>.ts`, `src/config/<name>.ts`, `scripts/seed.ts`.
                                      
                                       - **v2 adoption:** Preserved exactly. The generator's tools will never modify locked files, will only touch customize files in the specified spots, and will create new files within the specified directory structure.
                                      
                                       - ## 7. Gaps v1 has that v2 closes
                                      
                                       - 1. **No domain-locked authentication gate.** v1 relies on "the user is logged into Cloud Shell with a Workspace account." v2 verifies a Google ID token on every backend request and checks `hd === 'independencedso.com'` and `email_verified === true`.
                                         2. 2. **No plan approval as a real artifact.** v1's "summarize the plan" is a conversational paragraph Claude Code produces in the shell. v2 requires a structured plan (repo name, file tree, data models, routes, services, secrets) and an explicit UI approval event before any tool that mutates GitHub/GCP runs.
                                            3. 3. **No automatic build-failure repair.** v1 runs `deploy.sh` once; if it fails, the user has to start over or ask Claude Code to diagnose. v2's build loop reads Cloud Build and Cloud Run logs on failure, edits the repo, and resubmits — up to a bounded retry count and token budget.
                                               4. 4. **No budget controls.** v1 has no per-build or per-user token limits. v2 has both, with a soft cutoff requiring user re-approval to continue.
                                                  5. 5. **No streaming progress UI.** v1 prints bash output to the terminal. v2 streams each tool call to the frontend so the user can watch the build.
                                                     6. 6. **No "Your apps" dashboard.** v1 greps `$HOME`. v2 queries GitHub for repos where the requesting user is a collaborator.
                                                        7. 7. **Manual OAuth redirect URI step.** v1 prints instructions at the end of Phase 4. v2 automates it via the backend SA's permission on the shared OAuth client.
                                                           8. 8. **`--dangerously-skip-permissions`.** v1 bypasses Claude Code's permission prompts to avoid asking non-technical users. v2's equivalent is typed, scoped tools with no arbitrary shell on production resources.
                                                              9. 9. **Per-user Anthropic keys.** v1 does this for cost attribution. v2 uses a single backend key and achieves attribution by logging authenticated email + token usage per request.
                                                                 10. 
