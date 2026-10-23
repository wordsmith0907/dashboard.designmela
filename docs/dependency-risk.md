# Temporary development-only dependency exception

Reviewed 2026-10-23. This exception is permitted by the pre-commit-fix request; it does not assert that the full dependency audit is clean.

Exact installed chain:

`eslint-config-next@16.4.2 → @next/eslint-plugin-next@16.4.2 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`

The [braces advisory GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) describes stack exhaustion on deeply nested patterns. npm reports five high-severity affected package entries through this one chain, not five independent underlying flaws.

Registry checks found `braces@3.0.3` remains the latest published version, with no fixed release. `eslint-config-next@16.4.2` is the latest stable 16.x release inspected. The newer compatible `fast-glob@3.3.3` still uses `micromatch ^4.0.8`, which depends on `braces ^3.0.3`; that upgrade does not remove the advisory. The audit's suggested `eslint-config-next@14.2.35` downgrade is incompatible with the intended Next.js 16 toolchain and has not been applied.

Decision: retain the existing lockfile and toolchain; accept this temporary development-only risk. No force fix, override, downgrade or unnecessary dependency was added. The application does not expose ESLint or glob-pattern evaluation to users. Lint only trusted checkouts; isolate CI for untrusted contributions, avoid secrets in those jobs and limit job runtime. This reduces exposure but does not repair the vulnerable dependency.

Recheck before the next dependency update or deployment, and no later than 2026-11-06. Remove this exception once a compatible patched chain is available and verified. Commands: `npm ls braces micromatch fast-glob @next/eslint-plugin-next eslint-config-next`, `npm audit`, `npm audit --omit=dev`. Production-only audit must remain at zero known findings. An audit result is not proof that no undisclosed vulnerability exists; SheetJS is installed from its vendor tarball and deserves separate review on updates.
