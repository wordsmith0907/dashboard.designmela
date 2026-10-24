export const permissionKeys = [
  'leads.view','leads.create','leads.edit','leads.delete','clients.view','clients.manage',
  'projects.view','projects.manage','tasks.view','tasks.manage','sales.view','sales.manage',
  'analytics.view','team.view','team.manage','roles.manage','settings.manage','audit.view',
  'content.view','content.manage','automations.view','automations.manage',
] as const;
export type Permission = typeof permissionKeys[number];
export type WorkspaceSession = { organization_id: string; member_id: string; role: string; permissions: Permission[] };
export const routes: { path: string; label: string; permission?: Permission }[] = [
  {path:'/',label:'Today'}, {path:'/crm',label:'CRM',permission:'leads.view'},
  {path:'/clients',label:'Clients',permission:'clients.view'}, {path:'/projects',label:'Projects',permission:'projects.view'},
  {path:'/tasks',label:'Tasks',permission:'tasks.view'}, {path:'/sales',label:'Sales',permission:'sales.view'},
  {path:'/analytics',label:'Analytics',permission:'analytics.view'}, {path:'/audits',label:'Audits',permission:'leads.view'},
  {path:'/content',label:'Content',permission:'content.view'}, {path:'/posted',label:'Posted',permission:'content.view'},
  {path:'/automations',label:'Automations',permission:'automations.view'}, {path:'/team',label:'Team & Access',permission:'team.view'},
  {path:'/settings',label:'Settings',permission:'settings.manage'},
];
export function canAccessRoute(session: WorkspaceSession, path: string) {
  const route = routes.find(r => r.path === path);
  return !!route && (!route.permission || session.permissions.includes(route.permission));
}
