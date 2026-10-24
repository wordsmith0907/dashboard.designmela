import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { connectedEnabled, publicConfig } from '../connected/config';

/** Never used for business CRUD or ordinary authorization. */
export function bootstrapClient() {
  if (!connectedEnabled(process.env) || process.env.INITIAL_OWNER_BOOTSTRAP_ENABLED !== 'true') throw new Error('Bootstrap is disabled.');
  const {url} = publicConfig(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Server bootstrap credential is missing.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
