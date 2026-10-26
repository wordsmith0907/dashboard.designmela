import Link from 'next/link';
import { RuntimeBanner } from '@/components/connected/runtime-banner';
import { connectedEnabled } from '@/lib/connected/config';
import { ForgotPasswordForm } from '@/components/connected/auth-forms';
export default function ForgotPassword() {
  const enabled=connectedEnabled(process.env);
  return <main className="connected-page" id="main-content"><h1>Forgot password</h1>{enabled ? <RuntimeBanner/> : <p>Connected Mode is disabled</p>}
    {enabled && <><p>Request a reset link for your existing account.</p><ForgotPasswordForm/></>}
    <Link href="/login">Back to sign in</Link></main>;
}
