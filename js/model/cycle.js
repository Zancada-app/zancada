/**
 * Ciclo menstrual: fase de cada día, previsión de la próxima regla, colocación de las sesiones
 * duras fuera de los días más delicados, síntomas en el chequeo y aprendizaje del patrón propio.
 *
 * state.cycle = {
 *   on, mode           'natural' | 'pildora' (píldora, anillo o parche) | 'otro' (sin ciclo regular)
 *   starts: [fecha]    primer día de cada regla registrada (ordenadas)
 *   ends: {inicio: fin} último día de regla, si se ha marcado
 *   len, plen          duración habitual del ciclo y de la regla (si aún no hay historial)
 *   adapt              colocar las sesiones duras según la fase (sí por defecto)
 *   ok: {fecha: true}  «me encuentro bien»: ese día no se ajusta nada
 *   seen: [clave]      ajustes ya anunciados (para no repetir avisos)
 * }
 *
 * La evidencia científica muestra efectos pequeños y muy distintos en cada mujer, así que el
 * ajuste por defecto es prudente (solo los 2 primeros días de regla y los 2 previos) y lo demás
 * se decide por cómo se encuentra ella: síntomas del chequeo y su propio patrón aprendido.
 */
import { DAYS_L, addDays, clamp, daysBetween, dow, fdShort, monday, today } from '../core/util.js';
import { KEY_TYPES, QUALITY, TYPES } from './constants.js';
import { state } from '../core/store.js';
import { addEvent } from './adapt.js';

export const CYCLE_MODES = {
  natural: 'Ciclo natural',
  pildora: 'Píldora, anillo o parche',
  otro: 'Sin ciclo regular',
};

export const PHASES = {
  regla: { n: 'Regla', c: '#D94A3A',
    e: 'Estrógenos y progesterona están en su punto más bajo. Los primeros días puede haber cansancio o dolor; si te encuentras bien, puedes entrenar con normalidad.' },
  folicular: { n: 'Fase folicular', c: '#E59A3B',
    e: 'Los estrógenos suben. Muchas mujeres notan más energía y mejor recuperación: buen momento para las series y la fuerza.' },
  ovulacion: { n: 'Ovulación', c: '#2F9E6E',
    e: 'Pico de estrógenos y buena energía. Algunos estudios ven más laxitud en los ligamentos: calienta bien y cuida la técnica en los cambios de ritmo.' },
  lutea: { n: 'Fase lútea', c: '#5B6CD6',
    e: 'Sube la progesterona y la temperatura corporal unas décimas: el pulso puede ir 3–5 ppm más alto al mismo ritmo y el calor pesa más. Hidrátate y guíate también por sensaciones.' },
  premenstrual: { n: 'Premenstrual', c: '#8A5BC9',
    e: 'Bajan las hormonas. Puede haber hinchazón, peor sueño o menos energía. Mejor sesiones controladas; si te notas bien, adelante.' },
  activa: { n: 'Toma activa', c: '#5B6CD6',
    e: 'Con la píldora, el anillo o el parche las hormonas se mantienen estables: el plan sigue con normalidad.' },
  descanso: { n: 'Semana de descanso', c: '#D94A3A',
    e: 'En los días de descanso puede haber sangrado y algo de cansancio. Ajusta según cómo te encuentres.' },
};

export const cycle = () => state.cycle || null;
export const cycleOn = () => !!(state.cycle && state.cycle.on);

const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Duración del ciclo: la mediana de los últimos ciclos registrados (21–45 días) o la indicada. */
export function cycleLen() {
  const c = cycle(); if (!c) return 28;
  if (c.mode === 'pildora') return 28;
  const st = c.starts, gaps = [];
  for (let i = Math.max(1, st.length - 6); i < st.length; i++) { const g = daysBetween(st[i - 1], st[i]); if (g >= 18 && g <= 45) gaps.push(g); }
  return gaps.length >= 2 ? Math.round(median(gaps)) : c.len || 28;
}

export function periodLen() {
  const c = cycle(); if (!c) return 5;
  const l = Object.entries(c.ends || {}).map(([a, b]) => daysBetween(a, b) + 1).filter(x => x >= 1 && x <= 10).slice(-6);
  return l.length >= 2 ? Math.round(median(l)) : c.plen || 5;
}

/** Inicio de la regla que corresponde a una fecha (la última antes o ese día). */
function startFor(date) {
  const st = (cycle() || {}).starts || [];
  let s = null; for (const x of st) { if (x <= date) s = x; else break; }
  return s;
}

/** Fase de un día. Para fechas futuras proyecta los ciclos previstos. */
export function phaseOf(date) {
  const c = cycle(); if (!c || !c.on || c.mode === 'otro') return null;
  let s = startFor(date); if (!s) return null;
  const L = cycleLen(), P = periodLen();
  const st = c.starts, idx = st.indexOf(s), next = st[idx + 1];
  // la regla siguiente ya registrada marca el final real de ese ciclo
  const len = next ? daysBetween(s, next) : L;
  let day = daysBetween(s, date) + 1, projected = false;
  const td = today();
  if (!next && date > td && day > len) { // previsión: ciclos siguientes
    if (daysBetween(s, td) + 1 > len + 1) { // ya va con retraso: no se puede prever más allá
      if (day > len + 10) return null;
      return { day, len, phase: 'premenstrual', start: s, projected: true, late: true, inPeriod: false };
    }
    const k = Math.floor((day - 1) / L); s = addDays(s, k * L); day = day - k * L; projected = true;
  }
  const late = !next && !projected && day > len + 1; // el día len+1 es el previsto para la siguiente
  let ph;
  if (c.mode === 'pildora') ph = day <= 21 ? 'activa' : 'descanso';
  else {
    const end = c.ends && c.ends[s] ? daysBetween(s, c.ends[s]) + 1 : P;
    const ov = len - 14;
    ph = day <= end ? 'regla' : day < ov - 1 ? 'folicular' : day <= ov + 1 ? 'ovulacion' : day <= len - 5 ? 'lutea' : 'premenstrual';
    if (late) ph = 'premenstrual';
  }
  return { day, len, phase: ph, start: s, projected, late, inPeriod: ph === 'regla' || ph === 'descanso' };
}

/** Próxima regla prevista (o null). */
export function nextPeriod(date = today()) {
  const c = cycle(); if (!c || !c.on || c.mode === 'otro') return null;
  const s = startFor(date); if (!s) return null;
  let n = addDays(s, cycleLen());
  while (n <= date) n = addDays(n, cycleLen());
  return n;
}

/* ---------- registro ---------- */
export function setupCycle({ mode, last, len, plen, adapt }) {
  const c = state.cycle || (state.cycle = { starts: [], ends: {}, ok: {}, seen: [] });
  c.on = true; c.mode = mode || 'natural'; c.len = clamp(len || 28, 21, 45); c.plen = clamp(plen || 5, 2, 10);
  c.adapt = adapt !== false;
  if (last && !c.starts.includes(last)) { c.starts.push(last); c.starts.sort(); }
  return c;
}

export function addPeriodStart(date) {
  const c = cycle(); if (!c) return false;
  // dos inicios a menos de 10 días son la misma regla: se queda el más temprano
  const near = c.starts.find(x => Math.abs(daysBetween(x, date)) < 10);
  if (near) { if (date < near) { c.starts = c.starts.map(x => x === near ? date : x); if (c.ends[near]) { c.ends[date] = c.ends[near]; delete c.ends[near]; } } else return false; }
  else c.starts.push(date);
  c.starts.sort();
  return true;
}

export function removePeriodStart(date) {
  const c = cycle(); if (!c) return;
  c.starts = c.starts.filter(x => x !== date); delete c.ends[date];
}

export function endPeriod(date) {
  const c = cycle(), s = startFor(date); if (!c || !s) return false;
  c.ends[s] = date; return true;
}

export function disableCycle(wipe) {
  if (wipe) { state.cycle = null; return; }
  if (state.cycle) state.cycle.on = false;
}

/* ---------- aprendizaje: cómo le sientan los entrenos en cada fase ---------- */
/** Esfuerzo percibido de más (o de menos) respecto a lo normal en ese tipo de sesión, por fase. */
export function cycleInsights() {
  const c = cycle(); if (!c || !c.on || c.mode === 'otro' || c.starts.length < 2) return null;
  const done = state.sessions.filter(s => s.status === 'done' && s.log && s.log.rpe && s.log.rpeSrc !== 'previsto' && s.date >= c.starts[0]);
  const byType = {};
  done.forEach(s => (byType[s.type] = byType[s.type] || []).push(s.log.rpe));
  const base = {}; Object.entries(byType).forEach(([t, a]) => { if (a.length >= 3) base[t] = median(a); });
  const ph = {};
  done.forEach(s => {
    if (base[s.type] == null) return;
    const p = phaseOf(s.date); if (!p || p.projected) return;
    const g = ph[p.phase] || (ph[p.phase] = { n: 0, sum: 0, cycles: new Set() });
    g.n++; g.sum += s.log.rpe - base[s.type]; g.cycles.add(p.start);
  });
  const all = Object.values(ph).reduce((a, g) => ({ n: a.n + g.n, sum: a.sum + g.sum }), { n: 0, sum: 0 });
  if (all.n < 6) return { ready: false, n: all.n };
  const mean = all.sum / all.n, out = {};
  Object.entries(ph).forEach(([k, g]) => {
    const ex = g.sum / g.n;
    out[k] = { n: g.n, ex, cycles: g.cycles.size, harder: g.n >= 4 && g.cycles.size >= 2 && ex >= 0.8 && ex - mean >= 0.6 };
  });
  return { ready: true, phases: out };
}

/** ¿Conviene evitar una sesión dura ese día? Por defecto: días 1–2 de regla y los 2 previos. */
export function sensitiveDay(date) {
  const c = cycle(); if (!c || !c.on || c.adapt === false) return null;
  const p = phaseOf(date); if (!p) return null;
  if (c.ok && c.ok[date]) return null;
  if (c.mode === 'pildora') return p.phase === 'descanso' && p.day <= 23 ? 'los primeros días de descanso de la píldora' : null;
  if (p.phase === 'regla' && p.day <= 2) return p.day === 1 ? 'el primer día de regla' : 'el segundo día de regla';
  if (p.phase === 'premenstrual' && p.day >= p.len - 1 && !p.late) return 'los días previos a la regla';
  const ins = cycleInsights();
  if (ins && ins.ready && ins.phases[p.phase] && ins.phases[p.phase].harder) return `tu ${PHASES[p.phase].n.toLowerCase()}, en la que sueles notar más los entrenos`;
  return null;
}

/* ---------- colocar las sesiones duras en los días buenos ---------- */
const HARD = s => QUALITY.includes(s.type) && s.type !== 'race';
const isKey = s => KEY_TYPES.includes(s.type) || s.type === 'race';

/** Intercambia, dentro de la misma semana, las sesiones duras que caen en días delicados con rodajes. */
export function cycleSchedule() {
  const c = cycle(); if (!c || !c.on || c.adapt === false || !state.plan || state.pause) return false;
  const td = today(), until = addDays(td, 13);
  let changed = false;
  const pend = () => state.sessions.filter(s => s.status === 'pending' && s.date >= td && s.date <= until);
  for (const q of pend()) {
    if (!HARD(q) || q.manual || q.mod) continue;
    const why = sensitiveDay(q.date); if (!why) continue;
    const wk = monday(q.date);
    const others = id => state.sessions.filter(x => x.status !== 'skipped' && x.id !== id && x.id !== q.id && isKey(x));
    const cand = pend().filter(e => e.type === 'easy' && !e.manual && !e.mod && monday(e.date) === wk && e.date !== q.date && !sensitiveDay(e.date))
      .filter(e => !others(e.id).some(x => Math.abs(daysBetween(x.date, e.date)) === 1))
      .sort((a, b) => Math.abs(daysBetween(a.date, q.date)) - Math.abs(daysBetween(b.date, q.date)));
    const e = cand[0], from = q.date;
    if (e) { q.date = e.date; e.date = from; q.cyc = { from, why }; e.cyc = { from: q.date, swap: true }; }
    else { // un día libre de esa semana, que no sea delicado ni quede pegado a otra sesión dura
      const keys = others(null);
      let free = null;
      for (let d = wk, i = 0; i < 7; i++, d = addDays(d, 1)) {
        if (d <= td || d === q.date || sensitiveDay(d) || state.sessions.some(x => x.date === d && x.status !== 'skipped')) continue;
        if (keys.some(x => Math.abs(daysBetween(x.date, d)) === 1)) continue;
        if (!free || Math.abs(daysBetween(d, from)) < Math.abs(daysBetween(free, from))) free = d;
      }
      if (!free) continue;
      q.date = free; q.cyc = { from, why };
    }
    changed = true;
    const key = from + ':' + q.type;
    c.seen = (c.seen || []).filter(k => k.slice(0, 10) >= addDays(td, -30));
    if (!c.seen.includes(key)) {
      c.seen.push(key);
      addEvent('info', `${TYPES[q.type].n} pasada del ${DAYS_L[dow(from)]} ${fdShort(from)} al ${DAYS_L[dow(q.date)]}: el ${DAYS_L[dow(from)]} es ${why}${phaseOf(from) && phaseOf(from).projected ? ' (previsto)' : ''}.`);
    }
  }
  if (changed) state.sessions.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  return changed;
}

/** Nota para una sesión según la fase de ese día (o null). */
export function cycleNote(s) {
  if (!cycleOn() || s.status !== 'pending') return null;
  if (s.cyc && !s.cyc.swap) return { k: 'moved', t: `La he puesto hoy en lugar del ${DAYS_L[dow(s.cyc.from)]} ${fdShort(s.cyc.from)}, que es ${s.cyc.why}.` };
  const p = phaseOf(s.date); if (!p) return null;
  const hard = HARD(s) || s.type === 'long';
  if (p.phase === 'regla' || p.phase === 'descanso') {
    if (p.day <= 2 && hard) return { k: 'soft', t: 'Coincide con tus primeros días de regla. Si te encuentras bien, hazla tal cual; si hay dolor o cansancio, usa «No estoy al 100 %» y la ajusto.' };
    return p.day <= 3 ? { k: 'info', t: 'Días de regla: si hay molestias, un calentamiento más largo y suave suele ayudar.' } : null;
  }
  if (p.phase === 'ovulacion' && hard) return { k: 'info', t: 'Ovulación: calienta 5 minutos más y cuida la técnica en los cambios de ritmo.' };
  if (p.phase === 'lutea' || p.phase === 'premenstrual') return { k: 'info', t: `${PHASES[p.phase].n}: el pulso puede ir unas pulsaciones más alto al mismo ritmo y el calor pesa más. Bebe más y guíate también por sensaciones.` };
  if (p.phase === 'folicular' && HARD(s)) return { k: 'good', t: 'Fase folicular: suele ser un buen momento para apretar en las series.' };
  return null;
}

/** ¿Hoy toca preguntar por síntomas en el chequeo? */
export function askSymptoms(date = today()) {
  const c = cycle(); if (!c || !c.on) return false;
  if (c.mode === 'otro') return true;
  const p = phaseOf(date); return !!p && (p.inPeriod || p.phase === 'premenstrual');
}

/** Mensaje para un retraso o si hace mucho que no se registra la regla. */
export function cycleLateness(date = today()) {
  const p = phaseOf(date); if (!p || !p.late) return null;
  return p.day - p.len - 1;
}

export const cycleSnapshot = () => ({ p: phaseOf(today()), next: nextPeriod(), len: cycleLen(), plen: periodLen() });
