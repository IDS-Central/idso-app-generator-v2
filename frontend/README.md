# frontend/

The v2 generator's frontend Cloud Run service.

**Not implemented yet.** This is a placeholder. Phase 3 fills it in. See `../docs/PHASE-PLAN.md`.

The frontend is itself a reference implementation of the IDSO conventions (Next.js App Router, `google-auth-library` OAuth, AES-256-GCM session cookie, `hd=independencedso.com`). The auth files in `src/lib/auth.ts`, `src/lib/session.ts`, and `src/middleware.ts` are copied verbatim from the pattern documented in `../docs/IDSO-APP-CONVENTIONS.md` §5.

Intended layout (builds out in Phase 3):

```
frontend/
├── package.json
├── tsconfig.json
├── next.config.ts             # output: 'standalone'
├── tailwind.config.ts
├── Dockerfile                 # node:20-alpine, multi-stage, port 8080
├── cloudbuild.yaml            # deploys to idso-app-generator-v2-frontend-{env}
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx           # chat UI
    │   ├── login/page.tsx
    │   ├── apps/page.tsx      # "Your apps" dashboard
    │   ├── apps/[repo]/page.tsx
    │   ├── help/page.tsx      # Phase 4
    │   ├── admin/usage/page.tsx  # Phase 4
    │   └── api/auth/{login,authorize,logout,me}/route.ts
    ├── components/
    │   ├── chat/
    │   │   ├── ChatInput.tsx
    │   │   ├── StreamingTimeline.tsx
    │   │   ├── PlanApprovalCard.tsx
    │   │   └── BudgetReapprovalModal.tsx
    │   └── apps/
    │       └── AppCard.tsx
    ├── lib/
    │   ├── auth.ts            # copied from IDSO-APP-CONVENTIONS
    │   ├── session.ts         # copied
    │   └── backend.ts         # typed client for backend/api/builds SSE
    └── middleware.ts          # copied
```

See `../docs/ARCHITECTURE.md` for the auth and streaming model.
