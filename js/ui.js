// ui.js — the view layer. Renders into #app, wires interactions via event delegation.
// Design goal: open → see today → tap a number → done. Minimum taps, nothing to decide.

import * as store from './store.js';
import * as engine from './engine.js';
import * as program from './program.js';
import { getExercise } from './exercises.js';
import { lineChart, barChart, gauge, progressBar } from './charts.js';

let root = null;
let onbStep = 0;
const onb = {};            // onboarding scratch
let rest = { id: null, endAt: 0, dur: 0 };

const U = () => (store.get().settings.units || 'lb');
const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[m]));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
const demoURL = (q) => 'https://www.youtube.com/results?search_query=' + encodeURIComponent((q || '') + ' form');

export function init(el) {
  root = el;
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onChange);
  if (!rest.id) rest.id = setInterval(tickRest, 1000);
}

export function render() {
  const s = store.get();
  if (!s.profile) { document.body.dataset.route = 'onboarding'; return renderOnboarding(); }
  const hash = location.hash || '#/today';
  if (s.active && hash.startsWith('#/workout')) { document.body.dataset.route = 'workout'; return renderWorkout(); }
  document.body.dataset.route = 'app';
  setNav(hash);
  if (hash.startsWith('#/progress')) return renderProgress();
  if (hash.startsWith('#/plan')) return renderPlan();
  if (hash.startsWith('#/settings')) return renderSettings();
  return renderToday();
}

function setNav(hash) {
  document.querySelectorAll('.nav-item').forEach((n) => {
    n.classList.toggle('active', hash.startsWith(n.getAttribute('href')));
  });
}

// ============================ ONBOARDING ============================
function renderOnboarding() {
  const steps = [stepWelcome, stepProfile, stepExperience, stepMaxes, stepReady];
  root.innerHTML = `<div class="onb">${steps[onbStep]()}</div>`;
}
function chips(field, n, labels) {
  let out = '<div class="chiprow">';
  for (let i = 1; i <= n; i++) out += `<button class="chip ${onb[field] === i ? 'sel' : ''}" data-act="onb-chip" data-field="${field}" data-val="${i}">${labels ? labels[i - 1] : i}</button>`;
  return out + '</div>';
}
function stepWelcome() {
  return `<div class="onb-card">
    <div class="brand">⚒︎ FORGE</div>
    <h1>Let's build a champion.</h1>
    <p class="muted">A 12-month, research-backed plan to take you from detrained to the podium at the New Christendom Press Games. First, a few things so the plan fits <em>you</em>. Takes 60 seconds.</p>
    <label class="fld">Your name<input id="f-name" placeholder="e.g. Nik" value="${esc(onb.name || '')}"></label>
    <div class="fld">Units
      <div class="seg">
        <button class="seg-btn ${(onb.units || 'lb') === 'lb' ? 'sel' : ''}" data-act="onb-units" data-val="lb">lb</button>
        <button class="seg-btn ${onb.units === 'kg' ? 'sel' : ''}" data-act="onb-units" data-val="kg">kg</button>
      </div>
    </div>
    <button class="btn-primary big" data-act="onb-next">Begin →</button>
  </div>`;
}
function stepProfile() {
  return `<div class="onb-card">
    <h2>About you</h2>
    <div class="grid2">
      <label class="fld">Age<input id="f-age" type="number" inputmode="numeric" value="${esc(onb.age || '')}"></label>
      <div class="fld">Sex
        <div class="seg">
          <button class="seg-btn ${(onb.sex || 'm') === 'm' ? 'sel' : ''}" data-act="onb-sex" data-val="m">M</button>
          <button class="seg-btn ${onb.sex === 'f' ? 'sel' : ''}" data-act="onb-sex" data-val="f">F</button>
        </div>
      </div>
      <label class="fld">Bodyweight (${onb.units || 'lb'})<input id="f-bw" type="number" inputmode="decimal" value="${esc(onb.bodyweight || '')}"></label>
      <label class="fld">Height (in)<input id="f-ht" type="number" inputmode="numeric" value="${esc(onb.heightIn || '')}"></label>
    </div>
    <div class="onb-nav"><button class="btn-ghost" data-act="onb-back">← Back</button><button class="btn-primary" data-act="onb-next">Next →</button></div>
  </div>`;
}
function stepExperience() {
  const inj = onb.injuries || [];
  const injBtn = (id, label) => `<button class="chip ${inj.includes(id) ? 'sel' : ''}" data-act="onb-inj" data-val="${id}">${label}</button>`;
  return `<div class="onb-card">
    <h2>Training history</h2>
    <div class="fld">How would you describe yourself now?
      ${chips('experience', 3, ['Detrained (was fit before)', 'True beginner', 'Currently active'])}
    </div>
    <div class="fld">Any niggles to train around? (optional)
      <div class="chiprow wrap">${injBtn('knee', 'Knees')}${injBtn('back', 'Lower back')}${injBtn('shoulder', 'Shoulders')}${injBtn('none', 'None')}</div>
    </div>
    <div class="grid2">
      <div class="fld">Pull-up bar on your rack?
        <div class="seg"><button class="seg-btn ${onb.hasPullupBar !== false ? 'sel' : ''}" data-act="onb-bar" data-val="1">Yes</button><button class="seg-btn ${onb.hasPullupBar === false ? 'sel' : ''}" data-act="onb-bar" data-val="0">No</button></div>
      </div>
      <label class="fld">Sandbag weight available (${onb.units || 'lb'})<input id="f-sb" type="number" inputmode="numeric" placeholder="e.g. 60" value="${esc(onb.sandbagMax || '')}"></label>
    </div>
    <div class="onb-nav"><button class="btn-ghost" data-act="onb-back">← Back</button><button class="btn-primary" data-act="onb-next">Next →</button></div>
  </div>`;
}
function stepMaxes() {
  const know = onb.knowMaxes !== false;
  return `<div class="onb-card">
    <h2>Your starting numbers</h2>
    <p class="muted">Know roughly where you stand? Enter what you know — leave the rest blank and the plan will calibrate from your first sessions. Nothing here is binding.</p>
    <div class="seg wide">
      <button class="seg-btn ${know ? 'sel' : ''}" data-act="onb-know" data-val="1">I'll enter some</button>
      <button class="seg-btn ${!know ? 'sel' : ''}" data-act="onb-know" data-val="0">Calibrate me</button>
    </div>
    ${know ? `<div class="grid2">
      <label class="fld">Deadlift 1RM (${onb.units || 'lb'})<input id="m-dl" type="number" inputmode="numeric" value="${esc(onb.deadlift || '')}"></label>
      <label class="fld">Back Squat 1RM<input id="m-sq" type="number" inputmode="numeric" value="${esc(onb.back_squat || '')}"></label>
      <label class="fld">Overhead Press 1RM<input id="m-ohp" type="number" inputmode="numeric" value="${esc(onb.overhead_press || '')}"></label>
      <label class="fld">Max strict pull-ups<input id="m-pu" type="number" inputmode="numeric" value="${esc(onb.pull_up ?? '')}"></label>
      <label class="fld">Max push-ups<input id="m-push" type="number" inputmode="numeric" value="${esc(onb.push_up ?? '')}"></label>
      <label class="fld">1-mile time (mm:ss)<input id="m-mile" inputmode="numeric" placeholder="e.g. 9:30" value="${esc(onb.mileStr || '')}"></label>
    </div>` : `<p class="muted small">No problem — week 1 starts intentionally light and the first test week measures everything. The app gets smarter every session.</p>`}
    <div class="onb-nav"><button class="btn-ghost" data-act="onb-back">← Back</button><button class="btn-primary" data-act="onb-next">Next →</button></div>
  </div>`;
}
function stepReady() {
  return `<div class="onb-card">
    <h2>You're set. 🔨</h2>
    <p>Your plan: <strong>52 weeks</strong> across 7 blocks — Foundation → Hypertrophy → Aerobic Engine → Max Strength → Power & Engine → Qualifier Peak → Finals.</p>
    <ul class="ready-list">
      <li>4 core days a week, plus optional easy days the app offers (never nags).</li>
      <li>Every load is auto-set from your numbers and adjusts to your daily readiness.</li>
      <li>Open the app, hit <strong>Start</strong>, log a number, done.</li>
    </ul>
    <p class="muted small">Not medical advice. Train smart, respect pain, fuel and sleep well.</p>
    <button class="btn-primary big" data-act="onb-finish">Enter Forge →</button>
  </div>`;
}
function parseMile(str) {
  if (!str) return null;
  const m = String(str).match(/(\d+):(\d{1,2})/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = parseFloat(str); return isNaN(n) ? null : Math.round(n * 60);
}

// ============================ TODAY ============================
function renderToday() {
  const s = store.get();
  const ctx = program.planContext(s.program.absWeek);
  const sess = program.getSession(s.program.absWeek, s.program.sessionInWeek);
  const rd = store.todayReadiness();
  const rs = engine.combinedReadiness(s);
  const latestB = store.latestBody();
  const todayB = store.todayBody();
  const day = sess.day;
  const acwr = engine.computeACWR(s);
  const dateStr = fmtDate(program.dateForWeek(s.program.startDateISO, s.program.absWeek));

  const readinessCard = rd ? `
    <div class="card readiness-done" data-act="goto" data-href="#readiness">
      <div class="row between">
        <div><div class="lbl">Today's readiness</div><div class="big2" style="color:${rs.color}">${rs.band} · ${rs.score}</div></div>
        ${gauge(rs.score, { color: rs.color })}
      </div>
      <div class="muted small">${esc(rs.message)}</div>
      <button class="link-btn" data-act="open-readiness">Re-check</button>
    </div>` : `
    <div class="card readiness-prompt">
      <div class="lbl">Before you start — 10-second readiness check</div>
      ${readinessForm()}
    </div>`;

  return root.innerHTML = `
    <header class="topbar"><div class="brand-sm">⚒︎ FORGE</div><div class="muted small">Wk ${s.program.absWeek + 1}/52 · ${esc(dateStr)}</div></header>
    <main class="view">
      <div class="phase-strip"><span class="pill" style="background:${phaseColor(ctx.phaseIndex)}">${esc(ctx.phase.short)}</span>
        <span class="muted small">${esc(ctx.waveLabel)}${ctx.isDeload ? ' · DELOAD' : ''}${ctx.isTestWeek ? ' · TEST WEEK' : ''}</span>
        <span class="muted small right">Wk ${s.program.absWeek + 1} of 52</span></div>

      ${readinessCard}
      ${weekBoardHtml(s)}
      ${calendarHtml(s)}

      <div class="card acwr-mini">
        <div class="row between"><div class="lbl">Training load (7d vs 28d)</div><div class="badge" style="color:${acwr.color}">${acwr.ratio ? acwr.ratio.toFixed(2) : '—'}</div></div>
        <div class="muted small">${esc(acwr.advice)}</div>
      </div>

      ${bodyCardHtml(latestB, todayB)}
    </main>`;
}

// "This week" board — the 4 core sessions with status + a Start on the next one, plus optional days.
function weekBoardHtml(s) {
  const aw = s.program.absWeek, cur = s.program.sessionInWeek;
  const ctx = program.planContext(aw);
  let rows = '';
  for (let i = 0; i < 4; i++) {
    const sess = program.getSession(aw, i);
    const logged = (s.sessions || []).find((x) => x.absWeek === aw && x.sessionInWeek === i);
    const status = (logged || i < cur) ? 'done' : (i === cur ? 'next' : 'upcoming');
    const icon = status === 'done' ? '✓' : (status === 'next' ? '▶' : i + 1);
    const meta = logged ? `${fmtDate(logged.dateISO)} · RPE ${logged.sessionRPE || '—'}` : (status === 'next' ? 'up next' : 'queued');
    rows += `<div class="wk-row ${status}">
      <div class="wk-ic">${icon}</div>
      <div class="wk-info"><div class="wk-name">${esc(sess.day.name)}</div><div class="muted small">${esc(meta)}</div></div>
      ${status === 'next' ? `<button class="btn-primary wk-start" data-act="start" data-optional="">${s.active ? 'Resume' : 'Start'} →</button>` : ''}
    </div>`;
  }
  const opt = program.optionalDays().map((k) => {
    const d = program.COMMON_DAYS[k];
    return `<button class="opt-row" data-act="start" data-optional="${k}"><span>＋ ${esc(d.name)}</span><span class="muted small">${esc(optPreview(k))}</span></button>`;
  }).join('');
  return `<div class="card weekboard">
    <div class="row between"><div class="lbl">This week · ${esc(ctx.phase.short)}</div><div class="muted small">${cur}/4 done</div></div>
    ${rows}
    ${ctx.phase.layoutNote ? `<div class="hint">💡 ${esc(ctx.phase.layoutNote)}</div>` : ''}
    <div class="opt-head muted small">Optional — only if you've got the gas</div>
    ${opt}
  </div>`;
}

// Month activity calendar — marks days you logged a session; rings today.
function calendarHtml(s) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), todayD = now.getDate();
  const startDow = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const mm = String(m + 1).padStart(2, '0');
  const localDay = (isoStr) => { const d = new Date(isoStr); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const logged = new Set((s.sessions || []).map((x) => localDay(x.dateISO)));
  const monthCount = [...logged].filter((d) => d.startsWith(`${y}-${mm}`)).length;
  const monthName = new Date(y, m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const head = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="cal-dow">${d}</div>`).join('');
  let cells = '';
  for (let i = 0; i < startDow; i++) cells += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= days; d++) {
    const iso = `${y}-${mm}-${String(d).padStart(2, '0')}`;
    const trained = logged.has(iso);
    cells += `<div class="cal-cell ${d === todayD ? 'today' : ''} ${trained ? 'trained' : ''}">${d}${trained ? '<span class="cal-dot"></span>' : ''}</div>`;
  }
  return `<div class="card">
    <div class="row between"><div class="lbl">Activity — ${esc(monthName)}</div><div class="muted small">${monthCount} day${monthCount === 1 ? '' : 's'} this month</div></div>
    <div class="cal-grid head">${head}</div>
    <div class="cal-grid">${cells}</div>
  </div>`;
}
function readinessForm() {
  const metric = (f, label, lo, hi) => `<div class="rd-metric"><div class="rd-label">${label}<span class="muted small"> ${lo} → ${hi}</span></div>${chipsRd(f)}</div>`;
  return `<div class="rd-form">
    ${metric('sleep', 'Sleep', 'poor', 'great')}
    ${metric('energy', 'Energy', 'flat', 'fired up')}
    ${metric('soreness', 'Freshness', 'wrecked', 'fresh')}
    ${metric('stress', 'Calm', 'frazzled', 'calm')}
    ${metric('motivation', 'Drive', 'meh', 'attack')}
    <button class="btn-primary" data-act="save-readiness">Save & see today</button>
  </div>`;
}
function chipsRd(f) {
  let out = '<div class="chiprow">';
  for (let i = 1; i <= 5; i++) out += `<button class="chip rd ${onb['rd_' + f] === i ? 'sel' : ''}" data-act="rd-chip" data-field="${f}" data-val="${i}">${i}</button>`;
  return out + '</div>';
}

function bodyCardHtml(latest, today) {
  const u = U();
  const v = (x) => (x != null && x !== '' ? esc(x) : '—');
  const tv = (x) => (today && x != null ? x : '');
  const stats = latest
    ? `<div class="bodystats"><div><div class="big2">${v(latest.weight)}</div><div class="muted small">${u}</div></div><div><div class="big2">${v(latest.hrv)}</div><div class="muted small">HRV</div></div><div><div class="big2">${v(latest.restingHR)}</div><div class="muted small">RHR</div></div><div><div class="big2">${v(latest.sleepHrs)}</div><div class="muted small">sleep h</div></div></div>`
    : `<div class="muted small">Log weight, HRV, resting HR & sleep — or auto-import from Hume / Apple Health (Settings → Health data).</div>`;
  return `<div class="card body-card">
    <div class="row between"><div class="lbl">Body & recovery</div>${latest ? `<div class="muted small">${fmtDate(latest.date || latest.dateISO)}</div>` : ''}</div>
    ${stats}
    <details class="bodyform">
      <summary>Log today</summary>
      <div class="grid2">
        <label class="fld">Weight (${u})<input id="b-w" type="number" inputmode="decimal" value="${tv(today && today.weight)}"></label>
        <label class="fld">Body fat %<input id="b-bf" type="number" inputmode="decimal" value="${tv(today && today.bodyfat)}"></label>
        <label class="fld">Resting HR<input id="b-rhr" type="number" inputmode="numeric" value="${tv(today && today.restingHR)}"></label>
        <label class="fld">HRV (ms)<input id="b-hrv" type="number" inputmode="numeric" value="${tv(today && today.hrv)}"></label>
        <label class="fld">Sleep (h)<input id="b-sleep" type="number" inputmode="decimal" value="${tv(today && today.sleepHrs)}"></label>
      </div>
      <button class="btn-primary" data-act="save-body">Save</button>
      <div class="paste-line"><input id="b-paste" placeholder="or paste: weight:198,hrv:70,sleep:7.2"><button class="btn-ghost" data-act="paste-health">Add</button></div>
      <div class="muted small">Android tip: screenshot your Hume app, send it to Claude, and paste back the line it gives you.</div>
    </details>
  </div>`;
}

function sessionPreview(sess, s) {
  const names = (sess.day.slots || []).map((sl) => getExercise(sl.ex).name);
  return names.slice(0, 5).join(' · ') + (names.length > 5 ? ' …' : '');
}
function optPreview(k) {
  const d = program.COMMON_DAYS[k];
  return (d.slots || []).map((sl) => getExercise(sl.ex).name).join(' · ');
}

// ============================ WORKOUT ============================
function buildActive(s, optionalDayKey) {
  const rd = store.todayReadiness();
  const res = engine.resolveSessionAt(s, s.program.absWeek, s.program.sessionInWeek, { readiness: rd, optionalDayKey: optionalDayKey || null });
  const entries = res.blocks.map((b) => ({
    exerciseId: b.exerciseId, name: b.name, kind: b.kind, type: b.type, prescription: b.prescription,
    cues: b.cues, note: b.note, demo: b.demo, rest: b.rest, paceHint: b.paceHint, detail: b.detail,
    mode: b.mode, minutes: b.minutes, perMinute: b.perMinute, rounds: b.rounds, items: b.items, timeCap: b.timeCap,
    loadType: b.loadType, isTest: b.isTest, targetRir: b.targetRir,
    sets: (b.sets || []).map((st) => ({ ...st, done: false, rpe: null, rir: null })),
    resultSeconds: null, resultRounds: null, topWeight: null, result: '',
  }));
  return {
    startedAt: new Date().toISOString(), dateISO: new Date().toISOString(),
    absWeek: res.absWeek, sessionInWeek: res.sessionInWeek, dayKey: res.dayKey, dayName: res.dayName,
    dayTag: res.dayTag, isTest: res.isTest, optional: !!optionalDayKey, optionalDayKey: optionalDayKey || null,
    readinessBand: res.readiness.band, cursor: 0, entries,
  };
}

function renderWorkout() {
  const a = store.get().active;
  if (!a) { location.hash = '#/today'; return; }
  if (a.finishing) { root.innerHTML = finishPanel(a); return; }
  const total = a.entries.length;
  const i = Math.max(0, Math.min(a.cursor, total - 1));
  const b = a.entries[i];
  const dots = a.entries.map((e, idx) => `<span class="dot ${idx === i ? 'cur' : ''} ${allDone(e) ? 'done' : ''}"></span>`).join('');

  root.innerHTML = `
    <header class="wk-top">
      <button class="icon-btn" data-act="pause">‹</button>
      <div class="wk-title">${esc(a.dayName)}${a.optional ? ' · bonus' : ''}</div>
      <button class="icon-btn" data-act="finish-confirm">✓</button>
    </header>
    <div class="wk-dots">${dots}</div>
    <main class="wk-main">
      ${renderBlock(b, i)}
    </main>
    <div id="rest-bar" class="rest-bar ${rest.endAt ? 'show' : ''}">${renderRest()}</div>
    <footer class="wk-foot">
      <button class="btn-ghost" data-act="prev" ${i === 0 ? 'disabled' : ''}>← Prev</button>
      ${i < total - 1 ? `<button class="btn-primary" data-act="next">Next →</button>` : `<button class="btn-primary" data-act="finish-confirm">Finish ✓</button>`}
    </footer>`;
}
function allDone(e) { return (e.sets || []).length > 0 && e.sets.every((s) => s.done); }

function renderBlock(b, bi) {
  const cues = (b.cues || []).map((c) => `<li>${esc(c)}</li>`).join('');
  let body = '';
  if (b.kind === 'sets') body = setsBody(b, bi);
  else if (b.kind === 'reps') body = repsBody(b, bi);
  else if (b.kind === 'hold') body = holdBody(b, bi);
  else if (b.kind === 'carry') body = carryBody(b, bi);
  else if (b.kind === 'emom') body = simpleBody(b, bi, 'Done');
  else if (b.kind === 'mobility') body = simpleBody(b, bi, 'Done');
  else if (b.kind === 'run') body = runBody(b, bi);
  else if (b.kind === 'metcon') body = metconBody(b, bi);
  else body = simpleBody(b, bi, 'Done');

  return `<div class="block">
    <div class="block-head">
      <div class="ex-name">${esc(b.name)} ${b.demo ? `<a class="how" href="${demoURL(b.demo)}" target="_blank" rel="noopener">how?</a>` : ''}</div>
      <div class="presc">${esc(b.prescription)}</div>
    </div>
    ${b.note ? `<div class="note-callout">${esc(b.note)}</div>` : ''}
    ${b.detail ? `<div class="muted small">${esc(b.detail)}</div>` : ''}
    ${b.paceHint ? `<div class="hint">🏃 ${esc(b.paceHint)}</div>` : ''}
    ${body}
    ${cues ? `<details class="cues"><summary>Form cues</summary><ul>${cues}</ul></details>` : ''}
  </div>`;
}

function stepFor(loadType, field) {
  const kg = U() === 'kg';
  if (field === 'reps') return 1;
  if (field === 'seconds') return 5;
  if (field === 'dist') return 5;
  if (loadType === 'sandbag') return kg ? 5 : 10;
  return kg ? 2.5 : 5;
}
function setRowControls(b, bi, si, st) {
  const u = U();
  const weightCtl = (st.weight != null && b.loadType !== 'bodyweight') ? `
    <div class="stepper" data-field="weight">
      <button class="st-btn" data-act="dec" data-bi="${bi}" data-si="${si}" data-field="weight">−</button>
      <span class="st-val">${st.weight}<small>${u}</small></span>
      <button class="st-btn" data-act="inc" data-bi="${bi}" data-si="${si}" data-field="weight">+</button>
    </div>` : (b.loadType === 'bodyweight' ? `<div class="bw-tag">body${st.weight ? ` +${st.weight}${u}` : ''}</div>` : '');
  const repsCtl = `
    <div class="stepper" data-field="reps">
      <button class="st-btn" data-act="dec" data-bi="${bi}" data-si="${si}" data-field="reps">−</button>
      <span class="st-val">${st.reps == null ? 'MAX' : st.reps}</span>
      <button class="st-btn" data-act="inc" data-bi="${bi}" data-si="${si}" data-field="reps">+</button>
    </div>`;
  return weightCtl + `<span class="x">×</span>` + repsCtl;
}
function rirRow(bi, si, st) {
  const opts = [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5+']];
  let chips = '';
  opts.forEach(([v, lbl]) => { chips += `<button class="rpe-chip ${st.rir === v ? 'sel' : ''}" data-act="setrir" data-bi="${bi}" data-si="${si}" data-val="${v}">${lbl}</button>`; });
  return `<div class="rpe-row"><span class="muted small">reps left?</span>${chips}</div>`;
}
function setsBody(b, bi) {
  return `<div class="sets">${b.sets.map((st, si) => `
    <div class="setrow ${st.done ? 'done' : ''}">
      <div class="set-tag">${st.kind === 'top' ? 'TOP' : st.kind === 'backoff' ? 'B' + si : (b.sets.length > 1 ? si + 1 : '•')}</div>
      <div class="set-ctls">${setRowControls(b, bi, si, st)}</div>
      <button class="done-btn ${st.done ? 'on' : ''}" data-act="logset" data-bi="${bi}" data-si="${si}">${st.done ? '✓' : 'Log'}</button>
    </div>
    ${st.done ? rirRow(bi, si, st) : ''}
  `).join('')}</div>`;
}
function repsBody(b, bi) {
  return `<div class="sets">${b.sets.map((st, si) => `
    <div class="setrow ${st.done ? 'done' : ''}">
      <div class="set-tag">${b.sets.length > 1 ? si + 1 : '•'}</div>
      <div class="set-ctls">${setRowControls(b, bi, si, st)}</div>
      <button class="done-btn ${st.done ? 'on' : ''}" data-act="logset" data-bi="${bi}" data-si="${si}">${st.done ? '✓' : 'Log'}</button>
    </div>
    ${st.done && st.kind !== 'amrap' ? rirRow(bi, si, st) : ''}
  `).join('')}</div>`;
}
function holdBody(b, bi) {
  return `<div class="sets">${b.sets.map((st, si) => `
    <div class="setrow ${st.done ? 'done' : ''}">
      <div class="set-tag">${b.sets.length > 1 ? si + 1 : '•'}</div>
      <div class="set-ctls"><div class="stepper"><button class="st-btn" data-act="dec" data-bi="${bi}" data-si="${si}" data-field="seconds">−</button><span class="st-val">${st.seconds}<small>s</small></span><button class="st-btn" data-act="inc" data-bi="${bi}" data-si="${si}" data-field="seconds">+</button></div></div>
      <button class="done-btn ${st.done ? 'on' : ''}" data-act="logset" data-bi="${bi}" data-si="${si}">${st.done ? '✓' : 'Log'}</button>
    </div>`).join('')}</div>`;
}
function carryBody(b, bi) {
  const u = U();
  return `<div class="sets">${b.sets.map((st, si) => `
    <div class="setrow ${st.done ? 'done' : ''}">
      <div class="set-tag">${si + 1}</div>
      <div class="set-ctls"><span class="bw-tag">${st.dist}yd</span><span class="x">@</span>
        <div class="stepper"><button class="st-btn" data-act="dec" data-bi="${bi}" data-si="${si}" data-field="weight">−</button><span class="st-val">${st.weight}<small>${u}</small></span><button class="st-btn" data-act="inc" data-bi="${bi}" data-si="${si}" data-field="weight">+</button></div></div>
      <button class="done-btn ${st.done ? 'on' : ''}" data-act="logset" data-bi="${bi}" data-si="${si}">${st.done ? '✓' : 'Log'}</button>
    </div>`).join('')}</div>`;
}
function simpleBody(b, bi, label) {
  const st = b.sets[0] || { done: false };
  return `<div class="single-do"><button class="done-btn wide ${st.done ? 'on' : ''}" data-act="logset" data-bi="${bi}" data-si="0">${st.done ? '✓ Done' : label}</button></div>`;
}
function runBody(b, bi) {
  const st = b.sets[0] || { done: false };
  const isTT = b.exerciseId === 'mile_time_trial';
  return `<div class="single-do">
    ${isTT ? `<label class="fld inline">Your mile time<input class="result-in" data-bi="${bi}" data-field="resultSeconds" inputmode="numeric" placeholder="mm:ss" value="${esc(secToStr(b.resultSeconds))}"></label>` : ''}
    <button class="done-btn wide ${st.done ? 'on' : ''}" data-act="logset" data-bi="${bi}" data-si="0">${st.done ? '✓ Logged' : 'Mark complete'}</button>
  </div>`;
}
function metconBody(b, bi) {
  const st = b.sets[0] || { done: false };
  const isCindy = b.exerciseId === 'cindy';
  const isSandbag = b.exerciseId === 'sandbag_shoulder';
  return `<div class="single-do">
    <div class="metcon-list">${(b.items || []).map((it) => `<div class="mc-item"><b>${it.reps}</b> ${esc(it.name)}</div>`).join('')}</div>
    ${isCindy ? `<label class="fld inline">Rounds completed<input class="result-in" data-bi="${bi}" data-field="resultRounds" type="number" inputmode="numeric" value="${esc(b.resultRounds ?? '')}"></label>` : ''}
    ${isSandbag ? `<label class="fld inline">Heaviest shouldered (${U()})<input class="result-in" data-bi="${bi}" data-field="topWeight" type="number" inputmode="numeric" value="${esc(b.topWeight ?? '')}"></label>` : ''}
    ${!isCindy && !isSandbag ? `<label class="fld inline">Result (time / notes)<input class="result-in" data-bi="${bi}" data-field="result" value="${esc(b.result || '')}"></label>` : ''}
    <button class="done-btn wide ${st.done ? 'on' : ''}" data-act="logset" data-bi="${bi}" data-si="0">${st.done ? '✓ Logged' : 'Mark complete'}</button>
  </div>`;
}
function secToStr(sec) { if (!sec) return ''; const m = Math.floor(sec / 60), s = sec % 60; return m + ':' + String(s).padStart(2, '0'); }

// ---- rest timer ----
function renderRest() {
  if (!rest.endAt) return '';
  const left = Math.max(0, Math.round((rest.endAt - Date.now()) / 1000));
  return `<button class="rest-btn" data-act="rest-skip">skip</button>
    <span class="rest-clock" id="rest-clock">${secToStr(left)}</span>
    <button class="rest-btn" data-act="rest-add">+15s</button>`;
}
function tickRest() {
  if (!rest.endAt) return;
  const left = Math.max(0, Math.round((rest.endAt - Date.now()) / 1000));
  const el = document.getElementById('rest-clock');
  if (el) el.textContent = secToStr(left);
  if (left <= 0) { rest.endAt = 0; const bar = document.getElementById('rest-bar'); if (bar) { bar.classList.remove('show'); bar.innerHTML = ''; } beep(); }
}
function startRest(sec) { rest.endAt = Date.now() + sec * 1000; rest.dur = sec; const bar = document.getElementById('rest-bar'); if (bar) { bar.classList.add('show'); bar.innerHTML = renderRest(); } }
function beep() {
  try { if (!store.get().settings.sound) return; const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(); const g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value = 660; g.gain.value = 0.05; o.start(); setTimeout(() => { o.stop(); ac.close(); }, 180); } catch (e) {}
}

// ============================ PROGRESS ============================
function renderProgress() {
  const s = store.get();
  const ps = engine.progressSeries(s);
  const scard = engine.eventReadiness(s);
  const acwr = engine.computeACWR(s);
  const u = U();
  const card = (title, svg, sub) => `<div class="card"><div class="lbl">${title}</div>${svg}${sub ? `<div class="muted small">${sub}</div>` : ''}</div>`;
  return root.innerHTML = `
    <header class="topbar"><div class="brand-sm">Progress</div></header>
    <main class="view">
      <div class="card">
        <div class="lbl">Event readiness — road to the podium</div>
        ${scard.map((e) => `<div class="score-row"><div class="row between"><span>${esc(e.label)}</span><span class="muted small">${esc(e.current)} / ${esc(e.target)}</span></div>${progressBar(e.pct)}</div>`).join('')}
      </div>
      ${card('Deadlift — est. 1RM (' + u + ')', lineChart(ps.deadlift, { color: '#f87171', unit: u }))}
      ${card('Back Squat — est. 1RM (' + u + ')', lineChart(ps.back_squat, { color: '#fbbf24', unit: u }))}
      ${card('Overhead Press — est. 1RM (' + u + ')', lineChart(ps.overhead_press, { color: '#a78bfa', unit: u }))}
      ${card('Pull-ups — max reps', lineChart(ps.pull_up, { color: '#36d399' }))}
      ${card('Push-ups — max reps', lineChart(ps.push_up, { color: '#60a5fa' }))}
      ${card('Bodyweight (' + u + ')', lineChart(ps.bodyweight, { color: '#34d399', unit: u }))}
      ${ps.recovery ? `<div class="card"><div class="lbl">Latest recovery (Hume / Apple Health)</div><div class="bodystats"><div><div class="big2">${ps.recovery.hrv || '—'}</div><div class="muted small">HRV ms</div></div><div><div class="big2">${ps.recovery.restingHR || '—'}</div><div class="muted small">resting HR</div></div><div><div class="big2">${ps.recovery.sleepHrs || '—'}</div><div class="muted small">sleep h</div></div><div><div class="big2">${ps.recovery.bodyfat || '—'}</div><div class="muted small">body fat %</div></div></div></div>` : ''}
      ${card('Weekly training load', barChart(ps.loadHistory, { color: '#60a5fa' }), acwr.ratio ? `ACWR ${acwr.ratio.toFixed(2)} — ${esc(acwr.status)}` : 'Building baseline')}
    </main>`;
}

// ============================ PLAN ============================
function renderPlan() {
  const s = store.get();
  const tl = program.phaseTimeline();
  const weeks = engine.weekList(s);
  const cur = s.program.absWeek;
  return root.innerHTML = `
    <header class="topbar"><div class="brand-sm">The Plan</div><div class="muted small">52 weeks → Games</div></header>
    <main class="view">
      <div class="card intro-card">
        <div class="muted small">You are here</div>
        <div class="big2">Week ${cur + 1} · ${esc(program.planContext(cur).phase.name)}</div>
        <div class="muted small">Qualifier ~Wk ${program.MACRO.qualifierWeek + 1} · Finals ~Wk ${program.MACRO.finalsWeek + 1}</div>
      </div>
      ${tl.map((p, i) => `
        <div class="phase-card ${cur >= p.start && cur <= p.end ? 'cur' : ''}">
          <div class="row between"><div class="phase-name"><span class="dotc" style="background:${phaseColor(i)}"></span>${esc(p.name)}</div><div class="muted small">Wk ${p.start + 1}–${p.end + 1}</div></div>
          <div class="muted small">${esc(p.focus)}</div>
          <div class="emph">${emphBars(p.emphasis)}</div>
        </div>`).join('')}
      <div class="card">
        <details><summary>Week-by-week</summary>
          <div class="weekgrid">${weeks.map((w) => `<div class="wkcell ${w.current ? 'cur' : ''} ${w.isDeload ? 'dl' : ''} ${w.isTest ? 'ts' : ''} ${w.isQualifier ? 'ql' : ''} ${w.isFinals ? 'fn' : ''}" title="${esc(w.phaseName + ' · ' + w.label)}">${w.week + 1}</div>`).join('')}</div>
          <div class="legend"><span class="lg dl">deload</span><span class="lg ts">test</span><span class="lg ql">qualifier</span><span class="lg fn">finals</span></div>
        </details>
      </div>
    </main>`;
}
function emphBars(e) {
  const items = [['Strength', e.strength], ['Power', e.power], ['Muscle', e.muscle], ['Aerobic', e.aerobic], ['Anaerobic', e.anaerobic]];
  return items.map(([k, v]) => `<div class="emph-row"><span class="emph-k">${k}</span><div class="emph-bar">${[1, 2, 3].map((n) => `<span class="eb ${v >= n ? 'on' : ''}"></span>`).join('')}</div></div>`).join('');
}

// ============================ SETTINGS ============================
function renderSettings() {
  const s = store.get();
  const p = s.profile;
  const u = U();
  return root.innerHTML = `
    <header class="topbar"><div class="brand-sm">Settings</div></header>
    <main class="view">
      <div class="card">
        <div class="lbl">Profile</div>
        <div class="kv"><span>Name</span><b>${esc(p.name || '—')}</b></div>
        <div class="kv"><span>Bodyweight</span><b>${esc(p.bodyweight)} ${u}</b></div>
        <div class="kv"><span>Units</span>
          <div class="seg sm"><button class="seg-btn ${u === 'lb' ? 'sel' : ''}" data-act="set-units" data-val="lb">lb</button><button class="seg-btn ${u === 'kg' ? 'sel' : ''}" data-act="set-units" data-val="kg">kg</button></div>
        </div>
        <label class="kv"><span>Default rest (s)</span><input class="mini-in" data-act="set-rest" type="number" inputmode="numeric" value="${esc(s.settings.restDefault)}"></label>
        <label class="kv"><span>Rest beep</span><input type="checkbox" data-act="set-sound" ${s.settings.sound ? 'checked' : ''}></label>
      </div>
      <div class="card">
        <div class="lbl">Working maxes (the engine's model)</div>
        ${maxRow('Deadlift e1RM', 'deadlift', s.maxes.deadlift && s.maxes.deadlift.e1rm, u)}
        ${maxRow('Back Squat e1RM', 'back_squat', s.maxes.back_squat && s.maxes.back_squat.e1rm, u)}
        ${maxRow('OHP e1RM', 'overhead_press', s.maxes.overhead_press && s.maxes.overhead_press.e1rm, u)}
        ${maxRow('Max pull-ups', 'pull_up', s.maxes.pull_up && s.maxes.pull_up.maxReps, '')}
        ${maxRow('Max push-ups', 'push_up', s.maxes.push_up && s.maxes.push_up.maxReps, '')}
        <div class="muted small">These auto-update from your logs. Edit only if something looks off.</div>
      </div>
      <div class="card">
        <div class="lbl">Position in plan</div>
        <label class="kv"><span>Current week (1–52)</span><input class="mini-in" data-act="set-week" type="number" inputmode="numeric" value="${s.program.absWeek + 1}"></label>
        <label class="kv"><span>Session in week (1–4)</span><input class="mini-in" data-act="set-sess" type="number" inputmode="numeric" value="${s.program.sessionInWeek + 1}"></label>
      </div>
      <div class="card">
        <div class="lbl">Health data (Hume / Apple Health)</div>
        <button class="btn-ghost wide" data-act="import-health">⬆ Import weight / HRV / sleep (CSV)</button>
        <input type="file" id="health-file" accept=".csv,text/csv" hidden>
        <details><summary>How to connect Hume Health</summary>
          <div class="muted small help-steps">
            Hume has no direct API, but it syncs to Apple Health. Three ways to get your data in:<br><br>
            <b>1 · Manual</b> — tap "Log today" under Body &amp; recovery on the Today screen (10 sec).<br>
            <b>2 · CSV</b> — export from Hume / Apple Health (e.g. the "Health Auto Export" app) and import above. Matched columns: date, weight, HRV, resting HR, sleep, body fat.<br>
            <b>3 · Auto (iPhone Shortcut)</b> — build a Shortcut that reads today's Weight / HRV / Sleep from Health and opens:<br>
            <code class="ingest-url">${esc(liveBase())}?ingest=weight:200,hrv:65,rhr:52,sleep:7.4</code><br>
            Run it each morning and Forge fills itself in. Full guide: docs/CONNECT-HUME.md.
          </div>
        </details>
      </div>
      <div class="card">
        <div class="lbl">Data</div>
        <button class="btn-ghost wide" data-act="export">⬇ Export backup (.json)</button>
        <button class="btn-ghost wide" data-act="import">⬆ Import backup</button>
        <input type="file" id="import-file" accept="application/json" hidden>
        <button class="btn-danger wide" data-act="reset">Reset everything</button>
        ${s.meta.lastBackupISO ? `<div class="muted small">Last backup ${fmtDate(s.meta.lastBackupISO)}</div>` : ''}
      </div>
      <div class="card muted small">Forge · local-first PWA · not medical advice. Built for the New Christendom Press Games.</div>
    </main>`;
}
function maxRow(label, id, val, u) {
  return `<label class="kv"><span>${label}</span><span class="row"><input class="mini-in" data-act="set-max" data-id="${id}" type="number" inputmode="numeric" value="${esc(val || '')}"><small class="muted">${u}</small></span></label>`;
}

// ============================ helpers ============================
const PHASE_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#f87171', '#fb923c', '#fbbf24', '#f472b6'];
function phaseColor(i) { return PHASE_COLORS[i % PHASE_COLORS.length]; }

// ============================ event handling ============================
function onClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const s = store.get();
  switch (act) {
    // onboarding
    case 'onb-units': onb.units = t.dataset.val; renderOnboarding(); break;
    case 'onb-sex': onb.sex = t.dataset.val; renderOnboarding(); break;
    case 'onb-bar': onb.hasPullupBar = t.dataset.val === '1'; renderOnboarding(); break;
    case 'onb-know': onb.knowMaxes = t.dataset.val === '1'; renderOnboarding(); break;
    case 'onb-chip': onb[t.dataset.field] = +t.dataset.val; renderOnboarding(); break;
    case 'onb-inj': toggleInj(t.dataset.val); renderOnboarding(); break;
    case 'onb-next': captureOnb(); onbStep++; renderOnboarding(); break;
    case 'onb-back': captureOnb(); onbStep = Math.max(0, onbStep - 1); renderOnboarding(); break;
    case 'onb-finish': captureOnb(); finishOnboarding(); break;
    // readiness
    case 'rd-chip': onb['rd_' + t.dataset.field] = +t.dataset.val; document.querySelectorAll(`[data-act="rd-chip"][data-field="${t.dataset.field}"]`).forEach((c) => c.classList.toggle('sel', +c.dataset.val === +t.dataset.val)); break;
    case 'save-readiness': saveReadiness(); break;
    case 'open-readiness': openReadiness(); break;
    // navigation / start
    case 'start': startWorkout(t.dataset.optional || null); break;
    case 'goto': location.hash = t.dataset.href; break;
    // workout
    case 'inc': stepSet(t, +1); break;
    case 'dec': stepSet(t, -1); break;
    case 'logset': logSet(+t.dataset.bi, +t.dataset.si); break;
    case 'setrir': setRir(+t.dataset.bi, +t.dataset.si, +t.dataset.val); break;
    case 'next': moveCursor(+1); break;
    case 'prev': moveCursor(-1); break;
    case 'pause': location.hash = '#/today'; render(); break;
    case 'finish-confirm': enterFinish(); break;
    case 'finish-cancel': store.patchActive((x) => { x.finishing = false; }); renderWorkout(); break;
    case 'finish-rpe': setFinishRpe(+t.dataset.val); break;
    case 'finish-save': finishSave(); break;
    case 'rest-skip': rest.endAt = 0; { const bar = document.getElementById('rest-bar'); if (bar) { bar.classList.remove('show'); bar.innerHTML = ''; } } break;
    case 'rest-add': rest.endAt += 15000; tickRest(); break;
    // settings
    case 'set-units': store.setSettings({ units: t.dataset.val }); render(); break;
    case 'export': doExport(); break;
    case 'import': document.getElementById('import-file').click(); break;
    case 'import-health': document.getElementById('health-file').click(); break;
    case 'save-body': saveBody(); break;
    case 'paste-health': pasteHealth(); break;
    case 'reset': doReset(); break;
  }
}
function onInput(e) {
  const t = e.target;
  if (t.classList.contains('result-in')) {
    const bi = +t.dataset.bi, f = t.dataset.field, a = store.get().active; if (!a) return;
    if (f === 'resultSeconds') a.entries[bi].resultSeconds = parseMile(t.value);
    else a.entries[bi][f] = f === 'result' ? t.value : (+t.value || null);
    store.patchActive(() => {}); // persist without re-render
  }
}
function onChange(e) {
  const t = e.target;
  if (t.id === 'import-file' && t.files && t.files[0]) importFile(t.files[0]);
  if (t.id === 'health-file' && t.files && t.files[0]) importHealthFile(t.files[0]);
  if (t.dataset.act === 'set-sound') store.setSettings({ sound: t.checked });
  if (t.dataset.act === 'set-rest') store.setSettings({ restDefault: +t.value || 120 });
  if (t.dataset.act === 'set-max') setMaxEdit(t.dataset.id, +t.value);
  if (t.dataset.act === 'set-week') { store.setPointer({ absWeek: (+t.value || 1) - 1 }); }
  if (t.dataset.act === 'set-sess') { store.setPointer({ sessionInWeek: (+t.value || 1) - 1 }); }
}

function toggleInj(id) {
  onb.injuries = onb.injuries || [];
  if (id === 'none') { onb.injuries = ['none']; return; }
  onb.injuries = onb.injuries.filter((x) => x !== 'none');
  if (onb.injuries.includes(id)) onb.injuries = onb.injuries.filter((x) => x !== id);
  else onb.injuries.push(id);
}
function captureOnb() {
  const g = (id) => { const el = document.getElementById(id); return el ? el.value : undefined; };
  if (g('f-name') !== undefined) onb.name = g('f-name');
  if (g('f-age') !== undefined) onb.age = +g('f-age') || onb.age;
  if (g('f-bw') !== undefined) onb.bodyweight = +g('f-bw') || onb.bodyweight;
  if (g('f-ht') !== undefined) onb.heightIn = +g('f-ht') || onb.heightIn;
  if (g('f-sb') !== undefined) onb.sandbagMax = +g('f-sb') || onb.sandbagMax;
  ['m-dl:deadlift', 'm-sq:back_squat', 'm-ohp:overhead_press', 'm-pu:pull_up', 'm-push:push_up'].forEach((pair) => {
    const [id, key] = pair.split(':'); const v = g(id); if (v !== undefined && v !== '') onb[key] = +v;
  });
  const mile = g('m-mile'); if (mile !== undefined && mile !== '') { onb.mileStr = mile; onb.mile_seconds = parseMile(mile); }
}
function finishOnboarding() {
  const profile = {
    name: onb.name || 'Athlete', units: onb.units || 'lb', age: onb.age || null, sex: onb.sex || 'm',
    bodyweight: onb.bodyweight || (onb.units === 'kg' ? 80 : 175), heightIn: onb.heightIn || null,
    injuries: onb.injuries || [], experience: onb.experience || 1, hasPullupBar: onb.hasPullupBar !== false,
    sandbagMax: onb.sandbagMax || null,
  };
  store.setProfile(profile);
  const maxes = engine.seedFromOnboarding(profile, onb.knowMaxes === false ? {} : {
    deadlift: onb.deadlift, back_squat: onb.back_squat, overhead_press: onb.overhead_press,
    pull_up: onb.pull_up, push_up: onb.push_up, mile_seconds: onb.mile_seconds, sandbag: onb.sandbagMax,
  });
  store.seedMaxes(maxes);
  onbStep = 0;
  location.hash = '#/today';
  render();
}

function saveReadiness() {
  const f = ['sleep', 'soreness', 'energy', 'stress', 'motivation'];
  const entry = { dateISO: new Date().toISOString() };
  f.forEach((k) => { entry[k] = onb['rd_' + k] || 3; });
  entry.score = engine.readinessScore(entry);
  store.logReadiness(entry);
  render();
}
function openReadiness() { f4(); render(); }
function f4() { ['sleep', 'soreness', 'energy', 'stress', 'motivation'].forEach((k) => delete onb['rd_' + k]); store.update((s) => { const day = new Date().toISOString().slice(0, 10); s.readiness = s.readiness.filter((r) => r.dateISO.slice(0, 10) !== day); }); }

function startWorkout(optionalDayKey) {
  const s = store.get();
  if (s.active && !optionalDayKey) { location.hash = '#/workout'; render(); return; }
  const active = buildActive(s, optionalDayKey);
  store.startSession(active);
  location.hash = '#/workout';
  render();
}
function stepSet(t, dir) {
  const bi = +t.dataset.bi, si = +t.dataset.si, field = t.dataset.field;
  const a = store.get().active; if (!a) return;
  const st = a.entries[bi].sets[si];
  const step = stepFor(a.entries[bi].loadType, field);
  if (field === 'reps') { if (st.reps == null) st.reps = 1; st.reps = Math.max(0, st.reps + dir); }
  else st[field] = Math.max(0, (st[field] || 0) + dir * step);
  store.patchActive(() => {});
  renderWorkout();
}
function logSet(bi, si) {
  const a = store.get().active; if (!a) return;
  const blk = a.entries[bi]; const st = blk.sets[si];
  st.done = !st.done;
  // capture special results on completion
  if (st.done && blk.kind === 'metcon' && blk.exerciseId === 'cindy' && blk.resultRounds == null) {/* user can fill */}
  store.patchActive(() => {});
  if (st.done) {
    const sec = blk.rest || store.get().settings.restDefault || 120;
    if (store.get().settings.autoRest !== false && ['sets', 'reps', 'hold', 'carry'].includes(blk.kind)) startRest(sec);
    // set-to-set nudge
    const adj = engine.adjustAfterSet(st, { reps: st.reps, rir: st.rir }, U(), blk.loadType);
    if (adj && adj.nextWeight && blk.sets[si + 1] && blk.sets[si + 1].weight != null) blk.sets[si + 1].weight = adj.nextWeight;
  }
  renderWorkout();
}
function setRir(bi, si, val) {
  const a = store.get().active; if (!a) return;
  const blk = a.entries[bi]; const st = blk.sets[si];
  st.rir = st.rir === val ? null : val;
  // re-run set-to-set nudge now that actual reps-in-reserve is known
  if (st.rir != null) { const adj = engine.adjustAfterSet(st, { reps: st.reps, rir: st.rir }, U(), blk.loadType); if (adj && adj.nextWeight && blk.sets[si + 1] && blk.sets[si + 1].weight != null) blk.sets[si + 1].weight = adj.nextWeight; }
  store.patchActive(() => {});
  renderWorkout();
}
function moveCursor(dir) {
  const a = store.get().active; if (!a) return;
  a.cursor = Math.max(0, Math.min(a.entries.length - 1, a.cursor + dir));
  rest.endAt = 0;
  store.patchActive(() => {});
  renderWorkout();
}
function enterFinish() { store.patchActive((x) => { x.finishing = true; }); renderWorkout(); }
function setFinishRpe(v) { store.patchActive((x) => { x.sessionRPE = x.sessionRPE === v ? null : v; }); renderWorkout(); }
function finishPanel(a) {
  const logged = a.entries.reduce((n, e) => n + (e.sets || []).filter((s) => s.done).length, 0);
  const dur = Math.max(1, Math.round((Date.now() - new Date(a.startedAt).getTime()) / 60000));
  const rpe = a.sessionRPE || null;
  let chips = '';
  for (let v = 1; v <= 10; v++) chips += `<button class="rpe-chip big ${rpe === v ? 'sel' : ''}" data-act="finish-rpe" data-val="${v}">${v}</button>`;
  return `<header class="wk-top"><button class="icon-btn" data-act="finish-cancel">‹</button><div class="wk-title">Finish session</div><span style="width:44px"></span></header>
    <main class="wk-main finish-main">
      <div class="finish-stat"><div><div class="big2">${logged}</div><div class="muted small">sets logged</div></div><div><div class="big2">${dur}m</div><div class="muted small">minutes</div></div><div><div class="big2">${esc(a.optional ? '＋' : (a.sessionInWeek + 1) + '/4')}</div><div class="muted small">${a.optional ? 'bonus' : 'session'}</div></div></div>
      <div class="lbl" style="margin-top:20px">How hard was that overall?</div>
      <div class="rpe-grid">${chips}</div>
      <div class="muted small">1 = easy · 7 = hard but solid · 10 = everything you had</div>
      <button class="btn-primary big" data-act="finish-save">Save session ✓</button>
    </main>`;
}
function finishSave() {
  const a = store.get().active; if (!a) return;
  const srpe = a.sessionRPE || 7;
  const durationMin = Math.max(1, Math.round((Date.now() - new Date(a.startedAt).getTime()) / 60000));
  const session = {
    id: a.startedAt, dateISO: new Date().toISOString(), startedAt: a.startedAt,
    absWeek: a.absWeek, sessionInWeek: a.sessionInWeek, dayKey: a.dayKey, dayName: a.dayName,
    optional: a.optional, sessionRPE: srpe, durationMin,
    entries: a.entries.map((e) => ({
      exerciseId: e.exerciseId, name: e.name,
      sets: e.sets.map((s) => ({ weight: s.weight ?? null, reps: s.reps ?? null, seconds: s.seconds ?? null, rir: s.rir ?? null, rpe: s.rpe ?? null, targetRir: s.targetRir ?? null, kind: s.kind, done: s.done })),
      resultSeconds: e.resultSeconds || null, resultRounds: e.resultRounds || null, topWeight: e.topWeight || null,
    })),
  };
  // update model BEFORE commit advances the pointer
  const patch = engine.ingestModel(store.get(), session);
  if (a.optional) {
    // optional sessions log + update model, but don't advance the core pointer
    store.update((st) => { st.sessions.push(session); st.active = null; Object.assign(st.maxes, patch);
      for (const en of session.entries) { const arr = (st.history[en.exerciseId] = st.history[en.exerciseId] || []); for (const set of en.sets) if (set.done) arr.push({ dateISO: session.dateISO, weight: set.weight, reps: set.reps, rpe: set.rpe }); } });
  } else {
    store.seedMaxes(patch);
    store.commitSession(session);
  }
  rest.endAt = 0;
  location.hash = '#/today';
  render();
  toast(a.isTest ? 'Test logged — maxes updated. 💪' : 'Session done. The plan just got smarter.');
}

function setMaxEdit(id, val) {
  if (!val) return;
  store.update((s) => {
    s.maxes[id] = s.maxes[id] || {};
    if (id === 'pull_up' || id === 'push_up') s.maxes[id].maxReps = val; else s.maxes[id].e1rm = val;
    s.maxes[id].updated = new Date().toISOString();
  });
}
function doExport() {
  const data = store.exportJSON();
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'forge-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Backup downloaded.');
}
function importFile(file) {
  const fr = new FileReader();
  fr.onload = () => { try { store.importJSON(fr.result); onbStep = 0; location.hash = '#/today'; render(); toast('Backup restored.'); } catch (e) { alert('Could not import: ' + e.message); } };
  fr.readAsText(file);
}
function doReset() {
  if (!confirm('This erases ALL your data. Export a backup first if you want to keep it. Continue?')) return;
  if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
  store.resetAll(); onbStep = 0; location.hash = '#/today'; render();
}

function liveBase() { return location.href.split('#')[0].split('?')[0]; }

function saveBody() {
  const num = (id) => { const el = document.getElementById(id); const v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? null : v; };
  const entry = { dateISO: new Date().toISOString(), weight: num('b-w'), bodyfat: num('b-bf'), restingHR: num('b-rhr'), hrv: num('b-hrv'), sleepHrs: num('b-sleep') };
  if (entry.weight == null && entry.hrv == null && entry.restingHR == null && entry.sleepHrs == null && entry.bodyfat == null) { toast('Enter at least one number.'); return; }
  store.logBody(entry);
  render();
  toast('Body & recovery saved.');
}

function pasteHealth() {
  const el = document.getElementById('b-paste');
  const v = el ? el.value.trim() : '';
  if (!v) { toast('Paste something like weight:198,hrv:70,sleep:7.2'); return; }
  if (ingestFromURL(v)) { render(); toast('Health update added.'); }
  else toast('Nothing recognized — use weight: / hrv: / rhr: / sleep: / bf:');
}

function importHealthFile(file) {
  const fr = new FileReader();
  fr.onload = () => { try { const n = importHealthCSV(fr.result); render(); toast(n + ' day(s) of health data imported.'); } catch (e) { alert('Could not import: ' + e.message); } };
  fr.readAsText(file);
}

// Parse a CSV of health data (Apple Health / Health Auto Export / generic). Header-mapped, tolerant.
function importHealthCSV(text) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error('No rows found.');
  const pick = (obj, keys) => { for (const k of Object.keys(obj)) { const kk = k.toLowerCase().trim(); if (keys.some((x) => kk.includes(x))) { const num = parseFloat(String(obj[k]).replace(/[^0-9.\-]/g, '')); if (!isNaN(num)) return num; } } return null; };
  const dateOf = (obj) => { for (const k of Object.keys(obj)) { const kk = k.toLowerCase(); if (kk.includes('date') || kk === 'day') { const d = new Date(obj[k]); if (!isNaN(d)) return d.toISOString(); } } return new Date().toISOString(); };
  let count = 0;
  for (const r of rows) {
    const entry = {
      dateISO: dateOf(r),
      weight: pick(r, ['weight', 'body mass']),
      bodyfat: pick(r, ['body fat', 'bodyfat', 'fat %']),
      restingHR: pick(r, ['resting heart', 'resting hr', 'restinghr', 'rhr']),
      hrv: pick(r, ['hrv', 'heart rate variability', 'sdnn']),
      sleepHrs: pick(r, ['sleep']),
    };
    if (entry.weight == null && entry.hrv == null && entry.restingHR == null && entry.sleepHrs == null && entry.bodyfat == null) continue;
    store.logBody(entry); count++;
  }
  if (!count) throw new Error('No recognizable columns (weight / HRV / resting HR / sleep).');
  return count;
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim().length);
  if (!lines.length) return [];
  const split = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === ',' && !q) { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
  const headers = split(lines[0]);
  return lines.slice(1).map((l) => { const cells = split(l); const o = {}; headers.forEach((h, i) => { o[h] = cells[i]; }); return o; });
}

// URL ingest: "weight:200,hrv:65,rhr:52,sleep:7.4,bf:18" → today's body entry (for an iPhone Shortcut).
export function ingestFromURL(str) {
  if (!str) return false;
  const map = { weight: 'weight', bw: 'weight', hrv: 'hrv', rhr: 'restingHR', restinghr: 'restingHR', sleep: 'sleepHrs', bf: 'bodyfat', bodyfat: 'bodyfat' };
  const entry = { dateISO: new Date().toISOString() };
  let any = false;
  for (const pair of String(str).split(/[,;]/)) {
    const [k, val] = pair.split(':');
    if (!k || val == null) continue;
    const key = map[k.toLowerCase().trim()];
    const num = parseFloat(val);
    if (key && !isNaN(num)) { entry[key] = num; any = true; }
  }
  if (any) { store.logBody(entry); return true; }
  return false;
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}
