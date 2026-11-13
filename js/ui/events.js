/**
 * Delegación de eventos: un único manejador por tipo de evento para toda la app.
 */
import { addDays, daysBetween, esc, fdLong, monday, today } from '../core/util.js';
import { GOALS } from '../model/constants.js';
import { blankState, save, setState, state, sv } from '../core/store.js';
import { ageNote } from '../model/plan.js';
import { applyMod, chkRows, doNot100 } from '../model/readiness.js';
import { createPlan, rateSession, skip } from '../model/adapt.js';
import { activities } from '../model/activities.js';
import { moveSession, resumePlan, startPause } from '../model/calendar.js';
import { geoSearch } from '../services/weather.js';
import { stravaConnect, stravaExchange } from '../services/strava.js';
import { $ } from './dom.js';
import { openPause } from './cards.js';
import { openNot100 } from './checkin.js';
import { openStrength } from './strength.js';
import { openSession } from './screens/hoy.js';
import { openWeeks, setOpenWeeks } from './screens/plan.js';
import { clearPicker, fmtDigits, onPickerChange } from './pickers.js';
import { draft, draftFromProfile, goalHint, markHint, readDraftInputs, renderWizard, setDraft, setWiz, wiz, wizBack, wizConfirm, wizNext, wizRerender, wizSave, wizSteps } from './screens/wizard.js';
import { doSync } from './screens/perfil.js';
import { addDraft, openAddRun, openManual, readAddRun, renderAddRun, saveAddRun, unlogSession } from './screens/manual.js';
import { toast, undoLast } from './toast.js';
import { closeSheet, lastTab, route, setLastTab } from './router.js';
import { askSkip, confirmReset, openLog, submitLog } from './actions.js';
import { applyShoeSet, openShoe, pickShoeKind, saveShoe, shoeAction, touchShoeLimit } from './shoes.js';
import { cycleAction } from './cycle.js';

/* ---------- Eventos ---------- */
export let lastAct={a:null,t:0},geoResults=[];

// solo se protegen del doble toque las acciones que confirman o cambian de pantalla; las de elegir opciones van sin freno
export const GUARDED=new Set(['cycsave','cycstart','cycend','cycok','cycdel','cycadd','cycoff2','shoesave','shoeretire','shoeunretire','shoedel','shoeswap','shoeack','shoeopen','wnext','wback','wsave','wconfirm','logsave','addsave','skipYes','applymod','n100','resume','pausego','sync','move','strdone','newblock','resetYes','undo','unlog','mandel','addrun','log','open','skip','pause','n100open','stropen','wedit','wgo']);

/** Registra los manejadores globales (delegación de eventos). Se llama una vez desde main.js. */
export function bindEvents(){
  document.addEventListener('toggle',e=>{const d=e.target;if(!d.classList||!d.classList.contains('wk'))return;if(!openWeeks){setOpenWeeks(new Set());document.querySelectorAll('details.wk[open]').forEach(x=>openWeeks.add(+x.dataset.w));}if(d.open)openWeeks.add(+d.dataset.w);else openWeeks.delete(+d.dataset.w);},true);

  document.addEventListener('click',e=>{
    const t=e.target.closest('[data-act]');
    const hit=e.target.closest('.hit');
    if(hit){const tip=hit.closest('.chart').querySelector('.tip');tip.textContent=hit.dataset.tip;}
    if(!t||t.disabled)return;
    const a=t.dataset.act,id=t.dataset.id;
    // un doble toque rápido no debe ejecutar dos veces la acción (p. ej. saltarse un paso)
    const now=Date.now();
    if(GUARDED.has(a)&&a===lastAct.a&&now-lastAct.t<450) return;
    lastAct={a,t:now};
    switch(a){
      // asistente
      case 'wset':{readDraftInputs();const f=t.dataset.f,v=t.dataset.v;
        if(f==='hasDate') draft.hasDate=v==='1';
        else if(f==='hills') draft.hills=v==='1';
        else if(f==='strength') draft.strength=v==='1';
        else{draft[f]=v;if(f==='goal'){draft.weeks=GOALS[v].defWeeks;if(!GOALS[v].dist)draft.targetTime='';}if(f==='weeks')draft.weeks=+v;if(f==='longDay')draft.longDay=+v;if(f==='raceElev'||/^ma\d$/.test(f))draft[f]=+v;}
        wizRerender();if(f==='refDist'&&v){const i=$('#f-rt');if(i)i.focus();}break;}
      case 'wday':{readDraftInputs();const v=+t.dataset.v,i=draft.days.indexOf(v);if(i>=0)draft.days.splice(i,1);else draft.days.push(v);
        if(!draft.days.includes(+draft.longDay)&&draft.days.length)draft.longDay=Math.max(...draft.days);wizRerender();break;}
      case 'kmstep_unused':{readDraftInputs();const v=Math.max(0,Math.min(200,Math.round((parseFloat(String(draft.weeklyKm).replace(',','.'))||0)+ +t.dataset.v)));draft.weeklyKm=v;$('#f-km').value=v;break;}
      case 'wnext': wizNext();break;
      case 'wback': wizBack();break;
      case 'wgo':{readDraftInputs();const st=wizSteps();wiz.i=st.indexOf(t.dataset.step);wiz.dir=-1;wiz.anim=true;renderWizard();window.scrollTo(0,0);break;}
      case 'wedit': setDraft(draftFromProfile(state.profile));setWiz({mode:'edit',key:t.dataset.step,i:0,dir:1,anim:true});renderWizard();window.scrollTo(0,0);break;
      case 'wsave': wizSave();break;
      case 'wconfirm': wizConfirm();break;
      // sesiones
      case 'open': openSession(id);break;
      case 'log': openLog(id);break;
      case 'logsave': submitLog($('#logf'));break;
      case 'syncclose': closeSheet();doSync(true);break;
      case 'skip': askSkip(id);break;
      case 'skipYes':{const s=state.sessions.find(x=>x.id===id);if(!s)break;const snap=JSON.stringify(state),ev0=state.adapt.events[0];skip(s,false);save();closeSheet();route();const ne=state.adapt.events[0];toast(ne&&ne!==ev0?ne.text:'Sesión quitada del plan.',{undo:snap});break;}
      case 'close': closeSheet();break;
      case 'move':{const s=state.sessions.find(x=>x.id===id);if(!s)break;const snap=JSON.stringify(state);const msg=moveSession(s,t.dataset.d);if(msg){save();closeSheet();route();toast(msg,{undo:snap});}break;}
      case 'pause': openPause();break;
      case 'preason': t.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===t)));break;
      case 'pausego':{const f=$('#pausef');const r=f.querySelector('[data-act=preason][aria-pressed=true]').dataset.v;const to=f.querySelector('#p-to').value||null;const snap=JSON.stringify(state);startPause(r,to);save();closeSheet();setLastTab(null);location.hash='#hoy';route();toast('Plan en pausa. Recupérate bien.',{undo:snap});break;}
      case 'resume':{const snap=JSON.stringify(state);resumePlan();save();closeSheet();route();toast('Plan retomado con la carga ajustada.',{undo:snap});break;}
      case 'sumok': state.adapt.summarySeen=monday(today());save();route();break;
      case 'rpe': t.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',String(b===t)));$('#lerr').textContent='';break;
      case 'rate':{const s=state.sessions.find(x=>x.id===id);const snap=JSON.stringify(state),ev0=state.adapt.events[0];rateSession(s,+t.dataset.v);save();route();const ne=state.adapt.events[0];toast(ne&&ne!==ev0?'Gracias. Plan ajustado: '+ne.text.split('. ')[0]+'.':'Gracias, anotado.',{undo:snap});break;}
      case 'undo': undoLast(t);break;
      case 'pclear': clearPicker(t);break;
      case 'chk':{const td=today();state.checkins=state.checkins||{};const c=state.checkins[td+'_draft']||{};c[t.dataset.k]=+t.dataset.v;
        t.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===t)));
        if(chkRows(td).every(([k])=>c[k])){state.checkins[td]=c;delete state.checkins[td+'_draft'];
          Object.keys(state.checkins).forEach(k=>{if(k.slice(0,10)<addDays(td,-60))delete state.checkins[k];});save();route();}
        else state.checkins[td+'_draft']=c;break;}
      case 'chkredo':{const td=today();delete state.checkins[td];save();route();break;}
      case 'applymod':{const s=state.sessions.find(x=>x.id===id);const snap=JSON.stringify(state);const v=t.dataset.v;applyMod(s,v,'tu estado de hoy');if(v==='rest'&&s){}save();route();toast(v==='rest'?'Hoy descansas.':'Sesión ajustada.',{undo:snap});break;}
      case 'n100open': openNot100(id);break;
      case 'n100':{const s=state.sessions.find(x=>x.id===id);const snap=JSON.stringify(state);doNot100(s,t.dataset.v);save();closeSheet();route();toast(t.dataset.v==='sick'?'Descanso y plan en pausa. Recupérate bien.':t.dataset.v==='period'?'Hoy toca suave. Cuídate.':'Sesión ajustada.',{undo:snap});break;}
      case 'stropen': openStrength(t.dataset.d,t.dataset.k);break;
      case 'strdone':{state.strengthDone=state.strengthDone||{};const d=t.dataset.d;if(state.strengthDone[d])delete state.strengthDone[d];else state.strengthDone[d]=true;save();closeSheet();route();toast(state.strengthDone[d]?'Fuerza hecha. ¡Bien!':'Desmarcada.');break;}
      case 'geosearch':{readDraftInputs();const q=($('#f-cityq').value||'').trim();if(q.length<2){$('#err').textContent='Escribe al menos 2 letras.';break;}
        const box=$('#georesults');box.innerHTML='<span class="small muted">Buscando…</span>';
        geoSearch(q).then(rs=>{geoResults=rs;box.innerHTML=rs.length?rs.map((x,i)=>`<button type="button" data-act="geopick" data-i="${i}">${esc(x.name)}<span class="muted small">&nbsp;· ${esc(x.area)}</span></button>`).join(''):'<span class="small muted">No encuentro esa ciudad.</span>';})
          .catch(()=>{box.innerHTML='<span class="small muted">Sin conexión con el servicio del tiempo. Inténtalo luego.</span>';});break;}
      case 'geopick':{readDraftInputs();draft.city=geoResults[+t.dataset.i];if(!draft.runHour)draft.runHour='8';wizRerender();break;}
      case 'geoclear':{readDraftInputs();draft.city=null;wizRerender();break;}
      case 'addrun': openAddRun();break;
      case 'addset': readAddRun();addDraft[t.dataset.f]=t.dataset.v;renderAddRun();break;
      case 'addrpe': addDraft.rpe=+t.dataset.v;t.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-checked',String(b===t)));$('#aerr').textContent='';break;
      case 'addsave': saveAddRun();break;
      case 'manopen': openManual(id);break;
      // ciclo
      case 'cycopen': case 'cycmode': case 'cycadapt': case 'cycsave': case 'cycstart': case 'cycend': case 'cycok': case 'cycdel': case 'cycadd': case 'cycoff': case 'cycoff2': cycleAction(a,t);break;
      // zapatillas
      case 'shoeopen': openShoe(id||null);break;
      case 'shoesave': saveShoe();break;
      case 'shoekind': pickShoeKind(t);break;
      case 'shoedef': t.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===t)));break;
      case 'shoepick': t.parentElement.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===t)));if(addDraft&&t.closest('#addf'))addDraft.shoe=t.dataset.v;break;
      case 'shoeset': applyShoeSet(t);break;
      case 'shoeack': case 'shoeretire': case 'shoeunretire': case 'shoedel': case 'shoeswap': shoeAction(a,id);break;
      case 'mandel':{const snap=JSON.stringify(state);state.manual=(state.manual||[]).filter(m=>m.id!==id);save();closeSheet();route();toast('Entreno borrado.',{undo:snap});break;}
      case 'unlog':{const s=state.sessions.find(x=>x.id===id);if(!s)break;const snap=JSON.stringify(state);unlogSession(s);save();closeSheet();route();toast('Registro borrado.',{undo:snap});break;}
      case 'newblock':{const snap=JSON.stringify(state);const pr={...state.profile};pr.weeklyKm=Math.round(activities().filter(a=>daysBetween(a.date,today())<21&&a.date<=today()).reduce((x,a)=>x+a.km,0)/3);if(pr.raceDate&&pr.raceDate<=today()){pr.raceDate=null;pr.targetTime=null;}pr.refDist=null;pr.refTime=null;state.profile.refDist=null;state.profile.refTime=null;createPlan(pr,true);save();route();toast('Nuevo bloque creado.',{undo:snap});break;}
      // datos y Strava
      case 'export':{const blob=new Blob([JSON.stringify(state)],{type:'application/json'});const l=document.createElement('a');l.href=URL.createObjectURL(blob);l.download=`zancada-${today()}.json`;document.body.appendChild(l);l.click();setTimeout(()=>{URL.revokeObjectURL(l.href);l.remove();},1500);toast('Copia descargada. En el iPhone queda en la app Archivos.');break;}
      case 'importOpen': $('#f-file').click();break;
      case 'connect': readDraftInputs();stravaConnect();break;
      case 'sync': doSync(true);break;
      case 'disconnect':{const snap=JSON.stringify(state);const s=sv();s.tokens=null;save();route();toast('Strava desconectado. Para retirar el permiso del todo: Strava › Ajustes › Mis aplicaciones.',{undo:snap});break;}
      case 'pastecode':{let c=($('#sv-code').value||'').trim();const m=c.match(/[?&]code=([^&]+)/);if(m)c=decodeURIComponent(m[1]);if(!c){toast('Pega primero el código.');break;}
        if(!sv().clientId||!sv().clientSecret){toast('Escribe también el Client ID y el Client Secret.');break;}
        stravaExchange(c).then(()=>{toast('Strava conectado. Importando carreras…');return doSync(false);}).catch(e=>toast(e.message));break;}
      case 'copycode':{const c=$('#thecode').textContent;(navigator.clipboard?navigator.clipboard.writeText(c):Promise.reject()).then(()=>toast('Código copiado.')).catch(()=>toast('Mantén pulsado el código para copiarlo.'));break;}
      case 'resetAsk': confirmReset();break;
      case 'resetYes': setState(blankState());setDraft(null);setWiz(null);save();closeSheet(true);location.hash='';setLastTab(null);route();break;
    }
  });

  document.addEventListener('pointerover',e=>{const hit=e.target.closest&&e.target.closest('.hit');if(hit){hit.closest('.chart').querySelector('.tip').textContent=hit.dataset.tip;}});

  // formato de tiempo al escribir + borrador del asistente
  document.addEventListener('input',e=>{
    const el=e.target;
    if(el.dataset&&el.dataset.time){const v=fmtDigits(el.value,el.dataset.time);if(v!==el.value)el.value=v;}
    if(el.dataset&&el.dataset.f&&draft&&el.closest('.wiz')){
      readDraftInputs();
      const h=$('#goalhint');if(h)h.innerHTML=goalHint(draft);
      const mh=$('#markhint');if(mh)mh.innerHTML=markHint(draft);
      if(/^mt\d$/.test(el.dataset.f)&&(!!el.value)!==(!!el.closest('.mark').querySelector('.seg'))){wizRerender();return;}
      const ah=$('#agehint');if(ah)ah.textContent=(ageNote({age:+draft.age})||(draft.age?'Con tu edad el plan sigue la progresión normal.':''))+(!draft.hrMax&&draft.age&&!(state.strava&&state.strava.hrMax)?` FC máxima estimada: ${Math.round(208-0.7*draft.age)} ppm.`:'');
      const e2=$('#err');if(e2)e2.textContent='';
    }
    const k=el.dataset&&el.dataset.sv;if(k){sv()[k]=el.value.trim();save();}
  });

  document.addEventListener('change',e=>{
    const el=e.target;
    if(el.matches&&el.matches('.picker select')){onPickerChange(el);if(el.closest('[data-target="sh-limit"]'))touchShoeLimit();return;}
    if(el.id==='f-race'&&draft){readDraftInputs();wizRerender();return;}
    if(el.id==='a-date'&&addDraft){readAddRun();renderAddRun();return;}
    if(el.id==='p-to'){const h=$('#p-to-h');if(h)h.textContent=el.value?`Vuelves el ${fdLong(el.value)}.`:'';return;}
    if(el.id!=='f-file'||!el.files[0])return;
    const fr=new FileReader();fr.onload=()=>{try{const s=JSON.parse(fr.result);if(!s.profile||!s.sessions)throw 0;const snap=JSON.stringify(state);setState(s);setDraft(null);save();setLastTab(null);location.hash='#hoy';route();toast('Copia restaurada.',{undo:snap});}catch(_){toast('Ese archivo no es una copia válida de Zancada.');}};fr.readAsText(el.files[0]);
  });

  // Intro nunca envía nada: pasa al siguiente campo o cierra el teclado
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeSheet();return;}
    if(e.key!=='Enter'||e.target.tagName!=='INPUT') return;
    e.preventDefault();
    if(e.target.id==='f-cityq'){const b=$('[data-act=geosearch]');if(b)b.click();return;}
    const scope=e.target.closest('.sheet,.wiz,main')||document;
    const ins=[...scope.querySelectorAll('input:not([type=hidden]):not([type=file]):not([disabled])')];
    const nx=ins[ins.indexOf(e.target)+1];
    if(nx&&e.target.getAttribute('enterkeyhint')==='next') nx.focus(); else e.target.blur();
  });

  document.addEventListener('submit',e=>e.preventDefault());
}
