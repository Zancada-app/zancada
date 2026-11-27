// Condiciones de uso y privacidad: sin aceptar no se usa la app.
// Uso: node tests/legal.test.cjs
'use strict';
const assert = require('assert');
const E = require('./harness.cjs').loadApp();
E.TODAY_OVERRIDE = '2026-11-27'; E.state = E.blankState();
E.createPlan({ name: '', goal: '10k', level: 'intermedio', weeklyKm: 30, days: [0, 2, 4, 6], longDay: 6, weeks: 12, raceDate: null,
  targetTime: null, hrMax: null, age: 35, marks: [] }, false);
assert.ok(E.legalOk(), 'aceptada en el arnés');
E.route(); assert.ok(!/Antes de empezar/.test(E.app.innerHTML), 'con aceptación se ve la app');
E.revokeLegal(); assert.ok(!E.legalOk());
E.route(); assert.ok(/Antes de empezar|Hemos actualizado/.test(E.app.innerHTML) && /lg-terms/.test(E.app.innerHTML) && /disabled/.test(E.app.innerHTML), 'sin aceptar: pantalla de condiciones');
// una versión antigua obliga a aceptar de nuevo
localStorage.setItem('zancada.legal', JSON.stringify({ v: 0, at: '2026-01-01' }));
assert.ok(!E.legalOk()); E.route(); assert.ok(/Hemos actualizado/.test(E.app.innerHTML));
assert.ok(E.acceptLegal() && E.legalOk());
E.route(); assert.ok(!/lg-terms/.test(E.app.innerHTML));
// textos
for (const h of [E.TERMS_HTML, E.PRIVACY_HTML]) assert.ok(h.length > 2000 && !/undefined|NaN/.test(h));
assert.ok(/No es consejo médico/.test(E.TERMS_HTML) && /anticonceptivo/.test(E.TERMS_HTML));
assert.ok(/no recoge ningún dato/.test(E.PRIVACY_HTML) && /Open-Meteo/.test(E.PRIVACY_HTML) && /Strava/.test(E.PRIVACY_HTML));
E.renderPerfil(); assert.ok(/Condiciones y privacidad/.test(E.app.innerHTML) && /Aceptadas el/.test(E.app.innerHTML));
console.log('condiciones OK');
