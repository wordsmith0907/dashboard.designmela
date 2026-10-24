# Verification

Branch: `designmela-crm-v2`. The first-commit manifest/report is historical. The Phase 2A checkpoint includes the prepared integration; its [pre-migration report](phase2-pre-migration.md) records historical checks; the [Phase 2A report](phase2a-validation.md) records current validation.

Run lint, TypeScript, unit tests, production build and the complete Playwright suite against the same current working tree. Unit tests include CSV/Excel parsing, duplicate handling, safe undo relationships/outcomes, quote calculations, source attribution, demo publication and access-policy helpers. Browser tests cover navigation, forms, local imports and undo result display, manual publication, the permission inspector, runtime errors and mobile overflow.

Use `npm audit --omit=dev` for production dependencies and `npm audit` for all dependencies. The documented [development-only exception](dependency-risk.md) is not a clean full audit. Never use a force fix or downgrade Next's ESLint config just to silence an audit.

For Phase 2 run `node scripts/review-snapshot.mjs --working-tree` to scan tracked and untracked non-ignored source plus built browser assets. The original first-commit mode remains available: run `node scripts/review-snapshot.mjs` after explicit staging: it compares the index with the working tree, checks for untracked files and scans index text plus browser assets for credential patterns and known local secrets without printing their values. Run both `git diff --check` and `git diff --cached --check`. The index tree hash identifies the exact candidate snapshot; creating that tree object is not a commit.

Generated screenshots and traces go to ignored test output. The three [curated images](screenshots/README.md) show desktop CRM, mobile CRM and the mobile permission inspector. Tests must not overwrite documentation assets.

Phase 2 adds `node scripts/test-connected-gates.mjs` after the build. It starts an isolated local Connected Mode server, blocks external fetches, and checks nine anonymous direct routes with spoofed permission headers. It does not validate authenticated RLS. `uv run --with pglast python scripts/review-sql.py` parses the SQL without connecting to a database; Phase 2A separately executes the proposal and checks its runtime behavior locally.

Limits: this is not an exhaustive security/accessibility audit. Ordinary application checks do not execute SQL. The explicit Phase 2A harness below tests local SQL/RLS/concurrency; actual hosted authentication/MFA, email delivery and production integrations remain unverified. Demo data and identities are fictional. Connected code is prepared but not enabled or verified live. No public website, production service, migration, commit, push, merge or deployment is part of verification.

## Disposable Phase 2A validation

Run `uv run --with "psycopg[binary]" python scripts/inspect-remote-readonly.py` only for the approved read-only preflight. The script checks read-only transaction mode before inspecting catalogs and counts; no stored records or credentials are printed. Stop if it finds existing application or unrelated objects/data.

`scripts/phase2a-local-stack.py` starts an isolated stack with separate ports and no copied environment, remote link, migrations or data. Then run `uv run --with "psycopg[binary]" python scripts/phase2a-db-tests.py --apply`. The harness asserts the local container identity and loopback port; it never reads DATABASE_URL. Results are written to `docs/phase2a-database-results.json`.

For an explicitly approved disposable reset, run `python scripts/phase2a-reset-local.py --confirm-disposable-reset`, then repeat the harness with `--apply`. Never substitute a remote reset or migration command.

The isolated runtime directory is ignored `test-results/phase2a-local`. While it exists, run browser tests with `npx playwright test --output=.next/phase2a-browser-results` to prevent Playwright from cleaning that stack configuration. Generated credentials remain local and are never printed or committed.

For the Phase 2A checkpoint, run `node scripts/review-snapshot.mjs --manifest=docs/phase2a-checkpoint-files.txt` after staging. That manifest lists the complete tracked snapshot; the exact changed paths are listed in `docs/phase2a-checkpoint-changes.txt`. Historical reports retain the state at their validation time.
