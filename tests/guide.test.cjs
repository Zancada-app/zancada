// Entreno guiado: pasos de cada tipo de sesión, frases, avisos de ritmo, parciales y filtro del GPS.
// Uso: node tests/guide.test.cjs
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
E.TODAY_OVERRIDE = '2026-11-16';
E.state = E.blankState();
E.createPlan({ name: '', goal: '10k', level: 'intermedio', weeklyKm: 35, days: [0, 1, 3, 4, 6], longDay: 6, weeks: 12, raceDate: null,
  targetTime: 2900, hrMax: null, age: null, marks: [{ d: 5, t: 1380, date: '2026-10-20' }] }, false);

// voz
assert.strictEqual(E.sayPace(330), '5 30'); assert.strictEqual(E.sayPace(365), '6 cero cinco'); assert.strictEqual(E.sayPace(360), '6 en punto');
assert.strictEqual(E.sayDist(0.4), '400 metros'); assert.strictEqual(E.sayDist(1), '1 kilómetro'); assert.strictEqual(E.sayDist(2.5), '2,5 kilómetros');
assert.strictEqual(E.sayTime(90), '1 minuto 30'); assert.strictEqual(E.sayTime(45), '45 segundos');

// pasos para todos los tipos de sesión
const types = ['easy', 'long', 'series', 'tempo', 'ritmo', 'fartlek', 'cuestas', 'test', 'race', 'runwalk'];
const base = E.state.sessions.find(s => s.type === 'easy');
for (const type of types) for (const mode of ['gps', 'cinta']) {
  const s = Object.assign({}, base, { type, km: type === 'race' ? 10 : 8, budget: 8, strides: type === 'easy', week: 3, id: 'x' + type });
  if (type === 'runwalk') E.state.plan.rwStart = 2;
  const st = E.buildSteps(s, mode), tag = type + '/' + mode;
  assert.ok(st.length >= 1, tag + ': hay pasos');
  st.forEach((x, i) => {
    assert.ok((x.dist > 0) !== (x.dur > 0) || (x.dist > 0 && !x.dur) || (x.dur > 0 && !x.dist), tag + ': distancia o tiempo');
    if (mode === 'cinta') assert.ok(x.dur > 0 && !x.dist, tag + ': en cinta todo por tiempo');
    const t = E.stepIntro(st, i, mode);
    assert.ok(t.length > 5 && !/undefined|NaN|null/.test(t), `${tag}: frase «${t}»`);
  });
  // la distancia total cuadra con la sesión (± 15 %)
  if (mode === 'gps' && !['fartlek', 'cuestas', 'runwalk'].includes(type)) {
    const km = st.reduce((a, x) => a + (x.dist || (x.dur || 0) / 400), 0), d = E.describe(s);
    assert.ok(Math.abs(km - d.estKm) / d.estKm < 0.2, `${tag}: ${km.toFixed(1)} vs ${d.estKm.toFixed(1)}`);
  }
}
// series: trabajo y recuperación alternados, sin recuperación tras la última
const ser = Object.assign({}, base, { type: 'series', km: 9, budget: 9, id: 'ser' });
const st = E.buildSteps(ser, 'gps'), work = st.filter(x => x.phase === 'Series' && x.kind === 'main'), recs = st.filter(x => x.phase === 'Series' && x.kind === 'rec');
assert.ok(work.length >= 3 && recs.length === work.length - 1, 'series y recuperaciones');
const i1 = st.indexOf(work[0]);
const intro = E.stepIntro(st, i1, 'gps');
assert.ok(/Empezamos series/.test(intro) && /Primera repetición/.test(intro) && /el kilómetro/.test(intro), intro);
assert.ok(/terminado/.test(intro) || st[i1 - 1].kind === 'strides' || st[i1 - 1].kind === 'rec', 'cierra la parte anterior: ' + intro);
assert.ok(/la última/.test(E.stepIntro(st, st.indexOf(work[work.length - 1]), 'gps')));
assert.ok(/km\/h|kilómetros por hora/.test(E.stepIntro(E.buildSteps(ser, 'cinta'), i1, 'cinta')), 'en cinta, velocidad');

// avisos de ritmo: 20 s fuera del rango, luego como mucho cada 45 s
const w = work[0];
let g = { outSince: null, lastAlert: null, count: 0 };
const run = (pace, from, to, stp = w) => { const said = []; for (let t = from; t <= to; t++) { const r = E.paceCheck(stp, { pace, outSince: g.outSince, lastAlert: g.lastAlert, now: t, stepT: t, count: g.count }); g.outSince = r.outSince; g.lastAlert = r.lastAlert; g.count = r.count; if (r.say) said.push([t, r.say]); } return said; };
const rapido = run(w.lo - 20, 0, 120);
assert.ok(rapido.length >= 1 && rapido[0][0] >= 50 && /rápido/.test(rapido[0][1]), 'aviso de rápido tras 30 + 20 s');
for (let k = 1; k < rapido.length; k++) assert.ok(rapido[k][0] - rapido[k - 1][0] >= 45, 'no repite antes de 45 s');
g = { outSince: null, lastAlert: null, count: 0 };
assert.ok(run(w.lo - 20, 0, 1200).length <= 4, 'como mucho 4 avisos por parte');
g = { outSince: null, lastAlert: null, count: 0 };
assert.strictEqual(run((w.lo + w.hi) / 2, 0, 200).length, 0, 'en ritmo: silencio');
g = { outSince: null, lastAlert: null, count: 0 };
assert.ok(/lento/.test(run(w.hi + 30, 0, 120)[0][1]));
// rodaje: no protesta por ir algo lento
const easy = E.buildSteps(Object.assign({}, base, { id: 'e', strides: false }), 'gps').find(x => x.kind === 'main');
g = { outSince: null, lastAlert: null, count: 0 };
assert.ok(easy.easy, 'el rodaje es suave');
assert.strictEqual(run(easy.hi + 15, 0, 200, easy).length, 0, 'sin avisos en rodaje un poco lento');
g = { outSince: null, lastAlert: null, count: 0 };
assert.ok(/rápido para ser suave/.test(run(easy.lo - 30, 0, 200, easy)[0][1]), 'rodaje demasiado rápido');

// avisos dentro de un paso
const m = {}, longStep = { kind: 'main', dist: 5, reps: 1 };
const cues = []; for (let d = 0; d <= 5; d += 0.05) cues.push(...E.stepCues(longStep, { dist: d, t: d * 360, lastSplit: 360 }, m));
assert.deepStrictEqual(cues.filter(c => /Kilómetro/.test(c)).length, 4, 'parciales 1–4 km');
assert.ok(cues.includes('Últimos 100 metros.'));
const m2 = {}, c2 = []; const rep = { kind: 'main', dist: 1, reps: 6 };
for (let d = 0; d <= 1; d += 0.02) c2.push(...E.stepCues(rep, { dist: d, t: d * 300 }, m2));
assert.deepStrictEqual(c2, ['Mitad.', 'Últimos 100 metros.']);

// filtro del GPS
const T = new E.Track(); let t0 = 0, lat = 40.4168, lon = -3.7038;
const step = (dm, dt, acc = 5) => { t0 += dt * 1000; lat += dm / 111320; return T.add({ lat, lon, acc, t: t0 }); };
for (let k = 0; k < 120; k++) step(3, 1);               // 360 m en 2 min (5:33 /km)
assert.ok(Math.abs(T.dist - 357) < 10, 'distancia ' + T.dist);
assert.strictEqual(step(200, 1), false, 'salto de 200 m en 1 s descartado');
lat -= 200 / 111320;
assert.strictEqual(step(3, 1, 80), false, 'punto impreciso descartado');
for (let k = 0; k < 30; k++) step(3, 1);
const pace = T.pace(t0, 20); assert.ok(pace > 300 && pace < 370, 'ritmo ' + pace);
const d0 = T.dist; for (let k = 0; k < 60; k++) step(k % 2 ? 2.5 : -2.5, 1); assert.ok(T.dist - d0 < 10, 'parado (temblor del GPS) casi no suma: ' + (T.dist - d0));
console.log('entreno guiado OK');
