'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { login } from '@/app/login/actions';
import { requestReset, updatePassword, confirmEmail, activateSession } from '@/app/auth/actions';
import { passwordGuidance, type AuthResult } from '@/lib/auth/policy';

function useAuthForm(action:(previous:AuthResult,form:FormData)=>Promise<AuthResult>) {
  const [state,submit,pending] = useActionState(action,{message:''});
  const [seconds,setSeconds] = useState(0);
  useEffect(() => {
    if (!state.retryAfter) return;
    const until = Date.now()+state.retryAfter*1000;
    const timer = setInterval(() => {const left=Math.max(0,Math.ceil((until-Date.now())/1000));setSeconds(left);if (!left) clearInterval(timer);},250);
    return () => clearInterval(timer);
  },[state]);
  return {state,submit,pending,seconds};
}
function Status({state}:{state:AuthResult}) { return state.message ? <p role={state.success ? 'status' : 'alert'}>{state.message}</p> : null; }
function Submit({pending,seconds,label}:{pending:boolean;seconds:number;label:string}) {
  return <button className="btn primary" disabled={pending || seconds>0}>{pending ? 'Please wait…' : seconds ? `Try again in ${seconds}s` : label}</button>;
}
export function LoginForm({next}:{next:string}) {
  const {state,submit,pending,seconds}=useAuthForm(login);
  return <form action={submit} className="connected-form"><Status state={state}/><input type="hidden" name="next" value={next}/>
    <label>Email<input name="email" type="email" autoComplete="username" maxLength={254} required/></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" maxLength={256} required/></label>
    <Submit pending={pending} seconds={seconds} label="Sign in"/>
  </form>;
}
export function ForgotPasswordForm() {
  const {state,submit,pending,seconds}=useAuthForm(requestReset);
  return <form action={submit} className="connected-form"><Status state={state}/>
    <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required/></label>
    <Submit pending={pending} seconds={seconds} label="Send reset email"/></form>;
}
export function ResetPasswordForm() {
  const {state,submit,pending,seconds}=useAuthForm(updatePassword);
  return <form action={submit} className="connected-form"><Status state={state}/><p>{passwordGuidance}</p>
    <label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required/></label>
    <label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required/></label>
    <Submit pending={pending} seconds={seconds} label="Save password"/></form>;
}
export function ConfirmEmailForm({tokenHash,type,next}:{tokenHash:string;type:string;next:string}) {
  const {state,submit,pending,seconds}=useAuthForm(confirmEmail);
  return <form action={submit} className="connected-form"><Status state={state}/>
    <input type="hidden" name="token_hash" value={tokenHash}/><input type="hidden" name="type" value={type}/><input type="hidden" name="next" value={next}/>
    <p>Continue only if you requested this email or expected an invitation.</p><Submit pending={pending} seconds={seconds} label="Continue securely"/></form>;
}
export function ActivationForm({verified=false}:{verified?:boolean}) {
  const link=useRef<URLSearchParams | null>(null);
  const [presence,setPresence]=useState<{code:boolean;token_hash:boolean;type:boolean;fragment:boolean;error:boolean} | null>(null);
  useEffect(()=>{
    const capture=()=>{
    const query=new URLSearchParams(window.location.search);
    const fragment=new URLSearchParams(window.location.hash.slice(1));
    link.current=fragment.has('access_token') || fragment.has('error') ? fragment : query;
    // Credentials stay in component memory only, never storage or console output.
    window.history.replaceState(null,'',window.location.pathname);
    setPresence({code:query.has('code'),token_hash:query.has('token_hash'),type:link.current.has('type'),
      fragment:fragment.has('access_token') || fragment.has('refresh_token'),error:query.has('error') || fragment.has('error')});
    };
    if (!link.current) capture();
    window.addEventListener('hashchange',capture);
    return ()=>window.removeEventListener('hashchange',capture);
  },[]);
  const {state,submit,pending,seconds}=useAuthForm(async previous=>{
    const form=new FormData();
    for (const key of ['code','token_hash','next','access_token','refresh_token','type']) form.set(key,link.current?.get(key) ?? '');
    return link.current?.has('access_token') ? activateSession(previous,form) : confirmEmail(previous,form);
  });
  if (!presence) return <p>Checking activation link?</p>;
  const ready=presence.code || presence.token_hash || presence.fragment;
  if (verified && !ready && !presence.error) return <ResetPasswordForm/>;
  return <form action={submit} className="connected-form"><Status state={state}/>
    <p>Continue only if you expected this invitation or requested a password reset.</p>
    {presence.error ? <p role="alert">The email provider rejected this link. It may have expired or already been used. Request a fresh link.</p> :
      ready ? <Submit pending={pending} seconds={seconds} label="Continue securely"/> :
        <p role="alert">No activation credentials arrived. Open a fresh invitation link from your email. Reloading a previously opened link cannot restore its credentials.</p>}
    <details><summary>Link diagnostics (presence only)</summary>
      <p>code: {String(presence.code)}; token_hash: {String(presence.token_hash)}; type: {String(presence.type)}; authentication fragment: {String(presence.fragment)}; provider error: {String(presence.error)}</p>
    </details>
  </form>;
}
