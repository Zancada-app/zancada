/**
 * Navegación por pestañas (hash) y hojas modales con bloqueo de scroll.
 */
import { state } from '../core/store.js';
import { $, app, layer } from './dom.js';
import { renderHoy } from './screens/hoy.js';
import { renderPlan } from './screens/plan.js';
import { renderProgreso } from './screens/progreso.js';
import { renderZonas } from './screens/zonas.js';
import { renderSetup, renderWizard, wiz } from './screens/wizard.js';
import { renderPerfil } from './screens/perfil.js';

/* ---------- Navegación: transición suave, scroll conservado ---------- */
export let lastTab=null;

export function route(){
  const h=(location.hash||'').slice(1);
  const tabs=$('#tabs');
  if(!state.profile){renderSetup();return;}
  if(wiz&&wiz.mode==='edit'){renderWizard();return;}
  tabs.hidden=false;
  const tab=['hoy','plan','progreso','perfil','zonas'].includes(h)?h:'hoy';
  const hl=tab==='zonas'?'progreso':tab;
  tabs.querySelectorAll('a').forEach(a=>{if(a.dataset.tab===hl)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  const changed=tab!==lastTab,y=window.scrollY;
  ({hoy:renderHoy,plan:renderPlan,progreso:renderProgreso,zonas:renderZonas,perfil:renderPerfil})[tab]();
  if(changed){window.scrollTo(0,0);app.classList.remove('view-in');void app.offsetWidth;app.classList.add('view-in');}
  else window.scrollTo(0,y);
  lastTab=tab;
}

/* ---------- Hojas: deslizar para cerrar, fondo bloqueado ---------- */
// bloqueo del fondo sin perder la posición: el cuerpo se fija donde estaba y al cerrar se vuelve exactamente a ese punto
export let lockedY=null;

export function lockScroll(){
  if(lockedY!==null) return;
  lockedY=window.scrollY;const b=document.body.style;
  b.position='fixed';b.top=`-${lockedY}px`;b.left='0';b.right='0';b.width='100%';
}

export function unlockScroll(){
  if(lockedY===null) return;
  const y=lockedY;lockedY=null;const b=document.body.style;
  b.position='';b.top='';b.left='';b.right='';b.width='';
  window.scrollTo(0,y);
}

export function closeSheet(instant){
  const bg=layer.querySelector('.sheet-bg');if(!bg) return;
  unlockScroll();
  if(instant||matchMedia('(prefers-reduced-motion: reduce)').matches){bg.remove();return;}
  bg.classList.add('closing');setTimeout(()=>bg.remove(),200);
}

export function openSheet(html){
  const old=layer.querySelector('.sheet-bg');if(old)old.remove();
  const tt=layer.querySelector('.toast');if(tt)tt.remove();
  const bg=document.createElement('div');bg.className='sheet-bg';
  bg.innerHTML=`<div class="sheet" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"></div>${html}</div>`;
  bg.addEventListener('click',e=>{if(e.target===bg)closeSheet();});
  const sh=bg.querySelector('.sheet');
  let y0=null,dy=0;
  sh.addEventListener('touchstart',e=>{if(sh.scrollTop<=0){y0=e.touches[0].clientY;dy=0;sh.style.transition='none';}},{passive:true});
  sh.addEventListener('touchmove',e=>{if(y0==null)return;dy=e.touches[0].clientY-y0;if(dy>0){sh.style.transform=`translateY(${dy}px)`;}else{y0=null;sh.style.transform='';}},{passive:true});
  sh.addEventListener('touchend',()=>{if(y0==null)return;sh.style.transition='';if(dy>110){sh.style.transform=`translateY(100%)`;closeSheet();}else sh.style.transform='';y0=null;});
  layer.appendChild(bg);
  lockScroll();
}

// Modificadores para que otros módulos puedan reasignar este estado compartido.
export function setLastTab(v){lastTab=v;}
