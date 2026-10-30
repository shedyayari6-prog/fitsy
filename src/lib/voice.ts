/* Thin wrappers around the browser Web Speech APIs. Everything here is optional:
   callers must check the `supported` flags and fall back to text. */

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechSupport = {
  get recognition() { return getCtor() !== null; },
  get synthesis() { return typeof window !== 'undefined' && 'speechSynthesis' in window; },
};

export type VoiceError = 'permission-denied' | 'no-speech' | 'unsupported' | 'unknown';

export function createRecognizer(opts: {
  lang: string;
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onEnd: () => void;
  onError: (e: VoiceError) => void;
}) {
  const Ctor = getCtor();
  if (!Ctor) { opts.onError('unsupported'); return null; }
  const rec = new Ctor();
  rec.lang = opts.lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      const t = r[0]?.transcript ?? '';
      if (r.isFinal) final += t; else interim += t;
    }
    if (final) opts.onFinal(final.trim()); else opts.onInterim(interim);
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') opts.onError('permission-denied');
    else if (e.error === 'no-speech') opts.onError('no-speech');
    else opts.onError('unknown');
  };
  rec.onend = opts.onEnd;
  return rec;
}

const LOCALES: Record<string, string> = {
  en: 'en-US', fr: 'fr-FR', ar: 'ar-SA', es: 'es-ES', de: 'de-DE', it: 'it-IT',
};
export const localeFor = (code: string) => LOCALES[code] ?? code;

export function speak(text: string, lang: string, rate: number, handlers: { onStart: () => void; onEnd: () => void }) {
  if (!speechSupport.synthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = localeFor(lang);
  u.rate = rate;
  u.onstart = handlers.onStart;
  u.onend = handlers.onEnd;
  u.onerror = handlers.onEnd;
  window.speechSynthesis.speak(u);
}
export function stopSpeaking() {
  if (speechSupport.synthesis) window.speechSynthesis.cancel();
}
