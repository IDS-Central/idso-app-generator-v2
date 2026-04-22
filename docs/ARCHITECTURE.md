# Architecture

## High level

```
┌───────────────────────────────────────────────────────────────────────┐
│                         Browser (IDSO staff)                          │
│  1. SSO with Google (hd=independencedso.com)                          │
│  2. Chat UI: describe → see plan → approve → watch streaming build    │
│  3. "Your apps" dashboard                                             │
└──────────────────┬────────────────────────────────────────────────────┘
                   │  HTTPS, Google ID token in Authorization header
                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Frontend  (Cloud Run: idso-app-generator-v2-frontend-prod)           │
│  - Next.js app, Google SSO UI, hd-locked                              │
│  - Proxies all mutating calls to the backend with the user's ID token │
└──────────────────┬────────────────────────────────────────────────────┘
                   │  HTTPS, ID token forwarded
                   ▼
┌───────────────────────────────────────────────────────────────────────┐
│  Backend   (Cloud Run: idso-app-generator-v2-backend-prod)            │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Auth middleware                                                 │  │
│  │ - Verify Google ID token on every request                       │  │
│  │ - Assert hd === 'independencedso.com' and email_verified        │  │
│  │ - Attach {authEmail, sub} to the request context                │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Budget enforcement                                              │  │
│  │ - Per-user monthly token cap (configurable)                     │  │
│  │ - Per-build soft cap → requires user re-approval to continue    │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Anthropic tool-use loop                                         │  │
│  │ - Single backend anthropic-api-key (Secret Manager)             │  │
│  │ - System prompt = IDSO-APP-CONVENTIONS.md                       │  │
│  │ - Typed tools, all calls logged with authEmail + buildId        │  │
│  │ - Plan-approval gate is a tool the loop cannot bypass           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Streaming endpoint (Server-Sent Events or Fetch streaming)      │  │
│  │ - Relays each tool call + result to the frontend in real time   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──┬──────────────┬──────────────┬───────────────┬──────────────┬───────┘
   │              │              │               │              │
   ▼              ▼              ▼               ▼              ▼
┌──────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌────────────┐
│GitHub│   │ Secret   │   │ Cloud Run │   │ Cloud    │   │ BigQuery / │
│ App  │   │ Manager  │   │ (deploy)  │   │ Build    │   │ Cloud SQL  │
│(IDS- │   │ (GCP)    │   │ (GCP)     │   │ (GCP)    │   │ (GCP)      │
│Central)  │          │   │           │   │          │   │            │
└──────┘   └──────────┘   └───────────┘   └──────────┘   └────────────┘
```

## Services

### Frontend — `idso-app-generator-v2-frontend-{env}`
Next.js app. Single job: authenticate the user with Google SSO (shared IDSO OAuth client, `hd=independencedso.com`), render the chat UI, forward requests to the backend with the user's Google ID token. Holds no secrets.

### Backend — `idso-app-generator-v2-backend-{env}`
The actual generator. Runs the Anthropic tool-use loop. Holds the backend Anthropic key and GitHub App credentials in Secret Manager. Runs under a dedicated service account `idso-app-generator-v2@central-workspace.iam.gserviceaccount.com` with broad but scoped rights (see "Backend service account permissions" below).

## Auth model

### User → Frontend
Standard Google OAuth in the browser. Shared IDSO OAuth client ID. `hd=independencedso.com` on the request. Session cookie managed by the frontend using the same AES-256-GCM pattern as generated apps (so the frontend is itself a reference implementation of the convention).

### Frontend → Backend
Every backend call carries the user's Google ID token in `Authorization: Bearer <id_token>`. The backend re-verifies server-side on every request:
- Signature valid against Google's JWKs
- - `aud` matches the IDSO OAuth client
  - - `hd === 'independencedso.com'`
    - - `email_verified === true`
      - - `exp` not expired
       
        - No session is stored on the backend. The authenticated email is the stable user ID for logging, budget tracking, and GitHub collaborator assignment.
       
        - ### Backend → GCP
        - Runs as its own service account (attached to the Cloud Run service). No keys.
       
        - ### Backend → GitHub
        - As a GitHub App installed on `IDS-Central`. Backend exchanges its App private key (from Secret Manager) for a short-lived installation access token on every request. No personal access tokens anywhere.
       
        - ### Backend → Anthropic
        - Backend Anthropic API key stored in Secret Manager as `anthropic-api-key`. Only the backend SA has `secretmanager.secretAccessor` on it. Token usage is logged per request with the authenticated email.
       
        - ## Backend service account permissions
       
        - Granted per-resource, not project-wide, wherever possible:
       
        - - **Secret Manager**
          -   - `secretmanager.secretAccessor` on its own operational secrets (`anthropic-api-key`, `github-app-id`, `github-app-private-key`, `github-app-installation-id`).
              -   - `secretmanager.admin` on secrets whose names match `idso-*` / `{app}-*` — needed to create per-app secrets and grant per-secret IAM to app SAs. Scoped by an IAM Condition on the secret name prefix where possible.
                  - - **IAM**
                    -   - `iam.serviceAccountAdmin` — scoped to the `central-workspace` project but bounded by the generator's own tool whitelist (it only creates SAs named `idso-*`).
                        -   - `resourcemanager.projectIamAdmin` — to grant per-secret and per-resource roles to the app SAs it creates. Scoped by condition where possible.
                            - - **Cloud Run**
                              -   - `run.admin` on `central-workspace` to create new services.
                                  - - **Cloud Build**
                                    -   - `cloudbuild.builds.editor` on `central-workspace` to create triggers and submit builds.
                                        - - **Cloud SQL**
                                          -   - `cloudsql.admin` on the shared `idso-shared` instance (only) to create databases and users.
                                              - - **BigQuery**
                                                -   - `bigquery.admin` on `central-workspace` to create datasets and tables.
                                                    - - **GCP OAuth (Identity-Aware Proxy / OAuth brand)**
                                                      -   - Permission on the shared OAuth client to add authorized redirect URIs (this is the capability v1 required a human admin for).
                                                       
                                                          - All of this is scoped to `central-workspace`. The backend has no rights in any other GCP project.
                                                       
                                                          - ## GitHub App
                                                       
                                                          - - Registered on the `IDS-Central` org (not a user's personal account).
                                                            - - Permissions requested:
                                                              -   - **Repository:** Administration (write) — to create repos, add topics, add collaborators.
                                                                  -   - **Repository:** Contents (write) — to commit files, open PRs.
                                                                      -   - **Repository:** Metadata (read).
                                                                          - - Installation scope: "Only select repositories" — starts empty, the App adds each new repo it creates to its installation. Never installed on the whole org. This keeps blast radius tight.
                                                                            - - Manifest stored in `backend/github-app/manifest.json` (Phase 1 deliverable).
                                                                             
                                                                              - ## Anthropic tool-use loop
                                                                             
                                                                              - Pseudo-code:
                                                                             
                                                                              - ```
                                                                                system = IDSO_APP_CONVENTIONS_MD + role_instructions
                                                                                tools = [ /* typed tool schemas; see TOOL-SCHEMA.md */ ]

                                                                                messages = [{role: "user", content: user_description}]

                                                                                while True:
                                                                                    response = anthropic.messages.create(
                                                                                        model="claude-sonnet-4.7" (or opus for initial planning if budget allows),
                                                                                        system=system,
                                                                                        tools=tools,
                                                                                        messages=messages,
                                                                                        max_tokens=4096,
                                                                                        stream=True,
                                                                                    )

                                                                                    stream_to_frontend(response)

                                                                                    if response.stop_reason == "end_turn":
                                                                                        break

                                                                                    if response.stop_reason == "tool_use":
                                                                                        for tool_call in response.tool_calls:
                                                                                            if over_soft_budget():
                                                                                                request_user_reapproval()  # suspends loop
                                                                                            result = run_tool(tool_call, auth_email, build_id)
                                                                                            log(auth_email, build_id, tool_call, result, tokens)
                                                                                            messages.append({role: "assistant", content: response})
                                                                                            messages.append({role: "user", content: tool_result})
                                                                                ```

                                                                                Key properties:

                                                                                - The loop cannot skip the `plan_present` tool. It is required before any tool that mutates GitHub or GCP.
                                                                                - - Model default: Sonnet. Opus considered for the initial planning turn if empirical quality justifies the cost bump.
                                                                                  - - `read_build_logs` and `read_cloud_run_logs` let Claude diagnose its own failures. Retry with an upper bound (default 3 repair attempts per build).
                                                                                    - - Every tool result is structured (JSON). No raw shell output unless it's from the sandboxed build step, and even that is length-capped.
                                                                                     
                                                                                      - ## Streaming to the frontend
                                                                                     
                                                                                      - - Backend endpoint: `POST /api/builds` opens an SSE stream.
                                                                                        - - Event types: `plan_proposed`, `plan_approved`, `plan_rejected`, `tool_call_started`, `tool_call_completed`, `tool_call_failed`, `budget_soft_cap_hit`, `build_succeeded`, `build_failed`, `deploy_succeeded`.
                                                                                          - - Each event carries `buildId`, `timestamp`, and a payload. Frontend renders a live timeline.
                                                                                           
                                                                                            - ## Ownership and "Your apps"
                                                                                           
                                                                                            - - When the generator creates a new repo:
                                                                                              -   1. `github_create_repo` creates `IDS-Central/idso-{app}` with topics `generated-by-idso-app-generator-v2` and `created-by-{sanitized-email}`.
                                                                                                  2.   2. `github_add_collaborator` adds the requesting user with `push` permission.
                                                                                                       3.   3. `write_owner_file` commits `.idso/owner.json`.
                                                                                                            4. - "Your apps" dashboard calls `list_user_apps({email})` which:
                                                                                                               -   1. Lists all repos in `IDS-Central` with topic `generated-by-idso-app-generator-v2`.
                                                                                                                   2.   2. Filters to those where the user is a collaborator.
                                                                                                                        3.   3. Reads `.idso/owner.json` as a secondary check (defense-in-depth against topic deletion).
                                                                                                                             4.   4. Returns `[{repo, createdAt, cloudRunUrl}]`.
                                                                                                                               
                                                                                                                                  5. ## Security properties
                                                                                                                               
                                                                                                                                  6. - No user ever sees or handles any secret.
                                                                                                                                     - - Backend never sends secrets back to Claude as tool output. Tools that create secrets return only `{name, version}`.
                                                                                                                                       - - Backend never executes user-supplied shell. The `run_in_build_sandbox` tool only accepts commands from a whitelist and only runs them inside a Cloud Build step or ephemeral Cloud Run Job.
                                                                                                                                         - - Backend never grants project-wide `secretmanager.secretAccessor` (enforced in the `iam_grant_role` tool).
                                                                                                                                           - - Backend never creates a new OAuth client — only adds redirect URIs to the shared one.
                                                                                                                                             - - ID token verification happens on every request, not once per session. Session tokens can't be replayed after a user is offboarded from the Workspace.
                                                                                                                                               - - Offboarding is automatic: deprovisioning the user's Workspace account immediately invalidates their ID tokens.
                                                                                                                                                
                                                                                                                                                 - ## Failure modes and what happens
                                                                                                                                                
                                                                                                                                                 - | Failure | Handling |
                                                                                                                                                 - |---|---|
                                                                                                                                                 - | ID token invalid / wrong domain | 401, nothing runs |
                                                                                                                                                 - | Plan rejected by user | No tools run after plan_present |
                                                                                                                                                 - | Build fails at Cloud Build | read_build_logs → repair iteration (up to N=3) → if still failing, surface to user with log excerpt |
                                                                                                                                                 - | Deploy succeeds but /api/health returns non-200 | Roll revision back; surface logs |
                                                                                                                                                 - | Deploy succeeds but protected route returns 200 without auth | Block build as failure (auth middleware is broken); roll back; surface |
                                                                                                                                                 - | Soft budget hit mid-build | Pause loop, emit `budget_soft_cap_hit`, require user re-approval |
                                                                                                                                                 - | Hard budget hit | Abort build, partial repo may exist; surface cleanup instructions |
                                                                                                                                                 - | GitHub App rate limit | Exponential backoff; if sustained, abort and surface |
                                                                                                                                                 - | GCP API quota exhausted | Abort, surface which quota, link to increase request |
                                                                                                                                                
                                                                                                                                                 - ## Environments
                                                                                                                                                
                                                                                                                                                 - - `dev` — used during development of v2 itself. Same architecture, separate Cloud Run services, separate GitHub App (installed on a scratch org or on a label-restricted installation).
                                                                                                                                                   - - `prod` — the live generator.
                                                                                                                                                     - - No `staging` for the generator itself; the generator is small enough that dev → prod works.
                                                                                                                                                      
                                                                                                                                                       - ## What v2 does NOT do
                                                                                                                                                      
                                                                                                                                                       - - Does not manage existing repos that lack the `generated-by-idso-app-generator-v2` topic.
                                                                                                                                                         - - Does not grant rights to the backend SA outside `central-workspace`.
                                                                                                                                                           - - Does not execute arbitrary user shell commands.
                                                                                                                                                             - - Does not accept pipeline (non-Next.js) app requests until Phase 4.
                                                                                                                                                               - 
