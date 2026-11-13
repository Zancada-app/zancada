/**
 * Entreno guiado por voz: convierte una sesión en pasos (calentamiento, series, recuperaciones…),
 * decide qué decir y cuándo, y comprueba el ritmo. Lógica pura, sin GPS ni audio: se puede probar
 * en Node. La pantalla y los servicios (ui/guide.js, services/gps.js, services/voice.js) la usan.
 */
import { describe } from './workouts.js';

/* ---------- textos para la voz ---------- */
const N = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
/** Ritmo hablado: 330 → «5 30», 365 → «6 cero 5». */
export function sayPace(sec) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  if (s === 60) return `${m + 1} en punto`;
  return s === 0 ? `${m} en punto` : s < 10 ? `${m} cero ${N[s]}` : `${m} ${s}`;
}
export function sayDist(km) {
  if (km < 1) return `${Math.round(km * 1000 / 10) * 10} metros`;
  const r = Math.round(km * 10) / 10;
  return r === 1 ? '1 kilómetro' : `${String(r).replace('.', ',')} kilómetros`;
}
export function sayTime(sec) {
  sec = Math.round(sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  if (!m) return `${s} segundos`;
  const ms = m === 1 ? '1 minuto' : `${m} minutos`;
  return s ? `${ms} ${s}` : ms;
}
export const kmh = pace => Math.round(3600 / pace * 10) / 10;
const sayKmh = pace => `${String(kmh(pace)).replace('.', ',')} kilómetros por hora`;

/* ---------- pasos ---------- */
const KIND = { cal: 'warm', cool: 'cool', strides: 'strides', main: 'main' };
const ORD = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena', 'décima', 'undécima', 'duodécima'];

/**
 * Pasos de una sesión. mode: 'gps' (por distancia y ritmo) o 'cinta' (todo por tiempo, con velocidad).
 * Cada paso: { kind, label, phase, rep, reps, dist (km) | dur (s), lo, hi, text, rec, easy }
 */
export function buildSteps(s, mode = 'gps') {
  const d = describe(s), out = [];
  const easyPace = d.blocks.find(b => b.k === 'cal' || b.k === 'cool') || d.blocks[0];
  for (const b of d.blocks) {
    const kind = KIND[b.k] || 'main', reps = b.reps || 1;
    for (let i = 0; i < reps; i++) {
      out.push({ kind, phase: b.t, label: reps > 1 ? `${b.t} ${i + 1} de ${reps}` : b.t, rep: reps > 1 ? i + 1 : 0, reps,
        dist: b.dist || null, dur: b.dur || null, lo: b.lo || null, hi: b.hi || null, text: b.text || '',
        hillPace: b.t === 'Cuestas' && easyPace.lo ? easyPace.lo * 0.95 : null,
        easy: kind === 'warm' || kind === 'cool' || b.t === 'Correr y andar' || (kind === 'main' && reps === 1 && b.lo && b.lo >= (easyPace.lo || 0) * 0.93) });
      if (reps > 1 && i < reps - 1) {
        const walk = /andand/.test(b.rec || '');
        out.push({ kind: 'rec', phase: b.t, label: walk ? 'Andar' : 'Recuperación', rep: i + 1, reps,
          dist: b.recDist || null, dur: b.recDur || (b.recDist ? null : kind === 'strides' ? 60 : 90),
          lo: null, hi: null, text: b.rec || '', walk, pace: walk ? 655 : easyPace.lo && easyPace.hi ? (easyPace.lo + easyPace.hi) / 2 : null });
      }
    }
  }
  if (mode === 'cinta') out.forEach(st => {
    // en cinta todo va por tiempo: la distancia se pasa a tiempo al ritmo previsto
    if (st.dist && !st.dur) { const p = st.lo && st.hi ? (st.lo + st.hi) / 2 : st.pace || 400; st.dur = Math.round(st.dist * p); st.distPlan = st.dist; st.dist = null; }
  });
  return out.filter(st => (st.dist || 0) > 0 || (st.dur || 0) > 0);
}

/** Ritmo objetivo medio de un paso. */
export const midPace = st => st.lo && st.hi ? (st.lo + st.hi) / 2 : null;

/** Qué decir al empezar un paso. */
export function stepIntro(steps, i, mode) {
  const st = steps[i], prev = steps[i - 1], parts = [];
  if (prev && prev.phase !== st.phase && prev.kind !== 'rec') parts.push(prev.kind === 'warm' ? 'Calentamiento terminado.' : `Bloque de ${prev.phase.toLowerCase()} terminado.`);
  const amount = st.dist ? sayDist(st.dist) : sayTime(st.dur);
  const pace = midPace(st);
  if (st.kind === 'rec') {
    parts.push(st.walk ? `Anda ${amount}.` : `Recupera: ${amount} ${st.dist ? 'trotando suave' : 'suave'}.`);
    if (mode === 'cinta') parts.push(`${st.phase === 'Cuestas' ? 'Quita la inclinación y baja' : 'Baja'} la cinta a ${sayKmh(st.pace || 400)}.`);
  }
  else {
    const first = st.rep === 1 && st.reps > 1;
    if (first && st.kind === 'main') parts.push(`Empezamos ${st.phase.toLowerCase()}.`);
    const name = st.reps > 1 ? `${st.kind === 'strides' ? 'Recta' : st.phase === 'Correr y andar' ? 'Corre' : (ORD[st.rep - 1] ? ORD[st.rep - 1][0].toUpperCase() + ORD[st.rep - 1].slice(1) + (st.phase === 'Cuestas' ? ' cuesta' : ' repetición') : `Repetición ${st.rep}`)}${st.reps > 1 && st.rep === st.reps ? ', la última' : ''}` : st.phase;
    let t = `${name}: ${amount}`;
    if (pace && st.kind !== 'strides') t += mode === 'cinta' ? `. Pon la cinta a ${sayKmh(pace)}` : ` a ${sayPace(pace)} el kilómetro`;
    else if (st.kind === 'strides') t += ', rápido pero relajado';
    else if (st.phase === 'Cuestas') t += mode === 'cinta' ? `. Sube la inclinación al 6 por ciento y la cinta a ${sayKmh(st.hillPace || 420)}` : ', subiendo con energía';
    parts.push(t + '.');
    if (st.kind !== 'strides' && st.text && st.reps <= 1 && st.text.length < 70) parts.push(st.text);
  }
  if (i === 0) parts.unshift('Empezamos.');
  return parts.join(' ');
}

/* ---------- avisos de ritmo ---------- */
/** Tolerancias (s/km) a cada lado del rango: más amplias en los suaves y lentos solo si es mucho. */
export function tolerance(st) {
  return st.easy ? { fast: 10, slow: 25 } : { fast: 5, slow: 8 };
}

/**
 * Decide si toca avisar del ritmo. g = { pace (s/km, suavizado), outSince, lastAlert, now, stepT (s en el paso), count (avisos ya dados en la parte) }.
 * Devuelve { say, outSince, lastAlert, count }.
 */
export function paceCheck(st, g) {
  const res = { say: null, outSince: g.outSince, lastAlert: g.lastAlert, count: g.count || 0 };
  if (!st.lo || !st.hi || st.kind === 'rec' || st.kind === 'strides' || !g.pace) { res.outSince = null; return res; }
  if (g.stepT < 30) return res; // el GPS necesita unos segundos para estabilizarse
  if ((st.dur && st.dur < 45) || (st.dist && st.dist < 0.2)) return res; // demasiado corto para corregir
  const tol = tolerance(st), fast = g.pace < st.lo - tol.fast, slow = g.pace > st.hi + tol.slow;
  if (!fast && !slow) { res.outSince = null; return res; }
  const kind = fast ? 'fast' : 'slow';
  if (!g.outSince || g.outSince.kind !== kind) { res.outSince = { kind, t: g.now }; return res; }
  // tras dos avisos en la misma parte, espacia más (2 min) y como mucho 4 por parte: que no agobie
  const n = g.count || 0, gap = n < 2 ? 45 : 120;
  if (n < 4 && g.now - g.outSince.t >= 20 && (!g.lastAlert || g.now - g.lastAlert >= gap)) {
    res.say = fast ? `Vas rápido, a ${sayPace(g.pace)}. Baja a ${sayPace(midPace(st))}.` : `Vas lento, a ${sayPace(g.pace)}. Sube a ${sayPace(midPace(st))}.`;
    if (st.easy && fast) res.say = `Vas rápido para ser suave, a ${sayPace(g.pace)}. Tranquilo, a ${sayPace(midPace(st))}.`;
    res.lastAlert = g.now; res.outSince = { kind, t: g.now }; res.count = n + 1;
  }
  return res;
}

/**
 * Avisos dentro de un paso según lo hecho (por distancia o tiempo). marks guarda lo ya dicho.
 * p = { dist (km hechos en el paso), t (s en el paso), totalKm, lastSplit (s del último km) }
 */
export function stepCues(st, p, marks) {
  const out = [];
  const isWork = st.kind === 'main' && st.reps > 1;
  if (st.dist) {
    const left = st.dist - p.dist;
    if (isWork && st.dist >= 0.3 && !marks.half && p.dist >= st.dist / 2) { marks.half = 1; out.push('Mitad.'); }
    if (st.kind !== 'rec' && st.dist >= 0.4 && !marks.last100 && left <= 0.1 && left > 0) { marks.last100 = 1; out.push('Últimos 100 metros.'); }
    // parciales de cada kilómetro en los tramos largos y continuos
    if (st.dist >= 2 && st.reps <= 1) {
      const k = Math.floor(p.dist + 1e-6);
      if (k >= 1 && k > (marks.km || 0) && left > 0.3) { marks.km = k; out.push(`Kilómetro ${k}${p.lastSplit ? `, a ${sayPace(p.lastSplit)}` : ''}.`); }
    }
  } else if (st.dur) {
    const left = st.dur - p.t;
    if (isWork && st.dur >= 60 && !marks.half && p.t >= st.dur / 2) { marks.half = 1; out.push('Mitad.'); }
    if (st.dur >= 30 && !marks.ten && left <= 10 && left > 0) { marks.ten = 1; out.push(st.kind === 'rec' ? 'Prepárate.' : '10 segundos.'); }
    if (st.dur >= 600 && st.reps <= 1) { const m = Math.floor(p.t / 300); if (m >= 1 && m > (marks.five || 0) && left > 60) { marks.five = m; out.push(`${m * 5} minutos.`); } }
  }
  return out;
}

/** ¿Paso terminado? */
export const stepDone = (st, p) => st.dist ? p.dist >= st.dist - 0.003 : p.t >= st.dur;

/** Resumen hablado al final. */
export function finishText(km, sec) {
  return `Entrenamiento terminado. ${km >= 0.2 ? `${sayDist(km)} en ${sayTime(sec)}.` : ''} ¡Buen trabajo!`;
}
