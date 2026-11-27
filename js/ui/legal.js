/**
 * Condiciones de uso y política de privacidad. La app no se puede usar sin aceptarlas;
 * si cambian (LEGAL_V), se vuelven a pedir. La aceptación se guarda aparte de los datos
 * (no se pierde al borrar ni al restaurar una copia).
 */
import { $, app } from './dom.js';
import { state } from '../core/store.js';

export const LEGAL_V = 1;
export const LEGAL_DATE = '27 de noviembre de 2026';
const LEGAL_KEY = 'zancada.legal';

export function legalInfo() { try { return JSON.parse(localStorage.getItem(LEGAL_KEY)) || null; } catch (e) { return null; } }
export function legalOk() { const l = legalInfo(); return !!(l && l.v === LEGAL_V); }
export function acceptLegal() { try { localStorage.setItem(LEGAL_KEY, JSON.stringify({ v: LEGAL_V, at: new Date().toISOString() })); return true; } catch (e) { return false; } }
export function revokeLegal() { try { localStorage.removeItem(LEGAL_KEY); } catch (e) {} }

export const CONTACT = 'zancada.app.run@gmail.com';
const mail = `<a href="mailto:${CONTACT}">${CONTACT}</a>`;
const ext = (u, t) => `<a href="${u}" target="_blank" rel="noopener">${t}</a>`;

export const TERMS_HTML = `
<h3>1. Qué es Zancada</h3>
<p>Zancada es una aplicación web gratuita que crea y adapta planes de entrenamiento de carrera a pie. No tiene publicidad, no necesita cuenta y funciona en tu navegador. La desarrolla una persona particular, sin ánimo de lucro, y se ofrece tal cual.</p>
<h3>2. Aceptación</h3>
<p>Para usar Zancada tienes que aceptar estas condiciones y la política de privacidad. Si no estás de acuerdo, no la uses. Debes tener al menos 14 años; si eres menor de edad, úsala con el permiso de tu madre, padre o tutor.</p>
<h3>3. No es consejo médico</h3>
<p>Zancada da orientaciones generales de entrenamiento calculadas de forma automática. <b>No sustituye a un médico, a un fisioterapeuta ni a un entrenador.</b> Los ritmos, las zonas de pulso, las predicciones de tiempo y las recomendaciones son estimaciones y pueden equivocarse.</p>
<ul>
<li>Antes de empezar a entrenar, sobre todo si llevas tiempo sin hacer deporte, tienes alguna enfermedad (por ejemplo, del corazón), una lesión o estás embarazada, consulta con un profesional sanitario.</li>
<li>Para si notas dolor en el pecho, mareo, falta de aire anormal, palpitaciones o dolor que no mejora, y busca atención médica.</li>
<li>Escucha a tu cuerpo: si algo no te sienta bien, haz menos aunque el plan diga otra cosa.</li>
<li>La función de ciclo menstrual solo adapta los entrenamientos. <b>No sirve como método anticonceptivo ni para diagnosticar nada.</b> Ante retrasos, dolor u otros cambios, consulta con tu médico.</li>
</ul>
<h3>4. Seguridad al entrenar</h3>
<ul>
<li>Cuando corras por la calle, respeta el tráfico y las normas. Con el entreno guiado por voz, usa un volumen que te deje oír lo que pasa a tu alrededor y no mires la pantalla mientras corres.</li>
<li>En cinta, usa la llave o pinza de seguridad y sigue las instrucciones de la máquina.</li>
<li>La medición del GPS, del pulso y de la cinta puede tener errores.</li>
</ul>
<h3>5. Tus datos son tu responsabilidad</h3>
<p>Todo lo que metes se guarda solo en tu dispositivo (lo explica la política de privacidad). Si borras los datos del navegador, desinstalas la app o pierdes el móvil, los datos se pierden. Haz copias desde Perfil › Descargar copia y guárdalas en un sitio seguro: la copia contiene datos de salud y la conexión con Strava, no la compartas.</p>
<h3>6. Servicios de terceros</h3>
<p>Si los activas, Zancada se conecta a servicios de otras empresas, que tienen sus propias condiciones:</p>
<ul>
<li><b>Strava</b>, para importar tus actividades y, si lo activas, subir entrenos. Usas tu propia aplicación de la API de Strava y debes cumplir las ${ext('https://www.strava.com/legal/api', 'condiciones de la API de Strava')}. Zancada no está afiliada a Strava.</li>
<li><b>Open-Meteo</b>, para el tiempo, solo si pones tu ciudad.</li>
<li><b>GitHub Pages</b>, donde está alojada la app.</li>
</ul>
<p>Zancada no controla esos servicios y no responde de que fallen, cambien o dejen de funcionar.</p>
<h3>7. Uso permitido</h3>
<p>Puedes usar Zancada para tu entrenamiento personal. No la uses para nada ilegal, para acceder a datos de otras personas ni de forma que perjudique a los servicios con los que se conecta.</p>
<h3>8. Sin garantías</h3>
<p>Zancada se ofrece gratis y «tal cual», sin garantía de que funcione siempre, sin errores o de que sus cálculos sean exactos. En la medida en que la ley lo permite, quien la desarrolla no responde de lesiones, daños o pérdidas de datos que se deriven de su uso. Nada de esto limita los derechos que te reconoce la ley y que no se pueden excluir.</p>
<h3>9. Cambios</h3>
<p>Estas condiciones pueden cambiar. Si cambian, la app te las mostrará de nuevo y tendrás que aceptarlas para seguir usándola.</p>
<h3>10. Ley aplicable y contacto</h3>
<p>Se rigen por la ley española. Para cualquier duda o problema, escribe a ${mail}.</p>
<p class="muted small">Versión ${LEGAL_V} · ${LEGAL_DATE}</p>`;

export const PRIVACY_HTML = `
<h3>En pocas palabras</h3>
<p><b>Zancada no recoge ningún dato tuyo.</b> No hay servidor propio, ni cuentas, ni analítica, ni cookies de seguimiento, ni publicidad. Todo lo que metes se queda en tu dispositivo y quien desarrolla la app no puede verlo.</p>
<h3>1. Qué guarda la app en tu dispositivo</h3>
<ul>
<li><b>Perfil:</b> nombre (opcional), edad, pulso máximo y en reposo, marcas, objetivo, días de entreno y ciudad (opcional).</li>
<li><b>Entrenos:</b> plan, sesiones hechas, sensaciones y esfuerzo, molestias, otros entrenos (fuerza, pilates…) y zapatillas.</li>
<li><b>Actividades de Strava</b> si lo conectas: fechas, distancias, tiempos, ritmos, pulso, desnivel, vueltas y zapatillas.</li>
<li><b>Ciclo menstrual</b> si activas esa función: fechas de la regla, síntomas y modo (natural o anticonceptivo hormonal). Son datos de salud, de categoría especial: solo se guardan si tú los metes y puedes borrarlos cuando quieras.</li>
<li><b>Ubicación:</b> solo durante un entreno guiado con GPS, para medir distancia y ritmo. El recorrido se guarda en el dispositivo mientras dura el entreno y se borra al terminar, salvo que elijas subirlo a Strava.</li>
<li><b>Conexión con Strava:</b> los datos de tu aplicación de la API y las claves de acceso.</li>
</ul>
<p>Se guarda en el almacenamiento local del navegador (localStorage) de este dispositivo. No se envía a quien desarrolla Zancada ni a nadie más, salvo lo que se explica en el punto 2.</p>
<h3>2. Cuándo salen datos de tu dispositivo</h3>
<ul>
<li><b>Strava</b> (solo si lo conectas): tu móvil habla directamente con Strava, o a través del proxy que tú configures, para autorizar la conexión, descargar tus actividades y, si lo activas, subir el recorrido de un entreno guiado. Strava trata esos datos según su ${ext('https://www.strava.com/legal/privacy', 'política de privacidad')}. Puedes revocar el acceso en ${ext('https://www.strava.com/settings/apps', 'strava.com › Ajustes › Mis aplicaciones')}.</li>
<li><b>Open-Meteo</b> (solo si pones tu ciudad): se envía el nombre de la ciudad para encontrarla y sus coordenadas para pedir la previsión del tiempo. No se envía nada más de ti, aunque, como en cualquier conexión, el servicio ve tu dirección IP. ${ext('https://open-meteo.com/en/terms', 'Condiciones de Open-Meteo')}.</li>
<li><b>GitHub Pages</b>: al abrir o actualizar la app, tu navegador la descarga de los servidores de GitHub, que pueden registrar datos técnicos como la IP. ${ext('https://docs.github.com/es/site-policy/privacy-policies/github-general-privacy-statement', 'Declaración de privacidad de GitHub')}.</li>
</ul>
<p>Las indicaciones por voz usan las voces del propio teléfono.</p>
<h3>3. Permisos del teléfono</h3>
<p>La app solo pide la ubicación al empezar un entreno guiado con GPS y mantener la pantalla encendida durante ese entreno. Puedes negarlos: el resto de la app funciona igual.</p>
<h3>4. Quién es responsable</h3>
<p>Como tus datos no llegan nunca a quien desarrolla Zancada, nadie más que tú los trata ni tiene acceso a ellos. Cuando conectas Strava o pones tu ciudad, esos servicios son responsables de lo que reciben, según sus propias políticas.</p>
<h3>5. Cuánto tiempo y cómo borrarlos</h3>
<p>Los datos se quedan en tu dispositivo hasta que los borres. Puedes:</p>
<ul>
<li>Borrar todo desde Perfil › Borrar todo y empezar de cero.</li>
<li>Desactivar o borrar solo el ciclo desde su sección en Perfil.</li>
<li>Desconectar Strava desde Perfil y revocar el acceso en Strava.</li>
<li>Borrar los datos del sitio en los ajustes del navegador.</li>
</ul>
<h3>6. Tus derechos</h3>
<p>Tienes el control total de tus datos en el dispositivo: puedes verlos, corregirlos, exportarlos (Descargar copia) y borrarlos. Para los datos que tengan Strava, Open-Meteo o GitHub, ejerce tus derechos ante ellos. Si crees que se han vulnerado tus derechos, puedes reclamar ante la ${ext('https://www.aepd.es', 'Agencia Española de Protección de Datos')}.</p>
<h3>7. Seguridad</h3>
<p>Quien tenga tu móvil desbloqueado puede ver los datos de la app: protégelo con código o biometría. La copia de seguridad es un archivo sin cifrar con datos de salud y la conexión con Strava: guárdala en un sitio seguro y no la compartas.</p>
<h3>8. Menores</h3>
<p>Zancada no está pensada para menores de 14 años. Si tienes entre 14 y 17, úsala con el permiso de tu madre, padre o tutor.</p>
<h3>9. Contacto</h3>
<p>Para cualquier duda sobre privacidad, escribe a ${mail}. Como tus datos no nos llegan, no podemos consultarlos ni borrarlos por ti: se gestionan desde la propia app.</p>
<h3>10. Cambios</h3>
<p>Si esta política cambia, la app te la mostrará de nuevo y tendrás que aceptarla para seguir usándola.</p>
<p class="muted small">Versión ${LEGAL_V} · ${LEGAL_DATE}</p>`;

export function renderLegalGate() {
  const tabs = $('#tabs'); if (tabs) tabs.hidden = true;
  const again = !!legalInfo(), hasData = !!(state && state.profile);
  app.innerHTML = `<div class="stack-lg legal-gate"><header class="stack" style="gap:6px"><div class="lanes" aria-hidden="true"></div><h1>${again ? 'Hemos actualizado las condiciones' : 'Antes de empezar'}</h1>
    <p class="muted">Para usar Zancada tienes que leer y aceptar las condiciones de uso y la política de privacidad.</p></header>
    <section class="card stack"><h3>Lo más importante</h3><ul class="legal-sum">
      <li><b>Tus datos no salen de tu móvil.</b> Sin cuentas, sin analítica y sin publicidad. Solo se conecta a Strava y al tiempo si tú lo activas.</li>
      <li><b>No es consejo médico.</b> Consulta con un profesional antes de empezar si tienes dudas de salud, y para si algo duele.</li>
      <li><b>El ciclo menstrual solo adapta el entrenamiento:</b> no sirve como anticonceptivo ni para diagnosticar.</li>
      <li><b>Haz copias de seguridad:</b> si borras el navegador, los datos se pierden.</li></ul></section>
    <details class="card legal-doc"><summary><b>Condiciones de uso</b></summary><div class="legal">${TERMS_HTML}</div></details>
    <details class="card legal-doc"><summary><b>Política de privacidad</b></summary><div class="legal">${PRIVACY_HTML}</div></details>
    <section class="card stack">
      <label class="legal-chk"><input type="checkbox" id="lg-terms" data-act="legalchk"> <span>He leído y acepto las <b>condiciones de uso</b> y la <b>política de privacidad</b>.</span></label>
      <label class="legal-chk"><input type="checkbox" id="lg-age" data-act="legalchk"> <span>Tengo 14 años o más (y, si soy menor de edad, tengo permiso de mi madre, padre o tutor).</span></label>
      <button type="button" class="primary block" data-act="legalok" id="lg-ok" disabled>Aceptar y continuar</button>
      <p class="hint">Si no aceptas, no podrás usar la app.${hasData ? ' Tus datos siguen guardados en este móvil.' : ''}</p></section></div>`;
  window.scrollTo(0, 0);
}

export function legalCheck() {
  const ok = $('#lg-terms') && $('#lg-terms').checked && $('#lg-age').checked;
  const b = $('#lg-ok'); if (b) b.disabled = !ok;
  return ok;
}

export function legalSheetHTML(which) {
  return `<div class="stack"><h2>${which === 'privacy' ? 'Política de privacidad' : 'Condiciones de uso'}</h2><div class="legal">${which === 'privacy' ? PRIVACY_HTML : TERMS_HTML}</div>
    <button type="button" class="block" data-act="close">Cerrar</button></div>`;
}

export function legalSection() {
  const l = legalInfo(), d = l && l.at ? new Date(l.at) : null;
  return `<section class="card stack"><h3>Condiciones y privacidad</h3>
    <div class="grid2"><button type="button" data-act="legal" data-v="terms">Condiciones de uso</button><button type="button" data-act="legal" data-v="privacy">Privacidad</button></div>
    ${d ? `<p class="hint">Aceptadas el ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} (versión ${l.v}).</p>` : ''}
    <button type="button" class="ghost" data-act="legalRevoke">Retirar mi aceptación</button></section>`;
}
