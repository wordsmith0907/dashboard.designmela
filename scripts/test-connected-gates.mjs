// Local HTTP checks against a built app. No real Supabase URL/key is used.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from '@playwright/test';

let requests=0;
const stub=createServer((_request,response) => {requests++;response.writeHead(401,{'Content-Type':'application/json'});response.end('{"message":"No session"}');});
await new Promise(resolve => stub.listen(0,'127.0.0.1',resolve));
const stubPort=stub.address().port;
const reservation=createServer();
await new Promise(resolve => reservation.listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const child=spawn(process.execPath,['--require','./scripts/local-network-only.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  env:{...process.env,DESIGNMELA_MODE:'connected',DESIGNMELA_ENV:'development',SUPABASE_DEV_PROJECT_CONFIRMED:'true',
    DESIGNMELA_ORGANIZATION_ID:'00000000-0000-4000-8000-000000000001',
    NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${stubPort}`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_test_fixture',
    INITIAL_OWNER_BOOTSTRAP_ENABLED:'false',INITIAL_OWNER_EMAIL:'',SUPABASE_SERVICE_ROLE_KEY:''},
  stdio:['ignore','ignore','ignore','ipc'],
});
let blocked=0;
child.on('message',message => {if(message === 'external-fetch-blocked') blocked++;});
const browser=await chromium.launch({channel:'chrome'});
try {
  const base=`http://127.0.0.1:${port}`;
  let ready=false;
  for(let i=0;i<100;i++) {try {const r=await fetch(`${base}/login`); if(r.status===200){ready=true;break;}}catch{} await delay(100);}
  assert.ok(ready,'Local connected test server must start');
  const login=await fetch(`${base}/login`);
  assert.match(await login.text(),/name="password"/);
  assert.match(login.headers.get('cache-control'),/no-store/);
  const page=await browser.newPage({extraHTTPHeaders:{'x-user-role':'owner','x-organization-id':'spoofed','x-permissions':'team.manage'}});
  await page.route('**/*',route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  for(const path of ['/','/crm','/clients','/projects','/tasks','/sales','/team','/settings','/setup']) {
    await page.goto(base+path);
    // App Router may use a streamed redirect after sending the loading shell.
    await page.waitForURL(base+'/login');
    const body=await page.content();
    assert.doesNotMatch(body,/Good relationships|Today’s focus/,'Protected response must not contain demo data');
  }
  assert.equal(blocked,0,'No external auth request should be attempted without a session');
  console.log(JSON.stringify({result:'PASS',protectedRoutes:9,spoofedHeadersIgnored:true,localAuthStubRequests:requests,remoteRequests:0}));
} finally {
  await browser.close();
  child.kill();
  await new Promise(resolve => child.once('exit',resolve));
  await new Promise(resolve => stub.close(resolve));
}
