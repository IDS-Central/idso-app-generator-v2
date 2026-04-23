# idso-app-generator-v2  Deployment Checkpoint

> This file is the single source of truth for deployment state. Update it every
> time the deployed surface changes (new image, service rename, new secret, etc.).

## Status:  Backend Phase 2 complete  ready to begin Phase 3 (frontend)

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
- **No GitHub trigger connected yet**  decision pending in Phase 3.

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
