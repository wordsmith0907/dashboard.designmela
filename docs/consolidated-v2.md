# Consolidated CRM 2.0 status

Work is on `designmela-crm-v2`. The consolidated brief is not fully implemented. Existing Next.js/React/TypeScript/Tailwind pages and fictional demo workflows remain intact.

## Implemented locally

- CRM imports, duplicate review, scoring, attribution, timeline, follow-ups, clients, quotes, proposals, payments, project/audit/content workflows and analytics.
- Safe import undo now preserves every supported lead relationship and shows deleted/preserved/skipped/failed outcomes. New direct lead-linked collections require a typed relationship decision.
- A 54-permission vocabulary, seven immutable role templates and pure policy helpers for Deny/Allow precedence, expiry, membership status, organization, assignment and service/record restrictions.
- Team & Access has a searchable local template inspector and explicit unconnected account/invitation/audit states. It does not authorize employee requests or impersonate accounts.
- Explicit Demo Mode plus a gated development Connected Mode with login/logout, cookie sessions, server authorization, permission-aware routes and basic persistent record adapters. No flags have been enabled; invalid configuration and failed queries do not load demo records.

## Validated locally; unapplied remotely

One [consolidated SQL proposal](../supabase/proposals/consolidated-initial.sql) replaces the obsolete drafts. It now proposes seeded roles/canonical capabilities, scoped employee RLS, protected membership metadata, append-only history, future-table RLS and an idempotent server-only initial Owner bootstrap. These passed disposable local database testing; see the [Phase 2A report](phase2a-validation.md). No remote database was migrated. Local Auth settings are separate from hosted production settings; see [database-security.md](database-security.md).

Phase 2A read-only catalog inspection found no application objects, application migration history, identities or stored business data. Development dedication is user-confirmed. Reinspect before applying anything; existing history would require additive migrations.

## Remaining production requirements

Phase 2 prepares authentication/cookie sessions, bootstrap, permission resolution, paginated server adapters and SQL business auditing. They remain unactivated remotely. RLS/concurrency/bootstrap were tested locally; end-to-end hosted authentication remains unverified. Password reset, optional TOTP, verified invitations, custom-role/override management, service restrictions, full data mapping, optimistic concurrency, backups, atomic imports/undo and quote/publication/conversion transactions remain incomplete. See the [pre-migration report](phase2-pre-migration.md) for exact boundaries.

Unified tasks, richer project/audit details, complete global search/quick-add coverage, durable website analytics and real automation monitoring remain outstanding. Website events return 503 until storage is implemented. No external communication, social publication or payment collection is performed.

Read [verification procedure](verification.md), [dependency exception](dependency-risk.md) and [README](../README.md). Do not describe planned database protections as active. No real client data, deployment, production users, invitations, migrations, pushes or merges without the required review and approval.
