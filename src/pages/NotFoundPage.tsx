import { LinkButton, EmptyState } from '@/components/ui';
import { useT } from '@/i18n';

export default function NotFoundPage() {
  const { t } = useT();
  return (
    <main id="main" className="page-narrow">
      <EmptyState mood="surprised" title={t('That page wandered off')}
        body={t("We couldn't find what you were looking for.")}
        action={<LinkButton to="/">{t('Back home')}</LinkButton>} />
    </main>
  );
}
