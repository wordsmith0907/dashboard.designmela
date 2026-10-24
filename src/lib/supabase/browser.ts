'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicConfig } from '../connected/config';

export function browserClient() {
  const {url,key} = publicConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return createBrowserClient(url, key);
}
