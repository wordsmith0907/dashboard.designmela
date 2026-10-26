import 'server-only';
import { redirect } from 'next/navigation';
import { serverClient } from '../supabase/server';
import { uuidPattern } from './config';
import { permissionKeys, type Permission, type WorkspaceSession } from './permissions';

export async function verifiedUser() {
  const client=await serverClient();
  let result;
  try { result=await client.auth.getUser(); }
  catch { redirect('/auth/unavailable'); }
  const {data,error}=result;
  if (error && (error.status===429 || (error.status ?? 0)>=500 || error.name==='AuthRetryableFetchError')) redirect('/auth/unavailable');
  if (error || !data.user) redirect('/login');
  if (!data.user.email_confirmed_at) redirect('/login');
  return {client,user:data.user};
}
export async function workspaceSession(required?:Permission) {
  const {client,user}=await verifiedUser();
  const org=process.env.DESIGNMELA_ORGANIZATION_ID;
  if (!org || !uuidPattern.test(org)) redirect('/access-pending');
  let result;
  try { result=await client.rpc('workspace_session',{org}); }
  catch { redirect('/auth/unavailable'); }
  const {data,error}=result;
  if (error) redirect('/auth/unavailable');
  if (!data) redirect('/access-pending');
  if (data.organization_id!==org || !uuidPattern.test(data.member_id) || !Array.isArray(data.permissions)) redirect('/auth/unavailable');
  const session:WorkspaceSession={organization_id:org,member_id:data.member_id,role:data.role,
    permissions:data.permissions.filter((p:Permission)=>permissionKeys.includes(p))};
  if (required && !session.permissions.includes(required)) redirect('/unauthorized');
  return {client,user,session};
}
