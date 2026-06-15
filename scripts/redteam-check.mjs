#!/usr/bin/env node
/**
 * Red-team enforcement gate.
 *
 * A guide may not deploy unless its CURRENT content hash has a recorded PASS in
 * the red-team ledger. This makes the adversarial review (docs/RED-TEAM-SOP.md)
 * impossible to skip: edit a guide -> hash changes -> gate blocks until it's
 * re-reviewed and a fresh PASS is recorded. Wired into `npm run gate`.
 *
 * Business-agnostic. Paths are config-driven: GUIDES_DIR + LEDGER are read from
 * scripts/audit.config.mjs (the per-business slot), the same way seo-audit.mjs
 * reads DIST/pageType/etc. Both fall back to sensible defaults if the config
 * doesn't define them, so an older audit.config.mjs keeps working.
 *
 * Modes:
 *   (default)              check all guides; exit 1 if any NEW or CHANGED guide lacks a PASS
 *   --status              print the table only; never exit non-zero
 *   --seed                grandfather every current guide (one-time rollout; never downgrades a PASS)
 *   --pass <slug> [note]  record the current hash of <slug> as PASS (after it clears the red-team SOP)
 *
 * Ledger entry: { hash, status: "passed" | "grandfathered", date, note? }
 *   passed        = cleared the full red-team SOP at this content hash
 *   grandfathered = pre-existing guide, manually reviewed, not yet run through the SOP (WARN, not block)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import * as cfg from './audit.config.mjs';

// Config-driven with defaults. Define GUIDES_DIR / LEDGER in audit.config.mjs to
// override (e.g. a project whose guides live somewhere other than src/content/guides).
const GUIDES_DIR = cfg.GUIDES_DIR || 'src/content/guides';
const LEDGER = cfg.LEDGER || 'docs/red-team-ledger.json';

const hashOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
const today = () => new Date().toISOString().slice(0, 10);
const guides = () =>
  (existsSync(GUIDES_DIR) ? readdirSync(GUIDES_DIR) : [])
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map((f) => ({ slug: f.replace(/\.mdx?$/, ''), path: join(GUIDES_DIR, f) }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
const loadLedger = () => (existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {});
const saveLedger = (l) => {
  const sorted = {};
  for (const k of Object.keys(l).sort()) sorted[k] = l[k];
  writeFileSync(LEDGER, JSON.stringify(sorted, null, 2) + '\n');
};

const args = process.argv.slice(2);
const mode = args[0];

if (mode === '--seed') {
  const ledger = loadLedger();
  let n = 0;
  for (const g of guides()) {
    const h = hashOf(g.path);
    if (ledger[g.slug] && ledger[g.slug].hash === h) continue; // already recorded at this hash
    ledger[g.slug] = { hash: h, status: 'grandfathered', date: today() };
    n++;
  }
  saveLedger(ledger);
  console.log(`Seeded/updated ${n} guide(s) as grandfathered in ${LEDGER}.`);
  process.exit(0);
}

if (mode === '--pass') {
  const slug = args[1];
  if (!slug) { console.error('Usage: redteam-check.mjs --pass <slug> [note]'); process.exit(2); }
  const g = guides().find((x) => x.slug === slug);
  if (!g) { console.error(`No guide found: ${slug}`); process.exit(2); }
  const ledger = loadLedger();
  const note = args.slice(2).join(' ');
  ledger[slug] = { hash: hashOf(g.path), status: 'passed', date: today(), ...(note ? { note } : {}) };
  saveLedger(ledger);
  console.log(`Recorded PASS for ${slug} @ ${ledger[slug].hash}.`);
  process.exit(0);
}

// default / --status : check
const ledger = loadLedger();
const rows = [];
let block = 0, warn = 0, pass = 0;
for (const g of guides()) {
  const h = hashOf(g.path);
  const e = ledger[g.slug];
  let state;
  if (e && e.hash === h && e.status === 'passed') { state = 'PASS'; pass++; }
  else if (e && e.hash === h && e.status === 'grandfathered') { state = 'WARN'; warn++; }
  else { state = e ? 'CHANGED' : 'NEW'; block++; }
  rows.push({ state, slug: g.slug });
}
console.log('--- RED-TEAM LEDGER ---');
for (const r of rows) console.log(`  ${r.state.padEnd(8)} ${r.slug}`);
console.log(`\n${rows.length} guides | PASS ${pass} | WARN(grandfathered, sweep pending) ${warn} | BLOCK ${block}`);
if (mode === '--status') process.exit(0);
if (block > 0) {
  console.error(
    `\nRED-TEAM CHECK: BLOCKED — ${block} guide(s) are new or changed since their last red-team.\n` +
    `Run the red-team SOP (docs/RED-TEAM-SOP.md), then record the pass:\n` +
    `  node scripts/redteam-check.mjs --pass <slug> "<note>"`
  );
  process.exit(1);
}
console.log('RED-TEAM CHECK: PASS');
process.exit(0);
