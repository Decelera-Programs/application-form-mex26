import React from 'react';

interface ChatBubbleProps {
  message?: string;
  children?: React.ReactNode;
  type: 'bot' | 'user';
  isNew?: boolean;
}

export function ChatBubble({ message, children, type, isNew = false }: ChatBubbleProps) {
  return (
    <div
      className={`bubble ${type} ${isNew ? 'bubble--new' : ''}`}
      style={{
        display: 'flex',
        justifyContent: type === 'user' ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
        animation: isNew ? 'fadeSlideIn 0.35s cubic-bezier(0.34, 1.4, 0.64, 1)' : 'none',
      }}
    >
      {type === 'bot' && (
        <div style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          backgroundImage: 'url(https://images.squarespace-cdn.com/content/v1/67811e8fe702fd5553c65249/c5500619-9712-4b9b-83ee-a697212735ae/Disen%CC%83o+sin+ti%CC%81tulo+%2840%29.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          marginRight: 10,
          flexShrink: 0,
          marginTop: 4,
        }} />
      )}
      <div
        style={{
          maxWidth: '75%',
          padding: '12px 16px',
          borderRadius: type === 'bot' ? '4px var(--radius-bubble) var(--radius-bubble) var(--radius-bubble)' : 'var(--radius-bubble) 4px var(--radius-bubble) var(--radius-bubble)',
          background: type === 'bot' ? '#ffffff' : 'var(--color-sun)',
          color: 'var(--color-night)',
          fontSize: 15,
          lineHeight: 1.6,
          fontFamily: 'var(--font-body)',
          whiteSpace: 'pre-line',
          boxShadow: type === 'bot' ? '0 1px 4px rgba(45,56,82,0.08)' : 'none',
        }}
      >
        {children ?? message}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        backgroundImage: 'url(https://images.squarespace-cdn.com/content/v1/67811e8fe702fd5553c65249/c5500619-9712-4b9b-83ee-a697212735ae/Disen%CC%83o+sin+ti%CC%81tulo+%2840%29.png)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        flexShrink: 0,
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
