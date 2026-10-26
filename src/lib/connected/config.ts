import { resolveRuntimeConfig } from '../runtime-config';
export { publicConfig, uuidPattern } from '../runtime-config';

export function connectedEnabled(env: Record<string, string | undefined>): boolean {
  return resolveRuntimeConfig(env).mode === 'connected';
}

export function bootstrapAllowed(user: { email?: string; email_confirmed_at?: string }, expected: string | undefined, enabled: string | undefined) {
  return enabled === 'true' && !!expected?.trim() && !!user.email_confirmed_at &&
    user.email?.trim().toLowerCase() === expected.trim().toLowerCase();
}
