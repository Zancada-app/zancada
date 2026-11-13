/**
 * Estado del día: nota de preparación a partir del chequeo y ajuste de la sesión («No estoy al 100 %»).
 */
import { DAYS_L, addDays, clamp, daysBetween, dow, r05, today } from '../core/util.js';
import { QUALITY } from './constants.js';
import { state } from '../core/store.js';
import { STRUCT, describe } from './workouts.js';
import { addEvent } from './adapt.js';
import { formState } from './activities.js';
import { startPause } from './calendar.js';
import { addPeriodStart, askSymptoms, cycle, cycleOn, cycleSchedule, phaseOf } from './cycle.js';
import { xtHardOn, xtName } from './xtrain.js';

/* =========================================================
   Estado del día: chequeo rápido + carga + recuperación → hazla / suavízala / descansa
   ========================================================= */
export const CHK=[
  ['sleep','Sueño',[[3,'Bien'],[2,'Regular'],[1,'Mal']]],
  ['legs','Piernas',[[3,'Frescas'],[2,'Normales'],[1,'Cargadas']]],
  ['stress','Estrés',[[3,'Bajo'],[2,'Normal'],[1,'Alto']]],
  ['pain','Molestias',[[3,'Ninguna'],[2,'Leve'],[1,'Dolor']]]
];

/** Filas del chequeo de un día: las fijas y, si toca, los síntomas del ciclo. */
export function chkRows(date=today()){
  if(!askSymptoms(date)) return CHK;
  const c=cycle(),lbl=c.mode==='otro'?'Síntomas hormonales':'Síntomas de regla';
  return CHK.concat([['cyc',lbl,[[3,'Ninguno'],[2,'Leves'],[1,'Fuertes']]]]);
}

export function readiness(date){
  const c=(state.checkins||{})[date];if(!c) return null;
  let sc=72;const why=[];
  const f=formState();if(f){sc+=clamp(f.tsb,-30,20)*0.6;if(f.tsb<-15)why.push('carga acumulada alta');}
  const y=addDays(date,-1),hardY=state.sessions.some(s=>s.date===y&&s.status==='done'&&(QUALITY.includes(s.type)||s.type==='long'));
  const xy=!hardY&&xtHardOn(y);
  if(hardY){sc-=12;why.push('ayer fue un día exigente');}
  else if(xy){sc-=10;why.push(`ayer hiciste ${xtName(xy).toLowerCase()} exigente`);}
  sc+={3:6,2:0,1:-16}[c.sleep];if(c.sleep===1)why.push('has dormido mal');
  sc+={3:6,2:0,1:-16}[c.legs];if(c.legs===1)why.push('piernas cargadas');
  sc+={3:3,2:0,1:-10}[c.stress];if(c.stress===1)why.push('estrés alto');
  sc+={3:0,2:-15,1:-60}[c.pain];if(c.pain===2)why.push('molestia leve');if(c.pain===1)why.push('dolor');
  if(c.cyc){const w=(cycle()&&cycle().mode==='otro')?'síntomas hormonales':'síntomas de regla';sc+={3:0,2:-8,1:-25}[c.cyc];if(c.cyc===2)why.push(w+' leves');if(c.cyc===1)why.push(w+' fuertes');}
  sc=Math.round(clamp(sc,0,100));
  let v=c.pain===1?'rest':sc>=65?'go':sc>=45?'soft':'easy';
  if(c.cyc===1&&v==='go')v='soft';
  return {sc,v,why};
}

export const MOD_N={soft:'suavizada',easy:'cambiada por rodaje suave',short:'acortada a 30 minutos',rest:'descanso'};

export function applyMod(s,kind,why){
  if(!s||s.status!=='pending') return;
  if(kind==='short'&&s.type==='test') kind='easy'; // un test no se puede acortar: mejor otro día
  if(kind==='rest'){s.status='rested';s.mod={kind,why};addEvent('info',`Descanso el ${DAYS_L[dow(s.date)]} (${why}). No cuenta como sesión saltada.`);return;}
  if(kind==='easy'&&s.type!=='easy'&&s.type!=='race'){s.origType=s.type;s.type='easy';s.km=r05(Math.min(s.km,6));s.budget=s.km;s.converted=true;}
  s.mod={kind,why};
  if(STRUCT.includes(s.type)||kind==='short'){if(!s.budget)s.budget=s.km;s.km=r05(describe(s).estKm);}
  addEvent('info',`Sesión del ${DAYS_L[dow(s.date)]} ${MOD_N[kind]} (${why}).`);
}

export function doNot100(s,v){
  const td=today(),ad=state.adapt;
  if(v==='tired') applyMod(s,s.type==='easy'||s.type==='long'?'short':'soft','cansancio');
  else if(v==='time') applyMod(s,'short','poco tiempo');
  else if(v==='ache'){
    ad.aches=(ad.aches||[]).filter(d=>daysBetween(d,td)<=7).concat([td]);
    applyMod(s,QUALITY.includes(s.type)||s.type==='long'?'easy':'short','molestia');
    if(ad.aches.length>=2) addEvent('down','Es la segunda molestia en una semana. Si no mejora, pausa el plan por lesión y consulta a un fisioterapeuta.');
  }else if(v==='sick'){applyMod(s,'rest','enfermedad');startPause('enfermedad',null);}
  else if(v==='period'){
    const p=phaseOf(td);if(cycleOn()&&cycle().mode==='natural'&&(!p||!p.inPeriod)&&addPeriodStart(td))cycleSchedule();
    applyMod(s,QUALITY.includes(s.type)||s.type==='long'?'easy':'short','regla');
  }
}
