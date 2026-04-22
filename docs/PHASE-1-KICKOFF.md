# Phase 1 Kickoff — Admin Checklist

This document lists the one-time admin actions that must be completed in Google Cloud and GitHub **before** the Phase 1 backend skeleton can run end-to-end. It is the hand-off contract between the human admin (nghia@independencedso.com) and the generator backend.

Nothing here writes code. Every step is something a human with Owner-level access to the IDSO GCP project and Owner-level access to the IDS-Central GitHub org must perform manually.

When each step is complete, record the resulting identifier (project ID, SA email, secret name, GitHub App ID, installation ID, etc.) in the "Values to send back" section at the bottom and share it in the chat. Phase 1 backend code will consume those values via environment variables and Secret Manager — never hard-coded.

---

## 0. Decide the GCP project

Pick **one** GCP project to host both the backend Cloud Run service and every generated app's resources. The v1 generator assumed a single-project model and we are keeping that.

**Action:**
- Either reuse the existing IDSO GCP project that hosts the v1 apps, or create a dedicated project (recommended: dedicated, so the generator's IAM surface is contained).
- - Note the `PROJECT_ID` and `PROJECT_NUMBER`.
 
  - **Send back:**
  - - `PROJECT_ID`
    - - `PROJECT_NUMBER`
      - - `REGION` (default recommendation: `us-central1`, matching v1)
       
        - ---

        ## 1. Enable required GCP APIs

        Run once in Cloud Shell against the chosen project:

        ```
        gcloud config set project PROJECT_ID

        gcloud services enable \
          run.googleapis.com \
          cloudbuild.googleapis.com \
          secretmanager.googleapis.com \
          iam.googleapis.com \
          iamcredentials.googleapis.com \
          logging.googleapis.com \
          bigquery.googleapis.com \
          sqladmin.googleapis.com \
          artifactregistry.googleapis.com \
          cloudresourcemanager.googleapis.com \
          serviceusage.googleapis.com
        ```

        **Why each:**
        - `run` — host backend and generated apps
        - - `cloudbuild` — build images from generated repos
          - - `secretmanager` — all credentials
            - - `iam` + `iamcredentials` — create/grant SA identities for generated apps
              - - `logging` — structured logs with authenticated email
                - - `bigquery` — dimensional/reference data tier
                  - - `sqladmin` — transactional tier (Cloud SQL for Postgres, per D-003)
                    - - `artifactregistry` — container registry for built images
                      - - `cloudresourcemanager` + `serviceusage` — needed when the generator grants roles on the project to per-app SAs
                       
                        - ---

                        ## 2. Create the backend service account

                        The backend Cloud Run service runs as a dedicated SA. This SA is the identity Anthropic tool calls run under.

                        **Action:**
                        ```
                        gcloud iam service-accounts create idso-app-generator-v2 \
                          --display-name="IDSO App Generator v2 backend" \
                          --description="Runs the app-generator-v2 backend Cloud Run service. Executes tool calls on behalf of authenticated @independencedso.com users."
                        ```

                        The resulting email will be:
                        `idso-app-generator-v2@PROJECT_ID.iam.gserviceaccount.com`

                        **Send back:**
                        - `BACKEND_SA_EMAIL`
                       
                        - ---

                        ## 3. Grant project-level roles to the backend SA

                        Per D-009 we avoid project-level grants where possible, but a small set are unavoidable because the backend creates *new* resources (new Cloud Run services, new secrets, new BQ datasets) whose names do not exist yet.

                        Grant the **minimum** set below. Do **not** grant Owner, Editor, or anything with `*.admin` that is broader than listed.

                        ```
                        PROJECT_ID=...           # fill in
                        SA=idso-app-generator-v2@$PROJECT_ID.iam.gserviceaccount.com

                        # Cloud Run: deploy services (generated apps + redeploy itself is out of scope)
                        gcloud projects add-iam-policy-binding $PROJECT_ID \
                          --member="serviceAccount:$SA" --role="roles/run.admin"

                        # Cloud Build: submit builds
                        gcloud projects add-iam-policy-binding $PROJECT_ID \
                          --member="serviceAccount:$SA" --role="roles/cloudbuild.builds.editor"

                        # Secret Manager: create new secrets (per-secret access for *reading* is granted separately, per D-009)
                        gcloud projects add-iam-policy-binding $PROJECT_ID \
                          --member="serviceAccount:$SA" --role="roles/secretmanager.admin"

                        # BigQuery: create datasets/tables for generated apps
                        gcloud projects add-iam-policy-binding $PROJECT_ID \
                          --member="serviceAccount:$SA" --role="roles/bigquery.admin"

                        # Cloud SQL: create instances/databases for transactional tier
                        gcloud projects add-iam-policy-binding $PROJECT_ID \
                          --member="serviceAccount:$SA" --role="roles/cloudsql.admin"

                        # Artifact Registry: push images built by Cloud Build
                        gcloud projects add-iam-policy-binding $PROJECT_ID \
                          --member="serviceAccount:$SA" --role="roles/artifactregistry.admin"

                        # Service account admin: create per-app runtime SAs for generated apps
                        gcloud projects add-iam-policy-binding $PROJECT_ID \
                          --member="serviceAccount:$SA" --role="roles/iam.serviceAccountAdmin"

                        # Service account user: let Cloud Run use per-app SAs
                        gcloud projects add-iam-policy-binding $PROJECT_ID \
                          --member="serviceAccount:$SA" --role="roles/iam.serviceAccountUser"

                        # Logging: write structured logs
                        gcloud projects add-iam-policy-binding $PROJECT_ID \
                          --member="serviceAccount:$SA" --role="roles/logging.logWriter"
                        ```

                        **Explicitly NOT granted (by design):**
                        - `roles/owner`
                        - - `roles/editor`
                          - - `roles/resourcemanager.projectIamAdmin` (we do NOT let the backend modify project IAM policies; it can only manage SA-level and resource-level IAM)
                            - - `roles/iam.organizationRoleAdmin`
                              - - Anything under `compute.*` (generator does not touch GCE)
                               
                                - If a tool call later fails because a role is missing, the tool-call failure is surfaced in the chat and escalated to you — the backend will not self-grant.
                               
                                - ---

                                ## 4. Create placeholder secrets in Secret Manager

                                The backend expects these secrets to exist at startup. Create them empty-named now; populate after the GitHub App is registered in Step 6.

                                ```
                                gcloud secrets create anthropic-api-key --replication-policy=automatic
                                gcloud secrets create github-app-id --replication-policy=automatic
                                gcloud secrets create github-app-client-id --replication-policy=automatic
                                gcloud secrets create github-app-client-secret --replication-policy=automatic
                                gcloud secrets create github-app-private-key --replication-policy=automatic
                                gcloud secrets create github-app-webhook-secret --replication-policy=automatic
                                gcloud secrets create google-oauth-client-id --replication-policy=automatic
                                gcloud secrets create google-oauth-client-secret --replication-policy=automatic
                                ```

                                Then grant the backend SA **per-secret** accessor (not project-level), per D-009:

                                ```
                                for S in anthropic-api-key github-app-id github-app-client-id github-app-client-secret github-app-private-key github-app-webhook-secret google-oauth-client-id google-oauth-client-secret; do
                                  gcloud secrets add-iam-policy-binding $S \
                                    --member="serviceAccount:$SA" \
                                    --role="roles/secretmanager.secretAccessor"
                                done
                                ```

                                Populate `anthropic-api-key` now with the IDSO Anthropic API key:

                                ```
                                echo -n "sk-ant-..." | gcloud secrets versions add anthropic-api-key --data-file=-
                                ```

                                **Send back:**
                                - Confirmation all 8 secrets exist
                                - - Confirmation `anthropic-api-key` has a version
                                 
                                  - ---

                                  ## 5. Register the Google OAuth client (frontend SSO)

                                  The frontend is a Cloud Run service that signs users in with Google and restricts to `hd=independencedso.com`.

                                  **Action:**
                                  1. In Google Cloud Console → APIs & Services → Credentials, create an **OAuth 2.0 Client ID** of type **Web application**.
                                  2. 2. Name: `IDSO App Generator v2 — Web`
                                     3. 3. Authorized JavaScript origins: leave blank for now (will be added when frontend Cloud Run URL is provisioned in Phase 3).
                                        4. 4. Authorized redirect URIs: leave blank for now.
                                           5. 5. Consent screen must be **Internal** (already the case if the project is inside the IDSO Google Workspace).
                                             
                                              6. Capture the client ID and client secret, then store them:
                                             
                                              7. ```
                                                 echo -n "CLIENT_ID_HERE" | gcloud secrets versions add google-oauth-client-id --data-file=-
                                                 echo -n "CLIENT_SECRET_HERE" | gcloud secrets versions add google-oauth-client-secret --data-file=-
                                                 ```

                                                 **Send back:**
                                                 - Confirmation OAuth client exists and is Internal
                                                 - - Confirmation both secrets have versions
                                                  
                                                   - ---

                                                   ## 6. Register the GitHub App on IDS-Central

                                                   Per D-006, the generator uses a GitHub App installed on the IDS-Central org (not PATs).

                                                   **Action:**
                                                   1. Go to https://github.com/organizations/IDS-Central/settings/apps/new
                                                   2. 2. Fill the manifest:
                                                      3.    - **GitHub App name:** `IDSO App Generator v2`
                                                            -    - **Homepage URL:** `https://github.com/IDS-Central/idso-app-generator-v2` (temporary; replace with frontend URL in Phase 3)
                                                                 -    - **Webhook:** disabled for now (no webhook consumer in Phase 1; will enable in Phase 2 when we add build-log streaming)
                                                                      -    - **Repository permissions:**
                                                                           -      - Administration: **Read & write** (create repos)
                                                                           -       - Contents: **Read & write** (commit files)
                                                                           -        - Metadata: **Read-only** (required)
                                                                           -         - Pull requests: **Read & write**
                                                                           -          - Secrets: **No access** (generated-app secrets live in GCP Secret Manager, not GitHub)
                                                                           -           - Actions: **No access** (we do not use GitHub Actions; builds run in Cloud Build)
                                                                           -          - **Organization permissions:**
                                                                           -           - Members: **Read-only** (needed to add contributors to generated repos, per the ownership model)
                                                                           -            - Administration: **No access**
                                                                           -           - **Account permissions:** all **No access**
                                                                           -          - **Where can this GitHub App be installed?** Only on this account (IDS-Central)
                                                                           -      3. After creation:
                                                                           -     - Note the **App ID**
                                                                           -    - Note the **Client ID**
                                                                                -    - Generate a **Client secret** — store in `github-app-client-secret`
                                                                                     -    - Generate a **private key** (.pem) — store the entire PEM contents in `github-app-private-key`
                                                                                          -    - Store the App ID in `github-app-id` and the Client ID in `github-app-client-id`
                                                                                               -    - Leave `github-app-webhook-secret` empty until Phase 2 (webhooks disabled)
                                                                                                
                                                                                                    - ```
                                                                                                      echo -n "12345678" | gcloud secrets versions add github-app-id --data-file=-
                                                                                                      echo -n "Iv23li..." | gcloud secrets versions add github-app-client-id --data-file=-
                                                                                                      echo -n "CLIENT_SECRET_HERE" | gcloud secrets versions add github-app-client-secret --data-file=-
                                                                                                      gcloud secrets versions add github-app-private-key --data-file=./idso-app-generator-v2.private-key.pem
                                                                                                      rm ./idso-app-generator-v2.private-key.pem
                                                                                                      ```
                                                                                                      
                                                                                                      4. Install the App on IDS-Central:
                                                                                                      5.    - From the App's settings page → **Install App** → IDS-Central
                                                                                                            -    - Choose **Only select repositories** and **select zero repositories** for now. Every repo the generator creates will be added to this installation programmatically.
                                                                                                                 -    - Capture the **Installation ID** (visible in the URL after install: `/settings/installations/<INSTALLATION_ID>`)
                                                                                                                  
                                                                                                                      - **Send back:**
                                                                                                                      - - `GITHUB_APP_ID`
                                                                                                                        - - `GITHUB_APP_CLIENT_ID`
                                                                                                                          - - `GITHUB_APP_INSTALLATION_ID` (IDS-Central org installation)
                                                                                                                            - - Confirmation that `github-app-client-secret` and `github-app-private-key` secrets have versions
                                                                                                                             
                                                                                                                              - ---
                                                                                                                              
                                                                                                                              ## 7. Create the Artifact Registry repo
                                                                                                                              
                                                                                                                              One registry for all generated-app images plus the generator backend image.
                                                                                                                              
                                                                                                                              ```
                                                                                                                              gcloud artifacts repositories create idso-apps \
                                                                                                                                --repository-format=docker \
                                                                                                                                --location=us-central1 \
                                                                                                                                --description="Container images for IDSO apps generated by app-generator-v2, and the generator backend itself"
                                                                                                                              ```
                                                                                                                              
                                                                                                                              **Send back:**
                                                                                                                              - Confirmation registry `idso-apps` exists in `us-central1`
                                                                                                                             
                                                                                                                              - ---
                                                                                                                              
                                                                                                                              ## 8. Do NOT do these things
                                                                                                                              
                                                                                                                              A few things that might look like natural next steps but are intentionally deferred or rejected:
                                                                                                                              
                                                                                                                              - **Do not** grant the backend SA `roles/owner` or `roles/editor` "just to unblock".
                                                                                                                              - - **Do not** create the backend Cloud Run service yet — Phase 1 code does not exist. The first deploy happens at the end of Phase 1 when backend scaffolding passes a health check locally.
                                                                                                                                - - **Do not** create any per-app resources. Every generated app's SA, secrets, BQ datasets, and Cloud SQL instance are created at generation time by tool calls — not now.
                                                                                                                                  - - **Do not** enable billing alerts that would block the project; use soft budget alerts only.
                                                                                                                                    - - **Do not** add any repos to the GitHub App installation by hand. The generator adds repos to its own installation as it creates them.
                                                                                                                                     
                                                                                                                                      - ---
                                                                                                                                      
                                                                                                                                      ## Values to send back
                                                                                                                                      
                                                                                                                                      Paste these into the chat when complete. I will not proceed with Phase 1 backend scaffolding until all are confirmed.
                                                                                                                                      
                                                                                                                                      ```
                                                                                                                                      PROJECT_ID:                         ________________________
                                                                                                                                      PROJECT_NUMBER:                     ________________________
                                                                                                                                      REGION:                             ________________________
                                                                                                                                      BACKEND_SA_EMAIL:                   ________________________
                                                                                                                                      SECRETS_CREATED (y/n):              ____
                                                                                                                                      ANTHROPIC_KEY_STORED (y/n):         ____
                                                                                                                                      OAUTH_CLIENT_ID_STORED (y/n):       ____
                                                                                                                                      OAUTH_CLIENT_SECRET_STORED (y/n):   ____
                                                                                                                                      GITHUB_APP_ID:                      ________________________
                                                                                                                                      GITHUB_APP_CLIENT_ID:               ________________________
                                                                                                                                      GITHUB_APP_INSTALLATION_ID:         ________________________
                                                                                                                                      GITHUB_APP_PRIVATE_KEY_STORED (y/n):____
                                                                                                                                      ARTIFACT_REGISTRY_READY (y/n):      ____
                                                                                                                                      ```
                                                                                                                                      
                                                                                                                                      ---
                                                                                                                                      
                                                                                                                                      ## What happens after this checklist is returned
                                                                                                                                      
                                                                                                                                      Once all values above are provided, Phase 1 begins with:
                                                                                                                                      
                                                                                                                                      1. Committing backend scaffolding to `backend/` — Node.js 20 + TypeScript + Fastify, per the tentative D-011 choice (subject to your confirmation).
                                                                                                                                      2. 2. Implementing `GET /healthz` (unauthenticated) and `GET /me` (requires valid `@independencedso.com` ID token).
                                                                                                                                         3. 3. Implementing Secret Manager client that loads the 8 secrets at boot.
                                                                                                                                            4. 4. Implementing structured logging with `authenticated_email` on every log line.
                                                                                                                                               5. 5. Implementing an Anthropic client that uses `anthropic-api-key` and logs every token usage event.
                                                                                                                                                  6. 6. A `Dockerfile` + `cloudbuild.yaml` so the backend can be deployed to Cloud Run.
                                                                                                                                                     7. 7. A first manual deploy (performed by you) using the `BACKEND_SA_EMAIL` as the runtime identity.
                                                                                                                                                       
                                                                                                                                                        8. No tool-use loop and no frontend in Phase 1 — those are Phases 2 and 3.
                                                                                                                                                        9. 
