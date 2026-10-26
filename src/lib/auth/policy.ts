import { routes } from '../connected/permissions';

const destinations = new Set([...routes.map(route => route.path), '/setup', '/auth/activate', '/reset-password', '/access-pending']);
/** Exact application paths only: no origins, query strings, encoded paths or redirect chains. */
export function safeNext(value: unknown, fallback = '/') {
  return typeof value === 'string' && destinations.has(value) ? value : fallback;
}
export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
export function validNewPassword(value: string) {
  return value.length >= 12 && value.length <= 256 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9\s]/.test(value);
}
export const passwordGuidance = 'Use at least 12 characters, including uppercase and lowercase letters, a number and a symbol.';
export function authCookieOptions(origin: string) {
  return { path: '/', sameSite: 'lax' as const, httpOnly: true, secure: new URL(origin).protocol === 'https:' };
}
export type AuthResult = { message: string; success?: boolean; retryAfter?: number };
export function authFailure(error: {status?: number; code?: string} | null | undefined): AuthResult {
  if (error?.status === 429 || ['over_request_rate_limit', 'over_email_send_rate_limit'].includes(error?.code ?? '')) {
    return {message:'Too many attempts. Wait at least a minute before trying again.', retryAfter:60};
  }
  if (error?.code === 'email_not_confirmed') return {message:'Verify your email using the invitation or confirmation link before signing in.'};
  if (error?.code === 'invalid_credentials') return {message:'The email or password was not accepted. Check your details or use Forgot password to reset access to the existing account.'};
  if (error && (!error.status || error.status >= 500)) return {message:'The authentication service is unavailable. Please try again shortly.'};
  return {message:'Unable to sign in. Check your details and connection, then try again.'};
}
export function confirmationType(value: unknown): 'invite' | 'recovery' | 'email' | 'signup' | null {
  return value === 'invite' || value === 'recovery' || value === 'email' || value === 'signup' ? value : null;
}
export function validTokenHash(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(value);
}
