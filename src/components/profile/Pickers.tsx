import { BUDGET_OPTIONS, CATEGORY_OPTIONS, COLOR_OPTIONS, OCCASION_OPTIONS, SHOPPING_OPTIONS, SIZE_FIELDS, STYLE_OPTIONS } from '@/config/options';
import { Chip, Field, Input } from '@/components/ui';
import { toggle, cn } from '@/lib/util';
import { useT } from '@/i18n';
import type { Profile } from '@/types';

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div role="group" aria-label={label} className="chips">{children}</div>
);

interface MultiProps { value: string[]; onChange: (v: string[]) => void }

export function StylePicker({ value, onChange }: MultiProps) {
  const { t } = useT();
  return (
    <Group label={t('Style preferences')}>
      {STYLE_OPTIONS.map((s) => <Chip key={s} selected={value.includes(s)} onClick={() => onChange(toggle(value, s))}>{t(s)}</Chip>)}
    </Group>
  );
}

export function OccasionPicker({ value, onChange }: MultiProps) {
  const { t } = useT();
  return (
    <Group label={t('Common occasions')}>
      {OCCASION_OPTIONS.map((s) => <Chip key={s} selected={value.includes(s)} onClick={() => onChange(toggle(value, s))}>{t(s)}</Chip>)}
    </Group>
  );
}

export function CategoryPicker({ value, onChange }: MultiProps) {
  const { t } = useT();
  return (
    <Group label={t('Clothing categories')}>
      {CATEGORY_OPTIONS.map((c) => <Chip key={c.value} selected={value.includes(c.value)} onClick={() => onChange(toggle(value, c.value))}>{t(c.label)}</Chip>)}
    </Group>
  );
}

export function ColorPicker({ value, onChange }: MultiProps) {
  const { t } = useT();
  return (
    <Group label={t('Preferred colours')}>
      {COLOR_OPTIONS.map((c) => (
        <Chip key={c.name} swatch={c.hex} selected={value.includes(c.name)} onClick={() => onChange(toggle(value, c.name))}>{t(c.name)}</Chip>
      ))}
    </Group>
  );
}

export function ShoppingPicker({ value, onChange }: MultiProps) {
  const { t } = useT();
  return (
    <Group label={t('Shopping preferences')}>
      {SHOPPING_OPTIONS.map((s) => <Chip key={s} selected={value.includes(s)} onClick={() => onChange(toggle(value, s))}>{t(s)}</Chip>)}
    </Group>
  );
}

export function BudgetPicker({ value, onChange }: { value: Profile['budget_preference']; onChange: (v: Profile['budget_preference']) => void }) {
  const { t } = useT();
  return (
    <div className="options" role="radiogroup" aria-label={t('Budget range')}>
      {BUDGET_OPTIONS.map((b) => (
        <button key={b.value} type="button" role="radio" aria-checked={value === b.value}
          className={cn('option', value === b.value && 'option--on')}
          onClick={() => onChange(value === b.value ? null : b.value)}>
          <strong>{t(b.label)}</strong><span>{t(b.hint)}</span>
        </button>
      ))}
    </div>
  );
}

export function SizeFields({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { t } = useT();
  return (
    <div className="grid-3">
      {SIZE_FIELDS.map((f) => (
        <Field key={f.key} label={t(f.label)} htmlFor={`size-${f.key}`}>
          <Input id={`size-${f.key}`} value={value[f.key] ?? ''} maxLength={12} placeholder={t('e.g. M or 42')}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })} />
        </Field>
      ))}
    </div>
  );
}
