// Preload for local auth-gate tests only. Supabase SDK uses fetch; prevent any
// accidental external request even if Next inlines public values at build time.
const originalFetch = globalThis.fetch;
globalThis.fetch = function(input,options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) {
    process.send?.('external-fetch-blocked');
    throw new Error('External network is disabled during local authorization tests.');
  }
  return originalFetch(input,options);
};
