import { ActivationForm } from '@/components/connected/auth-forms';
import { serverClient } from '@/lib/supabase/server';
export default async function Activate({searchParams}:{searchParams:Promise<{step?:string}>}) {
  const passwordStep=(await searchParams).step==='password';
  let verified = false;
  try {
    const client = await serverClient();
    const {data,error} = await client.auth.getUser();
    verified = !error && !!data.user?.email_confirmed_at;
  } catch { /* Fail closed; never log provider responses or credentials. */ }
  return <main className="connected-page" id="main-content"><h1>Activate your account</h1><p>Connected Mode · Development</p><ActivationForm key={String(passwordStep)} verified={verified}/></main>;
}
