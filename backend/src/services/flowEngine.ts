import type { FlowConfig, FlowStep, FlowCondition } from '../../../shared/types';

export interface HistoryEntry {
  stepId: string;
  question: string;
  answer: unknown;
  type: string;
}

function evaluateCondition(
  condition: FlowCondition,
  answers: Record<string, unknown>
): boolean {
  const value = answers[condition.fieldId];

  switch (condition.operator) {
    case 'equals':
      return String(value) === String(condition.value);
    case 'not_equals':
      return String(value) !== String(condition.value);
    case 'contains':
      return Array.isArray(value)
        ? value.includes(condition.value)
        : String(value).includes(String(condition.value));
    case 'not_contains':
      return Array.isArray(value)
        ? !value.includes(condition.value)
        : !String(value).includes(String(condition.value));
    case 'exists':
      return value !== undefined && value !== null && value !== '';
    default:
      return false;
  }
}

/**
 * Given the current step and all answers so far (including the just-submitted one),
 * returns the id of the next step, or null if the flow is complete.
 */
export function resolveNextStep(
  step: FlowStep,
  answers: Record<string, unknown>
): string | null {
  // Check conditional branches first
  if (step.conditions) {
    for (const branch of step.conditions) {
      if (evaluateCondition(branch.if, answers)) {
        return branch.then;
      }
    }
  }

  // Default next step
  return step.nextStep ?? null;
}

/**
 * Interpolates {{variable}} placeholders in question text using answers so far.
 */
export function interpolateQuestion(
  question: string,
  answers: Record<string, unknown>
): string {
  return question.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    answers[key] !== undefined ? String(answers[key]) : `{{${key}}}`
  );
}

export function getStep(flow: FlowConfig, stepId: string): FlowStep | null {
  return flow.steps[stepId] ?? null;
}

/**
 * Reconstructs the ordered list of answered steps by replaying the flow
 * from startStep, following the same conditional branching that was used
 * when the user answered.
 */
export function buildHistory(
  flow: FlowConfig,
  answers: Record<string, unknown>
): HistoryEntry[] {
  const history: HistoryEntry[] = [];
  let currentId: string | null = flow.startStep;
  const visited = new Set<string>();

  while (currentId && currentId in answers && !visited.has(currentId)) {
    visited.add(currentId);
    const step = flow.steps[currentId];
    if (!step) break;

    history.push({
      stepId: currentId,
      question: interpolateQuestion(step.question, answers),
      answer: answers[currentId],
      type: step.type,
    });

    currentId = resolveNextStep(step, answers);
  }

  return history;
}
