import { applicationMode } from './application-mode';

export type RuntimeEnvironment = 'development' | 'test' | 'preview' | 'production';
export type Environment = Record<string, string | undefined>;
export const productionOrigin = 'https://dashboard.designmela.com';
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(): never { throw new Error('Workspace configuration is missing or invalid.'); }

/** Pure validation for server callers and tests. Never return the input environment. */
export function validatedOrigin(value: string | undefined, allowLocal = false): string {
  try {
    if (!value || value !== value.trim() || /[\\\s]/.test(value)) return invalid();
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        (url.protocol !== 'https:' && !(allowLocal && local && url.protocol === 'http:')) ||
        (!allowLocal && (local || !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname)))) return invalid();
    return url.origin;
  } catch { return invalid(); }
}

export function publicConfig(url: string | undefined, key: string | undefined, allowLocal = false) {
  const origin = validatedOrigin(url, allowLocal);
  if (!key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return invalid();
  return { url: origin, key };
}

function runtimeEnvironment(env: Environment): RuntimeEnvironment {
  const declared = env.DESIGNMELA_ENV;
  const platform = env.VERCEL_ENV;
  const known = ['development', 'test', 'preview', 'production'];
  if ((declared && !known.includes(declared)) ||
      (platform && !['development', 'preview', 'production'].includes(platform))) return invalid();
  if (platform && declared && platform !== declared) return invalid();
  if (env.VERCEL === '1' && !platform) return invalid();
  const result = platform || declared || (env.NODE_ENV === 'production' ? 'production' : undefined);
  if (!result) return invalid();
  return result as RuntimeEnvironment;
}

function previewOrigin(env: Environment): string {
  const platformOrigins = [env.VERCEL_BRANCH_URL, env.VERCEL_URL].filter(Boolean).map(host => {
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/i.test(host!)) return invalid();
    return validatedOrigin(`https://${host}`);
  });
  const configured = env.NEXT_PUBLIC_APP_URL;
  const origin = configured ? validatedOrigin(configured) : platformOrigins[0];
  if (!origin || origin === productionOrigin || !new URL(origin).hostname.endsWith('.vercel.app')) return invalid();
  // On Vercel, explicit URLs must belong to this deployment or its branch alias.
  if (env.VERCEL_ENV && !platformOrigins.includes(origin)) return invalid();
  return origin;
}

export function resolveRuntimeConfig(env: Environment) {
  const environment = runtimeEnvironment(env);
  const hosted = environment === 'preview' || environment === 'production';
  const mode = applicationMode(env.DESIGNMELA_MODE);
  if (mode === 'demo') {
    if (hosted || env.VERCEL === '1' || env.VERCEL_ENV || !['development', 'test'].includes(env.NODE_ENV ?? '')) return invalid();
    return { mode, environment, label: 'Demo Mode' } as const;
  }
  if (env.INITIAL_OWNER_BOOTSTRAP_ENABLED && !['true', 'false'].includes(env.INITIAL_OWNER_BOOTSTRAP_ENABLED)) return invalid();
  if (hosted && env.INITIAL_OWNER_BOOTSTRAP_ENABLED !== 'false') return invalid();
  if (environment === 'production' && env.SUPABASE_DEV_PROJECT_CONFIRMED === 'true') return invalid();
  if (environment !== 'production' && env.SUPABASE_DEV_PROJECT_CONFIRMED !== 'true') return invalid();
  let origin: string;
  if (environment === 'preview') origin = previewOrigin(env);
  else {
    // Legacy origin is local-only compatibility, never a hosted fallback.
    const value = env.NEXT_PUBLIC_APP_URL || (!hosted ? env.DESIGNMELA_APP_ORIGIN : undefined);
    origin = validatedOrigin(value, !hosted);
    if (environment === 'production' && origin !== productionOrigin) return invalid();
    if (!hosted && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname)) return invalid();
  }
  const supabase = publicConfig(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, !hosted);
  const organizationId = env.DESIGNMELA_ORGANIZATION_ID;
  // Initial local activation may precede the one-time organization bootstrap.
  const bootstrapEnabled = !hosted && env.INITIAL_OWNER_BOOTSTRAP_ENABLED === 'true';
  if ((!organizationId && !bootstrapEnabled) || (organizationId && !uuidPattern.test(organizationId))) return invalid();
  return { mode, environment, origin, supabase, organizationId, bootstrapEnabled,
    label: environment === 'production' ? null : environment === 'preview' ? 'Preview' : 'Development' } as const;
}

export type RuntimeConfig = ReturnType<typeof resolveRuntimeConfig>;
export type ConnectedConfig = Extract<RuntimeConfig, {mode: 'connected'}>;
export function authUrls(config: ConnectedConfig) {
  return {
    invitation: `${config.origin}/auth/activate`,
    confirmation: `${config.origin}/auth/confirm`,
    recovery: `${config.origin}/auth/callback?next=/reset-password`,
    linkError: `${config.origin}/auth/link-error`,
  };
}
