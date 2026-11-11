/**
 * Catálogos del dominio: objetivos, niveles, tipos de sesión, etapas de correr/andar y fases.
 */
/* =========================================================
   Modelo de entrenamiento
   ========================================================= */
export const GOALS={
  '5k':{name:'5 km',dist:5,peak:35,minStart:12,defWeeks:8,taper:1,longCap:12,rep:0.6,rec:0.2,rf:1.0,spf:0.97},
  '10k':{name:'10 km',dist:10,peak:45,minStart:15,defWeeks:10,taper:1,longCap:16,rep:1.0,rec:0.3,rf:1.04,spf:1.0},
  '21k':{name:'Media maratón',dist:21.0975,peak:55,minStart:20,defWeeks:12,taper:2,longCap:21,rep:1.6,rec:0.4,rf:1.10,spf:1.03},
  '42k':{name:'Maratón',dist:42.195,peak:68,minStart:25,defWeeks:16,taper:3,longCap:32,rep:2.0,rec:0.4,rf:1.17,spf:1.05},
  'forma':{name:'Ponerme en forma',dist:0,peak:0,minStart:8,defWeeks:8,taper:0,longCap:14,rep:0.8,rec:0.3,rf:1.08,spf:1.0}
};

export const LEVELS={
  nuevo:{name:'Empiezo ahora',sub:'Nunca he corrido o hace mucho',mult:0.6,p:405,longMult:0.75},
  intermedio:{name:'Corro a veces',sub:'1–3 días por semana',mult:1,p:315,longMult:1},
  avanzado:{name:'Corro habitualmente',sub:'4 o más días, alguna carrera',mult:1.35,p:255,longMult:1.1}
};

export const TYPES={
  easy:{n:'Rodaje suave',k:'Suave',c:''},
  long:{n:'Tirada larga',k:'Larga',c:'l'},
  series:{n:'Series',k:'Calidad',c:'q'},
  tempo:{n:'Tempo',k:'Calidad',c:'q'},
  ritmo:{n:'Ritmo de carrera',k:'Calidad',c:'q'},
  fartlek:{n:'Fartlek',k:'Calidad',c:'q'},
  cuestas:{n:'Cuestas',k:'Calidad',c:'q'},
  test:{n:'Test de 5 km',k:'Test',c:'q'},
  race:{n:'Carrera',k:'Carrera',c:'q'},
  runwalk:{n:'Correr y andar',k:'Suave',c:''}
};

export const KEY_TYPES=['long','series','tempo','ritmo','fartlek','cuestas','test'];

export const QUALITY=['series','tempo','ritmo','fartlek','cuestas','test','race'];

export const RW=[[1,1.5,8],[1.5,1.5,8],[2,1.5,7],[3,1.5,6],[4,1,5],[5,1,5],[6,1,4],[8,1,3],[10,1,3],[13,1,2],[15,1,2],[20,1,2]];

export const PHASE_N={base:'Base',desarrollo:'Desarrollo',pico:'Pico','puesta a punto':'Puesta a punto'};
