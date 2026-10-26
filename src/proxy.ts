import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { serverConfig } from './lib/server-config';
import { authCookieOptions } from './lib/auth/policy';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({request});
  response.headers.set('Cache-Control','private, no-store');
  try {
    const config = serverConfig();
    if (config.mode !== 'connected') return response;
    const {url,key} = config.supabase;
    const client = createServerClient(url,key,{cookieOptions:authCookieOptions(config.origin),cookies:{
      getAll:() => request.cookies.getAll(),
      setAll: (values,headers) => {
        values.forEach(({name,value}) => request.cookies.set(name,value));
        response = NextResponse.next({request});
        values.forEach(({name,value,options}) => response.cookies.set(name,value,options));
        Object.entries(headers).forEach(([name,value]) => response.headers.set(name,value));
        response.headers.set('Cache-Control','private, no-store');
      },
    }});
    await client.auth.getClaims();
  } catch { /* Protected pages/actions independently fail closed, with sanitized errors. */ }
  return response;
}
export const config = {matcher:['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
