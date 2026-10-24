'use server';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';

export async function login(form: FormData) {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  let success = false;
  if (email.length <= 254 && password.length >= 12 && password.length <= 256) {
    try { const client = await serverClient(); const {error} = await client.auth.signInWithPassword({email,password}); success = !error; }
    catch { /* Never log passwords, tokens or raw provider responses. */ }
  }
  redirect(success ? '/' : '/login?error=login');
}
export async function logout() {
  const client = await serverClient();
  const {error} = await client.auth.signOut({scope:'local'});
  if (error) throw new Error('Sign out could not finish. Please retry.');
  redirect('/login');
}
