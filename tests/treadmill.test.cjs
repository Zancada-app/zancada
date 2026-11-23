// Sesiones en cinta: velocidades, inclinación, cuestas, rectas, consejos y análisis.
// Uso: node tests/treadmill.test.cjs
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
E.TODAY_OVERRIDE = '2026-11-23'; E.state = E.blankState();
E.createPlan({ name: '', goal: '10k', level: 'intermedio', weeklyKm: 35, days: [0, 1, 3, 4, 6], longDay: 6, weeks: 12, raceDate: null,
  targetTime: null, hrMax: null, age: null, marks: [{ d: 5, t: 1380, date: '2026-10-20' }] }, false);
assert.strictEqual(E.speedR(300, 330), '10,9–12 km/h');
const base = E.state.sessions.find(s => s.type === 'easy');
for (const type of ['easy', 'long', 'series', 'tempo', 'ritmo', 'fartlek', 'cuestas', 'test', 'runwalk']) {
  const s = Object.assign({}, base, { type, km: 9, budget: 9, strides: type === 'easy', week: 3, id: 'c' + type, where: 'cinta' });
  if (type === 'runwalk') E.state.plan.rwStart = 2;
  const d = E.describeCinta(s);
  assert.ok(d.cinta && d.blocks.length, type);
  d.blocks.forEach(b => {
    if (b.lo && b.t !== 'Cuestas') assert.ok(/km\/h/.test(b.speed) && b.incl === '1 %', `${type}/${b.t}: velocidad e inclinación`);
    if (b.speed) b.speed.match(/[\d,]+/g).forEach(v => { const k = parseFloat(v.replace(',', '.')); assert.ok(k > 4 && k < 25, `${type}: ${k} km/h`); });
  });
  assert.ok(/1 % de inclinación/.test(d.tips[0]), type + ': consejo de inclinación');
  assert.ok(!d.tips.some(t => /terreno|llano|circuito|pista/i.test(t) && !/en interior no hay viento ni terreno/.test(t)), type + ': sin consejos de calle');
  if (type === 'cuestas') { const h = d.blocks.find(b => b.t === 'Cuestas'); assert.ok(/5–8 %/.test(h.incl) && /inclinación/.test(h.text), 'cuestas con inclinación'); }
  if (type === 'easy') { const st = d.blocks.find(b => b.k === 'strides'); if (st) assert.ok(st.dur === 20 && !st.dist, 'rectas por tiempo'); }
  if (type === 'long') assert.ok(d.tips.some(t => /bloques de 20 minutos/.test(t)));
  E.renderHoy(); // no falla
}
assert.ok(!E.cintaAllowed({ type: 'race' }), 'la carrera no se ofrece en cinta');
// Strava: actividad en interior
assert.ok(E.isIndoorRun({ trainer: true })); assert.ok(E.isIndoorRun({ sport_type: 'VirtualRun' }));
assert.ok(E.isIndoorRun({ start_latlng: [], distance: 8000 })); assert.ok(!E.isIndoorRun({ start_latlng: [40, -3], distance: 8000 }));
// pantalla con la sesión de hoy en cinta
const s = E.state.sessions.find(x => x.date === '2026-11-23' && x.status === 'pending');
s.where = 'cinta'; E.renderHoy();
assert.ok(/en cinta/.test(E.app.innerHTML) && /km\/h/.test(E.app.innerHTML) && !/NaN|undefined/.test(E.app.innerHTML));
// análisis: un rodaje en cinta algo rápido no sale como fallo de ritmo
E.sv().runs = [{ id: 7, date: '2026-11-23', km: s.km, sec: Math.round(s.km * 300), indoor: true, type: 'Run', laps: [], be: [], detail: true,
  splits: Array.from({ length: Math.floor(s.km) }, () => ({ km: 1, sec: 300, hr: 150 })) }];
E.afterSync();
const a = E.analyze(s);
if (a) assert.ok(!a.items.some(x => x.ok === false && /itmo|rápid/i.test(x.label + x.text)), 'ritmo en cinta: solo orientativo');
console.log('cinta OK');
