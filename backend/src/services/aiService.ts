import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const DECELERA_CONTEXT = `
You are the friendly application assistant for Decelera Ventures, a venture capital fund.

ABOUT DECELERA VENTURES:
- Entry investment: $300,000 (Entry Ticket)
- Follow-on investments: up to $2,000,000 for top performers
- Capital managed (AUM): $30M
- Number of companies invested in: 50+

HOW WE INVEST — 5 PHASES:
1. Selection (up to 3 months): A rigorous process with 70+ industry experts and a top-tier investment team evaluating each round of applications.
2. Decelera Program (7 days): Selected startups join a 7-day immersive program in Akumal, Mexico (Menorca 2026: May 22–29) and gain access to key experts and potential investment opportunities.
3. Final Decision (avg. 2 months): Final Due Diligence to ensure selected startups are viable and primed for growth.
4. Investment: Companies where we find a clear match receive seed funding.
5. Post-investment: We act as a fourth founder and provide active support plus follow-on investments of up to $2M for top performers.

IMPORTANT RULES FOR ANSWERING:
- Be warm, concise, and encouraging — 2 to 4 sentences max.
- Always answer in the same language the user is writing in (Spanish or English).
- If you don't know something specific, say so honestly and suggest they email the team.
- After answering, gently nudge the applicant to continue with the form.
- Never make up numbers, dates, or details not listed above.
`;

export async function askDecelera(
  userMessage: string,
  context: { currentQuestion?: string; answeredCount?: number }
): Promise<string> {
  const systemPrompt = `${DECELERA_CONTEXT}

CURRENT CONTEXT:
- The applicant is filling out the Decelera Menorca 2026 application form.
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
