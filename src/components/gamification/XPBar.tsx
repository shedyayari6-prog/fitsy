import { Flame, Star } from 'lucide-react';
import { ProgressBar } from '@/components/ui';
import { useT } from '@/i18n';
import type { Progress } from '@/types';

export function XPBar({ progress, compact }: { progress: Progress; compact?: boolean }) {
  const { t } = useT();
  const into = progress.total_xp % 100;
  return (
    <div className={compact ? 'xp xp--compact' : 'xp'}>
      <div className="xp__row">
        <span className="xp__level"><Star size={16} aria-hidden /> {t('Level {n}', { n: progress.level })}</span>
        <span className="xp__num">{into} / 100 XP</span>
      </div>
      <ProgressBar value={into} max={100} label={t('Progress to level {n}', { n: progress.level + 1 })} tone="clay" />
      {!compact && (
        <p className="xp__streak">
          <Flame size={16} aria-hidden /> {progress.current_streak > 0
            ? t('{n}-day streak. Longest: {max}.', { n: progress.current_streak, max: progress.longest_streak })
            : t('Complete a quest to start a streak. Missing a day never costs you XP.')}
        </p>
      )}
    </div>
  );
}
