import Link from 'next/link';
import { DataRoot } from '@/components/data-context';
import { Shell } from '@/components/shell';
import { serverConfig } from '@/lib/server-config';
import { RuntimeBanner } from '@/components/connected/runtime-banner';
import { workspaceSession } from '@/lib/connected/session';
import { routes,canAccessRoute } from '@/lib/connected/permissions';
import { logout } from '@/app/login/actions';
import { OfflineNotice } from '@/components/connected/offline';

export default async function WorkspaceLayout({children}:{children:React.ReactNode}) {
  let connected:boolean;
  try { connected = serverConfig().mode === 'connected'; }
  catch { return <main className="connected-page"><h1>Connection Error</h1><p>Workspace configuration is unavailable. Contact the administrator.</p></main>; }
  if (!connected) return <DataRoot><Shell>{children}</Shell></DataRoot>;
  const {session} = await workspaceSession();
  return <div className="connected-page"><header><strong>Designmela</strong><RuntimeBanner/>
    <nav className="tabs">{routes.filter(r => canAccessRoute(session,r.path)).map(r => <Link className="btn" key={r.path} href={r.path}>{r.label}</Link>)}</nav>
    <form action={logout}><button className="btn">Sign out</button></form></header>
    <OfflineNotice /><main id="main-content">{children}</main></div>;
}
