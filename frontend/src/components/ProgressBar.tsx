interface ProgressBarProps {
  current: number;
  total: number;
}

const AVG_SECONDS_PER_STEP = 15;

function formatTimeLeft(seconds: number): string {
  if (seconds < 60) return 'Less than a minute left';
  const mins = Math.ceil(seconds / 60);
  return `~${mins} min left`;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((current / total) * 100));
  const remaining = Math.max(0, total - current);
  const timeLabel = remaining === 0 ? 'Almost done!' : formatTimeLeft(remaining * AVG_SECONDS_PER_STEP);

  return (
    <div style={{ padding: '0 20px 16px', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--color-cloud)', fontFamily: 'var(--font-body)' }}>
          {timeLabel}
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
