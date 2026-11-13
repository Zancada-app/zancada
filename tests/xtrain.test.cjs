// Otros entrenos: tipos, carga, fatiga del día siguiente, sesiones de fuerza cubiertas y Strava.
// Uso: node tests/xtrain.test.cjs
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
E.TODAY_OVERRIDE = '2026-11-16';
E.state = E.blankState();
E.createPlan({ name: '', goal: '10k', level: 'intermedio', weeklyKm: 25, days: [1, 3, 6], longDay: 6, weeks: 10, raceDate: null,
  targetTime: null, hrMax: null, age: null, marks: [], strength: true }, false);

// todos los tipos de los grupos existen y son variados
const keys = E.XT_GROUPS.flatMap(([, k]) => k);
keys.forEach(k => assert.ok(E.XT[k], k));
assert.ok(keys.length >= 30, 'amplia variedad');
['gym', 'pilates', 'barre', 'yoga', 'crossfit', 'bici', 'natacion', 'padel'].forEach(k => assert.ok(keys.includes(k), k));

// carga: 60 min a 7,5 = 100
const x = E.addXt({ type: 'gym', date: '2026-11-16', min: 60, rpe: 8, focus: 'piernas' });
assert.ok(Math.abs(E.xtLoad({ type: 'gym', min: 60, rpe: 7.5 }) - 100) < 0.01);
// cuenta para la fatiga aunque no haya carreras
const ls = E.loadSeries(); assert.ok(ls.length && ls[ls.length - 1].load > 100, 'en la serie de carga');
// al día siguiente, piernas cargadas por el gimnasio
E.TODAY_OVERRIDE = '2026-11-17';
E.state.checkins = { '2026-11-17': { sleep: 3, legs: 3, stress: 3, pain: 3 } };
assert.ok(E.readiness('2026-11-17').why.some(w => /gimnasio/.test(w)), 'avisa del gimnasio de ayer');
// tren superior no cuenta como carga de piernas
x.focus = 'superior'; assert.ok(!E.xtHardOn('2026-11-16'));

// sesiones de fuerza del plan cubiertas por pilates / barre
const mon = E.monday('2026-11-16'), days = E.strengthDays(mon);
if (days.length) {
  E.state.xt = [];
  E.addXt({ type: 'pilates', date: '2026-11-17', min: 50, rpe: 5 });
  assert.ok(E.strengthDoneOn(days[0].date), 'la primera sesión de fuerza queda cubierta');
  if (days[1]) assert.ok(!E.strengthDoneOn(days[1].date), 'la segunda no');
  E.addXt({ type: 'barre', date: '2026-11-19', min: 50, rpe: 6 });
  if (days[1]) assert.ok(E.strengthDoneOn(days[1].date), 'con barre, la segunda también');
  E.addXt({ type: 'yoga', date: '2026-11-20', min: 60, rpe: 3 });
  assert.strictEqual(E.xtStrengthWeek(mon).length, 2, 'el yoga no cuenta como fuerza');
}

// Strava
const st = E.xtFromStrava({ id: 9, sport_type: 'WeightTraining', moving_time: 3000, start_date_local: '2026-11-18T18:00:00', distance: 0 }, () => null);
assert.strictEqual(st.type, 'gym'); assert.strictEqual(st.min, 50);
assert.strictEqual(E.xtFromStrava({ id: 10, sport_type: 'Run', moving_time: 3000, start_date_local: '2026-11-18T18:00:00' }), null);
assert.strictEqual(E.xtFromStrava({ id: 11, sport_type: 'Ride', moving_time: 5400, distance: 40000, start_date_local: '2026-11-18T08:00:00' }).km, 40);
E.state.xt = []; E.addXt({ type: 'gym', date: '2026-11-18', min: 45, rpe: 7, notes: 'pierna' });
assert.strictEqual(E.mergeStravaXt([st]), 0, 'sustituye la apuntada a mano');
assert.strictEqual(E.state.xt.length, 1); assert.strictEqual(E.state.xt[0].sid, 9); assert.strictEqual(E.state.xt[0].notes, 'pierna');
assert.strictEqual(E.mergeStravaXt([st]), 0, 'sin duplicados');

// pantallas
E.addXt({ type: 'natacion', date: '2026-11-15', min: 40, rpe: 5, km: 1.5 });
E.addXt({ type: 'otro', name: 'Trampolín', date: '2026-11-17', min: 30, rpe: 6 });
for (const f of ['renderHoy', 'renderPlan', 'renderProgreso']) { E[f](); assert.ok(!/NaN|undefined|Infinity/.test(E.app.innerHTML), f); }
E.renderProgreso(); assert.ok(/Otros entrenos/.test(E.app.innerHTML) && /Trampolín/.test(E.app.innerHTML));
console.log('otros entrenos OK');
