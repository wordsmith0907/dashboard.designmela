# Pre-commit remediation — 23 October 2026

Scope: the local `designmela-crm-v2` dashboard repository only. No commit, push, merge, deployment, migration (local or remote), production account change or public website change is authorized or performed.

## Fix and review decisions

Import undo now checks every current lead-linked collection, including quotes, proposals, payments, clients, projects, audits, tasks and legacy activities/notes. Later timeline entries (notes/calls/emails/WhatsApp/meetings) and follow-ups change the stored version and preserve the lead. Missing provenance fails without deletion. No separate invoice entity exists. Updated existing leads are never undone. The typed relationship registry forces an explicit decision when any collection gains a leadId field. Original import counts remain distinct from undo deleted/preserved/skipped/failed outcomes.

The obsolete SQL drafts and old verification summary were removed. One unapplied organization-scoped security proposal is outside the migration directory. Production policy limitations are documented in [database-security.md](database-security.md). Local Auth settings are labelled local-only and strengthened without changing hosted settings.

Six images were reviewed: retain desktop CRM, mobile CRM and mobile permissions; remove redundant Today desktop/mobile and Posted desktop. Test captures now use ignored output. No product assets were removed. Existing application UI remains intact except the requested additional undo result text.

The full dependency audit's five development-chain findings are accepted temporarily under the user's explicit instruction. No compatible fixed braces release was available; no downgrade, force fix, package change or lockfile change was made. See [dependency-risk.md](dependency-risk.md).

## Exact files changed during remediation

- `README.md`
- `ROADMAP.md`
- `docs/consolidated-v2.md`
- `docs/crm-v2.md`
- `docs/data-provider.md`
- `docs/database-security.md`
- `docs/dependency-risk.md`
- `docs/deployment.md`
- `docs/first-commit-files.txt`
- `docs/n8n.md`
- `docs/precommit-fixes.md`
- `docs/screenshots/README.md`
- `docs/verification.md`
- `playwright.config.ts`
- `scripts/review-snapshot.mjs`
- `src/components/lead-import.tsx`
- `src/lib/crm-operations.ts`
- `src/lib/domain.ts`
- `supabase/config.toml`
- `supabase/proposals/consolidated-initial.sql`
- `tests/browser/access.spec.ts`
- `tests/browser/dashboard.spec.ts`
- `tests/browser/import.spec.ts`
- `tests/import-undo.test.ts`

Removed obsolete/redundant files:

- `docs/screenshots/posted-desktop.png`
- `docs/screenshots/today-desktop.png`
- `docs/screenshots/today-mobile.png`
- `docs/v2-verification.md`
- `supabase/proposed-schema.sql`
- `supabase/v2-proposal.sql`

## Intended first commit

[The complete 92-file allowlist](first-commit-files.txt) includes the existing dashboard, intended Team & Access files, policy/mode helpers, tests and current documentation. It is used explicitly for staging; the snapshot review script checks the index matches it. The original repository had no commits, so all intended files appear as additions. Existing .env.example, Team/permission/mode files and curated screenshots are reconciled from their previously unstaged/untracked versions, even when their content did not change during remediation.

Keep: application source, configuration, dependency lockfile, generated Next TypeScript declaration and agent instructions, tests, three curated review images and the unapplied proposal. Exclude: credentials, node_modules, .next, test output, Supabase temporary state, source uploads, obsolete drafts and redundant captures.

## Verification and limits

Run the complete final verification after staging this document and the allowlist: snapshot/secret scan, lint, typecheck, all unit tests, production build, all browser tests, both git diff checks, production audit and full audit. The final assistant report gives actual results and the candidate Git tree hash. The expected unit inventory is 43 tests and the browser inventory is seven; any failure must be addressed before calling the review PASS.

A PASS is for this demo/local first-commit candidate with the documented dependency exception. It is not production readiness or approval to apply SQL. SQL is statically reviewed only; no database/RLS/concurrency tests have executed. Authentication, connected storage and employee database access remain unfinished. Rotate the previously shared database password before production, outside repository history.
