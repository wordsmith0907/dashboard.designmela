import Link from 'next/link';
import { logout } from '@/app/login/actions';
export default function Unavailable() {
  return <main className="connected-page" id="main-content"><h1>Workspace temporarily unavailable</h1>
    <p>Authentication or workspace data could not be verified. Wait a moment, then try again.</p>
    <Link href="/">Try workspace again</Link><form action={logout}><button className="btn">Sign out</button></form></main>;
}
