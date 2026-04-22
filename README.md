# idso-app-generator-v2

Web-based app generator for IDSO staff. Successor to the Cloud Shell-based v1 (`IDS-Central/idso-app-template`).

## What this is

A user-friendly web app where IDSO staff describe what they want in plain English, approve a generated plan, and get a fully built and deployed Cloud Run app — no Cloud Shell, no `gcloud` commands, no YAML.

The generator itself runs as two Cloud Run services (frontend + backend), gated by domain-restricted Google SSO (`hd=independencedso.com`). The backend runs an Anthropic tool-use loop that creates a GitHub repo, writes the code, provisions GCP resources, deploys to Cloud Run, and reports back a working URL.

## Status

**Phase 0 — Discovery (complete).** See `docs/V1-SUMMARY.md`, `docs/IDSO-APP-CONVENTIONS.md`, `docs/ARCHITECTURE.md`, `docs/TOOL-SCHEMA.md`, `docs/DECISIONS.md`, `docs/PHASE-PLAN.md`.

**Phase 1 — Backend skeleton (not started).** Cloud Run service, ID token verification, Secret Manager integration, GitHub App registration, structured logging, token budget.

**Phase 2 — Tool layer and build loop (not started).**

**Phase 3 — Frontend (not started).**

**Phase 4 — Polish (not started).**

## How it differs from v1

| | v1 (`idso-app-template`) | v2 (this repo) |
|---|---|---|
| Interface | Cloud Shell + `teachme` tutorial | Web app, chat UI |
| AI runtime | Claude Code with `--dangerously-skip-permissions` | Anthropic API tool-use loop on a backend service, typed tools, no arbitrary shell |
| Auth to generator | Relies on `gcloud` login in Cloud Shell | Domain-locked Google SSO, ID token verified server-side |
| Anthropic key | Per-user key in Secret Manager | One backend key; attribution via authenticated email in logs |
| GitHub access | User's own `gh` CLI auth | GitHub App installed on IDS-Central org |
| Plan approval | Conversational summary in Phase 1 prompt | First-class gate with UI approval event before any build tool runs |
| Build-failure repair | Manual — user re-runs after Claude Code suggests fix | Automatic — backend reads Cloud Build / Cloud Run logs and iterates |
| Token budget | None | Per-build soft cap with user re-approval, per-user monthly cap |
| "Your apps" | `ls $HOME/idso-*/` in bash | Dashboard driven by GitHub collaborator membership on the requesting user |
| OAuth redirect URI for new apps | Manual admin step in GCP Console | Automated via backend service account |

## Conventions for generated apps

See `docs/IDSO-APP-CONVENTIONS.md`. Summary:

- Repo name: `idso-{app-name}`, in the `IDS-Central` GitHub org.
- - Framework: Next.js (App Router) + TypeScript strict mode + Tailwind.
  - - Deploy target: Cloud Run in `central-workspace`, `us-central1`, from `idso-apps` Artifact Registry.
    - - Auth: Google OAuth via `google-auth-library`, shared OAuth client, `hd=independencedso.com`.
      - - Data tier: BigQuery direct for dimensional/reference data; Cloud SQL (shared `idso-shared` Postgres) via Prisma for transactional/interactive data. Chosen at plan time based on app shape.
        - - Secrets: Google Secret Manager, `{app}-{secret}` naming, per-secret IAM (never project-level).
          - - Logging: Cloud Logging, structured, with authenticated email on every request.
           
            - ## Repository layout
           
            - ```
              idso-app-generator-v2/
              ├── README.md                          ← this file
              ├── CLAUDE.md                          ← guidance for Claude Code sessions on this repo
              ├── CLAUDE-standards.md                ← IDSO org-wide coding standards (upgraded from v1)
              ├── docs/
              │   ├── V1-SUMMARY.md
              │   ├── IDSO-APP-CONVENTIONS.md        ← authoritative conventions used by the generator
              │   ├── ARCHITECTURE.md
              │   ├── TOOL-SCHEMA.md
              │   ├── DECISIONS.md
              │   └── PHASE-PLAN.md
              ├── backend/                           ← Phase 1 (empty)
              └── frontend/                          ← Phase 3 (empty)
              ```
              
