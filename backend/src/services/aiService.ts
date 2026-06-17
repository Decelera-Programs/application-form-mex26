import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DECELERA_CONTEXT = `
You are the friendly application assistant for Decelera Ventures, a venture capital fund.

ABOUT DECELERA VENTURES:
- Vision: invest in mission-driven startups that deliver impact and create long-term value.
- Entry investment: up to $300,000 (Entry Ticket)
- Follow-on investments: up to $2,000,000 for top performers
- Capital managed (AUM): $30M (secured commitments)
- Number of companies invested in: 50+
- Decelera Ventures is managed by Decelera LLC, which oversees a $2.5 billion portfolio across Europe and LATAM spanning five key sectors: sustainable energy, hospitality, private equity, real estate, and venture capital.

HOW WE INVEST — 5 PHASES:
1. Selection (up to 3 months): A rigorous process with 70+ industry experts and a top-tier investment team evaluating each round of applications.
2. Decelera Program (7 days): Selected startups join a 7-day immersive program in Playa del Carmen, Mexico (May 22–29, 2026) and gain access to key experts and potential investment opportunities.
3. Final Decision (avg. 2 months): Final Due Diligence to ensure selected startups are viable and primed for growth.
4. Investment: Companies where we find a clear match receive seed funding.
5. Post-investment: We act as a fourth founder and provide active support plus follow-on investments of up to $2M for top performers.

IMPORTANT RULES FOR ANSWERING:
- Be warm, concise, and encouraging — 2 to 4 sentences max.
- Always answer in the same language the user is writing in (Spanish or English).
- If you don't know something specific, say so honestly and suggest they email the team.
- After answering, gently nudge the applicant to continue with the form.
- Never make up numbers, dates, or details not listed above.
- Never use markdown formatting. No **bold**, no *italics*, no bullet points with dashes. Plain text only.
`;

export async function askDecelera(
  userMessage: string,
  context: { currentQuestion?: string; answeredCount?: number }
): Promise<string> {
  const systemPrompt = `${DECELERA_CONTEXT}

CURRENT CONTEXT:
- The applicant is filling out the Decelera Mexico 2026 application form.
- They are currently on the question: "${context.currentQuestion ?? 'the application form'}"
- They have answered ${context.answeredCount ?? 0} questions so far.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 350,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const block = response.content[0];
  return block.type === 'text'
    ? block.text
    : 'No pude generar una respuesta. Continúa con el formulario cuando quieras.';
}

// ── AI-driven form extraction ─────────────────────────────────────────────────

export interface ChatFormResult {
  isAnswer: boolean;
  extractedValue: unknown;
  ackMessage: string;
}

export async function chatFormTurn(
  userMessage: string,
  field: { id: string; question: string; type: string; options?: string[] },
  answers: Record<string, unknown>,
  progress: { answered: number; total: number }
): Promise<ChatFormResult> {
  const optionsClause = field.options?.length
    ? `\nAVAILABLE OPTIONS (extracted_value MUST be exactly one of): ${field.options.map(o => `"${o}"`).join(', ')}`
    : '';

  const typeHint = (() => {
    switch (field.type) {
      case 'boolean':     return '\nTYPE: Return true for yes/affirmative, false for no/negative.';
      case 'number':      return '\nTYPE: Return only a plain number (no currency symbols, no units).';
      case 'multiselect': return '\nTYPE: Return an array of strings from the available options.';
      default:            return '';
    }
  })();

  const recentContext = Object.entries(answers)
    .slice(-5)
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join('\n');

  const system = `You are Paco, the application assistant for Decelera LATAM 2026 (a startup accelerator fund in Latin America).

CURRENT FIELD:
  id: ${field.id}
  type: ${field.type}
  question: "${field.question}"${optionsClause}${typeHint}

RECENT ANSWERS:
${recentContext || '  (none yet)'}

Progress: ${progress.answered} / ${progress.total}

INSTRUCTIONS:
- If the user's message answers the current question: set is_answer=true, extract the value, write a warm 1-sentence acknowledgment in Spanish.
- If unclear, unanswerable, or off-topic: set is_answer=false, write a brief clarification request in Spanish.
- Keep responses SHORT. Plain text only — no markdown. Do NOT include the next question.

Return ONLY this JSON (no other text):
{"is_answer":true,"extracted_value":<value>,"ack_message":"<1 sentence in Spanish>"}
OR
{"is_answer":false,"extracted_value":null,"ack_message":"<clarification in Spanish>"}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 250,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');
    const parsed = JSON.parse(match[0]);
    return {
      isAnswer: Boolean(parsed.is_answer),
      extractedValue: parsed.extracted_value ?? null,
      ackMessage: String(parsed.ack_message ?? 'Entendido.'),
    };
  } catch {
    return { isAnswer: false, extractedValue: null, ackMessage: '¿Puedes aclararlo un poco más?' };
  }
}
