import type { FlowConfig, FlowStep, FlowCondition } from '../../../shared/types';

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
