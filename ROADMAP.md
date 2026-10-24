# Remaining work

1. Review the Phase 2 pre-migration report, the unapplied schema and the temporary development dependency exception. Do not migrate before explicit approval.
2. Validate the new session/authorization/bootstrap/repository code against a separately approved disposable Supabase database; inspect hosted development history/schema/auth settings before any apply.
3. Finish verified invitations, password reset, optional Owner/admin MFA enrollment/challenge/recovery, restricted custom-role/override operations and safe owner recovery. The connected Team screen is not account management yet.
4. Extend the basic connected record forms and implement transactional import/undo, quote items/totals, proposal conversion/publication, optimistic concurrency, service restrictions, tested backups and recovery.
5. With separate approval, connect website analytics and automation integrations. Existing public Designmela code is outside this repository/task.

The full demo workflows remain fictional/in-memory. Connected Mode currently prepares a narrower basic CRUD/archive subset and is disabled locally; its database is unapplied. External publishing, payment collection and messaging are unconnected. Deployment and production authentication remain separately approval-gated.
