import React, { useState, useEffect, useRef } from 'react';
import type { FlowStep, ApplicationSession } from '../../shared/types';
import { startSession, submitAnswer } from './hooks/useApi';
import { ChatBubble, TypingIndicator } from './components/ChatBubble';
import { StepInput } from './components/StepInput';
import { ProgressBar } from './components/ProgressBar';

interface Message {
  id: string;
  type: 'bot' | 'user';
  text: string;
}

type AppState = 'loading' | 'welcome' | 'chat' | 'complete' | 'error';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [session, setSession] = useState<ApplicationSession | null>(null);
  const [currentStep, setCurrentStep] = useState<FlowStep | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalSteps, setTotalSteps] = useState(10);
  const [stepIndex, setStepIndex] = useState(0);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Init session
  useEffect(() => {
    (async () => {
      try {
        // Check for saved session ID
        const savedId = sessionStorage.getItem('decelera_session_id');

        // Fetch total steps
        const flowRes = await fetch('/api/flow');
        if (flowRes.ok) {
          const flowData = await flowRes.json();
          setTotalSteps(flowData.totalSteps ?? 10);
        }

        if (savedId) {
          try {
            const res = await fetch(`/api/sessions/${savedId}`);
            if (res.ok) {
              const data = await res.json();
              if (data.session.status === 'completed') {
                setAppState('complete');
                return;
              }
              setSession(data.session);
              setCurrentStep(data.step);
              setAppState('chat');
              addBotMessage(data.step.question);
              return;
            }
          } catch {
            // Fall through to new session
          }
        }

        const data = await startSession();
        sessionStorage.setItem('decelera_session_id', data.session.id);
        setSession(data.session);
        setCurrentStep(data.step);
        setWelcomeMessage(data.welcomeMessage);
        setAppState('welcome');
      } catch {
        setAppState('error');
      }
    })();
  }, []);

  function addBotMessage(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: `bot-${Date.now()}`, type: 'bot', text },
    ]);
  }

  function addUserMessage(text: string) {
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, type: 'user', text },
    ]);
  }

  async function handleWelcomeStart() {
    setAppState('chat');
    setIsTyping(true);
    await delay(typingDelay(currentStep?.question ?? ''));
    setIsTyping(false);
    if (currentStep) addBotMessage(currentStep.question);
  }

  async function handleAnswer(answer: unknown) {
    if (!session || !currentStep || isSubmitting) return;
    setIsSubmitting(true);

    // Show user answer as bubble
    const displayAnswer = formatAnswerForDisplay(answer, currentStep);
    if (displayAnswer) addUserMessage(displayAnswer);

    try {
      const result = await submitAnswer(session.id, currentStep.id, answer);

      setSession(result.session);
      setStepIndex((i) => i + 1);

      if (result.isComplete) {
        setIsTyping(true);
        await delay(typingDelay(result.completionMessage ?? ''));
        setIsTyping(false);
        addBotMessage(result.completionMessage ?? '');
        setAppState('complete');
        sessionStorage.removeItem('decelera_session_id');
        return;
      }

      if (result.nextStep) {
        setIsTyping(true);
        await delay(typingDelay(result.nextStep.question));
        setIsTyping(false);
        setCurrentStep(result.nextStep);
        addBotMessage(result.nextStep.question);
      }
    } catch {
      addBotMessage('Something went wrong saving your answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (appState === 'loading') {
    return <Screen><LoadingDots /></Screen>;
  }

  if (appState === 'error') {
    return (
      <Screen>
        <div style={{ textAlign: 'center', color: 'var(--color-cloud)', fontFamily: 'var(--font-body)' }}>
          <p>Couldn't load the application form.</p>
          <p style={{ fontSize: 13 }}>Please refresh the page or try again later.</p>
        </div>
      </Screen>
    );
  }

  if (appState === 'welcome') {
    return (
      <Screen>
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          flex: 1, padding: 32, gap: 32, textAlign: 'center',
        }}>
          <DeceleraLogo />
          <div style={{
            fontFamily: 'var(--font-body)',
            color: 'var(--color-night)',
            fontSize: 16, lineHeight: 1.7,
            maxWidth: 380,
            whiteSpace: 'pre-line',
          }}>
            {welcomeMessage}
          </div>
          <button
            onClick={handleWelcomeStart}
            style={{
              padding: '14px 36px',
              background: 'var(--color-sea)',
              color: '#fff', border: 'none',
              borderRadius: 12, fontSize: 16,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer', letterSpacing: 0.3,
            }}
          >
            Let's go →
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--color-sky)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <DeceleraLogo compact />
        <span style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13, color: 'var(--color-cloud)',
        }}>
          {appState === 'complete' ? 'Application submitted' : 'Application form'}
        </span>
      </div>

      {/* Progress */}
      {appState === 'chat' && (
        <div style={{ padding: '12px 20px 0' }}>
          <ProgressBar current={stepIndex} total={totalSteps} />
        </div>
      )}

      {/* Chat area */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex', flexDirection: 'column',
      }}>
        {messages.map((msg, i) => (
          <ChatBubble
            key={msg.id}
            message={msg.text}
            type={msg.type}
            isNew={i === messages.length - 1}
          />
        ))}
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {appState === 'chat' && currentStep && (
        <div style={{
          padding: '12px 20px 20px',
          borderTop: '1px solid var(--color-sky)',
          flexShrink: 0,
        }}>
          <StepInput
            step={currentStep}
            onSubmit={handleAnswer}
            disabled={isSubmitting || isTyping}
          />
        </div>
      )}

      {appState === 'complete' && (
        <div style={{
          padding: '16px 20px 24px', textAlign: 'center',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13, color: 'var(--color-cloud)',
          }}>
            Breathe. Focus. Grow.
          </span>
        </div>
      )}
    </Screen>
  );
}

// ---- Helpers ----

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: '#fff', maxWidth: 640,
      margin: '0 auto',
    }}>
      {children}
    </div>
  );
}

function DeceleraLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <svg viewBox="0 0 84.4 84.4" width={28} height={28}>
        <path d="M42.2 10C24.5 10 10 24.5 10 42.2s14.5 32.2 32.2 32.2 32.2-14.5 32.2-32.2S59.9 10 42.2 10zm0 54.4c-12.3 0-22.2-9.9-22.2-22.2S29.9 20 42.2 20s22.2 9.9 22.2 22.2-9.9 22.2-22.2 22.2z" fill="#1FD0EF" />
        <text x="34" y="50" fill="#1FD0EF" fontSize="22" fontFamily="serif">D</text>
      </svg>
    );
  }
  return (
    <div style={{ fontFamily: 'var(--font-title)', fontSize: 22, color: 'var(--color-night)' }}>
      decelera <span style={{ color: 'var(--color-water)' }}>ventures</span>
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--color-cloud)',
          display: 'inline-block',
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

function formatAnswerForDisplay(answer: unknown, step: FlowStep): string {
  if (answer === null || answer === undefined) return '';
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
  if (step.type === 'url' || step.type === 'email') return String(answer);
  return String(answer);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typingDelay(text: string) {
  return Math.min((text.length / 580) * 1000, 2500);
}
