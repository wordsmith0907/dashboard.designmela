import Link from "next/link";
import { connectedEnabled } from '@/lib/connected/config';
import { login } from './actions';

export default async function Login({searchParams}:{searchParams:Promise<{error?:string}>}) {
  let enabled = false;
  try { enabled = connectedEnabled(process.env); } catch {}
  const {error} = await searchParams;
  return <main className="connected-page"><h1>Designmela · Sign in</h1><p>{enabled ? 'Connected Mode · Development' : 'Connected Mode is disabled'}</p>
    {enabled ? <form action={login} className="connected-form">
      {error && <p role="alert">Sign in failed. Check your details, verification status and connection.</p>}
      <label>Email<input name="email" type="email" autoComplete="username" maxLength={254} required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" minLength={12} maxLength={256} required /></label>
      <button className="btn primary" type="submit">Sign in</button><p>Access is by invitation. Email verification is required.</p>
    </form> : <p>The development workspace must be configured before sign in is available. <Link href="/">Return to workspace</Link></p>}
  </main>;
}
