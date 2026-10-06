// ncp-forge — the bridge between Forge (on the phone) and Muse (the operator's assistant).
//
// Forge pushes its whole state here whenever something worth keeping changes. Muse reads it back
// over the same data two ways: a read-only HTTPS API (/v1/*) and an MCP server (/mcp) whose tools
// return the same answers. Plan questions ("what's today?") are answered by Forge's own engine
// (../js), so Muse sees exactly what the app would show. No dependencies.
//
// Secrets (wrangler secret put): WRITE_KEY — the phone's push key. READ_KEY — Muse's read-only key.
// KV binding FORGE: 'state' = latest snapshot, 'meta' = {syncedAt, sessions},
// 'snap:YYYY-MM-DD' = a daily copy kept 30 days (a backup that costs nothing).

import * as store from '../js/store.js';
import * as engine from '../js/engine.js';
import * as program from '../js/program.js';
import { EXERCISES, getExercise } from '../js/exercises.js';

const VERSION = '1.0.0';
const ORIGINS = ['https://nikleadgen.github.io', 'http://localhost:8731'];
const MCP_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const MCP_DEFAULT = '2025-06-18';
const NOT_SYNCED = "Forge hasn't synced yet — open Forge on the phone, Settings → Muse sync, and connect it.";

// store.js is Forge's persistence layer; in the worker it just holds one snapshot in memory for the
// engine. Each request re-imports the latest snapshot before computing (no awaits in between).
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => { mem.set(k, String(v)); }, removeItem: (k) => { mem.delete(k); } };

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    let res;
    try {
      if (path === '/' || path === '/v1') res = json(index(url));
      else if (path === '/health') res = json({ ok: true, service: 'ncp-forge', version: VERSION });
      else if (path === '/v1/sync') res = req.method === 'POST' ? await sync(req, env, url) : json({ error: 'POST only' }, 405);
      else if (path === '/mcp') res = await mcp(req, env, url);
      else if (path.startsWith('/v1/') && req.method === 'GET') res = await api(req, env, url, path.slice(3)); // '/today'
      else res = json({ error: 'not found — see /v1' }, 404);
    } catch (e) {
      res = json({ error: 'server error', detail: String((e && e.message) || e) }, 500);
    }
    for (const [k, v] of Object.entries(cors(req))) res.headers.set(k, v);
    return res;
  },
};

// ---------------- plumbing ----------------
function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 1), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function cors(req) {
  const o = req.headers.get('Origin');
  if (!ORIGINS.includes(o)) return {};
  return { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const bearer = (req) => (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
function keyOk(got, key) {
  if (!key || !got) return false; // an unset secret must never mean "open"
  const a = new TextEncoder().encode(got), b = new TextEncoder().encode(key);
  return a.length === b.length && crypto.subtle.timingSafeEqual(a, b);
}
// Reads take the read key (or the owner's write key), as a Bearer header or ?key= for clients
// that can only be given a URL.
function canRead(req, url, env) {
  const got = bearer(req) || url.searchParams.get('key') || '';
  return keyOk(got, env.READ_KEY) || keyOk(got, env.WRITE_KEY);
}

async function load(env) {
  const [raw, meta] = await Promise.all([env.FORGE.get('state'), env.FORGE.get('meta', 'json')]);
  if (!raw) return null;
  store.importJSON(raw); // migrates older schemas exactly as the app would
  return { s: store.get(), syncedAt: (meta && meta.syncedAt) || null };
}

// ---------------- write: the phone pushes ----------------
async function sync(req, env, url) {
  if (!keyOk(bearer(req), env.WRITE_KEY)) return json({ error: 'bad or missing write key' }, 401);
  const text = await req.text();
  if (text.length > 20e6) return json({ error: 'too large' }, 413);
  let incoming;
  try { incoming = JSON.parse(text); } catch (e) { return json({ error: 'body is not JSON' }, 400); }
  if (!incoming || typeof incoming !== 'object' || !('schemaVersion' in incoming) || !Array.isArray(incoming.sessions)) {
    return json({ error: 'not a Forge state' }, 400);
  }
  // Never lose a logged workout: a device with fewer sessions than the cloud (fresh install,
  // cleared storage) can't overwrite it unless explicitly forced.
  const meta = await env.FORGE.get('meta', 'json');
  const n = incoming.sessions.length;
  if (meta && n < meta.sessions && url.searchParams.get('force') !== '1') {
    return json({ error: `cloud has ${meta.sessions} workouts, this device ${n} — not overwriting`, cloudSessions: meta.sessions }, 409);
  }
  const syncedAt = new Date().toISOString();
  await Promise.all([
    env.FORGE.put('state', text),
    env.FORGE.put('meta', JSON.stringify({ syncedAt, sessions: n, bytes: text.length })),
    env.FORGE.put('snap:' + syncedAt.slice(0, 10), text, { expirationTtl: 30 * 86400 }),
  ]);
  return json({ ok: true, syncedAt, sessions: n, bytes: text.length });
}

// ---------------- read: one set of queries, served as API routes and MCP tools ----------------
const U = (s) => (s.settings && s.settings.units) || 'lb';
const day = (iso) => (iso || '').slice(0, 10);
const exName = (id) => ({ mile: '1-Mile Time', sandbag: 'Sandbag (heaviest shouldered)' }[id] || getExercise(id).name);
const intArg = (v, def, lo, hi) => { const n = parseInt(v, 10); return Math.max(lo, Math.min(hi, isNaN(n) ? def : n)); };

function setStr(st) {
  let out;
  if (st.weight && st.reps != null) out = `${st.weight}×${st.reps}`;
  else if (st.reps != null) out = `${st.reps} reps`;
  else if (st.seconds) out = `${st.seconds}s`;
  else if (st.weight) out = `@${st.weight}`;
  else out = 'done';
  return st.rir != null ? `${out} (${st.rir} left)` : out;
}
function sessionKind(x) {
  if (x.free === 'pick') return 'Pick your lifts';
  if (x.free) return 'Just Lift';
  if (x.optional) return 'Optional day';
  return `Program — week ${x.absWeek + 1}, session ${x.sessionInWeek + 1}`;
}
function sessionLog(x) {
  const exercises = (x.entries || []).map((e) => {
    const sets = (e.sets || []).filter((st) => st.done).map(setStr);
    const o = { name: e.name, sets };
    if (e.resultSeconds) o.time = engine.fmtTime(e.resultSeconds);
    if (e.resultRounds) o.rounds = e.resultRounds;
    if (e.topWeight) o.topWeight = e.topWeight;
    return (sets.length || o.time || o.rounds || o.topWeight) ? o : null;
  }).filter(Boolean);
  const o = { date: day(x.dateISO), name: x.dayName, kind: sessionKind(x), sessionRPE: x.sessionRPE, minutes: x.durationMin, exercises };
  if (x.tweaks && x.tweaks.length) o.flaggedNiggles = x.tweaks;
  return o;
}
// A resolved session (engine.resolveSessionAt) → what to do, with every load filled in.
function sessionOut(r) {
  return {
    name: r.dayName, isTest: !!r.isTest,
    exercises: r.blocks.map((b) => {
      const o = { name: b.name, id: b.exerciseId, prescription: b.prescription };
      if (b.note) o.note = b.note;
      if (b.paceHint) o.pace = b.paceHint;
      return o;
    }),
  };
}
function weekOut(s, aw, live) {
  const pc = program.planContext(aw);
  const order = program.sessionPriority(aw);
  const target = store.weekTarget(s);
  // Future weeks shouldn't inherit today's readiness — show them as planned.
  const basis = live ? s : { ...s, readiness: [], body: [] };
  const res = live ? store.weekResolution(aw) : null;
  const next = live ? store.suggestedIndex(aw) : null;
  return {
    week: aw + 1, phase: pc.phase.name, wave: pc.waveLabel, deload: pc.isDeload, testWeek: pc.isTestWeek,
    weeklyTarget: target,
    ...(live ? { done: Object.keys(res.done).length } : {}),
    sessions: order.map((i, pos) => {
      const o = { index: i, inYourWeek: pos < target, ...sessionOut(engine.resolveSessionAt(basis, aw, i, {})) };
      if (live) {
        o.status = res.done[i] ? 'done' : res.skipped[i] ? 'skipped' : i === next ? 'up next' : 'queued';
        if (res.done[i]) o.doneOn = day(res.doneDate[i]);
      }
      return o;
    }),
  };
}
function findLift(s, q) {
  const k = String(q || '').toLowerCase().trim();
  if (!k) return null;
  if (EXERCISES[k]) return k;
  const ids = Object.keys(EXERCISES);
  const has = (id) => ((s.history && s.history[id]) || []).length > 0;
  const exact = ids.filter((id) => EXERCISES[id].name.toLowerCase() === k);
  const partial = ids.filter((id) => EXERCISES[id].name.toLowerCase().includes(k) || id.includes(k.replace(/\s+/g, '_')));
  const pool = exact.length ? exact : partial;
  return pool.find(has) || pool[0] || null;
}

const TOOLS = [
  {
    name: 'get_today',
    description: "Today's training: where the athlete is in the 52-week plan, today's readiness, the next planned session with every exercise and load filled in, anything already logged today, and an in-progress workout if one is open. Use for \"what's my workout today?\"",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: ({ s }) => {
      const aw = s.program.absWeek;
      const pc = program.planContext(aw);
      const today = new Date().toISOString().slice(0, 10);
      const rd = (s.readiness || []).find((r) => day(r.dateISO) === today);
      const rs = engine.combinedReadiness(s);
      const res = store.weekResolution(aw);
      const target = store.weekTarget(s);
      const st = engine.scheduleStatus(s);
      const lp = engine.lastPick(s);
      const out = {
        date: today, units: U(s),
        program: { week: aw + 1, of: 52, phase: pc.phase.name, wave: pc.waveLabel, deload: pc.isDeload, testWeek: pc.isTestWeek,
          weekProgress: `${Math.min(Object.keys(res.done).length, target)}/${target} sessions done`,
          weeksBehindCalendar: st ? st.weeksBehind : 0, weeksToQualifier: st ? st.weeksToQualifier : pc.weeksToQualifier },
        readiness: rd ? { band: rs.band, score: rs.score, note: rs.message } : 'not checked in today',
        loggedToday: (s.sessions || []).filter((x) => day(x.dateISO) === today).map(sessionLog),
        upNext: sessionOut(engine.resolveSessionAt(s, aw, store.suggestedIndex(aw), {})),
      };
      const lay = engine.layoffScale(s);
      if (lay.note) out.comebackNote = lay.note;
      if (s.active) out.inProgress = { name: s.active.dayName, startedAt: s.active.startedAt,
        setsLogged: (s.active.entries || []).reduce((n, e) => n + (e.sets || []).filter((x) => x.done).length, 0) };
      if (lp) out.lastPickYourLiftsDay = { date: day(lp.dateISO), name: lp.name, lifts: lp.ids.map(exName) };
      if ((s.tweaks || []).length) out.trainingAround = s.tweaks.map((t) => engine.areaLabel(t.area));
      return out;
    },
  },
  {
    name: 'get_week',
    description: "This week of the program: each session in priority order with its status (done / skipped / up next / queued), the date done, and the full prescription with loads. The athlete's week counts as complete after `weeklyTarget` sessions; the rest are extra credit.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: ({ s }) => weekOut(s, s.program.absWeek, true),
  },
  {
    name: 'get_plan',
    description: 'The 52-week plan to the NCP Games: every phase with its weeks and focus, the current position, and qualifier/finals weeks. Pass `week` (1–52) to get that week\'s sessions with loads computed from current strength.',
    inputSchema: { type: 'object', properties: { week: { type: 'integer', minimum: 1, maximum: 52, description: 'Program week to detail (1–52)' } }, additionalProperties: false },
    run: ({ s }, a) => {
      const cur = s.program.absWeek;
      const out = {
        currentWeek: cur + 1, currentPhase: program.planContext(cur).phase.name,
        qualifierWeek: program.MACRO.qualifierWeek + 1, finalsWeek: program.MACRO.finalsWeek + 1,
        phases: program.phaseTimeline().map((p) => ({ name: p.name, weeks: `${p.start + 1}–${p.end + 1}`, focus: p.focus })),
      };
      if (a.week != null) { const w = intArg(a.week, cur + 1, 1, 52) - 1; out.weekDetail = weekOut(s, w, w === cur); }
      return out;
    },
  },
  {
    name: 'get_recent_workouts',
    description: 'Logged workouts, newest first — program sessions, Just Lift days and Pick-your-lifts days — with every completed set (weight×reps, reps left in reserve), session RPE and duration.',
    inputSchema: { type: 'object', properties: {
      limit: { type: 'integer', minimum: 1, maximum: 50, description: 'How many workouts (default 10)' },
      since: { type: 'string', description: 'Only workouts on/after this date, YYYY-MM-DD' } }, additionalProperties: false },
    run: ({ s }, a) => {
      let xs = (s.sessions || []).slice().sort((x, y) => (x.dateISO < y.dateISO ? 1 : -1));
      if (a.since) xs = xs.filter((x) => day(x.dateISO) >= String(a.since));
      return { units: U(s), total: xs.length, workouts: xs.slice(0, intArg(a.limit, 10, 1, 50)).map(sessionLog) };
    },
  },
  {
    name: 'get_strength',
    description: "Current working maxes (estimated 1RM per lift, rep maxes, mile time), progress toward each NCP Games event standard, and the training-load ratio (7-day vs 28-day). These numbers drive every prescribed load.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: ({ s }) => {
      const u = U(s);
      const maxes = Object.entries(s.maxes || {}).map(([id, m]) => {
        const o = { lift: exName(id), id };
        if (m.e1rm) o.estimated1RM = `${m.e1rm} ${u}`;
        if (m.maxReps) o.maxReps = m.maxReps;
        if (m.seconds) o.time = engine.fmtTime(m.seconds);
        if (m.rounds) o.rounds = m.rounds;
        if (m.weight) o.weight = `${m.weight} ${u}`;
        if (m.updated) o.updated = day(m.updated);
        return o;
      }).sort((x, y) => x.lift.localeCompare(y.lift));
      const acwr = engine.computeACWR(s);
      return {
        bodyweight: s.profile && s.profile.bodyweight ? `${s.profile.bodyweight} ${u}` : null,
        maxes,
        eventReadiness: engine.eventReadiness(s).map((e) => ({ event: e.label, current: e.current, target: e.target, percent: e.pct })),
        trainingLoad: { ratio: acwr.ratio ? +acwr.ratio.toFixed(2) : null, status: acwr.status, advice: acwr.advice },
      };
    },
  },
  {
    name: 'get_lift_history',
    description: 'Every logged session of one lift (by name or id, e.g. "bench", "Pull-Up", "db_row"): sets per day, the best estimated 1RM each day, the current working max and what was done last time.',
    inputSchema: { type: 'object', properties: {
      lift: { type: 'string', description: 'Lift name or id' },
      limit: { type: 'integer', minimum: 1, maximum: 100, description: 'How many training days (default 20)' } }, required: ['lift'], additionalProperties: false },
    run: ({ s }, a) => {
      const id = findLift(s, a.lift);
      if (!id) throw new Error(`No lift matches "${a.lift}".`);
      const byDay = {};
      for (const h of (s.history && s.history[id]) || []) (byDay[h.dateISO] = byDay[h.dateISO] || []).push(h);
      const days = Object.keys(byDay).sort().reverse().slice(0, intArg(a.limit, 20, 1, 100)).map((d) => {
        const sets = byDay[d];
        const best = Math.max(0, ...sets.map((x) => (x.weight && x.reps ? engine.e1rmFromSet(x.weight, x.reps, x.rir != null ? x.rir : 2) : 0)));
        return { date: day(d), sets: sets.map(setStr), ...(best ? { bestEstimated1RM: Math.round(best) } : {}) };
      });
      const m = (s.maxes && s.maxes[id]) || {};
      const last = engine.lastSummary(s, id);
      return { lift: exName(id), id, units: U(s), workingMax: m.e1rm ? { estimated1RM: m.e1rm } : m.maxReps ? { maxReps: m.maxReps } : null,
        lastTime: last ? `${last.text} on ${day(last.dateISO)}` : null, days };
    },
  },
  {
    name: 'get_body_metrics',
    description: 'Body and recovery log (weight, body fat, resting HR, HRV, sleep — from Hume/Apple Health or manual) plus daily readiness check-ins (sleep, energy, freshness, calm, drive on 1–5, and the score).',
    inputSchema: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 365, description: 'How many days back (default 30)' } }, additionalProperties: false },
    run: ({ s }, a) => {
      const since = new Date(Date.now() - intArg(a.days, 30, 1, 365) * 86400000).toISOString();
      const pick = (arr) => (arr || []).filter((x) => x.dateISO >= since).sort((x, y) => (x.dateISO < y.dateISO ? 1 : -1));
      return {
        units: U(s),
        body: pick(s.body).map(({ dateISO, ...rest }) => ({ date: day(dateISO), ...rest })),
        readiness: pick(s.readiness).map(({ dateISO, ...rest }) => ({ date: day(dateISO), ...rest })),
      };
    },
  },
];
const ROUTES = { today: 'get_today', week: 'get_week', plan: 'get_plan', workouts: 'get_recent_workouts', strength: 'get_strength', lift: 'get_lift_history', body: 'get_body_metrics' };

function index(url) {
  const base = url.origin;
  return {
    service: 'ncp-forge — Forge training data for Muse', version: VERSION,
    auth: 'Authorization: Bearer <READ_KEY>  (or ?key=<READ_KEY>)',
    mcp: `${base}/mcp  (MCP over streamable HTTP; tools: ${TOOLS.map((t) => t.name).join(', ')})`,
    api: Object.keys(ROUTES).map((r) => `GET ${base}/v1/${r}`).concat([`GET ${base}/v1/state  (the full raw Forge state)`]),
    params: { plan: '?week=1-52', workouts: '?limit=10&since=YYYY-MM-DD', lift: '?lift=bench&limit=20', body: '?days=30' },
  };
}

async function api(req, env, url, route) {
  if (!canRead(req, url, env)) return json({ error: 'bad or missing read key' }, 401);
  const L = await load(env);
  if (!L) return json({ error: NOT_SYNCED }, 404);
  if (route === '/state') return json({ syncedAt: L.syncedAt, state: L.s });
  const tool = TOOLS.find((t) => t.name === ROUTES[route.slice(1)]);
  if (!tool) return json({ error: 'not found — see /v1' }, 404);
  const args = Object.fromEntries(url.searchParams);
  delete args.key;
  try { return json({ syncedAt: L.syncedAt, ...tool.run(L, args) }); }
  catch (e) { return json({ error: e.message }, 400); }
}

// ---------------- MCP (streamable HTTP, stateless, JSON responses) ----------------
const INSTRUCTIONS = 'Forge is the athlete\'s training app for the New Christendom Press Games (~June 2027): a 52-week periodized plan plus on-demand lift days, autoregulated from logged sets. Data is synced from the phone after each workout — check `syncedAt` for freshness. Loads are in the units given. Start with get_today for "what\'s my workout"; get_recent_workouts for what was done; get_strength for numbers and event progress; get_lift_history for one lift over time. Read-only.';

async function mcp(req, env, url) {
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  if (!canRead(req, url, env)) return json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized — send the read key as a Bearer token or ?key=' } }, 401);
  let msg;
  try { msg = await req.json(); } catch (e) { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
  const batch = Array.isArray(msg);
  const out = [];
  for (const m of batch ? msg : [msg]) { const r = await rpc(m, env); if (r) out.push(r); }
  if (!out.length) return new Response(null, { status: 202 }); // notifications only
  return json(batch ? out : out[0]);
}
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
async function rpc(m, env) {
  const isNote = !m || typeof m !== 'object' || !('id' in m);
  if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') return isNote ? null : fail(m.id, -32600, 'Invalid Request');
  const id = m.id;
  const p = m.params || {};
  switch (m.method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: MCP_VERSIONS.includes(p.protocolVersion) ? p.protocolVersion : MCP_DEFAULT,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'ncp-forge', title: 'Forge — NCP Games Trainer', version: VERSION },
        instructions: INSTRUCTIONS,
      });
    case 'ping': return isNote ? null : ok(id, {});
    case 'tools/list': return ok(id, { tools: TOOLS.map(({ run, ...t }) => t) });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === p.name);
      if (!tool) return fail(id, -32602, `Unknown tool: ${p.name}`);
      const L = await load(env);
      if (!L) return ok(id, { content: [{ type: 'text', text: NOT_SYNCED }], isError: true });
      try {
        const result = { syncedAt: L.syncedAt, ...tool.run(L, p.arguments || {}) };
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 1) }] });
      } catch (e) {
        return ok(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
    }
    default:
      return isNote ? null : fail(id, -32601, `Method not found: ${m.method}`);
  }
}
