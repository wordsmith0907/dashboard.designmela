/** Shared policy vocabulary. Server/database enforcement must use trusted memberships. */
export const permissionKeys = [
  'team.read','team.invite','team.manage','team.suspend','team.remove',
  'roles.read','roles.create','roles.update','roles.assign','roles.restore',
  'crm.read','crm.create','crm.update','crm.archive','crm.export','crm.assign',
  'clients.read','clients.update','clients.export',
  'sales.quotes.read','sales.quotes.manage','sales.proposals.read','sales.proposals.manage',
  'projects.read','projects.create','projects.update','projects.assign','projects.archive',
  'audits.read','audits.manage','tasks.read','tasks.create','tasks.update','tasks.assign',
  'content.read','content.create','content.update','content.approve','content.schedule','content.archive','content.export',
  'finance.read','finance.manage','finance.export','analytics.read',
  'automations.read','automations.manage','services.read','services.manage',
  'settings.manage','integrations.manage','audit_log.read','data.export_all','data.hard_delete',
] as const;
export type Permission = typeof permissionKeys[number];
export type Scope = 'own' | 'assigned' | 'department' | 'all' | 'none';
export type Role = 'Owner' | 'Operations Admin' | 'Sales' | 'Delivery' | 'Content' | 'Finance' | 'Viewer';
export const roleNames: readonly Role[] = Object.freeze(['Owner','Operations Admin','Sales','Delivery','Content','Finance','Viewer']);
export const catalogue = Object.freeze(permissionKeys.map(key => Object.freeze({
  key, name: key.split('.').join(' '), module: key.split('.')[0], action: key.split('.').at(-1)!,
  description: `Permit ${key.split('.').join(' ')} within the selected scope.`,
  ownerOnly: /^(team\.|roles\.|settings\.|integrations\.|data\.|audit_log\.)/.test(key),
  risk: /manage|remove|suspend|assign|export|hard_delete|restore|invite/.test(key) ? 'high' : 'standard',
  reauthentication: /manage|remove|suspend|assign|export|hard_delete|restore|invite/.test(key),
  expirySupported: true,
  scopes: Object.freeze(['own','assigned','department','all','none'] as Scope[]),
})));
export interface Grant {
  key: Permission;
  effect: 'allow' | 'deny' | 'inherit';
  scope: Scope;
  expiresAt?: string;
  serviceIds?: readonly string[];
  clientIds?: readonly string[];
  projectIds?: readonly string[];
  reason?: string;
}
export interface Member {
  id: string; organizationId: string; role: Role; departmentId?: string;
  status: 'invited' | 'active' | 'suspended' | 'revoked' | 'archived';
  overrides: readonly Grant[];
  serviceIds: readonly string[];
  customGrants?: readonly Grant[];
}
export interface RecordContext {
  organizationId: string; createdBy?: string; assignedTo?: readonly string[];
  departmentId?: string; serviceIds?: readonly string[]; clientId?: string; projectId?: string;
}
const roleModules: Record<Exclude<Role,'Owner'>, readonly string[]> = {
  'Operations Admin': ['crm','clients','sales','projects','audits','tasks','content','analytics','services','automations'],
  Sales: ['crm','clients','sales','tasks','services'],
  Delivery: ['projects','tasks','audits','services'],
  Content: ['content','tasks','services'],
  Finance: ['finance','sales','clients','tasks','services'],
  Viewer: ['crm','clients','projects','audits','tasks','content','services'],
};
export function templateGrants(role: Role): readonly Grant[] {
  return Object.freeze(catalogue.filter(p => role === 'Owner' || (
    !p.ownerOnly && roleModules[role].includes(p.module) &&
    (role !== 'Viewer' || p.action === 'read') &&
    (p.module !== 'services' || p.action === 'read') &&
    (role !== 'Finance' || p.module !== 'sales' || p.action === 'read')
  )).map(p => Object.freeze({ key: p.key, effect: 'allow' as const,
    scope: role === 'Owner' || role === 'Operations Admin' ? 'all' as const : 'assigned' as const })));
}
export interface Decision { allowed: boolean; source: string; grant?: Grant }
function active(g: Grant, now: number) {
  return !g.expiresAt || (Number.isFinite(Date.parse(g.expiresAt)) && Date.parse(g.expiresAt) > now);
}
export function effectivePermission(member: Member, key: Permission, now = Date.now()): Decision {
  const p = catalogue.find(p => p.key === key);
  if (!p || member.status !== 'active') return { allowed: false, source: 'Inactive membership or unknown permission' };
  if (p.ownerOnly && member.role !== 'Owner') return { allowed: false, source: 'Owner only' };
  const overrides = member.overrides.filter(g => g.key === key && active(g, now));
  const grant = overrides.find(g => g.effect === 'deny') ?? overrides.find(g => g.effect === 'allow');
  if (grant) return { allowed: grant.effect === 'allow' && grant.scope !== 'none', source: 'Member override', grant };
  const base = (member.customGrants ?? templateGrants(member.role)).filter(g => g.key === key && active(g, now));
  const inherited = base.find(g => g.effect === 'deny') ?? base.find(g => g.effect === 'allow');
  return { allowed: inherited?.effect === 'allow' && inherited.scope !== 'none', source: inherited ? 'Base role' : 'Default deny', grant: inherited };
}
export function can(member: Member, key: Permission, context: RecordContext, now = Date.now()): boolean {
  if (context.organizationId !== member.organizationId) return false;
  const { allowed, grant } = effectivePermission(member,key,now);
  if (!allowed || !grant) return false;
  if ((context.serviceIds ?? []).some(id => member.role !== 'Owner' && !member.serviceIds.includes(id))) return false;
  if (grant.serviceIds && (!context.serviceIds?.length || context.serviceIds.some(id => !grant.serviceIds!.includes(id)))) return false;
  if (grant.clientIds && (!context.clientId || !grant.clientIds.includes(context.clientId))) return false;
  if (grant.projectIds && (!context.projectId || !grant.projectIds.includes(context.projectId))) return false;
  switch (grant.scope) {
    case 'all': return true;
    case 'own': return context.createdBy === member.id;
    case 'assigned': return !!context.assignedTo?.includes(member.id);
    case 'department': return !!member.departmentId && context.departmentId === member.departmentId;
    default: return false;
  }
}
export function getEffectivePermissions(member: Member, now = Date.now()) {
  return Object.fromEntries(permissionKeys.map(key => [key, effectivePermission(member,key,now)])) as Record<Permission,Decision>;
}
export function getVisibleModules(member: Member, now = Date.now()) {
  return [...new Set(catalogue.filter(p => effectivePermission(member,p.key,now).allowed).map(p => p.module))];
}
export function requiresMfa(member: Member) {
  return ['Owner','Operations Admin','Finance'].includes(member.role) || ['team.manage','integrations.manage'].some(key => effectivePermission(member,key as Permission).allowed);
}
export function validateMemberChange(actor: Member, target: Member, next: Member, members: readonly Member[], assurance: { aal2: boolean; recentlyAuthenticated: boolean; confirmed: boolean; actorType: 'human' | 'automation' }) {
  if (actor.role !== 'Owner' || actor.status !== 'active' || actor.organizationId !== target.organizationId || next.organizationId !== target.organizationId || next.id !== target.id) throw new Error('Owner access in the same organization is required.');
  if (!assurance.confirmed || assurance.actorType !== 'human' || !assurance.aal2 || !assurance.recentlyAuthenticated) throw new Error('Owner confirmation, recent authentication and MFA are required.');
  if (actor.id === target.id) throw new Error('Members cannot change their own access.');
  if (target.role === 'Owner' && target.status === 'active' && (next.role !== 'Owner' || next.status !== 'active') && !members.some(m => m.id !== target.id && m.organizationId === target.organizationId && m.role === 'Owner' && m.status === 'active')) throw new Error('The last active Owner must be preserved.');
}
