/**
 * Estado de la app y persistencia local (localStorage). Única fuente de verdad: `state`.
 */

export let state=null;

export function blankState(){return {v:1,profile:null,fitness:null,plan:null,sessions:[],adapt:null,updatedAt:0};}

/* =========================================================
   Guardado local (solo en este móvil)
   ========================================================= */
export const LS='zancada.v1';

export let saveTimer=null;

// La capa de UI decide cómo avisar si falla el guardado (main.js registra el aviso).
let saveErrorHandler=()=>{};
export function onSaveError(fn){saveErrorHandler=fn;}

export function saveLocal(){try{localStorage.setItem(LS,JSON.stringify(state));}catch(e){saveErrorHandler('No se pudo guardar: el almacenamiento del navegador está lleno o desactivado.');}}

export function save(){state.updatedAt=Date.now();saveLocal();}

export function syncText(){return 'Todo se guarda solo en este móvil. Haz una copia de seguridad de vez en cuando.';}

export function sv(){
  if(!state.strava) state.strava={clientId:'',clientSecret:'',proxy:'',tokens:null,athlete:null,lastSync:0,runs:[],hrMax:null,hrMaxUser:null};
  return state.strava;
}

export const stravaOn=()=>!!(state&&state.strava&&state.strava.tokens);

export let syncFailed=false;

// Modificadores para que otros módulos puedan reasignar este estado compartido.
export function setSyncFailed(v){syncFailed=v;}
export function setState(v){state=v;}
