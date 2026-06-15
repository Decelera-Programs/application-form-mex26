import React, { useState, useRef, useEffect } from 'react';
import type { FlowStep } from '../../../shared/types';

interface InputProps {
  step: FlowStep;
  onSubmit: (answer: unknown) => void;
  disabled?: boolean;
}

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  border: '2px solid var(--color-cloud)',
  borderRadius: 14,
  fontSize: 15,
  fontFamily: 'var(--font-body)',
  color: 'var(--color-night)',
  background: '#fff',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
};

export function StepInput({ step, onSubmit, disabled }: InputProps) {
  const [value, setValue] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setValue('');
    setSelected([]);
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [step.id]);

  function handleSubmit() {
    if (step.type === 'multiselect') {
      if (step.required && selected.length === 0) return;
      onSubmit(selected);
    } else if (step.type === 'boolean') {
      return;
    } else {
      if (step.required && !value.trim()) return;
      onSubmit(value.trim() || null);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && step.type !== 'textarea') {
      e.preventDefault();
      handleSubmit();
    }
  }

  // ---- Statement ----
  if (step.type === 'statement') {
    return (
      <button
        onClick={() => onSubmit(null)}
        disabled={disabled}
        style={{
          padding: '12px 28px',
          background: 'var(--color-sea)',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 15,
          fontFamily: 'var(--font-body)',
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Continuar →
      </button>
    );
  }

  // ---- Boolean ----
  if (step.type === 'boolean') {
    return (
      <div style={{ display: 'flex', gap: 12 }}>
        {(['Sí', 'No'] as const).map((opt) => (
          <button
            key={opt}
            disabled={disabled}
            onClick={() => onSubmit(opt === 'Sí')}
            style={{
              flex: 1, padding: '12px 0',
              border: '2px solid var(--color-cloud)',
              borderRadius: 10, fontSize: 15,
              fontFamily: 'var(--font-body)',
              background: '#fff',
              color: 'var(--color-night)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  // ---- Select ----
  if (step.type === 'select') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {step.options?.map((opt) => (
          <button
            key={opt}
            disabled={disabled}
            onClick={() => onSubmit(opt)}
            style={{
              width: '100%', padding: '11px 20px',
              border: '2px solid var(--color-water)',
              borderRadius: 999, textAlign: 'left',
              fontSize: 15, fontFamily: 'var(--font-body)',
              background: 'var(--color-water)', color: 'var(--color-night)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#17b8d4';
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#17b8d4';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-water)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-water)';
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  // ---- Multiselect — chip/wrap layout ----
  if (step.type === 'multiselect') {
    function toggle(opt: string) {
      setSelected((prev) =>
        prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
      );
    }
    return (
      <div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {step.options?.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                disabled={disabled}
                onClick={() => toggle(opt)}
                style={{
                  padding: '8px 16px',
                  border: `2px solid ${isSelected ? '#17b8d4' : 'var(--color-water)'}`,
                  borderRadius: 999,
                  fontSize: 14,
                  fontFamily: 'var(--font-body)',
                  background: isSelected ? '#17b8d4' : 'var(--color-water)',
                  color: 'var(--color-night)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
              >
                {isSelected ? '✓ ' : ''}{opt}
              </button>
            );
          })}
        </div>
        <button
          disabled={disabled || (step.required ? selected.length === 0 : false)}
          onClick={handleSubmit}
          style={{
            padding: '12px 28px', background: 'var(--color-sea)',
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 15, fontFamily: 'var(--font-body)', cursor: 'pointer',
          }}
        >
          Continuar →
        </button>
      </div>
    );
  }

  // ---- Textarea with character counter ----
  if (step.type === 'textarea') {
    const charsLeft = step.maxLength !== undefined ? step.maxLength - value.length : null;
    const counterColor =
      charsLeft === null ? 'var(--color-cloud)'
      : charsLeft <= 20 ? '#e53e3e'
      : charsLeft <= 50 ? '#dd6b20'
      : 'var(--color-cloud)';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={step.placeholder}
          disabled={disabled}
          rows={4}
          maxLength={step.maxLength}
          style={{ ...inputBase, resize: 'vertical', minHeight: 100 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {charsLeft !== null ? (
            <span style={{ fontSize: 12, color: counterColor, fontFamily: 'var(--font-body)', transition: 'color 0.2s' }}>
              {charsLeft} restantes
            </span>
          ) : <span />}
          <button
            disabled={disabled || (step.required ? !value.trim() : false)}
            onClick={handleSubmit}
            style={{
              padding: '11px 24px',
              background: 'var(--color-sea)', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 15,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
            }}
          >
            Enviar →
          </button>
        </div>
      </div>
    );
  }

  // ---- Text / email / url / number ----
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={step.type === 'number' ? 'number' : step.type === 'email' ? 'email' : 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKey}
        placeholder={step.placeholder}
        disabled={disabled}
        style={{ ...inputBase, flex: 1 }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--color-water)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--color-cloud)')}
      />
      <button
        disabled={disabled || (step.required ? !value.trim() : false)}
        onClick={handleSubmit}
        style={{
          padding: '12px 20px', background: 'var(--color-sea)',
          color: '#fff', border: 'none', borderRadius: 10,
          fontSize: 20, cursor: 'pointer', flexShrink: 0,
        }}
      >
        →
      </button>
    </div>
  );
}
