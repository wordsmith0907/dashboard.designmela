import Link from 'next/link';
import { verifiedUser } from '@/lib/connected/session';
export default async function Unauthorized() {
  await verifiedUser();
  return <main className="connected-page" id="main-content"><h1>Access not permitted</h1><p>Your current membership does not permit this action.</p><Link href="/">Return to workspace</Link></main>;
}
