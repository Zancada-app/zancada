/**
 * Tarjeta del chequeo diario y hoja «No estoy al 100 %».
 */
import { today } from '../core/util.js';
import { state } from '../core/store.js';
import { CHK, MOD_N, readiness } from '../model/readiness.js';
import { openSheet } from './router.js';

export const VERD={go:['Adelante','ok','Estás en condiciones de hacer la sesión tal cual.'],soft:['Suavízala','w','Haz la sesión, pero algo más corta y sin apurar los ritmos.'],easy:['Mejor suave','w','Hoy cambia la sesión por un rodaje suave y corto.'],rest:['Descansa','q','Con dolor no se corre. Descansa y, si sigue mañana, pausa el plan por lesión.']};

export function checkinCard(){
  const td=today();if(!state.plan||state.pause) return '';
  const c=(state.checkins||{})[td],ses=state.sessions.find(s=>s.date===td&&s.status==='pending');
  if(!c){
    if(!ses) return '';
    return `<section class="card stack" id="chk"><div class="row between"><h3>¿Cómo estás hoy?</h3><span class="small muted">4 toques</span></div>
      ${CHK.map(([k,l,o])=>`<div class="chkrow"><span class="small">${l}</span><div class="seg small-seg">${o.map(([v,t])=>`<button type="button" data-act="chk" data-k="${k}" data-v="${v}" aria-pressed="false">${t}</button>`).join('')}</div></div>`).join('')}</section>`;
  }
  const r=readiness(td);if(!r||!ses) return '';
  const vd=VERD[r.v],applied=ses.mod;
  return `<section class="card stack" style="gap:8px"><div class="row between"><span class="eyebrow">Estado de hoy</span><span class="chip ${vd[1]}">${vd[0]}</span></div>
    <div class="row" style="gap:14px;align-items:center"><div class="gauge" style="--v:${r.sc}"><b class="num">${r.sc}</b></div><p class="small">${vd[2]}${r.why.length?` <span class="muted">(${r.why.join(', ')})</span>`:''}</p></div>
    ${r.v!=='go'&&!applied?`<button type="button" class="primary block" data-act="applymod" data-id="${ses.id}" data-v="${r.v}">${r.v==='soft'?'Suavizar la sesión':r.v==='easy'?'Cambiar por rodaje suave':'Descansar hoy'}</button>`:''}
    ${applied?`<p class="small muted">Sesión ajustada: ${MOD_N[applied.kind]}.</p>`:''}
    <button type="button" class="linkb small" data-act="chkredo" style="align-self:flex-start">Cambiar respuestas</button></section>`;
}

export function openNot100(id){
  const s=state.sessions.find(x=>x.id===id);if(!s) return;
  openSheet(`<div class="stack"><h2>¿No estás al 100 %?</h2><p class="muted">Dime qué pasa y ajusto la sesión. El plan sigue después.</p>
    <div class="cards">
      <button type="button" class="ocard" data-act="n100" data-id="${s.id}" data-v="tired"><b>Estoy cansado</b><span>Hago la sesión más corta y suave</span></button>
      <button type="button" class="ocard" data-act="n100" data-id="${s.id}" data-v="time"><b>Voy justo de tiempo</b><span>Acorto la sesión a 30 minutos</span></button>
      <button type="button" class="ocard" data-act="n100" data-id="${s.id}" data-v="ache"><b>Tengo una molestia</b><span>Rodaje muy suave y corto, o descanso</span></button>
      <button type="button" class="ocard" data-act="n100" data-id="${s.id}" data-v="sick"><b>Estoy enfermo</b><span>Descanso hoy y pauso el plan</span></button>
    </div><button class="ghost" data-act="close">Volver</button></div>`);
}
