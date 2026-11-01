import { useCallback, useEffect, useState } from 'react';
import { Coins, Gift } from 'lucide-react';
import { Button, ErrorNotice, Modal, Notice } from '@/components/ui';
import { MAX_COUPONS, couponState, exchangeQuestCoins, getCreditSummary, redeemCoupon, type CreditSummary } from '@/lib/store';
import { errMessage } from '@/lib/util';
import { useToast } from '@/hooks/useToast';
import { useT } from '@/i18n';
import { loadJourney } from '@/lib/glowup';

/** The buyer's store credit: balance, how to earn, discount coupons to get, and recent activity. */
export function CreditPanel({ open, onClose, onBalance }: { open: boolean; onClose: () => void; onBalance: (n: number) => void }) {
  const { t, lang } = useT();
  const { toast } = useToast();
  const [s, setS] = useState<CreditSummary | null>(null);
  const [questCoins, setQuestCoins] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | 'exchange' | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [x, journey] = await Promise.all([getCreditSummary(), loadJourney()]);
      setS(x);
      setQuestCoins(journey.profile.coins);
      onBalance(x.balance);
    }
    catch (e) { setError(errMessage(e, t('Could not load your credit.'))); }
  }, [onBalance, t]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  const active = (s?.coupons ?? []).filter((c) => couponState(c) === 'active').length;
  const conversionCount = Math.floor(questCoins / 10);
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang);

  const exchange = async () => {
    setBusy('exchange');
    try {
      const result = await exchangeQuestCoins();
      await load();
      toast(t('Exchanged {coins} quest coins for {points} discount points.', { coins: result.converted * 10, points: result.converted }), 'success');
    } catch (e) { toast(errMessage(e, t('Could not exchange quest coins.')), 'error'); }
    finally { setBusy(null); }
  };

  const get = async (percent: number) => {
    setBusy(percent);
    try {
      const r = await redeemCoupon(percent);
      toast(t('Coupon ready: {code}', { code: r.code }), 'success');
      await load();
    } catch (e) { toast(errMessage(e, t('Could not create that coupon.')), 'error'); }
    finally { setBusy(null); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('Store credit')}>
      {error && <ErrorNotice message={error} onRetry={() => void load()} />}
      {!s && !error && <p className="muted">{t('Loading…')}</p>}
      {s && (
        <div className="stack">
          <p className="credit__balance"><Gift size={20} aria-hidden /> <strong>{t('{n} points', { n: s.balance })}</strong></p>

          <section className="stack-sm" aria-label={t('Quest coin exchange')}>
            <h3 className="h3"><Coins size={17} aria-hidden /> {t('{n} quest coins', { n: questCoins })}</h3>
            <p className="muted small">{t('Exchange 10 quest coins for 1 discount point. Extra coins stay in your balance.')}</p>
            <Button variant="soft" disabled={conversionCount === 0 || busy !== null} loading={busy === 'exchange'} onClick={() => void exchange()}>
              {conversionCount > 0
                ? t('Exchange {coins} quest coins for {points} discount points', { coins: conversionCount * 10, points: conversionCount })
                : t('{n} more quest coins needed', { n: 10 - questCoins })}
            </Button>
          </section>

          <Notice title={t('How you earn credit')}>
            {t('Every time you buy a piece from the store you earn 20 points, plus 1 point for every 2 € you pay (up to 120 points per purchase). The seller records your purchase to add the points.')}
          </Notice>

          <section className="stack-sm" aria-labelledby="cr-tiers">
            <h3 className="h3" id="cr-tiers">{t('Turn credit into discounts')}</h3>
            <p className="muted small">{t('A coupon is valid for 60 days, works on one piece and takes off up to 40 €. You can hold 3 unused coupons at a time.')}</p>
            <ul className="credit__tiers">
              {s.tiers.map((x) => {
                const afford = s.balance >= x.cost;
                return (
                  <li key={x.percent} className="credit__tier">
                    <span><strong>{t('{p}% off', { p: x.percent })}</strong> <span className="muted small">· {t('{n} points', { n: x.cost })}</span></span>
                    <Button size="sm" variant={afford ? 'primary' : 'ghost'} loading={busy === x.percent} disabled={!afford || active >= MAX_COUPONS || busy !== null}
                      onClick={() => void get(x.percent)}>{afford ? t('Get coupon') : t('{n} more points', { n: x.cost - s.balance })}</Button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="stack-sm" aria-labelledby="cr-coupons">
            <h3 className="h3" id="cr-coupons">{t('Your coupons')}</h3>
            {s.coupons.length === 0 ? <p className="muted small">{t('No coupons yet.')}</p> : (
              <ul className="credit__coupons">
                {s.coupons.map((c) => {
                  const st = couponState(c);
                  return (
                    <li key={c.id} className={`credit__coupon credit__coupon--${st}`}>
                      <span><strong>{t('{p}% off', { p: c.percent })}</strong> <code>{c.code}</code></span>
                      <span className="small muted">{st === 'active' ? t('Valid until {date}', { date: date(c.expires_at) }) : st === 'used' ? t('Used') : t('Expired')}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {active > 0 && <p className="field__hint">{t('Show the code to the seller when you buy.')}</p>}
          </section>

          {s.ledger.length > 0 && (
            <section className="stack-sm" aria-labelledby="cr-log">
              <h3 className="h3" id="cr-log">{t('Recent activity')}</h3>
              <ul className="credit__log">
                {s.ledger.map((r) => (
                  <li key={r.id}><span>{r.reason === 'purchase' ? t('Purchase') : t('Coupon')} · <span className="muted small">{date(r.created_at)}</span></span>
                    <strong className={r.delta > 0 ? 'credit__plus' : 'credit__minus'}>{r.delta > 0 ? '+' : ''}{r.delta}</strong></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
