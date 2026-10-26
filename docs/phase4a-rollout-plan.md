# Supabase URLs, dashboard DNS and rollback plan

Prepared 2026-10-26. No changes applied. Remediation is local only; deployment still requires explicit Phase 4B approval.

## Supabase configuration checklist

Live read-only development settings: Site URL `http://127.0.0.1:3100`; redirect allowlist contains `http://127.0.0.1:3100/auth/callback?next=/reset-password` and `http://127.0.0.1:3100/**`. Email login is enabled, verification required, signup/anonymous/social sign-in disabled, minimum creation length 12 with character classes, refresh rotation enabled. Do not change these during 4A.

Let `PREVIEW_ORIGIN` mean the exact approved stable HTTPS preview hostname, not a new environment-variable name and not a literal deployable URL. That hostname is not known yet. Use the validated `NEXT_PUBLIC_APP_URL` setting; do not derive callback origins from an untrusted Host header.

| Purpose | Preview candidate | Final-domain candidate |
| --- | --- | --- |
| App origin / Site URL decision | Exact `PREVIEW_ORIGIN`; approve any change to the shared development project's default Site URL because it affects localhost email flows | `https://dashboard.designmela.com` on the separately approved production project |
| Current recovery callback | `PREVIEW_ORIGIN/auth/callback?next=/reset-password` | `https://dashboard.designmela.com/auth/callback?next=/reset-password` |
| Default invitation fragment landing, if used | `PREVIEW_ORIGIN/auth/activate` | `https://dashboard.designmela.com/auth/activate` |
| Token-hash confirmation landing, only if approved templates use it | `PREVIEW_ORIGIN/auth/confirm` | `https://dashboard.designmela.com/auth/confirm` |

- [ ] Review the actual invite and recovery templates, redirect parameters and mail-provider capabilities together. Add only URLs actually used, not every candidate by default.
- [ ] The current root page is not a fragment credential handler. A default ConfirmationURL with no explicit invitation redirect cannot be assumed to work merely by setting a root Site URL.
- [ ] Use an explicit invitation `redirectTo` to `/auth/activate` if supported by the approved sending workflow, or an approved token-hash template to `/auth/confirm`. Earlier custom-template rejection must be resolved or the supported default flow demonstrated. No template change is pre-authorized.
- [ ] Do not use broad Vercel/team wildcard redirects. Record the exact preview origin/path and remove obsolete preview entries after approved cleanup.
- [ ] Preserve necessary localhost settings in the development project. Production should not inherit development redirects or targets by copying all settings.
- [ ] PKCE recovery needs the browser verifier from the original reset request. Hand the private email/password steps to the user; never inspect or log credentials or actual verification links.
- [ ] Prefer a stable approved preview hostname for repeatable email flows; ensure Vercel protection does not break callback completion. Do not put a deployment-protection bypass secret in an email URL.

Supabase documents the Site URL as the fallback when no redirect is specified and recommends exact production paths. [Redirect URL reference](https://supabase.com/docs/guides/auth/redirect-urls).

## Exact staged approval payloads

Local development: application origin and Site URL `http://127.0.0.1:3100`; retain only required exact redirects `http://127.0.0.1:3100/auth/activate` and `http://127.0.0.1:3100/auth/callback?next=/reset-password`. Add `http://127.0.0.1:3100/auth/confirm` only if the approved token-hash template uses that landing route. Replacing the existing broad localhost allowlist requires later hosted-settings approval; nothing was changed here.

Preview: omit `NEXT_PUBLIC_APP_URL` in Preview scope to derive the exact `https://` plus `VERCEL_BRANCH_URL` (falling back to `VERCEL_URL`), or set the exact approved platform URL in Preview scope. Do not use `VERCEL_PROJECT_PRODUCTION_URL`. The stable branch origin is preferable for same-browser PKCE and repeatable email testing. The validator refuses the final production origin and unrelated explicit Vercel hosts on Vercel. This does not rewrite Production-scoped configuration.

Once the actual project supplies the Preview hostname, expand `PREVIEW_ORIGIN` in the table above to literal complete URLs and present that exact Site URL/redirect change set for approval. A real hostname does not exist yet and must not be fabricated. Add no team-wide or wildcard preview allowlist. If using the shared development project's default Site URL for Preview, explicitly account for the impact on local invitation links; prefer an explicitly supplied invitation redirect where supported.

Production: application origin and Site URL `https://dashboard.designmela.com`; exact default invitation redirect `https://dashboard.designmela.com/auth/activate`; exact recovery redirect `https://dashboard.designmela.com/auth/callback?next=/reset-password`; confirmation landing `https://dashboard.designmela.com/auth/confirm` only if the approved template uses it. Keep local/preview destinations in the development project, not the production allowlist. Real token/code parameters are never copied into this document.

The application currently has no invite-sending UI or privileged invite client. The approved Supabase Dashboard/admin workflow must use the generated invitation landing URL or an approved confirmation template. The final root origin alone is not an invitation fragment handler. Template availability and actual mail delivery must pass Preview acceptance; this remediation does not claim they are configured.

## Public DNS and HTTP baseline

Read-only observations on 2026-10-26; DNS responses are snapshots and may be cached. They do not prove account ownership or the Vercel project/domain assignment.

| Query | Observed answer |
| --- | --- |
| `dashboard.designmela.com` A | `64.29.17.65`, `216.198.79.1`; initial response TTL 1800 seconds |
| `dashboard.designmela.com` CNAME / AAAA | No CNAME or AAAA answer returned; zone SOA returned |
| `designmela.com` NS | `ns1.vercel-dns.com`, `ns2.vercel-dns.com` |
| `designmela.com` A | `216.198.79.1`, `216.198.79.65`; response TTL 1800 seconds |
| `www.designmela.com` CNAME | No CNAME answer returned; this does not mean the hostname is absent |
| `designmela.com` MX | Preference 0 `smtp.secureserver.net`; preference 10 `mailstore1.secureserver.net`; response TTL 60 seconds |
| SPF / DMARC | Public TXT records present; preserve unchanged. DKIM selectors were not enumerated. |
| HTTPS HEAD root / www | Both returned HTTP 200 |
| HTTPS HEAD dashboard | HTTP 404; this is not proof the hostname is unassigned or disposable |

A second dashboard query directed at `ns1.vercel-dns.com` returned the same A values with a lower TTL. The wildcard DNS query did not succeed; whether dashboard answers derive from explicit or wildcard records remains unverified. Inspect the authenticated DNS zone and existing Vercel assignment before planning any replacement. Do not remove a wildcard to create the dashboard host.

## Proposed dashboard-only DNS change envelope - not executable yet

| Field | Planned requirement |
| --- | --- |
| Domain | `dashboard.designmela.com` only |
| Type | Expected CNAME for a subdomain; confirm Vercel's exact project/domain instruction before approval |
| Host/name | `dashboard` (or the fully-qualified equivalent required by the DNS editor) |
| Target/value | **UNKNOWN / BLOCKED** - copy the exact target returned for the separate CRM Vercel project in Phase 4C; no generic target is approved |
| TTL | Propose 300 seconds if supported, otherwise provider-supported setting shown for approval; current A response TTL is 1800, not a verified editable zone setting |
| Conflicts | Existing dashboard A answers above; distinguish explicit records, wildcard synthesis and provider flattening before touching them |
| Ownership verification | If Vercel requests any extra TXT record, present its exact name/scope separately. Any root-domain record change is outside authorization; stop rather than applying it |
| Rollback | Restore the exact previous dashboard record set, TTL, proxy/flattening status and project assignment captured from the account immediately before change |

Vercel's generic examples are not necessarily a project's exact recommended DNS target. Obtain the account-specific instruction rather than guessing. [Vercel domain setup](https://vercel.com/docs/domains/set-up-custom-domain).

Never add the apex, www or a wildcard to the CRM project. Never change nameservers, root A/AAAA, root/website aliases, MX, SPF, DKIM, DMARC, root CAA or unrelated TXT records. If certificate issuance requires a prohibited root change, report the conflict. Prefer leaving an already valid dashboard DNS arrangement unchanged if Vercel confirms it can serve the approved separate project without affecting other hosts.

## Branch and deployment strategy

Keep `designmela-crm-v2` as the review/preview branch during 4B. Use a separate CRM Vercel project with explicit environment scoping and protection. Before importing Git, inspect whether import or a push will automatically trigger a production deployment. Do not point the existing public website project at this repository or change its production branch.

For 4C, first inspect the repository's actual branch graph and project linkage. If `main` is the intended CRM release branch, show the exact merge target and reviewed diff and obtain merge approval. Otherwise propose an explicitly named release branch and its Vercel assignment for approval. Do not assume `main` is safe or merge/repoint a branch just to obtain a production URL. Build for the approved production Supabase target; a successful development-backed preview must not silently become the production data target.

## Rollback procedure

1. Before any approved change, record the prior deployment ID/commit, CRM project/domain assignment, exact dashboard DNS configuration, Auth Site URL/allowlist/templates and environment-variable *names/scopes*. Keep configuration values in their secure providers; do not export secrets to this report. Record who can execute rollback.
2. Preview failure: halt acceptance, keep production/domain untouched, stop sharing the failing preview and restore the previous known-good preview/configuration through the approved project workflow. Remove only preview redirects added by this work after approval. Archive fixtures and preserve history. Code rollback does not undo database writes.
3. Launch failure: use the prepared prior known-good CRM deployment/assignment under approval. On a first launch with no prior CRM deployment, remove the new dashboard assignment or use an approved maintenance response; do not claim a nonexistent prior production release is available.
4. DNS rollback: change only dashboard records that this work changed, restoring the captured exact values and settings. Wait for cache expiry, recheck authoritative and public resolution, HTTPS and root/www behavior. Do not treat the public baseline's A answers as a complete zone export or restore template.
5. Restore only Auth origins/redirect/template settings changed by this rollout, using the captured prior configuration and approval. Revoke exposed sessions/credentials only if an actual incident requires a separately reviewed response. Never rewind the database or re-enable consumed bootstrap as a routine rollback.
6. Verify the restored target, authentication, protected-route denial, root/www availability and unchanged email records. Preserve audit history, report remaining archived fixtures, document impact and stop until the next approved checkpoint.

No rollback action is performed in Phase 4A. Production migrations, destructive cleanup and credential rotation are not implied by this procedure.
