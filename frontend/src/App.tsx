import React, { useState, useEffect, useRef } from 'react';
import type { FlowStep, ApplicationSession } from '../../shared/types';
import { startSession, submitAnswer, correctAnswer, getFlowStep, restartSession } from './hooks/useApi';
import { ChatBubble, TypingIndicator } from './components/ChatBubble';
import { Confetti } from './components/Confetti';
import { StepInput } from './components/StepInput';
import { ProgressBar } from './components/ProgressBar';

interface Message {
  id: string;
  type: 'bot' | 'user';
  text: string;
  html?: string;
}

interface AnswerHistoryItem {
  stepId: string;
  question: string;
  answer: unknown;
  displayAnswer: string;
}

type AppState = 'loading' | 'welcome' | 'chat' | 'complete' | 'error';
type CorrectionState = 'idle' | 'selecting' | 'entering';

const CORRECTION_SELECT_STEP: FlowStep = {
  id: '__correction_select__',
  type: 'text',
  question: '',
  placeholder: 'Escribe el número…',
  required: true,
};

const INTRO_HTML = `Hi there! 👋 I'm the personal assistant to Carlota, Decelera's Dealflow Manager.<br>She's currently deep-diving into pitch decks and coffee, so she's asked me to help you with your application for <strong>Decelera Menorca 2026</strong> (May 22nd – 29th). 🏝️<br><br>Quick heads-up: we're a founder-first fund providing up to €1M in initial funding and a 7-day fully-sponsored residency to find our next startups. 🚀<br><br>Check our <a href="#" style="color:var(--color-sea);text-decoration:underline">FAQs</a> for details. Shall we start with the basics? It will just take a few minutes.<br><br>If at any point you submit the wrong answer, you'll have a chance to correct it at the end of the form.`;

const GDPR_HTML = `First things first, a quick note on your data 🔒<br><br><strong>Data Protection</strong><br><br>The information provided in this form will be managed under the "Decelera Menorca 2026 Form" in compliance with GDPR and applicable European data protection laws. You have the right to access, correct, delete, or object to the processing of your data. For more details, visit our <a href="#" style="color:var(--color-sea);text-decoration:underline">Privacy Policy</a>.`;

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [session, setSession] = useState<ApplicationSession | null>(null);
  const [currentStep, setCurrentStep] = useState<FlowStep | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [totalSteps, setTotalSteps] = useState(10);
  const [stepIndex, setStepIndex] = useState(0);
  const [consentReady, setConsentReady] = useState(false);
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryItem[]>([]);
  const [correctionState, setCorrectionState] = useState<CorrectionState>('idle');
  const [correctionStep, setCorrectionStep] = useState<FlowStep | null>(null);
  const [correctionStepId, setCorrectionStepId] = useState<string | null>(null);
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);
  const initRan = useRef(false);

  useEffect(() => {
    if (appState !== 'chat') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [appState]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: isRestoringRef.current ? 'instant' : 'smooth' });
    isRestoringRef.current = false;
  }, [messages, isTyping, consentReady]);

  useEffect(() => {
    (async () => {
      if (initRan.current) return;
      initRan.current = true;
      try {
        const savedId = localStorage.getItem('decelera_session_id');

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

              type HistoryEntry = { stepId: string; question: string; answer: unknown; type: string };
              const restored: Message[] = [
                { id: 'w-logo', type: 'bot', text: '', html: '<img src="/logo.svg" alt="Decelera Ventures" style="width:150px;display:block;margin:2px 0" />' },
                { id: 'w-intro', type: 'bot', text: '', html: INTRO_HTML },
                { id: 'w-gdpr', type: 'bot', text: '', html: GDPR_HTML },
              ];
              for (const entry of (data.history ?? []) as HistoryEntry[]) {
                restored.push({ id: `bot-${entry.stepId}`, type: 'bot', text: entry.question });
                if (entry.type !== 'statement' && entry.answer !== null && entry.answer !== undefined) {
                  const display = Array.isArray(entry.answer)
                    ? (entry.answer as unknown[]).join(', ')
                    : typeof entry.answer === 'boolean'
                    ? (entry.answer ? 'Yes' : 'No')
                    : String(entry.answer);
                  if (display) restored.push({ id: `user-${entry.stepId}`, type: 'user', text: display });
                }
              }
              const n = restoredHistory.length;
              restored.push({ id: 'w-back', type: 'bot', text: `¡Bienvenido de nuevo! 👋 Tienes ${n} pregunta${n !== 1 ? 's' : ''} respondida${n !== 1 ? 's' : ''} — seguimos donde lo dejaste.` });
              restored.push({ id: 'bot-current', type: 'bot', text: data.step.question });

              const restoredHistory: AnswerHistoryItem[] = (data.history ?? [])
                .filter((e: HistoryEntry) => e.type !== 'statement' && e.answer !== null && e.answer !== undefined)
                .map((e: HistoryEntry) => {
                  const d = Array.isArray(e.answer)
                    ? (e.answer as unknown[]).join(', ')
                    : typeof e.answer === 'boolean' ? (e.answer ? 'Yes' : 'No')
                    : String(e.answer);
                  return { stepId: e.stepId, question: e.question, answer: e.answer, displayAnswer: d };
                });
              isRestoringRef.current = true;
              setMessages(restored);
              setAnswerHistory(restoredHistory);
              setStepIndex((data.history ?? []).length);
              setSession(data.session);
              setCurrentStep(data.step);
              setAppState('chat');
              return;
            }
          } catch {
            // Fall through to new session
          }
        }

        const data = await startSession();
        localStorage.setItem('decelera_session_id', data.session.id);
        setSession(data.session);
        setCurrentStep(data.step);
        setAppState('welcome');
        setIsTyping(true);

        await delay(700);
        setMessages([{ id: 'w-logo', type: 'bot', text: '', html: '<img src="/logo.svg" alt="Decelera Ventures" style="width:150px;display:block;margin:2px 0" />' }]);

        await delay(1200);
        setMessages(prev => [...prev, { id: 'w-intro', type: 'bot', text: '', html: INTRO_HTML }]);

        await delay(2800);
        setMessages(prev => [...prev, { id: 'w-gdpr', type: 'bot', text: '', html: GDPR_HTML }]);
        setIsTyping(false);
        setConsentReady(true);

      } catch {
        setAppState('error');
      }
    })();
  }, []);

  function addBotMessage(text: string) {
    setMessages(prev => [...prev, { id: `bot-${Date.now()}`, type: 'bot', text }]);
  }

  function addUserMessage(text: string) {
    setMessages(prev => [...prev, { id: `user-${Date.now()}`, type: 'user', text }]);
  }

  async function handleConsentChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.checked || !currentStep) return;
    setConsentReady(false);
    setIsTyping(true);
    await delay(typingDelay(currentStep.question));
    setIsTyping(false);
    setMessages(prev => [...prev, { id: 'bot-first', type: 'bot', text: currentStep.question }]);
    setAppState('chat');
  }

  async function handleRestartConfirm(confirmed: boolean) {
    setConfirmingRestart(false);
    if (!confirmed) {
      addUserMessage('No, continuar');
      setIsTyping(true);
      await delay(500);
      setIsTyping(false);
      addBotMessage('De acuerdo, continuamos donde lo dejamos 👍');
      return;
    }
    addUserMessage('Sí, empezar de cero');
    setIsTyping(true);
    try {
      const result = await restartSession(session!.id);
      setAnswerHistory([]);
      setStepIndex(0);
      setCorrectionState('idle');
      setCorrectionStep(null);
      setCorrectionStepId(null);
      setCurrentStep(result.step);
      await delay(700);
      setIsTyping(false);
      addBotMessage('¡De acuerdo! Empezamos de cero 🔄');
      await delay(typingDelay(result.step.question));
      setIsTyping(true);
      await delay(typingDelay(result.step.question));
      setIsTyping(false);
      addBotMessage(result.step.question);
    } catch {
      setIsTyping(false);
      addBotMessage('Algo salió mal. Inténtalo de nuevo.');
    }
  }

  async function enterCorrectionMode() {
    if (answerHistory.length === 0) {
      setIsTyping(true);
      await delay(600);
      setIsTyping(false);
      addBotMessage('No hay respuestas previas que corregir todavía.');
      return;
    }
    const listHtml = answerHistory
      .map((item, i) => {
        const q = item.question.length > 55 ? item.question.slice(0, 52) + '…' : item.question;
        return `<b>${i + 1}.</b> ${q} → <em>${item.displayAnswer}</em>`;
      })
      .join('<br>');
    setIsTyping(true);
    await delay(800);
    setIsTyping(false);
    setMessages(prev => [...prev, {
      id: `bot-correct-${Date.now()}`,
      type: 'bot',
      text: '',
      html: `¿Qué respuesta quieres corregir?<br><br>${listHtml}<br><br>Escribe el número:`,
    }]);
    setCorrectionState('selecting');
  }

  async function handleAnswer(answer: unknown) {
    if (!session || isSubmitting) return;

    // --- Correction: selecting a question ---
    if (correctionState === 'selecting') {
      const raw = String(answer).trim();
      addUserMessage(raw);
      const num = parseInt(raw, 10);
      if (isNaN(num) || num < 1 || num > answerHistory.length) {
        setIsTyping(true);
        await delay(500);
        setIsTyping(false);
        addBotMessage(`Escribe un número entre 1 y ${answerHistory.length}.`);
        return;
      }
      const item = answerHistory[num - 1];
      setIsTyping(true);
      let step: FlowStep;
      try {
        step = await getFlowStep(item.stepId);
      } catch {
        setIsTyping(false);
        addBotMessage('No pude cargar esa pregunta. Inténtalo de nuevo.');
        return;
      }
      await delay(700);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: `bot-correct-q-${Date.now()}`,
        type: 'bot',
        text: '',
        html: `${item.question}<br><br>Tu respuesta actual: <em>${item.displayAnswer}</em><br><br>¿Cuál es la correcta?`,
      }]);
      setCorrectionStep(step);
      setCorrectionStepId(item.stepId);
      setCorrectionState('entering');
      return;
    }

    // --- Correction: submitting corrected answer ---
    if (correctionState === 'entering' && correctionStepId && correctionStep) {
      setIsSubmitting(true);
      const displayAnswer = formatAnswerForDisplay(answer, correctionStep);
      if (displayAnswer) addUserMessage(displayAnswer);
      try {
        await correctAnswer(session.id, correctionStepId, answer);
        setAnswerHistory(prev => prev.map(item =>
          item.stepId === correctionStepId ? { ...item, answer, displayAnswer } : item
        ));
        setIsTyping(true);
        await delay(700);
        setIsTyping(false);
        addBotMessage('✓ ¡Actualizado! Continuamos donde lo dejamos.');
        if (currentStep) {
          setIsTyping(true);
          await delay(typingDelay(currentStep.question));
          setIsTyping(false);
          addBotMessage(currentStep.question);
        }
      } catch {
        addBotMessage('Algo salió mal. Inténtalo de nuevo.');
      } finally {
        setIsSubmitting(false);
        setCorrectionState('idle');
        setCorrectionStep(null);
        setCorrectionStepId(null);
      }
      return;
    }

    // --- Normal flow: detect commands ---
    if (typeof answer === 'string' && answer.trim().startsWith('/')) {
      const cmd = answer.trim().toLowerCase();
      addUserMessage(answer.trim());
      if (cmd === '/correct') {
        await enterCorrectionMode();
      } else if (cmd === '/restart') {
        setIsTyping(true);
        await delay(600);
        setIsTyping(false);
        addBotMessage('¿Estás seguro de que quieres empezar de cero? Perderás todas tus respuestas.');
        setConfirmingRestart(true);
      } else if (cmd === '/help') {
        setIsTyping(true);
        await delay(500);
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: `bot-help-${Date.now()}`, type: 'bot', text: '', html:
            `<b>Comandos disponibles:</b><br><br>` +
            `<b>/correct</b> — Editar una respuesta anterior<br>` +
            `<b>/restart</b> — Empezar de cero<br>` +
            `<b>/summary</b> — Ver un resumen de tus respuestas<br>` +
            `<b>/help</b> — Mostrar esta ayuda`,
        }]);
      } else if (cmd === '/summary') {
        setIsTyping(true);
        await delay(600);
        setIsTyping(false);
        if (answerHistory.length === 0) {
          addBotMessage('Aún no has respondido ninguna pregunta.');
        } else {
          const html = answerHistory
            .map((item, i) => {
              const q = item.question.length > 55 ? item.question.slice(0, 52) + '…' : item.question;
              return `<b>${i + 1}. ${q}</b><br>${item.displayAnswer}`;
            })
            .join('<br><br>');
          setMessages(prev => [...prev, {
            id: `bot-summary-${Date.now()}`, type: 'bot', text: '', html:
              `<b>Resumen de tus respuestas:</b><br><br>${html}`,
          }]);
        }
      } else {
        setIsTyping(true);
        await delay(500);
        setIsTyping(false);
        addBotMessage('Comando no reconocido. Escribe /help para ver los disponibles.');
      }
      return;
    }

    if (!currentStep) return;
    setIsSubmitting(true);

    const displayAnswer = formatAnswerForDisplay(answer, currentStep);
    if (displayAnswer) addUserMessage(displayAnswer);

    try {
      const result = await submitAnswer(session.id, currentStep.id, answer);
      setSession(result.session);
      setStepIndex(i => i + 1);

      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);

      if (currentStep.type !== 'statement' && answer !== null && answer !== undefined && displayAnswer) {
        setAnswerHistory(prev => [...prev, {
          stepId: currentStep.id,
          question: currentStep.question,
          answer,
          displayAnswer,
        }]);
      }

      if (result.isComplete) {
        setIsTyping(true);
        await delay(typingDelay(result.completionMessage ?? ''));
        setIsTyping(false);
        addBotMessage(result.completionMessage ?? '');
        setAppState('complete');
        localStorage.removeItem('decelera_session_id');
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
      addBotMessage('Algo salió mal guardando tu respuesta. Por favor, inténtalo de nuevo.');
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
          <p>No se pudo cargar el formulario.</p>
          <p style={{ fontSize: 13 }}>Recarga la página o inténtalo más tarde.</p>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Header */}
      <div style={{
        padding: '10px 16px', background: '#fff',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        boxShadow: '0 1px 4px rgba(45,56,82,0.08)', zIndex: 1,
      }}>
        <img
          src="https://images.squarespace-cdn.com/content/v1/67811e8fe702fd5553c65249/c5500619-9712-4b9b-83ee-a697212735ae/Disen%CC%83o+sin+ti%CC%81tulo+%2840%29.png"
          alt="Decelera"
          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
        <div>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15, color: 'var(--color-night)', lineHeight: 1.3 }}>
            Decelera Ventures
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--color-cloud)', lineHeight: 1.3 }}>
            {appState === 'complete' ? 'Aplicación enviada ✓' : 'Mexico 2026 · Aplicación'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', marginRight: 6, display: 'flex', alignItems: 'center', gap: 14 }}>
          <a
            href="https://www.deceleraamericas.ventures/about-us"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-cloud)', display: 'flex', alignItems: 'center' }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          </a>
          <a
            href="https://www.linkedin.com/company/decelera/posts/?feedView=all"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-cloud)', display: 'flex', alignItems: 'center' }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
        </div>
      </div>

      {/* Progress */}
      {appState === 'chat' && (
        <div style={{ padding: '12px 20px 0' }}>
          <ProgressBar current={stepIndex} total={totalSteps} />
          {savedFlash && (
            <p style={{
              textAlign: 'right', fontSize: 11, color: 'var(--color-water)',
              fontFamily: 'var(--font-body)', marginTop: -10, paddingRight: 2,
              animation: 'fadeSlideIn 0.2s ease-out',
            }}>
              ✓ Guardado
            </p>
          )}
        </div>
      )}

      {/* Chat area */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column',
        backgroundImage: 'url(/bg-pattern.svg)',
        backgroundSize: '480px 480px',
      }}>
        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          return msg.html ? (
            <ChatBubble key={msg.id} type={msg.type} isNew={isLast}>
              <div dangerouslySetInnerHTML={{ __html: msg.html }} />
              {consentReady && isLast && (
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  cursor: 'pointer', marginTop: 16,
                  fontFamily: 'var(--font-body)', fontSize: 13,
                  color: 'var(--color-cloud)', lineHeight: 1.5,
                }}>
                  <input
                    type="checkbox"
                    onChange={handleConsentChange}
                    style={{ flexShrink: 0, accentColor: 'var(--color-sea)', width: 16, height: 16 }}
                  />
                  I have read and accept the data protection terms.
                </label>
              )}
            </ChatBubble>
          ) : (
            <ChatBubble key={msg.id} message={msg.text} type={msg.type} isNew={isLast} />
          );
        })}
        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Restart confirmation */}
      {appState === 'chat' && confirmingRestart && (
        <div style={{ padding: '8px 12px 16px', borderTop: '1px solid rgba(45,56,82,0.07)', flexShrink: 0, display: 'flex', gap: 10 }}>
          <button
            onClick={() => handleRestartConfirm(true)}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 999, fontSize: 15,
              fontFamily: 'var(--font-body)', cursor: 'pointer', border: 'none',
              background: 'var(--color-night)', color: '#fff', fontWeight: 500,
            }}
          >
            Sí, empezar de cero
          </button>
          <button
            onClick={() => handleRestartConfirm(false)}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 999, fontSize: 15,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
              border: '1.5px solid rgba(45,56,82,0.12)', background: '#fff',
              color: 'var(--color-night)',
            }}
          >
            No, continuar
          </button>
        </div>
      )}

      {/* Input */}
      {appState === 'chat' && !confirmingRestart && (() => {
        const activeStep =
          correctionState === 'entering' && correctionStep ? correctionStep
          : correctionState === 'selecting' ? CORRECTION_SELECT_STEP
          : currentStep;
        return activeStep ? (
          <div style={{ padding: '8px 12px 10px', borderTop: '1px solid rgba(45,56,82,0.07)', flexShrink: 0 }}>
            <StepInput step={activeStep} onSubmit={handleAnswer} disabled={isSubmitting || isTyping} />
            {correctionState === 'idle' && answerHistory.length > 0 && (
              <button
                onClick={enterCorrectionMode}
                disabled={isSubmitting || isTyping}
                style={{
                  display: 'block', margin: '8px auto 2px', background: 'none', border: 'none',
                  fontSize: 12, color: 'var(--color-cloud)', cursor: 'pointer',
                  fontFamily: 'var(--font-body)', opacity: 0.7,
                }}
              >
                ✎ Editar una respuesta anterior
              </button>
            )}
            <p style={{
              textAlign: 'center', margin: '4px 0 0', fontSize: 11,
              color: 'var(--color-cloud)', fontFamily: 'var(--font-body)', opacity: 0.85,
            }}>
              Escribe <code style={{ fontFamily: 'monospace' }}>/</code> para ver los comandos disponibles
            </p>
          </div>
        ) : null;
      })()}

      {appState === 'complete' && (
        <>
          <Confetti />
          <div style={{ padding: '16px 20px 24px', textAlign: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-cloud)' }}>
              Breathe. Focus. Grow.
            </span>
          </div>
        </>
      )}

      {appState === 'chat' && <CommandsPopup />}
    </Screen>
  );
}

// ---- Helpers ----

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: '#F8F8F8', maxWidth: 640, margin: '0 auto',
      position: 'relative',
    }}>
      {children}
    </div>
  );
}

const COMMAND_HINTS = [
  { cmd: '/correct', desc: 'Editar una respuesta' },
  { cmd: '/restart', desc: 'Empezar de cero' },
  { cmd: '/summary', desc: 'Ver resumen' },
  { cmd: '/help',    desc: 'Ver ayuda' },
];

function CommandsPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('decelera_commands_seen');
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 2200);
      return () => clearTimeout(t);
    }
  }, []);

  function close() {
    setOpen(false);
    localStorage.setItem('decelera_commands_seen', '1');
  }

  return (
    <div style={{ position: 'absolute', bottom: 92, right: 68, zIndex: 10 }}>
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
          background: '#fff', borderRadius: 16,
          boxShadow: '0 4px 24px rgba(45,56,82,0.14)',
          padding: '14px 16px 12px', width: 226,
          border: '1.5px solid rgba(45,56,82,0.08)',
          animation: 'fadeSlideIn 0.25s cubic-bezier(0.34,1.4,0.64,1)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13, color: 'var(--color-night)' }}>
              Comandos disponibles
            </span>
            <button onClick={close} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-cloud)', fontSize: 18, lineHeight: 1, padding: '0 0 0 8px',
            }}>×</button>
          </div>
          {COMMAND_HINTS.map(item => (
            <div key={item.cmd} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 7 }}>
              <code style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-night)', fontFamily: 'monospace', minWidth: 68, flexShrink: 0 }}>{item.cmd}</code>
              <span style={{ fontSize: 12, color: 'var(--color-cloud)', fontFamily: 'var(--font-body)' }}>{item.desc}</span>
            </div>
          ))}
          <p style={{ fontSize: 11, color: 'var(--color-cloud)', fontFamily: 'var(--font-body)', marginTop: 8, marginBottom: 0, opacity: 0.7 }}>
            Escribe <code style={{ fontFamily: 'monospace' }}>/</code> en el campo de texto para usarlos
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: open ? 'var(--color-night)' : '#fff',
          color: open ? '#fff' : 'var(--color-night)',
          border: '1.5px solid rgba(45,56,82,0.12)',
          borderRadius: 999, padding: '6px 13px',
          fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: 500,
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(45,56,82,0.10)',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        <code style={{ fontSize: 13, fontFamily: 'monospace', lineHeight: 1 }}>/</code>
        <span>Comandos</span>
      </button>
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--color-cloud)', display: 'inline-block',
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
