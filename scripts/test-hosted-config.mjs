// Local production server only. Every outbound fetch is blocked by the preload.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';

const valid={VERCEL:'1',VERCEL_ENV:'production',DESIGNMELA_ENV:'production',DESIGNMELA_MODE:'connected',
  NEXT_PUBLIC_APP_URL:'https://dashboard.designmela.com',DESIGNMELA_APP_ORIGIN:'',
  SUPABASE_DEV_PROJECT_CONFIRMED:'false',INITIAL_OWNER_BOOTSTRAP_ENABLED:'false',INITIAL_OWNER_EMAIL:'',
  NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',
  DESIGNMELA_ORGANIZATION_ID:'00000000-0000-4000-8000-000000000001'};
const cases=[
  {DESIGNMELA_MODE:''},{DESIGNMELA_MODE:'demo'},{NEXT_PUBLIC_APP_URL:''},
  {NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3100'},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:''},
  {DESIGNMELA_ORGANIZATION_ID:''},{INITIAL_OWNER_BOOTSTRAP_ENABLED:'true'},
  {VERCEL_ENV:'preview',DESIGNMELA_ENV:'preview',SUPABASE_DEV_PROJECT_CONFIRMED:'true'},
];
let blocked=0;
for(const change of cases) {
  const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));
  const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  const child=spawn(process.execPath,['--require','./scripts/local-network-only.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
    env:{...process.env,...valid,...change,TEST_AUTH_ORIGIN:''},stdio:['ignore','ignore','ignore','ipc'],
  });
  child.on('message',message=>{if(message==='external-fetch-blocked')blocked++;});
  const base=`http://127.0.0.1:${port}`;
  try {
    let response;
    for(let i=0;i<100;i++){try{response=await fetch(base+'/login');break;}catch{}await delay(100);}
    assert.ok(response,'Local test server did not start');
    const login=await response.text();
    assert.match(login,/Workspace configuration error/);
    assert.doesNotMatch(login,/name="password"|Demo Mode/);
    const crm=await (await fetch(base+'/crm')).text();
    assert.match(crm,/Connection Error|Workspace unavailable/);
    assert.doesNotMatch(crm,/Good relationships|Today’s focus|Demo Mode/);
    const callback=await fetch(base+'/auth/callback?next=https://evil.invalid',{redirect:'manual'});
    assert.equal(callback.status,503);assert.equal(callback.headers.get('location'),null);
  } finally {
    const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;
  }
}
assert.equal(blocked,0,'Invalid configuration must be rejected before provider access');
console.log(JSON.stringify({result:'PASS',invalidHostedConfigurations:cases.length,providerRequests:0}));
