/**
 * Punto de entrada: registra eventos, arranca la app y el service worker.
 */
import { today } from './core/util.js';
import { LS, blankState, onSaveError, save, setState, state, stravaOn, sv } from './core/store.js';
import { processMissed } from './model/adapt.js';
import { stravaExchange } from './services/strava.js';
import { doSync, renderCodeScreen } from './ui/screens/perfil.js';
import { toast } from './ui/toast.js';
import { closeSheet, route } from './ui/router.js';
import { bindEvents } from './ui/events.js';
import { cycleSchedule } from './model/cycle.js';

onSaveError(toast);
bindEvents();

window.addEventListener('hashchange',route);

// al volver a la app: si ha cambiado el día, se actualiza el plan; si hace rato de la última sincronización, se sincroniza
let shownDay=null;

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState!=='visible'||!state) return;
  if(stravaOn()&&Date.now()-sv().lastSync>20*60000){doSync(false);shownDay=today();return;}
  if(shownDay&&shownDay!==today()&&state.profile&&state.plan){if(processMissed()|cycleSchedule())save();route();}
  shownDay=today();
});

/* =========================================================
   Arranque
   ========================================================= */
function boot(){
  if(!state){try{setState(JSON.parse(localStorage.getItem(LS))||blankState());}catch(e){setState(blankState());}}
  shownDay=today();
  closeSheet();
  const qp=new URLSearchParams(location.search);
  if(qp.get('state')==='zancada'&&(qp.has('code')||qp.has('error'))){
    history.replaceState(null,'',location.pathname+location.hash);
    if(qp.get('error')){toast('Has cancelado la conexión con Strava.');}
    else if(!(state.strava&&state.strava.clientSecret)){renderCodeScreen(qp.get('code'));return;}
    else{route();stravaExchange(qp.get('code'),qp.get('scope')).then(()=>{toast('Strava conectado. Importando carreras…');return doSync(false);}).catch(e=>{toast(e.message);route();});return;}
  }
  if(stravaOn()&&Date.now()-sv().lastSync>20*60000){route();doSync(false);return;}
  if(state.profile&&state.plan){if(processMissed()|cycleSchedule())save();}
  route();
}

if(typeof window!=='undefined'&&!window.__TEST__){
  boot();
  if('serviceWorker' in navigator&&location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
  if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});
}
