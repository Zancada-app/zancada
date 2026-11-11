// Zapatillas: kilometraje, avisos, asignación automática y pares de Strava.
// Uso: node tests/shoes.test.cjs → termina con código 1 si algo falla.
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
E.TODAY_OVERRIDE = '2026-11-11';
E.state = E.blankState();
E.createPlan({ name: '', goal: '10k', level: 'intermedio', weeklyKm: 25, days: [1, 3, 6], longDay: 6, weeks: 10,
  raceDate: null, refDist: null, refTime: null, targetTime: null, hrMax: null, age: null }, false);

const a = E.addShoe({ name: 'Diario', startKm: 600 });
const b = E.addShoe({ name: 'Ligeras', kind: 'ligeras' });
assert.strictEqual(E.defaultShoe(), a, 'el primer par queda por defecto');
assert.strictEqual(b.limit, 450, 'la vida útil depende del tipo');
assert.deepStrictEqual(E.shoeAlerts(), [], 'sin avisos al dar de alta');

// registro a mano con zapatillas
E.TODAY_OVERRIDE = '2026-11-12';
const s = E.state.sessions.find(x => x.date === '2026-11-12');
E.logDone(s, { rpe: 6, km: 40, time: 40 * 330, shoe: a.id });
assert.strictEqual(E.shoeKm(a), 640);
assert.strictEqual(E.shoeAlerts()[0].level, 1, 'aviso al 90 %');
E.ackShoe(a);
assert.deepStrictEqual(E.shoeAlerts(), [], 'aviso visto');

// entreno fuera del plan y cambio de par
E.state.manual = [{ id: 'm1', date: '2026-11-12', type: 'easy', km: 70, time: 70 * 360, rpe: 4, shoe: a.id }];
assert.strictEqual(E.shoeAlerts()[0].level, 2, 'aviso al pasar el límite');
E.ackShoe(a);
E.setShoeOfRef('m:m1', b.id);
assert.strictEqual(E.shoeKm(a), 640); assert.strictEqual(E.shoeKm(b), 70);

// Strava: material de Strava y carreras sin material al par por defecto
const sv = E.sv();
sv.runs = [{ id: 1, date: '2026-11-10', km: 10, sec: 3000, gear: 'g1', laps: [], splits: [], be: [] }, { id: 2, date: '2026-11-12', km: 8, sec: 2400, gear: null, laps: [], splits: [], be: [] }];
sv.gear = { g1: { name: 'Strava', km: 300, retired: false, at: 0 } };
assert.strictEqual(E.syncStravaShoes(), 1);
const g = E.shoes().find(x => x.stravaId === 'g1');
assert.strictEqual(E.shoeKm(g), 300, 'el total lo da Strava');
assert.strictEqual(E.autoAssignShoes(), 1);
assert.strictEqual(sv.runs[1].shoe, a.id);
E.setShoeOfRef('r:1', a.id);
assert.strictEqual(E.shoeKm(g), 300, 'cambiar de par en la app no descuenta del total de Strava');

// retirar y borrar
E.retireShoe(a);
assert.strictEqual(E.defaultShoe(), E.activeShoes().find(x => x.id === E.state.shoeDefault) || E.defaultShoe());
assert.ok(!E.activeShoes().includes(a));
E.deleteShoe(b);
assert.ok(!E.state.manual[0].shoe, 'al borrar un par se quita de sus carreras');
for (const f of ['renderHoy', 'renderProgreso']) { E[f](); assert.ok(!/NaN|undefined/.test(E.app.innerHTML), f); }
console.log('zapatillas OK');
