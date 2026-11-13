// Mejores marcas desde Strava: año reciente con detalle progresivo, carreras completas
// sin mejores esfuerzos e historial antiguo. Strava se simula (sin red).
// Uso: node tests/strava-marks.test.cjs
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
E.TODAY_OVERRIDE = '2026-11-13';

const DAY = 86400, NOW = Date.parse('2026-11-13T12:00:00Z') / 1000;
const acts = []; let n = 1;
function add(daysAgo, km, pace, extra = {}) {
  const id = n++, t = NOW - daysAgo * DAY;
  acts.push(Object.assign({ id, sport_type: 'Run', type: 'Run', distance: km * 1000, moving_time: Math.round(km * pace),
    start_date: new Date(t * 1000).toISOString(), start_date_local: new Date(t * 1000).toISOString(), workout_type: 0 }, extra));
  return id;
}
// año reciente: 120 rodajes y un 10K rápido entre ellos
for (let i = 1; i <= 120; i++) add(i * 3, 8, 330);
const fast10 = add(200, 10.02, 285);                       // 47:36 → mejor 5K dentro: 23:00
// historial antiguo: media maratón de competición, 5K rápido y mucho relleno
const oldHalf = add(500, 21.2, 300, { workout_type: 1 });  // competición: ~1:45:00
const old5 = add(700, 5.03, 250);                          // 5K rápido sin best_efforts
for (let i = 0; i < 300; i++) add(400 + i * 2, 7, 340);

const effortsOf = a => {
  const be = [], pace = a.moving_time / (a.distance / 1000);
  [['5k', 5000], ['10k', 10000], ['Half-Marathon', 21097.5]].forEach(([name, d]) => {
    if (a.distance >= d) be.push({ name, distance: d, moving_time: Math.round(d / 1000 * pace * (a.id === fast10 && d === 5000 ? 0.97 : 1)) });
  });
  return a.id === old5 ? [] : be;
};
let calls = 0;
global.fetch = async url => {
  calls++;
  const u = new URL(url), p = u.pathname.replace(/^.*\/api\/v3/, '');
  const json = b => ({ ok: true, status: 200, json: async () => b });
  if (p === '/athlete/activities') {
    const after = +u.searchParams.get('after') || 0, before = +u.searchParams.get('before') || Infinity;
    const per = +u.searchParams.get('per_page'), page = +u.searchParams.get('page') || 1;
    const list = acts.filter(a => { const t = Date.parse(a.start_date) / 1000; return t > after && t < before; })
      .sort((a, b) => after ? Date.parse(a.start_date) - Date.parse(b.start_date) : Date.parse(b.start_date) - Date.parse(a.start_date));
    return json(list.slice((page - 1) * per, page * per));
  }
  const m = p.match(/^\/activities\/(\d+)$/);
  if (m) { const a = acts.find(x => x.id === +m[1]); return json(Object.assign({}, a, { best_efforts: effortsOf(a), laps: [], splits_metric: [] })); }
  if (p.startsWith('/gear/')) return json({ name: 'X', distance: 0 });
  if (p === '/athlete/zones') return json({});
  return { ok: false, status: 404, json: async () => ({}) };
};
Date.now = () => NOW * 1000;

(async () => {
  E.state = E.blankState();
  const s = E.sv(); s.clientId = '1'; s.clientSecret = 'x'; s.tokens = { access: 'a', refresh: 'r', expiresAt: NOW + 9999 };
  const pr = () => Object.fromEntries(E.stravaPRs().map(m => [m.key, m]));
  let syncs = 0;
  do {
    calls = 0; s.lastSync = null; // cada vuelta simula una sincronización 15 minutos después
    await E.stravaSync(); syncs++;
    assert.ok(calls <= 90, `una sincronización no pasa de ~90 consultas (${calls})`);
  } while ((s.hist && !(s.hist.listed && !s.hist.cand.length) || s.runs.some(r => !r.detail)) && syncs < 12);
  const p = pr();
  assert.strictEqual(p['5k'].t, 1250, '5K: el de hace dos años, sacado de la carrera completa');
  assert.ok(p['5k'].approx, 'marcado como carrera completa');
  const s5 = E.stravaPRs; delete s.prArchive['5k'];
  assert.strictEqual(pr()['5k'].t, Math.round(5 * 285 * 0.97), 'sin él: el mejor esfuerzo dentro del 10K');
  assert.strictEqual(p['10k'].t, Math.round(10 * 285), '10K del año');
  assert.ok(p['Half-Marathon'] && p['Half-Marathon'].date < '2025-11-13', 'media maratón de hace más de un año');
  assert.ok(p['Half-Marathon'].t <= Math.round(21.0975 * 300), 'media: tiempo correcto');
  assert.ok(s.runs.every(r => r.detail), 'todas las carreras del año acaban con detalle');
  assert.ok(!s.runs.some(r => r.date < '2025-11-13'), 'el historial antiguo no se guarda como carreras');
  console.log(`marcas de Strava OK (${syncs} sincronizaciones; 5K ${E.ft(p['5k'].t)}, 10K ${E.ft(p['10k'].t)}, media ${E.ft(p['Half-Marathon'].t)})`);
})().catch(e => { console.error(e); process.exit(1); });
