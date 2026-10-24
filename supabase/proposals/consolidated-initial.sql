-- REVIEW PROPOSAL ONLY. Not a migration; never automatically executed.
-- Fresh database only. Reinspect remote history before promoting reviewed SQL
-- into supabase/migrations. No production users or memberships are seeded.
-- Phase 2: explicit grants, scoped RLS and server-only bootstrap. UNAPPLIED.
begin;

revoke create on schema public from public, anon, authenticated, service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(), name text not null,
  require_admin_mfa boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null, avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
  -- No role, membership, ownership or active status in self-editable profiles.
);
create table public.departments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null, archived_at timestamptz, unique(id,organization_id)
);
create table public.roles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null, system_template boolean not null default false,
  created_at timestamptz not null default now(), archived_at timestamptz,
  unique(id,organization_id), unique(organization_id,name)
);
create table public.organization_members (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  user_id uuid not null references public.profiles(id),
  primary_role text not null check(primary_role in ('owner','operations_admin','sales','delivery','content','finance','viewer')),
  custom_role_id uuid, department_id uuid,
  status text not null default 'invited' check(status in ('invited','active','suspended','revoked','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,user_id), unique(id,organization_id),
  foreign key(custom_role_id,organization_id) references public.roles(id,organization_id),
  foreign key(department_id,organization_id) references public.departments(id,organization_id),
  check(primary_role <> 'owner' or (status='active' and custom_role_id is null))
);
create table public.permissions (
  key text primary key, description text not null, owner_only boolean not null default false,
  requires_recent_auth boolean not null default false
);
create table public.role_permissions (
  organization_id uuid not null references public.organizations(id), role_id uuid not null,
  permission_key text not null references public.permissions(key),
  effect text not null check(effect in ('allow','deny')), scope text not null check(scope in ('own','assigned','department','all','none')),
  primary key(role_id,permission_key), foreign key(role_id,organization_id) references public.roles(id,organization_id)
);
create table public.member_permission_overrides (
  organization_id uuid not null references public.organizations(id), member_id uuid not null,
  permission_key text not null references public.permissions(key),
  effect text not null check(effect in ('inherit','allow','deny')), scope text not null check(scope in ('own','assigned','department','all','none')),
  expires_at timestamptz, reason text not null, primary key(member_id,permission_key),
  foreign key(member_id,organization_id) references public.organization_members(id,organization_id)
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  email text not null, status text not null check(status in ('draft','pending','accepted','expired','revoked')),
  role_id uuid, expires_at timestamptz not null, invited_by uuid not null,
  created_at timestamptz not null default now(),
  foreign key(role_id,organization_id) references public.roles(id,organization_id),
  foreign key(invited_by,organization_id) references public.organization_members(id,organization_id)
  -- Invitation delivery and acceptance must use a reviewed authenticated server flow.
);
create table public.permission_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  member_id uuid not null, actor_id uuid not null, snapshot jsonb not null, reason text not null,
  created_at timestamptz not null default now(),
  foreign key(member_id,organization_id) references public.organization_members(id,organization_id),
  foreign key(actor_id,organization_id) references public.organization_members(id,organization_id)
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  actor_id uuid, action text not null, record_id uuid, before_value jsonb, after_value jsonb,
  created_at timestamptz not null default now(),
  foreign key(actor_id,organization_id) references public.organization_members(id,organization_id)
  -- Never store credentials, password material, raw auth tokens or uploaded files.
);

-- Server-derived membership, not editable profile fields or user_metadata.
create function private.is_owner(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_members m
    join auth.users u on u.id=m.user_id join public.organizations o on o.id=m.organization_id
    where m.organization_id=org and m.user_id=auth.uid() and m.status='active'
      and m.primary_role='owner' and u.email_confirmed_at is not null
      and (not o.require_admin_mfa or auth.jwt()->>'aal'='aal2'));
$$;
revoke all on function private.is_owner(uuid) from public, anon;
grant execute on function private.is_owner(uuid) to authenticated;

create function private.current_member_id(org uuid) returns uuid
language sql stable security definer set search_path = '' as $$
 select m.id from public.organization_members m join auth.users u on u.id=m.user_id
 where m.organization_id=org and m.user_id=auth.uid() and m.status='active' and u.email_confirmed_at is not null;
$$;
revoke all on function private.current_member_id(uuid) from public, anon;
grant execute on function private.current_member_id(uuid) to authenticated;

-- Immutable ownership is intentionally stricter than "last Owner": no normal
-- operation can downgrade, suspend, move or delete ANY Owner. Ownership transfer
-- is unavailable until a separate locked, audited, reauthenticated flow is reviewed.
create function private.protect_membership() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.primary_role='owner' then raise exception 'Ownership changes are disabled'; end if;
  if tg_op='DELETE' then raise exception 'Archive memberships; preserve history'; end if;
  if new.id<>old.id or new.organization_id<>old.organization_id or new.user_id<>old.user_id
     or new.primary_role='owner' then raise exception 'Membership identity and ownership are protected'; end if;
  return new;
end; $$;
create trigger protect_membership before update or delete on public.organization_members
for each row execute function private.protect_membership();

create function private.immutable_history() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Append-only history cannot be changed or truncated'; end; $$;
create trigger audit_immutable before update or delete or truncate on public.audit_logs
for each statement execute function private.immutable_history();
create trigger versions_immutable before update or delete or truncate on public.permission_versions
for each statement execute function private.immutable_history();

create function private.protect_template() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.system_template then raise exception 'System role templates are immutable'; end if;
  if tg_op='DELETE' then raise exception 'Archive roles; preserve history'; end if;
  if new.id<>old.id or new.organization_id<>old.organization_id or new.system_template
    then raise exception 'Role identity and template flag are protected'; end if;
  return new;
end; $$;
create trigger protect_role_template before update or delete on public.roles
for each row execute function private.protect_template();

-- Only this narrow function can change an ordinary member's role/status.
-- It cannot create Owners, modify self, move memberships or delete history.
create function public.owner_update_member(org uuid, target uuid, next_role text, next_status text, reason text, confirmed boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare actor public.organization_members; previous public.organization_members; changed public.organization_members;
begin
  if not private.is_owner(org) or confirmed is distinct from true or reason is null or length(trim(reason))<3
    then raise exception 'Verified Owner confirmation and reason required'; end if;
  perform 1 from public.organizations where id=org for update;
  if not private.is_owner(org) then raise exception 'Owner access changed'; end if;
  -- Session refresh alone is not reauthentication: require recent password AMR.
  if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
      where a->>'method'='password' and (a->>'timestamp')::numeric
        between extract(epoch from now())-300 and extract(epoch from now())+30)
    then raise exception 'Recent password authentication required'; end if;
  select * into strict actor from public.organization_members where organization_id=org and user_id=auth.uid();
  select * into strict previous from public.organization_members where id=target and organization_id=org for update;
  if previous.user_id=auth.uid() or previous.primary_role='owner'
    then raise exception 'Cannot change own access or ownership'; end if;
  if next_role is null or next_status is null or next_role not in ('operations_admin','sales','delivery','content','finance','viewer')
    or next_status not in ('active','suspended','revoked','archived') then raise exception 'Unsupported access change'; end if;
  if next_status='active' and not exists(select 1 from auth.users where id=previous.user_id and email_confirmed_at is not null)
    then raise exception 'Email verification required before activation'; end if;
  update public.organization_members set primary_role=next_role, status=next_status,
    custom_role_id=null, updated_at=now() where id=target returning * into changed;
  insert into public.permission_versions(organization_id,member_id,actor_id,snapshot,reason)
    values(org,target,actor.id,jsonb_build_object('before',to_jsonb(previous),'after',to_jsonb(changed)),reason);
  insert into public.audit_logs(organization_id,actor_id,action,record_id,before_value,after_value)
    values(org,actor.id,'member access changed',target,to_jsonb(previous),to_jsonb(changed));
end; $$;
revoke all on function public.owner_update_member(uuid,uuid,text,text,text,boolean) from public, anon, service_role;
grant execute on function public.owner_update_member(uuid,uuid,text,text,text,boolean) to authenticated;

-- Business schema and scoped policies follow below. No owner_id
-- policy survives from the obsolete drafts. Child references include organization.

create table public.leads (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null, company text not null, email text, phone text, country text, source text, service text,
 stage text not null default 'New' check(stage in ('New','Contacted','Qualified','Meeting','Proposal','Won','Lost')),
 estimated_value numeric(14,2) not null default 0 check(estimated_value>=0), next_follow_up date,
 assigned_owner text, tags text[] not null default '{}', notes text, last_activity_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id)
);
create table public.activities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), lead_id uuid not null,
 kind text not null check(kind in ('Note','Activity','Communication')), description text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id) on delete restrict
);
create table public.audits (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), lead_id uuid,
 title text not null, website_url text not null, audit_type text not null,
 status text not null check(status in ('Requested','Reviewing','Draft ready','Sent','Follow-up','Converted','Closed')),
 score integer check(score between 0 and 100), score_is_fictional boolean not null default true,
 requested_date date, due_date date, assigned_owner text, findings text, recommendations text, report_url text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id), check(due_date>=requested_date)
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), lead_id uuid,
 name text not null, client text not null, service text,
 status text not null check(status in ('Planned','Active','Waiting for client','Review','Completed','On hold')),
 priority text not null check(priority in ('Low','Medium','High')), start_date date, due_date date,
 progress numeric not null default 0 check(progress between 0 and 100), next_action text, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id), check(due_date>=start_date)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), lead_id uuid, audit_id uuid,
 title text not null, due_date date not null, done boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id), foreign key(audit_id,organization_id) references public.audits(id,organization_id)
);
create table public.content_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 title text not null, client text not null, content_type text, platform text not null, campaign text,
 status text not null check(status in ('Idea','Drafting','Designing','Internal review','Client approval','Approved','Scheduled','Published','Failed','Archived')),
 scheduled_at timestamptz, caption text, asset_url text, approval_notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 check(status<>'Scheduled' or scheduled_at is not null)
);
create table public.automation_workflows (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null, category text, status text, last_run timestamptz, next_run timestamptz,
 success_count integer not null default 0, failure_count integer not null default 0, last_error text, n8n_workflow_id text, workflow_url text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id)
);
create table public.automation_runs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), workflow_id uuid not null,
 status text not null check(status in ('Queued','Running','Successful','Failed','Cancelled')), started_at timestamptz, error text,
 external_event_id text, unique(organization_id,external_event_id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(workflow_id,organization_id) references public.automation_workflows(id,organization_id)
);
create table public.published_posts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), content_id uuid not null unique,
 title text not null, platform text not null, client text not null, campaign text, published_at timestamptz not null,
 live_url text not null check(live_url ~ '^https?://'), asset_url text, original_scheduled_at timestamptz,
 method text not null check(method in ('Manual','Automation')), run_id uuid, initial_status text not null, notes text,
 likes bigint, clicks bigint, reach bigint, engagement numeric, conversions bigint,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(content_id,organization_id) references public.content_items(id,organization_id),
 foreign key(run_id,organization_id) references public.automation_runs(id,organization_id), check(method<>'Automation' or run_id is not null)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), title text not null,
 read boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.clients (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 lead_id uuid, name text not null, company text not null, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id)
);
create table public.services (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null, description text, base_price numeric(14,2) not null default 0 check(base_price>=0),
 currency text not null default 'INR', unit text, duration text, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id)
);
create table public.member_service_access (
 organization_id uuid not null references public.organizations(id), member_id uuid not null, service_id uuid not null,
 primary key(member_id,service_id),
 foreign key(member_id,organization_id) references public.organization_members(id,organization_id),
 foreign key(service_id,organization_id) references public.services(id,organization_id)
);
create table public.quotes (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 lead_id uuid, client_id uuid, title text not null, currency text not null,
 discount numeric(14,2) not null default 0 check(discount>=0), tax numeric(6,3) not null default 0 check(tax between 0 and 100),
 status text not null check(status in ('Draft','Sent','Accepted','Rejected','Expired','Cancelled')), notes text, valid_until date,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id),
 foreign key(client_id,organization_id) references public.clients(id,organization_id)
);
create table public.quote_items (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 quote_id uuid not null, service_id uuid, description text not null,
 quantity numeric not null check(quantity>0), price numeric(14,2) not null check(price>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(quote_id,organization_id) references public.quotes(id,organization_id),
 foreign key(service_id,organization_id) references public.services(id,organization_id)
);
create table public.proposals (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 lead_id uuid, quote_id uuid, title text not null, scope text, deliverables text, timeline text, revisions text,
 price numeric(14,2) not null default 0 check(price>=0), currency text not null, valid_until date,
 status text not null check(status in ('Draft','Ready','Sent','Accepted','Rejected','Expired')),
 sent_at timestamptz, decision_at timestamptz, follow_up_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id),
 foreign key(quote_id,organization_id) references public.quotes(id,organization_id)
);
create table public.payments (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 lead_id uuid, quote_id uuid, proposal_id uuid, title text not null, amount numeric(14,2) not null check(amount>=0),
 currency text not null, due_date date, status text not null check(status in ('Due','Paid','Overdue')), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id),
 foreign key(quote_id,organization_id) references public.quotes(id,organization_id),
 foreign key(proposal_id,organization_id) references public.proposals(id,organization_id)
);
create table public.lead_activities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 lead_id uuid not null, type text not null, description text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id)
);
create table public.follow_ups (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 lead_id uuid not null, title text not null, due_at timestamptz not null, completed_at timestamptz,
 type text not null, priority text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id)
);
create table public.import_jobs (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 filename text not null, status text not null, undo_summary jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,organization_id)
);
create table public.import_rows (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 import_id uuid not null, lead_id uuid, row_number integer not null check(row_number>0), status text not null,
 message text, undo_outcome text check(undo_outcome in ('Deleted','Preserved','Skipped','Failed')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(import_id,row_number),
 foreign key(import_id,organization_id) references public.import_jobs(id,organization_id),
 foreign key(lead_id,organization_id) references public.leads(id,organization_id)
);
create table public.website_events (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 event_name text not null check(event_name in ('page_viewed','cta_clicked','form_opened','form_started','form_submitted','meeting_booked','lead_qualified','proposal_created','client_won')),
 cta_id text not null, page_path text not null, session_id text not null, occurred_at timestamptz not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
 -- No anonymous insert policy. Ingestion remains disconnected pending reviewed server endpoint.
);

create function private.preserve_record_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
 if new.id<>old.id or new.organization_id<>old.organization_id or new.created_by is distinct from old.created_by
 then raise exception 'Record identity, organization and creator are immutable'; end if;
 new.updated_at=now(); return new;
end; $$;

-- Explicit canonical capabilities; future modules can add keys without changing identity.
insert into public.permissions(key,description,owner_only,requires_recent_auth) values
 ('leads.view','View leads',false,false),('leads.create','Create leads',false,false),
 ('leads.edit','Edit leads',false,false),('leads.delete','Archive leads',false,false),
 ('clients.view','View clients',false,false),('clients.manage','Manage clients',false,false),
 ('projects.view','View projects',false,false),('projects.manage','Manage projects',false,false),
 ('tasks.view','View tasks',false,false),('tasks.manage','Manage tasks',false,false),
 ('sales.view','View sales',false,false),('sales.manage','Manage sales',false,false),
 ('analytics.view','View analytics',false,false),('team.view','View team',false,false),
 ('team.manage','Manage team access',true,true),('roles.manage','Manage roles',true,true),
 ('settings.manage','Manage workspace settings',true,true),('audit.view','View audit history',false,false),
 ('content.view','View content',false,false),('content.manage','Manage content',false,false),
 ('automations.view','View automations',false,false),('automations.manage','Manage automations',false,false);

-- These DEFINER functions read base tables as the migration owner; policy evaluation
-- never queries the same table through its own RLS. No user-editable JWT metadata.
create function private.permission_scope(org uuid, capability text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare m public.organization_members; p public.permissions; o public.member_permission_overrides;
 r public.role_permissions; role_uuid uuid;
begin
 select * into m from public.organization_members where organization_id=org and user_id=auth.uid() and status='active';
 if not found or not exists(select 1 from auth.users where id=m.user_id and email_confirmed_at is not null) then return 'none'; end if;
 if m.primary_role in ('owner','operations_admin') and exists(select 1 from public.organizations where id=org and require_admin_mfa)
   and coalesce(auth.jwt()->>'aal','')<>'aal2' then return 'none'; end if;
 select * into p from public.permissions where key=capability;
 if not found then return 'none'; end if;
 if m.primary_role='owner' then return 'all'; end if;
 if p.owner_only then return 'none'; end if;
 select * into o from public.member_permission_overrides where organization_id=org and member_id=m.id
   and permission_key=capability and (expires_at is null or expires_at>now());
 if found and o.effect='deny' then return 'none'; end if;
 -- Role deny wins over explicit allow; expiry and inherit never create permissions.
 role_uuid := m.custom_role_id;
 if role_uuid is null then select id into role_uuid from public.roles where organization_id=org and name=m.primary_role and system_template and archived_at is null;
 elsif not exists(select 1 from public.roles where id=role_uuid and organization_id=org and archived_at is null) then return 'none'; end if;
 select * into r from public.role_permissions where organization_id=org and role_id=role_uuid and permission_key=capability;
 if found and r.effect='deny' then return 'none'; end if;
 if o.effect='allow' then return o.scope; end if;
 if r.effect='allow' then return r.scope; end if;
 return 'none';
end; $$;
create function private.can_access(org uuid, capability text, creator uuid, assignee uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare s text; m public.organization_members;
begin
 s:=private.permission_scope(org,capability);
 if s='none' then return false; end if;
 if s='all' then return true; end if;
 select * into m from public.organization_members where organization_id=org and user_id=auth.uid() and status='active';
 if s='own' then return coalesce(creator=m.id,false); end if;
 if s='assigned' then return coalesce(assignee=m.id,false); end if;
 if s='department' then return m.department_id is not null and exists(select 1 from public.organization_members
   where id=assignee and organization_id=org and department_id=m.department_id and status='active'); end if;
 return false;
end; $$;
revoke all on function private.permission_scope(uuid,text),private.can_access(uuid,text,uuid,uuid) from public,anon;
grant execute on function private.permission_scope(uuid,text),private.can_access(uuid,text,uuid,uuid) to authenticated;

create function public.workspace_session(org uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('organization_id',m.organization_id,'member_id',m.id,'role',m.primary_role,
   'permissions',coalesce((select jsonb_agg(p.key order by p.key) from public.permissions p where private.permission_scope(org,p.key)<>'none'),'[]'::jsonb))
 from public.organization_members m join auth.users u on u.id=m.user_id join public.organizations o on o.id=m.organization_id
 where m.organization_id=org and m.user_id=auth.uid() and m.status='active' and u.email_confirmed_at is not null
 and (m.primary_role not in ('owner','operations_admin') or not o.require_admin_mfa or auth.jwt()->>'aal'='aal2');
$$;
revoke all on function public.workspace_session(uuid) from public,anon,service_role;
grant execute on function public.workspace_session(uuid) to authenticated;

-- A caller cannot reassign records to broaden its scope. Archive is explicit;
-- ordinary edits cannot smuggle lead deletion or restore archived records.
create function private.guard_business_write() returns trigger
language plpgsql set search_path = '' as $$
begin
 if tg_op='INSERT' then
   if new.assigned_to is distinct from private.current_member_id(new.organization_id) and not private.is_owner(new.organization_id)
     then raise exception 'Only an Owner can assign another member'; end if;
   if new.archived_at is not null then raise exception 'Create active records first'; end if;
 else
   if new.assigned_to is distinct from old.assigned_to and not private.is_owner(new.organization_id)
     then raise exception 'Only an Owner can reassign records'; end if;
   if new.archived_at is distinct from old.archived_at then
     if tg_table_name='leads' and not private.can_access(new.organization_id,'leads.delete',old.created_by,old.assigned_to)
       then raise exception 'Lead archival permission required'; end if;
     if old.archived_at is not null and not private.is_owner(new.organization_id) then raise exception 'Only an Owner can restore records'; end if;
   end if;
 end if;
 return new;
end; $$;
create function private.log_business_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.audit_logs(organization_id,actor_id,action,record_id,after_value)
 values(new.organization_id,private.current_member_id(new.organization_id),tg_table_name||':'||lower(tg_op),new.id,
   jsonb_build_object('archived',new.archived_at is not null));
 return new;
end; $$;

-- Read/create/update capabilities per table. No authenticated hard DELETE.
do $$ declare t text; read_key text; write_key text; create_key text; begin
 foreach t in array array['leads','activities','audits','projects','tasks','content_items',
 'automation_workflows','automation_runs','published_posts','notifications','clients','services',
 'quotes','quote_items','proposals','payments','lead_activities','follow_ups','import_jobs','import_rows','website_events'] loop
  read_key:=case when t='clients' then 'clients.view' when t='projects' then 'projects.view' when t in ('tasks','notifications') then 'tasks.view'
   when t in ('services','quotes','quote_items','proposals','payments') then 'sales.view' when t in ('content_items','published_posts') then 'content.view'
   when t in ('automation_workflows','automation_runs') then 'automations.view' when t='website_events' then 'analytics.view' else 'leads.view' end;
  write_key:=case when t='clients' then 'clients.manage' when t='projects' then 'projects.manage' when t in ('tasks','notifications') then 'tasks.manage'
   when t in ('services','quotes','quote_items','proposals','payments') then 'sales.manage' when t in ('content_items','published_posts') then 'content.manage'
   when t in ('automation_workflows','automation_runs') then 'automations.manage' when t='website_events' then 'settings.manage' else 'leads.edit' end;
  create_key:=case when t='leads' then 'leads.create' else write_key end;
  execute format('alter table public.%I add column created_by uuid not null, add column assigned_to uuid, add column archived_at timestamptz',t);
  execute format('alter table public.%I add foreign key(created_by,organization_id) references public.organization_members(id,organization_id), add foreign key(assigned_to,organization_id) references public.organization_members(id,organization_id)',t);
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated, service_role',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('create policy scoped_read on public.%I for select to authenticated using (private.can_access(organization_id,%L,created_by,assigned_to))',t,read_key);
  execute format('create policy scoped_insert on public.%I for insert to authenticated with check (private.can_access(organization_id,%L,created_by,assigned_to) and created_by=private.current_member_id(organization_id))',t,create_key);
  execute format('create policy scoped_update on public.%I for update to authenticated using (private.can_access(organization_id,%L,created_by,assigned_to)) with check (private.can_access(organization_id,%L,created_by,assigned_to))',t,write_key,write_key);
  execute format('create trigger preserve_identity before update on public.%I for each row execute function private.preserve_record_identity()',t);
  execute format('create trigger guard_business_write before insert or update on public.%I for each row execute function private.guard_business_write()',t);
  execute format('create trigger audit_business_write after insert or update on public.%I for each row execute function private.log_business_write()',t);
  execute format('create index on public.%I(organization_id,created_at,id)',t);
  execute format('create index on public.%I(organization_id,assigned_to)',t);
  execute format('create index on public.%I(organization_id,created_by)',t);
 end loop;
end $$;

-- Access metadata: SELECT only; no direct client insert/update/delete grants.
do $$ declare t text; begin
 foreach t in array array['departments','roles','organization_members','role_permissions','member_permission_overrides',
 'member_service_access','invitations','permission_versions','audit_logs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated, service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy owner_read on public.%I for select to authenticated using (private.is_owner(organization_id))',t);
  execute format('create index on public.%I(organization_id)',t);
 end loop;
end $$;
create policy own_membership_read on public.organization_members for select to authenticated
 using (user_id=auth.uid() and id=private.current_member_id(organization_id));
create policy audit_capability_read on public.audit_logs for select to authenticated
 using (private.permission_scope(organization_id,'audit.view')='all');
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on public.profiles from public, anon, authenticated, service_role;
grant select on public.profiles to authenticated;
grant update(display_name,avatar_url) on public.profiles to authenticated;
create policy own_profile_read on public.profiles for select to authenticated using (id=(select auth.uid()) and exists(select 1 from public.organization_members where user_id=auth.uid() and private.current_member_id(organization_id) is not null));
create policy own_profile_edit on public.profiles for update to authenticated using (id=(select auth.uid()) and exists(select 1 from public.organization_members where user_id=auth.uid() and private.current_member_id(organization_id) is not null)) with check(id=(select auth.uid()));
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
revoke all on public.organizations from public, anon, authenticated, service_role;
grant select on public.organizations to authenticated;
create policy owner_read on public.organizations for select to authenticated using (private.current_member_id(id) is not null);
alter table public.permissions enable row level security;
alter table public.permissions force row level security;
revoke all on public.permissions from public, anon, authenticated, service_role;
grant select on public.permissions to authenticated;
create policy owner_read on public.permissions for select to authenticated using (
 exists(select 1 from public.organization_members where user_id=auth.uid() and private.is_owner(organization_id))
);
revoke insert,update,delete,truncate on public.audit_logs,public.permission_versions from service_role;
-- Triggers are invoked by PostgreSQL only; never expose helper RPCs publicly.
revoke all on function private.protect_membership(), private.immutable_history(), private.protect_template(), private.preserve_record_identity() from public, anon, authenticated;
create index on public.organization_members(user_id,organization_id,status);
create index on public.member_permission_overrides(organization_id,member_id,permission_key,expires_at);
create index on public.leads(organization_id,stage,next_follow_up);
create index on public.leads(organization_id,source,created_at);
create index on public.audit_logs(organization_id,created_at);
create index on public.follow_ups(organization_id,due_at);

-- CRM2 source/scoring fields are additive. No silent import of local demo data.
alter table public.leads
 add column city text, add column primary_source text, add column source_details text,
 add column campaign text, add column referrer_name text, add column landing_page_url text,
 add column social_post_url text, add column imported_filename text, add column utm_source text,
 add column utm_medium text, add column utm_campaign text, add column utm_content text,
 add column first_touch_source text, add column latest_touch_source text,
 add column temperature text not null default 'Cold' check(temperature in ('Hot','Warm','Cold')),
 add column score integer not null default 0 check(score between 0 and 100),
 add column score_reasons text[] not null default '{}', add column manual_score integer check(manual_score between 0 and 100),
 add column currency text not null default 'INR', add column services text[] not null default '{}',
 add column last_contacted_at timestamptz, add column next_follow_up_at timestamptz,
 add column lost_reason text, add column won_at timestamptz,
 add column consent_status text not null default 'Unknown' check(consent_status in ('Unknown','Granted','Denied','Not required')),
 add column positive_reply boolean not null default false, add column proposal_requested boolean not null default false,
 add column import_id uuid,
 add foreign key(import_id,organization_id) references public.import_jobs(id,organization_id);
alter table public.import_rows add column created_version jsonb, add column undo_message text;
alter table public.follow_ups add column reminder_status text not null default 'In dashboard' check(reminder_status in ('In dashboard','Dismissed'));
alter table public.projects add constraint projects_id_org unique(id,organization_id);
alter table public.proposals add column project_id uuid,
 add foreign key(project_id,organization_id) references public.projects(id,organization_id);

-- Every referencing FK gets an index, including compound tenant references.
-- Deliberately conservative: some overlap with PK/unique indexes, acceptable for
-- this small initial schema; measure before removing any in a later migration.
do $$ declare fk record; cols text; begin
 for fk in select c.oid,c.conrelid,c.conkey,n.nspname,t.relname,c.conname
 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
 where c.contype='f' and n.nspname='public' loop
  select string_agg(quote_ident(a.attname),',' order by u.ordinality) into cols
    from unnest(fk.conkey) with ordinality u(attnum,ordinality)
    join pg_attribute a on a.attrelid=fk.conrelid and a.attnum=u.attnum;
  execute format('create index %I on %I.%I(%s)','fk_'||fk.oid,fk.nspname,fk.relname,cols);
 end loop;
end $$;

-- Prevent committed ownerless organizations; the lock serializes concurrent
-- changes per workspace. Existing immutable-owner trigger is stricter still.
create function private.assert_active_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare org uuid;
begin
 if tg_table_name='organizations' then org:=new.id;
 elsif tg_op='DELETE' then org:=old.organization_id; else org:=new.organization_id; end if;
 perform 1 from public.organizations where id=org for update;
 if exists(select 1 from public.organizations where id=org) and not exists(
   select 1 from public.organization_members where organization_id=org and primary_role='owner' and status='active')
 then raise exception 'Every workspace requires an active Owner'; end if;
 return null;
end; $$;
create constraint trigger organization_requires_owner after insert or update on public.organizations
 deferrable initially deferred for each row execute function private.assert_active_owner();
create constraint trigger membership_requires_owner after insert or update or delete on public.organization_members
 deferrable initially deferred for each row execute function private.assert_active_owner();

-- The singleton exists before any bootstrap call so concurrent calls lock the
-- same row even on a completely empty installation. No ordinary user can read it.
create table private.bootstrap_state (
 singleton boolean primary key default true check(singleton),
 organization_id uuid references public.organizations(id), owner_user_id uuid references auth.users(id)
);
insert into private.bootstrap_state(singleton) values(true);
alter table private.bootstrap_state enable row level security;
alter table private.bootstrap_state force row level security;
revoke all on private.bootstrap_state from public,anon,authenticated,service_role;

create function public.bootstrap_first_owner(verified_user uuid, expected_email text, workspace_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare state private.bootstrap_state; org uuid; member uuid; role_uuid uuid; role_name text; allowed text[];
begin
 -- The calling server verifies the current session AND its INITIAL_OWNER_EMAIL.
 -- SQL independently verifies identity/email. Only the service role may invoke.
 if expected_email is null or length(trim(expected_email))<3 or not exists(select 1 from auth.users
   where id=verified_user and email_confirmed_at is not null and lower(email)=lower(trim(expected_email)))
 then raise exception 'Verified configured Owner required'; end if;
 if workspace_name is null or length(trim(workspace_name)) not between 2 and 100 then raise exception 'Invalid workspace name'; end if;
 select * into strict state from private.bootstrap_state where singleton for update;
 if state.organization_id is not null then
   if state.owner_user_id=verified_user then return state.organization_id; end if;
   raise exception 'Initial bootstrap is already complete';
 end if;
 if exists(select 1 from public.organizations) then raise exception 'Existing workspace requires manual review'; end if;
 insert into public.profiles(id,display_name) values(verified_user,'Workspace Owner') on conflict(id) do nothing;
 insert into public.organizations(name) values(trim(workspace_name)) returning id into org;
 foreach role_name in array array['owner','operations_admin','sales','delivery','content','finance','viewer'] loop
   insert into public.roles(organization_id,name,system_template) values(org,role_name,true) returning id into role_uuid;
   allowed:=case role_name
    when 'sales' then array['leads.view','leads.create','leads.edit','clients.view','clients.manage','tasks.view','tasks.manage','sales.view','sales.manage']
    when 'delivery' then array['clients.view','projects.view','projects.manage','tasks.view','tasks.manage']
    when 'content' then array['content.view','content.manage','tasks.view','tasks.manage']
    when 'finance' then array['clients.view','sales.view','sales.manage','analytics.view']
    when 'viewer' then array['leads.view','clients.view','projects.view','tasks.view','sales.view','analytics.view','content.view']
    else array[]::text[] end;
   insert into public.role_permissions(organization_id,role_id,permission_key,effect,scope)
   select org,role_uuid,p.key,'allow','all' from public.permissions p
   where role_name='owner' or (role_name='operations_admin' and not p.owner_only) or p.key=any(allowed);
 end loop;
 insert into public.organization_members(organization_id,user_id,primary_role,status)
 values(org,verified_user,'owner','active') returning id into member;
 insert into public.audit_logs(organization_id,actor_id,action,record_id) values(org,member,'initial owner bootstrap',member);
 insert into public.permission_versions(organization_id,member_id,actor_id,snapshot,reason)
 values(org,member,member,jsonb_build_object('primary_role','owner'),'Initial owner bootstrap');
 update private.bootstrap_state set organization_id=org,owner_user_id=verified_user where singleton;
 return org;
end; $$;
revoke all on function public.bootstrap_first_owner(uuid,text,text) from public,anon,authenticated;
grant execute on function public.bootstrap_first_owner(uuid,text,text) to service_role;

-- Future table creation is closed by default. Schema-change automation must run
-- as the same reviewed migration role. Event triggers require managed-DB support;
-- inability to create this trigger is a blocking error, never silently ignored.
-- Per-schema revokes cannot cancel a global default grant (notably PostgreSQL's
-- default PUBLIC EXECUTE). Revoke both levels for the migration role.
alter default privileges revoke all on tables from public,anon,authenticated,service_role;
alter default privileges revoke execute on functions from public,anon,authenticated,service_role;
alter default privileges in schema public revoke all on tables from public,anon,authenticated,service_role;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated,service_role;
create function private.rls_new_public_tables() returns event_trigger
language plpgsql security definer set search_path = '' as $$
declare cmd record;
begin
 for cmd in select * from pg_event_trigger_ddl_commands() where schema_name='public' and object_type in ('table','partitioned table') and not in_extension loop
   execute format('alter table %s enable row level security',cmd.object_identity);
   execute format('alter table %s force row level security',cmd.object_identity);
   execute format('revoke all on %s from public,anon,authenticated,service_role',cmd.object_identity);
 end loop;
end; $$;
create event trigger designmela_default_rls on ddl_command_end
 when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') execute function private.rls_new_public_tables();
revoke all on function private.guard_business_write(),private.log_business_write(),private.assert_active_owner(),private.rls_new_public_tables()
 from public,anon,authenticated,service_role;

commit;
-- STILL UNAPPLIED. Static review is not execution-level verification. Before any
-- hosted apply, run the approval-gated disposable-database acceptance checklist.
