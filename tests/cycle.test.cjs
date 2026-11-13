// Ciclo menstrual: fases, previsión, colocación de sesiones duras, síntomas y aprendizaje.
// Uso: node tests/cycle.test.cjs → termina con código 1 si algo falla.
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
const plan = () => {
  E.state = E.blankState();
  E.createPlan({ name: '', goal: '10k', level: 'intermedio', weeklyKm: 30, days: [1, 3, 4, 6], longDay: 6, weeks: 12,
    raceDate: null, refDist: null, refTime: null, targetTime: null, hrMax: null, age: null }, false);
};
E.TODAY_OVERRIDE = '2026-11-09'; // lunes
plan();

// fases
E.setupCycle({ mode: 'natural', last: '2026-10-23', len: 28, plen: 5 });
let p = E.phaseOf('2026-11-09');
assert.strictEqual(p.day, 18); assert.strictEqual(p.phase, 'lutea');
assert.strictEqual(E.phaseOf('2026-10-25').phase, 'regla');
assert.strictEqual(E.phaseOf('2026-11-06').phase, 'ovulacion');            // día 15 (ovulación día 14 ±1)
assert.strictEqual(E.phaseOf('2026-11-18').phase, 'premenstrual');         // día 27
assert.strictEqual(E.nextPeriod('2026-11-09'), '2026-11-20');
const fut = E.phaseOf('2026-11-21'); assert.ok(fut.projected && fut.phase === 'regla' && fut.day === 2, 'previsión del siguiente ciclo');

// colocación: las sesiones duras no caen en días 1–2 de regla ni en los 2 previos
E.regenerate();
const bad = E.state.sessions.filter(s => s.status === 'pending' && s.date >= '2026-11-09' && s.date <= '2026-11-22' && E.QUALITY.includes(s.type) && E.sensitiveDay(s.date));
const moved = E.state.sessions.filter(s => s.cyc && !s.cyc.swap);
assert.ok(moved.some(s => s.type === 'cuestas' && s.cyc.from === '2026-11-19'), 'las cuestas del día previo a la regla se mueven');
assert.strictEqual(bad.length, 0, 'ninguna sesión dura en días delicados');
console.log('  movidas:', moved.map(s => `${s.type} ${s.cyc.from}→${s.date}`).join(', ') || 'ninguna', '| sin hueco:', bad.map(s => s.date + ' ' + s.type).join(', ') || 'ninguna');
const wk = d => E.monday(d);
moved.forEach(s => assert.strictEqual(wk(s.cyc.from), wk(s.date), 'se mueve dentro de la misma semana'));
// ninguna sesión dura queda pegada a otra clave por el cambio
moved.forEach(s => assert.ok(!E.state.sessions.some(x => x !== s && x.status === 'pending' && E.KEY_TYPES.includes(x.type) && Math.abs(E.daysBetween(x.date, s.date)) === 1 && !(x.cyc && x.cyc.from === s.date)), 'sin sesiones duras seguidas'));
// sin duplicados de fecha
const dates = E.state.sessions.filter(s => s.status === 'pending').map(s => s.date);
assert.strictEqual(new Set(dates).size, dates.length, 'una sesión por día');
// idempotente
const snap = JSON.stringify(E.state.sessions); E.cycleSchedule(); E.regenerate();
assert.strictEqual(JSON.stringify(E.state.sessions.map(s => [s.date, s.type])), JSON.stringify(JSON.parse(snap).map(s => [s.date, s.type])), 'recalcular no vuelve a mover');
assert.ok(E.state.adapt.events.filter(e => /pasada del/.test(e.text)).length <= moved.length + 1, 'sin avisos repetidos');

// síntomas en el chequeo: solo en regla y premenstrual
assert.strictEqual(E.chkRows('2026-11-09').length, 4);
assert.strictEqual(E.chkRows('2026-11-18').length, 5);
E.state.checkins = { '2026-11-18': { sleep: 3, legs: 3, stress: 3, pain: 3, cyc: 1 } };
E.TODAY_OVERRIDE = '2026-11-18';
const r = E.readiness('2026-11-18'); assert.notStrictEqual(r.v, 'go'); assert.ok(r.why.some(w => /regla/.test(w)));

// «Tengo la regla» apunta la regla y suaviza
E.TODAY_OVERRIDE = '2026-11-19';
const s16 = E.state.sessions.find(s => s.date === '2026-11-19' && s.status === 'pending') || (() => { const s = E.state.sessions.find(x => x.status === 'pending' && x.date > '2026-11-19'); s.date = '2026-11-19'; return s; })();
E.doNot100(s16, 'period');
assert.ok(E.state.cycle.starts.includes('2026-11-19'), 'regla apuntada');
assert.strictEqual(E.phaseOf('2026-11-19').day, 1);
assert.ok(s16.mod, 'sesión ajustada');
assert.ok(!E.addPeriodStart('2026-11-21'), 'dos inicios seguidos son la misma regla');
assert.strictEqual(E.cycleLen(), 28, 'con un solo ciclo usa la duración indicada');
E.addPeriodStart('2026-09-21'); E.addPeriodStart('2026-08-25');
assert.strictEqual(E.cycleLen(), 27, 'aprende la duración real del historial'); // 27, 29, 27

// aprendizaje: en premenstrual marca más esfuerzo
E.TODAY_OVERRIDE = '2026-11-20';
E.state.sessions = E.state.sessions.filter(s => s.status !== 'done');
const mk = (date, type, rpe) => E.state.sessions.push({ id: 'x' + date + type, date, type, status: 'done', km: 8, week: 0, log: { rpe, km: 8, time: 2880 } });
['2026-09-24', '2026-09-30', '2026-10-06', '2026-10-28', '2026-11-03', '2026-11-08'].forEach(d => mk(d, 'easy', 4));
['2026-09-25', '2026-10-01', '2026-10-29', '2026-11-04'].forEach(d => mk(d, 'series', 7));
// días premenstruales de los dos últimos ciclos: 18–22 oct y 14–18 nov
[['2026-10-19', 'easy', 6], ['2026-10-20', 'series', 9], ['2026-11-15', 'easy', 6], ['2026-11-16', 'series', 9]].forEach(([d, t, r]) => mk(d, t, r));
const ins = E.cycleInsights();
assert.ok(ins.ready, 'hay datos suficientes');
assert.ok(ins.phases.premenstrual && ins.phases.premenstrual.harder, 'detecta que la fase premenstrual le cuesta más');
assert.ok(!ins.phases.folicular || !ins.phases.folicular.harder);

// píldora y sin ciclo
E.TODAY_OVERRIDE = '2026-11-09'; plan();
E.setupCycle({ mode: 'pildora', last: '2026-11-01' });
assert.strictEqual(E.phaseOf('2026-11-09').phase, 'activa'); assert.strictEqual(E.phaseOf('2026-11-23').phase, 'descanso');
E.setupCycle({ mode: 'otro' });
assert.strictEqual(E.phaseOf('2026-11-09'), null); assert.strictEqual(E.chkRows('2026-11-09').length, 5);
E.disableCycle(true); assert.strictEqual(E.state.cycle, null);

// pantallas sin NaN ni undefined
E.TODAY_OVERRIDE = '2026-11-19'; plan(); E.setupCycle({ mode: 'natural', last: '2026-11-19' }); E.regenerate();
for (const f of ['renderHoy', 'renderPlan', 'renderProgreso', 'renderPerfil']) { E[f](); assert.ok(!/NaN|undefined/.test(E.app.innerHTML), f); }
assert.ok(/Tu ciclo/.test((E.renderHoy(), E.app.innerHTML)));
console.log('ciclo OK');
