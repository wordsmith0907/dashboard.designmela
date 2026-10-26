import Link from 'next/link';
export default function LinkError() {
  return <main className="connected-page" id="main-content"><h1>Email link unavailable</h1><p>The link may have expired, already been used, or been opened in a different browser. Request a new link and open it in the browser where you started.</p>
    <Link href="/forgot-password">Request a password reset</Link><p><Link href="/login">Back to sign in</Link></p></main>;
}
