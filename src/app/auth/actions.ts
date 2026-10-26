'use server';
import { redirect } from 'next/navigation';
import { serverClient } from '@/lib/supabase/server';
import { bootstrapAllowed } from '@/lib/connected/config';
import { appOrigin, authFailure, confirmationType, passwordGuidance, safeNext, validEmail, validNewPassword, validTokenHash, type AuthResult } from '@/lib/auth/policy';

export async function requestReset(_previous:AuthResult, form:FormData):Promise<AuthResult> {
  const email = String(form.get('email') ?? '').trim();
  if (!validEmail(email)) return {message:'Enter a valid email address.'};
  try {
    const client = await serverClient();
    const {error} = await client.auth.resetPasswordForEmail(email, {
      redirectTo:`${appOrigin(process.env.DESIGNMELA_APP_ORIGIN)}/auth/callback?next=/reset-password`,
    });
    if (error?.status === 429 || error?.code === 'over_email_send_rate_limit') return authFailure(error);
    if (error && (!error.status || error.status >= 500)) return {message:'Email delivery is unavailable. Please wait before trying again.',retryAfter:60};
  } catch { return {message:'Email delivery is unavailable. Please wait before trying again.',retryAfter:60}; }
  return {message:'If this address has an account, a password reset email has been requested. Check your inbox and spam folder.',success:true,retryAfter:60};
}
export async function confirmEmail(_previous:AuthResult,form:FormData):Promise<AuthResult> {
  const type = confirmationType(form.get('type'));
  const token_hash = form.get('token_hash');
  const code = String(form.get('code') ?? '');
  if (code ? !/^[A-Za-z0-9_-]{16,512}$/.test(code) : !type || !validTokenHash(token_hash)) return {message:'This link is invalid. Request a new link or contact your administrator.'};
  try {
    const client = await serverClient();
    const {data,error} = code ? await client.auth.exchangeCodeForSession(code) : await client.auth.verifyOtp({type:type!,token_hash:token_hash as string});
    if (error) return error.status === 429 ? authFailure(error) : {message:'This link has expired or was already used. Request a new link or contact your administrator.'};
    if (!data.user?.email_confirmed_at) return {message:'Email verification could not be confirmed.'};
  } catch { return {message:'Verification is unavailable. Please try again shortly.'}; }
  redirect(type === 'recovery' ? '/reset-password' : code || type === 'invite' ? '/auth/activate?step=password' : safeNext(form.get('next')));
}
/** Accept the default hosted invitation's fragment only after a personal click. */
export async function activateSession(_previous:AuthResult,form:FormData):Promise<AuthResult> {
  const access_token=String(form.get('access_token') ?? '');
  const refresh_token=String(form.get('refresh_token') ?? '');
  if (!['invite','recovery'].includes(String(form.get('type'))) ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(access_token) || access_token.length>16384 ||
      !/^[A-Za-z0-9_-]{16,512}$/.test(refresh_token)) return {message:'This activation link is invalid or expired. Request a new invitation or reset email.'};
  try {
    const client=await serverClient();
    // Validate with Auth before allowing the incoming credentials into SSR cookies.
    const verified=await client.auth.getUser(access_token);
    if (verified.error || !verified.data.user?.email_confirmed_at) return {message:'This activation link is invalid or expired. Request a new invitation or reset email.'};
    const {data,error}=await client.auth.setSession({access_token,refresh_token});
    if (error || !data.user?.email_confirmed_at || data.user.id!==verified.data.user.id) {
      await client.auth.signOut({scope:'local'});
      return {message:'Activation could not be completed. Request a new invitation or reset email.'};
    }
  } catch { return {message:'Activation is temporarily unavailable. Please try again shortly.'}; }
  redirect(form.get('type') === 'recovery' ? '/reset-password' : '/auth/activate?step=password');
}
export async function updatePassword(_previous:AuthResult,form:FormData):Promise<AuthResult> {
  let initialOwner = false;
  const password = String(form.get('password') ?? '');
  if (!validNewPassword(password)) return {message:passwordGuidance};
  if (password !== form.get('confirmPassword')) return {message:'The two passwords must match.'};
  try {
    const client = await serverClient();
    const {data,error} = await client.auth.getUser();
    if (error || !data.user?.email_confirmed_at) return {message:'Your verified session has expired. Open a new invitation or reset link.'};
    initialOwner = bootstrapAllowed(data.user,process.env.INITIAL_OWNER_EMAIL,process.env.INITIAL_OWNER_BOOTSTRAP_ENABLED);
    const result = await client.auth.updateUser({password});
    if (result.error) {
      if (result.error.status === 429) return authFailure(result.error);
      return {message:'The password could not be saved. Choose a new password meeting the requirements, or request a fresh link.'};
    }
    // Keep only the verified initial Owner's current activation session. Normal
    // password recovery still revokes every session and requires a fresh login.
    const signout = await client.auth.signOut({scope:initialOwner ? 'others' : 'global'});
    if (signout.error) return {message:'Password saved, but session revocation could not finish. Use Sign out, then sign in again.',success:true};
  } catch { return {message:'The authentication service is unavailable. Please try again shortly.'}; }
  redirect(initialOwner ? '/setup' : '/login?status=password-updated');
}
