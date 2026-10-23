# Vercel setup — future, after explicit approval

1. Review this local feature branch (`designmela-crm-v2`). Do not merge or push until the owner approves.
2. After approval, put the reviewed source in the intended Git repository. Do not commit `.env.local` or real credentials. The lockfile should be committed for repeatable installs.
3. In Vercel choose Add New → Project and import that repository. Select Next.js. Use the repository root, `npm ci` for install and `npm run build` for build. Keep the default Next.js output setting. Choose a Node version compatible with the lockfile (tested locally with Node 24).
4. A demo preview needs no environment variables. Enable deployment access protection appropriate to the account before sharing a private preview. The app itself currently has no authentication; do not assume an unlisted URL is private.
5. Create a preview only after deployment approval. Check every route and browser workflow. Reloading resets demo changes by design, including on Vercel.
6. Production requires separate explicit approval and the authentication/backend work described in README before real client use.

Future Supabase public URL/publishable key belong in the correct Preview/Production environment. Server secrets belong only in protected server environment variables. Setting them today does not activate an integration. Never paste a service-role key into browser code, Git, build output or a NEXT_PUBLIC variable.

No Vercel account was accessed and no hosting service was connected for this task. Vercel setup is a manual future checklist, not a claim of verified deployment.

Production Auth, organization isolation and database requirements are specified in [database-security.md](database-security.md). Local supabase/config.toml does not configure the hosted project. Review the development dependency exception before deployment.
