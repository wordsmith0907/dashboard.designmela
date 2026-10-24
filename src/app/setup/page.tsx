import { bootstrapAllowed } from '@/lib/connected/config';
import { verifiedUser } from '@/lib/connected/session';
import { bootstrap } from './actions';

export default async function Setup({searchParams}:{searchParams:Promise<{complete?:string}>}) {
  const {user} = await verifiedUser();
  if (!bootstrapAllowed(user,process.env.INITIAL_OWNER_EMAIL,process.env.INITIAL_OWNER_BOOTSTRAP_ENABLED)) return <main className="connected-page"><h1>Setup unavailable</h1></main>;
  const {complete} = await searchParams;
  return <main className="connected-page"><h1>Development workspace setup</h1>
    {complete === 'true' ? <p>Bootstrap completed. The administrator must configure the organization ID and disable bootstrap before opening the workspace.</p> :
    <form action={bootstrap} className="connected-form"><label>Workspace name<input name="name" required minLength={2} maxLength={100} /></label>
      <label><input type="checkbox" name="confirm" value="yes" required /> Create the initial development organization and owner after migration approval.</label>
      <button className="btn primary">Create workspace</button></form>}
  </main>;
}
