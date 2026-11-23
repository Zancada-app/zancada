/**
 * Sesiones en cinta: misma sesión, adaptada. Ritmos pasados a velocidad (km/h), inclinación del 1 %
 * para compensar que no hay viento, cuestas con inclinación, rectas adaptadas a lo que tarda la cinta
 * en acelerar y consejos propios de interior.
 */
import { describe } from './workouts.js';

export const CINTA_INCL = 1;            // % de inclinación base (equivale a correr fuera en llano)
export const HILL_INCL = [5, 8];        // % para las cuestas
export const WALK_KMH = 5.5;

export const kmhOf = pace => Math.round(3600 / pace * 10) / 10;
export const fKmh = v => String(v).replace('.', ',');
/** Rango de velocidad para un rango de ritmos (el ritmo más lento es la velocidad más baja). */
export const speedR = (lo, hi) => { const a = kmhOf(hi || lo), b = kmhOf(lo); return a === b ? `${fKmh(a)} km/h` : `${fKmh(a)}–${fKmh(b)} km/h`; };

export const isCinta = s => !!s && s.where === 'cinta';
/** ¿Tiene sentido ofrecer la cinta? La carrera es fuera. */
export const cintaAllowed = s => !!s && s.type !== 'race';

/**
 * La sesión descrita para cinta: { ...describe(s), blocks con { speed, incl, recIncl }, tips }.
 */
export function describeCinta(s) {
  const d = describe(s);
  const easy = d.blocks.find(b => b.k === 'cal' || b.k === 'cool') || d.blocks.find(b => b.lo) || {};
  const easyMid = easy.lo && easy.hi ? (easy.lo + easy.hi) / 2 : null;
  const blocks = d.blocks.map(b => {
    const n = Object.assign({}, b);
    if (b.t === 'Cuestas') {
      n.incl = `${HILL_INCL[0]}–${HILL_INCL[1]} %`;
      n.speed = easyMid ? `${fKmh(kmhOf(easyMid * 1.08))}–${fKmh(kmhOf(easyMid))} km/h` : null;
      n.text = `Sube la inclinación al ${HILL_INCL[0]}–${HILL_INCL[1]} % y corre con esfuerzo fuerte pero controlado; en la recuperación, baja al ${CINTA_INCL} % y trota o anda.`;
      n.rec = b.rec ? `${/andand/i.test(b.rec) ? 'andando' : 'trotando'} con la cinta al ${CINTA_INCL} %` : b.rec;
    } else if (b.k === 'strides') {
      // las cintas tardan unos segundos en acelerar: rectas por tiempo, algo más largas
      n.dist = null; n.dur = 20; n.incl = `${CINTA_INCL} %`;
      n.speed = b.lo ? speedR(b.lo, b.hi) : null;
      n.text = 'Sube la velocidad poco a poco, mantén unos 10 segundos rápido y relajado, y baja. Si tu cinta tarda mucho, apóyate en los laterales al cambiar.';
      n.rec = '40 s suaves';
    } else if (b.lo) {
      n.speed = speedR(b.lo, b.hi); n.incl = `${CINTA_INCL} %`;
    }
    if (b.t !== 'Cuestas' && b.text && /cuesta|pendiente|terreno|llano/i.test(b.text)) n.text = s.type === 'cuestas' && b.k === 'cal' ? 'Los últimos minutos, sube la inclinación poco a poco hasta el 3 % para preparar las cuestas.' : '';
    if (b.rec && b.k === 'main' && b.reps > 1 && b.t !== 'Cuestas') n.recSpeed = /andand/.test(b.rec) ? `${fKmh(WALK_KMH)} km/h` : easyMid ? `${fKmh(kmhOf(easyMid))} km/h` : null;
    return n;
  });
  // fuera los consejos que solo tienen sentido en la calle
  const outdoor = /terreno|llano|circuito|pista|cuesta de|busca|viento|sombra|tráfico|semáforo|asfalto|tierra|lleva agua/i;
  const tips = d.tips.filter(t => !outdoor.test(t));
  tips.unshift(`Pon la cinta al ${CINTA_INCL} % de inclinación: compensa que en interior no hay viento ni terreno.`);
  if (blocks.some(b => b.k === 'main' && b.reps > 1)) tips.push('Cambia la velocidad un par de segundos antes de empezar cada repetición: las cintas tardan en acelerar.');
  if (s.type === 'long' || (d.dur || 0) >= 75) tips.push('En cinta se hace largo: divídela en bloques de 20 minutos y cambia la inclinación entre el 0 y el 2 % unos minutos para no cargar siempre los mismos músculos.');
  if (s.type === 'test') tips.push('El test en cinta es menos fiable que en la calle; si puedes, hazlo fuera. Si no, mantén la inclinación al 1 % todo el rato.');
  tips.push('Cada cinta mide un poco distinto: si el ritmo te parece mucho más duro o más fácil de lo normal, guíate por las sensaciones.');
  tips.push('Ventilador y agua a mano: en interior se suda más.');
  return Object.assign({}, d, { blocks, tips, cinta: true });
}

/** ¿Una actividad de Strava se hizo en interior (cinta)? */
export const isIndoorRun = a => !!(a && (a.trainer || a.sport_type === 'VirtualRun' || (!a.manual && Array.isArray(a.start_latlng) && !a.start_latlng.length && a.distance > 0)));
