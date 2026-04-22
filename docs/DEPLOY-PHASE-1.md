# Phase 1 Deploy Runbook

Exact commands to build and deploy the Phase 1 backend to Cloud Run, and to verify both endpoints work.

Run these **as you (nghia@independencedso.com)**, not as the backend service account. The backend SA is the *runtime* identity of the service; it is not used to deploy.

Prerequisites: PHASE-1-KICKOFF.md is complete. All 5 secrets exist and are populated. The GitHub App is registered and installed. The Artifact Registry `idso-apps` exists.

---

## 1. Clone the repo locally (or use Cloud Shell)

```
git clone https://github.com/IDS-Central/idso-app-generator-v2.git
cd idso-app-generator-v2
```

## 2. Build the container image via Cloud Build

```
gcloud config set project reconciliation-dashboard

gcloud builds submit backend \
  --config=backend/cloudbuild.yaml \
  --substitutions=_IMAGE_TAG=$(git rev-parse --short HEAD)
```

Expected output ends with:
```
SUCCESS
IMAGES
us-central1-docker.pkg.dev/reconciliation-dashboard/idso-apps/app-generator-v2-backend:<shorthash>
us-central1-docker.pkg.dev/reconciliation-dashboard/idso-apps/app-generator-v2-backend:latest
```

## 3. Deploy to Cloud Run

```
SHORTHASH=$(git rev-parse --short HEAD)

gcloud run deploy app-generator-v2-backend \
  --image=us-central1-docker.pkg.dev/reconciliation-dashboard/idso-apps/app-generator-v2-backend:$SHORTHASH \
  --region=us-central1 \
  --platform=managed \
  --service-account=idso-app-generator-v2@reconciliation-dashboard.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --ingress=all \
  --min-instances=0 \
  --max-instances=3 \
  --memory=512Mi \
  --cpu=1 \
  --concurrency=40 \
  --timeout=60 \
  --set-env-vars="PROJECT_ID=reconciliation-dashboard,REGION=us-central1,ALLOWED_HD=independencedso.com,GITHUB_APP_ID=3469712,GITHUB_APP_CLIENT_ID=Iv23liENpmH0xcNIoxzY,GITHUB_APP_INSTALLATION_ID=126241513,GOOGLE_OAUTH_CLIENT_ID_SECRET=oauth-client-id"
```

Notes:
- `--no-allow-unauthenticated` means the service itself requires a Google-authenticated caller to even reach Fastify. Our `/me` endpoint layers a second check (the ID token must have `hd=independencedso.com`). `/healthz` only requires the IAM allowlist, not the ID token check, which is fine for a liveness probe.
- - `--min-instances=0` means cold starts are possible; acceptable for Phase 1.
  - - For Phase 3 we'll flip `--no-allow-unauthenticated` to `--allow-unauthenticated` so browsers can call the service, and security will rely entirely on the ID token check inside Fastify.
   
    - ## 4. Grant your user permission to invoke the service (for testing)
   
    - Because we deployed with `--no-allow-unauthenticated`, your user principal needs `roles/run.invoker` on the service:
   
    - ```
      gcloud run services add-iam-policy-binding app-generator-v2-backend \
        --region=us-central1 \
        --member="user:nghia@independencedso.com" \
        --role="roles/run.invoker"
      ```

      Capture the service URL:
      ```
      SERVICE_URL=$(gcloud run services describe app-generator-v2-backend \
        --region=us-central1 --format='value(status.url)')
      echo $SERVICE_URL
      ```

      ## 5. Verify /healthz

      ```
      curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" "$SERVICE_URL/healthz"
      ```

      Expected: `{"status":"ok"}`

      (Note: the bearer token here is a **gcloud identity token for the Cloud Run IAM check**, not a Workspace user ID token. `/healthz` does not re-verify it inside Fastify, so any IAM-authorized caller passes.)

      ## 6. Verify /me end-to-end

      This is the real test: get an ID token issued by Google for your `@independencedso.com` account and hit `/me`.

      The easiest way without a frontend is via the **Google OAuth 2.0 Playground**:

      1. Open https://developers.google.com/oauthplayground/
      2. 2. Click the gear icon (top right) → **Use your own OAuth credentials**
         3. 3. Paste the **OAuth Client ID** and **OAuth Client secret** from the `oauth-client-id` and `oauth-client-secret` secrets.
            4. 4. In **Step 1** on the left, under **Select & authorize APIs**, scroll to the bottom and check `openid`, `email`, `profile`.
               5. 5. Click **Authorize APIs**. Sign in with your `@independencedso.com` account.
                  6. 6. Click **Exchange authorization code for tokens**.
                     7. 7. In the response JSON, copy the value of `id_token` (a long `eyJ...` string).
                        8. 8. Call `/me`:
                          
                           9. ```
                              ID_TOKEN="eyJ..."                   # paste the id_token from the playground
                              ACCESS_TOKEN=$(gcloud auth print-identity-token)
                              curl "$SERVICE_URL/me" \
                                -H "Authorization: Bearer $ID_TOKEN" \
                                -H "X-Goog-Auth: Bearer $ACCESS_TOKEN"
                              ```

                              **Important:** Cloud Run's IAM check and our Fastify ID-token check are two different layers. Cloud Run expects its bearer token in `Authorization`. Our app expects the Google user ID token in `Authorization`. They can't both live there.

                              For this reason, the cleanest Phase 1 verification path is:
                              - **Option A (recommended):** temporarily redeploy with `--allow-unauthenticated` so Cloud Run stops gating. Then `Authorization: Bearer $ID_TOKEN` tests `/me` purely against our own auth layer. Redeploy with `--no-allow-unauthenticated` afterward.
                              - - **Option B:** keep `--no-allow-unauthenticated` and add your OAuth client's service-account proxy — more setup than it is worth for a one-off smoke test.
                               
                                - I recommend Option A. Example:
                               
                                - ```
                                  # Flip to allow-unauthenticated for testing
                                  gcloud run services update app-generator-v2-backend --region=us-central1 --allow-unauthenticated

                                  # Test /healthz
                                  curl "$SERVICE_URL/healthz"
                                  # Expected: {"status":"ok"}

                                  # Test /me with an IDSO Google ID token
                                  curl "$SERVICE_URL/me" -H "Authorization: Bearer $ID_TOKEN"
                                  # Expected: {"email":"nghia@independencedso.com","name":"...","picture":"..."}

                                  # Test /me with NO token -> should 401
                                  curl -i "$SERVICE_URL/me"
                                  # Expected: HTTP/2 401, body {"error":"missing_bearer"}

                                  # Test /me with a non-IDSO token -> should 401 with wrong_hd
                                  curl -i "$SERVICE_URL/me" -H "Authorization: Bearer <personal-gmail-id-token>"
                                  # Expected: HTTP/2 401, body {"error":"wrong_hd"}

                                  # Flip back to no-allow-unauthenticated
                                  gcloud run services update app-generator-v2-backend --region=us-central1 --no-allow-unauthenticated
                                  ```

                                  ## 7. Inspect logs

                                  ```
                                  gcloud logging read \
                                    'resource.type="cloud_run_revision" AND resource.labels.service_name="app-generator-v2-backend"' \
                                    --limit=20 --freshness=10m --format='value(jsonPayload.message,jsonPayload.authenticated_email)'
                                  ```

                                  You should see:
                                  - `boot_config_loaded`
                                  - - `boot_secrets_loaded`
                                    - - `boot_listening`
                                      - - `me_ok` lines with your email attached
                                       
                                        - ## 8. Report back
                                       
                                        - Once `/healthz` returns ok and `/me` returns your email, Phase 1 is done and we can plan Phase 2 (GitHub App token minting + Anthropic tool-use loop + first real tool: `create_github_repo`).
                                       
                                        - Please send back:
                                        - - Service URL
                                          - - Output of the `/healthz` call
                                            - - Output of the `/me` call (with your own email visible — nothing sensitive there)
                                              - - A snippet of a recent log line showing `authenticated_email` attached
                                                - 
