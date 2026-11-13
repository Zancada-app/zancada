/**
 * Pantalla «Perfil» y sección de Strava (conexión, sincronización, código manual).
 */
import { esc, fk, ft } from '../../core/util.js';
import { save, setSyncFailed, state, sv, syncFailed, syncText } from '../../core/store.js';
import { processMissed } from '../../model/adapt.js';
import { stravaSummary } from '../../model/activities.js';
import { setSyncUI, stravaSync, syncLine } from '../../services/strava.js';
import { $, app } from '../dom.js';
import { draft, draftFromProfile, setDraft, summaryRows, wiz } from './wizard.js';
import { toast } from '../toast.js';
import { route } from '../router.js';
import { cycleSection } from '../cycle.js';

/* ---------- Perfil ---------- */
export function renderPerfil(){
  setDraft(draftFromProfile(state.profile));
  app.innerHTML=`<div class="stack-lg"><header class="stack" style="gap:6px"><div class="lanes" aria-hidden="true"></div><h1>Perfil</h1><p class="muted">Toca una fila para cambiarla. Si afecta al plan, te pediré confirmación antes de recalcularlo.</p></header>
    <div class="list card" style="padding:0 14px">${summaryRows('wedit')}</div>
    ${stravaSection()}
    ${cycleSection()}
    <section class="card stack"><h3>Tus datos</h3><p class="small muted" id="syncnote">${syncText()}</p>
      <div class="grid2"><button type="button" data-act="export">Descargar copia</button><button type="button" data-act="importOpen">Restaurar copia</button></div>
      <p class="hint">La copia incluye la conexión con Strava: no la compartas.</p>
      <input type="file" id="f-file" accept="application/json,.json" hidden>
      <button type="button" class="danger" data-act="resetAsk">Borrar todo y empezar de cero</button></section>
    <p class="small muted" style="text-align:center">Zancada · tus datos solo están en este móvil</p></div>`;
}

/* ---------- Strava en la interfaz ---------- */
export function stravaSection(){
  const s=sv();
  if(s.tokens) return `<section class="card stack"><div class="row between"><h3>Strava</h3><span class="chip ok">Conectado</span></div>
   <p class="small">${s.athlete&&s.athlete.name?`Cuenta de ${esc(s.athlete.name)} · `:''}${s.runs.length} carreras importadas<br><span class="muted" id="syncline">${syncLine()}</span></p>
   ${s.hrMax?`<p class="small muted">FC máxima registrada en Strava: ${s.hrMax} ppm. Si sabes la tuya, ponla arriba en tu perfil.</p>`:''}
   <div class="grid2"><button type="button" data-act="sync">Sincronizar ahora</button><button type="button" class="ghost" data-act="disconnect">Desconectar</button></div></section>`;
  return `<section class="card stack"><h3>Conectar Strava</h3>
   <p class="small muted">El reloj sube las carreras a Strava y Zancada las lee de ahí: se registran solas, se emparejan con el plan y ajustan ritmos, carga y predicciones.</p>
   <ol class="small" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px">
    <li>Con la cuenta de Strava del corredor, entra en <code>strava.com/settings/api</code> y crea una aplicación.</li>
    <li>En <b>Authorization Callback Domain</b> escribe <code>${esc(location.hostname||'tu-dominio')}</code></li>
    <li>Copia aquí el Client ID y el Client Secret.</li></ol>
   <div><label for="sv-id">Client ID</label><input id="sv-id" data-sv="clientId" inputmode="numeric" value="${esc(s.clientId)}" autocomplete="off"></div>
   <div><label for="sv-secret">Client Secret</label><input id="sv-secret" data-sv="clientSecret" value="${esc(s.clientSecret)}" autocomplete="off" type="password"></div>
   <details class="adv"><summary>Avanzado</summary><div class="stack" style="margin-top:6px">
     <div><label for="sv-proxy">Proxy <span class="muted">(solo si la conexión falla)</span></label><input id="sv-proxy" data-sv="proxy" value="${esc(s.proxy)}" placeholder="https://zancada-proxy.tu-usuario.workers.dev" autocomplete="off"></div>
     <div><label for="sv-code">Código de conexión</label><div class="row"><input id="sv-code" placeholder="Si Strava te devolvió a Safari, pégalo aquí"><button type="button" data-act="pastecode">Usar</button></div></div>
   </div></details>
   <button type="button" class="strava-btn block" data-act="connect">Conectar con Strava</button></section>`;
}

export function stravaPrefillCard(){
  const sm=stravaSummary();if(!sm) return '';
  return `<section class="card stack" style="gap:6px"><span class="eyebrow">Historial de Strava · ${sm.n} carreras</span>
   <p>Últimas 4 semanas: <b class="num">${fk(sm.km)} km</b> por semana en unos <b>${sm.perWeek} días</b>.${sm.best?` Su mejor esfuerzo reciente (${sm.best.n}) equivale a <b class="num">${ft(sm.best.p*5)}</b> en 5 km.`:''}</p>
   <p class="small muted">Con esto he rellenado los siguientes pasos.</p></section>`;
}

export function prefillFromStrava(d){
  const sm=stravaSummary();if(!sm) return d;
  d.weeklyKm=Math.round(sm.km);
  d.level=sm.km<10?'nuevo':sm.km<40?'intermedio':'avanzado';
  if(sm.days&&sm.days.length>=2){d.days=sm.days;d.longDay=sm.days.includes(sm.longDay)?sm.longDay:Math.max(...sm.days);}
  return d;
}

// Si queda historial por revisar (Strava limita las consultas), se sigue solo pasado el límite.
let moreTimer=null;
function scheduleMore(){
  const s=state.strava;if(!s||!s.tokens||moreTimer) return;
  const pending=(s.hist&&!(s.hist.listed&&!s.hist.cand.length))||s.runs.some(r=>!r.detail);
  if(pending) moreTimer=setTimeout(()=>{moreTimer=null;if(document.visibilityState==='visible')doSync(false);},16*60e3);
}

export async function doSync(manual){
  let r=null;
  try{r=await stravaSync();setSyncFailed(false);scheduleMore();}
  catch(e){setSyncFailed(true);setSyncUI();if(manual||state.profile)toast(e.message);}
  if(!state.profile){
    if(!r) return;
    // solo se rellena el asistente si aún está en el primer paso: nunca se pierde lo que ya se ha escrito
    if(!wiz||wiz.i===0){setDraft(null);if(wiz)wiz.anim=false;route();}
    toast(r.added?`${r.added} carreras importadas de Strava.`:'Strava conectado, pero no hay carreras en el último año.');return;
  }
  if(state.plan&&processMissed()) save();
  if(r){save();route();
    if(manual||r.added) toast(r.added?`Strava: ${r.added} ${r.added===1?'carrera nueva':'carreras nuevas'}${r.matched?`, ${r.matched} emparejada${r.matched>1?'s':''} con el plan`:''}.${r.fit||r.fat?' Plan ajustado.':''}`:'Todo al día: no hay carreras nuevas en Strava.');
  }else route();
}

export function renderCodeScreen(code){
  $('#tabs').hidden=true;
  app.innerHTML=`<div class="stack-lg"><header class="stack" style="gap:8px"><div class="lanes" aria-hidden="true"></div><h1>Casi está</h1>
   <p class="muted">Strava te ha devuelto a Safari en lugar de a la app. Copia este código, abre Zancada desde la pantalla de inicio y pégalo en Perfil › Strava › Avanzado › Código de conexión.</p></header>
   <div class="card stack"><code id="thecode" style="font-size:16px">${esc(code)}</code><button class="primary" data-act="copycode">Copiar código</button></div>
   <p class="small muted">El código caduca pronto: pégalo en los próximos minutos.</p></div>`;
}
