import { useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import { Mic, Send, Square, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/util';
import { useT } from '@/i18n';
import { dur, ease } from '@/lib/animations';

export function TypingIndicator() {
  const { t } = useT();
  return (
    <div className="msg msg--assistant" role="status" aria-label={t('Sage is thinking')}>
      <div className="typing" aria-hidden><i /><i /><i /></div>
    </div>
  );
}

export function Bubble({ role, children, tone }: { role: 'user' | 'assistant'; children: React.ReactNode; tone?: 'error' }) {
  return (
    <motion.div className={cn('msg', `msg--${role}`, tone === 'error' && 'msg--error')}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { duration: dur.base, ease } }}>
      <div className="msg__bubble">{children}</div>
    </motion.div>
  );
}

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  voice: {
    canListen: boolean; canSpeak: boolean; listening: boolean; speaking: boolean; interim: string;
    onMic: () => void; onStopSpeaking: () => void; voiceReplies: boolean; onToggleReplies: () => void;
    error: string | null;
  };
}

export function Composer({ value, onChange, onSend, disabled, placeholder, voice }: ComposerProps) {
  const { t } = useT();
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  const submit = (e: FormEvent) => { e.preventDefault(); if (value.trim() && !disabled) onSend(); };
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (value.trim() && !disabled) onSend(); }
  };
  const errText =
    voice.error === 'permission-denied' ? t('Microphone access was blocked. Allow it in your browser settings, or just type.') :
    voice.error === 'no-speech' ? t("I didn't catch anything. Try again or type your message.") :
    voice.error === 'unsupported' ? t('Voice input is not supported in this browser. Typing works everywhere.') :
    voice.error ? t('Voice input hit a problem. You can keep typing.') : null;

  return (
    <form className="composer" onSubmit={submit}>
      {errText && <p className="composer__err" role="alert">{errText}</p>}
      {voice.listening && <p className="composer__listen" role="status">{t('Listening…')} {voice.interim}</p>}
      <div className="composer__row">
        <label htmlFor="chat-input" className="sr-only">{t('Message your stylist')}</label>
        <textarea id="chat-input" ref={ref} rows={1} className="composer__input" value={value}
          maxLength={1500} onChange={(e) => onChange(e.target.value)} onKeyDown={key}
          placeholder={placeholder ?? t('Ask Sage what to wear…')} />
        {voice.canListen && (
          <button type="button" className={cn('icon-btn icon-btn--round', voice.listening && 'icon-btn--on')}
            onClick={voice.onMic} aria-pressed={voice.listening}
            aria-label={voice.listening ? t('Stop listening') : t('Speak your message')}>
            {voice.listening ? <Square size={18} /> : <Mic size={18} />}
          </button>
        )}
        {voice.canSpeak && (
          <button type="button" className={cn('icon-btn icon-btn--round', voice.voiceReplies && 'icon-btn--on')}
            onClick={voice.speaking ? voice.onStopSpeaking : voice.onToggleReplies}
            aria-label={voice.speaking ? t('Stop speaking') : voice.voiceReplies ? t('Turn off spoken replies') : t('Turn on spoken replies')}>
            {voice.speaking ? <Square size={18} /> : voice.voiceReplies ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        )}
        <Button type="submit" icon={<Send size={18} />} disabled={disabled || !value.trim()} aria-label={t('Send message')}>
          <span className="hide-sm">{t('Send')}</span>
        </Button>
      </div>
    </form>
  );
}
