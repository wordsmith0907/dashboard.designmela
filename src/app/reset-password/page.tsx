import { RuntimeBanner } from '@/components/connected/runtime-banner';
import { verifiedUser } from '@/lib/connected/session';
import { ResetPasswordForm } from '@/components/connected/auth-forms';
import { logout } from '@/app/login/actions';
export default async function ResetPassword() {
  await verifiedUser();
  return <main className="connected-page" id="main-content"><h1>Set your password</h1><RuntimeBanner/>
    <p>Choose your password here. Follow the sign-in instructions after saving.</p><ResetPasswordForm/>
    <form action={logout}><button className="btn">Sign out</button></form></main>;
}
