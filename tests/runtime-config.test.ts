import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRuntimeConfig, authUrls, productionOrigin, type Environment } from '../src/lib/runtime-config';

const production: Environment = {
  NODE_ENV:'production', VERCEL:'1', VERCEL_ENV:'production', DESIGNMELA_ENV:'production',
  DESIGNMELA_MODE:'connected', NEXT_PUBLIC_APP_URL:productionOrigin,
  NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',
  DESIGNMELA_ORGANIZATION_ID:'00000000-0000-4000-8000-000000000001', INITIAL_OWNER_BOOTSTRAP_ENABLED:'false',
};
const preview: Environment = {...production, DESIGNMELA_ENV:'preview', VERCEL_ENV:'preview',
  NEXT_PUBLIC_APP_URL:undefined, VERCEL_BRANCH_URL:'crm-git-review.vercel.app', VERCEL_URL:'crm-build.vercel.app',
  SUPABASE_DEV_PROJECT_CONFIRMED:'true'};

test('Production Connected Mode validates all configuration and has no diagnostic banner',()=>{
  const config=resolveRuntimeConfig(production);
  assert.equal(config.mode,'connected');assert.equal(config.label,null);
  if(config.mode!=='connected') throw Error('Expected connected');
  assert.equal(config.origin,productionOrigin);assert.equal(config.bootstrapEnabled,false);
  assert.equal(authUrls(config).recovery,productionOrigin+'/auth/callback?next=/reset-password');
});

test('Missing production variables fail closed; no raw values escape errors',()=>{
  for(const name of ['DESIGNMELA_MODE','NEXT_PUBLIC_APP_URL','NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','DESIGNMELA_ORGANIZATION_ID','INITIAL_OWNER_BOOTSTRAP_ENABLED']) {
    assert.throws(()=>resolveRuntimeConfig({...production,[name]:undefined}),Error,name);
  }
  assert.throws(()=>resolveRuntimeConfig({...production,DESIGNMELA_MODE:'demo'}));
  for(const [name,value] of Object.entries({NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_private_fixture',DESIGNMELA_ORGANIZATION_ID:'private_invalid_id',NEXT_PUBLIC_APP_URL:'https://user:private_password@example.invalid'})) {
    assert.throws(()=>resolveRuntimeConfig({...production,[name]:value}),error=>error instanceof Error && !error.message.includes(value));
  }
});

test('Production rejects local origins, target confusion, development flags and bootstrap',()=>{
  for(const origin of ['http://127.0.0.1:3100','https://localhost','https://preview.vercel.app','https://dashboard.designmela.com.evil.invalid','https://dashboard.designmela.com/path','https://dashboard.designmela.com?next=bad']) {
    assert.throws(()=>resolveRuntimeConfig({...production,NEXT_PUBLIC_APP_URL:origin}));
  }
  for(const changes of [{DESIGNMELA_ENV:'development'},{SUPABASE_DEV_PROJECT_CONFIRMED:'true'},{INITIAL_OWNER_BOOTSTRAP_ENABLED:'true'},{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:1234'},{NEXT_PUBLIC_SUPABASE_URL:'https://user:password@fixture.supabase.co'},{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.co/path'}]) {
    assert.throws(()=>resolveRuntimeConfig({...production,...changes}));
  }
});

test('Preview uses its approved branch or deployment origin and never the production URL',()=>{
  const config=resolveRuntimeConfig(preview);
  assert.equal(config.mode,'connected');
  if(config.mode!=='connected') throw Error('Expected connected');
  assert.equal(config.origin,'https://crm-git-review.vercel.app');assert.equal(config.label,'Preview');
  assert.equal(authUrls(config).invitation,config.origin+'/auth/activate');
  assert.equal(authUrls(config).confirmation,config.origin+'/auth/confirm');
  const exact=resolveRuntimeConfig({...preview,NEXT_PUBLIC_APP_URL:'https://crm-build.vercel.app'});
  assert.ok(exact.mode==='connected' && exact.origin==='https://crm-build.vercel.app');
  for(const changes of [{NEXT_PUBLIC_APP_URL:productionOrigin},{NEXT_PUBLIC_APP_URL:'https://unrelated.vercel.app'},{VERCEL_BRANCH_URL:'evil.invalid'},{VERCEL_BRANCH_URL:'foo.vercel.app@evil.invalid'},{VERCEL_BRANCH_URL:'foo.vercel.app/path'},{VERCEL_URL:undefined,VERCEL_BRANCH_URL:undefined},{DESIGNMELA_ENV:'production'}]) {
    assert.throws(()=>resolveRuntimeConfig({...preview,...changes}));
  }
  assert.equal(production.NEXT_PUBLIC_APP_URL,productionOrigin);
});

test('Local connected callbacks are explicit; legacy origin is local-only',()=>{
  const local={...production,VERCEL:undefined,VERCEL_ENV:undefined,DESIGNMELA_ENV:'development',SUPABASE_DEV_PROJECT_CONFIRMED:'true',NEXT_PUBLIC_APP_URL:'http://127.0.0.1:3100'};
  const config=resolveRuntimeConfig(local);
  assert.ok(config.mode==='connected');
  if(config.mode!=='connected') throw Error('Expected connected');
  assert.equal(authUrls(config).recovery,'http://127.0.0.1:3100/auth/callback?next=/reset-password');
  assert.throws(()=>resolveRuntimeConfig({...local,NEXT_PUBLIC_APP_URL:undefined}));
  assert.doesNotThrow(()=>resolveRuntimeConfig({...local,NEXT_PUBLIC_APP_URL:undefined,DESIGNMELA_APP_ORIGIN:'http://127.0.0.1:3100'}));
  assert.throws(()=>resolveRuntimeConfig({...production,NEXT_PUBLIC_APP_URL:undefined,DESIGNMELA_APP_ORIGIN:productionOrigin}));
});

test('Demo requires explicit local development/test, and cannot bypass hosted gates',()=>{
  for(const environment of ['development','test']) {
    assert.equal(resolveRuntimeConfig({DESIGNMELA_MODE:'demo',DESIGNMELA_ENV:environment,NODE_ENV:environment}).mode,'demo');
  }
  for(const env of [{},{DESIGNMELA_MODE:'demo'},{DESIGNMELA_MODE:'demo',DESIGNMELA_ENV:'development',NODE_ENV:'production'}, {...preview,DESIGNMELA_MODE:'demo'}, {...production,DESIGNMELA_MODE:'demo'},{DESIGNMELA_MODE:'demo',DESIGNMELA_ENV:'test',NODE_ENV:'test',VERCEL:'1'}]) assert.throws(()=>resolveRuntimeConfig(env));
});

test('Validated configuration never returns administrative credentials',()=>{
  const config=resolveRuntimeConfig({...production,DATABASE_URL:'private_database_sentinel',PASSWORD:'private_password_sentinel',SUPABASE_SECRET_KEY:'private_key_sentinel'});
  assert.doesNotMatch(JSON.stringify(config),/private_.*_sentinel|DATABASE_URL|PASSWORD|SUPABASE_SECRET_KEY/);
});
