# Consolidated CRM 2.0 status

Work is on `designmela-crm-v2`. The consolidated brief is not fully implemented. Existing Next.js/React/TypeScript/Tailwind pages and fictional demo workflows remain intact.

## Implemented locally

- CRM imports, duplicate review, scoring, attribution, timeline, follow-ups, clients, quotes, proposals, payments, project/audit/content workflows and analytics.
- Safe import undo now preserves every supported lead relationship and shows deleted/preserved/skipped/failed outcomes. New direct lead-linked collections require a typed relationship decision.
- A 54-permission vocabulary, seven immutable role templates and pure policy helpers for Deny/Allow precedence, expiry, membership status, organization, assignment and service/record restrictions.
- Team & Access has a searchable local template inspector and explicit unconnected account/invitation/audit states. It does not authorize employee requests or impersonate accounts.
- Explicit Demo Mode and a server-side Connection Error for unfinished Connected Mode or invalid settings. No silent fallback.

## Prepared but unapplied

One [consolidated SQL proposal](../supabase/proposals/consolidated-initial.sql) replaces the obsolete drafts. It proposes organization-scoped Owner-only business access, protected membership metadata and append-only history. Non-Owner business access is denied until granular policies are reviewed. No database was migrated. Local Auth settings are separate from hosted production settings; see [database-security.md](database-security.md).

Prior read-only CLI checks returned no migrations or user-table statistics. That is not a guarantee every schema is empty. Reinspect before applying anything; existing history would require additive migrations.

## Remaining production requirements

Authentication, cookie sessions, password reset, optional TOTP, verified invitations, Owner bootstrap, Supabase provider, validated server APIs, durable audit storage, employee RLS, service/record scopes, paginated queries and backups are incomplete. The SQL has not received executable RLS/concurrency tests. Data mapping, atomic imports/undo, quote/publication/conversion transactions and business CRUD auditing require completion.

Unified tasks, richer project/audit details, complete global search/quick-add coverage, durable website analytics and real automation monitoring remain outstanding. Website events return 503 until storage is implemented. No external communication, social publication or payment collection is performed.

Read [verification procedure](verification.md), [dependency exception](dependency-risk.md) and [README](../README.md). Do not describe planned database protections as active. No real client data, deployment, production users, invitations, migrations, pushes or merges without the required review and approval.
