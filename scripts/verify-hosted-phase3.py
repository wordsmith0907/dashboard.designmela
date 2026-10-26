"""Hosted development DB acceptance using authenticated-role transactions.

Uses the existing administrator connection solely to establish SQL role/claims.
This is RLS/database evidence, not a browser-login or REST-session test.
No Auth user changes, schema changes, service-role keys or hard deletion.
One labelled fixture is committed, edited, re-read, then archived in finally.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import importlib.util, json, sys, uuid
import psycopg
from psycopg import sql

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('admin', ROOT/'scripts/development-auth-admin.py')
admin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admin)


def main():
    assert sys.argv[1:] == ['--verify-and-archive'], 'Explicit verification operation required'
    env, ref = admin.environment()
    assert env.get('INITIAL_OWNER_BOOTSTRAP_ENABLED') == 'false', 'Bootstrap must be closed'
    org = uuid.UUID(env['DESIGNMELA_ORGANIZATION_ID'])
    db = urlparse(env['DATABASE_URL'])
    assert db.hostname == f'db.{ref}.supabase.co' or ((db.hostname or '').endswith('.pooler.supabase.com') and unquote(db.username or '') == f'postgres.{ref}'), 'Target mismatch'
    config = dict(host=db.hostname, port=db.port or 5432, dbname=unquote(db.path.lstrip('/')), user=unquote(db.username or ''), password=unquote(db.password or ''), sslmode='require', connect_timeout=15)

    def connect():
        conn = psycopg.connect(**config)
        conn.execute("set local statement_timeout='15000'")
        return conn

    with connect() as conn:
        row = conn.execute("select m.user_id,m.id from public.organization_members m join auth.users u on u.id=m.user_id where m.organization_id=%s and lower(u.email)=lower(%s) and u.email_confirmed_at is not null and m.primary_role='owner' and m.status='active'", (org, env['INITIAL_OWNER_EMAIL'])).fetchall()
        assert len(row) == 1, 'Verified protected Owner required'
        owner, member = row[0]
        assert conn.execute('select count(*) from public.roles where organization_id=%s', (org,)).fetchone()[0] == 7
        assert conn.execute("select owner_user_id=%s and organization_id=%s from private.bootstrap_state where singleton", (owner,org)).fetchone()[0]
        conn.rollback()

    def run(query, params=(), identity=owner, role='authenticated', commit=True):
        with connect() as conn:
            conn.execute(sql.SQL('set local role {}').format(sql.Identifier(role)))
            conn.execute("select set_config('request.jwt.claims',%s,true)", (json.dumps({'sub':str(identity),'role':role,'aal':'aal1'}),))
            cur=conn.execute(query,params)
            rows=cur.fetchall() if cur.description else []
            if not commit: conn.rollback()
            return rows

    def denied(query,params=(),**options):
        try:
            rows=run(query,params,commit=False,**options)
        except psycopg.Error as error:
            assert error.sqlstate in ('42501','P0001','23514'), 'Unexpected denial error'
            return
        assert not rows, 'Unauthorized operation was allowed'

    checks=[]
    session=run('select public.workspace_session(%s)',(org,))[0][0]
    assert session['role']=='owner' and len(session['permissions'])==22
    checks.append('Owner workspace RPC: 22 permissions, 7 predefined roles')
    outsider=uuid.uuid4()
    assert run('select public.workspace_session(%s)',(org,),identity=outsider)==[(None,)]
    denied('select id from public.leads where organization_id=%s',(org,),role='anon')
    denied("update public.organization_members set status='suspended' where id=%s returning id",(member,))
    # Test the immutable Owner trigger even against an administrator, always rollback.
    denied("update public.organization_members set status='suspended' where id=%s returning id",(member,),role='postgres')
    denied("update public.roles set name='fixture' where organization_id=%s and name='owner' returning id",(org,),role='postgres')
    denied('update public.audit_logs set action=action where organization_id=%s returning id',(org,),role='postgres')
    denied('select public.bootstrap_first_owner(%s,%s,%s)',(owner,env['INITIAL_OWNER_EMAIL'],'Designmela'))
    checks.append('Anonymous/nonmember isolation, protected Owner/templates/history, public bootstrap denied')
    fixture=uuid.uuid4()
    created=False
    try:
        run("insert into public.leads(id,organization_id,name,company,stage,estimated_value,notes,created_by,assigned_to) values(%s,%s,'Phase 3 hosted persistence verification','Fictional verification only','New',0,'Temporary acceptance fixture; archive after verification',%s,%s) returning id",(fixture,org,member,member))
        created=True
        assert run('select stage from public.leads where id=%s',(fixture,))==[('New',)]
        run("update public.leads set stage='Contacted',notes='Persistence verified on a separate connection' where id=%s returning id",(fixture,))
        assert run('select stage from public.leads where id=%s',(fixture,))==[('Contacted',)]
        denied('select id from public.leads where id=%s',(fixture,),identity=outsider)
        denied('delete from public.leads where id=%s returning id',(fixture,))
        checks.append('Committed lead create/edit/read across connections; nonmember read and hard DELETE denied')
    finally:
        if created:
            assert run('update public.leads set archived_at=now() where id=%s and archived_at is null returning id',(fixture,))==[(fixture,)]
    assert run('select count(*) from public.leads where id=%s and archived_at is null',(fixture,))==[(0,)]
    assert run('select count(*) from public.leads where id=%s and archived_at is not null',(fixture,))==[(1,)]
    assert run('select count(*) from public.audit_logs where record_id=%s and actor_id=%s',(fixture,member))==[(3,)]
    checks.append('Fixture archived; zero active fixture rows, one archived row, three immutable audit entries')
    result={'result':'PASS','layer':'hosted PostgreSQL authenticated-role/RLS, not HTTP login','checks':checks,'active_fixture_rows':0,'archived_fixture_rows':1,'fixture_audit_entries':3,'auth_users_created':0,'hard_deletions':0,'identifiers':'withheld'}
    (ROOT/'docs/phase3-hosted-database-results.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'result':'FAIL','error_type':type(error).__name__,'sqlstate':getattr(error,'sqlstate',None),'details':'suppressed; inspect fixture archival before retry'}))
        sys.exit(1)
