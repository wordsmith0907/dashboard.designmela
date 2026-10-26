import { connectedConfig } from '@/lib/server-config';
import { ActivationForm } from '@/components/connected/auth-forms';
export default function Confirm() {
  return <main className="connected-page" id="main-content"><h1>Confirm your email link</h1><ActivationForm showDiagnostics={['development','test'].includes(connectedConfig().environment)}/></main>;
}
