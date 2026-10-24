# Designmela Agency CRM

Local CRM work in progress on `designmela-crm-v2`, built with Next.js App Router, React, TypeScript, Tailwind and Lucide. This repository is the dashboard; it does not modify the public Designmela website.

## Implemented now

The dashboard has Today, CRM, Clients, Sales, Tasks, Projects, Audits, Content, Posted, Analytics, Automations, Team & Access and Settings screens. Existing functionality includes lead editing, source attribution, rule-based scoring, activity timelines, follow-ups, CSV/XLS/XLSX import, duplicate review, guarded import undo, exports, quotes, proposal-to-project conversion, manual payments and manually recorded publications. Team & Access is a local role/permission inspector, not employee account management.

## Modes and storage

**Demo Mode** is the default. Records and the Owner identity are fictional. Data changes live only in the current browser tab and reset on reload. Use fictional information only. Saved CRM views store allowlisted non-sensitive filter preferences in localStorage; leads, notes, emails, phone numbers and authentication tokens are not stored there.

`DESIGNMELA_MODE=connected` now has an opt-in development integration: verified cookie sessions, protected routes, server authorization, and basic paginated record operations. It additionally requires `DESIGNMELA_ENV=development`, `SUPABASE_DEV_PROJECT_CONFIRMED=true`, approved database setup and an organization ID. These flags have not been enabled locally. Invalid/incomplete configuration fails closed; no database failure falls back to demo records. See the [Phase 2 pre-migration report](docs/phase2-pre-migration.md) for the exact implemented subset, bootstrap and remaining blockers.

## Run and verify

Use Node.js 22 LTS or newer (verified locally on Node 24), then:

~~~sh
npm ci
npm run dev
~~~

Open http://127.0.0.1:3000. For checks:

~~~sh
npm run lint
npm run typecheck
npm test
npm run build
npm start
npx playwright test
npm audit --omit=dev
npm audit
~~~

Playwright uses installed Google Chrome. Start the built application before browser tests. `PLAYWRIGHT_BASE_URL` can select an isolated local test server. Screenshots/traces go to ignored `test-results/`; only curated review images live in [docs/screenshots](docs/screenshots/README.md). Browser tests cover routes, responsive layouts, forms, imports, publication records and the permission inspector.

## Imports and safe undo

Read [CRM instructions](docs/crm-v2.md). Imports parse locally in a worker with limits and explicit confirmation. Undo deletes only unchanged import-created leads with no subsequent relationships. Quotes, proposals, payments, clients, projects, audits, tasks, legacy notes/activities and later timeline/follow-up work preserve the lead. No separate invoice entity currently exists. The relationship list is type-checked when new lead-linked collections are added. Reports distinguish deleted, preserved, skipped and failed undo rows; unverifiable provenance preserves the lead. Existing-record updates are never undone.

## Database and production status

The CLI was initialized and linked during earlier setup. Phase 2 adds server-side Supabase adapters without activating them. The single [consolidated SQL proposal](supabase/proposals/consolidated-initial.sql) is **not applied remotely; validated in disposable local Supabase during Phase 2A**. It replaces the obsolete separate drafts and is intentionally outside the automatic migrations directory. See [database security and approval requirements](docs/database-security.md).

`.env.example` contains placeholders only. `.env.local` is ignored by Git. `DATABASE_URL` and any service-role credentials are server-only. Public Supabase URL/publishable-key settings are not authorization. Local `supabase/config.toml` is not evidence of hosted production security settings. Never commit credentials.

Phase 2A validation requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `DATABASE_URL` and server-only `INITIAL_OWNER_EMAIL`. The publishable-key variable is the sole supported browser-key setting; a legacy anon key is not required. No service-role credential is required or added for remote read-only inspection or disposable local SQL validation. See the [Phase 2A validation report](docs/phase2a-validation.md).

Before real client use: validate authentication and RLS in an approved disposable database, configure hosted email verification/password policy, finish invitation/reset flows, optional Owner/admin TOTP, transactional workflows, backups and recovery. Employee access and ownership-transfer flows remain incomplete. No migration, production user, invitation, website connection or deployment may run without explicit approval.

Website event storage, n8n, external messaging, payments and social publishing are unconnected. `POST /api/website-events` validates requests but returns 503 for otherwise valid events because storage is absent. Publication actions record manual history only. No Instagram API or automatic social publishing is included.

## Reference

- [Phase 2 pre-migration report](docs/phase2-pre-migration.md)
- [Provider architecture](docs/data-provider.md)
- [Current scope and remaining work](docs/consolidated-v2.md)
- [Verification procedure](docs/verification.md)
- [Temporary development dependency risk](docs/dependency-risk.md)
- [Hosting requirements](docs/deployment.md)
- [n8n plan](docs/n8n.md)
- [Roadmap](ROADMAP.md)

The lockfile is intentional. The full dependency audit has a documented development-only exception; production audit results must be checked separately.
