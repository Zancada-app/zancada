/**
 * Otros entrenos (fuerza, gimnasio, pilates, barre, yoga, bici, natación, deportes…):
 * registro manual o desde Strava, carga por esfuerzo percibido (sRPE) que cuenta para la fatiga,
 * impacto sobre las piernas y sesiones de fuerza del plan que cubren.
 *
 * state.xt = [{ id, date, type, min, rpe, km?, focus?, notes?, src: 'manual'|'strava', sid?, name?, hr? }]
 */
import { addDays, monday, today, uid } from '../core/util.js';
import { state } from '../core/store.js';

/* Tipos. legs: cuánto cargan las piernas (0–1, para la fatiga del día siguiente y el impacto);
   str: cuenta como sesión de fuerza del plan; dist: admite distancia; min/rpe: valores habituales. */
export const XT_GROUPS = [
  ['Fuerza y gimnasio', ['gym', 'fuerza', 'funcional', 'crossfit', 'hiit', 'pump', 'calistenia', 'kettlebell']],
  ['Cuerpo y mente', ['pilates', 'barre', 'yoga', 'movilidad', 'taichi']],
  ['Cardio sin impacto', ['bici', 'spinning', 'eliptica', 'natacion', 'remo', 'escaleras', 'aquagym']],
  ['Al aire libre', ['caminar', 'senderismo', 'escalada', 'esqui', 'patinaje', 'surf']],
  ['Deportes y baile', ['padel', 'tenis', 'futbol', 'baloncesto', 'voley', 'baile', 'zumba', 'boxeo', 'artesmarciales']],
  ['Otros', ['fisio', 'otro']],
];

export const XT = {
  gym: { n: 'Gimnasio', e: '🏋️', legs: 0.3, str: true, min: 60, rpe: 6 },
  fuerza: { n: 'Fuerza en casa', e: '💪', legs: 0.3, str: true, min: 30, rpe: 5 },
  funcional: { n: 'Entrenamiento funcional', e: '🤸', legs: 0.4, str: true, min: 45, rpe: 6 },
  crossfit: { n: 'CrossFit', e: '🏋️', legs: 0.5, str: true, min: 60, rpe: 8 },
  hiit: { n: 'HIIT', e: '🔥', legs: 0.5, str: true, min: 30, rpe: 8 },
  pump: { n: 'Body Pump / clase de pesas', e: '🏋️', legs: 0.4, str: true, min: 55, rpe: 6 },
  calistenia: { n: 'Calistenia', e: '🤸', legs: 0.2, str: true, min: 45, rpe: 6 },
  kettlebell: { n: 'Kettlebell', e: '🏋️', legs: 0.4, str: true, min: 30, rpe: 6 },
  pilates: { n: 'Pilates', e: '🧘', legs: 0.1, str: true, min: 50, rpe: 5 },
  barre: { n: 'Barre', e: '🩰', legs: 0.3, str: true, min: 50, rpe: 6 },
  yoga: { n: 'Yoga', e: '🧘', legs: 0, min: 60, rpe: 3 },
  movilidad: { n: 'Movilidad y estiramientos', e: '🙆', legs: 0, min: 20, rpe: 2, light: true },
  taichi: { n: 'Taichí', e: '☯️', legs: 0, min: 45, rpe: 2, light: true },
  bici: { n: 'Ciclismo', e: '🚴', legs: 0.2, dist: true, min: 75, rpe: 5 },
  spinning: { n: 'Spinning / bici estática', e: '🚴', legs: 0.3, min: 45, rpe: 7 },
  eliptica: { n: 'Elíptica', e: '🏃', legs: 0.2, min: 40, rpe: 5 },
  natacion: { n: 'Natación', e: '🏊', legs: 0, dist: true, min: 45, rpe: 5 },
  remo: { n: 'Remo', e: '🚣', legs: 0.2, dist: true, min: 30, rpe: 6 },
  escaleras: { n: 'Escaleras / stepper', e: '🪜', legs: 0.4, min: 30, rpe: 6 },
  aquagym: { n: 'Aquagym', e: '🌊', legs: 0, min: 45, rpe: 3 },
  caminar: { n: 'Caminar', e: '🚶', legs: 0.15, dist: true, min: 60, rpe: 2, light: true },
  senderismo: { n: 'Senderismo', e: '🥾', legs: 0.4, dist: true, min: 180, rpe: 4 },
  escalada: { n: 'Escalada', e: '🧗', legs: 0.1, min: 90, rpe: 6 },
  esqui: { n: 'Esquí', e: '⛷️', legs: 0.5, min: 180, rpe: 5 },
  patinaje: { n: 'Patinaje', e: '⛸️', legs: 0.3, dist: true, min: 45, rpe: 5 },
  surf: { n: 'Surf / pádel surf', e: '🏄', legs: 0.1, min: 90, rpe: 5 },
  padel: { n: 'Pádel', e: '🎾', legs: 0.4, min: 90, rpe: 6 },
  tenis: { n: 'Tenis / squash', e: '🎾', legs: 0.4, min: 60, rpe: 6 },
  futbol: { n: 'Fútbol', e: '⚽', legs: 0.6, min: 75, rpe: 7 },
  baloncesto: { n: 'Baloncesto', e: '🏀', legs: 0.6, min: 60, rpe: 7 },
  voley: { n: 'Vóley', e: '🏐', legs: 0.4, min: 60, rpe: 5 },
  baile: { n: 'Baile', e: '💃', legs: 0.3, min: 60, rpe: 5 },
  zumba: { n: 'Zumba / aeróbic', e: '💃', legs: 0.4, min: 50, rpe: 6 },
  boxeo: { n: 'Boxeo', e: '🥊', legs: 0.3, min: 60, rpe: 7 },
  artesmarciales: { n: 'Artes marciales', e: '🥋', legs: 0.4, min: 60, rpe: 6 },
  fisio: { n: 'Ejercicios de fisio / readaptación', e: '🩺', legs: 0.1, min: 30, rpe: 3, light: true },
  otro: { n: 'Otro', e: '✨', legs: 0.2, min: 45, rpe: 5 },
};

/** Zona trabajada en los entrenos de fuerza: cambia cuánto cargan las piernas. */
export const XT_FOCUS = { piernas: ['Piernas', 0.8], cuerpo: ['Cuerpo entero', 0.5], superior: ['Tren superior', 0.05], core: ['Core', 0.1] };

export const xtList = () => state.xt || (state.xt = []);
export const xtOf = id => xtList().find(x => x.id === id) || null;
export const xtType = x => XT[x.type] || XT.otro;
export const xtName = x => x.type === 'otro' && x.name ? x.name : xtType(x).n;
export const xtLegs = x => x.focus && XT_FOCUS[x.focus] ? XT_FOCUS[x.focus][1] : xtType(x).legs;

/** Carga por esfuerzo percibido: 60 minutos a 7,5/10 = 100, en las mismas unidades que la de correr. */
export const xtLoad = x => (x.rpe || xtType(x).rpe) * (x.min || 0) / (7.5 * 60) * 100;
/** Impacto en las piernas, en «km de correr» equivalentes (≈ 6 min de carrera por km). */
export const xtImpact = x => xtLegs(x) * (x.min || 0) / 6;

export function xtByDate() {
  const by = {}; xtList().forEach(x => { by[x.date] = (by[x.date] || 0) + xtLoad(x); }); return by;
}

export const xtIn = (from, to) => xtList().filter(x => x.date >= from && x.date <= to).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

/** ¿Algo exigente para las piernas ese día? (para la sesión del día siguiente) */
export function xtHardOn(date) {
  return xtList().find(x => x.date === date && (x.rpe || 0) >= 7 && xtLegs(x) >= 0.3 && x.min >= 30) || null;
}

export function addXt(o) {
  const x = { id: uid(), date: o.date || today(), type: XT[o.type] ? o.type : 'otro', min: Math.max(1, Math.round(o.min || 0)),
    rpe: o.rpe || XT[o.type]?.rpe || 5, src: o.src || 'manual' };
  if (o.km) x.km = o.km; if (o.focus) x.focus = o.focus; if (o.notes) x.notes = String(o.notes).slice(0, 200);
  if (o.name) x.name = String(o.name).slice(0, 60); if (o.sid) x.sid = o.sid; if (o.hr) x.hr = o.hr;
  xtList().push(x);
  return x;
}

export function deleteXt(id) { state.xt = xtList().filter(x => x.id !== id); }

/** Entrenos de fuerza de una semana (lunes) que cuentan para el plan. */
export const xtStrengthWeek = mon => xtList().filter(x => x.date >= mon && x.date <= addDays(mon, 6) && xtType(x).str);

/* ---------- Strava: actividades que no son correr ---------- */
const STRAVA_MAP = {
  WeightTraining: 'gym', Crossfit: 'crossfit', HighIntensityIntervalTraining: 'hiit', Workout: 'otro', Yoga: 'yoga', Pilates: 'pilates',
  Ride: 'bici', MountainBikeRide: 'bici', GravelRide: 'bici', EBikeRide: 'bici', EMountainBikeRide: 'bici', VirtualRide: 'spinning', Velomobile: 'bici', Handcycle: 'bici',
  Swim: 'natacion', Elliptical: 'eliptica', Rowing: 'remo', VirtualRow: 'remo', Canoeing: 'remo', Kayaking: 'remo', StairStepper: 'escaleras',
  Walk: 'caminar', Hike: 'senderismo', RockClimbing: 'escalada', AlpineSki: 'esqui', BackcountrySki: 'esqui', NordicSki: 'esqui', Snowboard: 'esqui', Snowshoe: 'senderismo',
  InlineSkate: 'patinaje', IceSkate: 'patinaje', RollerSki: 'patinaje', Skateboard: 'patinaje', Surfing: 'surf', StandUpPaddling: 'surf', Kitesurf: 'surf', Windsurf: 'surf',
  Padel: 'padel', Tennis: 'tenis', Squash: 'tenis', Badminton: 'tenis', Pickleball: 'tenis', Racquetball: 'tenis', TableTennis: 'tenis', Soccer: 'futbol', Golf: 'caminar',
  Sail: 'otro', Wheelchair: 'otro',
};
const RUNS = ['Run', 'TrailRun', 'VirtualRun'];

/** Convierte una actividad de Strava que no es correr; null si es correr. */
export function xtFromStrava(a, rpeFromHR) {
  const st = a.sport_type || a.type; if (RUNS.includes(st)) return null;
  const type = STRAVA_MAP[st] || 'otro', min = Math.round((a.moving_time || a.elapsed_time || 0) / 60);
  if (min < 5) return null;
  const rpe = a.perceived_exertion || (a.average_heartrate && rpeFromHR ? rpeFromHR(a.average_heartrate) : null) || XT[type].rpe;
  return { date: String(a.start_date_local).slice(0, 10), type, min, rpe, km: a.distance > 100 && XT[type].dist ? Math.round(a.distance / 100) / 10 : null,
    name: type === 'otro' ? String(a.name || st).slice(0, 60) : null, sid: a.id, hr: a.average_heartrate || null, src: 'strava' };
}

/** Añade o actualiza las de Strava; si había una igual apuntada a mano ese día, la sustituye conservando las notas. */
export function mergeStravaXt(list) {
  let added = 0;
  for (const o of list) {
    const ex = xtList().find(x => x.sid === o.sid);
    if (ex) { ex.min = o.min; if (!ex.rpeManual) ex.rpe = o.rpe; continue; }
    const man = xtList().find(x => x.src === 'manual' && x.date === o.date && (x.type === o.type || XT[x.type].str && XT[o.type].str) && Math.abs(x.min - o.min) <= Math.max(15, x.min * 0.3));
    if (man) { Object.assign(man, { sid: o.sid, src: 'strava', min: o.min, hr: o.hr }); if (o.km) man.km = o.km; continue; }
    addXt(o); added++;
  }
  return added;
}
