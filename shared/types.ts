// Shared types between frontend and backend

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'url'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'statement'; // Message-only block, no input required

export interface FlowCondition {
  fieldId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'exists';
  value?: string | string[];
}

export interface FlowStep {
  id: string;
  type: FieldType;
  question: string;           // The "chat bubble" message
  placeholder?: string;
  required?: boolean;
  options?: string[];         // For select / multiselect
  nextStep?: string;          // Default next step id (null = end)
  conditions?: {              // Conditional branching
    if: FlowCondition;
    then: string;             // Step id to jump to
  }[];
  attioField?: string;        // Attio field slug to map this answer to
  attioObject?: 'people' | 'companies'; // Which Attio object to update
}

export interface FlowConfig {
  id: string;
  version: string;
  title: string;
  welcomeMessage: string;
  completionMessage: string;
  startStep: string;
  steps: Record<string, FlowStep>;
}

export interface ApplicationSession {
  id: string;
  flowId: string;
  flowVersion: string;
  currentStepId: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  answers: Record<string, unknown>;
  attioPersonId?: string;
  attioCompanyId?: string;
  syncedToAttio: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitAnswerPayload {
  sessionId: string;
  stepId: string;
  answer: unknown;
}

export interface SubmitAnswerResponse {
  nextStepId: string | null;  // null = flow complete
  session: ApplicationSession;
}
