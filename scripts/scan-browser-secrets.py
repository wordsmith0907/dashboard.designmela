"""Read-only scan of browser assets/maps and prerendered payloads; never print matches."""
from pathlib import Path
from urllib.parse import urlparse, unquote
import json, re

root = Path(__file__).resolve().parent.parent
env = {}
for line in (root / '.env.local').read_text(encoding='utf-8-sig').splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
private = [v for k, v in env.items() if not k.startswith('NEXT_PUBLIC_') and len(v) >= 12
           and any(part in k for part in ('KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'EMAIL', 'DATABASE', 'ORGANIZATION'))]
db = urlparse(env.get('DATABASE_URL', ''))
if db.password:
    private.append(unquote(db.password))
private += ['phase4_private_database_canary', 'phase4_private_password_canary', 'phase4_private_key_canary']
paths = [p for p in (root / '.next/static').rglob('*') if p.is_file()]
paths += [p for p in (root / 'public').rglob('*') if p.is_file()]
paths += [p for p in (root / '.next/server/app').rglob('*') if p.suffix in ('.html', '.rsc')]
assert paths, 'Build assets required before scanning'
findings = []
for path in paths:
    content = path.read_bytes().decode('utf-8', errors='ignore')
    if any(v in content for v in private) or re.search(r'sb_secret_[A-Za-z0-9_-]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', content):
        findings.append(str(path.relative_to(root)))
print(json.dumps({'result':'FAIL' if findings else 'PASS','browser_asset_files':len(paths),
                  'source_maps':sum(p.suffix=='.map' for p in paths),'matching_files':findings,'values':'withheld'}))
raise SystemExit(1 if findings else 0)
