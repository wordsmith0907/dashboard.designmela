# Invitation flow diagnosis ? 2026-10-26

Hosted inspection was read-only. No Auth accounts were created, deleted or changed; no SQL, bootstrap, deployment, merge, commit or push was performed.

## Observed configuration

- Site URL: `http://127.0.0.1:3100/auth/activate` (does not match requested root URL).
- Redirect allowlist: only `http://127.0.0.1:3100/auth/callback?next=/reset-password`.
- Invite template contains `{{ .ConfirmationURL }}`; it does not contain a direct `/auth/confirm` link or `TokenHash` placeholder. ConfirmationURL is a valid Supabase token-bearing verification link, not inherently a broken template.
- These hosted values were not changed during diagnosis.

The previous activation component recognized only `access_token` in the fragment, removed both query and fragment immediately, ignored provider error fragments and did not observe later fragment changes. A missing access token produced the same waiting message for a bare URL, a code/token-hash URL, a provider error or a reload after credentials had been cleared. The original arrival cannot be reconstructed from the cleaned address. No private email or original verification link was accessed.

## Exact Dashboard changes to apply together

Authentication ? URL Configuration:

- Site URL: `http://127.0.0.1:3100`
- Redirect URLs: add `http://127.0.0.1:3100/**`. The existing exact recovery callback may remain.

Authentication ? Email Templates (or Emails) ? Invite user:

Subject: `Activate your Designmela account`

```html
<h2>You are invited to Designmela</h2>
<p>Follow this link to confirm your invitation and choose your password.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite">Continue securely</a></p>
<p>If you did not expect this invitation, ignore this email.</p>
```

Use the complete template, not a bare SiteURL or activation URL. The token-hash flow does not require a browser PKCE verifier. Apply the root Site URL and template together: the old default ConfirmationURL without an explicit redirect would otherwise land on the root page, which is not the fragment handler. Prior setup reported that this project rejected custom templates with default email delivery; if the Dashboard refuses to save this template, report that provider limitation before resending. Do not assume template changes succeeded.

## Corrected local behavior

Both `/auth/confirm` and `/auth/activate` capture query token_hash/type, PKCE code or authentication fragment in memory, clear the address, and wait for Continue securely before verification. The server action uses verifyOtp for token hashes, exchangeCodeForSession for codes, and validates fragment sessions against hosted Auth before setting HTTP-only cookies. PKCE fails closed without the matching browser verifier. Invite/code success redirects to `/auth/activate` for password creation; ordinary recovery continues to `/reset-password`. A verified session can reload the activation page and still see password creation. A nonsecret temporary step parameter remounts the form after verification and is cleared from the address.

Diagnostics display only booleans for code, token_hash, type, authentication fragment and provider error. They are not stored or logged. Opening a link does not verify it automatically. Existing logging protections disable incoming request, Server Function argument and browser-console forwarding in Next development; no provider error bodies are printed. External infrastructure/browser extensions are outside this local logging guarantee.

## Resend decision

Local validation passed: production build, ESLint, 57 unit tests, 17 synthetic browser checks, configured-secret/source/public-asset scan and diff whitespace check. Browser checks used only a loopback Auth stub: zero hosted requests, zero hosted accounts created, and no bootstrap calls. Captured synthetic server output contained none of the test credential values. Hosted email delivery and the original private link were not tested.

After saving both settings and template, request a fresh invitation for the existing invited user through the Dashboard's available resend action, then use only the newest email. Do not delete or recreate the user. If the account is already confirmed, use password recovery for that same account instead; resending an invite may no longer be supported. No resend was performed by the agent. If saving the template or resending is refused, preserve the account and report the sanitized error.

References: https://supabase.com/docs/guides/auth/auth-email-templates and https://supabase.com/docs/guides/auth/redirect-urls.
