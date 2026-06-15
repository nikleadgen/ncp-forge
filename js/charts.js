// charts.js — tiny dependency-free inline-SVG charts. Each returns an SVG string.

const esc = (s) => String(s).replace(/[<>&]/g, (m) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));

export function lineChart(series, opts = {}) {
  const w = opts.w || 320, h = opts.h || 120, pad = 22;
  const color = opts.color || '#36d399';
  if (!series || series.length === 0) {
    return `<div class="chart-empty">No data yet — log a few sessions and this fills in.</div>`;
  }
  if (series.length === 1) {
    const v = series[0].y;
    return `<div class="chart-single"><span class="chart-single-v">${esc(v)}</span><span class="chart-single-l">${opts.unit || ''} · first data point</span></div>`;
  }
  const ys = series.map((p) => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = (max - min) || 1;
  const X = (i) => pad + (i / (series.length - 1)) * (w - pad * 2);
  const Y = (v) => h - pad - ((v - min) / span) * (h - pad * 2);
  const pts = series.map((p, i) => `${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${pad},${h - pad} ${pts} ${(w - pad)},${h - pad}`;
  const dots = series.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.4" fill="${color}"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" preserveAspectRatio="none" role="img" aria-label="trend chart">
    <polygon points="${area}" fill="${color}" opacity="0.10"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${pad}" y="${h - 5}" class="chart-axis">${esc(series[0].x.slice(5))}</text>
    <text x="${w - pad}" y="${h - 5}" text-anchor="end" class="chart-axis">${esc(series[series.length - 1].x.slice(5))}</text>
    <text x="${pad}" y="14" class="chart-axis">${esc(max)}</text>
  </svg>`;
}

export function barChart(series, opts = {}) {
  const w = opts.w || 320, h = opts.h || 90, pad = 16;
  const color = opts.color || '#60a5fa';
  if (!series || !series.length) return `<div class="chart-empty">No data yet.</div>`;
  const max = Math.max(...series.map((p) => p.y)) || 1;
  const bw = (w - pad * 2) / series.length;
  const bars = series.map((p, i) => {
    const bh = (p.y / max) * (h - pad * 2);
    return `<rect x="${(pad + i * bw + bw * 0.15).toFixed(1)}" y="${(h - pad - bh).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${color}" opacity="0.85"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img" aria-label="weekly load">${bars}</svg>`;
}

export function gauge(value, opts = {}) {
  // value 0..100; semicircle gauge
  const color = opts.color || '#36d399';
  const v = Math.max(0, Math.min(100, value || 0));
  const r = 46, cx = 60, cy = 60;
  const a = Math.PI * (1 - v / 100);
  const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
  const large = 0;
  return `<svg viewBox="0 0 120 72" class="gauge" role="img" aria-label="gauge ${v}">
    <path d="M14 60 A46 46 0 0 1 106 60" fill="none" stroke="#23304a" stroke-width="9" stroke-linecap="round"/>
    <path d="M14 60 A46 46 0 ${large} 1 ${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>
    <text x="60" y="56" text-anchor="middle" class="gauge-v">${opts.label != null ? esc(opts.label) : Math.round(v)}</text>
  </svg>`;
}

export function progressBar(pct, opts = {}) {
  const v = Math.max(0, Math.min(100, pct || 0));
  const color = opts.color || (v >= 80 ? '#36d399' : v >= 50 ? '#fbbf24' : '#fb923c');
  return `<div class="pbar"><div class="pbar-fill" style="width:${v}%;background:${color}"></div></div>`;
}
