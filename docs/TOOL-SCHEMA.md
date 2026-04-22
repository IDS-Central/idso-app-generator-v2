# Tool Schema

Typed tool surface for the v2 backend's Anthropic tool-use loop. Every tool here is implemented server-side, validated against a JSON schema, and logged with `{authEmail, buildId, tool, argsSummary, tokensIn, tokensOut, latencyMs, outcome}`.

Design rules:

- **No arbitrary shell.** The only shell-like tool is `run_in_build_sandbox` and it accepts only a whitelisted set of commands.
- - **No secret leakage.** Tools that touch secrets never return the secret value to the loop. They return `{name, version}` or `{ok}` only.
  - - **No privilege escalation.** Tools that grant IAM reject project-level `secretmanager.secretAccessor` outright.
    - - **Plan gate is enforced in code, not just prompted.** The loop's tool dispatcher rejects any tool marked `requiresApprovedPlan: true` until `plan_present` has returned `approved: true` for the current build.
     
      - ---

      ## GitHub (via GitHub App on IDS-Central)

      ### `github_create_repo`
      - **Input:** `{ name: string, template?: string = "IDS-Central/idso-app-template", private: true, topics: string[], description: string }`
      - - **Output:** `{ repo: string, cloneUrl: string }`
        - - **Validation:** `name` must match `^idso-[a-z][a-z0-9-]{2,29}$`. `topics` must include `generated-by-idso-app-generator-v2` and `created-by-{sanitized-email}`.
          - - **Side effect:** Adds the new repo to the GitHub App installation.
            - - **Requires approved plan:** yes.
             
              - ### `github_commit_files`
              - - **Input:** `{ repo: string, branch: string = "main", message: string, files: Array<{ path: string, content: string, mode?: "100644"|"100755" }> }`
                - - **Output:** `{ sha: string }`
                  - - **Validation:** `repo` must be `IDS-Central/idso-*` and must have the generator topic. `files[*].path` must not match any LOCKED path from `IDSO-APP-CONVENTIONS.md` §11 unless explicitly whitelisted by `allowedLockedPath`.
                    - - **Requires approved plan:** yes.
                     
                      - ### `github_open_pr`
                      - - **Input:** `{ repo: string, head: string, base: string = "main", title: string, body: string }`
                        - - **Output:** `{ prUrl: string, number: number }`
                          - - **Requires approved plan:** yes.
                           
                            - ### `github_add_collaborator`
                            - - **Input:** `{ repo: string, username: string, permission: "pull"|"push"|"admin" = "push" }`
                              - - **Output:** `{ ok: true }`
                                - - **Validation:** `repo` must be one the generator created. `username` must resolve to a verified `independencedso.com` email (defense against accidentally adding external collaborators).
                                  - - **Requires approved plan:** yes.
                                   
                                    - ### `github_set_repo_topics`
                                    - - **Input:** `{ repo: string, topics: string[] }`
                                      - - **Output:** `{ ok: true }`
                                        - - **Validation:** Must retain `generated-by-idso-app-generator-v2`.
                                         
                                          - ### `github_read_file`
                                          - - **Input:** `{ repo: string, path: string, ref: string = "main" }`
                                            - - **Output:** `{ content: string }` (utf-8; binary rejected).
                                              - - **Requires approved plan:** no (used for reading existing-app context).
                                               
                                                - ### `list_user_apps`
                                                - - **Input:** `{ email: string }` (must equal `authEmail`; the tool rejects other values).
                                                  - - **Output:** `Array<{ repo: string, createdAt: string, cloudRunUrl?: string, description?: string }>`
                                                    - - **Implementation:** Lists all `IDS-Central/*` repos with topic `generated-by-idso-app-generator-v2`, filters to those where `email` is a collaborator, optionally reads `.idso/owner.json` for extra metadata.
                                                     
                                                      - ### `write_owner_file`
                                                      - - **Input:** `{ repo: string, email: string, generatorVersion: string }`
                                                        - - **Output:** `{ ok: true }`
                                                          - - **Side effect:** Commits `.idso/owner.json` with `{ repo, createdBy: email, createdAt: <now>, generatorVersion }`.
                                                           
                                                            - ---

                                                            ## Secret Manager

                                                            ### `secret_create`
                                                            - **Input:** `{ name: string, value: string, project: string = "central-workspace" }`
                                                            - - **Output:** `{ name: string, version: string }` — never the value.
                                                              - - **Validation:** `name` must match `^(idso-[a-z0-9-]+|[a-z0-9-]+-(db-url|encryption-key|.+))$` and be tied to the current build's app name.
                                                                - - **Requires approved plan:** yes.
                                                                 
                                                                  - ### `secret_add_version`
                                                                  - - **Input:** `{ name: string, value: string }`
                                                                    - - **Output:** `{ version: string }`
                                                                     
                                                                      - ### `secret_fetch`
                                                                      - - **Input:** `{ name: string }`
                                                                        - - **Output:** `{ ok: true }` — **the value is NOT returned to the loop.** The tool marks the secret as "to be bound at deploy time" and records the binding. The secret's value only ever travels from Secret Manager to the running Cloud Run service at deploy time.
                                                                          - - **Rationale:** Keeps secret values out of model context and logs.
                                                                           
                                                                            - ### `secret_grant_access`
                                                                            - - **Input:** `{ secretName: string, memberType: "serviceAccount"|"user", member: string, role: "roles/secretmanager.secretAccessor" }`
                                                                              - - **Output:** `{ ok: true }`
                                                                                - - **Validation:** Rejects project-level grants. Rejects `memberType: "allUsers"` or `"allAuthenticatedUsers"`. `secretName` must match `{app}-*` or `idso-*`.
                                                                                 
                                                                                  - ---

                                                                                  ## IAM

                                                                                  ### `iam_create_service_account`
                                                                                  - **Input:** `{ name: string, displayName: string }`
                                                                                  - - **Output:** `{ email: string }`
                                                                                    - - **Validation:** `name` must equal `idso-{app}` for the current build. One SA per build.
                                                                                     
                                                                                      - ### `iam_grant_role`
                                                                                      - - **Input:** `{ target: "project"|"secret"|"bucket"|"dataset"|"cloudrun", targetId: string, member: string, role: string }`
                                                                                        - - **Output:** `{ ok: true }`
                                                                                          - - **Validation:**
                                                                                            -   - Rejects `target=project, role=roles/secretmanager.secretAccessor`.
                                                                                                -   - Rejects `member: allUsers | allAuthenticatedUsers` for any non-Cloud-Run `run.invoker` grant.
                                                                                                    -   - Logs every grant with `authEmail`.
                                                                                                     
                                                                                                        - ---
                                                                                                        
                                                                                                        ## Cloud SQL (only if data tier = Cloud SQL)
                                                                                                        
                                                                                                        ### `sql_create_database`
                                                                                                        - **Input:** `{ instance: string = "idso-shared", name: string }`
                                                                                                        - - **Output:** `{ ok: true }`
                                                                                                          - - **Validation:** `name` must equal `idso_{app_underscored}`.
                                                                                                           
                                                                                                            - ### `sql_create_user`
                                                                                                            - - **Input:** `{ instance: string, name: string, passwordSecretName: string }`
                                                                                                              - - **Output:** `{ ok: true }`
                                                                                                                - - **Implementation:** Password is generated server-side (32 bytes, url-safe), stored directly to `passwordSecretName` in Secret Manager, and set on the SQL user. Never returned to the loop.
                                                                                                                 
                                                                                                                  - ---
                                                                                                                  
                                                                                                                  ## BigQuery
                                                                                                                  
                                                                                                                  ### `bq_create_dataset`
                                                                                                                  - **Input:** `{ project: string = "central-workspace", dataset: string, location: string = "US" }`
                                                                                                                  - - **Output:** `{ ok: true }`
                                                                                                                   
                                                                                                                    - ### `bq_create_table`
                                                                                                                    - - **Input:** `{ project: string, dataset: string, table: string, schema: Array<{ name: string, type: string, mode?: "NULLABLE"|"REQUIRED"|"REPEATED", description?: string }>, withAudit: boolean = true }`
                                                                                                                      - - **Output:** `{ ok: true }`
                                                                                                                        - - **Side effect:** When `withAudit` is true, automatically appends `created_at TIMESTAMP`, `updated_at TIMESTAMP`, `updated_by STRING` to the schema.
                                                                                                                         
                                                                                                                          - ### `bq_query_dry_run`
                                                                                                                          - - **Input:** `{ sql: string, params?: Array<{ name: string, type: string, value: string }> }`
                                                                                                                            - - **Output:** `{ ok: boolean, bytesProcessed: number, error?: string }`
                                                                                                                              - - **Rationale:** Lets Claude validate generated SQL without executing DML. The generator never runs DML via tools — DML only runs at app runtime inside the generated app.
                                                                                                                               
                                                                                                                                - ---
                                                                                                                                
                                                                                                                                ## Cloud Run + Cloud Build
                                                                                                                                
                                                                                                                                ### `cloud_run_deploy`
                                                                                                                                - **Input:** `{ service: string, image: string, region: string = "us-central1", serviceAccount: string, envVars?: Record<string, string>, secretEnv?: Record<string, string> (maps ENV_NAME → secret:version), allowUnauthenticated: boolean = true, cpu?: string, memory?: string, minInstances?: number, maxInstances?: number }`
                                                                                                                                - - **Output:** `{ url: string, revision: string }`
                                                                                                                                  - - **Validation:** `serviceAccount` must match `idso-{app}@...`. `envVars` must not contain secret values (regex check for patterns like `sk-ant-`, `github_pat_`).
                                                                                                                                   
                                                                                                                                    - ### `cloud_build_create_trigger`
                                                                                                                                    - - **Input:** `{ repo: string, branchPattern: string = "^main$", buildConfig: string = "cloudbuild.yaml", substitutions?: Record<string, string> }`
                                                                                                                                      - - **Output:** `{ triggerId: string }`
                                                                                                                                       
                                                                                                                                        - ### `cloud_build_submit`
                                                                                                                                        - - **Input:** `{ repo: string, ref: string = "main", config: string = "cloudbuild.yaml" }`
                                                                                                                                          - - **Output:** `{ buildId: string }`
                                                                                                                                           
                                                                                                                                            - ### `cloud_build_wait`
                                                                                                                                            - - **Input:** `{ buildId: string, timeoutSec: number = 900 }`
                                                                                                                                              - - **Output:** `{ status: "SUCCESS"|"FAILURE"|"TIMEOUT"|"CANCELLED", logsUrl: string, finishedAt: string }`
                                                                                                                                               
                                                                                                                                                - ### `cloud_run_get_url`
                                                                                                                                                - - **Input:** `{ service: string, region: string = "us-central1" }`
                                                                                                                                                  - - **Output:** `{ url: string }`
                                                                                                                                                   
                                                                                                                                                    - ### `cloud_run_curl_health`
                                                                                                                                                    - - **Input:** `{ url: string, path: string = "/api/health", expectStatus: number = 200 }`
                                                                                                                                                      - - **Output:** `{ status: number, body: string }`
                                                                                                                                                       
                                                                                                                                                        - ### `cloud_run_curl_protected`
                                                                                                                                                        - - **Input:** `{ url: string, path: string }`
                                                                                                                                                          - - **Output:** `{ status: number }`
                                                                                                                                                            - - **Used for:** Post-deploy auth verification. The generator asserts `status === 401` on a protected route before marking a build as successful.
                                                                                                                                                             
                                                                                                                                                              - ---
                                                                                                                                                              
                                                                                                                                                              ## OAuth (Identity-Aware Proxy brand)
                                                                                                                                                              
                                                                                                                                                              ### `oauth_add_redirect_uri`
                                                                                                                                                              - **Input:** `{ clientId: string = "idso-shared-oauth", uri: string }`
                                                                                                                                                              - - **Output:** `{ ok: true }`
                                                                                                                                                                - - **Validation:** `uri` must be `https://` and must be a Cloud Run URL for a service created in this build.
                                                                                                                                                                  - - **Rationale:** Closes the last manual step from v1.
                                                                                                                                                                   
                                                                                                                                                                    - ---
                                                                                                                                                                    
                                                                                                                                                                    ## Build diagnostics
                                                                                                                                                                    
                                                                                                                                                                    ### `read_build_logs`
                                                                                                                                                                    - **Input:** `{ buildId: string, maxLines: number = 500, tail: boolean = true }`
                                                                                                                                                                    - - **Output:** `{ lines: string[] }`
                                                                                                                                                                     
                                                                                                                                                                      - ### `read_cloud_run_logs`
                                                                                                                                                                      - - **Input:** `{ service: string, region: string = "us-central1", sinceSec: number = 600, maxLines: number = 500 }`
                                                                                                                                                                        - - **Output:** `{ lines: Array<{ timestamp: string, severity: string, message: string }> }`
                                                                                                                                                                         
                                                                                                                                                                          - ---
                                                                                                                                                                          
                                                                                                                                                                          ## Sandboxed shell
                                                                                                                                                                          
                                                                                                                                                                          ### `run_in_build_sandbox`
                                                                                                                                                                          - **Input:** `{ buildId: string, cmd: "npm install"|"npm run build"|"npx prisma generate"|"npm run test"|"npm run lint", timeoutSec: number = 600 }`
                                                                                                                                                                          - - **Output:** `{ exitCode: number, stdout: string, stderr: string }` (each capped at 10 KB).
                                                                                                                                                                            - - **Implementation:** Runs in an ephemeral Cloud Build step or Cloud Run Job with no GCP credentials beyond what the command needs. Network egress restricted to the npm registry and GitHub.
                                                                                                                                                                              - - **Whitelist is hard-coded server-side.** No other commands accepted. The loop cannot request arbitrary shell.
                                                                                                                                                                               
                                                                                                                                                                                - ---
                                                                                                                                                                                
                                                                                                                                                                                ## Plan / budget control (internal, not GCP)
                                                                                                                                                                                
                                                                                                                                                                                ### `plan_present`
                                                                                                                                                                                - **Input:** `{ plan: { appName: string, description: string, dataTier: "cloud_sql"|"bigquery"|"both", models: Array<{ name: string, fields: Array<{ name: string, type: string }> }>, pages: Array<{ path: string, purpose: string }>, apiRoutes: Array<{ path: string, method: string, purpose: string }>, externalServices: string[], secretsToCreate: string[], estimatedCostUsd: number } }`
                                                                                                                                                                                - - **Output:** `{ approved: boolean, revisions?: string }`
                                                                                                                                                                                  - - **Implementation:** Emits `plan_proposed` SSE event and suspends the loop until the frontend sends `plan_approved` or `plan_rejected`.
                                                                                                                                                                                   
                                                                                                                                                                                    - ### `budget_check`
                                                                                                                                                                                    - - **Input:** `{ buildId: string }`
                                                                                                                                                                                      - - **Output:** `{ tokensUsed: number, softCap: number, hardCap: number, percentOfSoft: number }`
                                                                                                                                                                                        - - **Called:** Automatically by the dispatcher before every tool call. Not usually called by Claude directly.
                                                                                                                                                                                         
                                                                                                                                                                                          - ### `budget_request_continuation`
                                                                                                                                                                                          - - **Input:** `{ buildId: string, reason: string }`
                                                                                                                                                                                            - - **Output:** `{ approved: boolean }`
                                                                                                                                                                                              - - **Implementation:** Emits `budget_soft_cap_hit` SSE event; resumes loop on `continue` message from frontend.
                                                                                                                                                                                               
                                                                                                                                                                                                - ---
                                                                                                                                                                                                
                                                                                                                                                                                                ## Tool call log shape (Cloud Logging)
                                                                                                                                                                                                
                                                                                                                                                                                                ```json
                                                                                                                                                                                                {
                                                                                                                                                                                                  "severity": "INFO",
                                                                                                                                                                                                  "authEmail": "jane@independencedso.com",
                                                                                                                                                                                                  "buildId": "bld_01HX...",
                                                                                                                                                                                                  "repo": "IDS-Central/idso-supply-requests",
                                                                                                                                                                                                  "tool": "cloud_run_deploy",
                                                                                                                                                                                                  "argsSummary": {
                                                                                                                                                                                                    "service": "supply-requests-app-dev",
                                                                                                                                                                                                    "image": "us-central1-docker.pkg.dev/.../supply-requests-app-dev:abc123"
                                                                                                                                                                                                  },
                                                                                                                                                                                                  "tokensIn": 2450,
                                                                                                                                                                                                  "tokensOut": 128,
                                                                                                                                                                                                  "latencyMs": 18420,
                                                                                                                                                                                                  "outcome": "success",
                                                                                                                                                                                                  "resultSummary": {
                                                                                                                                                                                                    "url": "https://supply-requests-app-dev-abc-uc.a.run.app"
                                                                                                                                                                                                  }
                                                                                                                                                                                                }
                                                                                                                                                                                                ```
                                                                                                                                                                                                
                                                                                                                                                                                                `argsSummary` and `resultSummary` are sanitized — secret names may appear, secret values never do.
                                                                                                                                                                                                
                                                                                                                                                                                                ---
                                                                                                                                                                                                
                                                                                                                                                                                                ## Tools intentionally NOT in this schema
                                                                                                                                                                                                
                                                                                                                                                                                                - `run_shell_command` with arbitrary input. v1 used this implicitly via Claude Code. v2 replaces it with the tight `run_in_build_sandbox` whitelist.
                                                                                                                                                                                                - - `gcp_project_iam_grant` without target scope. Always use `iam_grant_role` with a specific target.
                                                                                                                                                                                                  - - `anthropic_fetch_own_api_key` or equivalent. The loop must never read its own key.
                                                                                                                                                                                                    - - `github_create_oauth_app`. Forbidden; OAuth clients are never created by the generator.
                                                                                                                                                                                                      - - `delete_*` tools. v2 is build-only. Teardown is a separate admin surface (Phase 4 polish).
                                                                                                                                                                                                        - 
