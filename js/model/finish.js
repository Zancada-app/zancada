/**
 * Objetivo «terminarla» y primera media maratón o maratón: progresión de la tirada larga hasta la
 * distancia que da seguridad para acabar, viabilidad según las semanas disponibles, previsión de
 * tiempo prudente y consejos para el día de la carrera.
 */
import { addDays, clamp, daysBetween, today } from '../core/util.js';
import { GOALS, RW } from './constants.js';
import { state } from '../core/store.js';
import { predictToday } from './load.js';
import { elevPen } from './elevation.js';
import { activities } from './activities.js';
import { adherence } from './adapt.js';

/* Tirada larga máxima recomendada para acabar con garantías: por distancia y como mucho un tiempo
   (más allá de ~3 h 30 corriendo, el desgaste supera lo que aporta). */
export const LONG_PEAK = {
  '10k': { km: 12, maxMin: 100 },
  '21k': { km: 18, maxMin: 150 },
  '42k': { km: 32, maxMin: 210 },
};
// aumento razonable de la tirada larga por semana (km) y factor por las semanas de descarga
const STEP = { '10k': 1, '21k': 1.5, '42k': 2 }, DOWN = 1.33;

const EASY = 1.32;      // ritmo de la tirada respecto al de 5 km

/** ¿El objetivo es terminar (sin marca)? */
export const isFinish = pr => !!(pr && GOALS[pr.goal] && GOALS[pr.goal].dist && !pr.targetTime);
/** ¿Hace falta controlar la progresión de la tirada larga? Para terminar o si es la primera vez. */
export function needsLongPlan(pr) {
  if (!pr || !LONG_PEAK[pr.goal]) return false;
  if (pr.goal === '10k') return !!pr.first && pr.level === 'nuevo' && isFinish(pr);
  return isFinish(pr) || !!pr.first;
}

/** Tirada más larga reciente (últimas 4 semanas); sin datos, se estima con los km semanales. */
export function currentLong(pr) {
  const td = today();
  const acts = (state && state.sessions ? activities() : []).filter(a => a.date >= addDays(td, -28) && a.date <= td);
  const real = Math.max(0, ...acts.map(a => a.km || 0));
  const est = (pr.weeklyKm || 0) * 0.4;
  return clamp(Math.max(real, est, pr.level === 'nuevo' ? 3 : 5), 3, 40);
}

/** Distancia máxima de la tirada larga del plan, según tu ritmo (tope de tiempo). */
export function longPeakKm(pr, p) {
  const L = LONG_PEAK[pr.goal]; if (!L) return null;
  return Math.min(L.km, Math.max(L.km * 0.7, L.maxMin * 60 / (p * EASY)));
}

/** Semanas de correr/andar al principio si se empieza de cero (como en createPlan). */
export const rwWeeksFor = (pr, build) => pr.level === 'nuevo' && (pr.weeklyKm || 0) < 10 ? Math.min(RW.length - 2, build) : 0;

/** Tirada larga semana a semana (km) para una curva de plan (null en las semanas de correr/andar). */
export function longPlan(pr, curve, p, L0) {
  const peak = longPeakKm(pr, p); if (!peak) return null;
  const b = curve.filter(c => c.phase !== 'puesta a punto').length, rw = curve.rwWeeks || 0, step = STEP[pr.goal];
  const out = [];
  if (rw) L0 = Math.max(L0, 5); // al acabar el correr/andar ya se aguantan unos 30 minutos seguidos
  let prev = L0;
  for (let i = 0; i < b; i++) {
    if (i < rw) { out.push(null); continue; }
    // sube poco a poco hasta el máximo en la última semana de construcción; las de descarga, un 25 % menos
    if (curve[i].down) { out.push(prev * 0.75); continue; }
    prev = Math.min(prev + step, Math.max(prev, L0 + (peak - L0) * (i + 1 - rw) / (b - rw)), peak);
    out.push(prev);
  }
  [0.65, 0.5, 0.4].slice(0, curve.length - b).forEach(f => out.push(prev * f)); // puesta a punto
  return out.map(x => x == null ? null : Math.round(x * 2) / 2);
}

/** ¿Da tiempo a prepararla para terminarla? */
export function finishEval(pr, p, nWeeks, L0 = currentLong(pr)) {
  if (!needsLongPlan(pr)) return null;
  const g = GOALS[pr.goal], peak = longPeakKm(pr, p), taper = g.taper;
  const build = Math.max(1, nWeeks - taper), rw = rwWeeksFor(pr, build), step = STEP[pr.goal];
  if (rw) L0 = Math.max(L0, 5);
  const need = rw + Math.ceil(Math.max(0, peak - L0) / step * DOWN) + 1; // con las semanas de descarga
  const reach = Math.min(peak, L0 + step * Math.max(0, build - rw) / DOWN);
  const status = build >= need + 2 ? 'holgado' : build >= need ? 'justo' : reach >= peak * 0.8 ? 'corto' : 'insuficiente';
  const pred = finishTime(pr, p);
  return { L0, peak, reach, build, need, needWeeks: need + taper, status, pred, rw, runWalk: runWalkAdvised(pr, pred) };
}

/** Tiempo previsto, con margen de prudencia para una primera vez o para terminar. */
export function finishTime(pr, p) {
  const g = GOALS[pr.goal];
  return predictToday(p, g.dist) * (1 + elevPen(pr)) * (pr.first || isFinish(pr) ? 1.03 : 1);
}

/** Correr y andar el día de la carrera: recomendable si va a ser muy larga. */
export function runWalkAdvised(pr, T) {
  return (pr.goal === '42k' && T > 5 * 3600) || (pr.goal === '21k' && T > 2.75 * 3600);
}

/** Datos para la tarjeta del objetivo «terminar». */
export function finishInfo() {
  const pr = state.profile, pl = state.plan;
  if (!pr || !pl || !needsLongPlan(pr) || !pl.longs) return null;
  const g = GOALS[pr.goal], td = today(), p = state.fitness.p;
  const since = pl.created;
  const done = activities().filter(a => a.date >= addDays(since, -28) && a.date <= td);
  const longest = Math.max(pl.long0 || 0, ...done.map(a => a.km || 0));
  const peak = Math.max(...pl.longs);
  const wk = clamp(Math.floor(daysBetween(pl.start, td) / 7), 0, pl.longs.length - 1);
  const expected = Math.max(pl.long0 || 0, ...pl.longs.slice(0, wk)); // lo que debería llevar hecho
  const ad = adherence(28);
  const behind = longest < expected * 0.85;
  const prob = longest >= peak * 0.9 ? 'alta' : behind && ad.total >= 3 && ad.ratio < 0.7 ? 'baja' : behind ? 'media' : 'alta';
  const T = finishTime(pr, p);
  return { g, longest, peak, expected, prog: clamp(longest / peak, 0, 1), progExp: clamp(expected / peak, 0, 1), T, pace: T / g.dist,
    track: longest >= peak * 0.95 ? 'preparada' : behind ? 'por detrás' : 'en camino', prob, runWalk: runWalkAdvised(pr, T) };
}
