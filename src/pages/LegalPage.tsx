import { Link } from 'react-router-dom';
import { brand } from '@/config/brand';
import { useT } from '@/i18n';
import { Logo, Notice } from '@/components/ui';

export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const { t } = useT();
  return (
    <div className="page-narrow">
      <Logo />
      <main id="main" className="prose">
        <Notice title={t('Template')} tone="warn">
          {t('This page is a plain-language starting point describing how the app is built. Have it reviewed and replace it with your own legal text before launching publicly.')}
        </Notice>
        {kind === 'privacy' ? (
          <>
            <h1>{t('Privacy')}</h1>
            <p>{t('{name} provides style profiles, an AI stylist, wardrobe and outfit tools, an avatar, quests and progress, optional weather, notifications, and a clothing marketplace. This notice describes the information those features use.', { name: brand.name })}</p>
            <h2>{t('Information used by the app')}</h2>
            <p>{t('Depending on the features you use, this can include your sign-in email, display name and language; style, colour, occasion, category, budget, shopping and size preferences; wardrobe descriptions and photos; chat messages and replies; saved outfits and favorites; avatar settings and looks; quest completions, achievements, experience points and streaks; and notification preferences and push subscription data.')}</p>
            <p>{t('If you use the marketplace, listing details and photos you submit are stored, along with seller contact information and the city or country attached to a listing. The app may estimate a city or country from the connection for marketplace matching; the IP address is not stored by that feature. Listing details are shown to marketplace users. Seller contact details are revealed only through the listing contact action.')}</p>
            <h2>{t('Where information is stored')}</h2>
            <p>{t('With an account, app records are stored in the configured Supabase database and storage. Access controls are intended to limit private account records to that account; marketplace listings are designed to be visible to other users. Wardrobe and marketplace photos use protected storage links. In demo mode, supported app data is kept in this browser and is not synced; some features, including AI chat and photo uploads, are unavailable.')}</p>
            <p>{t('The browser also stores settings and certain feature data locally, such as language, display preferences, avatar data, and demo data. The marketplace can temporarily cache approximate location in session storage. Your browser may store the sign-in session.')}</p>
            <h2>{t('AI stylist')}</h2>
            <p>{t('When you send a stylist request, your message, recent conversation turns and relevant style preferences are sent to the site’s AI service provider to generate a reply and outfit suggestions. If “Let Sage see my wardrobe items” is enabled, item names, categories and colours may also be sent. You can turn that option off in Settings. Account email, exact location, sizes and photos are not sent to the AI provider. The provider may process requests under its own service terms and retention practices.')}</p>
            <h2>{t('Weather, voice and external services')}</h2>
            <p>{t('Weather is optional. If you search for a city or enable weather, the city search or selected coordinates are sent to the configured weather provider. The app does not request browser geolocation for this feature. Voice input and spoken replies use browser speech capabilities; availability and processing depend on your browser and its provider.')}</p>
            <p>{t('Authentication and app data use Supabase. Account and reminder emails may be delivered through configured email providers, including Resend. If you enable browser notifications, a push subscription is stored so notifications can be delivered. Marketplace contact buttons can open WhatsApp, phone, email or another external service; those services then handle your interaction under their own privacy policies.')}</p>
            <h2>{t('Notifications and choices')}</h2>
            <p>{t('Daily reminders and weekly summaries are optional and off until enabled. You can change notification channels and preferences in Settings. You can also disable weather, turn off sharing wardrobe details with the AI, and choose whether to use voice features.')}</p>
            <h2>{t('Your choices and account deletion')}</h2>
            <p>{t('Settings lets you request a download of available account data and delete your account. Deletion removes account data handled by the app, including profile information, wardrobe items and photos, conversations, saved outfits and progress. Some records may remain temporarily in provider backups or where retention is legally required.')}</p>
            <h2>{t('Security and contact')}</h2>
            <p>{t('The app uses account access controls and protected storage for private records, but no online service can guarantee absolute security. For privacy questions or requests, contact {email}.', { email: brand.contactEmail })}</p>
          </>
        ) : (
          <>
            <h1>{t('Terms')}</h1>
            <p>{t('{name} offers general styling suggestions generated by an AI model. Suggestions are not guaranteed to suit every person, occasion, climate or budget.', { name: brand.name })}</p>
            <p>{t('Prices, availability and weather suitability are not verified unless stated. Use your own judgment and comfort.')}</p>
            <p>{t('You are responsible for the content you upload and must have the right to use it.')}</p>
          </>
        )}
        <p><Link to="/">{t('← Back home')}</Link> · <a href={`mailto:${brand.contactEmail}`}>{t('Contact')}</a></p>
      </main>
    </div>
  );
}
