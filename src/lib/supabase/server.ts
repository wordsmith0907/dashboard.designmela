import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { connectedEnabled, publicConfig } from '../connected/config';

export async function serverClient() {
  if (!connectedEnabled(process.env)) throw new Error('Connected Mode is disabled.');
  const {url,key} = publicConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const jar = await cookies();
  return createServerClient(url,key, {cookies:{
    getAll: () => jar.getAll(),
    setAll: values => {
      try { values.forEach(({name,value,options}) => jar.set(name,value,options)); }
      catch { /* Server components cannot write cookies; the proxy refreshes them. */ }
    },
  }});
}
