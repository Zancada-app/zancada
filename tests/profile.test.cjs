// Editar el perfil: sin cambios no recalcula, las marcas conservan su fecha y la carrera no se mueve.
// Uso: node tests/profile.test.cjs
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
E.TODAY_OVERRIDE = '2026-10-26'; E.state = E.blankState();
E.createPlan({ name: 'Lucía', goal: '21k', level: 'intermedio', weeklyKm: 25, days: [1, 3, 5, 6], longDay: 6, weeks: 14, raceDate: null,
  targetTime: null, first: true, hrMax: 188, age: 36, marks: [{ d: 10, t: 3240, date: '2026-09-14' }], strength: true }, false);
const race = E.state.sessions.find(s => s.type === 'race').date;
assert.strictEqual(E.state.profile.raceDate, race, 'la fecha de la carrera queda fijada');
E.TODAY_OVERRIDE = '2026-11-18';
E.draft = E.draftFromProfile(E.state.profile);
const pr = E.profileFromDraft();
assert.deepStrictEqual(pr.marks, E.state.profile.marks, 'las marcas conservan su fecha');
// el «formulario» del perfil actual da lo mismo que el perfil (ida y vuelta estable)
E.draft = E.draftFromProfile(E.state.profile); const a = JSON.stringify(E.profileFromDraft());
E.draft = E.draftFromProfile(E.profileFromDraft()); assert.strictEqual(JSON.stringify(E.profileFromDraft()), a, 'ida y vuelta estable');
// recalcular (p. ej. cambiando los días) no mueve la carrera ni la forma aprendida
E.state.fitness.p = 300; E.state.fitness.history.push({ date: '2026-11-10', p: 300 });
E.createPlan(Object.assign({}, E.state.profile, { days: [1, 4, 5, 6] }), true);
assert.strictEqual(E.state.sessions.find(s => s.type === 'race').date, race, 'misma fecha de carrera');
assert.strictEqual(E.state.fitness.p, 300, 'la forma aprendida no se pierde');
console.log('editar perfil OK');
