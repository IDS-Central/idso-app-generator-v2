# CLAUDE.md — Working on `idso-app-generator-v2`

This file tells any Claude Code (or equivalent) session working *on the generator itself* how to behave. This is NOT the system prompt the generator sends to Claude when building apps — that lives in `docs/IDSO-APP-CONVENTIONS.md` and the loop's role instructions.

## What this repo is

The successor to `IDS-Central/idso-app-template`. A web-based app generator for IDSO staff. Frontend + backend, both on Cloud Run. See `README.md` and `docs/ARCHITECTURE.md`.

## Where to look first

Before any code change:

1. `docs/DECISIONS.md` — every locked-in decision. If a task contradicts one, stop and raise it.
2. 2. `docs/ARCHITECTURE.md` — what runs where, auth model, tool loop.
   3. 3. `docs/TOOL-SCHEMA.md` — every tool and its validation rules.
      4. 4. `docs/IDSO-APP-CONVENTIONS.md` — rules the generator imposes on generated apps. These propagate into both the system prompt and the tool validators.
         5. 5. `docs/PHASE-PLAN.md` — the current phase and its exit criteria.
            6. 6. `docs/V1-SUMMARY.md` — what v1 did and why v2 differs.
              
               7. ## Coding standards
              
               8. Follow `CLAUDE-standards.md`. Summary: Next.js / TypeScript strict mode / Tailwind for frontend, Node 20 + TypeScript strict for backend, Cloud Run deploy, `/api/health`, per-secret IAM, structured logging with `authEmail`, Zod validation on every request body.
              
               9. ## Non-negotiables when editing the generator
              
               10. - **Never weaken a validator** in `backend/src/tools/` without updating `docs/TOOL-SCHEMA.md` and `docs/DECISIONS.md` first.
                   - - **Never add a tool** that runs arbitrary shell, returns a secret value, or grants project-wide IAM.
                     - - **Never add a tool** that can mutate a repo lacking the `generated-by-idso-app-generator-v2` topic.
                       - - **Never commit secrets** or real `.env` files. `.env.example` is fine.
                         - - **Never skip the plan-approval gate** in the loop — the dispatcher enforces it, and that enforcement must stay.
                           - - **Budget caps stay mandatory.** If you disable them for testing, revert before merging.
                            
                             - ## Testing changes
                            
                             - Phase 1: `backend/` unit tests run via `npm test` in `backend/`. Integration test hits the real Google OIDC JWK endpoint with a test token; do not commit test tokens.
                            
                             - Phase 2 onward: there is a dry-run harness at `backend/src/loop/dry-run.ts` that runs the full loop with only read-only tools, against the real Anthropic API. Use it before any end-to-end test that provisions resources.
                            
                             - ## Deploy
                            
                             - Backend: `idso-app-generator-v2-backend-{dev,prod}`. Frontend: `idso-app-generator-v2-frontend-{dev,prod}`. Both on Cloud Run in `central-workspace` / `us-central1`. Cloud Build triggers on push to `main` for `dev`, manual promotion for `prod`.
                            
                             - ## Ask before
                            
                             - - Widening any backend IAM role.
                               - - Adding new permissions to the GitHub App manifest.
                                 - - Changing the `hd` / `email_verified` validation.
                                   - - Changing the plan-approval data shape in a way that breaks the frontend.
                                     - - Increasing the default budget caps.
                                       - - Adding a new tool.
                                        
                                         - ## Security posture
                                        
                                         - Treat any input from the user's natural-language description as untrusted. Claude's own tool calls are constrained by the schema; but **system-prompt-following alone is not a security control** for anything that mutates GCP or GitHub. The server-side validators in `backend/src/tools/` are the security control.
                                        
                                         - ## Change log convention
                                        
                                         - Every PR that changes behavior updates `docs/DECISIONS.md` with a new entry if a new decision is made, or a note under an existing entry if a decision is modified. No silent behavior changes.
                                         - 
