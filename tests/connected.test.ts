import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { connectedEnabled,publicConfig,bootstrapAllowed } from '../src/lib/connected/config';
import { canAccessRoute,routes,permissionKeys,type WorkspaceSession } from '../src/lib/connected/permissions';
import { recordModule,recordValues,pageNumber } from '../src/lib/connected/records';

test('Connected Mode requires explicit development confirmation; invalid modes never fall back', () => {
  assert.equal(connectedEnabled({}),false);
  assert.equal(connectedEnabled({DESIGNMELA_MODE:'demo'}),false);
  assert.throws(() => connectedEnabled({DESIGNMELA_MODE:'connected'}));
  assert.throws(() => connectedEnabled({DESIGNMELA_MODE:'connected',DESIGNMELA_ENV:'production',SUPABASE_DEV_PROJECT_CONFIRMED:'true'}));
  assert.throws(() => connectedEnabled({DESIGNMELA_MODE:'conected'}));
  assert.equal(connectedEnabled({DESIGNMELA_MODE:'connected',DESIGNMELA_ENV:'development',SUPABASE_DEV_PROJECT_CONFIRMED:'true'}),true);
});
test('Browser configuration rejects private keys, legacy JWTs and non-HTTPS endpoints', () => {
  assert.throws(() => publicConfig(undefined,undefined));
  assert.throws(() => publicConfig('https://example.invalid','not-a-publishable-key'));
  assert.throws(() => publicConfig('http://example.invalid','sb_publishable_test'));
  assert.equal(publicConfig('https://example.invalid','sb_publishable_test').url,'https://example.invalid');
});
test('Bootstrap requires verified matching email and an explicit server switch', () => {
  const verified = {email:'OWNER@example.invalid',email_confirmed_at:'2026-01-01'};
  assert.equal(bootstrapAllowed(verified,'owner@example.invalid','true'),true);
  assert.equal(bootstrapAllowed(verified,'other@example.invalid','true'),false);
  assert.equal(bootstrapAllowed({email:verified.email},'owner@example.invalid','true'),false);
  assert.equal(bootstrapAllowed(verified,undefined,'true'),false);
  assert.equal(bootstrapAllowed(verified,'owner@example.invalid','false'),false);
});
test('Navigation and direct-route permission decisions deny unknown and unauthorized routes', () => {
  const session:WorkspaceSession={organization_id:'test',member_id:'test',role:'sales',permissions:['leads.view']};
  assert.equal(canAccessRoute(session,'/crm'),true);
  assert.equal(canAccessRoute(session,'/team'),false);
  assert.equal(canAccessRoute(session,'/settings'),false);
  assert.equal(canAccessRoute(session,'/audits'),false);
  assert.equal(canAccessRoute({...session,permissions:['audit.view']},'/audits'),true);
  assert.equal(canAccessRoute(session,'/unregistered'),false);
  for (const route of routes.filter(r => r.permission)) assert.equal(canAccessRoute({...session,permissions:[]},route.path),false);
  // Displayed role never grants capabilities; only the database-resolved keys do.
  assert.equal(canAccessRoute({...session,role:'owner',permissions:[]},'/team'),false);
});
test('Record input blocks tenant, ownership, permission and archive field injection', () => {
  for (const injected of ['organization_id','created_by','assigned_to','archived_at','primary_role','permissions']) {
    assert.throws(() => recordValues('leads',{name:'Lead',company:'Company',stage:'New',estimated_value:'10',[injected]:'value'}));
  }
  assert.throws(() => recordModule('__proto__'));
  assert.throws(() => recordModule('organization_members'));
});
test('Input validation rejects malformed relationships, impossible dates and unsafe monetary values', () => {
  assert.throws(() => recordValues('clients',{name:'A',company:'B',lead_id:'another-tenant'}));
  assert.throws(() => recordValues('tasks',{title:'Test',due_date:'2026-02-31'}));
  for (const amount of ['Infinity','-1','1e9','0.001','1000000000000']) assert.throws(() => recordValues('leads',{name:'A',company:'B',stage:'New',estimated_value:amount}));
  const result = recordValues('leads',{name:' A ',company:'B',stage:'New',estimated_value:'12.50'});
  assert.equal(result.name,'A'); assert.equal(result.estimated_value,12.5);
});
test('Sales integration permits draft quote/proposal editing only; pagination is bounded', () => {
  assert.throws(() => recordValues('quotes',{title:'Quote',currency:'INR',status:'Accepted'}));
  assert.throws(() => recordValues('proposals',{title:'Proposal',price:'12',currency:'INR',status:'Accepted'}));
  for (const input of [-1,0,1.5,Infinity,'oops',10001]) assert.equal(pageNumber(input),1);
  assert.equal(pageNumber('4'),4);
});
test('SQL catalogue matches connected permissions (static contract, not executable RLS verification)', () => {
  const sql=readFileSync('supabase/proposals/consolidated-initial.sql','utf8');
  for (const key of permissionKeys) assert.ok(sql.includes(`('${key}',`),key);
  assert.match(sql,/create function public\.workspace_session/);
  assert.match(sql,/create constraint trigger organization_requires_owner/);
  assert.match(sql,/deferrable initially deferred/);
  assert.match(sql,/create event trigger designmela_default_rls/);
  assert.match(sql,/revoke all on function public\.bootstrap_first_owner\(uuid,text,text\) from public,anon,authenticated/);
  assert.doesNotMatch(sql,/on delete cascade/i);
});
