import { NextRequest, NextResponse } from 'next/server';
import { connectedConfig } from '@/lib/server-config';
import { serverClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth/policy';
export async function GET(request:NextRequest) {
  let origin: string;
  try { origin = connectedConfig().origin; }
  catch { return new NextResponse('Authentication is unavailable.', {status:503,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}}); }
  const code=request.nextUrl.searchParams.get('code');
  let path='/auth/link-error';
  if (code && /^[A-Za-z0-9_-]{16,512}$/.test(code)) {
    try {
      const client=await serverClient();
      const {data,error}=await client.auth.exchangeCodeForSession(code);
      if (!error && data.user?.email_confirmed_at) path=safeNext(request.nextUrl.searchParams.get('next'));
    } catch { /* No tokens, query strings or provider errors are logged. */ }
  }
  return NextResponse.redirect(new URL(path,origin),{status:303,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
}
