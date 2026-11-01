import { Link } from 'react-router-dom';
import { CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';
import type { Quest } from '@/types';

export function QuestRow({ quest, done, busy, onCheck, goTo }:
  { quest: Quest; done: boolean; busy?: boolean; onCheck?: () => void; goTo?: string }) {
  const { t } = useT();
  return (
    <li className={done ? 'quest quest--done' : 'quest'}>
      {done ? <CheckCircle2 className="quest__icon" size={24} aria-hidden /> : <Circle className="quest__icon" size={24} aria-hidden />}
      <div className="quest__text">
        <strong>{t(quest.title)}</strong>
        <span>{t(quest.description)}</span>
        {!done && goTo && <Link className="link-btn" to={goTo}>{t('Go there →')}</Link>}
      </div>
      <span className="xp-pill">{done ? t('Done') : t('+{xp} XP · +1 quest coin', { xp: quest.xp_reward })}</span>
      {!done && onCheck && <Button size="sm" variant="soft" loading={busy} onClick={onCheck}>{t('Check')}</Button>}
    </li>
  );
}
