import 'server-only';
import { workspaceSession } from './session';
import { recordModule,recordValues,pageNumber } from './records';
import { uuidPattern } from './config';

export type StoredRecord = {id:string; [key:string]:string|number|boolean|null};
export async function listRecords(key:string,page:unknown) {
  const definition = recordModule(key);
  const {client,session} = await workspaceSession(definition.read);
  const start = (pageNumber(page)-1)*25;
  const {data,error} = await client.from(definition.table).select(['id',...definition.fields.map(f => f.key)].join(','))
    .eq('organization_id',session.organization_id).is('archived_at',null).order('created_at',{ascending:false}).order('id').range(start,start+24);
  if (error) throw new Error('Records could not be loaded. Check your connection and workspace setup.');
  return (data ?? []) as unknown as StoredRecord[];
}
export async function saveRecord(key:string,input:Record<string,unknown>,id?:string) {
  const definition = recordModule(key);
  const values = recordValues(key,input);
  if (id && !uuidPattern.test(id)) throw new Error('Invalid record ID.');
  const {client,session} = await workspaceSession(id ? definition.edit : definition.create);
  const query = id ? client.from(definition.table).update(values).eq('organization_id',session.organization_id).eq('id',id).is('archived_at',null)
    : client.from(definition.table).insert({...values,organization_id:session.organization_id,created_by:session.member_id,assigned_to:session.member_id});
  const {data,error} = await query.select('id').single();
  if (error || !data) throw new Error('Record was not saved. Check permissions and related records.');
}
export async function archiveRecord(key:string,id:string) {
  const definition = recordModule(key);
  if (!uuidPattern.test(id)) throw new Error('Invalid record ID.');
  const {client,session} = await workspaceSession(definition.archive);
  const {data,error} = await client.from(definition.table).update({archived_at:new Date().toISOString()})
    .eq('organization_id',session.organization_id).eq('id',id).is('archived_at',null).select('id').single();
  if (error || !data) throw new Error('Record was not archived. It may already be archived or access has changed.');
}
