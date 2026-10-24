import { applicationMode } from '../application-mode';

export function connectedEnabled(env: Record<string, string | undefined>): boolean {
  if (applicationMode(env.DESIGNMELA_MODE) === 'demo') return false;
  if (env.DESIGNMELA_ENV !== 'development' || env.SUPABASE_DEV_PROJECT_CONFIRMED !== 'true') {
    throw new Error('Connected Mode requires an explicitly confirmed development environment.');
  }
  return true;
}

export function publicConfig(url: string | undefined, key: string | undefined) {
  if (!url || !key) throw new Error('Public Supabase configuration is missing.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) throw new Error('HTTPS is required.');
  // Only the new publishable key format is accepted. A privileged JWT cannot be substituted.
  if (!key.startsWith('sb_publishable_')) throw new Error('A Supabase publishable key is required.');
  return { url, key };
}

export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bootstrapAllowed(user: { email?: string; email_confirmed_at?: string }, expected: string | undefined, enabled: string | undefined) {
  return enabled === 'true' && !!expected?.trim() && !!user.email_confirmed_at &&
    user.email?.trim().toLowerCase() === expected.trim().toLowerCase();
}
