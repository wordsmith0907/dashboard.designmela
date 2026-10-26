import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { connectedEnabled, publicConfig } from '../connected/config';
import { appOrigin, authCookieOptions } from '../auth/policy';

export async function serverClient() {
  if (!connectedEnabled(process.env)) throw new Error('Connected Mode is disabled.');
  // This client and its session cookies remain server-only.
  const env = process.env;
  const {url,key} = publicConfig(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const jar = await cookies();
  return createServerClient(url,key, {cookieOptions:authCookieOptions(appOrigin(process.env.DESIGNMELA_APP_ORIGIN)),cookies:{
    getAll: () => jar.getAll(),
    setAll: values => {
      try { values.forEach(({name,value,options}) => jar.set(name,value,options)); }
      catch { /* Server components cannot write cookies; the proxy refreshes them. */ }
    },
  }});
}
