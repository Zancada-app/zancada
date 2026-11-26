// Ritmo suave según el pulso y FC máxima no por debajo de la estimada por edad.
// Uso: node tests/easyhr.test.cjs
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
E.TODAY_OVERRIDE = '2026-11-26'; E.state = E.blankState();
E.createPlan({ name: '', goal: '10k', level: 'intermedio', weeklyKm: 25, days: [0, 2, 4, 6], longDay: 6, weeks: 12, raceDate: null,
  targetTime: null, hrMax: null, age: 35, marks: [{ d: 5, t: 1600, date: '2026-10-20' }] }, false);
const easy = E.state.sessions.find(s => s.type === 'easy');
const before = E.describe(easy).blocks[0];
// FC máx: medida 170 en rodajes suaves < 184 por edad → se usa 184
E.state.hrm = { lthr: null, max: 170, hist: [] };
assert.strictEqual(E.hrMaxNow(), 184);
const top = E.hrBounds(2)[1];
// rodajes constantes a 7:30 con el pulso por encima de Z2
const mk = (i, pace, hr) => ({ id: 100 + i, date: E.addDays('2026-11-26', -3 * i - 1), km: 6, sec: 6 * pace, hr, elev: 0, type: 'Run', laps: [], be: [], detail: true,
  splits: Array.from({ length: 6 }, () => ({ km: 1, sec: pace, hr })) });
E.sv().runs = [1, 2, 3, 4].map(i => mk(i, 450, top + 8));
const z = E.z2Pace();
assert.ok(z && z.n === 4 && z.pace > 450, 'Z2 más lento que 7:30: ' + (z && z.pace));
const after = E.describe(easy);
assert.ok(after.blocks[0].lo > before.lo && after.blocks[0].lo >= Math.min(z.pace, before.hi * 1.3) - 1, 'el rodaje se ralentiza');
assert.ok(/ajustado a tu pulso/.test(after.tips[0]), 'consejo');
// si va en Z2 de sobra, no se toca
E.sv().runs = [1, 2, 3, 4].map(i => mk(i, 450, top - 12));
assert.strictEqual(E.easyByHR({ lo: before.lo, hi: before.hi }), null);
// series y cinta no cuentan
E.sv().runs = [1, 2, 3, 4].map(i => Object.assign(mk(i, 450, top + 8), { indoor: true }));
assert.strictEqual(E.z2Pace(), null);
// aviso al sincronizar
E.sv().runs = [1, 2, 3, 4].map(i => mk(i, 450, top + 8)); E.state.adapt.events = E.state.adapt.events || [];
E.afterSync();
assert.ok(JSON.stringify(E.state.adapt.events).includes('para que vayas en Z2'), 'aviso');
E.renderZonas(); assert.ok(/Tu ritmo en Z2/.test(E.app.innerHTML) && /Ajustado a tu pulso/.test(E.app.innerHTML) && !/NaN|undefined/.test(E.app.innerHTML));
console.log('pulso suave OK');
