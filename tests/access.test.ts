import test from 'node:test';
import assert from 'node:assert/strict';
import { can, effectivePermission, templateGrants, validateMemberChange, requiresMfa, type Member } from '../src/lib/access';
const owner: Member = { id:'owner',organizationId:'org',role:'Owner',status:'active',overrides:[],serviceIds:[] };
const sales: Member = {...owner,id:'sales',role:'Sales',serviceIds:['website']};
const record = {organizationId:'org',assignedTo:['sales'],serviceIds:['website']};
test('Organization isolation, assignment and service restrictions intersect', () => {
  assert.equal(can(sales,'crm.read',record),true);
  assert.equal(can(sales,'crm.read',{...record,organizationId:'foreign'}),false);
  assert.equal(can(sales,'crm.read',{...record,assignedTo:[]}),false);
  assert.equal(can(sales,'crm.read',{...record,serviceIds:['new-service']}),false);
  assert.equal(can(owner,'crm.read',{...record,serviceIds:['new-service']}),true);
});
test('Deny wins over allow; expired and invalid dates never grant access', () => {
  const member: Member = {...sales,overrides:[{key:'crm.read',effect:'allow',scope:'all'},{key:'crm.read',effect:'deny',scope:'all'}]};
  assert.equal(effectivePermission(member,'crm.read').allowed,false);
  for (const expiresAt of ['2000-01-01','invalid']) {
    assert.equal(effectivePermission({...sales,overrides:[{key:'finance.read',effect:'allow',scope:'all',expiresAt}]},'finance.read').allowed,false);
  }
  assert.equal(effectivePermission({...sales,overrides:[{key:'finance.read',effect:'allow',scope:'all'}]},'finance.read').allowed,true);
});
test('Suspended memberships and owner-only override attempts are denied', () => {
  assert.equal(can({...owner,status:'suspended'},'crm.read',record),false);
  assert.equal(effectivePermission({...sales,overrides:[{key:'team.manage',effect:'allow',scope:'all'}]},'team.manage').allowed,false);
  assert.equal(requiresMfa(owner),true);
  assert.equal(requiresMfa({...sales,role:'Finance'}),true);
});
test('Viewer is read-only and template objects are immutable', () => {
  const viewer: Member = {...sales,role:'Viewer'};
  assert.equal(can(viewer,'crm.read',record),true);
  assert.equal(can(viewer,'crm.update',record),false);
  assert.ok(Object.isFrozen(templateGrants('Viewer')));
  assert.ok(Object.isFrozen(templateGrants('Viewer')[0]));
});
test('Own, department and record restrictions require matching context', () => {
  const member: Member = {...sales,departmentId:'delivery',overrides:[{key:'crm.read',effect:'allow',scope:'department',clientIds:['c1']}]};
  assert.equal(can(member,'crm.read',{...record,departmentId:'delivery',clientId:'c1'}),true);
  assert.equal(can(member,'crm.read',{...record,departmentId:'delivery'}),false);
  assert.equal(can(member,'crm.read',{...record,departmentId:'sales',clientId:'c1'}),false);
});
test('Access mutation requires human confirmation, recent MFA and cannot change self', () => {
  const assurance = {aal2:true,recentlyAuthenticated:true,confirmed:true,actorType:'human' as const};
  assert.throws(() => validateMemberChange(owner,owner,{...owner,role:'Viewer'},[owner],assurance));
  assert.throws(() => validateMemberChange(owner,sales,{...sales,role:'Owner'},[owner,sales],{...assurance,actorType:'automation'}));
  assert.throws(() => validateMemberChange(owner,sales,sales,[owner,sales],{...assurance,aal2:false}));
  assert.doesNotThrow(() => validateMemberChange(owner,sales,{...sales,status:'suspended'},[owner,sales],assurance));
});
