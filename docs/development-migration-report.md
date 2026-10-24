# DEVELOPMENT MIGRATION REPORT

Date: 2026-10-25 (Asia/Calcutta). **PASS — development schema migration and read-only verification.**

## Approved baseline and target

Before preparation, branch `designmela-crm-v2` was clean at commit `58e207fb5e596c84a9a13a8318605e69e1a94d4a`, tree `1cb3d19eef9b5415d690174062c95f3e19e213b6`.

The configured HTTPS endpoint, database connection identity, linked project reference, and previously cached project identity matched. Identifiers and connection details are masked in the records. The target is the user-confirmed dedicated development project; its organizational purpose cannot be established from database catalogs alone.

Fresh read-only preflight found the same nine platform schemas, no application tables or custom public functions, no policies, and empty application migration history. Eight ordinary platform triggers and six platform event triggers matched the earlier report. All nine checked identity/storage/vault/realtime counts were zero. The earlier report did not retain a cryptographic full-catalog snapshot; comparison to it uses the recorded inventory facts and cached identity, not an invented historical hash.

The full fresh inventory of schemas, tables, functions, triggers, policies and migration history is in [development-pre-migration.json](development-pre-migration.json). Remote inspection connections used server-enforced read-only transactions and rolled back on exit.

## Application

- Migration: `20261023000100_designmela_initial.sql`.
- SHA-256: `4d09aa7c75b03633eb4260c781b74e38808592d928201778228f89e66c68a203`.
- Promoted file bytes exactly match the Phase 2A-tested proposal. The proposal was not edited.
- Dry-run: `npx supabase@2.122.0 db push --linked --skip-vault --dry-run`.
- Apply: `npx supabase@2.122.0 db push --linked --skip-vault`.
- CLI exit code: **0**. One application attempt; exactly the expected migration; no seeds or role files.
- Migration history contains exactly version `20261023000100`, name `designmela_initial`.

The existing database password was supplied through the child process environment, without printing it or adding credentials. No service-role key was added. The CLI handled migration-history recording; no manual completion marking or dashboard SQL edits occurred. See the [dry-run](development-migration-dry-run.json) and [application](development-migration-apply.json) records.

## Local-versus-remote schema comparison

The preserved Phase 2A disposable local database was restarted without migration or seed execution and inspected read-only. Its schema was compared with the hosted schema across twelve categories: tables, columns, constraints, indexes, functions, triggers, policies, event triggers, table grants, function grants, schema grants, and default grants.

All categories match after two narrowly defined normalizations:

1. The reviewed SQL generates 111 FK index names from database-specific constraint OIDs (`fk_<oid>`). Names therefore differ between databases; indexed tables, columns, definitions, uniqueness, validity and readiness match.
2. Stored function definitions differ only in CRLF versus LF line endings after CLI processing. Function bodies, signatures, owners, security-definer flags and configuration otherwise match.

The initial literal comparison reported FAIL for these two categories. That raw result is deliberately preserved in [development-post-migration.json](development-post-migration.json); the completed comparison and exact normalization rules are in [development-schema-comparison.json](development-schema-comparison.json). No remote SQL or schema was changed to resolve the comparison. The [local snapshot](development-local-schema.json) is retained for review.

Verified totals: **34 tables (33 public, one private), 415 columns, 211 constraints including 113 foreign keys, 242 indexes, 15 functions, 69 ordinary triggers, 78 policies, and one application event trigger.** No unexpected application objects or semantic differences were found. The only additional CLI object is `supabase_migrations.schema_migrations`. No pre-existing tables disappeared. See [final inventory](development-final-inventory.json).

## Authorization and bootstrap verification

- All 34 tables have RLS enabled and forced. The future-table RLS event trigger exists and matches local validation.
- No PUBLIC table grants and no effective anonymous SELECT/INSERT/UPDATE/DELETE privileges exist on application tables.
- All 78 policies, scoped tenant checks, protected identity/ownership/membership guards, function definitions, and execution grants match the locally tested schema.
- Both deferred last-owner constraint triggers and their function match: `organization_requires_owner` and `membership_requires_owner`.
- Audit history policies allow SELECT only; ordinary authenticated users have SELECT only on `audit_logs`. Append-only protection triggers match the tested definitions.
- Bootstrap has one unused singleton with both organization and owner references NULL. Anonymous and authenticated roles cannot execute `bootstrap_first_owner`; service_role retains the designed execute permission. Verified-user/email and one-time/idempotent checks remain in the matching function definition. No bootstrap invocation occurred.

This is read-only remote structural verification backed by the prior 229 disposable database checks. No hosted write-based authorization tests, synthetic identities, or business fixtures were created. Actual hosted login, email delivery, MFA and account recovery remain untested.

## Row counts

Every one of the 32 public tables other than the static permission catalog has **0 rows**, including organizations, profiles, memberships, roles, invitations, audit logs, leads, clients, projects, tasks, quotes, proposals and payments.

The only application-schema rows are the reviewed migration's **22 static permission definitions** and **one unused private bootstrap singleton**. These are schema initialization records, not demo/business/owner data or a separately run seed file. `auth.users` is **0**. All nine previously checked identity/storage/vault/realtime counts remain **0**. Exact per-table counts are retained in the post-migration record.

## Application checks and Git status

Lint, TypeScript, all **51 unit tests**, production build, and the source/browser-asset secret scan passed. The SQL hash was checked before promotion, before the CLI commands, and afterward. `.env.local` remains ignored and untracked. No application code or runtime configuration was changed. Disposable local containers were stopped after inspection, retaining their volumes.

Git HEAD and its tree remain the approved baseline. The working tree is **dirty, unstaged** solely with the promoted migration, this report and its evidence records, and a `.gitattributes` entry preserving the promoted SQL bytes. Temporary verification scripts and local database files remain in ignored locations. No commit or push was made in this step.

## Readiness and scope

The development schema is ready for **separately approved hosted-authentication testing**. This is not production readiness or evidence that hosted authentication settings, invitation/reset delivery, MFA or recovery are complete. Demo Mode and bootstrap configuration were not changed.

No owner bootstrap, owner/employee account creation, demo/business insertion, hosted-authentication setting change, service-role key addition, Vercel deployment, merge, push, or public designmela.com change occurred. No unreviewed migration or ad-hoc remote fix was applied. Work stops here pending separate approval.
