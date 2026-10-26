# Deployment acceptance checkpoints

Phase 4A remediation result: PASS for separately approved Preview setup and acceptance. This checklist is preparation, not authorization to execute 4B/4C. Checked items below are only completed 4A evidence; all deployed tests remain unchecked.

## 4A baseline

- [x] Confirm repository, branch and full Phase 3 commit; remediation entry contains only the four untracked audit documents.
- [x] Inspect current auth, server authorization, RLS migration and runtime configuration.
- [x] Build, lint, standalone TypeScript and runtime/configuration unit tests pass.
- [x] 18 synthetic browser auth checks and 17 protected-route checks pass without hosted requests.
- [x] Production and full dependency audits report zero findings.
- [x] Configured-secret/source/public-asset scan passes; `.env.local` is ignored and untracked.
- [x] Prior read-only audit evidence (no hosted changes during remediation): publishable key HTTP 200, development Auth configuration, 33/33 public tables have enabled/forced RLS.
- [x] Prepare names/scopes, callback, acceptance, DNS and rollback documents.
- [x] Record B1-B6 remediation and external-action disposition after final checks.
- [x] Run hosted-mode fail-closed and callback regression tests: 54 auth checks across three environments and 8 invalid hosted configurations.
- [ ] Identify the separate CRM Vercel project, Git linkage, production branch and deployment protection without changing the public website project.
- [ ] Obtain explicit user approval for Phase 4B after a passing readiness report.

## 4B preview - separate approval required

- [ ] Use an approved non-production deployment of the reviewed feature-branch commit; no custom domain binding.
- [ ] Confirm importing/linking the Git repository will not unexpectedly create a Production deployment or modify the public website project.
- [ ] Configure only required environment names, using Vercel securely; keep local admin credentials and bootstrap identity out of hosting.
- [ ] Verify the preview targets only the approved development Supabase project and organization; keep bootstrap disabled.
- [ ] Review exact stable preview origin, callback URLs, invitation template compatibility and platform access protection; obtain explicit approval for proposed hosted Auth changes before applying.
- [ ] Owner privately logs in; verified organization, membership and permitted modules load from hosted data.
- [ ] Reload preserves session; exercise actual token refresh and verify secure cookie attributes, rotation and no-cache responses.
- [ ] Sign out; protected routes reject access, including directly entered URLs and back/reload attempts.
- [ ] Owner privately completes invitation/confirmation and recovery as applicable. Avoid creating an extra account just to test delivery; agree on any account fixture separately.
- [ ] Test rejected/expired links, missing PKCE verifier, provider outage, absent membership and throttling without leaking account existence or raw errors.
- [ ] Create, read, edit and archive labelled fictional records; verify across sessions/connections and retain required audit history. Do not hard-delete fixtures.
- [ ] Exercise RLS/nonmember/cross-organization isolation and denied direct actions with approved test identities or reviewed role simulations; do not create new employees/Owners without approval.
- [ ] Restricted roles see only authorized navigation and are denied server/database actions even with forged requests; do not rely only on Owner success.
- [ ] Desktop and mobile widths: readable forms, navigation, tables, errors and keyboard interactions; explicitly document unavailable modules.
- [ ] No demo records, Demo Mode fallback or misleading development banner.
- [ ] No browser auth/security errors; inspect sanitized console and network evidence.
- [ ] No secret values in public assets, source maps, HTML/RSC/network error bodies, platform logs or log drains; public publishable key/URL are not privileged credentials.
- [ ] HTTPS headers, secure host-only cookies, cache behavior and deployment access protection verified on the actual preview.
- [ ] Stop with the preview acceptance report and fixture/audit counts. No production promotion, merge or domain connection.

## 4C launch - separate production and DNS approvals

- [ ] Review exact production branch strategy and any proposed merge diff before approval; never merge automatically.
- [ ] Select/approve production Supabase project, migrations, verified Owner setup, backup/restore process, email delivery and monitoring. Do not automatically reuse development as production.
- [ ] Prepare and approve production environment configuration and a new target-correct build.
- [ ] Identify current dashboard-domain assignment and obtain exact Vercel DNS instructions; snapshot only the dashboard record set for possible mutation and preserve root/email records as baseline evidence.
- [ ] Present record type, name, exact target, TTL, conflicts and rollback; obtain separate DNS approval.
- [ ] Apply only approved dashboard records/assignment, verify HTTPS certificate and exact Auth origins/redirects.
- [ ] Rerun deployed auth, permissions, RLS, persistence, secret-leak and responsive checks against the production target with reversible fixtures.
- [ ] Confirm root and www website behavior and email DNS remain unchanged; public HTTP/DNS checks alone do not prove email deliverability.
- [ ] Record deployed commit/branch, URL, checks, environment names/scopes, actual Auth/DNS configuration, rollback and limitations.
