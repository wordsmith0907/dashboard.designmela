import 'server-only';
import { redirect } from 'next/navigation';
import { serverClient } from '../supabase/server';
import { uuidPattern } from './config';
import { permissionKeys, type Permission, type WorkspaceSession } from './permissions';

export async function verifiedUser() {
  const client = await serverClient();
  const {data,error} = await client.auth.getUser();
  if (error || !data.user) redirect('/login');
  if (!data.user.email_confirmed_at) throw new Error('Verify your email before opening this workspace.');
  return {client,user:data.user};
}

export async function workspaceSession(required?: Permission) {
  const {client,user} = await verifiedUser();
  const org = process.env.DESIGNMELA_ORGANIZATION_ID;
  if (!org || !uuidPattern.test(org)) throw new Error('Workspace configuration is incomplete. An administrator must finish setup.');
  const {data,error} = await client.rpc('workspace_session',{org});
  if (error || !data || data.organization_id !== org || !uuidPattern.test(data.member_id) || !Array.isArray(data.permissions)) {
    throw new Error('Workspace access is unavailable. Check active membership and database setup.');
  }
  const session: WorkspaceSession = {organization_id:org,member_id:data.member_id,role:data.role,
    permissions:data.permissions.filter((p: Permission) => permissionKeys.includes(p))};
  if (required && !session.permissions.includes(required)) throw new Error('You do not have permission for this action.');
  return {client,user,session};
}
