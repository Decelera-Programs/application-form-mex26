import type { ApplicationSession, FlowStep } from '../../../shared/types';

const API_BASE = '/api';

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

export async function correctAnswer(sessionId: string, stepId: string, answer: unknown): Promise<void> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/answer`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepId, answer }),
  });
  if (!res.ok) throw new Error('Failed to correct answer');
}

export async function restartSession(sessionId: string): Promise<{ step: FlowStep }> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset session');
  return res.json();
}

export async function getFlowStep(stepId: string): Promise<FlowStep> {
  const res = await fetch(`${API_BASE}/flow/steps/${stepId}`);
  if (!res.ok) throw new Error('Step not found');
  return res.json();
}

export async function chatMessage(
  message: string,
  currentQuestion?: string,
  answeredCount?: number
): Promise<string> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, currentQuestion, answeredCount }),
  });
  if (!res.ok) throw new Error('Chat failed');
  const data = await res.json();
  return data.reply as string;
}
