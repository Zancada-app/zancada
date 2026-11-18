// Recuperar sesiones perdidas en la misma semana.
// Uso: node tests/recover.test.cjs
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
const mk = () => {
  E.TODAY_OVERRIDE = '2026-11-09'; E.state = E.blankState();
  E.createPlan({ name: '', goal: '10k', level: 'intermedio', weeklyKm: 30, days: [0, 2, 4, 6], longDay: 6, weeks: 12, raceDate: null,
    targetTime: null, hrMax: null, age: null, marks: [] }, false);
};
mk();
const wk = E.state.sessions.filter(s => s.date >= '2026-11-16' && s.date <= '2026-11-22');
console.log('  semana:', wk.map(s => s.date.slice(8) + ' ' + s.type).join(', '));
// el lunes no se hace nada; es miércoles
E.TODAY_OVERRIDE = '2026-11-18'; E.processMissed();
const mon = E.state.sessions.find(s => s.date === '2026-11-16');
assert.strictEqual(mon.status, 'skipped');
const copy = E.missedCopy(mon);
if (copy) { // una sesión clave: el plan ya la recolocó sola; se mueve la copia, no la original
  assert.ok(!E.canRecover(mon), 'con copia, la original no se recupera');
  assert.ok(E.moveOptions(copy).length, 'la copia se puede mover');
} else {
  assert.ok(E.canRecover(mon), 'se puede recuperar');
  const opts = E.recoverOptions(mon);
  assert.ok(opts.every(o => o.d >= '2026-11-18' && o.d <= '2026-11-22'), 'solo de hoy al domingo');
  const keys = opts.filter(o => o.other && (E.KEY_TYPES.includes(o.other.type) || o.other.type === 'race'));
  keys.forEach(o => assert.ok(o.blocked, 'no encima de otra sesión dura'));
  const free = opts.find(o => !o.other && !o.blocked), easy = opts.find(o => o.replace && !o.blocked);
  const target = (free || easy).d, other = (free || easy).other;
  const msg = E.recoverSession(mon, target);
  assert.ok(/pasa al|queda para hoy/.test(msg), msg);
  assert.strictEqual(mon.status, 'pending'); assert.strictEqual(mon.date, target);
  if (other) { assert.strictEqual(other.status, 'skipped'); assert.ok(other.replaced); assert.ok(!E.canRecover(other), 'la sustituida no se ofrece'); }
  const dates = E.state.sessions.filter(s => s.status === 'pending').map(s => s.date);
  assert.strictEqual(new Set(dates).size, dates.length, 'una sesión por día');
  // si tampoco la hace, no se vuelve a recolocar sola
  E.TODAY_OVERRIDE = E.addDays(target, 1); E.processMissed();
  assert.strictEqual(mon.status, 'skipped'); assert.ok(!E.missedCopy(mon), 'sin copia automática');
}
// semanas anteriores: no se recuperan
mk(); E.TODAY_OVERRIDE = '2026-11-24'; E.processMissed();
assert.ok(!E.state.sessions.some(s => s.date < '2026-11-23' && E.canRecover(s)), 'semanas pasadas no');
// una sesión clave saltada a mano, sin hueco: se puede recuperar en lugar de un rodaje
mk(); E.TODAY_OVERRIDE = '2026-11-16';
const q = E.state.sessions.find(s => s.date >= '2026-11-16' && s.date <= '2026-11-22' && E.KEY_TYPES.includes(s.type) && s.type !== 'long');
if (q) {
  E.TODAY_OVERRIDE = q.date; E.skip(q);
  if (!E.missedCopy(q)) assert.ok(E.canRecover(q) || !E.recoverOptions(q).some(o => !o.blocked));
}
// adherencia: las sustituidas no cuentan como saltadas
const a = E.adherence(14); assert.ok(a.ratio >= 0 && a.ratio <= 1);
// pantallas
for (const f of ['renderHoy', 'renderPlan']) { E[f](); assert.ok(!/NaN|undefined/.test(E.app.innerHTML), f); }
console.log('recuperar sesiones OK');
