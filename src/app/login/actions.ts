'use server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { serverClient } from '@/lib/supabase/server';
import { safeNext, validEmail, authFailure, type AuthResult } from '@/lib/auth/policy';

export async function login(_previous:AuthResult,form:FormData):Promise<AuthResult> {
  const email=String(form.get('email') ?? '').trim();
  const password=String(form.get('password') ?? '');
  // Creation rules belong to password updates; Auth verifies existing credentials.
  if (!validEmail(email) || !password || password.length>256) return {message:'Enter your email address and password.'};
  try {
    const client=await serverClient();
    const {data,error}=await client.auth.signInWithPassword({email,password});
    if (error) return authFailure(error);
    if (!data.user?.email_confirmed_at) {
      await client.auth.signOut({scope:'local'});
      return {message:'Email verification is required before opening this workspace.'};
    }
  } catch { return {message:'The authentication service is unavailable. Please try again shortly.'}; }
  redirect(safeNext(form.get('next')));
}
export async function logout() {
  let revoked=false;
  try { const client=await serverClient(); revoked=!(await client.auth.signOut({scope:'local'})).error; }
  catch { /* Always remove this browser's cookies during a provider outage. */ }
  const jar=await cookies();
  // Clear this host's Supabase auth/verifier chunks even if configuration broke.
  for (const {name} of jar.getAll()) if (/^sb-[a-z0-9-]+-auth-token(?:[.-].*)?$/.test(name)) jar.delete(name);
  redirect(revoked ? '/login?status=signed-out' : '/login?status=local-signout');
}
