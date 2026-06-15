interface ChatBubbleProps {
  message: string;
  type: 'bot' | 'user';
  isNew?: boolean;
}

export function ChatBubble({ message, type, isNew = false }: ChatBubbleProps) {
  return (
    <div
      className={`bubble ${type} ${isNew ? 'bubble--new' : ''}`}
      style={{
        display: 'flex',
        justifyContent: type === 'user' ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
        animation: isNew ? 'fadeSlideIn 0.3s ease-out' : 'none',
      }}
    >
      {type === 'bot' && (
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--color-sea)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 10,
          flexShrink: 0,
          marginTop: 4,
        }}>
          {/* Tótem D simplified */}
          <svg viewBox="0 0 84.4 84.4" width="18" height="18">
            <path
              d="M42.2 10C24.5 10 10 24.5 10 42.2s14.5 32.2 32.2 32.2 32.2-14.5 32.2-32.2S59.9 10 42.2 10zm0 54.4c-12.3 0-22.2-9.9-22.2-22.2S29.9 20 42.2 20s22.2 9.9 22.2 22.2-9.9 22.2-22.2 22.2z"
              fill="#1FD0EF"
            />
            <text x="34" y="50" fill="#1FD0EF" fontSize="22" fontFamily="serif" fontWeight="bold">D</text>
          </svg>
        </div>
      )}
      <div
        style={{
          maxWidth: '75%',
          padding: '12px 16px',
          borderRadius: type === 'bot' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
          background: type === 'bot' ? 'var(--color-sky)' : 'var(--color-sea)',
          color: type === 'bot' ? 'var(--color-night)' : '#fff',
          fontSize: 15,
          lineHeight: 1.6,
          fontFamily: 'var(--font-body)',
          whiteSpace: 'pre-line',
          boxShadow: '0 1px 3px rgba(45,56,82,0.08)',
        }}
      >
        {message}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--color-sea)', flexShrink: 0,
      }} />
      <div style={{
        padding: '10px 16px',
        background: 'var(--color-sky)',
        borderRadius: '4px 16px 16px 16px',
        display: 'flex', gap: 4, alignItems: 'center',
      }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--color-cloud)',
              display: 'inline-block',
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
