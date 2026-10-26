"""One-time administrator invocation of the already-reviewed bootstrap function.

No service-role key, password collection, Auth user creation, or schema changes.
Run --check-only before personal activation. --apply-reviewed-bootstrap requires
the user to have signed in and seen 'Owner account verified' at /setup.
Connection values and account/organization identifiers are never printed.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import sys, json, hashlib, importlib.util, re
import psycopg
from psycopg.rows import dict_row

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('inspector', ROOT/'scripts/inspect-remote-readonly.py')
inspector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inspector)

def main():
    assert len(sys.argv)==2 and sys.argv[1] in ('--check-only','--apply-reviewed-bootstrap'), 'Choose an explicit operation'
    apply = sys.argv[1]=='--apply-reviewed-bootstrap'
    env=inspector.environment()
    assert env.get('INITIAL_OWNER_EMAIL'), 'Configured Owner email is missing'
    assert env.get('DESIGNMELA_MODE')=='connected' and env.get('DESIGNMELA_ENV')=='development' and env.get('SUPABASE_DEV_PROJECT_CONFIRMED')=='true', 'Confirmed connected development mode required'
    if apply: assert env.get('INITIAL_OWNER_BOOTSTRAP_ENABLED')=='true', 'Bootstrap switch is disabled'
    ref=urlparse(env['NEXT_PUBLIC_SUPABASE_URL']).hostname.removesuffix('.supabase.co')
    assert ref==Path('supabase/.temp/project-ref').read_text().strip()==json.loads(Path('supabase/.temp/linked-project.json').read_text())['ref'], 'Target identity differs'
    db=urlparse(env['DATABASE_URL'])
    assert db.hostname==f'db.{ref}.supabase.co' or ((db.hostname or '').endswith('.pooler.supabase.com') and unquote(db.username or '')==f'postgres.{ref}'), 'Database target differs'
    expected='4d09aa7c75b03633eb4260c781b74e38808592d928201778228f89e66c68a203'
    assert hashlib.sha256(Path('supabase/migrations/20261023000100_designmela_initial.sql').read_bytes()).hexdigest()==expected, 'Migration bytes changed'
    conn=psycopg.connect(host=db.hostname,port=db.port or 5432,dbname=unquote(db.path.lstrip('/')),user=unquote(db.username or ''),password=unquote(db.password or ''),sslmode='require',connect_timeout=15,row_factory=dict_row)
    conn.read_only=not apply
    organization=None
    try:
        conn.execute("set local search_path = ''")
        history=conn.execute('select version from supabase_migrations.schema_migrations order by version').fetchall()
        assert history==[{'version':'20261023000100'}], 'Migration history differs'
        prior=json.loads(Path('docs/development-post-migration.json').read_text())['schema']['functions']
        expected_function=next(f['definition'] for f in prior if f['proname']=='bootstrap_first_owner')
        current=conn.execute("select pg_get_functiondef('public.bootstrap_first_owner(uuid,text,text)'::regprocedure) as definition").fetchone()['definition']
        assert current.replace('\r\n','\n')==expected_function.replace('\r\n','\n'), 'Bootstrap definition differs from reviewed schema'
        total=conn.execute('select count(*) as count from auth.users').fetchone()['count']
        users=conn.execute("""select id,email_confirmed_at is not null as verified,
          last_sign_in_at > now()-interval '30 minutes' as recent_signin,
          exists(select 1 from auth.sessions s where s.user_id=u.id and (s.not_after is null or s.not_after>now())) as has_session,
          coalesce(length(encrypted_password),0)>0 as password_set
          from auth.users u where lower(trim(email))=lower(trim(%s))""",(env['INITIAL_OWNER_EMAIL'],)).fetchall()
        if not apply:
            print(json.dumps({'operation':'read-only readiness','auth_users':total,'configured_owner_accounts':len(users),'verified':bool(users and users[0]['verified']),'recent_authenticated_session':bool(users and users[0]['recent_signin'] and users[0]['has_session']),'password_set':bool(users and users[0]['password_set']),'bootstrap_invoked':False}))
            conn.rollback();return
        assert total==1 and len(users)==1, 'Exactly the configured initial account must exist'
        owner=users[0]
        assert owner['verified'] and owner['recent_signin'] and owner['has_session'] and owner['password_set'], 'Verified recent password-account session required'
        state=conn.execute('select organization_id,owner_user_id from private.bootstrap_state where singleton').fetchone()
        assert state and (state['owner_user_id'] is None or state['owner_user_id']==owner['id']), 'Bootstrap belongs to another account'
        # The ONLY remote mutation is this reviewed, transactional, idempotent function.
        organization=conn.execute('select public.bootstrap_first_owner(%s,%s,%s) as id',(owner['id'],env['INITIAL_OWNER_EMAIL'].strip(),'Designmela')).fetchone()['id']
        rows=conn.execute("select primary_role,status from public.organization_members where organization_id=%s and user_id=%s",(organization,owner['id'])).fetchall()
        assert rows==[{'primary_role':'owner','status':'active'}], 'Expected active Owner membership missing'
        role_count=conn.execute('select count(*) as count from public.roles where organization_id=%s',(organization,)).fetchone()['count']
        owner_permissions=conn.execute("select count(*) as count from public.role_permissions p join public.roles r on r.id=p.role_id where r.organization_id=%s and r.name='owner' and p.effect='allow' and p.scope='all'",(organization,)).fetchone()['count']
        audits=conn.execute("select count(*) as count from public.audit_logs where organization_id=%s and action='initial owner bootstrap'",(organization,)).fetchone()['count']
        assert role_count==7 and owner_permissions==22 and audits==1, 'Bootstrap postconditions failed'
        conn.commit()
    finally:
        conn.rollback();conn.close()
    # Keep the identifier server-only and immediately close the local setup gate.
    file=Path('.env.local');content=file.read_text(encoding='utf-8-sig')
    for key,value in {'DESIGNMELA_ORGANIZATION_ID':str(organization),'INITIAL_OWNER_BOOTSTRAP_ENABLED':'false'}.items():
        pattern=r'^'+key+r'=.*$'
        content=re.sub(pattern,key+'='+value,content,flags=re.M) if re.search(pattern,content,re.M) else content.rstrip()+'\n'+key+'='+value+'\n'
    file.write_text(content,encoding='utf-8')
    print(json.dumps({'result':'PASS','organization_created_or_reused':True,'active_owner_memberships':1,'predefined_roles':7,'owner_permissions':22,'bootstrap_audit_entries':1,'local_bootstrap_switch_disabled':True,'identifiers':'withheld','business_data_inserted':False}))

if __name__=='__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'result':'STOP','type':type(error).__name__,'reason':str(error) if isinstance(error,AssertionError) else 'Operation failed; sensitive details suppressed','sqlstate':getattr(error,'sqlstate',None),'automatic_retry':False}))
        sys.exit(1)
