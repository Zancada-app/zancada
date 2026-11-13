/**
 * Strava: OAuth, llamadas a la API, sincronización y conversión de actividades.
 */
import { addDays, today } from '../core/util.js';
import { save, sv } from '../core/store.js';
import { robustMax } from '../model/heartrate.js';
import { gapFromElev } from '../model/elevation.js';
import { afterSync } from '../model/activities.js';
import { toast } from '../ui/toast.js';
import { setBusy } from '../ui/actions.js';
import { autoAssignShoes, syncStravaShoes } from '../model/shoes.js';
import { archiveMark, markP, summaryMark } from '../model/marks.js';

/* =========================================================
   Strava
   ========================================================= */
export const STRAVA_WEB='https://www.strava.com';

export const STRAVA_API='/api/v3';

export const RUN_TYPES=['Run','TrailRun','VirtualRun'];

export const redirectUri=()=>location.origin+location.pathname;

export const base=()=>(sv().proxy||STRAVA_WEB).replace(/\/+$/,'');

export function stravaConnect(){
  const s=sv();
  if(!s.clientId||!s.clientSecret){toast('Primero escribe el Client ID y el Client Secret de tu app de Strava.');return;}
  const q=new URLSearchParams({client_id:s.clientId,redirect_uri:redirectUri(),response_type:'code',approval_prompt:'auto',scope:'read,activity:read_all,profile:read_all',state:'zancada'});
  save();
  location.href=STRAVA_WEB+'/oauth/authorize?'+q.toString();
}

export async function tokenRequest(params){
  const s=sv();
  const body=new URLSearchParams(Object.assign({client_id:s.clientId,client_secret:s.clientSecret},params));
  let r;
  try{r=await fetch(base()+'/oauth/token',{method:'POST',body});}
  catch(e){throw new Error(s.proxy?'No se pudo contactar con el proxy. Revisa su dirección.':'El navegador no pudo hablar con Strava. Configura el proxy opcional (lo explica el LEEME).');}
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(r.status===400||r.status===401?'Strava rechazó la conexión. Revisa el Client ID y el Client Secret, y vuelve a conectar.':(j.message||('Strava respondió con el error '+r.status)));
  return j;
}

export async function stravaExchange(code,scope){
  if(scope&&!scope.includes('activity:read')) throw new Error('Al conectar hay que dejar marcado el permiso para ver las actividades.');
  const j=await tokenRequest({code,grant_type:'authorization_code'});
  const s=sv();
  s.tokens={access:j.access_token,refresh:j.refresh_token,expiresAt:j.expires_at};
  s.athlete=j.athlete?{id:j.athlete.id,name:j.athlete.firstname||''}:null;
  save();
}

export async function accessToken(force){
  const s=sv();
  if(!s.tokens) throw new Error('Strava no está conectado.');
  if(force||Date.now()/1000>s.tokens.expiresAt-120){
    const j=await tokenRequest({grant_type:'refresh_token',refresh_token:s.tokens.refresh});
    s.tokens={access:j.access_token,refresh:j.refresh_token||s.tokens.refresh,expiresAt:j.expires_at};
    save();
  }
  return s.tokens.access;
}

export async function api(path){
  const call=async tok=>{
    try{return await fetch(base()+STRAVA_API+path,{headers:{Authorization:'Bearer '+tok},signal:AbortSignal.timeout?AbortSignal.timeout(25000):undefined});}
    catch(e){throw new Error('Sin conexión con Strava. Comprueba internet o el proxy.');}
  };
  let r=await call(await accessToken());
  if(r.status===401) r=await call(await accessToken(true));
  if(r.status===429) throw new Error('Strava limita las consultas: vuelve a sincronizar dentro de 15 minutos.');
  if(r.status===401){sv().tokens=null;save();throw new Error('Strava ha retirado el permiso. Vuelve a conectar desde Perfil.');}
  if(!r.ok) throw new Error('Strava respondió con el error '+r.status+'.');
  return r.json();
}

export function toRun(a){
  return {id:a.id,date:String(a.start_date_local).slice(0,10),name:String(a.name||'').slice(0,80),km:(a.distance||0)/1000,sec:a.moving_time||a.elapsed_time||0,
    hr:a.average_heartrate||null,hrMax:a.max_heartrate||null,elev:Math.round(a.total_elevation_gain||0),rpe:a.perceived_exertion||null,
    race:a.workout_type===1,type:a.sport_type||a.type,gear:a.gear_id||null,detail:false,be:[],laps:[],splits:[],sessionId:null,extra:false};
}

export function addDetail(r,a){
  r.detail=true;
  if(a.perceived_exertion) r.rpe=a.perceived_exertion;
  r.be=(a.best_efforts||[]).map(b=>({n:b.name,d:b.distance,t:b.moving_time||b.elapsed_time})).filter(b=>b.t>0);
  const lp=l=>({km:(l.distance||0)/1000,sec:l.moving_time||l.elapsed_time||0,hr:l.average_heartrate||null,
    gap:l.average_grade_adjusted_speed>0?1000/l.average_grade_adjusted_speed:null,el:l.elevation_difference!=null?l.elevation_difference:(l.total_elevation_gain!=null?l.total_elevation_gain:null)});
  r.laps=(a.laps||[]).map(lp).filter(l=>l.km>0);
  r.splits=(a.splits_metric||[]).map(lp).filter(l=>l.km>0);
  // ritmo ajustado por pendiente (GAP de Strava); si no viene, se estima con el desnivel
  const gs=r.splits.filter(x=>x.gap);
  r.gap=gs.length>=Math.max(1,r.splits.length*0.6)?gs.reduce((t,x)=>t+x.gap*x.km,0)/gs.reduce((t,x)=>t+x.km,0):gapFromElev(r.sec,r.km,r.elev);
}

export let syncing=false;

// Strava permite unas 100 consultas cada 15 minutos: cada sincronización usa como mucho ~70.
const DETAIL_BUDGET=40,HIST_BUDGET=25,HIST_PER_BUCKET=12;
// orden para buscar marcas: competiciones primero y luego por ritmo equivalente en 5 km
const markRank=r=>(r.race?0:1e4)+markP(r.sec,Math.max(r.km,1));
const bucketOf=km=>km<5?0:km<10?1:km<21.0975?2:km<42.195?3:4;

/** Recorre las actividades de más de un año y guarda solo sus mejores marcas (no las carreras). */
async function scanHistory(s,budget){
  const h=s.hist||(s.hist={before:Math.floor((s.firstSync||Date.now())/1000-365*86400),listed:false,cand:[],scanned:0});
  if(h.listed&&!h.cand.length) return;
  try{
    for(let page=0;page<2&&!h.listed;page++){
      const arr=await api(`/athlete/activities?before=${h.before}&per_page=200`);
      for(const a of arr){
        if(!RUN_TYPES.includes(a.sport_type||a.type)||!(a.distance>300)||s.runs.some(r=>r.id===a.id))continue;
        const r=toRun(a);h.scanned++;
        const sm=summaryMark(r);if(sm)archiveMark(s,sm.key,sm.t,r.date,r.id,{race:sm.race,approx:!sm.race});
        if(r.km>=0.95)h.cand.push({id:r.id,date:r.date,km:r.km,sec:r.sec,race:r.race});
      }
      if(arr.length)h.before=Math.min(...arr.map(a=>Math.floor(Date.parse(a.start_date)/1000)))-1;
      if(arr.length<200)h.listed=true;
      // solo las candidatas: las competiciones y las más rápidas de cada tramo de distancia
      const keep=[],count=[0,0,0,0,0];
      h.cand.sort((a,b)=>markRank(a)-markRank(b)).forEach(c=>{const k=bucketOf(c.km);if(c.race||count[k]++<HIST_PER_BUCKET)keep.push(c);});
      h.cand=keep;
    }
    while(budget-->0&&h.cand.length){
      const c=h.cand[0],a=await api(`/activities/${c.id}`);
      h.cand.shift();
      (a.best_efforts||[]).forEach(b=>archiveMark(s,b.name,b.moving_time||b.elapsed_time,c.date,c.id));
    }
  }catch(e){/* se reintenta en la próxima sincronización */}
}

export async function stravaSync(){
  const s=sv();
  if(!s.tokens||syncing) return null;
  syncing=true;setSyncUI('Sincronizando con Strava…');
  try{
    const after=Math.floor(s.lastSync?s.lastSync/1000-4*86400:Date.now()/1000-365*86400);
    let list=[];
    for(let page=1;page<=5;page++){
      const arr=await api(`/athlete/activities?after=${after}&per_page=100&page=${page}`);
      list=list.concat(arr);
      if(arr.length<100) break;
    }
    const known=new Map(s.runs.map(r=>[r.id,r]));
    let added=0;
    list.filter(a=>RUN_TYPES.includes(a.sport_type||a.type)&&a.distance>300).forEach(a=>{
      const ex=known.get(a.id);
      if(ex){ex.name=String(a.name||'').slice(0,80);if(a.perceived_exertion)ex.rpe=a.perceived_exertion;}
      else{s.runs.push(toRun(a));added++;}
    });
    s.runs.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
    // detalle (mejores esfuerzos, vueltas, parciales): primero lo reciente, luego competiciones y
    // las más rápidas. Lo que no quepa se completa en las siguientes sincronizaciones.
    const pend=s.runs.filter(r=>!r.detail);
    const recent=pend.slice(-20).reverse();
    const rest=pend.filter(r=>!recent.includes(r)).sort((a,b)=>markRank(a)-markRank(b));
    let budget=DETAIL_BUDGET,limited=false;
    for(const r of recent.concat(rest)){
      if(budget<=0)break;budget--;
      try{addDetail(r,await api(`/activities/${r.id}`));}
      catch(e){if(/limita/.test(e.message)){limited=true;break;}}
    }
    // marcas de más de un año: se buscan en el historial antiguo poco a poco
    if(!limited) await scanHistory(s,Math.min(HIST_BUDGET,budget+10));
    // zapatillas: Strava lleva el kilometraje total de cada par
    s.gear=s.gear||{};
    const ids=[...new Set(s.runs.filter(r=>r.gear&&r.date>=addDays(today(),-365)).map(r=>r.gear))].slice(0,8);
    for(const gid of ids){const g=s.gear[gid];if(g&&Date.now()-g.at<864e5)continue;try{const j=await api('/gear/'+gid);s.gear[gid]={name:String(j.name||j.model_name||'Zapatillas').slice(0,60),km:(j.distance||0)/1000,retired:!!j.retired,at:Date.now()};}catch(e){if(/limita/.test(e.message))break;}}
    syncStravaShoes();autoAssignShoes();
    if(!s.zonesAt||Date.now()-s.zonesAt>7*864e5){
      try{const z=await api('/athlete/zones');const hz=z&&z.heart_rate;if(hz&&hz.custom_zones&&Array.isArray(hz.zones)&&hz.zones.length===5)s.hrZones=hz.zones.map(x=>({min:x.min,max:x.max}));else s.hrZones=null;s.zonesAt=Date.now();}catch(e){}
    }
    const mx=robustMax(s.runs.map(r=>r.hrMax||0));
    if(mx) s.hrMax=mx;
    s.lastSync=Date.now();if(!s.firstSync)s.firstSync=s.lastSync;
    const res=afterSync();
    save();
    return Object.assign({added},res);
  }finally{syncing=false;setSyncUI();}
}

export function setSyncUI(msg){const el=document.getElementById('syncline');if(el)el.textContent=msg||syncLine();if(typeof setBusy==='function')setBusy(!!msg);}

export function syncLine(){
  const s=sv();
  if(!s.lastSync) return 'Strava conectado. Aún no se ha sincronizado.';
  const m=Math.round((Date.now()-s.lastSync)/60000);
  return `Strava · sincronizado ${m<1?'ahora mismo':m<60?`hace ${m} min`:m<1440?`hace ${Math.round(m/60)} h`:`hace ${Math.round(m/1440)} días`}`;
}
