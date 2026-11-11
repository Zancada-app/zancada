/**
 * Hoja con la rutina de fuerza y fila del día.
 */
import { DAYS, dow, fdLong, pd } from '../core/util.js';
import { state } from '../core/store.js';
import { MOBILITY, STRENGTH, strengthSets } from '../model/strength.js';
import { openSheet } from './router.js';

export function openStrength(date,key){
  const R=STRENGTH[key],sets=strengthSets(),done=(state.strengthDone||{})[date];
  const taper=sets===1;
  openSheet(`<div class="stack"><span class="eyebrow">${fdLong(date)}</span><h2>${R.n} · ${sets===1?'10':sets===2?'20':'25'} min</h2>
    <p class="muted">${sets} serie${sets>1?'s':''} de cada ejercicio, 45 s de descanso. Técnica antes que peso: sin dolor.</p>
    <ol class="blocks">${R.ex.filter(e=>!(taper&&/Salt/.test(e[0]))).map(([n,r])=>`<li class="blk"><div class="row between"><span class="bt">${n}</span><span class="bv num">${sets} × ${r}</span></div></li>`).join('')}</ol>
    <details class="adv"><summary>Movilidad (10 min, opcional)</summary><ul class="steps small" style="margin-top:6px">${MOBILITY.map(m=>`<li>${m}</li>`).join('')}</ul></details>
    <div class="grid2"><button class="ghost" data-act="close">Cerrar</button><button class="${done?'ghost':'primary'}" data-act="strdone" data-d="${date}">${done?'Marcar como no hecha':'Hecha'}</button></div></div>`);
}

export function strengthRow(x){
  const done=(state.strengthDone||{})[x.date];
  return `<button class="item" data-act="stropen" data-d="${x.date}" data-k="${x.key}"><span class="date">${DAYS[dow(x.date)]}<b class="num">${pd(x.date).getDate()}</b></span><span class="grow"><span class="t">${STRENGTH[x.key].n}</span><br><span class="s">Fuerza y movilidad · ${strengthSets()===1?'10':'20'} min</span></span>${done?'<span class="status d">Hecha</span>':'<span class="chip">Fuerza</span>'}</button>`;
}
