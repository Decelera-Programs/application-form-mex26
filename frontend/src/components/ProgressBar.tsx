interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((current / total) * 100));

  return (
    <div style={{ padding: '0 20px 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--color-cloud)', fontFamily: 'var(--font-body)' }}>
          Question {current} of {total}
        </span>
        <span style={{ fontSize: 12, color: 'var(--color-cloud)', fontFamily: 'var(--font-body)' }}>
          {pct}%
        </span>
      </div>
      <div style={{
        height: 4, borderRadius: 2,
        background: 'var(--color-cloud)',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: 'var(--color-water)',
          borderRadius: 2,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}
