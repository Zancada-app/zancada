/**
 * Contenido de cada sesión: zonas de pulso, bloques (calentamiento, series, vuelta a la calma) y km.
 */
import { clamp, fm, fmin, fp, ft, r05, today } from '../core/util.js';
import { GOALS, RW, TYPES } from './constants.js';
import { state } from '../core/store.js';
import { wxFor } from './weather.js';
import { elevName, elevPen } from './elevation.js';
import { goalInfo, racePaceNow, raceTime, trainP } from './goal.js';
import { hrMaxNow } from './activities.js';

/* ---------- descripción de cada sesión con ritmos actuales ---------- */
/* ---------- Zonas de pulso ---------- */
export const HR_Z=[{n:1,name:'Recuperación',lo:0,hi:0.70},{n:2,name:'Suave',lo:0.70,hi:0.80},{n:3,name:'Moderado',lo:0.80,hi:0.87},{n:4,name:'Umbral',lo:0.87,hi:0.93},{n:5,name:'Máximo',lo:0.93,hi:1}];

export const LT_Z=[[0,0.85],[0.85,0.90],[0.90,0.95],[0.95,1.00],[1.00,null]]; // zonas de Friel sobre el umbral

export function hrSource(){
  if(state.hrm&&state.hrm.lthr) return 'lthr';
  if(state.strava&&state.strava.hrZones) return 'strava';
  return hrMaxNow()?'max':null;
}

export function hrBounds(n){ // [mín, máx] en ppm de la zona n (1–5)
  if(hrSource()==='lthr'){const L=state.hrm.lthr,z=LT_Z[n-1];return [Math.round(z[0]*L),z[1]?Math.round(z[1]*L):null];}
  const cz=state.strava&&state.strava.hrZones;
  if(cz) return [cz[n-1].min||0,cz[n-1].max>0?cz[n-1].max:null];
  const hm=hrMaxNow();if(!hm) return null;
  return [n===1?0:Math.round(HR_Z[n-1].lo*hm),n===5?null:Math.round(HR_Z[n-1].hi*hm)];
}

export function hrText(z1,z2){
  const zs=z1===z2?`Z${z1}`:`Z${z1}–Z${z2}`,a=hrBounds(z1),b=hrBounds(z2);
  if(a&&b) return z1===1&&b[1]?`${zs} (<${b[1]} ppm)`:!b[1]?`${zs} (>${a[0]} ppm)`:`${zs} (${a[0]}–${b[1]} ppm)`;
  return zs;
}

export const paceR=(lo,hi)=>Math.abs(hi-lo)<4?fp((lo+hi)/2):`${fp(lo)}–${fp(hi)}`;

/* ---------- Cada sesión: bloques con distancia o tiempo, ritmo y pulso ---------- */
export function describe(s){
  const p=state.fitness.p,pr=state.profile,g=GOALS[pr.goal],it=state.adapt.intensity;
  const qf=1-it*0.01,km=s.budget||s.km;
  const pq=state.plan?trainP():p, rpN=state.plan?racePaceNow():{pace:p*g.rf,goal:false};
  const E={lo:p*1.25,hi:p*1.40};             // suave (equivale al ritmo E de Daniels)
  const WU={lo:p*1.30,hi:p*1.45};            // calentar / enfriar
  const r={title:TYPES[s.type].n,rpe:3,lo:E.lo,hi:E.hi,pf:1.32,blocks:[],tips:[],dur:null};
  const B=(o)=>r.blocks.push(o);
  const cal=(d,extra)=>B({k:'cal',t:'Calentamiento',dist:d,lo:WU.lo,hi:WU.hi,z:[1,2],text:extra||''});
  const cool=d=>B({k:'cool',t:'Vuelta a la calma',dist:d,lo:WU.lo,hi:WU.hi*1.05,z:[1,1]});
  switch(s.type){
    case 'easy':
      B({k:'main',t:'Rodaje',dist:km,lo:E.lo,hi:E.hi,z:[2,2],text:'Ritmo de conversación.'});
      if(s.strides) B({k:'strides',t:'Rectas',reps:6,dist:0.08,lo:p*0.92,hi:p*0.97,z:null,rec:'vuelta andando',text:'Rápidas pero relajadas, sin apretar los dientes.'});
      r.tips.push('Si el pulso sube de Z2, baja el ritmo aunque parezca muy lento.');
      break;
    case 'long':{
      Object.assign(r,{rpe:5,hi:p*1.40,pf:1.32});
      const fin=s.rpFinish?Math.max(2,Math.min(6,Math.round(km*0.2))):0;
      B({k:'main',t:'Tirada',dist:km-fin,lo:E.lo,hi:E.hi,z:[2,2],text:(pr.raceElev||0)>=8&&g.dist?'Si puedes, por un recorrido con subidas parecido al de tu carrera.':'Constante y tranquilo.'});
      if(fin) B({k:'main',t:'Final a ritmo de carrera',dist:fin,lo:rpN.pace*0.99,hi:rpN.pace*1.01,z:[3,3]});
      if(km>=14) r.tips.push('Lleva agua o bebida si vas a pasar de 75 minutos.');
      r.tips.push('Importa el tiempo en pie, no la velocidad.');
      break;}
    case 'series':{
      const pf=g.spf*qf,reps=clamp(Math.round((km-3.5)/(g.rep+g.rec))+it,3,12),pace=pq*pf;
      Object.assign(r,{rpe:8,pf:pace/p,lo:pace*0.985,hi:pace*1.015});
      cal(2);B({k:'strides',t:'Rectas progresivas',reps:4,dist:0.08,lo:p*0.95,hi:p,z:null,rec:'vuelta al trote'});
      B({k:'main',t:'Series',reps,dist:g.rep,lo:r.lo,hi:r.hi,z:[4,5],rec:`${fm(g.rec)} trotando`,recDist:g.rec});
      cool(1.5);
      r.tips.push('La primera serie no debe ser la más rápida: busca que todas salgan iguales.','Si en las dos últimas no llegas al ritmo, corta ahí.');
      break;}
    case 'tempo':{
      const pf=1.07*qf,tk=clamp(km-3.5+it*0.5,2,12),pace=pq*pf;
      Object.assign(r,{rpe:7,pf:pace/p,lo:pace*0.985,hi:pace*1.015});
      cal(2);B({k:'main',t:'Tempo',dist:tk,lo:r.lo,hi:r.hi,z:[4,4],text:'Exigente pero controlado: puedes decir frases cortas.'});cool(1.5);
      r.tips.push('Mejor un poco lento y constante que rápido y fundido al final.');
      break;}
    case 'ritmo':{
      const rp=rpN.pace,wk=clamp(km-3.5,2,22);
      Object.assign(r,{rpe:7,pf:rp/p,lo:rp*0.99,hi:rp*1.01});
      cal(2);
      if(pr.goal==='5k') B({k:'main',t:'Bloques a ritmo de carrera',reps:Math.max(2,Math.round(wk/1.6)),dist:1.6,lo:r.lo,hi:r.hi,z:[4,4],rec:'400 m suaves',recDist:0.4});
      else if(pr.goal==='10k') B({k:'main',t:'Bloques a ritmo de carrera',reps:Math.max(2,Math.round(wk/2)),dist:2,lo:r.lo,hi:r.hi,z:[3,4],rec:'400 m suaves',recDist:0.4});
      else B({k:'main',t:'Ritmo de carrera',dist:wk,lo:r.lo,hi:r.hi,z:[3,3]});
      cool(1.5);
      if(rpN.goal) r.tips.push(rp>rpN.tgt+1?`Tu ritmo objetivo es ${fp(rpN.tgt)} /km. Hoy entrenas un poco por encima; se irá acercando a medida que mejores.`:'Es el ritmo de tu marca objetivo: aprende a sentirlo.');
      break;}
    case 'fartlek':{
      const pf=1.03*qf,reps=clamp(Math.round((km-3)/0.45)+it,5,15),pace=pq*pf;
      Object.assign(r,{rpe:6,pf:pace/p,lo:pace*0.98,hi:pace*1.03});
      B({k:'cal',t:'Calentamiento',dur:900,lo:WU.lo,hi:WU.hi,z:[1,2]});
      B({k:'main',t:'Cambios de ritmo',reps,dur:60,lo:r.lo,hi:r.hi,z:[4,4],rec:'1 min suave',recDur:60});
      B({k:'cool',t:'Vuelta a la calma',dur:600,lo:WU.lo,hi:WU.hi*1.05,z:[1,1]});
      r.tips.push('Es un juego: el minuto rápido, alegre pero sin llegar al límite.');
      break;}
    case 'cuestas':{
      const reps=clamp(6+Math.floor(s.week/2)+it,5,12);
      Object.assign(r,{rpe:7,pf:null});
      cal(2.5,'Hasta una cuesta de pendiente moderada (5–8 %).');
      B({k:'main',t:'Cuestas',reps,dur:45,lo:null,hi:null,z:[4,5],rec:'bajada al trote',recDur:90,text:'Con energía: rodillas arriba y brazos activos.'});
      B({k:'main',t:'Rodaje suave',dist:Math.max(1,km-2.5-reps*0.35-1),lo:E.lo,hi:E.hi,z:[2,2]});
      cool(1);
      r.tips.push('La fuerza que ganas aquí se nota en las series de las próximas semanas.');
      break;}
    case 'test':
      Object.assign(r,{rpe:9,pf:1,lo:p*0.98,hi:p*1.02});
      cal(2);B({k:'strides',t:'Rectas',reps:4,dist:0.08,lo:p*0.95,hi:p,z:null,rec:'vuelta al trote'});
      B({k:'main',t:'Test',dist:5,lo:r.lo,hi:r.hi,z:[4,5],text:'Lo más rápido que puedas sostener de forma regular.'});
      cool(1);
      r.tips.push('Elige un recorrido llano. Con el tiempo de los 5 km recalculo todos tus ritmos.');
      break;
    case 'race':{
      const pen=elevPen(pr),T=raceTime(p,g.dist)*(1+pen),gi=state.plan?goalInfo():null;
      const go=gi&&gi.target>=T*0.985?gi.target:T,pace=go/g.dist;
      Object.assign(r,{rpe:9,pf:pace/p,lo:pace*0.99,hi:pace*1.01});
      if(g.dist<=10){cal(2,'Más 4 rectas cortas 10 minutos antes de la salida.');}
      else B({k:'cal',t:'Calentamiento',dur:600,lo:WU.lo,hi:WU.hi,z:[1,1],text:'Solo 10 minutos muy suaves: guarda energía.'});
      const first=Math.min(2,g.dist*0.1);
      B({k:'main',t:'Salida',dist:first,lo:pace*1.01,hi:pace*1.02,z:[3,4],text:'Algo más lento: no te dejes llevar por la gente.'});
      B({k:'main',t:'Carrera',dist:g.dist-first,lo:r.lo,hi:r.hi,z:[4,5],text:`Meta prevista: ${ft(go)}.`});
      if(gi&&go!==gi.target) r.tips.push(`Tu objetivo era ${ft(gi.target)}, pero tu forma de hoy da para ${ft(T)}. Sal a ${fp(T/g.dist)} /km y, si a mitad de carrera vas sobrado, aprieta.`);
      if(pen>0.008) r.tips.push(`Recorrido ${elevName(pr.raceElev).toLowerCase()}: es un ritmo medio. En las subidas ve por esfuerzo, no por ritmo, y recupera en las bajadas.`);
      r.tips.push('Nada nuevo hoy: ni zapatillas, ni geles, ni desayuno.');
      break;}
    case 'runwalk':{
      const base=RW[clamp((state.plan.rwStart||0)+s.week+it,0,RW.length-1)];
      const st=[base[0],base[1],base[2]+(s.rwLong?(base[0]>=10?1:2):0)];
      Object.assign(r,{rpe:4,lo:p*1.3,hi:p*1.48,pf:null});
      B({k:'cal',t:'Andar a buen paso',dur:300,lo:null,hi:null,z:[1,1]});
      B({k:'main',t:'Correr y andar',reps:st[2],dur:st[0]*60,lo:r.lo,hi:r.hi,z:[2,2],rec:`${fmin(st[1])} andando`,recDur:st[1]*60,text:'Corre tan suave que podrías hablar.'});
      B({k:'cool',t:'Andar',dur:300,lo:null,hi:null,z:[1,1]});
      r.tips.push('Si un día cuesta, repite la semana anterior: no hay prisa.');
      break;}
  }
  // ajustes del día: «suavizar» quita volumen y deja los ritmos en la parte cómoda del rango
  if(s.mod&&s.mod.kind==='soft'){
    r.blocks.forEach(b=>{if(b.k!=='main')return;if(b.reps>1)b.reps=Math.max(2,Math.round(b.reps*0.75));else if(b.dist)b.dist=Math.max(1.5,Math.round(b.dist*0.75*2)/2);if(b.lo){b.lo*=1.02;b.hi*=1.02;}});
    r.lo*=1.02;r.hi*=1.02;r.tips.unshift('Sesión suavizada por cómo estás hoy: menos volumen y ritmos en la parte cómoda del rango.');
  }
  if(s.mod&&s.mod.kind==='short') r.tips.unshift('Sesión acortada a 30 minutos.');
  // calor: mismo esfuerzo, ritmos más lentos
  const w=typeof wxFor==='function'?wxFor(s.date):null;
  if(w&&w.adj>0&&s.type!=='runwalk'&&s.date>=today()){
    r.blocks.forEach(b=>{if(b.lo){b.lo*=1+w.adj;b.hi*=1+w.adj;}});r.lo*=1+w.adj;r.hi*=1+w.adj;if(r.pf)r.pf*=1+w.adj;
    r.tips.unshift(`Previsión de ${Math.round(w.t)} °C con punto de rocío de ${Math.round(w.td)} °C a tu hora: ritmos un ${(w.adj*100).toFixed(1).replace('.',',')} % más lentos para el mismo esfuerzo. Bebe antes y durante.`);
  }
  r.wx=w;
  // que quepa en el tiempo disponible entre semana: se acorta calentamiento, vuelta a la calma, rodaje y, por último, repeticiones
  const capMod=s.mod&&s.mod.kind==='short'?30:0,cap=capMod||+(pr.maxMin||0);
  if(cap&&(capMod?!['race','runwalk'].includes(s.type):!['long','race','runwalk','test','easy'].includes(s.type))){
    let guard=0;
    while(blocksLen(r.blocks,p,WU).sec/60>cap&&guard++<60){
      const wu=r.blocks.find(b=>b.k==='cal'&&b.dist>1);if(wu){wu.dist=Math.max(1,wu.dist-0.5);continue;}
      const cd=r.blocks.find(b=>b.k==='cool'&&b.dist>1);if(cd){cd.dist=Math.max(1,cd.dist-0.5);continue;}
      const wt=r.blocks.find(b=>b.k==='cal'&&b.dur>300);if(wt){wt.dur-=120;continue;}
      const ct=r.blocks.find(b=>b.k==='cool'&&b.dur>300);if(ct){ct.dur-=120;continue;}
      const ez=r.blocks.find(b=>b.k==='main'&&!b.reps&&b.lo&&b.lo>=E.lo*0.99&&b.dist>1);if(ez){ez.dist=Math.max(1,ez.dist-0.5);continue;}
      const st=r.blocks.findIndex(b=>b.k==='strides');if(st>=0){r.blocks.splice(st,1);continue;}
      const m=r.blocks.find(b=>b.k==='main'&&b.reps>2);if(m){m.reps--;continue;}
      const mc=r.blocks.find(b=>b.k==='main'&&(b.reps||1)<=2&&b.dist>1.5);if(mc){mc.dist=Math.max(1.5,mc.dist-0.5);continue;}
      const m2=r.blocks.find(b=>b.k==='main'&&b.reps===2);if(m2){m2.reps=1;continue;}
      break;
    }
  }
  const L2=blocksLen(r.blocks,p,WU);
  r.dur=Math.round(L2.sec/60);r.estKm=L2.dist;
  r.lines=r.blocks.map(blockText).concat(r.tips);
  return r;
}

export function blocksLen(blocks,p,WU){
  let sec=0,dist=0;
  blocks.forEach(b=>{
    const n=b.reps||1,mid=b.lo&&b.hi?(b.lo+b.hi)/2:p*1.45;
    const one=b.dur||(b.dist||0)*mid;
    sec+=n*one;dist+=n*(b.dist||(b.dur?b.dur/mid:0));
    if(b.reps&&b.reps>1){sec+=(b.reps-1)*(b.recDur||(b.recDist||0)*WU.hi);dist+=(b.reps-1)*(b.recDist||(b.recDur?b.recDur/(WU.hi*1.1):0));}
  });
  return {sec,dist};
}

// km mostrados de las sesiones pendientes = suma real de sus bloques con los ritmos y ajustes actuales
export const STRUCT=['series','tempo','ritmo','fartlek','cuestas','test'];

export function refreshKm(){if(!state.plan)return;state.sessions.forEach(s=>{if(s.status==='pending'&&STRUCT.includes(s.type)){if(!s.budget)s.budget=s.km;s.km=r05(describe(s).estKm);}});}

export function blockText(b){
  const len=b.dist?fm(b.dist):b.dur?(b.dur>=60?`${Math.round(b.dur/60)} min`:`${b.dur} s`):'';
  const what=b.reps>1?`${b.reps} × ${len}`:len;
  return `${b.t}: ${what}${b.lo?` a ${paceR(b.lo,b.hi)} /km`:''}${b.rec?`, recuperando ${b.rec}`:''}.`;
}
