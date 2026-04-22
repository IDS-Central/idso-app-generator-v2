# backend/

The v2 generator's backend Cloud Run service.

**Not implemented yet.** This is a placeholder. Phase 1 fills in the scaffold (ID token verification, Secret Manager, GitHub App, structured logging, token cap). Phase 2 adds the tool layer and build loop. See `../docs/PHASE-PLAN.md`.

Intended layout (builds out across Phase 1–2):

```
backend/
├── package.json
├── tsconfig.json
├── Dockerfile                 # node:20-alpine, multi-stage, port 8080
├── cloudbuild.yaml            # deploys to idso-app-generator-v2-backend-{env}
├── src/
│   ├── index.ts               # server entry
│   ├── middleware/
│   │   ├── auth.ts            # Google ID token verification, hd=independencedso.com
│   │   ├── logging.ts         # structured Cloud Logging
│   │   └── budget.ts          # per-user monthly token cap
│   ├── github/
│   │   └── app.ts             # GitHub App → installation access token
│   ├── secrets/
│   │   └── client.ts          # Secret Manager wrapper with 5-min cache
│   ├── tools/
│   │   ├── schema.ts          # JSON Schema + TS types
│   │   ├── dispatch.ts        # validates, enforces plan-gate, logs, invokes
│   │   ├── github.ts
│   │   ├── secrets.ts
│   │   ├── iam.ts
│   │   ├── cloudrun.ts
│   │   ├── cloudbuild.ts
│   │   ├── sql.ts
│   │   ├── bq.ts
│   │   ├── oauth.ts
│   │   ├── logs.ts
│   │   ├── sandbox.ts
│   │   ├── plan.ts
│   │   └── ownership.ts
│   ├── loop/
│   │   ├── run.ts             # Anthropic tool-use loop
│   │   └── dry-run.ts         # read-only harness for integration tests
│   ├── routes/
│   │   ├── health.ts
│   │   ├── whoami.ts
│   │   └── builds.ts          # SSE streaming endpoint
│   └── storage/
│       └── builds.ts          # BigQuery-backed session store
└── github-app/
    └── manifest.json          # GitHub App manifest (Phase 1 deliverable)
```

See `../docs/ARCHITECTURE.md` and `../docs/TOOL-SCHEMA.md` for the design.
