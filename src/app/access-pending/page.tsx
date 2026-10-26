import { connectedConfig } from '@/lib/server-config';
import { RuntimeBanner } from '@/components/connected/runtime-banner';
import Link from 'next/link';
import { verifiedUser } from '@/lib/connected/session';
import { bootstrapAllowed } from '@/lib/connected/config';
import { logout } from '@/app/login/actions';
export default async function AccessPending() {
  const {user}=await verifiedUser();
  const owner=connectedConfig().bootstrapEnabled && bootstrapAllowed(user,process.env.INITIAL_OWNER_EMAIL,process.env.INITIAL_OWNER_BOOTSTRAP_ENABLED);
  return <main className="connected-page" id="main-content"><h1>Access pending</h1><RuntimeBanner/>
    <p>You are signed in, but an active workspace membership is not available. Contact the workspace administrator.</p>
    {owner && <p><Link href="/setup">Initial Owner setup status</Link></p>}
    <Link href="/">Check access again</Link><form action={logout}><button className="btn">Sign out</button></form></main>;
}
