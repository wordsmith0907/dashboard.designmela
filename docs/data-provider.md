# Data providers and persistence

`DemoProvider` and `DataRoot` retain the existing fictional per-tab snapshot model. Full demo pages now live under the `(workspace)` route group as `demo.tsx`; their URLs and interactions are unchanged. Only allowlisted saved-filter preferences use localStorage. No demo record is uploaded.

Connected Mode is a separate incremental server repository, not a full-snapshot Supabase implementation of DemoProvider. `src/lib/supabase` separates the public browser client, session-scoped server client and server-only bootstrap client. `src/proxy.ts` refreshes cookies; protected layouts/pages/actions independently verify the user and resolve active membership/capabilities through `workspace_session`. RLS enforces permissions again on database queries. Client-supplied role metadata is never authoritative.

`src/lib/connected/records.ts` defines allowlisted field mappings and validation. `repository.ts` provides list/create/edit/archive for leads, clients, projects, tasks, draft quotes/proposals and manual payments, with 25-row pagination and server-assigned organization/creator/assignee. Mutations return errors when no permitted row changes; they never fall back to demo data. Connected forms consume these server operations rather than the Supabase SDK. Writes preserve relationships through archival; no hard delete is exposed.

This increment does not adapt all demo fields or workflows. Connected import/undo must preserve the existing relationship/provenance safeguards in one database transaction. Quote line items/totals, accepted-proposal conversion, content publication, richer CRM fields and optimistic concurrency remain planned. Connected screens outside the basic modules display unavailable states. The old demo permission inspector is separate from the 22 canonical connected capabilities.

The existing demo undo protects clients, quotes, proposals, payments, projects, audits, tasks, notes/activities, communications and follow-ups. Missing provenance fails safely; changed or related leads are preserved. No invoice collection exists. This logic has not been ported into a database RPC, so connected import/undo is unavailable.

SQL remains unapplied remotely; disposable local validation is recorded in the [Phase 2A report](phase2a-validation.md). Read the [Phase 2 report](phase2-pre-migration.md) and [security plan](database-security.md) before enabling the development flags. Never persist tokens manually in localStorage or use a service credential for ordinary record operations.
