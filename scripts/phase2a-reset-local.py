"""Reset ONLY the disposable local stack; never uses a remote link or URL."""
from pathlib import Path
import json
import subprocess
import sys
import tomllib

root=Path(__file__).resolve().parent.parent
work=root/'test-results/phase2a-local'
config=tomllib.loads((work/'supabase/config.toml').read_text(encoding='utf-8'))
assert '--confirm-disposable-reset' in sys.argv
assert config['project_id']=='designmela-phase2a-disposable'
assert config['db']['port']==58422
assert not (work/'supabase/.temp/project-ref').exists()
assert not (work/'.env').exists()
assert not list((work/'supabase/migrations').glob('*.sql'))
assert not config['db']['seed']['enabled']
result=subprocess.run(['npx.cmd','--yes','supabase@2.122.0','db','reset','--local','--no-seed','--workdir',str(work)],capture_output=True,text=True)
print(json.dumps({'reset':'PASS' if result.returncode==0 else 'FAIL','target':'disposable local stack only','remote_link':False,'exit_code':result.returncode,'provider_output':'suppressed'}))
sys.exit(result.returncode)
