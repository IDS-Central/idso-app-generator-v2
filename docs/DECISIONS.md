# Decisions Log

Running log of every design decision locked in for v2. Each decision states the options considered, the choice, and the reason. Append-only; supersedes are added as new entries rather than edits.

---

## D-001 — Repo naming for generated apps

- **Date:** 2026-04-22
- - **Context:** IDS-Central org contains a mix of naming: `idso-app-template`, `data-mapping`, `reconciliation-dashboard`, `apps-hub`, `sage-gl-sync`, `ids-pnl-forecaster`, `ids-call-tracking`. `CLAUDE-standards.md` says `idso-{app-name}`.
  - - **Options:** (a) enforce `idso-{app-name}`, treat legacy as untouchable; (b) allow any name; (c) retroactively rename legacy repos.
    - - **Decision:** (a) — enforce `idso-{app-name}` for all v2-generated repos. Legacy repos are not managed by the generator. No retroactive renames.
      - - **Reason:** Legacy repos predate or bypass v1. The generator only needs to own the apps it creates.
       
        - ## D-002 — Data tier rule
       
        - - **Date:** 2026-04-22
          - - **Context:** Brief initially said "BigQuery only, no Cloud SQL." `CLAUDE-standards.md` splits: BigQuery direct for dimensional/reference, Cloud SQL for transactional/interactive. `data-mapping` repo uses BQ direct; v1 `provision.sh` provisions Cloud SQL unconditionally.
            - - **Options:** (a) keep the split (BQ for dimensional, Cloud SQL for transactional); (b) BigQuery only.
              - - **Decision:** (a) — keep the split. The generator chooses the tier at plan time based on the app's shape and states it in the plan for user approval.
                - - **Reason:** BigQuery is not designed for per-keystroke interactive writes. Forcing all apps onto BQ would produce bad UX for approval queues, reconciliation confirmations, etc. The split matches reality and keeps v1's `idso-shared` instance useful.
                 
                  - ## D-003 — Archetype scope for v2
                 
                  - - **Date:** 2026-04-22
                    - - **Context:** Existing IDSO repos include both Next.js web apps and Python data pipelines (sage-gl-sync, ids-pnl-forecaster, ids-reappt-notifier, ids-call-tracking).
                      - - **Options:** (a) Next.js web apps only, defer Python pipelines to Phase 4; (b) support both archetypes from Phase 1.
                        - - **Decision:** (a) — Next.js only in Phases 1–3. Add Python pipeline archetype in Phase 4.
                          - - **Reason:** Target user is non-technical staff describing UIs, not data engineers describing ETL. Supporting both archetypes up front ~doubles the tool surface (different Dockerfile, no Next.js middleware, different auth via OIDC/Pub-Sub, different deploy target sometimes being Cloud Functions or a Cloud Run Job). The plan-approval gate will explicitly reject pipeline requests until Phase 4.
                           
                            - ## D-004 — Anthropic API key model
                           
                            - - **Date:** 2026-04-22
                              - - **Context:** v1 uses per-user Anthropic keys (`anthropic-api-key-{sanitized-email}`) for cost attribution. Brief says one backend key.
                                - - **Options:** (a) one backend key; (b) per-user keys.
                                  - - **Decision:** (a) — single backend key in Secret Manager (`anthropic-api-key`), accessible only to the backend SA. Attribution via authenticated email in Cloud Logging on every request.
                                    - - **Reason:** Simpler. The backend is the only principal that calls Anthropic — users never see the key. Cost attribution is achieved by logging `authEmail` + `tokensIn` + `tokensOut` per API call; per-user monthly totals are computed from logs.
                                     
                                      - ## D-005 — "Your apps" ownership signal
                                     
                                      - - **Date:** 2026-04-22
                                        - - **Context:** Need a way for returning users to find the apps they've created. v1 did this by scanning `$HOME/idso-*/` in bash.
                                          - - **Options:** (a) GitHub topic + `.idso/owner.json` file; (b) separate users/apps table in the backend; (c) GitHub collaborator membership on the repo itself; (d) combination.
                                            - - **Decision:** (c) + (a) as defense-in-depth. The dashboard lists IDS-Central repos where the user is a collaborator AND the repo has topic `generated-by-idso-app-generator-v2`. `.idso/owner.json` is a tamper-evident fallback if a topic is removed.
                                              - - **Reason:** Keeping state in GitHub means no separate user database to maintain or offboard. Collaborator membership is managed by GitHub itself and respects org-level access control. Topic + committed file guard against two different failure modes.
                                               
                                                - ## D-006 — Generator uses the Cloud Run revision system, not version-suffixed service names
                                               
                                                - - **Date:** 2026-04-22
                                                  - - **Context:** Standards doc says no version suffixes in service names.
                                                    - - **Decision:** Honored verbatim. Services are named `{app}-app-{env}`. Rollbacks use `gcloud run services update-traffic` on revisions.
                                                     
                                                      - ## D-007 — OAuth redirect URI automation
                                                     
                                                      - - **Date:** 2026-04-22
                                                        - - **Context:** v1 requires a human admin to add each new Cloud Run URL to the shared OAuth client's authorized redirect URIs. This is the last manual step in v1's flow.
                                                          - - **Options:** (a) keep manual; (b) grant backend SA permission to edit the shared OAuth client.
                                                            - - **Decision:** (b) — automate via `oauth_add_redirect_uri` tool. Backend SA gets the narrowest permission that allows adding authorized redirect URIs to the shared OAuth client (not creating new clients).
                                                              - - **Reason:** Removing the only manual step is the whole point of v2 for non-technical users. The risk is bounded: adding a URI to a single well-known OAuth client, validated to be an `https://*.run.app` URL created by the current build.
                                                               
                                                                - ## D-008 — No arbitrary shell in the backend
                                                               
                                                                - - **Date:** 2026-04-22
                                                                  - - **Context:** v1 uses `claude --dangerously-skip-permissions`, which effectively gives Claude Code arbitrary shell as the user.
                                                                    - - **Decision:** v2 never exposes arbitrary shell. The `run_in_build_sandbox` tool accepts only a whitelist: `npm install`, `npm run build`, `npx prisma generate`, `npm run test`, `npm run lint`. It runs in an ephemeral Cloud Build step or Cloud Run Job, not as the backend SA on prod.
                                                                      - - **Reason:** The backend serves many users and has broad GCP rights. Arbitrary shell would be unacceptable.
                                                                       
                                                                        - ## D-009 — Plan approval is a code-enforced gate, not a prompt instruction
                                                                       
                                                                        - - **Date:** 2026-04-22
                                                                          - - **Context:** v1 has "summarize the plan and confirm" as Phase 1 of the CLAUDE.md prompt. Compliance depends on the model following instructions.
                                                                            - - **Decision:** v2's tool dispatcher rejects any mutating tool (marked `requiresApprovedPlan: true` in the schema) until `plan_present` returns `approved: true` for the current build. This is enforced in the server, not the prompt.
                                                                              - - **Reason:** Defense in depth. Prompt instructions can be forgotten under long context or adversarial prompting. Code-level enforcement can't.
                                                                               
                                                                                - ## D-010 — Per-build token budget with user re-approval on soft cutoff
                                                                               
                                                                                - - **Date:** 2026-04-22
                                                                                  - - **Context:** Brief says $2–$20 per generation depending on complexity, monthly backend budget $200–$1,000. Need a way to prevent a runaway loop from racking up $500 on one build.
                                                                                    - - **Decision:** Each build has a soft cap (default: tokens equivalent to ~$10) and a hard cap (default: ~$25). At soft cap, the loop suspends and emits `budget_soft_cap_hit`; the user must approve continuation in the UI. At hard cap, the build aborts unconditionally and surfaces whatever partial state exists for admin cleanup.
                                                                                      - - **Caps are env-configurable** so they can be tuned without code changes.
                                                                                       
                                                                                        - ## D-011 — Backend is Node/TypeScript (tentative)
                                                                                       
                                                                                        - - **Date:** 2026-04-22
                                                                                          - - **Context:** Frontend is Next.js (matches generated-app convention). Backend could be Node, Python, or Go.
                                                                                            - - **Decision (tentative, revisit at start of Phase 1):** Node/TypeScript. Same language as frontend and generated apps reduces context-switching, and Anthropic's official SDK and Google Cloud client libraries are solid in Node.
                                                                                              - - **Alternative considered:** Python + FastAPI. Reasonable if a contributor is stronger in Python; revisit.
                                                                                               
                                                                                                - ## D-012 — Model default
                                                                                               
                                                                                                - - **Date:** 2026-04-22
                                                                                                  - - **Decision:** Default to Sonnet (`claude-sonnet-4.7`) for both planning and code generation. Opus is available for the initial planning turn only if empirical quality improves outcomes enough to justify ~5× token cost. Decision revisits after Phase 2 has real build telemetry.
                                                                                                   
                                                                                                    - ## D-013 — No delete/teardown tools in Phases 1–3
                                                                                                   
                                                                                                    - - **Date:** 2026-04-22
                                                                                                      - - **Decision:** The generator cannot delete repos, Cloud Run services, secrets, or databases. Teardown is admin-only and lives behind a separate admin surface in Phase 4 polish.
                                                                                                        - - **Reason:** Bounded blast radius. A bug in the loop cannot destroy anything.
                                                                                                         
                                                                                                          - ## D-014 — GitHub App, not PATs, not org-level automation token
                                                                                                         
                                                                                                          - - **Date:** 2026-04-22
                                                                                                            - - **Decision:** Install a GitHub App on `IDS-Central` with installation scoped to "only selected repositories," starting empty. The generator adds each new repo to its installation. No PATs, no user tokens, no org-wide access.
                                                                                                              - - **Reason:** Matches v1's "no shared GitHub PAT" rule while giving v2 the programmatic access it needs.
                                                                                                                - 
