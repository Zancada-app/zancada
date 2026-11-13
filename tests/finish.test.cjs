// Objetivo «terminarla» y primera media/maratón: progresión de la tirada larga, viabilidad,
// carrera prudente y tarjeta del objetivo. Uso: node tests/finish.test.cjs
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
E.TODAY_OVERRIDE = '2026-11-16';
const mk = (goal, level, km, weeks, extra = {}) => {
  E.state = E.blankState();
  E.createPlan(Object.assign({ name: '', goal, level, weeklyKm: km, days: [1, 3, 6], longDay: 6, weeks, raceDate: null,
    targetTime: null, first: true, hrMax: null, age: null, marks: [] }, extra), false);
  return E.state;
};
const cases = [['42k', 'intermedio', 20, 16], ['42k', 'intermedio', 20, 20], ['42k', 'nuevo', 10, 20], ['42k', 'avanzado', 50, 16],
  ['21k', 'nuevo', 5, 24], ['21k', 'intermedio', 15, 12], ['21k', 'avanzado', 40, 12], ['21k', 'intermedio', 20, 8]];
for (const [g, l, km, w] of cases) {
  const s = mk(g, l, km, w), pl = s.plan, tag = `${g} ${l} ${km} km ${w} sem`;
  assert.ok(pl.longs && pl.finish, tag + ': hay progresión de tirada larga');
  const peak = Math.max(...pl.longs.filter(x => x != null));
  assert.ok(peak <= E.LONG_PEAK[g].km + 0.5, tag + ': no pasa del máximo recomendado');
  // la tirada sube como mucho 2,5 km de una semana normal a la siguiente
  let prev = null;
  pl.longs.forEach((x, i) => { if (x == null || pl.curve[i].down || pl.curve[i].phase === 'puesta a punto') return; if (prev != null) assert.ok(x - prev <= 2.5, `${tag}: salto de ${prev} a ${x}`); prev = x; });
  // las sesiones largas siguen la progresión
  s.sessions.filter(x => x.type === 'long').forEach(x => assert.ok(Math.abs(x.km - pl.longs[x.week]) <= 0.5, `${tag}: semana ${x.week} ${x.km} vs ${pl.longs[x.week]}`));
  // la más larga cae 2–4 semanas antes de la carrera
  const iMax = pl.longs.lastIndexOf(peak);
  assert.ok(pl.curve.length - 1 - iMax >= 2 && pl.curve.length - 1 - iMax <= 4, tag + ': la más larga, 2–4 semanas antes');
  // carrera prudente
  const race = s.sessions.find(x => x.type === 'race'), d = E.describe(race);
  assert.ok(/Más lento/.test(d.blocks.find(b => b.t === 'Salida').text), tag + ': salida prudente');
  assert.ok(d.blocks.find(b => b.t === 'Salida').lo > d.blocks.find(b => b.t === 'Carrera').lo, tag + ': la salida, más lenta');
  E.renderHoy(); assert.ok(!/NaN|undefined|Infinity/.test(E.app.innerHTML), tag + ': Hoy');
  assert.ok(/Objetivo · terminar/.test(E.app.innerHTML), tag + ': tarjeta del objetivo');
  E.renderProgreso();
  assert.ok(!/NaN|undefined|Infinity/.test(E.app.innerHTML), tag + ': Progreso');
}
// viabilidad
assert.strictEqual(mk('42k', 'intermedio', 30, 10).plan.finish.status, 'insuficiente');
assert.strictEqual(mk('42k', 'intermedio', 20, 20).plan.finish.status, 'justo');
assert.strictEqual(mk('21k', 'avanzado', 40, 12).plan.finish.status, 'holgado');
assert.ok(mk('42k', 'nuevo', 10, 20).plan.finish.runWalk, 'maratón lenta: correr y andar');
// con marca y ya ha hecho alguna: sin progresión especial
assert.ok(!mk('21k', 'intermedio', 30, 12, { first: false, targetTime: 6600 }).plan.longs);
// con marca pero primera vez: progresión, y la tarjeta es la de la marca
const t = mk('21k', 'intermedio', 30, 12, { first: true, targetTime: 6600 });
assert.ok(t.plan.longs); E.renderHoy(); assert.ok(!/Objetivo · terminar/.test(E.app.innerHTML));
// seguimiento: si hace las tiradas, va «en camino»
const s = mk('21k', 'intermedio', 15, 12);
for (let d = 0; d < 35; d++) {
  E.TODAY_OVERRIDE = E.addDays(s.plan.start, d);
  E.processMissed();
  s.sessions.filter(x => x.status === 'pending' && x.date <= E.today()).forEach(x => E.logDone(x, { rpe: 5, km: x.km, time: x.km * 400 }));
}
const fi = E.finishInfo();
assert.ok(fi.longest >= 11 && fi.track !== 'por detrás', `en camino tras 5 semanas (${fi.longest} km, ${fi.track})`);
console.log('terminarla OK');
