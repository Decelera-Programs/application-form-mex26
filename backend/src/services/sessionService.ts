import { pool } from '../db';
import type { ApplicationSession } from '../../../shared/types';

function rowToSession(row: Record<string, unknown>): ApplicationSession {
  return {
    id: row.id as string,
    flowId: row.flow_id as string,
    flowVersion: row.flow_version as string,
    currentStepId: row.current_step_id as string,
    status: row.status as ApplicationSession['status'],
    answers: row.answers as Record<string, unknown>,
    attioPersonId: row.attio_person_id as string | undefined,
    attioCompanyId: row.attio_company_id as string | undefined,
    syncedToAttio: row.synced_to_attio as boolean,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function createSession(
  flowId: string,
  flowVersion: string,
  startStepId: string
): Promise<ApplicationSession> {
  const result = await pool.query(
    `INSERT INTO application_sessions (flow_id, flow_version, current_step_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [flowId, flowVersion, startStepId]
  );
  return rowToSession(result.rows[0]);
}

export async function getSession(id: string): Promise<ApplicationSession | null> {
  const result = await pool.query(
    'SELECT * FROM application_sessions WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return rowToSession(result.rows[0]);
}

export async function updateSessionAnswer(
  sessionId: string,
  stepId: string,
  answer: unknown,
  nextStepId: string | null,
  isComplete: boolean
): Promise<ApplicationSession> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Save to answer_log first (raw event log — never lost)
    await client.query(
      `INSERT INTO answer_log (session_id, step_id, answer) VALUES ($1, $2, $3)`,
      [sessionId, stepId, JSON.stringify(answer)]
    );

    // Merge into the answers JSONB and advance step
    const result = await client.query(
      `UPDATE application_sessions
       SET answers = answers || $1::jsonb,
           current_step_id = $2,
           status = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        JSON.stringify({ [stepId]: answer }),
        nextStepId ?? stepId,
        isComplete ? 'completed' : 'in_progress',
        sessionId,
      ]
    );

    await client.query('COMMIT');
    return rowToSession(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateAttioIds(
  sessionId: string,
  attioPersonId?: string,
  attioCompanyId?: string,
  attioDealId?: string
): Promise<void> {
  await pool.query(
    `UPDATE application_sessions
     SET attio_person_id = COALESCE($1, attio_person_id),
         attio_company_id = COALESCE($2, attio_company_id),
         attio_deal_id = COALESCE($3, attio_deal_id),
         synced_to_attio = TRUE,
         updated_at = NOW()
     WHERE id = $4`,
    [attioPersonId ?? null, attioCompanyId ?? null, attioDealId ?? null, sessionId]
  );
}

/** Sessions that haven't been synced to Attio yet — for the retry worker */
export async function getUnsyncedSessions(): Promise<ApplicationSession[]> {
  const result = await pool.query(
    `SELECT * FROM application_sessions
     WHERE synced_to_attio = FALSE
       AND status = 'completed'
     ORDER BY created_at ASC
     LIMIT 50`
  );
  return result.rows.map(rowToSession);
}
