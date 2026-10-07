import {createSavedSessionLoader} from './saved-session-loader.ts';
import type {SavedSessionReads} from './saved-session-loader.ts';
import {presentSavedAnalysis} from './analysis-presentation.ts';
import type {SavedAnalysisPresentation} from './analysis-presentation.ts';
import type {SavedAnalysisSetup} from './saved-payload-analysis.ts';

/** Screen lifetime binding. All selection races remain owned by the production loader.
 * After any completion emit only its CURRENT state, never a captured request result.
 */
export function createSavedAnalysisBinding(reads: SavedSessionReads, publish: (p: SavedAnalysisPresentation) => void) {
  const loader = createSavedSessionLoader(reads);
  let disposed = false;
  let lastPublished: ReturnType<typeof loader.getState> | null = null;
  function emit() {
    const state = loader.getState();
    if (!disposed && state !== lastPublished) { lastPublished = state; publish(presentSavedAnalysis(state)); }
  }
  return {
    async select(id: string, setup?: SavedAnalysisSetup) {
      if (disposed) return;
      // Request fresh detector evidence, never assert continuous capture. The wrapper
      // checks usable segments/gaps from the validated saved frames before using it.
      // Explicit caller setup (including unknown continuity) keeps its existing policy.
      const pending = loader.select(id, setup === undefined ? {continuity:'detector-segments'} : setup);
      emit();
      await pending;
      emit();
    },
    clear() { loader.clear(); emit(); },
    leave() { loader.invalidate(); emit(); },
    dispose() { disposed = true; loader.dispose(); },
  };
}

const measurement = (value: number | null, units: string) => value === null ? 'Unavailable' : `${value} ${units}`;
// Presentation only: retain the original codes in the immutable analysis contract.
const readable = (value: string) => value.replace(/_/g, ' ');
const reasons = (values: readonly string[]) => values.length ? values.map(readable).join(', ') : 'none';
/** Actual text rows consumed by the native panel. No recomputation or numeric defaults. */
export function savedAnalysisPanel(p: SavedAnalysisPresentation) {
  const groups: {title: string; lines: string[]; expandable?: boolean}[] = [];
  groups.push({title: 'Analysis setup', lines: [
    ...[p.setup.geometry,p.setup.direction,p.setup.upright,p.setup.continuity].map(s=>`${s.requirement}: ${s.status}`),
    ...(p.setup.direction.status==='persisted-operator' ?
      [`Operator recording setup: movement toward image ${p.setup.direction.value===1?'right':'left'}.`] : []),
    ...(p.setup.upright.status==='persisted-operator' ?
      ['Operator recording setup: upright image orientation confirmed. This is an assertion, not scientific validation.'] : []),
    ...[p.setup.geometry,p.setup.direction,p.setup.upright].some(s=>s.status==='required') ?
      ['Saved metadata does not establish the missing setup. Diagnostic text and camera-side selection cannot supply it.'] : [],
  ]});
  const k=p.components.knee,m=p.components.motion,i=p.components.intervals;
  groups.push({title: `${k.label} · ${k.status}`, expandable: true, lines: [
    `Reasons: ${reasons(k.reasons)}`,
    ...(k.details?.observations.map(o=>`${o.timestampMs} ms requested: ${measurement(o.value,k.units)}; ${reasons(o.reasons)}`) ?? ['No calculated observations.']),
  ]});
  groups.push({title: `${m.label} · ${m.status}`, expandable: true, lines: [
    `Reasons: ${reasons(m.reasons)}`,
    ...(m.details?.candidates.map(c=>`${c.kind} candidate at ${c.timestampMs} ms requested`) ?? []),
    ...(m.details?.observations.filter(o=>o.reasons.length).map(o=>`${o.timestampMs} ms requested: ${measurement(o.value,m.units)}; ${reasons(o.reasons)}`) ?? []),
    ...(m.details?.exclusions.map(e=>`Excluded observation ${e.observationIndex}: ${readable(e.reason)}`) ?? []),
  ]});
  groups.push({title: `${i.label} · ${i.status}`, expandable: true, lines: [
    `Reasons: ${reasons(i.reasons)}`,
    ...(i.details?.polarities.flatMap(polarity=>[
      `${polarity.polarity}: ${polarity.status}; ${reasons(polarity.reasons)}`,
      ...polarity.intervals.map(o=>`${o.start.timestampMs} → ${o.end.timestampMs} ms requested: ${measurement(o.elapsedMs,i.units)}; ${reasons(o.reasons)}`),
    ]) ?? ['No calculated intervals.']),
  ]});
  groups.push({title:'Evidence limitations',lines:[
    `Timestamp method: ${p.provenance.timestampMethod ?? 'Unavailable'}`,
    'Actual decoded-frame PTS unavailable. Exact-image correspondence not established. Frame ownership is not independently authenticated.',
    'Projected 2D values are not anatomical validation. Motion extrema are candidates, not confirmed contacts. Candidate intervals are not validated step or stride times.',
    'Native reads are noncancellable and non-atomic. History lists at most 100 summaries; absence from that list does not prove database-wide absence.',
  ]});
  return {title:p.label, status:p.status, sessionId:p.selection.sessionId,
    lines:[`Scientific status: ${p.scientificStatus} (not scientifically evaluated)`,`Data: ${p.dataStatus}`,
      ...p.reasons.map(r=>`Reason: ${readable(r)}`),...(p.failureDetail?[`Read/processing detail: ${p.failureDetail}`]:[])],groups};
}
