// Preload for local auth-gate tests only. Supabase SDK uses fetch; prevent any
// accidental external request even if Next inlines public values at build time.
const originalFetch = globalThis.fetch;
globalThis.fetch = function(input,options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  // Production builds can inline NEXT_PUBLIC values. In synthetic Auth tests,
  // route those requests to the loopback stub before any network operation.
  if (url.hostname.endsWith('.supabase.co') && process.env.TEST_AUTH_ORIGIN) {
    const stub = new URL(process.env.TEST_AUTH_ORIGIN);
    if (stub.hostname !== '127.0.0.1' || stub.protocol !== 'http:') throw new Error('Loopback test origin required');
    url.protocol = stub.protocol;
    url.host = stub.host;
    const headers = new Headers(options?.headers ?? (typeof input === 'object' && !(input instanceof URL) ? input.headers : undefined));
    // Never forward build-time provider keys to the test recorder.
    headers.set('apikey','sb_publishable_local_test_fixture');
    headers.delete('authorization');
    process.send?.('auth-fetch-localized');
    return originalFetch(url,{...options,headers});
  }
  if (!['127.0.0.1','localhost','[::1]'].includes(url.hostname)) {
    process.send?.('external-fetch-blocked');
    throw new Error('External network is disabled during local authorization tests.');
  }
  return originalFetch(input,options);
};
