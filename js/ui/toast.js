/**
 * Avisos breves con opción de deshacer.
 */
import { esc } from '../core/util.js';
import { save, setState, state } from '../core/store.js';
import { layer } from './dom.js';
import { closeSheet, route } from './router.js';

/* ---------- Avisos con «Deshacer» ---------- */
export let toastTimer=null;

export function toast(msg,opt){
  opt=opt||{};
  const old=layer.querySelector('.toast');if(old)old.remove();
  const t=document.createElement('div');t.className='toast';t.setAttribute('role','status');
  t.innerHTML=`<span>${esc(msg)}</span>${opt.undo?'<button type="button" class="tbtn" data-act="undo">Deshacer</button>':''}`;
  if(opt.undo) t.dataset.snap=opt.undo;
  layer.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),220);},opt.undo?6500:4200);
}

export function undoLast(btn){
  const t=btn.closest('.toast');if(!t||!t.dataset.snap) return;
  setState(JSON.parse(t.dataset.snap));save();t.remove();closeSheet(true);route();toast('Deshecho.');
}
