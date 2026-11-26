/**
 * Ritmo suave según tu pulso: en cada rodaje se mira a qué ritmo ibas y con qué pulso, y se calcula
 * a qué ritmo te quedarías en lo alto de la Z2. Si es más lento que el ritmo suave del plan, manda el pulso.
 * Modelo: la velocidad sube casi en línea recta con la reserva de pulso (pulso − pulso en reposo).
 */
import { addDays, today } from '../core/util.js';
import { state } from '../core/store.js';
import { QUALITY } from './constants.js';
import { activities } from './activities.js';
import { gapFromElev } from './elevation.js';
import { hrBounds } from './workouts.js';

let memo = null;

export function z2Pace() {
  const b = hrBounds(2); if (!b || !b[1]) return null;
  const top = b[1] - 2, rest = (state.profile && state.profile.hrRest) || 60;
  const runs = state.strava ? state.strava.runs : [], td = today();
  const key = `${top}|${rest}|${td}|${runs.length}|${runs.reduce((a, r) => a + (r.hr || 0) + (r.indoor ? 1 : 0) + r.sec, 0)}|${(state.manual || []).length}|${state.sessions.filter(x => x.status === 'done').length}`;
  if (memo && memo.key === key) return memo.v;
  const from = addDays(td, -42), pts = [];
  activities().filter(a => a.date >= from && a.date <= td && a.hr && a.sec && a.km >= 3).forEach(a => {
    const r = a.run, ses = r && r.sessionId ? state.sessions.find(x => x.id === r.sessionId) : a.session;
    if ((ses && QUALITY.includes(ses.type)) || (r && (r.race || r.indoor)) || (a.manual && a.manual.type === 'race')) return;
    if (ses && ses.where === 'cinta') return;
    const segs = r ? (r.laps.length >= 3 ? r.laps : r.splits).filter(x => x.km >= 0.4 && x.sec) : [];
    if (segs.length >= 3) { // solo rodajes constantes (sin series ni cambios de ritmo)
      const pcs = segs.map(x => x.gap || x.sec / x.km), m = pcs.reduce((x, y) => x + y, 0) / pcs.length;
      if (Math.sqrt(pcs.reduce((x, y) => x + (y - m) ** 2, 0) / pcs.length) / m > 0.10) return;
    }
    if (a.hr < top - 18 || a.hr > top + 25) return; // demasiado lejos de la Z2 para extrapolar bien
    const pace = a.gap || gapFromElev(a.sec, a.km, a.elev); if (!pace || pace < 180 || pace > 720) return;
    pts.push({ v: (1000 / pace) * (top - rest) / (a.hr - rest), w: a.sec, over: a.hr > top + 2, pace, hr: a.hr });
  });
  let v = null;
  if (pts.length >= 3) {
    const s = [...pts].sort((a, b) => a.v - b.v), W = s.reduce((a, q) => a + q.w, 0);
    let acc = 0; for (const q of s) { acc += q.w; if (acc >= W / 2) { v = { pace: 1000 / q.v, n: pts.length, over: pts.filter(q => q.over).length, top: top + 2 }; break; } }
  }
  memo = { key, v };
  return v;
}

/**
 * Ritmo suave a usar: el del plan, o más lento si tu pulso dice que con ese ya sales de Z2.
 * Devuelve { lo, hi, hr: {pace, n, over, top}, capped } o null si no hace falta ajustar.
 */
export function easyByHR(E) {
  const z = z2Pace();
  if (!z || z.pace <= E.lo * 1.02) return null;
  const capped = z.pace > E.hi * 1.3, lo = Math.min(z.pace, E.hi * 1.3);
  return { lo, hi: Math.max(E.hi, lo * 1.10), hr: z, capped };
}
