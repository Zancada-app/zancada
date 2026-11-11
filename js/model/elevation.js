/**
 * Desnivel: penalización por pendiente y ritmo equivalente en llano (GAP).
 */
import { GOALS } from './constants.js';

/* ---------- Desnivel ---------- */
export const ELEV=[[2,'Llana'],[8,'Ondulada'],[15,'Con cuestas'],[30,'De montaña']];

// fracción de tiempo extra de un recorrido con subidas y bajadas: se pierde ~3,3 % por cada 1 % de pendiente al subir y se recupera ~55 % al bajar
export const elevPen=pr=>pr&&pr.raceElev&&GOALS[pr.goal]&&GOALS[pr.goal].dist?0.001485*pr.raceElev:0;

export const gapFromElev=(sec,km,elev)=>km?(sec/km)/(1+0.001485*(elev||0)/km):null;

export const elevName=v=>(ELEV.find(x=>x[0]===+v)||ELEV[0])[1];
