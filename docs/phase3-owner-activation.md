> Superseded for invitation troubleshooting on 2026-10-26: see [current diagnosis and exact settings](phase3-invitation-diagnosis.md). Do not resend using the historical settings below.

# Development Owner activation

The local app uses `http://127.0.0.1:3100`. The development Supabase settings have been configured with the existing CLI management credential: email login enabled, public signup disabled, anonymous/social sign-ins disabled, email confirmation required, minimum password length 12 with character classes, and refresh-token rotation enabled. No service-role key was added.

The provider rejected custom email templates on this free project with default email delivery. Default templates remain unchanged. Their invitation redirects to `http://127.0.0.1:3100/auth/activate`. That page removes fragment credentials from browser history, holds them only in memory, and waits for the user's Continue securely click before server-side validation and HTTP-only session establishment. It does not use local storage or log link credentials.

## Personal steps

1. Open the Supabase invitation email on this computer and follow its activation link. Do not paste the email or link into chat.
2. Click **Continue securely** on the local activation page.
3. Personally enter and confirm your password, then click **Save password**. Use 12 or more characters including uppercase, lowercase, a number and a symbol.
4. The app automatically opens **Owner account verified** at `http://127.0.0.1:3100/setup`. Tell the agent **Owner account verified**.

The agent never accesses the inbox, follows the private verification link, or handles the password. For the matching initial Owner only, activation revokes other sessions and retains the current verified session. Ordinary recovery still revokes all sessions and requires a new login. Bootstrap authorization remains limited to the verified configured account and the one-time setup gate.

## Automation

`uv run --with "psycopg[binary]" python scripts/development-auth-admin.py --inspect` returns sanitized hosted settings. `--configure` applies and verifies only the listed development auth settings. `--invite-owner` refuses any existing Auth account and requests a single invitation to the configured Owner through the official Studio invitation endpoint, using the existing management PAT. It never prints the address or creates a service-role key. Invitation support for PAT authentication must be verified from the operation result; do not claim delivery before success.

After personal activation, run `scripts/bootstrap-initial-owner.py --check-only`, then `--apply-reviewed-bootstrap` with the same uv dependency. Only the previously reviewed SQL bootstrap function may be invoked. Restart the app with the resulting local organization configuration. Verify hosted workspace permissions, create/edit/archive a clearly labelled temporary lead, retain immutable audit history, and report archived fixture counts accurately. The user has explicitly approved reversible/archive-safe verification; no hard deletion is required or permitted by this workflow.

A final successful Phase 3 commit and push remain conditional on hosted verification. Never deploy, merge, enable social sign-in, add employees, or access a private verification link.
