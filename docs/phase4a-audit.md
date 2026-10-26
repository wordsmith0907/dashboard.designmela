# Phase 4A remediation audit

Date: 2026-10-26 (Asia/Calcutta). Base: `d89e070d3939c3dce434d56e10dd318742abfd8b`, repository `wordsmith0907/dashboard.designmela`, branch `designmela-crm-v2`.

Final verdict: **PASS - local remediation is ready for separately approved Phase 4B Preview setup and acceptance.** This report supersedes the original Phase 4A FAIL findings; it does not certify a deployed preview or authorize production.

## Blocker disposition

| Original finding | Remediation / boundary |
| --- | --- |
| B1: Connected Mode only supports development | Central `resolveRuntimeConfig` supports explicit development/test/preview/production. Production requires connected mode, complete URL/key/organization/origin configuration and disabled bootstrap. Vercel environment and a contradictory declared environment are rejected. Production rejects the development-project confirmation flag. |
| B2: Missing mode silently enables demo | Missing or invalid mode throws. Demo requires explicit local development/test configuration plus matching non-production Node runtime; Vercel and production-mode servers cannot enable it. Protected routes fail closed before provider access. |
| B3: Localhost origin fallback and unsafe cookie mode | `NEXT_PUBLIC_APP_URL` is the canonical origin input. Production requires the final HTTPS dashboard origin. Preview derives a branch/deployment URL or accepts that exact explicit Vercel URL, never the production URL. Missing/invalid origins fail closed. The old origin alias works only locally; no implicit localhost default remains. |
| B4: Hardcoded Development UI | Server-rendered RuntimeBanner uses validated configuration: no production banner, Preview label only in preview, Development only locally, Demo only in permitted local demo. Hosted activation diagnostics are hidden. Generic setup/error/module text no longer contains development-only instructions. |
| B5: Supabase currently configured for localhost | Exact staged URL and template workflow documented in the rollout plan. Code creates callback destinations from validated origins and preserves PKCE, token-hash and fragment flows. Hosted changes and real delivery tests are intentionally deferred to approved 4B/4C actions; no claim that hosted settings changed. |
| B6: Unknown Vercel project/domain association | DNS provider and existing public answers documented; exact account inspection, separate CRM project creation and assigned target remain external tasks. Do not guess DNS targets or connect the domain during Preview. This is a pre-deployment operational gate, not a reason to deploy or alter the website during remediation. |

## Configuration and runtime contract

`src/lib/runtime-config.ts` is the single pure validator; `src/lib/server-config.ts` is the server-only entry point that reads the environment. Protected server clients, sessions, layouts, pages, callbacks and Proxy use validated configuration. Only selected properties are returned; the input environment, database credentials and administrative secrets are never returned or passed to client components.

Explicit `DESIGNMELA_ENV` selects local development/test when running local checks, including a local production build/start. On Vercel, `VERCEL_ENV` is authoritative and must agree with any explicit declaration. Outside Vercel, absent declared environment with production Node runtime is treated as production, not development. Missing mode is never defaulted. Demo is disallowed with production Node runtime even when the declared environment says development. Misconfigured Vercel context fails closed.

The canonical URL is `NEXT_PUBLIC_APP_URL`; its name denotes public-safe URL data, not permission to expose server secrets. Server callers use dynamic environment lookup rather than browser build-time substitution. Local development accepts explicit loopback origins only. Preview uses `VERCEL_BRANCH_URL` first, then `VERCEL_URL`; on Vercel an explicit URL must match one of those exact platform-provided hosts. Only HTTPS `*.vercel.app` hosts are permitted for this Preview workflow. `VERCEL_PROJECT_PRODUCTION_URL` is deliberately unused because it can point at production even in a preview. Production uses only its explicitly configured final origin, never a preview variable or legacy localhost alias. [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables).

The names/scopes checklist is [environment checklist](phase4a-environment-checklist.md). Public-safe inputs are the application URL, Supabase URL and publishable key. Mode, environment, organization, bootstrap/development gates and platform context are server-only controls. `DATABASE_URL`, initial Owner address and privileged credentials must not be uploaded to Vercel. The local legacy origin alias is retained so this remediation does not rewrite private `.env.local`.

Next.js is lockfile-resolved 16.4.2, which requires Node >=20.9. Node 24.x is now pinned in package and lockfile root metadata; no dependency versions changed. Local verification uses Node 24.14.0/npm 11.9.0. Future Vercel configuration: separate CRM project, repository root, Next.js preset, `npm ci`, `npm run build`, default Next.js output handling, no static export or custom output directory. Dynamic server routes and Server Actions require runtime support. The loopback `start` command is local tooling, not a Vercel custom-server instruction. [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build).

Installed Next guides were read for environment handling, Proxy and deployment before code changes. Next 16 uses `src/proxy.ts`; the Proxy synchronizes refreshed cookies but is not an authorization boundary. Server Actions/pages independently verify users and database permissions.

## Authentication and security

- `authUrls` creates invitation, confirmation, recovery and link-error destinations from validated configuration. Recovery consumes this helper; the callback uses the same validated origin. The app does not send invitations itself; the exact invitation destination is supplied by the later approved administrative workflow/template.
- `safeNext` permits only exact known internal paths. External URLs, protocol-relative URLs, encoded or query-bearing redirect chains, unknown paths and malformed input fall back to `/`. The callback rejects invalid configuration with a generic 503 and no Location header; it does not trust Host/forwarded headers to choose an origin.
- Invitation/confirmation forms preserve token_hash/type, PKCE codes and authentication fragments. Fragment credentials remain in memory, not local storage, and verification requires a user click. Diagnostic presence information is local-only. Recovery callback GET uses PKCE and fails closed without a valid verifier; no bypass was introduced.
- Password creation rules, verification checks, generic reset responses, throttling feedback, session revocation and cookie cleanup are preserved. Initial-owner session preservation is impossible when hosted bootstrap is disabled. Hosted configuration requires that disabled state explicitly.
- Cookies remain HTTP-only, SameSite Lax, host-only, path `/`, Secure for HTTPS. Production/Preview reject localhost origins before creating clients. Responses retain no-store/referrer protections. Headers include nosniff and frame denial; no CSP/HSTS change was made in this remediation.
- Supabase SSR clients use only the publishable key and current user session. Repository operations remain server-authorized and tenant-filtered; input validation, database grants and RLS remain the independent boundary. No service-role key, database migration or policy relaxation was added. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).
- The preceding read-only audit confirmed all 33 public tables have enabled/forced RLS and the configured publishable key works. Prior Phase 3 hosted RLS and live authentication evidence remains valid historical evidence; this remediation runs no hosted mutation or personal auth flow.
- Browser bundle scanning covers static assets/maps, public files and prerendered HTML/RSC payloads for configured private values and synthetic canaries. This is evidence for the built artifact, not proof of absence of all unknown secrets. Deployed headers, source maps, logs, network responses, actual refresh timing and email delivery still require 4B inspection. Do not log private verification URLs.

## Verification

Final validation on the remediated source:

| Check | Result |
| --- | --- |
| Lint | PASS, no warnings |
| Standalone TypeScript | PASS after the final build |
| Unit tests | PASS, 64 including Production configuration, mode restrictions and origin regression tests |
| Production-configured `npm run build` | PASS with synthetic public configuration and private canary values; no real provider calls |
| Development auth browser suite | PASS, 18 checks |
| Preview auth browser suite | PASS, 18 checks |
| Production auth browser suite | PASS, 18 checks |
| Protected-route suite | PASS, 17 routes; spoofed headers ignored |
| Invalid hosted configuration suite | PASS, 8 configurations rejected before provider access; invalid callbacks return 503 without redirect |
| Source/configured-secret scan | PASS, 216 source/public-build files; `.env.local` ignored/untracked |
| Browser/private-value scan | PASS, 42 browser/public/prerendered files including one source map; no private configured values or canaries found |
| Dependency audits | PASS, production-only and full dependency graph both report zero known vulnerabilities |
| Diff/scope/whitespace review | PASS; only remediation source/tests/Node metadata/example configuration and these four documents are included |

All browser suites report zero remote requests, zero hosted accounts created and zero public signup requests. The full browser suite was rerun after the final logout-cookie cleanup change. Production-mode and local builds both passed; the final artifact used the explicit Production configuration. No tests are claimed against an actual Vercel deployment.

Reproduce: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` with approved or synthetic Production configuration, `node scripts/test-auth-flows.mjs development`, `node scripts/test-auth-flows.mjs preview`, `node scripts/test-auth-flows.mjs production`, `node scripts/test-connected-gates.mjs`, `node scripts/test-hosted-config.mjs`, `python scripts/scan-phase3-secrets.py`, `python scripts/scan-browser-secrets.py`, both npm audit scopes, and `git diff --check`. Never copy private values into command text or reports. Hosted-mode browser tests use synthetic Supabase transport and virtual HTTPS application origins forwarded to loopback. They exercise secure cookies, callbacks, recovery destinations and UI configuration without contacting Vercel, Supabase or sending email. They are not real hosted acceptance.

## Changed files

- Configuration: `src/lib/runtime-config.ts`, `src/lib/server-config.ts`, `src/lib/application-mode.ts`, `src/lib/connected/config.ts`, `.env.example`, package/lockfile Node metadata.
- Server consumers: `src/lib/supabase/server.ts`, `src/lib/connected/session.ts`, `src/proxy.ts`, auth actions/callback and login actions.
- UI: connected runtime banner, workspace layout/page, login/forgot/reset/setup/access-pending/activate/confirm/unavailable/error pages and activation diagnostics.
- Tests: application-mode, auth, connected and new runtime-config unit tests; expanded auth-flow harness, route-gate harness, hosted fail-closed harness and browser-secret scanner.
- Documentation: these four Phase 4A audit/environment/acceptance/rollout documents only.

No private `.env.local`, public website source, hosted settings or database schema is changed. The existing `.env.example` contains illustrative placeholders and public origins only. Source and Git checks must pass before the exact authorized commit and branch push.

## Remaining manual/external actions

Phase 4B requires separate user approval. Inspect the Vercel account/team, Git auto-deployment behavior and existing dashboard assignment; create/select a separate CRM project; configure scoped variables securely; establish the exact preview URL; approve and apply exact development-project Auth redirects and supported email templates; then perform real deployed acceptance. The custom domain, DNS, production project/data setup, migrations, merge and launch require their separate later approvals. The DNS CNAME/A target remains unknown until the actual project provides it.

See [acceptance checklist](phase4a-acceptance-checklist.md) and [staged URLs, DNS and rollback](phase4a-rollout-plan.md). Software readiness for controlled Preview does not mean production launch approval or full CRM feature completeness. Team administration, analytics and other unfinished connected modules remain explicitly unavailable.
