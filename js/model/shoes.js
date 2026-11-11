/**
 * Zapatillas: qué par usa cada carrera, kilómetros acumulados y aviso al llegar a la vida útil recomendada.
 *
 * state.shoes = [{ id, name, kind, limit, startKm, added, retired, stravaId, ack }]
 *   kind     tipo de zapatilla (fija la vida útil recomendada por defecto)
 *   limit    km recomendados antes de cambiarlas
 *   startKm  km que ya llevaban al darlas de alta (si no vienen de Strava)
 *   added    fecha de alta: las carreras desde ese día se asignan solas al par por defecto
 *   retired  fecha de retirada o null
 *   stravaId id del material en Strava: entonces Strava lleva su kilometraje total
 *   ack      { level, km } último aviso que el corredor ha visto
 * state.shoeDefault = id del par que se usa si no se elige otro.
 *
 * Cada carrera guarda el par en: run.shoe (Strava), session.log.shoe (registro a mano de una
 * sesión) o manual.shoe (entreno fuera del plan). El valor 'none' significa «sin zapatillas
 * registradas» y evita que se asigne el par por defecto.
 */
import { today, uid } from '../core/util.js';
import { state } from '../core/store.js';
import { activities } from './activities.js';

export const SHOE_KINDS = {
  diario: { n: 'Entrenamiento diario', limit: 700 },
  ligeras: { n: 'Ligeras o de competición', limit: 450 },
  trail: { n: 'Trail', limit: 600 },
};
export const SHOE_WARN = 0.9;        // aviso previo al 90 % de la vida útil
export const SHOE_REMIND_KM = 100;   // si las sigue usando pasado el límite, recuerda cada 100 km

export function shoes() { return state.shoes || (state.shoes = []); }
export const activeShoes = () => shoes().filter(s => !s.retired);
export const shoeById = id => shoes().find(s => s.id === id) || null;

export function defaultShoe() {
  const a = activeShoes();
  return a.find(s => s.id === state.shoeDefault) || (a.length === 1 ? a[0] : null);
}

const gearOf = sh => sh && sh.stravaId && state.strava && state.strava.gear ? state.strava.gear[sh.stravaId] || null : null;

/** Par usado en una actividad de activities() (id, o null si no consta). */
export function shoeOfAct(a) {
  let v = null;
  if (a.run) {
    v = a.run.shoe || null;
    if (!v && a.run.gear) { const s = shoes().find(x => x.stravaId === a.run.gear); if (s) v = s.id; }
  } else if (a.session) v = a.session.log.shoe || null;
  else if (a.manual) v = a.manual.shoe || null;
  return v === 'none' ? null : v;
}

/** Kilómetros totales de un par. Con Strava, su total manda y se suman solo las carreras que Strava no le atribuye. */
export function shoeKm(sh, acts = activities()) {
  const g = gearOf(sh);
  let km = g ? g.km : (sh.startKm || 0);
  for (const a of acts) {
    if (shoeOfAct(a) !== sh.id) continue;
    if (g && a.run && a.run.gear === sh.stravaId) continue; // ya está en el total de Strava
    km += a.km || 0;
  }
  return km;
}

/** 0 = bien, 1 = cerca del límite, 2 = pasado el límite. */
export const shoeLevel = (sh, km) => km >= sh.limit ? 2 : km >= sh.limit * SHOE_WARN ? 1 : 0;

/** Avisos pendientes de ver, del más urgente al menos. */
export function shoeAlerts() {
  const acts = activities();
  return activeShoes().map(sh => {
    const km = shoeKm(sh, acts), level = shoeLevel(sh, km), ack = sh.ack || { level: 0, km: 0 };
    const show = level > ack.level || (level === 2 && km >= ack.km + SHOE_REMIND_KM);
    return show ? { sh, km, level } : null;
  }).filter(Boolean).sort((a, b) => b.level - a.level || b.km / b.sh.limit - a.km / a.sh.limit);
}

export function ackShoe(sh) {
  const km = shoeKm(sh);
  sh.ack = { level: shoeLevel(sh, km), km };
}

export function addShoe({ name, kind = 'diario', limit, startKm = 0, makeDefault }) {
  const sh = { id: uid(), name: String(name).trim().slice(0, 60), kind, limit: limit || SHOE_KINDS[kind].limit,
    startKm: Math.max(0, startKm || 0), added: today(), retired: null, stravaId: null, ack: null };
  const prev = defaultShoe();
  shoes().push(sh);
  state.shoeDefault = makeDefault || !prev ? sh.id : prev.id;
  sh.ack = { level: shoeLevel(sh, shoeKm(sh)), km: shoeKm(sh) }; // no avisar de algo que ya se sabía al darlas de alta
  return sh;
}

export function retireShoe(sh) {
  sh.retired = today();
  if (state.shoeDefault === sh.id) {
    const next = activeShoes().sort((a, b) => (b.added > a.added ? 1 : -1))[0];
    state.shoeDefault = next ? next.id : null;
  }
}

export function unretireShoe(sh) { sh.retired = null; if (!defaultShoe()) state.shoeDefault = sh.id; }

/** Borra un par y quita su asignación de todas las carreras. */
export function deleteShoe(sh) {
  state.shoes = shoes().filter(s => s !== sh);
  const clear = o => { if (o && o.shoe === sh.id) delete o.shoe; };
  (state.strava ? state.strava.runs : []).forEach(clear);
  (state.manual || []).forEach(clear);
  state.sessions.forEach(s => clear(s.log));
  if (state.shoeDefault === sh.id) { const a = activeShoes()[0]; state.shoeDefault = a ? a.id : null; }
}

/* ---------- Referencias a una carrera concreta (para elegir el par desde la interfaz) ---------- */
// 's:<id sesión>' · 'm:<id entreno manual>' · 'r:<id actividad de Strava>'
export function refOfSession(s) { return s.log && s.log.strava ? 'r:' + s.log.strava : 's:' + s.id; }

function targetOf(ref) {
  const [k, id] = [ref.slice(0, 1), ref.slice(2)];
  if (k === 'r') { const r = state.strava && state.strava.runs.find(x => String(x.id) === id); return r ? { o: r, run: r } : null; }
  if (k === 's') { const s = state.sessions.find(x => x.id === id); return s && s.log ? { o: s.log } : null; }
  if (k === 'm') { const m = (state.manual || []).find(x => x.id === id); return m ? { o: m } : null; }
  return null;
}

export function shoeOfRef(ref) {
  const t = targetOf(ref); if (!t) return null;
  if (t.run) return shoeOfAct({ run: t.run });
  return t.o.shoe && t.o.shoe !== 'none' ? t.o.shoe : null;
}

export function setShoeOfRef(ref, shoeId) {
  const t = targetOf(ref); if (!t) return false;
  t.o.shoe = shoeId || 'none';
  return true;
}

/* ---------- Strava ---------- */
/** Da de alta los pares que vienen de Strava y aplica las retiradas que se hagan allí. */
export function syncStravaShoes() {
  const g = state.strava && state.strava.gear; if (!g) return 0;
  let created = 0;
  for (const [gid, x] of Object.entries(g)) {
    let sh = shoes().find(s => s.stravaId === gid);
    if (!sh) {
      const first = state.strava.runs.find(r => r.gear === gid);
      sh = { id: uid(), name: x.name, kind: 'diario', limit: SHOE_KINDS.diario.limit, startKm: 0,
        added: first ? first.date : today(), retired: x.retired ? today() : null, stravaId: gid, ack: null };
      shoes().push(sh); created++; // si ya vienen gastadas, se avisa: el corredor puede no saberlo
    } else if (x.retired && !sh.retired) sh.retired = today();
  }
  if (!defaultShoe()) {
    const last = [...state.strava.runs].reverse().find(r => r.gear && shoes().some(s => s.stravaId === r.gear && !s.retired));
    if (last) state.shoeDefault = shoes().find(s => s.stravaId === last.gear).id;
  }
  return created;
}

/** Las carreras de Strava sin material en Strava pasan al par por defecto (solo desde el día de alta del par). */
export function autoAssignShoes() {
  const d = defaultShoe(); if (!d || !state.strava) return 0;
  let n = 0;
  for (const r of state.strava.runs) {
    if (r.shoe || r.gear || r.date < d.added) continue; // con material en Strava, manda Strava
    r.shoe = d.id; n++;
  }
  return n;
}
