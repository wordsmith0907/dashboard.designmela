import Link from 'next/link';
import { RuntimeBanner } from '@/components/connected/runtime-banner';
import { connectedEnabled } from '@/lib/connected/config';
import { safeNext } from '@/lib/auth/policy';
import { LoginForm } from '@/components/connected/auth-forms';
export default async function Login({searchParams}:{searchParams:Promise<{next?:string;status?:string}>}) {
  let enabled=false;
  let invalid=false;
  try { enabled=connectedEnabled(process.env); } catch { invalid=true; }
  const {next,status}=await searchParams;
  return <main className="connected-page" id="main-content"><h1>Designmela · Sign in</h1>
    {enabled ? <RuntimeBanner/> : <p>{invalid ? 'Workspace configuration error' : 'Connected Mode is disabled'}</p>}
    {status==='signed-out' && <p role="status">You are signed out.</p>}
    {status==='password-updated' && <p role="status">Password saved. Sign in with your new password.</p>}
    {status==='local-signout' && <p role="status">Signed out on this browser. Server session revocation could not be confirmed.</p>}
    {enabled ? <><LoginForm next={safeNext(next)}/><p><Link href="/forgot-password">Forgot password?</Link></p>
      <p>Access is by invitation. Email verification is required. There is no public registration.</p></> :
      <p>The workspace must be configured before sign in is available. <Link href="/">Return to workspace</Link></p>}
  </main>;
}
