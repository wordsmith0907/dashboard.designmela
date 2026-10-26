import Link from 'next/link';
import { bootstrapAllowed } from '@/lib/connected/config';
import { verifiedUser } from '@/lib/connected/session';
import { logout } from '@/app/login/actions';
export default async function Setup() {
  const {user}=await verifiedUser();
  const allowed=bootstrapAllowed(user,process.env.INITIAL_OWNER_EMAIL,process.env.INITIAL_OWNER_BOOTSTRAP_ENABLED);
  return <main className="connected-page" id="main-content"><h1>Development workspace setup</h1><p>Connected Mode · Development</p>
    {allowed ? <><h2>Owner account verified</h2><p>Your signed-in, verified account matches the configured initial Owner. The one-time administrator bootstrap can now be completed. No workspace has been created by opening this page.</p></> :
      <p>Initial Owner setup is unavailable for this session. Contact the workspace administrator.</p>}
    <Link href="/">Continue to workspace</Link><form action={logout}><button className="btn">Sign out</button></form></main>;
}
