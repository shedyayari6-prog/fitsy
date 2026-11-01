import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { History, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useApp } from '@/hooks/useApp';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSettings } from '@/hooks/useSettings';
import { useVoice } from '@/hooks/useVoice';
import { useWeather } from '@/hooks/useWeather';
import { useT } from '@/i18n';
import { Button, Chip, SetupNotice, Skeleton } from '@/components/ui';
import { MascotStage } from '@/components/mascot/MascotStage';
import { Bubble, Composer, TypingIndicator } from '@/components/chat/Chat';
import { OutfitCard } from '@/components/outfit/OutfitCard';
import { StorePicks } from '@/components/store/StorePicks';
import { StylistError, sendToStylist } from '@/lib/ai-stylist';
import { deleteConversation, getMessages, listConversations, removeSavedOutfit, saveOutfit } from '@/lib/data';
import { STYLER_PROMPTS } from '@/config/options';
import { errMessage } from '@/lib/util';
import { stagger } from '@/lib/animations';
import type { ChatMessage, Conversation, MascotState, OutfitData, SavedOutfit, StylistRequest } from '@/types';

const ACTIONS: { action: NonNullable<StylistRequest['action']>; label: string }[] = [
  { action: 'try_another_style', label: 'Try another style' },
  { action: 'more_formal', label: 'Make it more formal' },
  { action: 'more_casual', label: 'Make it more casual' },
  { action: 'cheaper', label: 'Make it cheaper' },
  { action: 'alternatives', label: 'Suggest alternatives' },
  { action: 'from_wardrobe', label: 'Use items from my wardrobe' },
];

interface Failure { code: string; message: string; retry: { req: StylistRequest; text: string } }

export default function StylistPage() {
  const { profile, tryComplete } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, lang } = useT();
  const [settings, updateSettings] = useSettings();
  const { weather, status: weatherStatus } = useWeather(profile);
  const voice = useVoice(profile?.preferred_language ?? lang, settings.voiceRate);
  const loc = useLocation() as { state?: { prompt?: string } };

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(loc.state?.prompt ?? '');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [history, setHistory] = useState<Conversation[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [saved, setSaved] = useState<Record<string, SavedOutfit>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const uid = user!.id;

  const refreshHistory = useCallback(async () => {
    try { setHistory(await listConversations(uid)); } catch { setHistory([]); }
  }, [uid]);
  useEffect(() => { void refreshHistory(); }, [refreshHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending, failure]);

  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === 'assistant'), [messages]);
  const hasOutfits = !!lastAssistant?.structured?.outfits?.length;

  // Crying for hard failures (can't reach the stylist), sad for softer ones.
  const hardFailure = failure && ['unreachable', 'provider_error', 'provider_unreachable', 'internal_error', 'provider_not_configured', 'demo_mode'].includes(failure.code);
  const mascotAction: MascotState =
    voice.listening ? 'listening' : voice.speaking ? 'talking' : sending ? 'thinking' :
    failure ? (hardFailure ? 'crying' : 'sad') : approved ? 'outfit-approved' :
    hasOutfits ? 'recommending' : messages.length === 0 ? 'waving' : 'idle';
  const name = profile?.display_name ? ` ${profile.display_name}` : '';
  const bubble =
    voice.listening ? t("I'm listening…") : sending ? t('Let me think about that…') :
    failure ? t("Hmm, that didn't work. Want to try again?") :
    approved ? t('Great pick! Saved.') :
    hasOutfits ? t('Here are some ideas. Save the ones you love!') :
    messages.length === 0 ? t('Hi{name}! What are we dressing for?', { name }) : t('Anything else I can help with?');

  const send = useCallback(async (req: StylistRequest, text: string) => {
    if (sending) return;
    setFailure(null);
    setSending(true);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() }]);
    try {
      const res = await sendToStylist({ ...req, conversationId, weather: weather ?? null });
      setConversationId(res.conversationId);
      setMessages((m) => [...m, {
        id: `a-${Date.now()}`, role: 'assistant', content: res.reply, created_at: new Date().toISOString(),
        structured: { outfits: res.outfits, clarifyingQuestion: res.clarifyingQuestion },
      }]);
      if (settings.voiceReplies && voice.canSpeak) voice.say(res.reply);
      void refreshHistory();
      await tryComplete('ask_stylist');
      if (res.outfits.length) await tryComplete('outfit_suggested');
    } catch (e) {
      const err = e instanceof StylistError ? e : new StylistError('internal_error', errMessage(e));
      // Drop the optimistic user bubble; the retry button re-sends it.
      setMessages((m) => m.slice(0, -1));
      setFailure({ code: err.code, message: t(err.message), retry: { req, text } });
    } finally {
      setSending(false);
    }
  }, [sending, conversationId, weather, settings.voiceReplies, voice, refreshHistory, tryComplete, t]);

  const sendText = () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    void send({ message: text }, text);
  };

  const sendAction = (a: (typeof ACTIONS)[number]) => void send({ action: a.action }, t(a.label));

  const onMic = () => {
    if (voice.listening) { voice.stopListening(); return; }
    voice.stopSay();
    voice.listen((txt) => setInput((cur) => (cur ? `${cur} ${txt}` : txt)));
  };

  const newChat = () => {
    voice.stopSay();
    setConversationId(null); setMessages([]); setFailure(null); setSaved({}); setInput(''); setHistoryOpen(false);
  };

  const openConversation = async (c: Conversation) => {
    setHistoryOpen(false); setLoadingConv(true); setFailure(null); setSaved({});
    try {
      setMessages(await getMessages(uid, c.id));
      setConversationId(c.id);
    } catch (e) {
      toast(errMessage(e, t('Could not open that conversation.')), 'error');
    } finally { setLoadingConv(false); }
  };

  const removeConversation = async (c: Conversation) => {
    try {
      await deleteConversation(uid, c.id);
      if (c.id === conversationId) newChat();
      await refreshHistory();
    } catch (e) { toast(errMessage(e, t('Could not delete the conversation.')), 'error'); }
  };

  const toggleSave = async (key: string, outfit: OutfitData) => {
    setSavingKey(key);
    try {
      const existing = saved[key];
      if (existing) {
        await removeSavedOutfit(uid, existing);
        setSaved((s) => { const { [key]: _gone, ...rest } = s; return rest; });
      } else {
        const row = await saveOutfit(uid, outfit);
        setSaved((s) => ({ ...s, [key]: row }));
        setApproved(true);
        window.setTimeout(() => setApproved(false), 2600);
        await tryComplete('save_outfit');
        if (outfit.pieces.some((p) => p.fromWardrobe)) await tryComplete('wardrobe_outfit');
      }
    } catch (e) {
      toast(errMessage(e, t('Could not update your saved outfits.')), 'error');
    } finally { setSavingKey(null); }
  };

  const needsSetup = failure && ['provider_not_configured', 'demo_mode', 'unreachable'].includes(failure.code);

  return (
    <div className="stylist">
      <aside className="stylist__side">
        <MascotStage size="md" action={mascotAction} mood={failure ? 'confused' : 'happy'} bubbleKey={`${bubble}-${lang}`} bubble={bubble} />
        <div className="stylist__side-actions">
          <Button variant="soft" size="sm" icon={<Plus size={16} />} onClick={newChat}>{t('New conversation')}</Button>
          <Button variant="ghost" size="sm" icon={<History size={16} />} onClick={() => setHistoryOpen((o) => !o)} aria-expanded={historyOpen}>{t('History')}</Button>
        </div>
        {weatherStatus === 'ready' && weather && (
          <p className="muted small">{t("Weather in {city}: {temp}°C, {summary} (current). Today's range {min}–{max}°C (forecast).", {
            city: weather.city, temp: Math.round(weather.tempC), summary: t(weather.summary), min: Math.round(weather.minC), max: Math.round(weather.maxC) })}</p>
        )}
        {weatherStatus === 'error' && <p className="muted small">{t("Weather is unavailable right now, so I'll style without it.")}</p>}
      </aside>

      <section className="stylist__main" aria-label={t('Conversation with your stylist')}>
        <AnimatePresence>
          {historyOpen && (
            <motion.div className="history" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="history__head"><strong>{t('Past conversations')}</strong>
                <button className="icon-btn icon-btn--tiny" onClick={() => setHistoryOpen(false)} aria-label={t('Close history')}><X size={14} /></button></div>
              {history === null ? <Skeleton h={40} /> : history.length === 0 ? <p className="muted small">{t('Nothing yet. Your conversations will appear here.')}</p> : (
                <ul>
                  {history.map((c) => (
                    <li key={c.id}>
                      <button className="history__item" onClick={() => void openConversation(c)}>{c.title}</button>
                      <button className="icon-btn icon-btn--tiny" aria-label={t('Delete conversation {title}', { title: c.title })} onClick={() => void removeConversation(c)}><Trash2 size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="chatlog" role="log" aria-live="polite" aria-relevant="additions">
          {loadingConv && <Skeleton h={80} r={20} />}
          {!loadingConv && messages.length === 0 && !sending && (
            <div className="starter">
              <h1>{t('What should you wear?')}</h1>
              <p className="muted">{t('Ask in your own words, or start with one of these.')}</p>
              <div className="chips">
                {STYLER_PROMPTS.map((q) => <Chip key={q} onClick={() => setInput(t(q))}>{t(q)}</Chip>)}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className="chatturn">
              <Bubble role={m.role}>{m.content}</Bubble>
              {m.role === 'assistant' && m.structured?.clarifyingQuestion && (
                <Bubble role="assistant"><em>{m.structured.clarifyingQuestion}</em></Bubble>
              )}
              {m.role === 'assistant' && !!m.structured?.outfits?.length && (
                <motion.div className="ocards" variants={stagger(0.1)} initial="hidden" animate="show">
                  {m.structured.outfits.map((o, i) => {
                    const key = `${m.id}:${i}`;
                    return (
                      <div key={key} className="ocard-wrap">
                        <OutfitCard outfit={o} saved={!!saved[key]} saving={savingKey === key}
                          onSave={() => void toggleSave(key, o)} onUnsave={() => void toggleSave(key, o)}
                          onAsk={() => setInput(t('Tell me more about "{name}". How would I wear it?', { name: o.name }))} />
                        <StorePicks outfit={o} />
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          ))}

          {sending && <TypingIndicator />}

          {failure && (
            needsSetup ? (
              <SetupNotice what={failure.message} steps={[
                t('Create a Supabase project and apply the SQL migrations in supabase/migrations.'),
                t('Deploy the function: supabase functions deploy ai-stylist'),
                t('Set secrets: supabase secrets set AI_API_KEY=… AI_MODEL=… (optional AI_API_URL)'),
                t('Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env and restart.'),
              ]} />
            ) : (
              <Bubble role="assistant" tone="error">
                <p>{failure.message}</p>
                <Button size="sm" variant="soft" icon={<RotateCcw size={14} />} onClick={() => void send(failure.retry.req, failure.retry.text)}>{t('Retry')}</Button>
              </Bubble>
            )
          )}

          {hasOutfits && !sending && (
            <div className="chips chips--actions" role="group" aria-label={t('Refine this outfit')}>
              {ACTIONS.map((a) => (
                <Chip key={a.action} onClick={() => sendAction(a)} disabled={!conversationId}>{t(a.label)}</Chip>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <Composer
          value={input} onChange={setInput} onSend={sendText} disabled={sending}
          voice={{
            canListen: voice.canListen, canSpeak: voice.canSpeak, listening: voice.listening, speaking: voice.speaking,
            interim: voice.interim, error: voice.error, onMic, onStopSpeaking: voice.stopSay,
            voiceReplies: settings.voiceReplies, onToggleReplies: () => updateSettings({ voiceReplies: !settings.voiceReplies }),
          }}
        />
        <p className="muted small center">{t("Sage gives styling ideas, not guarantees. Prices, stock and weather suitability aren't verified.")}</p>
      </section>
    </div>
  );
}