import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { connectedEnabled, publicConfig } from './lib/connected/config';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({request});
  response.headers.set('Cache-Control','private, no-store');
  try {
    if (!connectedEnabled(process.env)) return response;
    const {url,key} = publicConfig(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const client = createServerClient(url,key,{cookies:{
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
