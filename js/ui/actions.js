/**
 * Acciones de hoja: registrar sesión, saltar, reiniciar y estado ocupado.
 */
import { fdLong, fk, fp, parsePace, parseTime } from '../core/util.js';
import { KEY_TYPES } from '../model/constants.js';
import { save, state, stravaOn } from '../core/store.js';
import { describe, paceR } from '../model/workouts.js';
import { logDone } from '../model/adapt.js';
import { moveOptions } from '../model/calendar.js';
import { pickerHTML, timeField } from './pickers.js';
import { toast } from './toast.js';
import { closeSheet, openSheet, route } from './router.js';
import { readShoePick, shoePickHTML } from './shoes.js';

/* ---------- Registrar una sesión ---------- */
export const RPE_OPTS=[[2,'Muy fácil'],[4,'Fácil'],[6,'Normal'],[8,'Duro'],[10,'Al límite']];

export function openLog(id){
  const s=state.sessions.find(x=>x.id===id);if(!s)return;const d=describe(s);
  const q=['series','tempo','ritmo','fartlek'].includes(s.type)&&d.pf;
  openSheet(`<div id="logf" class="stack" data-id="${s.id}">
    <span class="eyebrow">${fdLong(s.date)}</span><h2>${d.title}</h2>
    ${stravaOn()?`<div class="note small">¿La grabaste con el reloj? <button type="button" class="linkb" data-act="syncclose">Sincroniza Strava</button> y se registra sola, con todos los datos.</div>`:''}
    <div><label>¿Cómo te ha resultado?</label><div class="rpe" role="radiogroup">${RPE_OPTS.map(([v,l])=>`<button type="button" role="radio" data-act="rpe" data-v="${v}" aria-checked="false"><b>${v}</b>${l}</button>`).join('')}</div><div class="hint">Lo previsto era ${d.rpe} de 10. Es el dato que más uso para adaptar el plan.</div></div>
    <div><label>Distancia <span class="muted">(prevista: ${s.type==='test'?'5':fk(s.km)} km)</span></label>${pickerHTML('l-km','','dist','',true)}</div>
    <div>${timeField('l-t','',null,'dur','',s.type==='test'?'Tiempo de los 5 km':'Tiempo total')}</div>
    ${s.type==='test'?'<div class="hint" style="margin-top:-6px">En el test, pon solo los 5 km cronometrados.</div>':''}
    ${q?`<div>${timeField('l-wp','',null,'pace',`${fp(d.lo)}`,'Ritmo en la parte rápida <span class="muted">(opcional)</span>','enterkeyhint="next"')}<div class="hint">Objetivo ${paceR(d.lo,d.hi)} /km. Con este dato afino tus ritmos.</div></div>`:''}
    ${shoePickHTML()}
    <div><label for="l-n">Notas <span class="muted">(opcional)</span></label><textarea id="l-n" rows="2" placeholder="Molestias, calor, cansancio…"></textarea></div>
    <p class="err" id="lerr" role="alert"></p>
    <div class="grid2"><button type="button" class="ghost" data-act="close">Cancelar</button><button type="button" class="primary" data-act="logsave">Guardar</button></div>
  </div>`);
}

export function submitLog(form){
  const s=state.sessions.find(x=>x.id===form.dataset.id);if(!s)return;
  const sel=form.querySelector('.rpe [aria-checked="true"]');
  const err=form.querySelector('#lerr');
  if(!sel){err.textContent='Elige cómo te ha resultado.';form.querySelector('.rpe').classList.add('shake');setTimeout(()=>form.querySelector('.rpe')?.classList.remove('shake'),400);return;}
  const kmRaw=form.querySelector('#l-km').value.trim().replace(',','.');
  const km=kmRaw?parseFloat(kmRaw):null;
  const tRaw=form.querySelector('#l-t').value.trim(),time=parseTime(tRaw);
  if(kmRaw&&(isNaN(km)||km<=0||km>100)){err.textContent='Revisa la distancia, por ejemplo 8,5.';return;}
  if(tRaw&&!time){err.textContent='Revisa el tiempo.';return;}
  if(km&&time&&(time/km<150||time/km>1100)){err.textContent='La distancia y el tiempo no cuadran. Revisa ambos.';return;}
  if(s.type==='test'&&!time){err.textContent='Para el test necesito el tiempo de los 5 km.';return;}
  const wpEl=form.querySelector('#l-wp');const wp=wpEl&&wpEl.value.trim()?parsePace(wpEl.value):null;
  if(wpEl&&wpEl.value.trim()&&!wp){err.textContent='Revisa el ritmo, por ejemplo 4:45.';return;}
  const snap=JSON.stringify(state),ev0=state.adapt.events[0];
  const shoe=readShoePick(form);
  logDone(s,Object.assign({rpe:+sel.dataset.v,km:km||(s.type==='test'&&time?5:null),time,workPace:wp,notes:form.querySelector('#l-n').value.trim().slice(0,200)},shoe?{shoe}:{}));
  save();closeSheet();route();
  const ne=state.adapt.events[0];
  toast(ne&&ne!==ev0?'Guardada. Plan ajustado: '+ne.text.split('. ')[0]+'.':'Guardada. ¡Bien hecho!',{undo:snap});
}

export function askSkip(id){
  const s=state.sessions.find(x=>x.id===id);if(!s)return;
  openSheet(`<div class="stack"><h2>¿No puedes hacerla?</h2><p class="muted">${KEY_TYPES.includes(s.type)?'Es una sesión importante: intentaré moverla a otro día libre de esta semana con descanso suficiente.':'Es un rodaje suave: lo quito sin más.'} Si se repite a menudo, bajaré la carga del plan.</p>
    ${moveOptions(s).length>1?'<p class="small muted">Si solo quieres cambiarla de día, usa «Cambiar de día» en la sesión.</p>':''}
    <div class="grid2"><button class="ghost" data-act="close">Volver</button><button class="primary" data-act="skipYes" data-id="${s.id}">No puedo</button></div></div>`);
}

export function confirmReset(){
  openSheet(`<div class="stack"><h2>¿Borrar todo?</h2><p class="muted">Se borran el plan, el historial y la conexión con Strava de este móvil. Si no tienes una copia, no se puede recuperar.</p>
    <div class="grid2"><button class="ghost" data-act="close">Cancelar</button><button class="primary" data-act="resetYes">Borrar todo</button></div></div>`);
}

export function setBusy(on){
  document.querySelectorAll('[data-act=sync]').forEach(b=>{if(!b.dataset.label)b.dataset.label=b.textContent;b.disabled=on;b.classList.toggle('busy',on);b.textContent=on?'Sincronizando…':b.dataset.label;});
}
