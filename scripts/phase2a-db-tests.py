"""Disposable LOCAL Supabase validation. Never reads DATABASE_URL or remote data.
uv run --with "psycopg[binary]" python scripts/phase2a-db-tests.py --apply
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import json
import subprocess
import sys
import time
import uuid
import base64
import hashlib
import hmac
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import psycopg
from psycopg import sql

ROOT = Path(__file__).resolve().parent.parent
CONTAINER = 'supabase_db_designmela-phase2a-disposable'
PROJECT = 'designmela-phase2a-disposable'
RESULTS = []


def local_config():
    result = subprocess.run(['docker','inspect',CONTAINER],capture_output=True,text=True,check=True)
    data = json.loads(result.stdout)[0]
    assert data['Config']['Labels']['com.supabase.cli.project'] == PROJECT, 'Wrong disposable project'
    ports = data['HostConfig']['PortBindings']['5432/tcp']
    assert any(p['HostPort']=='58422' for p in ports), 'Wrong disposable port'
    env = dict(item.split('=',1) for item in data['Config']['Env'] if '=' in item)
    assert env.get('POSTGRES_PASSWORD'), 'Local container credential unavailable'
    return dict(host='127.0.0.1',port=58422,dbname='postgres',user='postgres',password=env['POSTGRES_PASSWORD'],
                connect_timeout=10,options='-c statement_timeout=10000 -c lock_timeout=5000')


CONFIG = None


def connection():
    assert CONFIG['host']=='127.0.0.1' and CONFIG['port']==58422
    return psycopg.connect(**CONFIG)


def admin(query,params=(),fetch=True):
    with connection() as conn:
        cursor = conn.execute(query,params)
        return cursor.fetchall() if fetch and cursor.description else cursor.rowcount


def claims(user,aal='aal1',recent=True):
    return json.dumps({'sub':str(user),'role':'authenticated','aal':aal,
                       'amr':[{'method':'password','timestamp':int(time.time())-(0 if recent else 3600)}]})


def as_user(user,query,params=(),role='authenticated',aal='aal1',recent=True):
    with connection() as conn:
        conn.execute(sql.SQL('set local role {}').format(sql.Identifier(role)))
        conn.execute("select set_config('request.jwt.claims',%s,true)",(claims(user,aal,recent),))
        cursor=conn.execute(query,params)
        return cursor.fetchall() if cursor.description else cursor.rowcount


def denied(action,codes=('42501','P0001','23514','23503')):
    try:
        result=action()
    except psycopg.Error as error:
        assert error.sqlstate in codes, f'Unexpected SQLSTATE {error.sqlstate}'
        return
    assert result in ([],0), 'Forbidden operation succeeded'


def check(name,action):
    try:
        action()
        RESULTS.append({'test':name,'result':'PASS'})
    except Exception as error:
        RESULTS.append({'test':name,'result':'FAIL','error_type':type(error).__name__,
                        'sqlstate':getattr(error,'sqlstate',None),
                        'reason':str(error) if isinstance(error,AssertionError) else 'Database error; details suppressed'})
    print(json.dumps(RESULTS[-1]),flush=True)


def equal(actual,expected):
    assert actual==expected, 'Unexpected result'


def uid():
    return uuid.uuid4()


def auth_user(email,verified=True):
    user=uid()
    admin("insert into auth.users(id,email,email_confirmed_at,aud,role) values(%s,%s,case when %s then now() else null end,'authenticated','authenticated')",(user,email,verified),False)
    return user


def bootstrap(user,email):
    return as_user(user,'select public.bootstrap_first_owner(%s,%s,%s)',(user,email,'Fictional validation workspace'),role='service_role')[0][0]


def apply():
    assert admin("select to_regclass('public.organizations')")[0][0] is None, 'Local database already contains CRM schema; reset explicitly first'
    with connection() as conn:
        conn.autocommit=True
        try:
            conn.execute((ROOT/'supabase/proposals/consolidated-initial.sql').read_text(encoding='utf-8'),prepare=False)
        except Exception:
            conn.execute('rollback')
            raise
    equal(admin("select count(*) from pg_tables where schemaname='public'")[0][0],33)
    print(json.dumps({'migration':'PASS','target':'isolated local database','public_tables':33}),flush=True)


def matrix(owner,org,owner_member,users,members,lead):
    workflow,content,import_job,quote=uid(),uid(),uid(),uid()
    records={
      'leads':{'name':'Matrix lead','company':'Fictional'},
      'activities':{'lead_id':lead,'kind':'Note','description':'Fixture'},
      'audits':{'lead_id':lead,'title':'Fixture','website_url':'https://example.invalid','audit_type':'UX','status':'Requested'},
      'projects':{'name':'Fixture','client':'Fictional','status':'Planned','priority':'Low'},
      'tasks':{'title':'Fixture','due_date':'2026-12-01'},
      'content_items':{'id':content,'title':'Fixture','client':'Fictional','platform':'Website','status':'Idea'},
      'automation_workflows':{'id':workflow,'name':'Fixture'},
      'automation_runs':{'workflow_id':workflow,'status':'Queued'},
      'published_posts':{'content_id':content,'title':'Fixture','platform':'Website','client':'Fictional','published_at':'2026-10-24T00:00:00Z','live_url':'https://example.invalid','method':'Manual','initial_status':'Published'},
      'notifications':{'title':'Fixture'},
      'clients':{'name':'Fixture','company':'Fictional'},
      'services':{'name':'Fixture'},
      'quotes':{'id':quote,'title':'Fixture','currency':'INR','status':'Draft'},
      'quote_items':{'quote_id':quote,'description':'Fixture','quantity':1,'price':1},
      'proposals':{'title':'Fixture','currency':'INR','status':'Draft'},
      'payments':{'title':'Fixture','amount':1,'currency':'INR','status':'Due'},
      'lead_activities':{'lead_id':lead,'type':'Note added','description':'Fixture'},
      'follow_ups':{'lead_id':lead,'title':'Fixture','due_at':'2026-12-01T00:00:00Z','type':'Call','priority':'Low'},
      'import_jobs':{'id':import_job,'filename':'fictional.csv','status':'Completed'},
      'import_rows':{'import_id':import_job,'row_number':1,'status':'Created'},
      'website_events':{'event_name':'page_viewed','cta_id':'fixture','page_path':'/fixture','session_id':'fixture','occurred_at':'2026-10-24T00:00:00Z'},
    }
    groups={t:'leads' for t in records}
    for group,tables in {'clients':['clients'],'projects':['projects'],'tasks':['tasks','notifications'],
      'sales':['services','quotes','quote_items','proposals','payments'],'content':['content_items','published_posts'],
      'automations':['automation_workflows','automation_runs'],'analytics':['website_events']}.items():
        for table in tables: groups[table]=group
    reads={'owner':set(groups.values()),'operations_admin':set(groups.values()),'sales':{'leads','clients','tasks','sales'},
      'delivery':{'clients','projects','tasks'},'content':{'content','tasks'},'finance':{'clients','sales','analytics'},
      'viewer':{'leads','clients','projects','tasks','sales','analytics','content'}}
    writes={'owner':set(groups.values()),'operations_admin':set(groups.values())-{'analytics'},
      'sales':{'leads','clients','tasks','sales'},'delivery':{'projects','tasks'},'content':{'content','tasks'},'finance':{'sales'},'viewer':set()}
    def insert(table,data,user,member):
        values={'id':uid(),**data,'organization_id':org,'created_by':member,'assigned_to':member}
        query=sql.SQL('insert into public.{} ({}) values ({}) returning id').format(sql.Identifier(table),
          sql.SQL(',').join(map(sql.Identifier,values)),sql.SQL(',').join(sql.Placeholder() for _ in values))
        return as_user(user,query,tuple(values.values()))[0][0]
    fixtures={table:insert(table,data,owner,owner_member) for table,data in records.items()}
    actors={'owner':owner,**users};member_map={'owner':owner_member,**members}
    counter=1
    for role,user in actors.items():
        for table,data in records.items():
            group=groups[table];record=fixtures[table]
            def exercise(role=role,user=user,table=table,data=data,group=group,record=record):
                nonlocal counter
                visible=as_user(user,sql.SQL('select id from public.{} where id=%s').format(sql.Identifier(table)),(record,))
                equal(len(visible),1 if group in reads[role] else 0)
                update=lambda:as_user(user,sql.SQL('update public.{} set updated_at=now() where id=%s returning id').format(sql.Identifier(table)),(record,))
                if group in writes[role]: equal(len(update()),1)
                else: denied(update)
                payload={k:v for k,v in data.items() if k!='id'}
                if table=='import_rows': counter+=1;payload['row_number']=counter
                if table=='published_posts':
                    payload['content_id']=insert('content_items',{k:v for k,v in records['content_items'].items() if k!='id'},owner,owner_member)
                action=lambda:insert(table,payload,user,member_map[role])
                if group in writes[role]: action()
                else: denied(action)
            check(f'matrix {role}: {table} SELECT/INSERT/UPDATE',exercise)


def api_tests(owner,org,owner_member,users,members,other_lead):
    # Generated LOCAL credentials remain in memory and are never added to .env.
    status=subprocess.run(['npx.cmd','--yes','supabase@2.122.0','status','--workdir',str(ROOT/'test-results/phase2a-local'),'--output','json'],capture_output=True,text=True,check=True,timeout=45)
    data=json.loads(status.stdout)
    base=data['API_URL']
    assert base in ('http://127.0.0.1:58421','http://localhost:58421')
    anon=data['ANON_KEY']
    inspected=json.loads(subprocess.check_output(['docker','inspect','supabase_auth_'+PROJECT],text=True))[0]
    env=dict(item.split('=',1) for item in inspected['Config']['Env'] if '=' in item)
    secret=env['GOTRUE_JWT_SECRET'].encode()
    def token(user):
        encode=lambda value:base64.urlsafe_b64encode(json.dumps(value,separators=(',',':')).encode()).decode().rstrip('=')
        body=encode({'alg':'HS256','typ':'JWT'})+'.'+encode({'sub':str(user),'role':'authenticated','aud':'authenticated','exp':int(time.time())+300,'iat':int(time.time())})
        return body+'.'+base64.urlsafe_b64encode(hmac.new(secret,body.encode(),hashlib.sha256).digest()).decode().rstrip('=')
    def request(path,user=None,method='GET',body=None):
        headers={'apikey':anon,'Content-Type':'application/json','Prefer':'return=representation'}
        if user:headers['Authorization']='Bearer '+token(user)
        req=Request(base+'/rest/v1/'+path,headers=headers,method=method,data=json.dumps(body).encode() if body else None)
        try:
            with urlopen(req,timeout=10) as response:return response.status,json.load(response)
        except HTTPError as error:return error.code,None
    check('API anonymous lead access denied',lambda:equal(request('leads?select=id')[0],401))
    check('API cross-tenant owner read filtered',lambda:equal(request('leads?select=id&id=eq.'+str(other_lead),owner),(200,[])))
    check('API viewer insertion denied',lambda:equal(request('leads',users['viewer'],'POST',{'organization_id':str(org),'created_by':str(members['viewer']),'assigned_to':str(members['viewer']),'name':'Forbidden','company':'Fixture'})[0],403))
    check('API self role escalation denied',lambda:equal(request('organization_members?id=eq.'+str(members['sales']),users['sales'],'PATCH',{'primary_role':'owner'})[0],403))
    check('API owner audit deletion denied',lambda:equal(request('audit_logs?organization_id=eq.'+str(org),owner,'DELETE')[0],403))


def suite():
    owner=auth_user('owner-a@example.invalid')
    unverified=auth_user('unverified@example.invalid',False)
    other_owner=auth_user('owner-b@example.invalid')
    email='owner-a@example.invalid'  # Test-only INITIAL_OWNER_EMAIL equivalent; never a real account.
    check('anonymous bootstrap denied',lambda:denied(lambda:as_user(owner,'select public.bootstrap_first_owner(%s,%s,%s)',(owner,email,'Test'),role='anon')))
    check('authenticated direct bootstrap denied',lambda:denied(lambda:as_user(owner,'select public.bootstrap_first_owner(%s,%s,%s)',(owner,email,'Test'))))
    check('bootstrap rejects wrong configured email',lambda:denied(lambda:bootstrap(owner,'wrong@example.invalid')))
    check('bootstrap rejects unverified email',lambda:denied(lambda:bootstrap(unverified,'unverified@example.invalid')))
    check('failed precondition bootstrap leaves no organization',lambda:equal(admin('select count(*) from public.organizations')[0][0],0))

    # Fault injection is ONLY in the disposable DB. Force a late failure after
    # org/role/member insertion and prove PostgreSQL rolls the whole RPC back.
    admin("create function private.validation_fail_audit() returns trigger language plpgsql as $$ begin raise exception 'Injected local bootstrap failure'; end $$",fetch=False)
    admin('create trigger validation_fail_audit before insert on public.audit_logs for each row execute function private.validation_fail_audit()',fetch=False)
    check('late bootstrap failure is reported',lambda:denied(lambda:bootstrap(owner,email)))
    check('failed bootstrap rolls back organization, profile, roles and singleton',lambda:equal(admin("select (select count(*) from public.organizations),(select count(*) from public.roles),(select count(*) from public.profiles),(select count(*) from private.bootstrap_state where organization_id is not null)")[0],(0,0,0,0)))
    admin('drop trigger validation_fail_audit on public.audit_logs',fetch=False)
    admin('drop function private.validation_fail_audit()',fetch=False)
    org=bootstrap(owner,email)
    owner_member=admin('select id from public.organization_members where user_id=%s',(owner,))[0][0]
    check('bootstrap recovery and idempotence',lambda:equal(bootstrap(owner,email),org))
    check('bootstrap retry does not duplicate audit',lambda:equal(admin("select count(*) from public.audit_logs where action='initial owner bootstrap'")[0][0],1))
    check('second different owner bootstrap denied',lambda:denied(lambda:bootstrap(other_owner,'owner-b@example.invalid')))
    check('bootstrap seeds seven roles and owner capabilities',lambda:equal(admin('select count(*) from public.roles where organization_id=%s',(org,))[0][0],7))

    # A second tenant is fixture data created transactionally by the local admin.
    org2,member2=uid(),uid()
    with connection() as conn:
        conn.execute("insert into public.profiles(id,display_name) values(%s,'Fixture owner B')",(other_owner,))
        conn.execute("insert into public.organizations(id,name) values(%s,'Fictional workspace B')",(org2,))
        conn.execute("insert into public.organization_members(id,organization_id,user_id,primary_role,status) values(%s,%s,%s,'owner','active')",(member2,org2,other_owner))

    members={}
    users={}
    for role in ['operations_admin','sales','delivery','content','finance','viewer']:
        user=auth_user(role+'@example.invalid')
        member=uid()
        with connection() as conn:
            conn.execute('insert into public.profiles(id,display_name) values(%s,%s)',(user,'Fixture '+role))
            conn.execute("insert into public.organization_members(id,organization_id,user_id,primary_role,status) values(%s,%s,%s,%s,'active')",(member,org,user,role))
        members[role]=member;users[role]=user

    lead,other_lead=uid(),uid()
    insert_lead="insert into public.leads(id,organization_id,created_by,assigned_to,name,company) values(%s,%s,%s,%s,'Fictional lead','Validation') returning id"
    as_user(owner,insert_lead,(lead,org,owner_member,owner_member))
    as_user(other_owner,insert_lead,(other_lead,org2,member2,member2))
    matrix(owner,org,owner_member,users,members,lead)
    api_tests(owner,org,owner_member,users,members,other_lead)
    check('anonymous business read denied',lambda:denied(lambda:as_user(owner,'select id from public.leads',role='anon')))
    check('anonymous business insert denied',lambda:denied(lambda:as_user(owner,insert_lead,(uid(),org,owner_member,owner_member),role='anon')))
    check('cross-organization owner read filtered',lambda:equal(as_user(owner,'select id from public.leads where organization_id=%s',(org2,)),[]))
    check('cross-organization insert denied',lambda:denied(lambda:as_user(owner,insert_lead,(uid(),org2,owner_member,owner_member))))
    check('cross-organization update filtered',lambda:equal(as_user(owner,"update public.leads set name='Forbidden' where id=%s returning id",(other_lead,)),[]))
    check('viewer direct SQL insert denied',lambda:denied(lambda:as_user(users['viewer'],insert_lead,(uid(),org,members['viewer'],members['viewer']))))
    check('delivery direct lead read denied by RLS',lambda:equal(as_user(users['delivery'],'select id from public.leads'),[]))
    check('sales direct SQL insert permitted',lambda:equal(len(as_user(users['sales'],insert_lead,(uid(),org,members['sales'],members['sales']))),1))
    check('service role cannot bypass revoked business grants',lambda:denied(lambda:as_user(owner,'select id from public.leads',role='service_role')))

    for column,value in [('primary_role','owner'),('status','suspended'),('organization_id',str(org2)),('custom_role_id',str(uid()))]:
        query=sql.SQL('update public.organization_members set {}=%s where user_id=%s returning id').format(sql.Identifier(column))
        check('self '+column+' change denied',lambda q=query,v=value:denied(lambda:as_user(users['sales'],q,(v,users['sales']))))
    check('direct role-permission modification denied',lambda:denied(lambda:as_user(users['sales'],"update public.role_permissions set scope='all' returning role_id")))
    check('direct override self-grant denied',lambda:denied(lambda:as_user(users['sales'],"insert into public.member_permission_overrides(organization_id,member_id,permission_key,effect,scope,reason) values(%s,%s,'team.manage','allow','all','Forbidden') returning member_id",(org,members['sales']))))
    change='select public.owner_update_member(%s,%s,%s,%s,%s,%s)'
    args=(org,members['viewer'],'viewer','suspended','Validation suspension',True)
    check('non-owner cannot manage employees',lambda:denied(lambda:as_user(users['operations_admin'],change,args)))
    check('owner cannot edit own access',lambda:denied(lambda:as_user(owner,change,(org,owner_member,'viewer','suspended','Forbidden self',True))))
    check('owner action requires confirmation',lambda:denied(lambda:as_user(owner,change,args[:-1]+(False,))))
    check('owner action requires recent password',lambda:denied(lambda:as_user(owner,change,args,recent=False)))
    check('owner can suspend permitted employee',lambda:as_user(owner,change,args))
    check('suspended session immediately loses read access',lambda:equal(as_user(users['viewer'],'select id from public.leads'),[]))
    check('suspended session context absent',lambda:equal(as_user(users['viewer'],'select public.workspace_session(%s)',(org,))[0][0],None))
    check('owner can reactivate permitted employee',lambda:as_user(owner,change,(org,members['viewer'],'viewer','active','Validation reactivation',True)))
    check('owner action cannot target another organization',lambda:denied(lambda:as_user(owner,change,(org2,member2,'viewer','suspended','Forbidden tenant',True))))
    check('membership actions append audit and versions',lambda:equal(admin("select count(*) from public.permission_versions where member_id=%s",(members['viewer'],))[0][0],2))

    for label,query in [('delete','delete from public.organization_members where id=%s returning id'),
                         ('disable',"update public.organization_members set status='suspended' where id=%s returning id"),
                         ('demote',"update public.organization_members set primary_role='viewer' where id=%s returning id")]:
        check('last owner '+label+' blocked even through local admin SQL',lambda q=query:denied(lambda:admin(q,(owner_member,))))
    check('ownerless organization cannot commit',lambda:denied(lambda:admin("insert into public.organizations(name) values('Ownerless fixture') returning id")))
    barrier=Barrier(2)
    def concurrent_attempt(status):
        barrier.wait(timeout=10)
        try:
            as_user(owner,change,(org,owner_member,'viewer',status,'Concurrent forbidden owner removal',True))
            return 'unexpected success'
        except psycopg.Error as error:
            return error.sqlstate
    def concurrent_test():
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures=[pool.submit(concurrent_attempt,s) for s in ['suspended','archived']]
            equal([f.result(timeout=20) for f in futures],['P0001','P0001'])
        equal(admin("select count(*) from public.organization_members where organization_id=%s and primary_role='owner' and status='active'",(org,))[0][0],1)
    check('concurrent owner removals both fail and owner survives',concurrent_test)
    def concurrent_admin_test():
        gate=Barrier(2)
        def attempt(query):
            gate.wait(timeout=10)
            try: admin(query,(owner_member,)); return 'unexpected success'
            except psycopg.Error as error:return error.sqlstate
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures=[pool.submit(attempt,q) for q in ['delete from public.organization_members where id=%s',"update public.organization_members set primary_role='viewer' where id=%s"]]
            equal([f.result(timeout=20) for f in futures],['P0001','P0001'])
        equal(admin("select status,primary_role from public.organization_members where id=%s",(owner_member,))[0],('active','owner'))
    check('concurrent privileged SQL cannot delete/demote last owner',concurrent_admin_test)

    check('ordinary user cannot update audit',lambda:denied(lambda:as_user(users['sales'],"update public.audit_logs set action='forged' returning id")))
    check('ordinary user cannot delete audit',lambda:denied(lambda:as_user(owner,'delete from public.audit_logs returning id')))
    check('ordinary user cannot insert fake audit',lambda:denied(lambda:as_user(owner,"insert into public.audit_logs(organization_id,action) values(%s,'forged') returning id",(org,))))
    check('audit immutable trigger blocks admin update',lambda:denied(lambda:admin("update public.audit_logs set action='forged' returning id")))
    check('audit immutable trigger blocks truncate',lambda:denied(lambda:admin('truncate public.audit_logs',fetch=False)))
    check('business insert writes same-tenant audit',lambda:equal(admin('select organization_id from public.audit_logs where record_id=%s',(lead,))[0][0],org))
    check('record organization cannot change',lambda:denied(lambda:as_user(owner,'update public.leads set organization_id=%s where id=%s returning id',(org2,lead))))
    check('record creator cannot change',lambda:denied(lambda:as_user(owner,'update public.leads set created_by=%s where id=%s returning id',(members['sales'],lead))))
    check('non-owner assignment escalation blocked',lambda:denied(lambda:as_user(users['sales'],'update public.leads set assigned_to=%s where id=%s returning id',(members['sales'],lead))))
    quote=uid()
    as_user(owner,"insert into public.quotes(id,organization_id,created_by,assigned_to,lead_id,title,currency,status) values(%s,%s,%s,%s,%s,'Fixture quote','INR','Draft')",(quote,org,owner_member,owner_member,lead))
    check('cross-tenant foreign key denied',lambda:denied(lambda:as_user(owner,"insert into public.clients(organization_id,created_by,assigned_to,lead_id,name,company) values(%s,%s,%s,%s,'Fixture','Test') returning id",(org,owner_member,owner_member,other_lead))))
    check('referenced lead hard delete prevented by FK',lambda:denied(lambda:admin('delete from public.leads where id=%s returning id',(lead,))))
    check('ordinary hard delete denied',lambda:denied(lambda:as_user(owner,'delete from public.leads where id=%s returning id',(lead,))))
    check('sales cannot smuggle archival through edit permission',lambda:denied(lambda:as_user(users['sales'],'update public.leads set archived_at=now() where id=%s returning id',(lead,))))
    check('owner archive preserves linked quote',lambda:as_user(owner,'update public.leads set archived_at=now() where id=%s',(lead,)))
    check('archived relationship remains intact',lambda:equal(admin('select lead_id from public.quotes where id=%s',(quote,))[0][0],lead))

    def override(permission,effect,scope,expired=False):
        admin("insert into public.member_permission_overrides(organization_id,member_id,permission_key,effect,scope,expires_at,reason) values(%s,%s,%s,%s,%s,case when %s then now()-interval '1 day' else null end,'Validation fixture') on conflict(member_id,permission_key) do update set effect=excluded.effect,scope=excluded.scope,expires_at=excluded.expires_at",(org,members['sales'],permission,effect,scope,expired),False)
    override('team.manage','allow','all')
    check('override cannot grant owner-only permission',lambda:equal(as_user(users['sales'],"select private.permission_scope(%s,'team.manage')",(org,))[0][0],'none'))
    override('leads.view','deny','all')
    check('deny override removes row visibility',lambda:equal(as_user(users['sales'],'select id from public.leads'),[]))
    override('leads.view','allow','all',True)
    check('expired override returns inherited access',lambda:equal(as_user(users['sales'],"select private.permission_scope(%s,'leads.view')",(org,))[0][0],'all'))
    override('projects.manage','allow','all',True)
    check('expired otherwise absent grant cannot escalate',lambda:equal(as_user(users['sales'],"select private.permission_scope(%s,'projects.manage')",(org,))[0][0],'none'))
    override('leads.view','allow','own')
    check('own-scope override filters other creators',lambda:equal(as_user(users['sales'],'select id from public.leads where created_by<>%s',(members['sales'],)),[]))
    override('leads.view','allow','assigned')
    check('assigned-scope override filters other assignees',lambda:equal(as_user(users['sales'],'select id from public.leads where assigned_to<>%s',(members['sales'],)),[]))
    admin("update public.role_permissions set effect='deny' where organization_id=%s and role_id=(select id from public.roles where organization_id=%s and name='sales') and permission_key='leads.view'",(org,org),False)
    override('leads.view','allow','all')
    check('role deny wins over allow override',lambda:equal(as_user(users['sales'],'select id from public.leads'),[]))
    admin("update public.role_permissions set effect='allow' where organization_id=%s and role_id=(select id from public.roles where organization_id=%s and name='sales') and permission_key='leads.view'",(org,org),False)
    department,other_department=uid(),uid()
    admin("insert into public.departments(id,organization_id,name) values(%s,%s,'Fixture department A'),(%s,%s,'Fixture department B')",(department,org,other_department,org),False)
    admin('update public.organization_members set department_id=%s where id in (%s,%s)',(department,members['sales'],members['viewer']),False)
    admin('update public.organization_members set department_id=%s where id=%s',(other_department,members['content']),False)
    department_lead,other_department_lead=uid(),uid()
    as_user(owner,insert_lead,(department_lead,org,owner_member,members['viewer']))
    as_user(owner,insert_lead,(other_department_lead,org,owner_member,members['content']))
    override('leads.view','allow','department')
    check('department scope permits matching assignee department',lambda:equal(as_user(users['sales'],'select id from public.leads where id=%s',(department_lead,)),[(department_lead,)]))
    check('department scope excludes other departments',lambda:equal(as_user(users['sales'],'select id from public.leads where id=%s',(other_department_lead,)),[]))
    check('department scope cannot cross tenant boundary',lambda:equal(as_user(users['sales'],'select id from public.leads where id=%s',(other_lead,)),[]))
    custom_role=uid()
    admin("insert into public.roles(id,organization_id,name) values(%s,%s,'Fixture custom role')",(custom_role,org),False)
    admin("insert into public.role_permissions(organization_id,role_id,permission_key,effect,scope) values(%s,%s,'leads.view','allow','own'),(%s,%s,'team.manage','allow','all')",(org,custom_role,org,custom_role),False)
    admin('update public.organization_members set custom_role_id=%s where id=%s',(custom_role,members['sales']),False)
    override('leads.view','inherit','none')
    check('custom role replaces template permission scope',lambda:equal(as_user(users['sales'],"select private.permission_scope(%s,'leads.view')",(org,))[0][0],'own'))
    check('custom role cannot grant owner-only team management',lambda:equal(as_user(users['sales'],"select private.permission_scope(%s,'team.manage')",(org,))[0][0],'none'))
    admin('update public.roles set archived_at=now() where id=%s',(custom_role,),False)
    check('archived custom role fails closed',lambda:equal(as_user(users['sales'],'select id from public.leads'),[]))

    admin('update public.organizations set require_admin_mfa=true where id=%s',(org,),False)
    check('optional owner MFA denies AAL1 session',lambda:equal(as_user(owner,'select public.workspace_session(%s)',(org,))[0][0],None))
    check('optional owner MFA admits AAL2 session',lambda:equal(as_user(owner,'select public.workspace_session(%s)',(org,),aal='aal2')[0][0]['role'],'owner'))
    check('optional admin MFA denies AAL1 session',lambda:equal(as_user(users['operations_admin'],'select public.workspace_session(%s)',(org,))[0][0],None))
    admin('update public.organizations set require_admin_mfa=false where id=%s',(org,),False)

    admin('create table public.validation_future_table(id uuid primary key)',fetch=False)
    check('future table automatically enables and forces RLS',lambda:equal(admin("select relrowsecurity,relforcerowsecurity from pg_class where oid='public.validation_future_table'::regclass")[0],(True,True)))
    check('future table default grants deny authenticated',lambda:denied(lambda:as_user(owner,'select * from public.validation_future_table')))
    admin('drop table public.validation_future_table',fetch=False)
    check('all proposed public tables enable and force RLS',lambda:equal(admin("select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)")[0][0],0))
    second_owner_member=uid()
    admin("insert into public.organization_members(id,organization_id,user_id,primary_role,status) values(%s,%s,%s,'owner','active')",(second_owner_member,org,other_owner),False)
    def concurrent_distinct_owners():
        gate=Barrier(2)
        def attempt(actor,target):
            gate.wait(timeout=10)
            try: as_user(actor,change,(org,target,'viewer','suspended','Concurrent other Owner removal',True));return 'unexpected success'
            except psycopg.Error as error:return error.sqlstate
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures=[pool.submit(attempt,owner,second_owner_member),pool.submit(attempt,other_owner,owner_member)]
            equal([f.result(timeout=20) for f in futures],['P0001','P0001'])
        equal(admin("select count(*) from public.organization_members where organization_id=%s and primary_role='owner' and status='active'",(org,))[0][0],2)
    check('two distinct verified owners cannot concurrently remove each other',concurrent_distinct_owners)


if __name__=='__main__':
    try:
        CONFIG=local_config()
        if '--apply' in sys.argv:
            apply()
        suite()
    except Exception as error:
        RESULTS.append({'test':'migration or fixture setup','result':'FAIL','error_type':type(error).__name__,
                        'sqlstate':getattr(error,'sqlstate',None),
                        'reason':str(error) if isinstance(error,AssertionError) else 'Inspect local SQL failure; provider details suppressed'})
        print(json.dumps(RESULTS[-1]),flush=True)
    report={'result':'PASS' if RESULTS and all(r['result']=='PASS' for r in RESULTS) else 'FAIL','checks':RESULTS}
    out=ROOT/'docs'/'phase2a-database-results.json'
    out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'result':report['result'],'checks':len(RESULTS),'report':out.relative_to(ROOT).as_posix()}),flush=True)
    sys.exit(0 if report['result']=='PASS' else 1)
