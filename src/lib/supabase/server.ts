import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { connectedConfig } from '../server-config';
import { authCookieOptions } from '../auth/policy';

export async function serverClient() {
  const config = connectedConfig();
  const {url,key} = config.supabase;
  const jar = await cookies();
  return createServerClient(url,key, {cookieOptions:authCookieOptions(config.origin),cookies:{
    getAll: () => jar.getAll(),
    setAll: values => {
      try { values.forEach(({name,value,options}) => jar.set(name,value,options)); }
      catch { /* Server components cannot write cookies; the proxy refreshes them. */ }
    },
  }});
}
