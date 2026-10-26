import { verifiedUser } from '@/lib/connected/session';
import { ResetPasswordForm } from '@/components/connected/auth-forms';
import { logout } from '@/app/login/actions';
export default async function ResetPassword() {
  await verifiedUser();
  return <main className="connected-page" id="main-content"><h1>Set your password</h1><p>Connected Mode · Development</p>
    <p>Choose your password here. Initial Owner activation continues automatically after saving. Other password resets require a fresh sign-in.</p><ResetPasswordForm/>
    <form action={logout}><button className="btn">Sign out</button></form></main>;
}
