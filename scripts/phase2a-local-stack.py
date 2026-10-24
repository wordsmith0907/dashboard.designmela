"""Start only the isolated disposable stack. Capture CLI output to avoid key disclosure.
No remote link, .env file, application migration or seed is copied into this stack.
"""
from pathlib import Path
import json
import re
import socket
import subprocess
import sys

root = Path(__file__).resolve().parent.parent
work = root / 'test-results' / 'phase2a-local'
config = work / 'supabase' / 'config.toml'
project = 'designmela-phase2a-disposable'
source = (root / 'supabase' / 'config.toml').read_text(encoding='utf-8')
source = re.sub(r'^project_id = .*$', f'project_id = "{project}"', source, flags=re.M)
# Distinct ports; do not interfere with another local Supabase project.
for old, new in [(54320,58420),(54321,58421),(54322,58422),(54323,58423),(54324,58424),(54327,58427),(54329,58429)]:
    source = re.sub(r'(?<!\d)'+str(old)+r'(?!\d)',str(new),source)
for section in ['db.migrations','db.seed','analytics']:
    source = re.sub(r'(\['+re.escape(section)+r'\]\s*(?:#[^\n]*\n)*enabled = )true',r'\g<1>false',source)
if config.exists() and config.read_text(encoding='utf-8') != source:
    print(json.dumps({'result':'STOP','reason':'Existing disposable configuration differs; inspect before reuse.'}))
    sys.exit(1)
if not config.exists():
    for port in [58420,58421,58422,58423,58424,58427,58429]:
        with socket.socket() as sock:
            try:
                sock.bind(('127.0.0.1',port))
            except OSError:
                print(json.dumps({'result':'STOP','reason':'An isolated test port is occupied.'}))
                sys.exit(1)
    config.parent.mkdir(parents=True,exist_ok=True)
    config.write_text(source,encoding='utf-8')
assert not (work / '.env').exists()
assert not (work / 'supabase' / '.temp' / 'project-ref').exists()
assert not list((work / 'supabase' / 'migrations').glob('*.sql'))
print(json.dumps({'action':'Starting isolated local stack','project':'[masked disposable ID]','remote_link':False,'application_migrations':False}),flush=True)
result = subprocess.run(['npx.cmd','--yes','supabase@2.122.0','start','--workdir',str(work)],
                        cwd=root,capture_output=True,text=True,encoding='utf-8',errors='replace')
output=(result.stdout+'\n'+result.stderr).lower()
if result.returncode:
    categories=[]
    for term,label in [('port is already allocated','Port conflict'),('unhealthy','Unhealthy container'),
                       ('failed to pull','Image download failed'),('timeout','Timeout'),('cannot connect','Connection failure'),
                       ('connection refused','Connection refused'),('failed to inspect','Container inspection failed'),
                       ('authentication required','Registry authentication required'),('no space left','Disk space exhausted')]:
        if term in output: categories.append(label)
    print(json.dumps({'result':'FAIL','exit_code':result.returncode,'categories':categories or ['Startup failure; output suppressed to protect generated local credentials']}))
else:
    print(json.dumps({'result':'PASS','local_stack_started':True,'generated_credentials':'not displayed or added to project environment'}))
sys.exit(result.returncode)
