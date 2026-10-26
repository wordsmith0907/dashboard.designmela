"""Development-only Auth administration using the existing Supabase CLI PAT.

No service-role key, password generation, inbox access or verification-link use.
Only sanitized settings and operation outcomes are printed. Run with uv and
psycopg[binary]. The invitation operation refuses any existing Auth account.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import base64, ctypes, ctypes.wintypes as w, json, sys, urllib.request, urllib.error
import psycopg

ROOT = Path(__file__).resolve().parent.parent

def environment():
    values = {}
    for line in (ROOT / '.env.local').read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    assert values.get('DESIGNMELA_MODE') == 'connected' and values.get('DESIGNMELA_ENV') == 'development' and values.get('SUPABASE_DEV_PROJECT_CONFIRMED') == 'true', 'Confirmed development required'
    ref = (ROOT / 'supabase/.temp/project-ref').read_text().strip()
    assert urlparse(values['NEXT_PUBLIC_SUPABASE_URL']).hostname == ref + '.supabase.co', 'Target mismatch'
    assert json.loads((ROOT / 'supabase/.temp/linked-project.json').read_text())['ref'] == ref, 'Linked target mismatch'
    return values, ref

def cli_token():
    # Exact credential targets used by the official CLI; never enumerate vaults.
    class Credential(ctypes.Structure):
        _fields_ = [('Flags', w.DWORD), ('Type', w.DWORD), ('TargetName', w.LPWSTR), ('Comment', w.LPWSTR), ('LastWritten', w.FILETIME), ('CredentialBlobSize', w.DWORD), ('CredentialBlob', ctypes.POINTER(ctypes.c_byte)), ('Persist', w.DWORD), ('AttributeCount', w.DWORD), ('Attributes', ctypes.c_void_p), ('TargetAlias', w.LPWSTR), ('UserName', w.LPWSTR)]
    api = ctypes.WinDLL('Advapi32.dll')
    api.CredReadW.argtypes = [w.LPCWSTR, w.DWORD, w.DWORD, ctypes.POINTER(ctypes.POINTER(Credential))]
    api.CredFree.argtypes = [ctypes.c_void_p]
    for target in ['Supabase CLI:supabase', 'Supabase CLI:access-token']:
        pointer = ctypes.POINTER(Credential)()
        if not api.CredReadW(target, 1, 0, ctypes.byref(pointer)):
            continue
        try:
            raw = ctypes.string_at(pointer.contents.CredentialBlob, pointer.contents.CredentialBlobSize)
        finally:
            api.CredFree(pointer)
        for encoding in ['utf-8', 'utf-16-le']:
            try:
                value = raw.decode(encoding).strip('\x00')
                if value.startswith('go-keyring-base64:'):
                    value = base64.b64decode(value.split(':', 1)[1]).decode()
                if value.startswith('sbp_'):
                    return value
            except UnicodeError:
                pass
    raise AssertionError('Existing CLI management credential unavailable')

def request(token, path, method='GET', data=None):
    req = urllib.request.Request('https://api.supabase.com' + path, method=method,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        data=json.dumps(data).encode() if data is not None else None)
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        # Response bodies can contain account identifiers. Never print them.
        raise RuntimeError('Provider rejected operation; HTTP ' + str(error.code)) from None

def summary(config):
    return {key: config.get(key) for key in ['site_url', 'uri_allow_list', 'disable_signup', 'external_email_enabled', 'mailer_autoconfirm', 'password_min_length', 'external_anonymous_users_enabled', 'refresh_token_rotation_enabled']}

def main():
    assert len(sys.argv) == 2 and sys.argv[1] in ['--inspect', '--configure', '--invite-owner'], 'Choose an explicit operation'
    env, ref = environment()
    token = cli_token()
    path = '/v1/projects/' + ref + '/config/auth'
    desired = {'site_url': 'http://127.0.0.1:3100', 'uri_allow_list': 'http://127.0.0.1:3100/**', 'disable_signup': True, 'external_email_enabled': True, 'mailer_autoconfirm': False, 'password_min_length': 12, 'external_anonymous_users_enabled': False}
    if sys.argv[1] == '--configure':
        before = request(token, path)
        patch = {key: value for key, value in desired.items() if before.get(key) != value}
        if patch:
            request(token, path, 'PATCH', patch)
        after = request(token, path)
        assert all(after.get(key) == value for key, value in desired.items()), 'Auth configuration verification failed'
        assert after.get('password_required_characters'), 'Password character requirements missing'
        print(json.dumps({'result': 'PASS', 'changed_fields': list(patch), 'settings': summary(after), 'password_character_classes_required': True, 'email_templates': 'unchanged provider defaults'}))
        return
    config = request(token, path)
    if sys.argv[1] == '--inspect':
        print(json.dumps({'settings': summary(config), 'password_character_classes_required': bool(config.get('password_required_characters')), 'social_providers_enabled': [k for k, v in config.items() if k.startswith('external_') and k.endswith('_enabled') and v and k != 'external_email_enabled']}))
        return
    assert all(config.get(key) == value for key, value in desired.items()), 'Auth configuration must be verified before invitation'
    assert env.get('INITIAL_OWNER_EMAIL'), 'Configured Owner missing'
    db = urlparse(env['DATABASE_URL'])
    assert db.hostname == f'db.{ref}.supabase.co' or ((db.hostname or '').endswith('.pooler.supabase.com') and unquote(db.username or '') == f'postgres.{ref}'), 'Database target mismatch'
    with psycopg.connect(host=db.hostname, port=db.port or 5432, dbname=unquote(db.path.lstrip('/')), user=unquote(db.username or ''), password=unquote(db.password or ''), sslmode='require', connect_timeout=15) as conn:
        conn.read_only = True
        assert conn.execute('select count(*) from auth.users').fetchone()[0] == 0, 'An account exists; do not send a duplicate invitation'
        conn.rollback()
    # Same invitation endpoint used by the official Studio user-invite mutation.
    request(token, '/platform/auth/' + ref + '/invite', 'POST', {'email': env['INITIAL_OWNER_EMAIL'].strip()})
    print(json.dumps({'result': 'PASS', 'single_owner_invitation_requested': True, 'recipient': 'withheld', 'password_handled': False, 'verification_link_accessed': False}))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'result': 'STOP', 'reason': str(error) if isinstance(error, (AssertionError, RuntimeError)) else 'Operation failed; sensitive details suppressed', 'automatic_retry': False}))
        sys.exit(1)
