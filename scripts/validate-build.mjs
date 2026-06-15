// Post-build validator: JSON-LD parse, single-H1, internal-link resolution.
// Run after `npm run build`:  node scripts/validate-build.mjs
// Business-agnostic; reads DIST from scripts/audit.config.mjs.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIST } from './audit.config.mjs';

const htmlFiles = [];
function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && htmlFiles.push(p);
  }
}
walk(DIST);

let schemaCount = 0;
const schemaErrors = [];
const h1Issues = [];
const internalLinks = new Set();

for (const f of htmlFiles) {
  const html = readFileSync(f, 'utf8');
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    schemaCount++;
    try { JSON.parse(m[1]); } catch (e) { schemaErrors.push(`${f}: ${e.message}`); }
  }
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) h1Issues.push(`${f}: ${h1} h1`);
  const lre = /href="(\/[^"#?]*)"/g;
  let lm;
  while ((lm = lre.exec(html))) internalLinks.add(lm[1]);
}

function resolves(link) {
  if (link === '/') return existsSync(join(DIST, 'index.html'));
  if (/\.[a-z0-9]+$/i.test(link)) return existsSync(join(DIST, link));
  const clean = link.replace(/\/$/, '');
  return existsSync(join(DIST, clean, 'index.html')) || existsSync(join(DIST, clean + '.html'));
}
const linkIssues = [...internalLinks].filter((l) => !resolves(l));

console.log('HTML pages:', htmlFiles.length);
console.log('JSON-LD blocks:', schemaCount, '| parse errors:', schemaErrors.length);
schemaErrors.forEach((e) => console.log('  SCHEMA ERR', e));
console.log('Pages with !=1 H1:', h1Issues.length);
h1Issues.forEach((e) => console.log('  H1', e));
console.log('Internal links:', internalLinks.size, '| broken:', linkIssues.length);
linkIssues.forEach((l) => console.log('  BROKEN', l));

const ok = schemaErrors.length === 0 && h1Issues.length === 0 && linkIssues.length === 0;
console.log(ok ? '\nVALIDATION: PASS' : '\nVALIDATION: FAIL');
process.exit(ok ? 0 : 1);
