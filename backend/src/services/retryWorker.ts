/**
 * Attio retry worker
 *
 * Runs on a schedule. Picks up completed sessions that haven't
 * been synced to Attio yet (due to network errors, downtime, etc.)
 * and retries the sync. Max 5 attempts with exponential backoff.
 */

import { getUnsyncedSessions, updateAttioIds } from './sessionService';
import { syncSessionToAttio } from './attioService';

const MAX_ATTEMPTS = 5;

// Track attempt counts in memory (reset on restart — that's fine)
const attemptCounts: Record<string, number> = {};

export async function runRetryWorker(): Promise<void> {
  let sessions;
  try {
    sessions = await getUnsyncedSessions();
  } catch (err) {
    console.error('[RetryWorker] Failed to fetch unsynced sessions:', err);
    return;
  }

  if (sessions.length === 0) return;

  console.log(`[RetryWorker] ${sessions.length} session(s) pending Attio sync`);

  for (const session of sessions) {
    const attempts = attemptCounts[session.id] ?? 0;

    if (attempts >= MAX_ATTEMPTS) {
      console.error(
        `[RetryWorker] Session ${session.id} exceeded max attempts (${MAX_ATTEMPTS}). Manual review needed.`
      );
      continue;
    }

    attemptCounts[session.id] = attempts + 1;

    const result = await syncSessionToAttio(session.answers);

    if (result.ok) {
      await updateAttioIds(
        session.id,
        result.data.personId,
        result.data.companyId,
        result.data.dealId
      );
      delete attemptCounts[session.id];
      console.log(`[RetryWorker] ✅ Session ${session.id} synced to Attio — deal: ${result.data.dealId}`);
    } else {
      console.warn(
        `[RetryWorker] ⚠️  Session ${session.id} sync failed (attempt ${attempts + 1}): ${result.error}`
      );
    }
  }
}

/** Start the worker loop — call once at app startup */
export function startRetryWorker(intervalMs = 60_000): NodeJS.Timeout {
  console.log(`[RetryWorker] Starting — interval: ${intervalMs / 1000}s`);
  // Run immediately, then on interval
  runRetryWorker().catch(console.error);
  return setInterval(() => runRetryWorker().catch(console.error), intervalMs);
}
