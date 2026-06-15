// Per-page on-page SEO/AEO Definition-of-Done audit — the enforced launch gate.
// Run after `npm run build`:  node scripts/seo-audit.mjs   (exits non-zero on any required miss)
// Checks: title/desc length, single H1, canonical, OG+image, Twitter, image+alt, AEO answer
// block, FAQPage, BreadcrumbList, required schema nodes per type, internal links, word count,
// JSON-LD validity. Per-business config in scripts/audit.config.mjs. See docs/CONTENT-LAUNCH-SOP.md.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, pageType, WORD_MIN, SCHEMA_REQ, REQ } from './audit.config.mjs';

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p);
  }
})(DIST);

const routeOf = (f) => '/' + f.replace(new RegExp('^' + DIST + '/'), '').replace(/index\.html$/, '').replace(/\.html$/, '');

const grab = (re, html) => { const m = html.match(re); return m ? m[1] : null; };

function audit(html, type) {
  const r = {};
  const title = grab(/<title>([^<]*)<\/title>/, html);
  r.title = !title ? 'fail' : title.length > 65 || title.length < 10 ? 'warn' : 'pass';
  r._title = title ? title.length : 0;

  const desc = grab(/<meta name="description" content="([^"]*)"/, html);
  r.desc = !desc ? 'fail' : desc.length < 110 || desc.length > 165 ? 'warn' : 'pass';
  r._desc = desc ? desc.length : 0;

  r.h1 = (html.match(/<h1[\s>]/g) || []).length === 1 ? 'pass' : 'fail';
  r.canon = /<link rel="canonical"/.test(html) ? 'pass' : 'fail';

  const ogImg = grab(/<meta property="og:image" content="([^"]*)"/, html);
  r.og = /property="og:title"/.test(html) && /property="og:description"/.test(html) && ogImg ? 'pass' : 'fail';
  r.tw = /name="twitter:card"/.test(html) ? 'pass' : 'warn';
  if (ogImg) {
    const p = ogImg.replace(/^https?:\/\/[^/]+/, '');
    r.ogimg = existsSync(join(DIST, p)) ? 'pass' : 'warn';
  } else r.ogimg = 'warn';

  // SOP requires ≥1 *relevant* image with non-empty descriptive alt. Decorative images
  // (logo marks, etc.) correctly carry alt="" and must NOT trip the gate — so we require at
  // least one meaningful (non-empty-alt) image rather than failing on any empty alt.
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const meaningful = imgs.filter((t) => /\balt="[^"]+"/i.test(t)).length;
  const noAltAttr = imgs.filter((t) => !/\balt=/i.test(t)).length; // missing attr entirely (alt="" is fine)
  r.img = meaningful >= 1 ? 'pass' : 'fail';
  r._img = `${imgs.length}i/${meaningful}alt${noAltAttr ? '/' + noAltAttr + 'noalt' : ''}`;

  // AEO answer block: first <p> after the <h1> inside <main>, 25–90 words ideal.
  const main = (html.match(/<main[^>]*>([\s\S]*?)<\/main>/) || [, html])[1];
  const afterH1 = main.slice(main.search(/<h1[\s>]/) + 1);
  const ans = [...afterH1.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].slice(0, 3)
    .map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').split(/\s+/).filter(Boolean).length)
    .reduce((a, b) => Math.max(a, b), 0);
  r.answer = ans >= 25 ? 'pass' : ans >= 12 ? 'warn' : 'fail';
  r._answer = ans;

  r.faq = /"@type":\s*"FAQPage"/.test(html) ? 'pass' : 'fail';
  r.crumb = /"@type":\s*"BreadcrumbList"/.test(html) ? 'pass' : 'fail';

  const types = new Set([...html.matchAll(/"@type":\s*"([^"]+)"/g)].map((m) => m[1]));
  const need = SCHEMA_REQ[type] || [];
  const missing = need.filter((t) => !types.has(t));
  r.nodes = missing.length === 0 ? 'pass' : 'fail';
  r._nodes = missing.length ? 'miss:' + missing.join(',') : 'ok';

  const internal = new Set(html.match(/href="(\/[^"#?]*)"/g) || []);
  r.links = internal.size >= 3 ? 'pass' : 'warn';
  r._links = internal.size;

  const text = main.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
  r._words = text.split(/\s+/).filter(Boolean).length;
  r.words = r._words >= (WORD_MIN[type] || 0) ? 'pass' : 'warn';

  let schemaOk = true;
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { schemaOk = false; }
  }
  r.schema = schemaOk ? 'pass' : 'fail';
  return r;
}

const ICON = { pass: '✓', warn: '~', fail: '✗' };
const CHECKS = ['title','desc','h1','canon','og','ogimg','img','answer','faq','crumb','nodes','links','words','schema'];
let hardFails = 0, warns = 0;
const rows = [], detail = [];

for (const f of files.sort()) {
  const route = routeOf(f), type = pageType(route);
  if (type === 'skip') continue;
  const r = audit(readFileSync(f, 'utf8'), type);
  const req = REQ[type] || [];
  const cells = CHECKS.map((c) => {
    const v = r[c];
    if (v === undefined) return null;
    const required = req.includes(c);
    if (required && v === 'fail') { hardFails++; detail.push(`${route} [${type}] ${c} FAIL (${r['_' + c] ?? ''})`); }
    if (v === 'warn') warns++;
    return `${c}:${required && v === 'fail' ? '✗' : ICON[v]}`;
  }).filter(Boolean);
  rows.push(`${route.padEnd(28)} ${type.padEnd(8)} t${r._title} d${r._desc} a${r._answer} w${r._words} l${r._links}  ${cells.join(' ')}`);
}

console.log(rows.join('\n'));
console.log('\n--- HARD FAILS ---');
console.log(detail.length ? detail.join('\n') : 'none');
console.log(`\nPages: ${rows.length} | hard fails: ${hardFails} | warns: ${warns}`);
console.log(hardFails === 0 ? 'SEO AUDIT: PASS' : 'SEO AUDIT: FAIL');
process.exit(hardFails === 0 ? 0 : 1);
