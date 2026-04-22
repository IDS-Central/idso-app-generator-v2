# backend/

Phase 1 backend for IDSO App Generator v2.

Node.js 20 + TypeScript + Fastify. Deploys to Cloud Run in `reconciliation-dashboard` / `us-central1`.

## What Phase 1 does

- Verifies Google ID tokens on every protected request: `hd === 'independencedso.com'` AND `email_verified === true`.
- - Loads 5 secrets from Secret Manager at boot (fails hard if any missing).
  - - Emits structured JSON logs with `authenticated_email` attached to every per-request log line.
    - - Exposes `GET /healthz` (unauthenticated) and `GET /me` (authenticated).
      - - Constructs an Anthropic client using `anthropic-api-key`. No tool-use loop yet — that is Phase 2.
       
        - ## What Phase 1 explicitly does NOT do
       
        - - No GitHub App JWT/installation token minting.
          - - No tool implementations (no `create_github_repo`, no `deploy_cloud_run`, etc.).
            - - No persistent storage, no sessions.
              - - No frontend.
               
                - See `docs/PHASE-PLAN.md` and `docs/DECISIONS.md` for the full rationale.
               
                - ## Environment variables
               
                - Non-sensitive identifiers live in env; sensitive values live in Secret Manager.
               
                - | Variable | Example | Source |
                - |----------|---------|--------|
                - | `PROJECT_ID` | `reconciliation-dashboard` | env |
                - | `REGION` | `us-central1` | env (default) |
                - | `PORT` | `8080` | env (Cloud Run injects) |
                - | `LOG_LEVEL` | `info` | env (default) |
                - | `ALLOWED_HD` | `independencedso.com` | env (default) |
                - | `GITHUB_APP_ID` | `3469712` | env |
                - | `GITHUB_APP_CLIENT_ID` | `Iv23liENpmH0xcNIoxzY` | env |
                - | `GITHUB_APP_INSTALLATION_ID` | `126241513` | env |
                - | `GOOGLE_OAUTH_CLIENT_ID_SECRET` | `oauth-client-id` | env (name of SM secret) |
               
                - Secrets loaded at boot from Secret Manager:
                - - `anthropic-api-key`
                  - - `oauth-client-id` (the Google OAuth Web client id — used as the ID-token audience)
                    - - `oauth-client-secret`
                      - - `github-app-client-secret`
                        - - `github-app-private-key`
                         
                          - The backend Cloud Run service account `idso-app-generator-v2@reconciliation-dashboard.iam.gserviceaccount.com` must hold `roles/secretmanager.secretAccessor` on each of those 5 secrets (per-secret grant, not project-level — see `docs/PHASE-1-KICKOFF.md` step 4).
                         
                          - ## Local development
                         
                          - You cannot run this locally against Secret Manager without `roles/secretmanager.secretAccessor` grants to your own user principal on each secret (which is a deliberate friction — we do not want devs routinely fetching production secrets). Recommended local flow is `gcloud builds submit` + Cloud Run deploy + read logs.
                         
                          - If you do want to run locally:
                         
                          - ```
                            cd backend
                            npm install
                            # Auth as yourself, NOT as the backend SA:
                            gcloud auth application-default login
                            # Then temporarily grant yourself secretAccessor on each of the 5 secrets (REMOVE after testing):
                            for S in anthropic-api-key oauth-client-id oauth-client-secret github-app-client-secret github-app-private-key; do
                              gcloud secrets add-iam-policy-binding $S \
                                --member="user:YOUR_EMAIL@independencedso.com" \
                                --role="roles/secretmanager.secretAccessor"
                            done
                            export PROJECT_ID=reconciliation-dashboard
                            export GITHUB_APP_ID=3469712
                            export GITHUB_APP_CLIENT_ID=Iv23liENpmH0xcNIoxzY
                            export GITHUB_APP_INSTALLATION_ID=126241513
                            npm run dev
                            ```

                            Revoke the `roles/secretmanager.secretAccessor` grants to your user after you are done.

                            ## Build & deploy

                            See `docs/DEPLOY-PHASE-1.md` for the exact gcloud commands.

                            ## Testing the deployed service

                            ```
                            # Unauthenticated
                            curl https://<service-url>/healthz
                            # Expected: {"status":"ok"}

                            # Authenticated — requires a Google ID token with hd=independencedso.com
                            curl https://<service-url>/me \
                              -H "Authorization: Bearer <google-id-token>"
                            # Expected: {"email":"you@independencedso.com","name":"...","picture":"..."}
                            ```

                            Getting a test ID token without a frontend is awkward; see `docs/DEPLOY-PHASE-1.md` for a one-off procedure using the Google OAuth Playground.
                            
