# Environment-variable names and scopes

No credential values belong in this checklist. Public URL values are documented separately in the staged rollout plan. Set project-level scopes deliberately; do not share the production application URL with Preview.

| Name | Scope | Exposure / handling |
| --- | --- | --- |
| DESIGNMELA_MODE | Development, Preview, Production | Server-only; connected required on hosted deployments |
| DESIGNMELA_ENV | Development, Preview, Production | Server-only; must match platform environment when present |
| NEXT_PUBLIC_APP_URL | Development, Production; optional Preview override | Public-safe origin; Preview may derive from platform hosts |
| NEXT_PUBLIC_SUPABASE_URL | Development, Preview, Production | Public-safe; scope to the approved project for each environment |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Development, Preview, Production | Public-safe publishable key; never substitute a privileged key |
| DESIGNMELA_ORGANIZATION_ID | Development, Preview, Production | Server-only; approved organization in the corresponding project |
| INITIAL_OWNER_BOOTSTRAP_ENABLED | Development, Preview, Production | Server-only; must be disabled in hosted environments |
| SUPABASE_DEV_PROJECT_CONFIRMED | Development/test and Preview only | Server-only; required for the approved development target; must not be enabled in Production |
| DESIGNMELA_APP_ORIGIN | Local development/test compatibility only | Deprecated server-only alias; ignored by hosted configuration |
| NODE_ENV | Platform-managed | Do not override; Preview still runs a production build |
| VERCEL, VERCEL_ENV | Platform-managed | Do not forge/override; determines and validates hosted context |
| VERCEL_BRANCH_URL, VERCEL_URL | Platform-managed Preview URL inputs | Hostnames are public-safe; consumed only by server validator |
| DATABASE_URL | Local administrator tooling only | Private; never upload to Vercel or prefix NEXT_PUBLIC_ |
| INITIAL_OWNER_EMAIL | Local approved bootstrap only | Private; omit from hosted runtime |
| N8N_BASE_URL, N8N_API_KEY, N8N_WEBHOOK_SECRET | None for this release | Unimplemented integrations; leave unset |
| WEBSITE_ALLOWED_ORIGINS | None for this release | Leave unset; public website ingestion remains unavailable |
| SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY | None | Not required or authorized |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | None | Unsupported legacy key input |
| VERCEL_PROJECT_PRODUCTION_URL | None in application policy | Never use as a Preview callback fallback |

Production/Preview bootstrap must be explicitly disabled. Never run bootstrap or migrations in a Vercel build. Production rejects development-project confirmation; the correct production target still requires separate operational approval. Only public URL/key values are browser-safe; all administrative values stay in local approved tooling or their secure providers.
