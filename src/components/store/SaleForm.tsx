import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, Input, Modal, Notice } from '@/components/ui';
import { money } from '@/components/store/StoreBits';
import { completeSale, type SaleResult } from '@/lib/store';
import { errMessage } from '@/lib/util';
import { useT } from '@/i18n';
import type { StoreListing } from '@/types';

/** Admin only: record who bought a piece, apply their coupon, and credit them. */
export function SaleForm({ listing, onClose, onDone }: { listing: StoreListing | null; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useT();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<SaleResult | null>(null);
  useEffect(() => { if (listing) { setEmail(''); setCode(''); setErr(null); setRes(null); } }, [listing]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!listing) return;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr(t('Enter the buyer email.'));
    setBusy(true); setErr(null);
    try { setRes(await completeSale(listing.id, email, code)); }
    catch (x) { setErr(t(errMessage(x, 'Could not record this sale.'))); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={!!listing} onClose={() => !busy && (res ? onDone() : onClose())} title={t('Record a sale')}>
      {listing && !res && (
        <form className="stack" onSubmit={submit} noValidate>
          <p><strong>{listing.title}</strong> · {money(listing, lang)}</p>
          <p className="muted small">{t('The buyer must have a Fitsy account. They earn credit points when you record the sale.')}</p>
          <Field label={t('Buyer email')} htmlFor="sale-email"><Input id="sale-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label={t('Coupon code (optional)')} htmlFor="sale-code" hint={t('If the buyer shows a coupon, enter it to apply their discount.')}>
            <Input id="sale-code" autoComplete="off" value={code} maxLength={12} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </Field>
          {err && <p className="field__error" role="alert">{err}</p>}
          <div className="row-end">
            <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>{t('Cancel')}</Button>
            <Button type="submit" loading={busy}>{t('Record sale')}</Button>
          </div>
        </form>
      )}
      {listing && res && (
        <div className="stack">
          <Notice title={t('Sale recorded')}>
            <span>{t('Final price: {price}', { price: money({ price: res.final_price, currency: res.currency }, lang) })}
              {res.discount > 0 ? ` · ${t('Discount: {price}', { price: money({ price: res.discount, currency: res.currency }, lang) })}` : ''}</span>
            <br /><span>{t('The buyer earned {n} points.', { n: res.points })}</span>
          </Notice>
          <div className="row-end"><Button onClick={onDone}>{t('Done')}</Button></div>
        </div>
      )}
    </Modal>
  );
}
