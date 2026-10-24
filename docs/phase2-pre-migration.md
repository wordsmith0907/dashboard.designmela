> Historical Phase 2 report. The [Phase 2A validation report](phase2a-validation.md) supersedes its database-execution blockers. Remote migration remains unapplied.

# Phase 2 pre-migration review — UNAPPLIED

Baseline: `bb0af4dd6d1fe17f40e6b4905bed1c845f4e5d8d`, branch `designmela-crm-v2`, repository `wordsmith0907/dashboard.designmela`. This review concerns local changes after that commit. Nothing in this phase is staged, committed, pushed, deployed or migrated.

## Decision

**FAIL for migration approval at this stage.** Local implementation and static checks are preparation, not proof of database authorization. A disposable database execution review, remote schema/history preflight and the environment/bootstrap setup below remain mandatory. The full dependency audit also retains the documented development-only exception. Verification results are recorded at the end of this document.

The user's latest clarification identifies the configured project as dedicated development with no production data, correcting an earlier shared-project reply. This is user confirmation, not an independent remote inspection. No remote inspection or mutation was performed in Phase 2. Keep Demo Mode active. Do not use a shared/production project if that identification changes.

## Exact SQL and schema

The **only proposed executable SQL file** is `supabase/proposals/consolidated-initial.sql`. It is the authoritative column, constraint, function and policy definition. There are no files in `supabase/migrations`. The app, build and tests never execute this file. It is for a fresh database only; it intentionally fails on conflicting existing tables instead of rewriting them.

| Category | Proposed tables |
| --- | --- |
| Identity/workspace | `organizations`, `profiles`, `departments`, `organization_members` |
| Authorization | `roles`, `permissions`, `role_permissions`, `member_permission_overrides`, `member_service_access` |
| Team/history | `invitations`, `permission_versions`, `audit_logs` |
| CRM | `leads`, `activities`, `lead_activities`, `follow_ups`, `import_jobs`, `import_rows`, `clients` |
| Delivery | `projects`, `tasks`, `audits` |
| Sales | `services`, `quotes`, `quote_items`, `proposals`, `payments` |
| Content/automation | `content_items`, `published_posts`, `automation_workflows`, `automation_runs`, `notifications` |
| Analytics | `website_events` |
| Private, inaccessible to API roles | `private.bootstrap_state` |

All names except the final private table are in `public`. There are **33 public tables and one private table**. All 21 business tables have mandatory `organization_id`, mandatory membership `created_by`, optional membership `assigned_to`, `archived_at`, timestamps and immutable identity/tenant/creator. Profiles are global identities keyed to `auth.users`; permissions are a global catalogue. These are intentional exceptions to business-record tenancy.

`activities.kind` supports Note, Activity and Communication. `lead_activities.type` retains the detailed note/email/WhatsApp/call timeline representation; these are not external message deliveries. Payments represent manual payment tracking; there is **no invoice entity or accounting ledger**. The schema includes CRM2 attribution, scoring, consent, follow-up and import provenance fields, but the first connected forms expose only a basic subset. The existing `stage`/`estimated_value` columns are canonical storage for pipeline stage/value; legacy camelCase aliases are demo projections, not duplicate persisted fields.

### Relationships, indexes and constraints

- `profiles.id → auth.users.id`; membership links user/profile, organization, optional custom role and department. Unique organization/user prevents duplicate memberships. All child membership/role/service and business record references include organization ID.
- Leads link to import jobs. Import rows link to jobs and optionally leads, with unique job/row number. Activities, follow-ups, clients, audits, projects, tasks, quotes, proposals and payments link to leads as applicable. Tasks optionally link to audits. Quotes optionally link to clients; quote items to quotes/services; proposals to quotes/projects; payments to quotes/proposals. Published posts link to content and optionally automation runs; runs link to workflows.
- Foreign keys use RESTRICT or PostgreSQL's default NO ACTION; there are **no cascading deletes**. Normal authenticated business DELETE is not granted. Archival preserves related records. Membership deletion and Owner mutation are rejected by triggers.
- Explicit indexes cover organization/created-time/id, organization/assignee and organization/creator for each business table; metadata organization lookups; membership user/organization/status; override expiry; lead stage/follow-up and attribution; audit chronology; follow-up due dates. A catalogue loop adds an index for every foreign key's referencing columns, including compound references. Some overlap with unique indexes is intentional pending measurement.
- PKs, tenant/id uniqueness, organization/role-name, member/permission, role/permission, member/service and import/row uniqueness are declared. External automation event IDs are unique within the organization. Numeric/date/status checks reject invalid values. Published content identity is unique.

### Functions and triggers

Authorization functions: `private.is_owner`, `private.current_member_id`, `private.permission_scope`, `private.can_access`; authenticated RPCs: `public.workspace_session`, `public.owner_update_member`; bootstrap RPC: `public.bootstrap_first_owner` (service role only).

Trigger functions: `private.protect_membership`, `private.immutable_history`, `private.protect_template`, `private.preserve_record_identity`, `private.guard_business_write`, `private.log_business_write`, `private.assert_active_owner`, `private.rls_new_public_tables`.

Triggers protect membership ownership/identity; system role templates; audit and permission-version immutability (including TRUNCATE); business identity, assignment and archival; business mutation audit entries. Deferred constraint triggers require an active Owner at transaction commit and lock the organization to serialize checks. `designmela_default_rls` enables/forces RLS and revokes API access when a new public table is created. Global and public-schema default privileges both revoke implicit table/function access for the migration role; a per-schema revoke alone cannot cancel PostgreSQL's global PUBLIC EXECUTE default. New migration roles require their own default-privilege review. Event-trigger privileges/support must be verified before approval; unsupported environments must fail, not skip this guard.

### Destructive statements and escalation review

There is no DROP, TRUNCATE execution, DELETE execution, data reset, auth-user creation/deletion, storage mutation or migration of existing demo data. References to DELETE/TRUNCATE in trigger declarations prohibit those operations. DDL includes CREATE/ALTER, indexes, grants/revokes, seed INSERTs, and function bodies containing future INSERT/UPDATE operations. Revoking grants changes access and must not be applied over an unreviewed existing schema. The entire proposal is wrapped in BEGIN/COMMIT.

No client can write membership/role/override/history tables directly, including with the service-role table grants in this proposal. The privileged bootstrap uses a narrow DEFINER RPC. Definer functions use a fixed empty search path, qualified relations and explicit execution grants. Authorization functions read base tables under the migration owner to avoid RLS recursion; they never trust editable user metadata. Verify the migration owner's RLS bypass behavior in the disposable test database. Owner role changes require a verified current Owner, recent password authentication, confirmation, reason and organization/member locks. They reject self and all Owner targets. Custom-role/override management, invitation acceptance and account deletion are unavailable, rather than permissive placeholders.

## RLS policy matrix

All anonymous access is denied. All business access requires a verified, active membership in the row's organization. Disabled memberships are checked in SQL on each query, not cached in client claims. Optional `require_admin_mfa` requires AAL2 for Owner/Operations Admin when enabled; it defaults false. A missing/unknown permission denies access. Explicit deny overrides allow; expired overrides do not grant. Supported scopes are all, own (creator), assigned and department (assignee department). The seeded templates below use **all within the organization**. Custom role grants and overrides cannot bypass owner-only capabilities.

`R` = SELECT; `W` = INSERT/UPDATE with creator/assignment/archive guards. No normal DELETE. Owner can R/W all business tables. Other roles receive only the following table groups by default:

| Tables | Owner | Operations Admin | Sales | Delivery | Content | Finance | Viewer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| leads, activities, audits, lead_activities, follow_ups, import_jobs, import_rows | RW | RW | RW | — | — | — | R |
| clients | RW | RW | RW | R | — | R | R |
| projects | RW | RW | — | RW | — | — | R |
| tasks, notifications | RW | RW | RW | RW | RW | — | R |
| services, quotes, quote_items, proposals, payments | RW | RW | RW | — | — | RW | R |
| content_items, published_posts | RW | RW | — | — | RW | — | R |
| automation_workflows, automation_runs | RW | RW | — | — | — | — | — |
| website_events | RW | R | — | — | — | R | R |

Leads INSERT requires `leads.create`; UPDATE requires `leads.edit`; changing archive state additionally requires `leads.delete` (Owner/Operations Admin templates). Other groups use their view/manage keys. Related CRM tables use leads.view/edit. Website events require analytics.view/settings.manage, with no anonymous ingestion route. No actual website is connected.

| Metadata table | Ordinary authenticated access |
| --- | --- |
| organizations | Read own active, verified organizations; no direct writes |
| profiles | Read/update own display name/avatar only, with active verified membership |
| organization_members | Read own active verified membership; Owner reads organization membership; no direct writes |
| departments, roles, role_permissions, member_permission_overrides, member_service_access, invitations, permission_versions | Owner reads own organization only; no direct writes |
| audit_logs | Owner or effective all-scope audit.view reads organization history; no direct writes; append-only triggers |
| permissions | Verified active Owner catalogue read; other roles get resolved keys through workspace_session |
| private.bootstrap_state | No direct API access for any API role |

This matrix describes the **proposal**, not verified live behavior. The old 54-key demo inspector is separate; it does not authorize connected requests. Connected Mode uses 22 canonical keys. `member_service_access` is reserved; no service-based filtering is advertised/enabled in this increment. Team-view capability does not grant broad membership-table SELECT yet; the connected Team page is explicitly unavailable.

## Bootstrap procedure — prepare only

1. After separate migration approval/testing, configure the **hosted development** Auth service: public signup off, verified email required, password minimum 12 with uppercase/lowercase/digit/symbol, appropriate local redirect URLs and tested mail delivery. `supabase/config.toml` sets only local development defaults.
2. Create/invite the intended first Auth user using a separately approved secure Supabase workflow. Complete email verification and password setup outside chat/source. No automatic account creation is implemented here.
3. Put the exact owner email in server-only `INITIAL_OWNER_EMAIL`; set `INITIAL_OWNER_BOOTSTRAP_ENABLED=true` briefly and provision server-only `SUPABASE_SERVICE_ROLE_KEY`. Never use a NEXT_PUBLIC prefix. Configure the explicit development flags and public-safe variables.
4. Sign in at `/login`, then visit `/setup` directly. Workspace pages remain blocked until an organization ID is configured. The form requires explicit confirmation; the server validates the authenticated current user and verified matching email. SQL independently rechecks that user/email. No browser-supplied user ID or expected email is trusted.
5. The RPC locks the pre-existing singleton, creates organization/profile/roles/grants/Owner and audit/version entries atomically. Same-user retry returns the original organization; a different user or unexpected existing organization fails. No plaintext password is accepted by the bootstrap function.
6. Obtain the resulting organization UUID through an approved administrator inspection, set server-only `DESIGNMELA_ORGANIZATION_ID`, disable bootstrap and remove its credential from the normal app runtime. Check Owner access before inviting anyone. SQL permission to bootstrap remains narrow and idempotent; the runtime switch is an additional gate.

Do not enable MFA enforcement before enrollment, challenge and recovery have been implemented/tested. Owner transfer is deliberately unavailable; recovery requires reviewed administrator intervention and an audit trail.

## Environment checklist

Present locally: public URL, public publishable key, server-only database URL. Values are intentionally omitted; `.env.local` is Git-ignored and excluded. **No local environment values were changed.** Demo is still the default.

Still required to activate after approval: `DESIGNMELA_MODE=connected`, `DESIGNMELA_ENV=development`, `SUPABASE_DEV_PROJECT_CONFIRMED=true`, `DESIGNMELA_ORGANIZATION_ID`. Bootstrap additionally needs `INITIAL_OWNER_EMAIL`, `INITIAL_OWNER_BOOTSTRAP_ENABLED=true`, `SUPABASE_SERVICE_ROLE_KEY`. Only URL/publishable key belong in NEXT_PUBLIC variables. The database URL is not used by application CRUD. Connected production mode intentionally fails closed.

## Implemented versus remaining

Implemented locally: Supabase SSR browser/server factories; session cookie refresh with no-store responses; verified user and current database membership checks; login/logout; protected route group; permission-aware navigation and direct-route checks; opt-in bootstrap form/server action; loading/empty/offline/error states; mode indicator. Server-only repository functions provide paginated list/create/edit/archive for leads, clients, projects, tasks, quote drafts, proposal drafts and manual payments. Field allowlists reject organization/owner/access injection; SQL is the independent authorization boundary. No demo snapshot is uploaded and no DB failure triggers a demo fallback.

Demo remains unchanged in per-tab memory. Its full CRM, import/undo, scoring, conversion, content and analytics workflows remain fictional/local. Connected Mode is a smaller basic-record interface using the same visual tokens, not a claim that every demo workflow is persistent. The browser client factory is available but record writes currently use server actions.

Still unavailable: connected import/undo transactions; quote line-item totals and accepted-proposal conversion; status-transition/financial invariants beyond basic database checks; invitation delivery/acceptance; team/custom-role/override editing UI and protected RPCs; password reset; MFA enrollment/challenge/recovery; optimistic-concurrency conflict detection; richer CRM forms; connected analytics/content/automation/settings/team screens; audit viewer; service-specific restrictions; storage uploads; website ingestion; external publishing/messaging/payment collection. These screens show explicit unavailable states instead of demo records. There are **no storage buckets or storage policies** proposed; existing fields contain URL references only.

## Required database acceptance tests and recovery

Before hosted apply, obtain permission for an isolated disposable Supabase database and execute the exact proposal there. Verify anonymous denial; two-organization CRUD and cross-tenant FK rejection; every role/table cell above; direct REST attempts to change tenant/creator/assignment/access/status; scoped grants and deny/expiry; suspended/stale sessions; verified-email/AAL2 gates; direct self-promotion; owner_update_member recent-auth/self/Owner denial; concurrent owner protection; concurrent bootstrap and idempotent retry; immutable history; audit rollback on failed writes; and the future-table RLS event trigger. Verify all definer execution grants and service-role denial outside bootstrap. SQL parsing and TypeScript tests do not replace these checks.

Before applying to the designated hosted development project, inspect migration history/schema/grants/storage/auth settings read-only, confirm it is fresh, record a backup/restore point, and verify recovery in a disposable target. Existing objects or user data require a separately reviewed additive migration instead of this file.

On a failed SQL statement, the surrounding transaction aborts. Never retry a partially edited version against a questionable state. After a successful apply with data, prefer a reviewed forward fix; do not drop tables or restore over newer data. Stop writes, export/backup, restore to a separate database and verify before a separately approved cutover. For an empty disposable test database only, recreation is possible with explicit authorization. Auth configuration is separate and needs its own recovery checklist. Do not delete auth identities to disable team access.

## Exact future application command — NOT RUN

After approval, verified linking to the dedicated development project and a clean migration directory, promote exactly the reviewed file:

```powershell
New-Item -ItemType Directory -Force -Path supabase/migrations
Copy-Item -LiteralPath supabase/proposals/consolidated-initial.sql -Destination supabase/migrations/20261023000100_designmela_initial.sql
npx supabase@2.122.0 db push --linked --skip-vault --dry-run
```

Review the dry-run: the **only** SQL must be `20261023000100_designmela_initial.sql`, byte-identical to the proposal. If anything differs, stop. The actual future apply command is:

```powershell
npx supabase@2.122.0 db push --linked --skip-vault
```

Only CLI help was inspected; no command in this section was executed. The pinned CLI supports `--skip-vault`, used here to avoid unrelated Vault updates. Do not pass passwords in command text; use the CLI's secure prompt/approved secret environment. No migration approval is implied by code preparation.

## Verification results

Final local results (2026-10-23):

| Check | Result |
| --- | --- |
| ESLint | PASS, no warnings/errors |
| TypeScript | PASS |
| Unit/permission/validation tests | PASS, 51 tests |
| Production build | PASS, all routes built |
| Playwright browser regressions | PASS, 8 tests |
| Isolated connected anonymous-route checks | PASS, 9 protected routes; spoofed headers ignored; zero remote requests |
| Secret scan | PASS, current tracked/untracked non-ignored source plus 30 browser assets; no credential findings |
| Environment exclusion | PASS, .env.local ignored and unstaged |
| git diff --check / cached diff check | PASS |
| Production dependency audit | PASS, zero known findings |
| Full dependency audit | FAIL, 5 high entries in the previously accepted development-only braces chain; no force fix/downgrade |
| Static PostgreSQL parsing | PASS, 119 top-level statements; 33 public + 1 private tables; 15 functions |
| Live auth, RLS, bootstrap, FK and concurrency verification | NOT RUN; requires separately approved disposable database |
| Staging/history | No staged changes; HEAD remains the baseline commit |

The standalone PL/pgSQL parser could not resolve the private-schema row type, so it does not establish stored-function validity. Dynamic policy/index SQL, grants, event-trigger support and runtime behavior remain unverified. The final SQL SHA-256 is `4d09aa7c75b03633eb4260c781b74e38808592d928201778228f89e66c68a203`.

The [exact changed-path manifest](phase2-files.txt) lists 81 paths (including removals for relocated routes). Thirteen original page files moved unchanged into the protected route group as demo components, with thirteen new server wrappers; this accounts for 39 of the path entries. Shared demo components, fixtures, product assets and the public website endpoint were not changed. Generated test screenshots/traces remain ignored. The original first-commit manifest is historical and unchanged. All Phase 2 changes remain **unstaged** for review.

Nothing was applied remotely; no new commit, push, merge, deployment, production authentication connection or public website modification occurred. Demo Mode remains active. Stop here and obtain explicit approval for the next database validation step; do not apply the hosted proposal on the strength of local checks alone.
