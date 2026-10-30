import { useMemo, useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button, Chip, Input } from '@/components/ui';
import { HAIR_COLORS, HAIR_STYLES, SHAPES, SKIN_TONES, ZERO_ADJUST, deriveBody, validateMeasurements, type Body } from './body';
import type { Adjust, AvatarConfig, Sex } from './types';

interface Props { cfg: AvatarConfig; onChange: (c: AvatarConfig) => void }

const SLIDERS: { key: keyof Adjust; label: string; lo: string; hi: string; est?: (b: Body) => string }[] = [
  { key: 'shoulders', label: 'Shoulder width', lo: 'Narrower', hi: 'Wider', est: (b) => `about ${b.est.shoulders} cm across` },
  { key: 'chest', label: 'Chest size', lo: 'Smaller', hi: 'Larger', est: (b) => `about ${b.est.chest} cm around` },
  { key: 'waist', label: 'Waist size', lo: 'Smaller', hi: 'Larger', est: (b) => `about ${b.est.waist} cm around` },
  { key: 'hips', label: 'Hip size', lo: 'Smaller', hi: 'Larger', est: (b) => `about ${b.est.hips} cm around` },
  { key: 'legs', label: 'Leg length', lo: 'Shorter', hi: 'Longer', est: (b) => `inseam about ${b.est.inseam} cm` },
  { key: 'muscle', label: 'Muscle definition', lo: 'Softer', hi: 'More defined' },
];

export function BodyPanel({ cfg, onChange }: Props) {
  const body = useMemo(() => deriveBody(cfg), [cfg]);
  const [h, setH] = useState(String(cfg.heightCm));
  const [w, setW] = useState(String(cfg.weightKg));
  const [errors, setErrors] = useState<{ height?: string; weight?: string }>({});
  const pristine = Object.values(cfg.adjust).every((v) => v === 0);

  // Valid values apply instantly while typing. Errors only show once the field loses focus.
  const commit = (nh: string, nw: string) => {
    const r = validateMeasurements(nh, nw);
    if (r.ok) { setErrors({}); onChange({ ...cfg, heightCm: r.height, weightKg: r.weight }); }
  };
  const showErrors = () => {
    const r = validateMeasurements(h, w);
    setErrors(r.ok ? {} : r.errors);
  };

  const setSex = (sex: Sex) => onChange({ ...cfg, sex });

  return (
    <div className="stack">
      <div>
        <span className="label" id="bp-preset">Body preset</span>
        <div className="chips" role="group" aria-labelledby="bp-preset">
          <Chip selected={cfg.sex === 'female'} onClick={() => setSex('female')}>Female</Chip>
          <Chip selected={cfg.sex === 'male'} onClick={() => setSex('male')}>Male</Chip>
        </div>
        <p className="field__hint">A starting point only. Every proportion below can be changed.</p>
      </div>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="bp-h">Height (cm)</label>
          <Input id="bp-h" inputMode="decimal" value={h} aria-invalid={!!errors.height} aria-describedby={errors.height ? 'bp-h-err' : undefined}
            onChange={(e) => { setH(e.target.value); commit(e.target.value, w); }} onBlur={showErrors} />
          {errors.height && <p id="bp-h-err" className="field__error" role="alert">{errors.height}</p>}
        </div>
        <div className="field">
          <label htmlFor="bp-w">Weight (kg)</label>
          <Input id="bp-w" inputMode="decimal" value={w} aria-invalid={!!errors.weight} aria-describedby={errors.weight ? 'bp-w-err' : undefined}
            onChange={(e) => { setW(e.target.value); commit(h, e.target.value); }} onBlur={showErrors} />
          {errors.weight && <p id="bp-w-err" className="field__error" role="alert">{errors.weight}</p>}
        </div>
      </div>

      <div>
        <span className="label" id="bp-shape">Body shape</span>
        <div className="chips" role="group" aria-labelledby="bp-shape">
          {SHAPES.map((s) => (
            <Chip key={s.value} selected={cfg.shape === s.value} onClick={() => onChange({ ...cfg, shape: s.value })}>{s.label}</Chip>
          ))}
        </div>
      </div>

      <div className="stack-sm">
        <div className="row-between">
          <span className="label" style={{ margin: 0 }}>Fine-tune</span>
          <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} disabled={pristine} onClick={() => onChange({ ...cfg, adjust: { ...ZERO_ADJUST } })}>
            Reset to initial shape
          </Button>
        </div>
        {SLIDERS.map((s) => {
          const v = cfg.adjust[s.key];
          const pct = Math.round(v * 100);
          const id = `bp-${s.key}`;
          return (
            <div className="slider" key={s.key}>
              <div className="slider__top">
                <label htmlFor={id}>{s.label}</label>
                <span className="muted small">{s.est ? s.est(body) : `${pct > 0 ? '+' : ''}${pct}%`}</span>
              </div>
              <input id={id} type="range" min={-1} max={1} step={0.05} value={v}
                aria-valuetext={`${pct > 0 ? '+' : ''}${pct} percent${s.est ? `, ${s.est(body)}` : ''}`}
                onChange={(e) => onChange({ ...cfg, adjust: { ...cfg.adjust, [s.key]: Number(e.target.value) } })} />
              <div className="slider__ends muted small" aria-hidden><span>{s.lo}</span><span>{s.hi}</span></div>
            </div>
          );
        })}
        <p className="field__hint">Sizes are estimates from the model, not tape measurements.</p>
      </div>
    </div>
  );
}

export function LookPanel({ cfg, onChange }: Props) {
  return (
    <div className="stack">
      <div>
        <span className="label" id="lp-skin">Skin tone</span>
        <div className="swatches" role="group" aria-labelledby="lp-skin">
          {SKIN_TONES.map((t) => (
            <button key={t.hex} type="button" className="swatch" style={{ background: t.hex }} aria-label={t.label} aria-pressed={cfg.skin === t.hex} title={t.label}
              onClick={() => onChange({ ...cfg, skin: t.hex })}>
              {cfg.skin === t.hex && <Check size={16} aria-hidden />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label" id="lp-hair">Hairstyle</span>
        <div className="chips" role="group" aria-labelledby="lp-hair">
          {HAIR_STYLES.map((s) => (
            <Chip key={s.value} selected={cfg.hair === s.value} onClick={() => onChange({ ...cfg, hair: s.value })}>{s.label}</Chip>
          ))}
        </div>
      </div>

      {cfg.hair !== 'none' && (
        <div>
          <span className="label" id="lp-hair-color">Hair colour</span>
          <div className="swatches" role="group" aria-labelledby="lp-hair-color">
            {HAIR_COLORS.map((t) => (
              <button key={t.hex} type="button" className="swatch" style={{ background: t.hex }} aria-label={t.label} aria-pressed={cfg.hairColor === t.hex} title={t.label}
                onClick={() => onChange({ ...cfg, hairColor: t.hex })}>
                {cfg.hairColor === t.hex && <Check size={16} aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
