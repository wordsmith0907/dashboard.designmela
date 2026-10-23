# Designmela Agency CRM

Local CRM work in progress on `designmela-crm-v2`, built with Next.js App Router, React, TypeScript, Tailwind and Lucide. This repository is the dashboard; it does not modify the public Designmela website.

## Implemented now

The dashboard has Today, CRM, Clients, Sales, Tasks, Projects, Audits, Content, Posted, Analytics, Automations, Team & Access and Settings screens. Existing functionality includes lead editing, source attribution, rule-based scoring, activity timelines, follow-ups, CSV/XLS/XLSX import, duplicate review, guarded import undo, exports, quotes, proposal-to-project conversion, manual payments and manually recorded publications. Team & Access is a local role/permission inspector, not employee account management.

## Modes and storage

**Demo Mode** is the default. Records and the Owner identity are fictional. Data changes live only in the current browser tab and reset on reload. Use fictional information only. Saved CRM views store allowlisted non-sensitive filter preferences in localStorage; leads, notes, emails, phone numbers and authentication tokens are not stored there.

`DESIGNMELA_MODE=connected` currently displays **Connection Error** because authentication and the Supabase provider are not implemented. Invalid mode values also fail closed. Supplying Supabase credentials does not enable persistence. There is no fake connected-mode success or silent fallback to demo records.

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

The CLI was initialized and linked during setup, but the application has no authenticated Supabase adapter. The single [consolidated SQL proposal](supabase/proposals/consolidated-initial.sql) is **unapplied and unverified in a database**. It replaces the obsolete separate drafts and is intentionally outside the automatic migrations directory. See [database security and approval requirements](docs/database-security.md).

`.env.example` contains placeholders only. `.env.local` is ignored by Git. `DATABASE_URL` and any service-role credentials are server-only. Public Supabase URL/publishable-key settings are not authorization. Local `supabase/config.toml` is not evidence of hosted production security settings. Never commit credentials.

Before real client use: finish invite-only authentication, email verification, password policy, optional Owner/admin TOTP, server-enforced permissions, scoped RLS tests, transactional persistence, backups and recovery. Employee access and ownership-transfer flows remain incomplete. No migration, production user, invitation, website connection or deployment may run without explicit approval.

Website event storage, n8n, external messaging, payments and social publishing are unconnected. `POST /api/website-events` validates requests but returns 503 for otherwise valid events because storage is absent. Publication actions record manual history only. No Instagram API or automatic social publishing is included.

## Reference

- [Provider architecture](docs/data-provider.md)
- [Current scope and remaining work](docs/consolidated-v2.md)
- [Verification procedure](docs/verification.md)
- [Temporary development dependency risk](docs/dependency-risk.md)
- [Hosting requirements](docs/deployment.md)
- [n8n plan](docs/n8n.md)
- [Roadmap](ROADMAP.md)

The lockfile is intentional. The full dependency audit has a documented development-only exception; production audit results must be checked separately.
