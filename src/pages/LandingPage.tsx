import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, ExternalLink, MessageCircle, Shirt, Sparkles, Trophy, Wand2 } from 'lucide-react';
import { brand } from '@/config/brand';
import { Logo, LinkButton } from '@/components/ui';
import { MascotStage } from '@/components/mascot/MascotStage';
import { Mascot } from '@/components/mascot/Mascot';
import { OutfitVisual } from '@/components/outfit/OutfitCard';
import { fadeUp, stagger } from '@/lib/animations';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import type { OutfitData } from '@/types';

type ExampleKey = 'Date' | 'Interview' | 'University';

export default function LandingPage() {
  const { user } = useAuth();
  const { t, lang } = useT();
  const [pick, setPick] = useState<ExampleKey>('Date');
  const cta = user ? '/app' : '/auth?mode=signup';

  /** Static, clearly labelled examples. They are written copy, not live AI output. */
  const examples = useMemo<Record<ExampleKey, { q: string; reply: string; outfit: OutfitData }>>(() => ({
    Date: {
      q: t('I have a date tonight. What should I wear?'),
      reply: t('Go for relaxed but put-together. Soft textures and one warm accent will look intentional without trying too hard.'),
      outfit: {
        name: t('Easy evening'), occasion: t('Date'), style: t('Smart casual'),
        pieces: [
          { name: t('Fine-knit polo'), category: 'tops', color: t('cream'), fromWardrobe: false },
          { name: t('Straight trousers'), category: 'trousers', color: t('forest'), fromWardrobe: false },
        ],
        colorPalette: [t('cream'), t('forest'), t('terracotta')], shoes: t('Clean leather sneakers'), accessories: [t('Simple watch')], outerwear: t('Lightweight overshirt'),
        whyItWorks: t('A tonal green-and-cream base looks calm and polished, and the warm accent adds personality.'), alternatives: [],
      },
    },
    Interview: {
      q: t('I have a job interview tomorrow.'),
      reply: t('Aim for quietly confident: structured pieces, muted colours, nothing distracting. What field is it in? I can tune the formality.'),
      outfit: {
        name: t('Calm authority'), occasion: t('Interview'), style: t('Formal'),
        pieces: [
          { name: t('Tailored blazer'), category: 'jackets', color: t('navy'), fromWardrobe: false },
          { name: t('Crisp shirt'), category: 'tops', color: t('white'), fromWardrobe: false },
          { name: t('Pressed trousers'), category: 'trousers', color: t('grey'), fromWardrobe: false },
        ],
        colorPalette: [t('navy'), t('white'), t('grey')], shoes: t('Polished loafers'), accessories: [t('Slim leather bag')],
        whyItWorks: t('Navy and white read as trustworthy and neat, and a single neutral keeps attention on you.'), alternatives: [],
      },
    },
    University: {
      q: t('I need an outfit for university tomorrow.'),
      reply: t('Comfort first, with one good layer so you look pulled together between lectures and the library.'),
      outfit: {
        name: t('Lecture-ready'), occasion: t('University'), style: t('Casual'),
        pieces: [
          { name: t('Heavyweight tee'), category: 'tops', color: t('white'), fromWardrobe: false },
          { name: t('Relaxed jeans'), category: 'jeans', color: t('denim blue'), fromWardrobe: false },
        ],
        colorPalette: [t('white'), t('denim blue'), t('sage')], shoes: t('White sneakers'), accessories: [t('Canvas tote')], outerwear: t('Sage overshirt'),
        whyItWorks: t('Relaxed bottoms with a clean top keep it effortless; the sage layer adds colour without effort.'), alternatives: [],
      },
    },
  }), [t]);
  const ex = examples[pick];

  const features = [
    { icon: MessageCircle, title: t('A stylist that talks back'), body: t('Describe the occasion in your own words. Sage asks what it needs to know, then explains why each look works.'), wide: true },
    { icon: Sparkles, title: t('Outfits as cards, not walls of text'), body: t('Pieces, palette, shoes and alternatives, all ready to save.') },
    { icon: Shirt, title: t('Your closet, put to work'), body: t('Add what you own and Sage builds looks from it.') },
    { icon: Trophy, title: t('Tiny daily style quests'), body: t('Earn XP for real actions, like saving a look or adding a piece. Gentle streaks, never punishing.'), wide: true },
  ];
  const steps = [
    [t('Tell Sage your taste'), t('A short, friendly setup covers styles, colours, budget and occasions. Everything personal is optional.')],
    [t('Ask anything'), t('Date night, interviews, a colour question or “what can I make from my closet?”.')],
    [t('Save, learn, repeat'), t('Keep the looks you love and complete small daily quests as your confidence grows.')],
  ];

  return (
    <div className="landing">
      <header className="lnav">
        <Logo />
        <nav aria-label={t('Primary')} className="lnav__links">
          <a href="#how">{t('How it works')}</a>
          <a href="#features">{t('Features')}</a>
          <a href="#preview">{t('Preview')}</a>
        </nav>
        <div className="row">
          <Link to={user ? '/app' : '/auth'} className="btn btn--soft btn--sm">{user ? t('Open app') : t('Sign in')}</Link>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <motion.div className="hero__copy" variants={stagger()} initial="hidden" animate="show">
            <motion.span variants={fadeUp} className="eyebrow"><Wand2 size={14} aria-hidden /> {t('Your friendly AI personal stylist')}</motion.span>
            <motion.h1 variants={fadeUp}>{t('Your style. Your rules.')} <em>{t('Your AI stylist.')}</em></motion.h1>
            <motion.p variants={fadeUp} className="lead">{t('Personal outfit advice that knows your taste, your budget, your weather and the clothes you already own.')}</motion.p>
            <motion.div variants={fadeUp} className="hero__cta">
              <LinkButton to={cta} size="lg" icon={<ArrowRight size={18} />}>{t('Find Your Style')}</LinkButton>
              <a href="#preview" className="btn btn--ghost btn--lg">{t('Meet Your Stylist')}</a>
            </motion.div>
          </motion.div>

          <div className="hero__art">
            <MascotStage size="xl" mood="happy" action="greeting" bubbleKey={`hero-${lang}`}
              bubble={<>{t("Hi, I'm {name}!", { name: brand.mascotName })} <strong>{t('What should we wear today?')}</strong></>} />
            <motion.div className="hero__chip" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0, transition: { delay: 0.7 } }}>
              <span className="tag tag--clay">{t('Example')}</span>
              <strong>{t('Olive + cream + terracotta')}</strong>
              <span>{t('A palette that works on nearly everyone.')}</span>
            </motion.div>
          </div>
        </section>

        <section id="how" className="section">
          <h2>{t('How it works')}</h2>
          <ol className="steps">
            {steps.map(([title, body], i) => (
              <motion.li key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * 0.08 }}>
                <span className="steps__n" aria-hidden>{i + 1}</span><h3>{title}</h3><p>{body}</p>
              </motion.li>
            ))}
          </ol>
        </section>

        <section id="features" className="section">
          <h2>{t('Made to be used every day')}</h2>
          <div className="bento">
            {features.map(({ icon: Icon, title, body, wide }) => (
              <motion.article key={title} className={wide ? 'bento__item bento__item--wide' : 'bento__item'}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}>
                <Icon size={26} aria-hidden /><h3>{title}</h3><p>{body}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="preview" className="section section--tint">
          <h2>{t('Try the conversation')}</h2>
          <p className="muted">{t('Pick a moment. These are written examples to show the format. Your real stylist adapts to you.')}</p>
          <div className="preview">
            <div className="preview__chips" role="group" aria-label={t('Example occasions')}>
              {(['Date', 'Interview', 'University'] as ExampleKey[]).map((k) => (
                <button key={k} className={k === pick ? 'chip chip--on' : 'chip'} aria-pressed={k === pick} onClick={() => setPick(k)}>{t(k)}</button>
              ))}
            </div>
            <div className="preview__chat" aria-live="polite">
              <div className="msg msg--user"><div className="msg__bubble">{ex.q}</div></div>
              <div className="msg msg--assistant preview__reply">
                <Mascot size="xs" mood="recommending" action="recommending" decorative still />
                <div className="msg__bubble">{ex.reply}</div>
              </div>
              <article className="ocard ocard--compact preview__card">
                <OutfitVisual outfit={ex.outfit} />
                <div className="ocard__body">
                  <span className="tag tag--clay">{t('Example outfit')}</span>
                  <h3>{ex.outfit.name}</h3>
                  <p className="why">{ex.outfit.whyItWorks}</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="cta-final">
          <Mascot size="lg" mood="excited" action="victory" decorative />
          <div>
            <h2>{t('Ready to feel good in what you wear?')}</h2>
            <p className="lead">{t("Set up takes about two minutes. Skip anything you'd rather not share.")}</p>
            <LinkButton to={cta} size="lg" variant="clay" icon={<ArrowRight size={18} />}>{t('Find Your Style')}</LinkButton>
          </div>
        </section>
      </main>

      <footer className="lfoot">
        <Logo />
        <nav aria-label={t('Footer')}>
          <Link to="/privacy">{t('Privacy')}</Link>
          <Link to="/terms">{t('Terms')}</Link>
          <a href={`mailto:${brand.contactEmail}`}>{t('Contact')}</a>
          <a href={brand.whatsappUrl} target="_blank" rel="noopener noreferrer">
            {t('WhatsApp support')} · {brand.whatsappDisplay} <ExternalLink size={13} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} />
          </a>
          {brand.social.map((s) => <a key={s.href} href={s.href} rel="noreferrer noopener" target="_blank">{s.label}</a>)}
        </nav>
        <small>© {new Date().getFullYear()} {brand.name}</small>
      </footer>
    </div>
  );
}
