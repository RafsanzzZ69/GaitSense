import type {OfflinePoseNative} from '../../modules/gaitsense-pose/index';
import {analyzeSavedPayload, SAVED_PAYLOAD_LIMITS} from './saved-payload-analysis.ts';
import type {BoundSavedRead, SavedAnalysisSetup} from './saved-payload-analysis.ts';

export type SavedSessionReads = Pick<OfflinePoseNative, 'listSessions' | 'readFrames'>;
export type SavedPayloadResult = ReturnType<typeof analyzeSavedPayload>;
export type SavedSessionLoadState = {
  status: 'loading' | 'ready' | 'failed' | 'unavailable';
  selectedSessionId: string | null;
  generation: number;
  reasons: string[];
  result: SavedPayloadResult | null;
};
// Native listSessions returns at most 100 summaries. Bound parsing before JSON.parse.
export const SUMMARY_LIST_LIMIT = 100 * (SAVED_PAYLOAD_LIMITS.sessionText + 1) + 2;
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const errorReason = (error: unknown) => error instanceof Error && error.message.trim() ? error.message :
  typeof error === 'string' && error.trim() ? error : 'native_read_rejected';

/** No native import at runtime, IO beyond injected reads, timers, retries or UI.
 * State is published through getState; select resolves void so obsolete callers
 * cannot mistake their own completion for a new result. Treat returned state as read-only.
 */
export function createSavedSessionLoader(reads: SavedSessionReads) {
  let generation = 0;
  let disposed = false;
  let token = {};
  let state: SavedSessionLoadState = {status: 'unavailable', selectedSessionId: null,
    generation, reasons: ['no_selection'], result: null};
  function invalidate(reason = 'invalidated') {
    if (disposed) return;
    token = {}; generation++;
    state = {status: 'unavailable', selectedSessionId: null, generation, reasons: [reason], result: null};
  }
  async function select(sessionId: string, setup?: SavedAnalysisSetup): Promise<void> {
    if (disposed) return;
    const current = token = {};
    const requestGeneration = ++generation;
    const active = () => !disposed && token === current;
    // Snapshot the only nested setup object before yielding to native reads.
    const capturedSetup = setup === undefined ? undefined : {...setup,
      geometry: setup.geometry == null ? setup.geometry : {...setup.geometry}};
    state = {status: 'loading', selectedSessionId: sessionId, generation: requestGeneration, reasons: [], result: null};
    function publish(status: SavedSessionLoadState['status'], reasons: string[], result: SavedPayloadResult | null = null) {
      if (active()) state = {status, selectedSessionId: sessionId, generation: requestGeneration, reasons, result};
    }
    function analyze(sessionRead: BoundSavedRead, framesRead: BoundSavedRead) {
      if (!active()) return;
      const result = analyzeSavedPayload({selectedSessionId: sessionId, sessionRead, framesRead, setup: capturedSetup});
      const status = result.status === 'load-failed' || result.status === 'incompatible' || result.status === 'failed'
        ? 'failed' : result.status === 'unavailable' ? 'unavailable' : 'ready';
      publish(status, result.reasons, result);
    }
    if (typeof sessionId !== 'string' || !sessionId) { publish('failed', ['invalid_selection']); return; }
    let raw: string;
    try { raw = await reads.listSessions(); }
    catch (error) {
      analyze({sessionId, status: 'failed', reason: errorReason(error)},
        {sessionId, status: 'failed', reason: 'not_requested'});
      return;
    }
    if (!active()) return;
    let rows: unknown;
    try {
      if (typeof raw !== 'string' || raw.length > SUMMARY_LIST_LIMIT) throw new Error();
      rows = JSON.parse(raw);
    } catch { publish('failed', ['invalid_summary_list']); return; }
    if (!Array.isArray(rows) || rows.length > 100 || rows.some(row => !object(row) || typeof row.id !== 'string' || !row.id)) {
      publish('failed', ['invalid_summary_list']); return;
    }
    const matches = rows.filter(row => row.id === sessionId);
    if (!matches.length) { publish('unavailable', ['session_not_in_loaded_list']); return; }
    if (matches.length !== 1) { publish('failed', ['ambiguous_session_summary']); return; }
    let sessionRead: BoundSavedRead;
    try { sessionRead = {sessionId, status: 'loaded', payload: JSON.stringify(matches[0])}; }
    catch { publish('failed', ['invalid_session_summary']); return; }
    let framesRead: BoundSavedRead;
    try { framesRead = {sessionId, status: 'loaded', payload: await reads.readFrames(sessionId)}; }
    catch (error) { framesRead = {sessionId, status: 'failed', reason: errorReason(error)}; }
    analyze(sessionRead, framesRead);
  }
  return {
    getState: () => state,
    select,
    clear: () => invalidate('no_selection'),
    invalidate: () => invalidate(),
    dispose: () => {
      if (disposed) return;
      invalidate('disposed');
      disposed = true;
    },
  };
}
