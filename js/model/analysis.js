/**
 * Análisis de una sesión hecha frente a lo planificado (ritmos, pulso, bloques).
 */
import { fk, fp, ft } from '../core/util.js';
import { state } from '../core/store.js';
import { describe, hrBounds, paceR } from './workouts.js';
import { loadParts, perfOf } from './load.js';
import { gapFromElev } from './elevation.js';
import { hrMaxNow } from './activities.js';

/* =========================================================
   Análisis de cada sesión
   ========================================================= */
export function runOf(s){return s.log&&s.log.strava&&state.strava?state.strava.runs.find(r=>r.id===s.log.strava):null;}

export function snapOf(s){
  // referencia guardada al registrar; si no existe (registros antiguos), la actual
  if(s.snap&&s.snap.main) return s.snap;
  const d=describe(s),m=d.blocks.filter(b=>b.k==='main');
  return {title:d.title,lo:d.lo,hi:d.hi,rpe:d.rpe,km:s.km,main:m.map(b=>({t:b.t,reps:b.reps||1,dist:b.dist||null,dur:b.dur||null,lo:b.lo,hi:b.hi}))};
}

export function analyze(s){
  if(s.status!=='done'||!s.log) return null;
  const sn=snapOf(s),r=runOf(s),p=state.fitness.p,hm=hrMaxNow();
  const items=[],notes=[];let laps=null;
  const add=(ok,label,text)=>items.push({ok,label,text});
  const km=s.log.km||null,time=s.log.time||null,pace=km&&time?time/km:null;
  // 1) distancia
  const planKm=s.type==='test'?5:sn.km||s.km;
  if(km&&s.type!=='runwalk'&&s.type!=='cuestas'&&s.type!=='fartlek'){
    const ratio=km/planKm;
    add(ratio>=0.9&&ratio<=1.2?true:ratio<0.75?false:'warn','Distancia',`${fk(km)} de ${fk(planKm)} km previstos${ratio<0.9?` (${Math.round((1-ratio)*100)} % menos)`:ratio>1.2?` (${Math.round((ratio-1)*100)} % más)`:''}.`);
  }
  const easyType=['easy','long'].includes(s.type);
  const mains=(sn.main||[]).filter(b=>b.lo);
  const mainB=s.type==='race'?mains[mains.length-1]||null:mains[0]||null;
  // 2) ritmo
  if(s.type==='runwalk'){
    const plan=describe(s).dur;
    if(time) add(time/60>=plan*0.85?true:time/60>=plan*0.6?'warn':false,'Duración',`${Math.round(time/60)} de ${plan} minutos previstos.`);
    notes.push('En correr y andar no miro el ritmo: lo importante es completar los bloques sin ahogarte.');
  }else if(s.type==='cuestas'){
    notes.push('En las cuestas cuenta el esfuerzo, no el ritmo: por eso no analizo el ritmo de esta sesión.');
  }else if(easyType){
    const lo=sn.lo,hi=sn.hi;
    // en tiradas con final a ritmo de carrera, los últimos km no cuentan como suaves
    const finKm=s.rpFinish?Math.round((sn.main||[]).filter(b=>/carrera/i.test(b.t)).reduce((a,b)=>a+(b.dist||0),0)):0;
    let segs=r&&r.splits.length?r.splits.filter(x=>x.km>=0.5):[];
    if(finKm&&segs.length>finKm) segs=segs.slice(0,segs.length-finKm);
    if(segs.length>=2){
      const pc=x=>x.gap||x.sec/x.km,useGap=segs.some(x=>x.gap&&Math.abs(x.gap/(x.sec/x.km)-1)>0.03);
      const fast=segs.filter(x=>pc(x)<lo*0.97).length;
      add(fast/segs.length<=0.25?true:fast/segs.length<=0.5?'warn':false,'Ritmo suave',(fast?`${fast} de ${segs.length} km por debajo de ${fp(lo)} /km: más rápido de lo que toca.`:`Todos los km en ritmo suave o más lento. Bien hecho.`)+(useGap?' Ritmos ajustados por la pendiente.':''));
      laps=segs.map((x,i)=>({n:i+1,km:x.km,pace:pc(x),hr:x.hr,st:pc(x)<lo*0.97?'rápido':pc(x)>hi*1.12?'lento':'ok'}));
    }else if(pace){
      const gp=s.log.gap||gapFromElev(time,km,s.log.elev)||pace;
      add(gp>=lo*0.97?true:'warn','Ritmo suave',gp>=lo*0.97?`Media de ${fp(gp)} /km${gp!==pace?' (ajustado por desnivel)':''}, dentro de lo suave.`:`Media de ${fp(gp)} /km: más rápido que tu zona suave (${paceR(lo,hi)}).`);
    }
    if(hrBounds(2)&&segs.length>=2&&segs.every(x=>x.hr)){
      const hi80=hrBounds(2)[1],over=segs.filter(x=>x.hr>hi80).length;
      add(over/segs.length<=0.25?true:'warn','Pulso',over?`${over} de ${segs.length} km por encima de ${Math.round(hi80)} ppm (Z2).`:`Siempre en Z2 o por debajo.`);
      if(segs.length>=6){ // desacople aeróbico: eficiencia (velocidad/pulso) 1.ª mitad vs 2.ª
        const h=Math.floor(segs.length/2),ef=a=>a.reduce((x,y)=>x+y.km,0)/a.reduce((x,y)=>x+y.sec,0)/(a.reduce((x,y)=>x+y.hr*y.km,0)/a.reduce((x,y)=>x+y.km,0));
        const dec=ef(segs.slice(0,h))/ef(segs.slice(h))-1;
        add(dec<=0.05?true:'warn','Desacople',dec<=0.05?`Pulso estable de principio a fin (${(dec*100).toFixed(1).replace('.',',')} %): buena base aeróbica.`:`El pulso subió un ${(dec*100).toFixed(1).replace('.',',')} % para el mismo ritmo en la segunda mitad. Con calor es normal; si no, falta base: los suaves, más suaves.`);
      }
    }
  }else if(mainB&&(s.type==='test'||s.type==='race')){
    const target=s.type==='test'?(mainB.lo+mainB.hi)/2:(mainB.lo+mainB.hi)/2;
    if(pace){const d=pace/target-1;add(d<=0.01?true:d<=0.04?'warn':false,'Resultado',`${ft(time)} a ${fp(pace)} /km (referencia ${fp(target)} /km). ${d<-0.01?'¡Mejor de lo previsto!':d<=0.01?'Justo lo previsto.':'Algo por debajo de lo previsto.'}`);}
  }else if(mainB){
    const lo=mainB.lo,hi=mainB.hi,easyLo=p*1.22;
    let segs=r?(r.laps.length>=3?r.laps:r.splits).filter(x=>x.km>=0.1):[];
    const auto=segs.length>=3&&segs.filter(x=>Math.abs(x.km-1)<0.03).length>=segs.length*0.7;
    const repDist=mainB.dist;
    if(segs.length&&auto&&((repDist&&repDist<0.9)||mainB.dur)){
      notes.push('Tu reloj marcó vueltas automáticas cada km, así que no puedo ver cada serie. Pulsa vuelta al empezar y al acabar cada serie (o crea el entreno en el reloj) y la próxima vez te las analizo una a una.');
      segs=[];
    }
    // separar trabajo y recuperación: mayor salto entre ritmos ordenados (si es claro); si no, umbral fijo
    let cut=(easyLo+hi)/2;
    if(segs.length>=3){
      const ps=segs.map(x=>x.sec/x.km).sort((a,b)=>a-b);let best=0,at=null;
      for(let i=0;i<ps.length-1;i++){const g=ps[i+1]/ps[i]-1;if(g>best){best=g;at=(ps[i]+ps[i+1])/2;}}
      if(best>=0.06&&at) cut=Math.min(at,easyLo);
    }
    const work=segs.filter(x=>x.sec/x.km<cut);
    if(work.length){
      laps=work.map((x,i)=>{const pc=x.sec/x.km;return {n:i+1,km:x.km,pace:pc,hr:x.hr,st:pc<lo*0.98?'rápida':pc>hi*1.02?'lenta':'ok'};});
      const ok=laps.filter(x=>x.st==='ok').length,slow=laps.filter(x=>x.st==='lenta').length,fast=laps.filter(x=>x.st==='rápida').length;
      add(ok>=laps.length*0.7?true:slow>laps.length/2?false:'warn','Ritmo de trabajo',`${ok} de ${laps.length} en ritmo (${paceR(lo,hi)} /km)${fast?`, ${fast} más rápidas`:''}${slow?`, ${slow} más lentas`:''}.`);
      if(mainB.reps>1&&!auto) add(laps.length>=mainB.reps?true:laps.length>=mainB.reps*0.75?'warn':false,'Repeticiones',`${laps.length} de ${mainB.reps} hechas.`);
      if(laps.length>=4){
        const t=Math.max(1,Math.floor(laps.length/3)),avg=a=>a.reduce((x,y)=>x+y.pace,0)/a.length;
        const fade=avg(laps.slice(-t))/avg(laps.slice(0,t))-1;
        add(fade<=0.03?true:'warn','Regularidad',fade<=-0.01?'Acabaste más rápido que empezaste: gestión perfecta.':fade<=0.03?'Ritmo regular de principio a fin.':`Las últimas fueron un ${Math.round(fade*100)} % más lentas que las primeras: sal un poco más contenido.`);
      }
    }else if(s.log.workPace){
      const d=s.log.workPace/((lo+hi)/2)-1;
      add(Math.abs(d)<=0.02?true:'warn','Ritmo de trabajo',`Parte rápida a ${fp(s.log.workPace)} /km (objetivo ${paceR(lo,hi)}).`);
    }else if(!r) notes.push('Para analizar cada serie hacen falta los datos de Strava, o al menos el ritmo medio de la parte rápida al registrar.');
  }
  // 3) esfuerzo
  if(s.log.rpe&&s.log.rpeSrc!=='previsto'&&sn.rpe){
    const d=s.log.rpe-sn.rpe;
    add(Math.abs(d)<=1?true:'warn','Esfuerzo',`${s.log.rpe}/10${s.log.rpeSrc==='fc'?' (por pulso)':''} frente a ${sn.rpe}/10 previsto${d>=2?': te costó más de la cuenta':d<=-2?': te resultó fácil':''}.`);
  }
  if(r&&r.hr){const pf=perfOf(r);if(pf) add(pf.v>=0.97?true:'warn','Rendimiento',`${Math.round(pf.v*100)} % (${pf.label}): ritmo frente a lo esperado con tu pulso de hoy.`);}
  const act={km:km||s.km,sec:time,hr:s.log.hr,elev:s.log.elev,gap:s.log.gap,rpe:s.log.rpe},lp=loadParts(act,p);
  if(lp.load) notes.unshift(`Carga de la sesión: ${Math.round(lp.load)} (calculada con ${lp.src}).`);
  const bad=items.filter(x=>x.ok===false).length,warn=items.filter(x=>x.ok==='warn').length;
  const verdict=bad?['Incompleta','q']:warn?['Cumplida con matices','w']:['Cumplida','ok'];
  return {verdict,items,laps,notes,changes:s.log.events||[]};
}
