/**
 * Voz en español con la síntesis de voz del propio móvil (sin servidores). En iPhone la primera
 * frase tiene que salir de un toque del usuario: por eso «Empezar» dice algo enseguida.
 */
let voice = null;

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => /^es[-_]ES/i.test(v.lang) && /m[oó]nica|marisa|paulina|jorge|lucia|lucía|google/i.test(v.name))
    || vs.find(v => /^es[-_]ES/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickVoice();
  try { speechSynthesis.addEventListener('voiceschanged', pickVoice); } catch (e) {}
}

export const voiceAvailable = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/** Dice un texto. flush: corta lo que se estuviera diciendo (para los cambios de paso). */
export function speak(text, flush) {
  if (!voiceAvailable() || !text) return;
  if (flush) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-ES'; if (voice) u.voice = voice;
  u.rate = 1.0; u.pitch = 1; u.volume = 1;
  speechSynthesis.speak(u);
}

export function stopVoice() { if (voiceAvailable()) speechSynthesis.cancel(); }
