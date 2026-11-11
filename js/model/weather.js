/**
 * Calor: ajuste de ritmo por temperatura y punto de rocío, y lectura de la previsión guardada.
 */
import { state } from '../core/store.js';

/* =========================================================
   Calor: previsión de Open-Meteo (gratuita y sin cuenta), solo si eliges una ciudad
   ========================================================= */
// regla temperatura + punto de rocío (°F): cuánto más lento hay que ir para el mismo esfuerzo
export function heatAdj(t,td){
  const s=(t*9/5+32)+(td*9/5+32);
  const tab=[[110,0],[120,0.0075],[130,0.015],[140,0.025],[150,0.0375],[160,0.0525],[170,0.07],[180,0.09]];
  for(const [lim,v] of tab) if(s<=lim) return v;
  return 0.12;
}

export function wxFor(date){const w=state.wx;return w&&w.days?w.days[date]||null:null;}
