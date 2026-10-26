"""Scan source and public build assets without printing sensitive matches."""
from pathlib import Path
from urllib.parse import urlparse, unquote
import json, re, subprocess

root = Path(__file__).resolve().parent.parent
env = {}
for line in (root / '.env.local').read_text(encoding='utf-8-sig').splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
values = [v for k, v in env.items() if len(v) >= 8 and
          any(part in k for part in ('KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'EMAIL', 'DATABASE_URL', 'SUPABASE_URL'))]
db = urlparse(env.get('DATABASE_URL', ''))
if db.password:
    values.append(unquote(db.password))
paths = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], cwd=root, text=True).splitlines()
paths += [str(p.relative_to(root)) for p in (root / '.next/static').rglob('*') if p.is_file()]
findings = []
for name in paths:
    path = root / name
    if not path.is_file():
        continue
    content = path.read_bytes().decode('utf-8', errors='ignore')
    if any(value in content for value in values) or re.search(r'sb_secret_[A-Za-z0-9]{16,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', content):
        findings.append(name)
checkpoint = subprocess.check_output(['git', 'diff-tree', '--no-commit-id', '--name-only', '-r', 'b9898833d265a5cc68fa4dd054eb873ed8263b08'], cwd=root, text=True).splitlines()
checkpoint_findings = []
for name in checkpoint:
    content = subprocess.check_output(['git', 'show', 'b9898833d265a5cc68fa4dd054eb873ed8263b08:' + name], cwd=root).decode('utf-8')
    if re.search(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|postgres(?:ql)?://', content) or any(v in content for v in values):
        checkpoint_findings.append(name)
ignored = subprocess.run(['git', 'check-ignore', '--quiet', '.env.local'], cwd=root).returncode == 0
tracked = bool(subprocess.check_output(['git', 'ls-files', '.env.local'], cwd=root).strip())
passed = not findings and not checkpoint_findings and ignored and not tracked
print(json.dumps({'result': 'PASS' if passed else 'FAIL', 'source_and_asset_files': len(paths), 'matching_files': findings, 'checkpoint_matching_files': checkpoint_findings, 'env_ignored': ignored, 'env_tracked': tracked, 'sensitive_values': 'withheld'}))
raise SystemExit(0 if passed else 1)
