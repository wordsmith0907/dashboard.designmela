# Unapplied consolidated database proposal

`supabase/proposals/consolidated-initial.sql` replaces both obsolete SQL drafts. It is outside `supabase/migrations`, is not executed by application/build/test scripts, and has not been applied to any database. It is a fresh-database review proposal, not a production-ready migration. No real Owner, employee, invitation or organization is seeded.

## Proposed enforcement

- Organization IDs are mandatory for business records. Composite foreign keys keep linked records in the same workspace; tenant, creator and record identity cannot be changed through updates.
- Self-editable profiles contain display information only. Column grants allow only display name/avatar edits. Roles, permissions, active status and ownership reside in separate access tables with no ordinary-user direct write grants.
- Business policies require a verified, active organization Owner. Employees, including Operations Admin, have **no business-data access** in this initial proposal. Enabling granular employee access requires a later reviewed policy implementation; the TypeScript permission inspector is not used as database authorization.
- The narrow `owner_update_member` function locks the organization/member, derives the caller from Supabase Auth, requires recent password authentication and confirmation, rejects self-modification and Owner targets, and atomically writes a permission version and audit record. It cannot create an Owner or change a member's organization/user identity. Ordinary users and service-role integrations cannot directly edit access metadata.
- All existing Owner memberships are immutable to normal updates/deletes, so the final Owner cannot be lost through a supported operation. Ownership transfer, adding Owners and initial bootstrap remain unavailable pending a separately reviewed process. This is intentionally restrictive; never remove the guard as a convenience workaround.
- Audit records and permission versions are append-only: no ordinary-user mutation grants or policies, and triggers reject update/delete/truncate. Superuser/DDL control is outside this guarantee. Security-sensitive operations must use audited functions; business CRUD auditing still needs completion.
- All exposed private tables enable/force RLS; anonymous access is denied. Functions pin search paths and narrow execution privileges. Service-role keys bypass RLS where granted and must remain in a trusted server secret store. Do not expose admin credentials to clients, AI or n8n.

## Auth plan, separate from SQL

`supabase/config.toml` configures **local development only**. Safer local defaults now disable signup, require 12 characters with upper/lowercase, number and symbol, enable email confirmation, and permit optional TOTP enrollment. Editing this file does not update hosted Supabase Auth or enforce anything in the current Demo app.

Before production, configure the hosted project with public signup disabled, verified invitation acceptance, minimum 12-character passwords with the same character classes, confirmation input and generic password-reset responses. Existing weak credentials need rotation; never print them. Require a recent password check for sensitive changes; a refreshed token's issue time is not sufficient.

Owner/admin TOTP is optional under the latest request. The proposal's organization setting `require_admin_mfa` defaults to false and is not user-editable. When enabled through a reviewed server operation, Owner access requires JWT `aal2`. Admin access remains denied until employee policies also enforce the selected MFA policy. Enrollment, challenge, recovery and safe factor removal must exist before enabling enforcement to avoid lockout. No paid SMS MFA is planned.

## Remaining approval blockers for database use

No database migration was run, including locally. SQL has only received static review; RLS behavior, SQL function bodies, grants, concurrency and deployment compatibility are unverified. Before requesting application approval:

1. Reinspect migration history and schema; if anything is already applied, use additive migrations instead of this initial proposal.
2. With separate permission, test in an isolated disposable Supabase database: anonymous and two-organization CRUD, cross-tenant foreign keys, suspended/stale sessions, direct role writes, service-role access, self-promotion, concurrent Owner operations, email verification, recent authentication, optional MFA and immutable history.
3. Complete the CRM2 field mapping, role catalogue seeding, scoped employee policies, service restrictions, restricted role/override management, invitations, Owner bootstrap and offboarding. No insecure client fallback is permitted.
4. Implement validated server APIs, pagination, atomic import/undo, quote totals, publication and conversions. Database FKs must remain restrictive; clearing import history references and deleting safe import-created children requires one reviewed transaction. Current SQL permits no ordinary hard delete.
5. Provide a secure backup/export and recovery plan, review the final migration, and obtain explicit approval before applying it remotely.

Reference: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa). These explain the platform mechanisms; they do not certify this proposal.
