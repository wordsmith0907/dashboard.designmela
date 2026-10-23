"use client";
import { useMemo, useState } from 'react';
import { catalogue, effectivePermission, roleNames, templateGrants, type Member, type Role } from '@/lib/access';
import { Badge, Empty } from './ui';

const tabs = ['Members','Roles','Permissions','Invitations','Security & Audit'] as const;
export function TeamAccess() {
  const [tab,setTab] = useState<typeof tabs[number]>('Members');
  const [query,setQuery] = useState('');
  const [role,setRole] = useState<Role>('Owner');
  const [module,setModule] = useState('all');
  const [risk,setRisk] = useState('all');
  const member: Member = useMemo(() => ({id:'demo-owner',organizationId:'demo',role,status:'active',overrides:[],serviceIds:[]}),[role]);
  const permissions = catalogue.filter(p => (p.key+' '+p.description).toLowerCase().includes(query.toLowerCase()) && (module === 'all' || p.module === module) && (risk === 'all' || p.risk === risk));
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">WORKSPACE SECURITY</p><h1>Team & Access</h1><p>Inspect role templates and access rules before connecting your team.</p></div><Badge>Demo Mode</Badge></div>
    <div className="card" style={{padding:20}}><strong>Local access-policy preview</strong><p>This screen does not authenticate users or change real access. Invitations, account management and security history require the connected backend. No employee accounts have been created.</p></div>
    <div className="toolbar" role="group" aria-label="Team and access panels">{tabs.map(item => <button className={tab === item ? 'button primary' : 'button'} aria-pressed={tab === item} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
    {tab === 'Members' && <div className="card" style={{padding:24}}><h2>Demo workspace owner</h2><p>Owner · Fictional local identity · Authentication not connected</p><p>Real members will appear here after the organization and invite-only authentication are configured.</p><button className="button" disabled>Invite member — backend required</button></div>}
    {tab === 'Roles' && <div className="card" style={{padding:24}}><h2>Immutable role templates</h2><div className="access-role-grid">{roleNames.map(name => <button className="card" style={{padding:20,textAlign:'left'}} key={name} onClick={() => {setRole(name);setTab('Permissions');}}><strong>{name}</strong><p>{templateGrants(name).length} base permissions</p><small>View permission details</small></button>)}</div><p>Custom role editing and version recovery are not connected yet.</p></div>}
    {tab === 'Permissions' && <>
      <div className="toolbar"><label>Search permissions<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="CRM, content, finance…" /></label><label>Inspect role<select value={role} onChange={e=>setRole(e.target.value as Role)}>{roleNames.map(r=><option key={r}>{r}</option>)}</select></label><label>Module<select value={module} onChange={e=>setModule(e.target.value)}><option value="all">All modules</option>{[...new Set(catalogue.map(p=>p.module))].map(m=><option key={m}>{m}</option>)}</select></label><label>Risk<select value={risk} onChange={e=>setRisk(e.target.value)}><option value="all">All risks</option><option value="high">High</option><option value="standard">Standard</option></select></label></div>
      <p>Showing the {role} template. Record assignment, organization and service restrictions are evaluated separately. No actions run as this role.</p>
      <div className="access-role-grid">{permissions.map(p => {const decision = effectivePermission(member,p.key);return <article className="card" style={{padding:20}} key={p.key}><strong>{p.key}</strong><p><Badge>{decision.allowed ? 'Allowed' : 'Denied'}</Badge> · {decision.source}</p><p>{p.description}</p><small>Scope: {decision.grant?.scope ?? 'none'} · Risk: {p.risk}{p.ownerOnly ? ' · Owner only' : ''}{p.reauthentication ? ' · Recent authentication required' : ''}</small></article>;})}</div>{!permissions.length && <Empty title="No matching permissions" text="Try another search or filter." />}
    </>}
    {tab === 'Invitations' && <Empty title="No invitations sent" text="Invitation delivery is not connected. No real emails or employee accounts have been created." />}
    {tab === 'Security & Audit' && <Empty title="Security history is not connected" text="Production permission changes must be recorded in append-only database audit history. This preview does not claim those controls are active." />}
  </div>;
}
