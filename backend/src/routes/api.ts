import { Router, Request, Response } from 'express';
import type { FlowConfig } from '../../../shared/types';
import { createSession, getSession, updateSessionAnswer, updateAttioIds, patchSessionAnswer, resetSession } from '../services/sessionService';
import { resolveNextStep, interpolateQuestion, getStep, buildHistory } from '../services/flowEngine';
import { syncSessionToAttio } from '../services/attioService';
import { askDecelera } from '../services/aiService';

// Load flow config — in production you might load from DB or file system
import flowConfig from '../../../shared/flow-config.json';

const flow = flowConfig as FlowConfig;
const router = Router();

/**
 * POST /sessions
 * Creates a new application session and returns the first step.
 */
router.post('/sessions', async (_req: Request, res: Response) => {
  try {
    const session = await createSession(flow.id, flow.version, flow.startStep);
    const firstStep = getStep(flow, flow.startStep);

    res.json({
      session,
      step: firstStep,
      welcomeMessage: flow.welcomeMessage,
    });
  } catch (err) {
    console.error('POST /sessions error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * GET /sessions/:id
 * Resumes an existing session — returns current step.
 */
router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const step = getStep(flow, session.currentStepId);
    if (!step) return res.status(404).json({ error: 'Step not found' });

    const interpolated = {
      ...step,
      question: interpolateQuestion(step.question, session.answers),
    };

    const history = buildHistory(flow, session.answers);

    res.json({ session, step: interpolated, history });
  } catch (err) {
    console.error('GET /sessions/:id error:', err);
    res.status(500).json({ error: 'Failed to load session' });
  }
});

/**
 * POST /sessions/:id/answer
 * Submits an answer for the current step, advances the session.
 */
router.post('/sessions/:id/answer', async (req: Request, res: Response) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Session already completed' });
    }

    const { stepId, answer } = req.body as { stepId: string; answer: unknown };

    if (stepId !== session.currentStepId) {
      return res.status(400).json({ error: 'Step mismatch — reload the form' });
    }

    const currentStep = getStep(flow, stepId);
    if (!currentStep) return res.status(404).json({ error: 'Step not found' });

    // Merge this answer with existing answers to evaluate conditions
    const updatedAnswers = { ...session.answers, [stepId]: answer };
    const nextStepId = resolveNextStep(currentStep, updatedAnswers);
    const isComplete = nextStepId === null;

    const updatedSession = await updateSessionAnswer(
      session.id,
      stepId,
      answer,
      nextStepId,
      isComplete
    );

    // If complete, try to sync to Attio immediately (best-effort)
    if (isComplete) {
      const attioResult = await syncSessionToAttio(updatedAnswers);
      if (attioResult.ok) {
        await updateAttioIds(
          session.id,
          attioResult.data.personId,
          attioResult.data.companyId,
          attioResult.data.dealId
        );
        console.log(`Session ${session.id} synced to Attio — deal: ${attioResult.data.dealId}, company existed: ${attioResult.data.companyExisted}`);
      } else {
        // Worker will retry — this is expected and fine
        console.warn(`Attio sync deferred for session ${session.id}: ${attioResult.error}`);
      }
    }

    // Resolve next step for response
    const nextStep = nextStepId ? getStep(flow, nextStepId) : null;
    const interpolatedNextStep = nextStep
      ? { ...nextStep, question: interpolateQuestion(nextStep.question, updatedAnswers) }
      : null;

    res.json({
      session: updatedSession,
      nextStep: interpolatedNextStep,
      isComplete,
      completionMessage: isComplete ? flow.completionMessage : undefined,
    });
  } catch (err) {
    console.error('POST /sessions/:id/answer error:', err);
    res.status(500).json({ error: 'Failed to save answer' });
  }
});

/**
 * POST /sessions/:id/reset
 * Clears all answers and restarts the session from the first step.
 */
router.post('/sessions/:id/reset', async (req: Request, res: Response) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    await resetSession(req.params.id, flow.startStep);
    const firstStep = getStep(flow, flow.startStep);
    res.json({ ok: true, step: firstStep });
  } catch (err) {
    console.error('POST /sessions/:id/reset error:', err);
    res.status(500).json({ error: 'Failed to reset session' });
  }
});

/**
 * PATCH /sessions/:id/answer
 * Overwrites a single answer in an existing session without advancing the flow.
 * Resets synced_to_attio so the retry worker re-syncs with the corrected data.
 */
router.patch('/sessions/:id/answer', async (req: Request, res: Response) => {
  try {
    const { stepId, answer } = req.body as { stepId: string; answer: unknown };
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (!stepId) return res.status(400).json({ error: 'stepId required' });
    await patchSessionAnswer(req.params.id, stepId, answer);
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /sessions/:id/answer error:', err);
    res.status(500).json({ error: 'Failed to update answer' });
  }
});

/**
 * GET /flow/steps/:stepId
 * Returns a single step definition (used by the /correct flow to render the right input).
 */
router.get('/flow/steps/:stepId', (req: Request, res: Response) => {
  const step = getStep(flow, req.params.stepId);
  if (!step) return res.status(404).json({ error: 'Step not found' });
  res.json(step);
});

/**
 * POST /chat
 * Answers a free-form question about Decelera using Claude AI.
 */
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, currentQuestion, answeredCount } = req.body as {
      message: string;
      currentQuestion?: string;
      answeredCount?: number;
    };
    if (!message) return res.status(400).json({ error: 'message required' });
    const reply = await askDecelera(message, { currentQuestion, answeredCount });
    res.json({ reply });
  } catch (err) {
    console.error('POST /chat error:', err);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

/**
 * GET /flow
 * Returns the full flow config (questions, structure) — useful for frontend pre-loading.
 */
router.get('/flow', (_req: Request, res: Response) => {
  res.json({
    id: flow.id,
    version: flow.version,
    title: flow.title,
    totalSteps: Object.keys(flow.steps).filter(
      (id) => flow.steps[id].type !== 'statement'
    ).length,
  });
});

export default router;
