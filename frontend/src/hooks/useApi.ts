import type { ApplicationSession, FlowStep } from '../../../shared/types';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface SessionStart {
  session: ApplicationSession;
  step: FlowStep;
  welcomeMessage: string;
}

export interface AnswerResponse {
  session: ApplicationSession;
  nextStep: FlowStep | null;
  isComplete: boolean;
  completionMessage?: string;
}

export async function startSession(): Promise<SessionStart> {
  const res = await fetch(`${API_BASE}/sessions`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start session');
  return res.json();
}

export async function resumeSession(sessionId: string): Promise<{ session: ApplicationSession; step: FlowStep }> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error('Failed to resume session');
  return res.json();
}

export async function submitAnswer(
  sessionId: string,
  stepId: string,
  answer: unknown
): Promise<AnswerResponse> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepId, answer }),
  });
  if (!res.ok) throw new Error('Failed to submit answer');
  return res.json();
}
