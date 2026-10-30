import { useCallback, useEffect, useRef, useState } from 'react';
import { createRecognizer, localeFor, speak, speechSupport, stopSpeaking, type VoiceError } from '@/lib/voice';

export function useVoice(lang: string, rate: number) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<VoiceError | null>(null);
  const recRef = useRef<ReturnType<typeof createRecognizer>>(null);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const listen = useCallback((onFinal: (text: string) => void) => {
    setError(null);
    setInterim('');
    const rec = createRecognizer({
      lang: localeFor(lang),
      onInterim: setInterim,
      onFinal: (t) => { setInterim(''); onFinal(t); },
      onEnd: () => setListening(false),
      onError: (e) => { setError(e); setListening(false); },
    });
    if (!rec) return;
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setError('unknown'); }
  }, [lang]);

  const say = useCallback((text: string) => {
    speak(text, lang, rate, { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false) });
  }, [lang, rate]);

  const stopSay = useCallback(() => { stopSpeaking(); setSpeaking(false); }, []);

  useEffect(() => () => { recRef.current?.abort(); stopSpeaking(); }, []);

  return {
    canListen: speechSupport.recognition,
    canSpeak: speechSupport.synthesis,
    listening, speaking, interim, error,
    listen, stopListening, say, stopSay,
  };
}
