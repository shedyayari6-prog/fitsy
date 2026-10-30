import { useState, type FormEvent } from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { Button, Field, Input, Notice } from '@/components/ui';
import { SHAPES, defaultConfig, validateMeasurements } from './body';
import type { AvatarConfig, Sex, Shape } from './types';

const PRESETS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Female preset' },
  { value: 'male', label: 'Male preset' },
];

export default function AvatarSetup({ onCreate }: { onCreate: (c: AvatarConfig) => void }) {
  const [sex, setSex] = useState<Sex>('female');
  const [shape, setShape] = useState<Shape>('average');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [errors, setErrors] = useState<{ height?: string; weight?: string }>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const r = validateMeasurements(height, weight);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors({});
    onCreate(defaultConfig(sex, r.height, r.weight, shape));
  };

  return (
    <div className="page-narrow avx-setup">
      <p className="eyebrow">Virtual fitting room</p>
      <h1>Build your 3D avatar</h1>
      <p className="lead">Enter a few measurements and Fitsy shapes an avatar you can dress with your own wardrobe.</p>

      <Notice title="No photo needed">
        <span className="avx-privacy"><ShieldCheck size={16} aria-hidden /> We only use what you type here. Your avatar is an estimate and may not match your real body exactly, so you can adjust every part of it afterwards.</span>
      </Notice>

      <form className="card avx-setup__form" onSubmit={submit} noValidate>
        <div>
          <span className="label" id="avx-preset-label">Starting body preset</span>
          <div className="options" role="group" aria-labelledby="avx-preset-label">
            {PRESETS.map((p) => (
              <button key={p.value} type="button" className={`option ${sex === p.value ? 'option--on' : ''}`} aria-pressed={sex === p.value} onClick={() => setSex(p.value)}>
                {p.label}
                <span>Only sets the starting proportions</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label htmlFor="avx-h">Height (cm)</label>
            <Input id="avx-h" inputMode="decimal" placeholder="e.g. 168" value={height} aria-invalid={!!errors.height} aria-describedby={errors.height ? 'avx-h-err' : undefined}
              onChange={(e) => setHeight(e.target.value)} />
            {errors.height && <p id="avx-h-err" className="field__error" role="alert">{errors.height}</p>}
          </div>
          <div className="field">
            <label htmlFor="avx-w">Weight (kg)</label>
            <Input id="avx-w" inputMode="decimal" placeholder="e.g. 62" value={weight} aria-invalid={!!errors.weight} aria-describedby={errors.weight ? 'avx-w-err' : undefined}
              onChange={(e) => setWeight(e.target.value)} />
            {errors.weight && <p id="avx-w-err" className="field__error" role="alert">{errors.weight}</p>}
          </div>
        </div>

        <div>
          <span className="label" id="avx-shape-label">Body shape</span>
          <div className="options avx-shapes" role="group" aria-labelledby="avx-shape-label">
            {SHAPES.map((s) => (
              <button key={s.value} type="button" className={`option ${shape === s.value ? 'option--on' : ''}`} aria-pressed={shape === s.value} onClick={() => setShape(s.value)}>
                {s.label}
                <span>{s.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="row-end">
          <Button type="submit" size="lg" icon={<Sparkles size={18} />}>Generate my avatar</Button>
        </div>
      </form>
    </div>
  );
}
