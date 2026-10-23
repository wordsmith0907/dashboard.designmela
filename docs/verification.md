# Verification of the intended first commit

Branch: `designmela-crm-v2`. This document describes the checks; the final pre-commit report records their results. Earlier MVP/CRM verification counts are superseded.

Run lint, TypeScript, unit tests, production build and the complete Playwright suite against the same staged working tree. Unit tests include CSV/Excel parsing, duplicate handling, safe undo relationships/outcomes, quote calculations, source attribution, demo publication and access-policy helpers. Browser tests cover navigation, forms, local imports and undo result display, manual publication, the permission inspector, runtime errors and mobile overflow.

Use `npm audit --omit=dev` for production dependencies and `npm audit` for all dependencies. The documented [development-only exception](dependency-risk.md) is not a clean full audit. Never use a force fix or downgrade Next's ESLint config just to silence an audit.

Run `node scripts/review-snapshot.mjs` after explicit staging: it compares the index with the working tree, checks for untracked files and scans index text plus browser assets for credential patterns and known local secrets without printing their values. Run both `git diff --check` and `git diff --cached --check`. The index tree hash identifies the exact candidate snapshot; creating that tree object is not a commit.

Generated screenshots and traces go to ignored test output. The three [curated images](screenshots/README.md) show desktop CRM, mobile CRM and the mobile permission inspector. Tests must not overwrite documentation assets.

Limits: this is not an exhaustive security/accessibility audit. No SQL proposal is executed by these checks. Database RLS, concurrency, migration compatibility, actual authentication/MFA, email delivery and production integrations remain unverified. Current data and identities are fictional. No public website, production service, migration, commit, push, merge or deployment is part of verification.
