/**
 * Registro manual de entrenamientos.
 */
import { addDays, esc, fdLong, fk, fp, ft, parseTime, today, uid } from '../../core/util.js';
import { TYPES } from '../../model/constants.js';
import { save, state } from '../../core/store.js';
import { updateHR } from '../../model/heartrate.js';
import { MARK_D } from '../../model/marks.js';
import { gapFromElev } from '../../model/elevation.js';
import { logDone, setFitness, skip } from '../../model/adapt.js';
import { checkFatigue } from '../../model/activities.js';
import { $, layer } from '../dom.js';
import { intPicker, pickerHTML } from '../pickers.js';
import { toast } from '../toast.js';
import { closeSheet, openSheet, route } from '../router.js';
import { RPE_OPTS } from '../actions.js';
import { readShoePick, shoePickHTML, shoeSetHTML } from '../shoes.js';

/* =========================================================
   Registro manual de entrenamientos
   ========================================================= */
export const MAN_TYPES=[['easy','Rodaje'],['long','Tirada larga'],['series','Series'],['tempo','Tempo'],['race','Competición'],['other','Otro']];

export let addDraft=null;

export function openAddRun(prefDate){
  const td=today();
  addDraft={date:prefDate||td,type:'easy',rpe:null};
  renderAddRun();
}

export function renderAddRun(){
  const td=today(),a=addDraft;
  const dChips=[[td,'Hoy'],[addDays(td,-1),'Ayer'],[addDays(td,-2),'Anteayer']];
  const ses=state.plan?state.sessions.find(x=>x.date===a.date&&(x.status==='pending'||(x.status==='skipped'&&x.auto))):null;
  const html=`<div id="addf" class="stack">
    <h2>Añadir entreno</h2>
    <div><label>Día</label><div class="seg">${dChips.map(([d,l])=>`<button type="button" data-act="addset" data-f="date" data-v="${d}" aria-pressed="${a.date===d}">${l}</button>`).join('')}</div>
      <input type="date" id="a-date" style="margin-top:8px" max="${td}" value="${a.date}"><div class="hint">${fdLong(a.date)}${ses?` · cuenta como tu sesión del plan: <b>${TYPES[ses.type].n.toLowerCase()}</b>`:''}</div></div>
    ${ses?'':`<div><label>Tipo</label><div class="seg">${MAN_TYPES.map(([k,l])=>`<button type="button" data-act="addset" data-f="type" data-v="${k}" aria-pressed="${a.type===k}">${l}</button>`).join('')}</div></div>`}
    <div><label>Distancia</label>${pickerHTML('a-km','','dist',a.km||'',true)}</div>
    <div><label>Tiempo</label>${pickerHTML('a-t','','dur',a.t||'',true)}</div>
    <div class="grid2"><div><label>Desnivel +</label>${intPicker('a-elev','',0,2500,10,a.elev==null?'':a.elev,'m','Sin dato')}</div><div><label>Pulso medio</label>${intPicker('a-hr','',80,210,1,a.hr==null?'':a.hr,'ppm','Sin dato')}</div></div>
    <div><label>¿Cómo te ha resultado?</label><div class="rpe" role="radiogroup">${RPE_OPTS.map(([v,l])=>`<button type="button" role="radio" data-act="addrpe" data-v="${v}" aria-checked="${a.rpe===v}"><b>${v}</b>${l}</button>`).join('')}</div></div>
    ${shoePickHTML(a.shoe)}
    <div><label for="a-n">Notas <span class="muted">(opcional)</span></label><textarea id="a-n" rows="2" placeholder="Recorrido, sensaciones…">${esc(a.notes||'')}</textarea></div>
    <p class="err" id="aerr" role="alert"></p>
    <div class="grid2"><button type="button" class="ghost" data-act="close">Cancelar</button><button type="button" class="primary" data-act="addsave">Guardar</button></div></div>`;
  const sh=layer.querySelector('.sheet');
  if(sh&&sh.querySelector('#addf')){const y=sh.scrollTop;sh.innerHTML='<div class="grab" aria-hidden="true"></div>'+html;sh.scrollTop=y;}
  else openSheet(html);
}

export function readAddRun(){
  const a=addDraft,v=id=>{const e=$('#'+id);return e?e.value:'';};
  a.km=v('a-km');a.t=v('a-t');a.elev=v('a-elev')===''?null:+v('a-elev');a.hr=v('a-hr')===''?null:+v('a-hr');a.notes=v('a-n');
  const dd=v('a-date');if(dd)a.date=dd;
  const sf=$('#addf');if(sf){const sp=readShoePick(sf);if(sp!==undefined)a.shoe=sp;}
}

export function saveAddRun(){
  readAddRun();
  const a=addDraft,err=$('#aerr'),td=today();
  const km=parseFloat(a.km),t=parseTime(a.t);
  if(!(km>0)){err.textContent='Elige la distancia.';return;}
  if(!t){err.textContent='Elige el tiempo.';return;}
  if(t/km<150||t/km>1100){err.textContent='La distancia y el tiempo no cuadran. Revísalos.';return;}
  if(!a.rpe){err.textContent='Elige cómo te ha resultado.';return;}
  if(a.date>td){err.textContent='No puedes registrar un día futuro.';return;}
  const snap=JSON.stringify(state);
  const ses=state.plan?state.sessions.find(x=>x.date===a.date&&(x.status==='pending'||(x.status==='skipped'&&x.auto))):null;
  const log={rpe:a.rpe,km,time:t,elev:a.elev,hr:a.hr,notes:(a.notes||'').trim().slice(0,200),gap:gapFromElev(t,km,a.elev)};
  if(a.shoe)log.shoe=a.shoe;
  let msg;
  if(ses){
    if(ses.status==='skipped'){const copy=state.sessions.find(y=>y.moved&&y.from===ses.date&&y.type===ses.type&&y.status==='pending');if(copy)state.sessions=state.sessions.filter(y=>y!==copy);}
    ses.status='pending';const ev0=state.adapt.events[0];logDone(ses,log);
    const ne=state.adapt.events[0];msg=ne&&ne!==ev0?'Guardado en tu plan. '+ne.text.split('. ')[0]+'.':'Guardado como tu sesión del plan.';
  }else{
    state.manual=state.manual||[];
    state.manual.push(Object.assign({id:uid(),date:a.date,type:a.type,at:Date.now()},log));
    msg='Entreno añadido.';
    if(a.type==='race'){
      const sd=MARK_D.find(([d])=>Math.abs(km-d)/d<0.03);
      if(sd&&state.profile){const ms=state.profile.marks||[],ex=ms.find(m=>Math.abs(m.d-sd[0])<0.01);if(!ex||t<ex.t)state.profile.marks=ms.filter(m=>m!==ex).concat([{d:sd[0],t,date:a.date}]);}
      if(state.fitness){const np=t*Math.pow(5/km,1.06)/5;if(np>150&&np<720){setFitness(np,'Competición registrada.',true);msg='Competición registrada: ritmos actualizados.';}}
    }
    if(state.plan&&checkFatigue()) msg+=' Plan ajustado por la carga.';
    if(state.adapt&&updateHR()) msg+=' Zonas de pulso actualizadas.';
  }
  save();closeSheet();route();toast(msg,{undo:snap});
}

export function openManual(id){
  const m=(state.manual||[]).find(x=>x.id===id);if(!m)return;
  const t=(MAN_TYPES.find(x=>x[0]===m.type)||MAN_TYPES[5])[1];
  openSheet(`<div class="stack"><span class="eyebrow">${fdLong(m.date)} · fuera del plan</span><h2>${t}</h2>
    <div class="tiles"><div class="tile"><div class="k">Distancia</div><div class="v num">${fk(m.km)} km</div></div><div class="tile"><div class="k">Tiempo</div><div class="v num">${ft(m.time)}</div><div class="k num">${fp(m.time/m.km)} /km</div></div></div>
    <p class="small muted">${[m.elev!=null?`+${m.elev} m de desnivel`:'',m.hr?`${m.hr} ppm de media`:'',`esfuerzo ${m.rpe}/10`].filter(Boolean).join(' · ')}</p>
    ${m.notes?`<p class="small">${esc(m.notes)}</p>`:''}
    ${shoeSetHTML('m:'+m.id)}
    <p class="small muted">Cuenta para tu carga, tu forma y tus kilómetros.</p>
    <div class="grid2"><button class="danger" data-act="mandel" data-id="${m.id}">Borrar</button><button class="ghost" data-act="close">Cerrar</button></div></div>`);
}

export function unlogSession(s){
  if(!s||s.status!=='done') return;
  if(s.log&&s.log.strava&&state.strava){const r=state.strava.runs.find(x=>x.id===s.log.strava);if(r){r.sessionId=null;r.extra=true;}}
  s.status='pending';delete s.log;delete s.snap;delete s.rpeExp;
  if(s.date<today()) skip(s,true);
}
