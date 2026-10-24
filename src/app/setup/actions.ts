'use server';
import { redirect } from 'next/navigation';
import { verifiedUser } from '@/lib/connected/session';
import { bootstrapAllowed } from '@/lib/connected/config';
import { bootstrapClient } from '@/lib/supabase/bootstrap-client';

export async function bootstrap(form: FormData) {
  const {user} = await verifiedUser();
  if (!bootstrapAllowed(user,process.env.INITIAL_OWNER_EMAIL,process.env.INITIAL_OWNER_BOOTSTRAP_ENABLED) || form.get('confirm') !== 'yes') throw new Error('Bootstrap is not authorized.');
  const name = String(form.get('name') ?? '').trim();
  if (name.length < 2 || name.length > 100) throw new Error('Workspace name must contain 2–100 characters.');
  const client = bootstrapClient();
  const {error} = await client.rpc('bootstrap_first_owner',{verified_user:user.id,expected_email:process.env.INITIAL_OWNER_EMAIL!.trim(),workspace_name:name});
  if (error) throw new Error('Bootstrap could not complete. No partial workspace was saved. Ask the administrator to review setup.');
  redirect('/setup?complete=true');
}
