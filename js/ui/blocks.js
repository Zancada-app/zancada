/**
 * Pinta los bloques de una sesión (calentamiento, parte principal, vuelta a la calma).
 */
import { esc, fm } from '../core/util.js';
import { hrText, paceR } from '../model/workouts.js';

export function blocksHTML(d){
  return `<ol class="blocks">${d.blocks.map(b=>{
    const len=b.dist?fm(b.dist):b.dur?(b.dur>=60?`${Math.round(b.dur/60)} min`:`${b.dur} s`):'';
    return `<li class="blk ${b.k}"><div class="row between" style="align-items:baseline"><span class="bt">${esc(b.t)}</span><span class="bv num">${b.reps>1?`${b.reps} × `:''}${len}</span></div>
      <div class="bm num">${d.cinta&&b.speed?`<span><b>${b.speed}</b> · ${b.incl}</span><span class="muted">${b.lo?`(${paceR(b.lo,b.hi)} /km)`:''}</span>`:d.cinta&&b.incl?`<span><b>Inclinación ${b.incl}</b></span>`:b.lo?`<span>${paceR(b.lo,b.hi)} /km</span>`:''}${b.z?`<span>${hrText(b.z[0],b.z[1])}</span>`:''}${b.rec?`<span>rec. ${esc(b.rec)}${d.cinta&&b.recSpeed?` · ${b.recSpeed}`:''}</span>`:''}</div>
      ${b.text?`<div class="small muted">${esc(b.text)}</div>`:''}</li>`;}).join('')}</ol>`;
}
