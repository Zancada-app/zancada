/**
 * Objetivo: viabilidad, ritmo de carrera, trayectoria y avisos en el asistente.
 */
import { clamp, daysBetween, ft, today } from '../core/util.js';
import { GOALS } from './constants.js';
import { state } from '../core/store.js';
import { ageAdj } from './plan.js';
import { predictToday } from './load.js';
import { elevPen } from './elevation.js';
import { addEvent, adherence, regenerate } from './adapt.js';
import { formState } from './activities.js';

/* =========================================================
   Marca objetivo: viabilidad, trayectoria y previsión
   ========================================================= */
export const RATE={nuevo:0.012,intermedio:0.008,avanzado:0.005}; // mejora semanal razonable del ritmo

export const raceTime=(p,dist)=>p*5*Math.pow(dist/5,1.06);       // tiempo previsto en una distancia desde el ritmo de 5 km

export const p5From=(T,dist)=>T*Math.pow(5/dist,1.06)/5;

export const TARGET_PH={'5k':'25:00','10k':'50:00','21k':'1:50:00','42k':'3:59:00'};

export function goalEval(pr,p0,nWeeks){
  const g=GOALS[pr.goal];if(!g.dist||!pr.targetTime) return null;
  const pen=elevPen(pr);
  const pG=p5From(pr.targetTime/(1+pen),g.dist); // objetivo pasado a terreno llano
  const build=Math.max(1,nWeeks-g.taper);
  const possible=Math.min(0.15,RATE[pr.level]*ageAdj(pr).rateMult*build);
  const needed=1-pG/p0;
  const status=needed<=0?'ya':needed<=possible?'alcanzable':needed<=possible*1.4?'ambicioso':'poco realista';
  return {p0,pG,needed,possible,status,build,pen,current:raceTime(p0,g.dist)*(1+pen),realistic:raceTime(p0*(1-possible),g.dist)*(1+pen)};
}

export function goalInfo(){
  const pr=state.profile,pl=state.plan;
  if(!pr||!pl||!pl.goal||!pr.targetTime) return null;
  const G=pl.goal,g=GOALS[pr.goal],p=state.fitness.p;
  const eff=Math.min(Math.max(G.needed,0),G.possible*1.4);
  const weeksIn=daysBetween(pl.created,today())/7;
  const frac=clamp(weeksIn/G.build,0,1);
  const expected=G.p0*(1-eff*frac);
  const diff=p/expected-1;
  const pen=elevPen(pr);
  const pred=predictToday(p,g.dist)*(1+pen);
  const rem=Math.max(0,G.build-weeksIn);
  const forecast=raceTime(p*(1-Math.min(0.15,RATE[pr.level]*ageAdj(pr).rateMult*0.8*rem)),g.dist)*(1+pen);
  const prob=forecast<=pr.targetTime?'alta':forecast<=pr.targetTime*1.02?'media':'baja';
  const track=pred<=pr.targetTime?'cumplido':prob==='alta'&&diff<-0.01?'adelantado':prob==='baja'||diff>0.015?'por detrás':'en camino';
  const T0=G.current,Tt=pr.targetTime,Texp=raceTime(expected,g.dist)*(1+pen);
  const prog=T0>Tt?clamp((T0-pred)/(T0-Tt),0,1):1, progExp=T0>Tt?clamp((T0-Texp)/(T0-Tt),0,1):1;
  return {G,g,pred,forecast,expected,track,prob,prog,progExp,target:Tt};
}

export function trainP(){ // referencia para series/tempo: hasta un 2 % por delante de tu forma, siguiendo la trayectoria hacia el objetivo
  const p=state.fitness.p,gi=goalInfo();
  if(!gi||gi.track==='cumplido') return p;
  return Math.min(p,Math.max(gi.expected,p*0.98));
}

export function racePaceNow(){ // ritmo de carrera por km para las sesiones de ritmo y el día D
  const pr=state.profile,g=GOALS[pr.goal],p=state.fitness.p;
  const cur=raceTime(p,g.dist||5)/(g.dist||5);
  const gi=goalInfo();
  if(!gi) return {pace:p*g.rf,cur,goal:false};
  // en los entrenos se usa el ritmo equivalente en llano
  const tgt=(gi.G.status==='poco realista'?Math.max(gi.G.realistic,gi.forecast):pr.targetTime)/(1+elevPen(pr))/g.dist;
  return {pace:Math.max(tgt,cur*0.96),cur,goal:true,tgt};
}

export const TRACK_CLS={'cumplido':'ok','adelantado':'ok','en camino':'ok','por detrás':'w'};

export function goalCheck(){
  const gi=goalInfo();if(!gi||gi.track==='cumplido') return false;
  const ad=state.adapt,td=today(),pl=state.plan;
  if(daysBetween(pl.created,td)<21) return false;
  if(ad.lastGoalCheck&&daysBetween(ad.lastGoalCheck,td)<14) return false;
  ad.lastGoalCheck=td;
  const T=ft(gi.target);
  if(gi.track==='por detrás'){
    const a=adherence(21),f=formState();
    if(a.total>=3&&a.ratio<0.75) addEvent('down',`Revisión del objetivo: vas por detrás de la progresión hacia ${T}, sobre todo por las sesiones que no se han hecho (${a.done} de ${a.total}). La constancia es lo que más te acerca.`);
    else if(f&&f.tsb<-20) addEvent('down',`Revisión del objetivo: vas por detrás de la progresión hacia ${T}, pero la fatiga acumulada es alta. No añado carga: primero toca asimilar.`);
    else{ad.intensity=Math.min(1,ad.intensity+1);regenerate();addEvent('info',`Revisión del objetivo: vas por detrás de la progresión hacia ${T}. Añado algo más de calidad en las próximas semanas.`);}
    if(gi.forecast>gi.target*1.02) addEvent('down',`Con las semanas que quedan, ${T} es difícil. Un objetivo realista hoy sería ${ft(gi.forecast)}. Puedes cambiarlo en Perfil.`);
  }else if(gi.track==='adelantado'){
    addEvent('up',`Revisión del objetivo: vas por delante de lo previsto para ${T}. Si sigues así, podrías apuntar a ${ft(gi.forecast)}. Puedes cambiar el objetivo en Perfil.`);
  }else addEvent('up',`Revisión del objetivo: vas en camino hacia ${T}. Previsión si cumples el plan: ${ft(gi.forecast)}.`);
  return true;
}
