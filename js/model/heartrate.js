/**
 * Modelo de pulso: FC máx robusta, umbral (LTHR) y estimación de forma a partir del pulso.
 */
import { addDays, clamp, daysBetween, fdShort, today } from '../core/util.js';
import { state } from '../core/store.js';
import { hrSpeedFit } from './load.js';
import { addEvent, setFitness } from './adapt.js';
import { hrMaxNow } from './activities.js';

/* =========================================================
   Pulso medido: umbral (LTHR), FC máxima y ritmos desde la relación pulso–ritmo
   ========================================================= */
// FC máxima observada sin picos falsos: si la más alta supera en más de 6 ppm a la siguiente, se descarta
export function robustMax(vals){
  const v=vals.filter(x=>x>120&&x<225).sort((a,b)=>b-a);
  if(!v.length) return null;
  return v.length>1&&v[0]-v[1]>6?v[1]:v[0];
}

// Fuentes para estimar el umbral de pulso (Friel): esfuerzos sostenidos con pulso registrado
export function lthrCandidates(){
  const out=[],from=addDays(today(),-120);
  const factor=min=>min<14?null:min<35?1.04:min<70?1.01:min<140?0.97:0.92; // pulso medio de carrera respecto al umbral
  const runs=state.strava?state.strava.runs:[];
  runs.filter(r=>r.date>=from&&r.hr).forEach(r=>{
    const ses=r.sessionId?state.sessions.find(x=>x.id===r.sessionId):null;
    const t=ses?ses.type:null,min=r.sec/60;
    if(r.race||t==='race'){
      const f=factor(min);if(f) out.push({v:r.hr/f,date:r.date,label:'carrera'});
    }else if(t==='test'){
      // solo los km rápidos del test: el pulso medio de un 5 km a tope ronda el 103 % del umbral
      const segs=(r.laps.length>=3?r.laps:r.splits).filter(x=>x.hr),avg=r.sec/r.km,w=segs.filter(x=>x.sec/x.km<avg*0.97);
      const ws=w.reduce((a,x)=>a+x.sec,0);if(ws>=14*60) out.push({v:w.reduce((a,x)=>a+x.hr*x.sec,0)/ws/1.03,date:r.date,label:'test de 5 km'});
    }else if(t==='tempo'||t==='ritmo'){
      // segunda mitad de la parte rápida: el pulso ya se ha estabilizado en el umbral
      const segs=(r.laps.length>=3?r.laps:r.splits).filter(x=>x.hr&&x.km>=0.2);
      if(segs.length>=3){
        const avg=r.sec/r.km,work=segs.filter(x=>(x.gap||x.sec/x.km)<avg*0.97);
        const wsec=work.reduce((a,x)=>a+x.sec,0);
        if(wsec>=12*60){const half=work.slice(Math.floor(work.length/2));const hr=half.reduce((a,x)=>a+x.hr*x.sec,0)/half.reduce((a,x)=>a+x.sec,0);
          out.push({v:t==='ritmo'&&state.profile&&['21k','42k'].includes(state.profile.goal)?hr/0.96:hr,date:r.date,label:t==='tempo'?'tempo':'sesión a ritmo de carrera'});}
      }
    }
  });
  (state.manual||[]).filter(m=>m.date>=from&&m.hr&&m.type==='race').forEach(m=>{const f=factor(m.time/60);if(f)out.push({v:m.hr/f,date:m.date,label:'competición'});});
  return out.filter(c=>c.v>110&&c.v<215);
}

export function updateHR(){
  const H=state.hrm=state.hrm||{lthr:null,date:null,label:null,max:null,hist:[]};
  const runs=state.strava?state.strava.runs:[];
  const yr=addDays(today(),-365);
  const mx=robustMax(runs.filter(r=>r.date>=yr).map(r=>r.hrMax||0).concat((state.manual||[]).map(m=>m.hrMax||0)));
  if(mx) H.max=mx;
  const c=lthrCandidates();
  if(!c.length) return false;
  // el esfuerzo más alto reciente es el que mejor representa el umbral (los submáximos lo subestiman)
  let best=c.reduce((a,b)=>b.v>a.v?b:a);
  const hm=hrMaxNow();
  let v=Math.round(hm?Math.min(best.v,hm*0.95):best.v);
  if(H.lthr&&Math.abs(v-H.lthr)<2) return false;
  const old=H.lthr;
  H.lthr=v;H.date=best.date;H.label=best.label;H.hist.push({date:today(),v});H.hist=H.hist.slice(-20);
  if(state.adapt) addEvent('info',old?`Zonas de pulso actualizadas con tu ${best.label} del ${fdShort(best.date)}: tu umbral pasa de ${old} a ${v} ppm.`:`He medido tu umbral de pulso con tu ${best.label} del ${fdShort(best.date)}: ${v} ppm. Tus zonas de pulso ahora salen de ahí.`);
  return true;
}

export const lthrNow=()=>{const H=state.hrm;if(H&&H.lthr)return H.lthr;const hm=hrMaxNow();return hm?Math.round(hm*0.89):null;};

// Ritmos desde el pulso: en tus carreras constantes, la velocidad crece casi en línea recta con el pulso.
// Extrapolando al umbral sale tu ritmo de umbral, y de ahí tu forma en 5 km.
export function fitnessFromHR(){
  const ad=state.adapt,td=today();
  if(!state.fitness||!ad) return false;
  if(ad.lastHRFit&&daysBetween(ad.lastHRFit,td)<7) return false;
  const f=hrSpeedFit();
  if(!f||f.maxX<0.92) return false; // sin esfuerzos cerca del umbral no se extrapola
  let pEst=(1000/(f.a+f.b*1.0))/1.07;const p=state.fitness.p;
  // un test o una carrera recientes mandan: el pulso solo afina ±2 % alrededor de esa medición
  const meas=state.fitness.history.filter(h=>h.date>=addDays(td,-28)&&/Test|Carrera|Competición/.test(h.why||'')).pop();
  if(meas) pEst=clamp(pEst,meas.p*0.98,meas.p*1.02);
  if(!(pEst>150&&pEst<720)||Math.abs(pEst/p-1)<0.02) return false;
  ad.lastHRFit=td;
  return setFitness(p+(pEst-p)*0.3,pEst<p?'En tus últimos entrenos corres más rápido con el mismo pulso':'En tus últimos entrenos te cuesta más pulso ir al mismo ritmo (cansancio, calor o pérdida de forma)');
}
