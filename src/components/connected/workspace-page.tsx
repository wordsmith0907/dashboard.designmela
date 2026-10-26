import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connectedEnabled } from '@/lib/connected/config';
import { workspaceSession } from '@/lib/connected/session';
import { canAccessRoute,routes } from '@/lib/connected/permissions';
import { listRecords } from '@/lib/connected/repository';
import { recordModule,pageNumber } from '@/lib/connected/records';
import { RecordForm,ArchiveForm } from './record-form';

const routeModules:Record<string,string[]> = {'/crm':['leads'],'/clients':['clients'],'/projects':['projects'],'/tasks':['tasks'],'/sales':['quotes','proposals','payments']};
export async function WorkspacePage({path,demo,searchParams}:{path:string;demo:React.ReactNode;searchParams:Promise<{page?:string}>}) {
  if (!connectedEnabled(process.env)) return demo;
  const {session} = await workspaceSession();
  if (!canAccessRoute(session,path)) notFound();
  const keys = routeModules[path];
  const page = pageNumber((await searchParams).page);
  return <><h1>{routes.find(r => r.path === path)?.label}</h1>
    {!keys && <p>{path === '/' ? 'Your workspace is connected. Open a module to view your permitted records.' : 'Connected functionality for this module is not available yet. No demo records are displayed.'}</p>}
    {keys && <p>Basic records, edits and archival. Advanced workflows remain unavailable.</p>}
    {keys && await Promise.all(keys.map(async key => {
      const definition = recordModule(key);
      const records = await listRecords(key,page);
      return <section key={key} className="connected-section"><h2>{definition.label}</h2>
        {session.permissions.includes(definition.create) && <details><summary>Create {definition.label.toLowerCase()}</summary><RecordForm moduleKey={key} /></details>}
        {!records.length && <p>No accessible records on this page.</p>}
        {records.map(record => <article key={record.id} className="connected-record"><h3>{String(record.name ?? record.title)}</h3><small>Record ID: {record.id}</small>
          <dl>{definition.fields.map(f => <div key={f.key}><dt>{f.label}</dt><dd>{String(record[f.key] ?? '—')}</dd></div>)}</dl>
          {session.permissions.includes(definition.edit) && <details><summary>Edit record</summary><RecordForm moduleKey={key} record={record} /></details>}
          {session.permissions.includes(definition.archive) && <details><summary>Archive</summary><p>This keeps related records and history intact.</p><ArchiveForm moduleKey={key} id={record.id} /></details>}
        </article>)}
      </section>;
    }))}
    {keys && <nav aria-label="Record pages">{page > 1 && <Link href={`${path}?page=${page-1}`}>Previous page</Link>} <span>Page {page}</span> <Link href={`${path}?page=${page+1}`}>Next page</Link></nav>}
  </>;
}
