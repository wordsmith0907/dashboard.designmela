# Data providers and persistence

`src/lib/provider.ts` defines the data/auth contracts; only `DemoProvider` is implemented. `DataRoot` creates isolated per-tab state and reloads a detached snapshot after successful mutations. There is no shared server database or fake login. All business data is fictional and in memory. The CRM stores only allowlisted non-sensitive saved-filter preferences in localStorage.

Connected Mode is blocked by the server layout until authentication and persistence exist. A future Supabase provider must use validated server operations, verified cookie sessions, paginated queries and database transactions. UI capability checks are not a substitute for authorization. Never persist tokens manually in localStorage.

The current TypeScript models use camelCase. The unapplied SQL proposal uses organization-scoped snake_case relations and is not a complete adapter mapping. Map every field explicitly, use UTC timestamps/calendar dates appropriately, preserve identifiers, and never seed production with demo fixtures.

Import undo uses an exhaustive typed list of all collections with a direct leadId. Clients, quotes, proposals, payments, projects, audits, tasks and legacy activities always preserve referenced leads. Import-created timeline/follow-up rows may be removed only when the exact stored version remains unchanged. Any later note, call, email, WhatsApp log or follow-up changes that version. No invoice collection exists yet; adding one with leadId requires an explicit relationship decision. Missing provenance fails safely. Undo outcomes are recorded separately from original import counts.

A connected provider must enforce the same safeguards transactionally, with foreign keys and concurrency controls. Publication and accepted-proposal conversion must also be atomic. Generic writes must not bypass status invariants. Reset stays demo-only. Full-snapshot loading is appropriate only to the small fictional dataset, not production.

See [database-security.md](database-security.md) for the consolidated proposal, denied employee access, protected metadata, append-only history, production authentication requirements and remaining SQL tests. No migration is applied.
