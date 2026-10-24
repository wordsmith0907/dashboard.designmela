"""Static parsing only: uv run --with pglast python scripts/review-sql.py.

Never connects to a database. PostgreSQL cannot resolve stored-function row types
or prove policy behavior without an actual catalogue; those remain approval gates.
"""
from pathlib import Path
import json
import re
from pglast import parse_sql

source = Path('supabase/proposals/consolidated-initial.sql').read_text(encoding='utf-8')
statements = parse_sql(source)
tables = re.findall(r'create table (public|private)\.(\w+)', source, re.I)
functions = re.findall(r'create function ((?:public|private)\.\w+)', source, re.I)
assert len(tables) == 34
assert len([schema for schema, _ in tables if schema == 'public']) == 33
assert not re.search(r'\bon delete cascade\b', source, re.I)
assert not re.search(r'^\s*(drop|truncate|delete from)\b', source, re.M | re.I)
assert source.count('create constraint trigger') == 2
assert 'create event trigger designmela_default_rls' in source
assert 'create policy scoped_update' in source
assert 'create policy scoped_insert' in source
assert 'create policy scoped_read' in source
assert source.strip().startswith('-- REVIEW PROPOSAL ONLY')
print(json.dumps({
    'result': 'PASS (static only)',
    'statements_parsed': len(statements),
    'tables': ['.'.join(t) for t in tables],
    'functions': functions,
    'limitations': ['No database execution', 'No PL/pgSQL catalogue/type resolution',
                    'No dynamic policy/grant/FK/concurrency verification'],
}, indent=2))
