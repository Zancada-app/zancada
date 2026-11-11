/**
 * Fuerza y movilidad: rutinas A/B, días asignados y series según la fase.
 */
import { addDays, daysBetween, monday, today } from '../core/util.js';
import { QUALITY } from './constants.js';
import { state } from '../core/store.js';
import { curWeek } from './adapt.js';
import { inactive } from './calendar.js';

/* =========================================================
   Fuerza y movilidad
   ========================================================= */
export const STRENGTH={
  A:{n:'Fuerza A',ex:[['Sentadilla',12],['Zancada hacia atrás (por pierna)',10],['Puente de glúteo',15],['Elevación de talones a una pierna',12],['Plancha frontal','30 s'],['Plancha lateral (por lado)','25 s']]},
  B:{n:'Fuerza B',ex:[['Peso muerto a una pierna',10],['Subida a un banco (por pierna)',10],['Sentadilla búlgara (por pierna)',8],['Puente a una pierna (por pierna)',10],['Bicho muerto',10],['Saltitos de tobillo','20 s']]}
};

export const MOBILITY=['Balanceos de pierna adelante y atrás (10 por pierna)','Círculos de cadera (10 por lado)','Estocada con giro de tronco (5 por lado)','Gato–camello (8)','Estiramiento de gemelo en pared (30 s por pierna)','Estiramiento de flexor de cadera (30 s por lado)'];

export function strengthDays(mon){
  const pr=state.profile;if(!pr||pr.strength===false||!state.plan) return [];
  const cw=Math.floor(daysBetween(state.plan.start,mon)/7),c=state.plan.curve[cw];if(!c) return [];
  const ses=state.sessions.filter(s=>s.date>=mon&&s.date<=addDays(mon,6)&&!inactive(s));
  if(ses.some(s=>s.type==='race')) return [];
  const want=c.phase==='puesta a punto'?1:2;
  const isHard=d=>ses.some(s=>s.date===d&&(QUALITY.includes(s.type)||s.type==='long'));
  const cand=[];
  for(let i=0;i<7;i++){const d=addDays(mon,i),run=ses.find(s=>s.date===d);if(d<state.plan.created)continue;
    let sc=run?(run.type==='easy'?1:-5):2;if(isHard(addDays(d,1)))sc-=3;if(isHard(d))sc-=5;cand.push({d,sc});}
  cand.sort((a,b)=>b.sc-a.sc||(a.d<b.d?-1:1));
  const out=[];
  for(const x of cand){if(out.length>=want)break;if(x.sc<0)break;if(out.every(o=>Math.abs(daysBetween(o,x.d))>=2))out.push(x.d);}
  return out.sort().map((d,i)=>({date:d,key:i%2?'B':'A'}));
}

export function strengthToday(){const td=today();return strengthDays(monday(td)).find(x=>x.date===td)||null;}

export function strengthSets(){
  const c=state.plan&&state.plan.curve[curWeek()],lvl=state.profile.level;
  if(!c) return 2;return c.phase==='puesta a punto'?1:lvl==='nuevo'||c.phase==='base'?2:3;
}
