// Solo para pruebas automáticas (Playwright): expone los módulos en `window`
// para poder inspeccionar y manipular el estado desde el navegador de pruebas.
// No lo carga la app; las pruebas lo inyectan en index.html.
import * as m0 from '../../js/core/store.js';
import * as m1 from '../../js/core/util.js';
import * as m2 from '../../js/model/activities.js';
import * as m3 from '../../js/model/adapt.js';
import * as m4 from '../../js/model/analysis.js';
import * as m5 from '../../js/model/calendar.js';
import * as m6 from '../../js/model/constants.js';
import * as m7 from '../../js/model/elevation.js';
import * as m8 from '../../js/model/goal.js';
import * as m9 from '../../js/model/heartrate.js';
import * as m10 from '../../js/model/load.js';
import * as m11 from '../../js/model/marks.js';
import * as m12 from '../../js/model/plan.js';
import * as m13 from '../../js/model/readiness.js';
import * as m14 from '../../js/model/shoes.js';
import * as m15 from '../../js/model/strength.js';
import * as m16 from '../../js/model/weather.js';
import * as m17 from '../../js/model/weekly.js';
import * as m18 from '../../js/model/workouts.js';
import * as m19 from '../../js/services/strava.js';
import * as m20 from '../../js/services/weather.js';
import * as m21 from '../../js/ui/actions.js';
import * as m22 from '../../js/ui/blocks.js';
import * as m23 from '../../js/ui/cards.js';
import * as m24 from '../../js/ui/charts.js';
import * as m25 from '../../js/ui/checkin.js';
import * as m26 from '../../js/ui/dom.js';
import * as m27 from '../../js/ui/events.js';
import * as m28 from '../../js/ui/pickers.js';
import * as m29 from '../../js/ui/router.js';
import * as m30 from '../../js/ui/shoes.js';
import * as m31 from '../../js/ui/strength.js';
import * as m32 from '../../js/ui/toast.js';
import * as m33 from '../../js/ui/screens/hoy.js';
import * as m34 from '../../js/ui/screens/manual.js';
import * as m35 from '../../js/ui/screens/perfil.js';
import * as m36 from '../../js/ui/screens/plan.js';
import * as m37 from '../../js/ui/screens/progreso.js';
import * as m38 from '../../js/ui/screens/wizard.js';
import * as m39 from '../../js/ui/screens/zonas.js';

const mods = [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9, m10, m11, m12, m13, m14, m15, m16, m17, m18, m19, m20, m21, m22, m23, m24, m25, m26, m27, m28, m29, m30, m31, m32, m33, m34, m35, m36, m37, m38, m39];
const all = Object.assign({}, ...mods.map(m => ({...m})));
const setterOf = n => n === 'TODAY_OVERRIDE' ? all.setTodayOverride : all['set' + n[0].toUpperCase() + n.slice(1)];
for (const m of mods) for (const name of Object.keys(m)) {
  Object.defineProperty(window, name, {
    configurable: true,
    get: () => m[name],
    set: v => { const s = setterOf(name); if (!s) throw new Error('No se puede reasignar ' + name); s(v); },
  });
}
window.__debugReady = true;
