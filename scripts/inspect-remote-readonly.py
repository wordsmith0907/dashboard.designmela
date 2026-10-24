"""Phase 2A: metadata-only inspection with server-enforced read-only transactions.
Run: uv run --with "psycopg[binary]" python scripts/inspect-remote-readonly.py
Never logs connection values, credentials, definitions or individual user rows.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import json
import subprocess
import sys
import psycopg
from psycopg.rows import dict_row


def environment():
    values = {}
    for line in Path('.env.local').read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def main():
    env = environment()
    required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'DATABASE_URL', 'INITIAL_OWNER_EMAIL']
    presence = {key: 'present (masked)' if env.get(key) else 'missing' for key in required}
    ignored = subprocess.run(['git', 'check-ignore', '--quiet', '.env.local']).returncode == 0
    tracked = bool(subprocess.check_output(['git', 'ls-files', '.env.local']).strip())
    print(json.dumps({'environment': presence, 'env_ignored': ignored, 'env_tracked': tracked}))
    if 'missing' in presence.values() or not ignored or tracked:
        raise ValueError('Environment gate failed')
    public = urlparse(env['NEXT_PUBLIC_SUPABASE_URL'])
    db = urlparse(env['DATABASE_URL'])
    ref = (public.hostname or '').removesuffix('.supabase.co')
    if not public.hostname or public.hostname != ref + '.supabase.co' or public.scheme != 'https':
        raise ValueError('Unexpected project endpoint')
    linked_path = Path('supabase/.temp/project-ref')
    if not linked_path.exists() or linked_path.read_text().strip() != ref:
        raise ValueError('Linked project does not match configured endpoint')
    direct = db.hostname == f'db.{ref}.supabase.co'
    pooler = (db.hostname or '').endswith('.pooler.supabase.com') and unquote(db.username or '') == f'postgres.{ref}'
    if not (direct or pooler) or db.scheme not in ('postgresql', 'postgres'):
        raise ValueError('Database identity does not match configured project')
    print(json.dumps({'project': ref[:3] + '…' + ref[-3:], 'linked_identity_matches': True,
                      'connection_identity_matches': True, 'read_only_transaction_before_first_query': True}))
    conn = psycopg.connect(host=db.hostname, port=db.port or 5432, dbname=unquote(db.path.lstrip('/')),
                           user=unquote(db.username or ''), password=unquote(db.password or ''),
                           sslmode='require', connect_timeout=15,
                           row_factory=dict_row)
    try:
        # Session-pooler startup options timed out in validation. This property
        # makes psycopg issue BEGIN READ ONLY before the first SELECT instead.
        # It does not change persistent or session database configuration.
        conn.read_only = True
        with conn.cursor() as cur:
            cur.execute("select current_setting('transaction_read_only') as read_only")
            assert cur.fetchone()['read_only'] == 'on'
            if '--connection-only' in sys.argv:
                print(json.dumps({'result':'PASS_CONNECTION','transaction_read_only':True,'inspection_queries_executed':False}))
                return 0
            def query(sql):
                cur.execute(sql)
                return cur.fetchall()
            schemas = query("select nspname as schema from pg_namespace where nspname !~ '^pg_' and nspname<>'information_schema' order by 1")
            tables = query("""select n.nspname as schema,c.relname as name,c.relkind,
                c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,c.reltuples::bigint as approximate_rows,
                exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') as extension_owned
                from pg_class c join pg_namespace n on n.oid=c.relnamespace
                where c.relkind in ('r','p','v','m','f') and n.nspname !~ '^pg_' and n.nspname<>'information_schema' order by 1,2""")
            managed = {'public','auth','storage','realtime','extensions','graphql','graphql_public','net','pgsodium',
                       'pgsodium_masks','supabase_functions','supabase_migrations','vault','_realtime','cron','pgbouncer'}
            unexpected_schemas = [r['schema'] for r in schemas if r['schema'] not in managed]
            app_objects = [r for r in tables if (r['schema']=='public' and not r['extension_owned']) or r['schema'] not in managed]
            # Catalog metadata only until the empty-project safety gate is known.
            print(json.dumps({'schemas':schemas,'table_inventory':tables,'unexpected_schemas':unexpected_schemas,'application_objects':app_objects}))
            if unexpected_schemas or app_objects:
                print(json.dumps({'result':'STOP','reason':'Application/unrelated objects exist; no further inspection or local testing performed.'}))
                return 2
            counts = {}
            for schema, table in [('auth','users'),('storage','objects'),('storage','buckets')]:
                if any(r['schema']==schema and r['name']==table for r in tables):
                    # Fixed identifiers only; no personal/business rows are returned.
                    cur.execute(f'select count(*) as count from {schema}.{table}')
                    counts[f'{schema}.{table}'] = cur.fetchone()['count']
            print(json.dumps({'identity_storage_counts':counts}))
            if any(counts.values()):
                print(json.dumps({'result':'STOP','reason':'Existing identities or storage data require review; do not treat project as empty.'}))
                return 2
            migrations = []
            if any(r['schema']=='supabase_migrations' and r['name']=='schema_migrations' for r in tables):
                migrations = query('select version from supabase_migrations.schema_migrations order by version')
            functions = query("""select n.nspname as schema,p.proname as name,p.prosecdef as security_definer,
                 exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') as extension_owned
                 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                 where n.nspname !~ '^pg_' and n.nspname<>'information_schema' order by 1,2""")
            triggers = query("""select n.nspname as schema,c.relname as table,t.tgname as trigger
                from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
                where not t.tgisinternal and n.nspname !~ '^pg_' and n.nspname<>'information_schema' order by 1,2,3""")
            policies = query('select schemaname as schema,tablename as table,policyname as policy,cmd,roles from pg_policies order by 1,2,3')
            events = query('select evtname,evtevent,evtenabled from pg_event_trigger order by evtname')
            print(json.dumps({'migration_versions':migrations,'functions':functions,'triggers':triggers,'policies':policies,'event_triggers':events},default=str))
            custom_functions=[r for r in functions if r['schema']=='public' and not r['extension_owned']]
            if migrations or custom_functions:
                print(json.dumps({'result':'STOP','reason':'Existing migration history or custom functions require review.'}))
                return 2
            print(json.dumps({'result':'PASS_READONLY','empty_application_schema':True,'dedicated_development':'User-confirmed; project purpose cannot be proven from empty catalogs alone.'}))
            return 0
    finally:
        conn.rollback()
        conn.close()


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        # Provider exceptions can contain hosts, connection strings or literals.
        message = str(error).lower()
        category = 'Connection/configuration failure; details suppressed'
        if any(term in message for term in ['getaddrinfo', 'name or service not known', 'could not translate host', 'nodename nor servname', 'failed to resolve']):
            category = 'Database endpoint DNS resolution failed'
        elif 'password authentication failed' in message:
            category = 'Database password authentication failed'
        elif 'timeout' in message or 'timed out' in message:
            category = 'Database connection timed out'
        elif 'network is unreachable' in message or 'unreachable network' in message:
            category = 'Database network route unavailable'
        elif 'connection refused' in message:
            category = 'Database connection refused'
        elif 'ssl' in message or 'certificate' in message:
            category = 'TLS connection failed'
        print(json.dumps({'result':'FAIL','error_type':type(error).__name__,'sqlstate':getattr(error,'sqlstate',None),
                          'category':category,'details':'No write commands issued.'}))
        sys.exit(1)
