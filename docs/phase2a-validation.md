# PHASE 2A VALIDATION REPORT

Date: 2026-10-24 (Asia/Calcutta). **PASS for the approved Phase 2A validation scope.**

Scope: approved read-only remote inspection and disposable local validation. Remote application and production activation remain separate decisions.

## Environment and prerequisites

All four required settings are present (values withheld): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `DATABASE_URL`, and server-only `INITIAL_OWNER_EMAIL`. `.env.local` is ignored and untracked. The publishable-key variable is the sole application public-key setting; no legacy anon variable is required or added. No remote service-role credential was obtained, added or exposed. No additional server variable was required.

Docker's Linux engine is reachable (29.7.2). Supabase CLI 2.122.0 started an isolated stack with separate ports and synthetic fixtures. Local and remote PostgreSQL both report 17.11; relevant migration-role privileges match (not superuser, BYPASSRLS, CREATEDB, CREATE on public).

## Remote read-only findings

The configured URL, session-pooler identity and cached CLI project identity agree (identifiers masked). The port-5432 pooler connection succeeded with TLS. Startup options previously timed out; the inspector now sets psycopg read-only mode before the first query, causing BEGIN READ ONLY, and verifies transaction_read_only=on. It rolls back on exit and does not change persistent configuration.

Catalog inspection found only nine standard platform schemas: auth, extensions, graphql, graphql_public, pgbouncer, public, realtime, storage and vault. The initial pgbouncer warning was resolved by recognizing this standard platform schema. There are no public application tables/views, custom public functions, application migration history or unrelated schemas. Functions, eight ordinary table triggers and six event triggers belong to platform infrastructure. No custom RLS policies were present.

Exact aggregate counts were zero for auth.users, storage.objects, storage.buckets, storage.buckets_analytics, storage.buckets_vectors, storage.vector_indexes, vault.secrets, realtime.messages and realtime.subscription. No record contents or secret values were fetched. Platform migration tables contain expected internal history; their approximate row counts are not application data. Unknown estimates are not evidence of rows.

**The project is empty of observed application/business data. Its dedicated-development purpose is user-confirmed, supported by the empty inventory; organizational intent cannot be proven from SQL.** No production or unrelated application data was found. A management-API project-list attempt timed out; it was not needed for the successful SQL identity and inventory checks.

## Local migration and database tests

Only the isolated local database received the proposal. No remote data, environment file or remote link was copied. Generated local credentials are captured in memory and never printed. The test harness does not read DATABASE_URL and asserts the disposable container label and loopback port.

Proposal: `supabase/proposals/consolidated-initial.sql`, SHA-256 `4d09aa7c75b03633eb4260c781b74e38808592d928201778228f89e66c68a203`. It creates 33 public tables plus the private bootstrap singleton. **No SQL changes were required during Phase 2A.** The proposal remains outside automatic migrations and unapplied remotely.

The first clean application passed 69 checks. A local reset and second application passed an expanded 221 checks. A second reset and third application passed all **229 checks** in the final expanded suite. Repeated checks are not counted as independent unique coverage. The complete final case-by-case record is [phase2a-database-results.json](phase2a-database-results.json).

The final suite covers:

- Anonymous denial and cross-organization reads/writes; seven roles across 21 business tables (147 cases checking SELECT, INSERT and UPDATE).
- RLS enforcement without UI assistance; immutable identity, organization, role, permission, owner and active-status metadata; disabled membership revocation.
- Owner-only team changes, verified identity, recent password authentication, confirmation and reason; self/Owner-target rejection and unauthorized administrator denial.
- Last-owner removal/disable/demotion denial, deferred ownerless-organization checks, concurrent attempts and two distinct owners attempting to remove each other.
- Verified configured-email bootstrap, wrong/unverified email rejection, idempotence, second-user denial, atomic failure rollback and successful retry.
- Audit creation, correct tenant attribution, append-only API access and privileged trigger protection; no forged ordinary-user audit writes.
- Tenant-preserving relationships, restrictive foreign keys, referenced lead protection and archival retaining related quote data.
- Deny precedence, expiry, own/assigned/department/custom-role scope, no owner-only permission escalation, optional AAL2 enforcement.
- Direct REST API denial/isolation tests, future-table default RLS and all public tables forcing RLS.

Privileged SQL and local synthetic JWTs simulate identities/roles. They do not validate email delivery, real password sign-in, MFA enrollment/recovery or the disabled application's hosted bootstrap route. Database administrators retain trusted administrative powers; RLS is not a boundary against a database owner who can change policies.

## Recovery and remaining limitations

Two disposable resets and three clean applications test repeatability. A deliberately injected late bootstrap audit failure rolled back the organization, roles, profile and singleton; removing the injected fault allowed bootstrap and idempotent retry. Test-only fault injection occurred locally and was removed.

This demonstrates local reset/reapply and transactional bootstrap recovery. It does **not** demonstrate safe rollback of a populated hosted database, backup restoration or production cutover. There is no tested destructive down migration. Future populated-database changes need reviewed forward fixes and independently tested backup/restore procedures.

Hosted Auth configuration remains unchanged. Production requires verified email, passwords of at least 12 characters, signup/redirect/rate controls, invitation/reset delivery and optional Owner/admin MFA enrollment/challenge/recovery. Owner transfer is intentionally unavailable and requires a separately designed recovery process. Restricted custom-role/override management, complete connected workflows and production integrations remain outstanding. Local config defaults are not hosted security settings.

## Application verification

Lint, TypeScript, 51 unit tests, nine protected-route checks and production build passed. The protected-route runner also rejected spoofed permission headers and made no remote requests. All eight browser tests passed. Secret scanning passed across 137 source files and 30 built browser assets; .env.local remains ignored and excluded. Both working-tree and cached diff checks passed. The index has no staged changes; the working tree, not a new commit candidate, was tested.

Production dependency audit: zero known vulnerabilities. The latest full audit, explicitly including development dependencies, also returned zero findings. This differs from the historical five-entry development-only exception; no dependency change or force fix was made, and this audit response is not evidence of a code-level repair. The documented exception is retained pending dependency review.

## Exact Phase 2A files

New validation utilities and artifacts:

- `scripts/inspect-remote-readonly.py`
- `scripts/phase2a-local-stack.py`
- `scripts/phase2a-reset-local.py`
- `scripts/phase2a-db-tests.py`
- `docs/phase2a-validation.md`
- `docs/phase2a-database-results.json`

Updated requirements/status documentation (including earlier Phase 2A attempts):

- `.env.example`
- `README.md`
- `docs/database-security.md`
- `docs/consolidated-v2.md`
- `docs/data-provider.md`
- `docs/verification.md`
- `docs/dependency-risk.md` (current audit observation; exception retained)
- `docs/phase2-pre-migration.md` (historical report marked superseded)

The earlier Phase 2 application/SQL changes remain unstaged; their historical manifest is `docs/phase2-files.txt`. They were not newly implemented in Phase 2A. The ignored environment file was previously edited only as explicitly requested; no credential values are included in these files. The disposable local stack and application test server were stopped after verification. Local volumes/configuration may remain for review. Ignored local stack config, browser output, caches and build artifacts are not intended for commit. No product assets or public website files were changed by this validation.

## Approval boundary

**The unchanged proposal is ready for a separate, explicit development-only remote-apply approval on the evidence above.** All required local validation passed; this is not an unconditional guarantee of hosted compatibility or production readiness. Any later development apply requires fresh explicit approval and a fresh read-only preflight against the unchanged empty target. This is not approval for production activation.

The remote database was not modified. No remote migration, commit, push, merge or deployment occurred. Branch remains `designmela-crm-v2`; HEAD remains `bb0af4dd6d1fe17f40e6b4905bed1c845f4e5d8d`. Nothing was staged. Public designmela.com and production authentication remain unchanged.
