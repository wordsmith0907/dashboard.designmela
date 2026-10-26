// Synthetic loopback Auth service only. No hosted credentials, mail or accounts.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const userId='00000000-0000-4000-8000-000000000002';
const org='00000000-0000-4000-8000-000000000001';
const member='00000000-0000-4000-8000-000000000003';
const email='owner@example.invalid';
const password=randomBytes(20).toString('hex')+'Aa!';
let currentEmail=email;
let mode='pending', attempts=0, verificationCalls=0, resetCalls=0, updated=false, globalSignout=false, external=0;
const permissions=['leads.view','leads.create','leads.edit','leads.delete','clients.view','clients.manage','projects.view','projects.manage','tasks.view','tasks.manage','sales.view','sales.manage','analytics.view','team.view','team.manage','roles.manage','settings.manage','audit.view','content.view','content.manage','automations.view','automations.manage'];
const user=()=>({id:userId,aud:'authenticated',role:'authenticated',email:currentEmail,email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[]});
const token=()=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:userId,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),session_id:member})).toString('base64url'),randomBytes(32).toString('base64url')].join('.');
const session=()=>({access_token:token(),refresh_token:randomBytes(32).toString('hex'),token_type:'bearer',expires_in:3600,user:user()});
const calls=[];
const stub=createServer(async(req,res)=>{
  let raw='';for await (const chunk of req) raw+=chunk;
  const body=raw ? JSON.parse(raw) : {};
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  calls.push([req.method,path]);
  function reply(status,data){res.writeHead(status,{'Content-Type':'application/json','X-Supabase-Api-Version':'2024-01-01'});res.end(JSON.stringify(data));}
  if(path==='/auth/v1/token') {
    attempts++;
    if(body.auth_code && !body.code_verifier) return reply(400,{code:'bad_code_verifier',msg:'Synthetic provider detail'});
    if(body.email==='rate@example.invalid') return reply(429,{code:'over_request_rate_limit',msg:'Synthetic provider detail'});
    if(body.email==='invalid@example.invalid') return reply(400,{code:'invalid_credentials',msg:'Synthetic provider detail'});
    if(body.email==='unverified@example.invalid') return reply(400,{code:'email_not_confirmed',msg:'Synthetic provider detail'});
    return reply(200,session());
  }
  if(path==='/auth/v1/user' && req.method==='GET') return reply(200,user());
  if(path==='/auth/v1/user' && req.method==='PUT') {updated=true;return reply(200,user());}
  if(path==='/auth/v1/logout') {globalSignout ||= req.url.includes('scope=global');return reply(200,{});}
  if(path==='/auth/v1/recover') {resetCalls++;return reply(200,{});}
  if(path==='/auth/v1/verify') {verificationCalls++;if(body.token_hash==='x'.repeat(64)) return reply(403,{code:'otp_expired',msg:'Synthetic provider detail'});return reply(200,session());}
  if(path==='/rest/v1/rpc/workspace_session') {
    if(mode==='db-error') return reply(503,{message:'Synthetic private database detail'});
    return reply(200,mode==='pending' ? null : {organization_id:org,member_id:member,role:'owner',permissions:mode==='restricted'?['leads.view']:permissions});
  }
  if(path.startsWith('/rest/v1/')) return reply(200,[]);
  return reply(404,{message:'Synthetic endpoint not implemented'});
});
await new Promise(resolve=>stub.listen(0,'127.0.0.1',resolve));
const stubPort=stub.address().port;
const reservation=createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['--require','./scripts/local-network-only.cjs','node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{
  env:{...process.env,TEST_AUTH_ORIGIN:`http://127.0.0.1:${stubPort}`,DESIGNMELA_MODE:'connected',DESIGNMELA_ENV:'development',SUPABASE_DEV_PROJECT_CONFIRMED:'true',DESIGNMELA_ORGANIZATION_ID:org,DESIGNMELA_APP_ORIGIN:base,
    NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${stubPort}`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_local_test_fixture',INITIAL_OWNER_EMAIL:email,INITIAL_OWNER_BOOTSTRAP_ENABLED:'true'},
  stdio:['ignore','pipe','pipe','ipc'],
});
let serverOutput='';
child.stdout.on('data',chunk=>{serverOutput+=chunk;});
child.stderr.on('data',chunk=>{serverOutput+=chunk;});
child.on('message',message=>{if(message==='external-fetch-blocked')external++;});
const browser=await chromium.launch({channel:'chrome'});
const results=[];
async function check(name,fn){try{await fn();}catch(error){console.log(JSON.stringify({failedCheck:name,stubCalls:calls,blockedExternalRequests:external}));throw error;}results.push(name);console.log(`PASS ${name}`);}
try {
  let ready=false;for(let i=0;i<150;i++){try{if((await fetch(base+'/login')).ok){ready=true;break;}}catch{}await delay(200);}assert.ok(ready,'App did not start');
  const context=await browser.newContext();
  await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  const page=await context.newPage();
  page.on('pageerror',()=>console.log('Browser error; details suppressed'));
  const login=async(next='/',address=email)=>{await page.goto(base+'/login?next='+encodeURIComponent(next));await page.getByLabel('Email',{exact:true}).fill(address);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();};
  await check('throttled login is sanitized and does not auto-retry',async()=>{await login('/','rate@example.invalid');await page.getByRole('alert').filter({hasText:'Too many attempts'}).waitFor();await page.getByRole('button',{name:/Try again in/}).waitFor();const count=attempts;await delay(1000);assert.equal(attempts,count);assert.ok(!(await page.content()).includes('Synthetic provider detail'));});
  await check('rejected credentials explain recovery without provider details',async()=>{await login('/','invalid@example.invalid');await page.getByRole('alert').filter({hasText:'email or password was not accepted'}).waitFor();assert.ok(!(await page.content()).includes('Synthetic provider detail'));});
  await check('unverified login explains verification',async()=>{await login('/','unverified@example.invalid');await page.getByRole('alert').filter({hasText:'Verify your email'}).waitFor();});
  await check('verified account without membership is Access Pending; cookie is HTTP-only',async()=>{await login('//evil.invalid');await page.waitForURL(base+'/access-pending');await page.getByRole('heading',{name:'Access pending',exact:true}).waitFor();const cookies=await context.cookies();assert.ok(cookies.some(c=>c.name.startsWith('sb-')&&c.httpOnly&&c.sameSite==='Lax'));assert.ok(!(await page.evaluate(()=>document.cookie)).includes('sb-'));});
  await check('matching initial Owner is verified without bootstrap',async()=>{await page.goto(base+'/setup');await page.getByRole('heading',{name:'Owner account verified'}).waitFor();assert.ok(!calls.some(([,path])=>path.includes('bootstrap_first_owner')));});
  await check('Owner navigation, refresh and protected module access',async()=>{mode='active';await page.goto(base+'/crm');await page.getByRole('heading',{name:'CRM',exact:true}).waitFor();await page.getByRole('link',{name:'Team & Access',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'CRM',exact:true}).waitFor();});
  await check('direct URL and navigation enforce server permissions',async()=>{mode='restricted';await page.goto(base+'/crm');assert.equal(await page.getByRole('link',{name:'Team & Access',exact:true}).count(),0);await page.goto(base+'/team');await page.getByRole('heading',{name:'This page is not in your workspace.',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Team & Access',exact:true}).count(),0);});
  await check('database error stays in Connected Mode and fails closed',async()=>{mode='db-error';await page.goto(base+'/crm');await page.waitForURL(base+'/auth/unavailable');await page.getByRole('heading',{name:'Workspace temporarily unavailable'}).waitFor();assert.ok(!(await page.content()).includes('Demo data'));mode='active';});
  await check('logout removes browser access; protected URLs redirect',async()=>{await page.goto(base+'/');await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL(/\/login\?status=signed-out$/);await page.goto(base+'/crm');await page.waitForURL(base+'/login');});
  await check('forgot password response does not enumerate accounts',async()=>{const messages=[];for(const address of [email,'unknown@example.invalid']){await page.goto(base+'/forgot-password');await page.getByLabel('Email',{exact:true}).fill(address);await page.getByRole('button',{name:'Send reset email'}).click();await page.getByRole('status').waitFor();messages.push(await page.getByRole('status').textContent());}assert.equal(messages[0],messages[1]);assert.equal(resetCalls,2);});
  await check('email GET does not consume token; expired link is handled',async()=>{const before=verificationCalls;await page.goto(base+'/auth/confirm?type=invite&token_hash='+('x'.repeat(64)));assert.equal(verificationCalls,before);await page.getByRole('button',{name:'Continue securely'}).click();await page.getByRole('alert').filter({hasText:'expired'}).waitFor();assert.equal(verificationCalls,before+1);});
  await check('missing credentials and provider errors show safe diagnostics',async()=>{
    await page.goto(base+'/auth/activate');await page.getByRole('alert').filter({hasText:'No activation credentials'}).waitFor();
    await page.goto(base+'/auth/activate#error=access_denied&error_description=PRIVATE_PROVIDER_DETAIL');
    await page.getByRole('alert').filter({hasText:'provider rejected'}).waitFor();
    assert.equal(new URL(page.url()).hash,'');assert.ok(!(await page.content()).includes('PRIVATE_PROVIDER_DETAIL'));
  });
  await check('invite token hash verifies only on click then opens password creation',async()=>{
    const before=verificationCalls;
    await page.goto(base+'/auth/confirm?type=invite&token_hash='+('b'.repeat(64)));
    await page.getByRole('button',{name:'Continue securely'}).waitFor();
    assert.equal(verificationCalls,before);assert.equal(new URL(page.url()).search,'');
    await page.getByRole('button',{name:'Continue securely'}).click();
    await page.getByLabel('New password',{exact:true}).waitFor();await page.waitForURL(base+'/auth/activate');
    assert.equal(verificationCalls,before+1);
    await context.clearCookies();
  });
  await check('PKCE code without verifier fails closed',async()=>{
    await page.goto(base+'/auth/confirm?code='+('c'.repeat(40)));
    await page.getByRole('button',{name:'Continue securely'}).click();
    await page.getByRole('alert').filter({hasText:'expired'}).waitFor();
    assert.equal(new URL(page.url()).search,'');
  });
  await check('PKCE code with browser verifier reaches activation password form',async()=>{
    await page.goto(base+'/forgot-password');await page.getByLabel('Email',{exact:true}).fill(email);
    await page.getByRole('button',{name:'Send reset email'}).click();await page.getByRole('status').waitFor();
    await page.goto(base+'/auth/confirm?code='+('d'.repeat(40)));
    await page.getByRole('button',{name:'Continue securely'}).click();
    await page.getByLabel('New password',{exact:true}).waitFor();await page.waitForURL(base+'/auth/activate');
    await context.clearCookies();
  });
  await check('initial Owner activation preserves current session and proceeds directly to setup',async()=>{await page.goto(base+'/auth/activate#'+new URLSearchParams({type:'invite',access_token:token(),refresh_token:randomBytes(32).toString('hex')}));await page.getByRole('button',{name:'Continue securely'}).waitFor();assert.equal(new URL(page.url()).hash,'');assert.equal(await page.evaluate(()=>localStorage.length),0);await page.getByRole('button',{name:'Continue securely'}).click();await page.waitForURL(base+'/auth/activate');await page.getByLabel('New password',{exact:true}).fill(password);await page.getByLabel('Confirm new password',{exact:true}).fill(password);await page.getByRole('button',{name:'Save password'}).click();await page.waitForURL(base+'/setup');await page.getByRole('heading',{name:'Owner account verified'}).waitFor();assert.ok(updated&&!globalSignout);assert.ok(calls.some(([method,path])=>method==='POST'&&path==='/auth/v1/logout'));});
  await check('ordinary recovery revokes all sessions and requires fresh login',async()=>{currentEmail='member@example.invalid';updated=false;await page.goto(base+'/auth/confirm?type=recovery&token_hash='+('b'.repeat(64)));await page.getByRole('button',{name:'Continue securely'}).click();await page.waitForURL(base+'/reset-password');await page.getByLabel('New password',{exact:true}).fill(password);await page.getByLabel('Confirm new password',{exact:true}).fill(password);await page.getByRole('button',{name:'Save password'}).click();await page.waitForURL(base+'/login?status=password-updated');assert.ok(updated&&globalSignout);});
  await check('callback rejects open redirects and uses no-store/no-referrer',async()=>{const response=await fetch(base+'/auth/callback?next=https://evil.invalid',{redirect:'manual',headers:{'x-forwarded-host':'evil.invalid'}});assert.equal(response.headers.get('location'),base+'/auth/link-error');assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('referrer-policy'),'no-referrer');});
  for (const secret of ['x'.repeat(64),'b'.repeat(64),'c'.repeat(40),'d'.repeat(40),password,'PRIVATE_PROVIDER_DETAIL']) assert.ok(!serverOutput.includes(secret),'Sensitive synthetic value reached server logs');
  assert.equal(external,0);assert.ok(!calls.some(([,path])=>path.includes('/signup')));
  console.log(JSON.stringify({result:'PASS',checks:results.length,remoteRequests:external,hostedAccountsCreated:0,publicSignupRequests:0}));
} finally {
  await browser.close();child.kill();await new Promise(resolve=>child.once('exit',resolve));await new Promise(resolve=>stub.close(resolve));
}
