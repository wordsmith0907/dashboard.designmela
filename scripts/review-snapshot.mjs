// Read-only review: never print credential values or matching source lines.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const workingTree = process.argv.includes('--working-tree');
const staged = git('ls-files', '-z').split('\0').filter(Boolean);
const untracked = git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
const differences = git('diff', '--name-only', '-z').split('\0').filter(Boolean);
const manifestArg = process.argv.find(arg => arg.startsWith('--manifest='));
const manifestPath = manifestArg?.slice('--manifest='.length) ?? 'docs/first-commit-files.txt';
const intended = fs.readFileSync(manifestPath, 'utf8').trim().split(/\r?\n/);
const manifestMismatch = [...new Set([...staged,...intended])].filter(file => staged.includes(file) !== intended.includes(file));
const findings = [];
const needles = [];
if (fs.existsSync('.env.local')) {
  const env = fs.readFileSync('.env.local', 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match || match[1].startsWith('NEXT_PUBLIC_')) continue;
    const value = match[2].replace(/^['"]|['"]$/g, '');
    if (value.length > 8) needles.push(value);
    if (match[1] === 'DATABASE_URL') {
      try {
        const password = decodeURIComponent(new URL(value).password);
        if (password.length > 6) needles.push(password, encodeURIComponent(password));
      } catch { findings.push({ file: '.env.local', kind: 'Invalid database URL; cannot complete known-password scan' }); }
    }
  }
}
const patterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['Supabase secret key', /sb_secret_[A-Za-z0-9_-]{12,}/],
  ['provider token', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{12,})/],
  ['credential assignment', /(?:password|service_role_key|api_key|access_token|secret_key)\s*[:=]\s*["'][A-Za-z0-9+\/_!@#$%=-]{16,}["']/i],
];
function scan(file, body) {
  if (body.includes('\0')) return;
  body.split(/\r?\n/).forEach((line, i) => {
    if (needles.some(n => line.includes(n))) findings.push({file, line:i+1, kind:'Known local credential'});
    for (const [kind, regex] of patterns) if (regex.test(line)) findings.push({file, line:i+1, kind});
    for (const token of line.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? []) {
      try { if (JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role !== 'anon') findings.push({file,line:i+1,kind:'Non-anonymous JWT'}); }
      catch { findings.push({file,line:i+1,kind:'JWT-like token requires review'}); }
    }
    for (const match of line.matchAll(/postgres(?:ql)?:\/\/[^:\s/]+:([^@\s]+)@/g)) {
      if (!['URL_ENCODED_PASSWORD','YOUR-PASSWORD','[YOUR-PASSWORD]'].includes(match[1])) findings.push({file,line:i+1,kind:'Database connection credential'});
    }
  });
}
const scanFiles = workingTree ? [...new Set([...staged,...untracked])].filter(file => fs.existsSync(file)) : staged;
for (const file of scanFiles) scan(file, workingTree ? fs.readFileSync(file,'utf8') : git('show', `:${file}`));
let assetCount = 0;
function scanAssets(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scanAssets(file);
    else if (/\.(js|map|html)$/.test(file)) { assetCount++; scan(file,fs.readFileSync(file,'utf8')); }
  }
}
scanAssets('.next/static');
let envIgnored = false;
try { git('check-ignore', '--quiet', '.env.local'); envIgnored = true; } catch {}
const envStaged = staged.includes('.env.local');
const generated = staged.filter(file => /^(node_modules|\.next|test-results|playwright-report|supabase\/\.temp)\//.test(file));
const passed = (workingTree || (!differences.length && !untracked.length && !manifestMismatch.length)) && !findings.length && !generated.length && envIgnored && !envStaged;
console.log(JSON.stringify({result:passed?'PASS':'FAIL',mode:workingTree?'working-tree':'staged',filesScanned:scanFiles.length,stagedFiles:staged.length,...(!workingTree ? {manifestMismatch,workingTreeDifferences:differences,untracked}:{}),envIgnored,envStaged,generatedFiles:generated,browserAssetsScanned:assetCount,findings},null,2));
process.exitCode = passed ? 0 : 1;
