import type { MotionCandidate, MotionResult } from './motion-candidates.ts';

export const INTERVAL_VERSION = 'candidate-motion-interval-1';
export type IntervalCandidate = Pick<MotionCandidate, 'timestampMs' | 'side' | 'kind'> & {
  id: string; segmentIndex: number | null;
  participantId: string | null; attemptId: string | null; sessionId: string | null;
  direction: 1 | -1 | null;
};
export type IntervalInput = {
  schemaVersion: 'candidate-motion-interval-input-1';
  sourceAlgorithmVersion: 'ankle-motion-extrema-1'; sourceConfigurationVersion: 'ankle-motion-quality-1';
  sourceStatus: MotionResult['status']; sourceReasons: string[];
  directionSource: 'caller-asserted' | 'operator-recording-setup'; timestampProvenance: MotionResult['timestampProvenance'];
  continuity: 'detector-segments' | 'unknown'; gaps: MotionResult['gaps'];
  candidates: IntervalCandidate[];
};
export class IntervalInputError extends Error {
  code: string; path: string;
  constructor(code: string, path: string) { super(`${code}: ${path}`); this.code=code; this.path=path; }
}
function requireValue(ok: unknown, code: string, path: string): asserts ok {
  if(!ok) throw new IntervalInputError(code,path);
}
const object = (v: unknown): v is Record<string,unknown> => v!==null && typeof v==='object' && !Array.isArray(v);
const id = (v: unknown) => typeof v==='string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const time = (v: unknown): v is number => typeof v==='number' && Number.isSafeInteger(v) && v>=0;
const nullableId = (v: unknown) => v===null || id(v);
/** Input order is meaningful. Never sort, interpolate or bridge a rejected same-polarity candidate. */
export function calculateCandidateMotionIntervals(raw: unknown) {
  requireValue(object(raw),'invalid_input','input');
  requireValue(raw.schemaVersion==='candidate-motion-interval-input-1','unsupported_version','schemaVersion');
  requireValue(Array.isArray(raw.candidates),'invalid_input','candidates');
  requireValue(Array.isArray(raw.sourceReasons) && raw.sourceReasons.every(r=>typeof r==='string'),'invalid_input','sourceReasons');
  requireValue(['available','partial','insufficient_evidence','unavailable'].includes(raw.sourceStatus as string),'invalid_input','sourceStatus');
  requireValue(['detector-segments','unknown'].includes(raw.continuity as string),'invalid_input','continuity');
  requireValue(Array.isArray(raw.gaps),'invalid_input','gaps');
  raw.gaps.forEach((g,i)=>requireValue(object(g)&&time(g.afterMs)&&time(g.beforeMs)&&g.beforeMs>g.afterMs,'invalid_gap',`gaps[${i}]`));
  const ids=new Set<string>();
  raw.candidates.forEach((c,i)=>{
    const p=`candidates[${i}]`;
    requireValue(object(c)&&id(c.id),'invalid_candidate',p);
    requireValue(!ids.has(c.id as string),'duplicate_id',p);ids.add(c.id as string);
    requireValue(['left','right'].includes(c.side as string)&&['maximum','minimum'].includes(c.kind as string),'invalid_candidate',p);
    requireValue(nullableId(c.participantId)&&nullableId(c.attemptId)&&nullableId(c.sessionId),'invalid_owner',p);
    requireValue(c.direction===null||c.direction===1||c.direction===-1,'invalid_direction',p);
    requireValue(c.segmentIndex===null||time(c.segmentIndex),'invalid_segment',p);
    // Invalid numeric timestamps remain visible as excluded observations, not repaired.
    requireValue(typeof c.timestampMs==='number','invalid_timestamp_type',p);
  });
  const input=raw as unknown as IntervalInput;
  const provenance=input.timestampProvenance;
  const globalReasons:string[]=[];
  if(input.sourceAlgorithmVersion!=='ankle-motion-extrema-1'||input.sourceConfigurationVersion!=='ankle-motion-quality-1')globalReasons.push('unsupported_source_version');
  if(input.directionSource!=='caller-asserted' && input.directionSource!=='operator-recording-setup')globalReasons.push('unsupported_direction_source');
  if(!object(provenance)||provenance.method!=='requested-100ms-nearest-decoded-frame'||provenance.actualDecodedFrameTimes!==false||provenance.usesStoredDifferences!==true)globalReasons.push('unsupported_timestamp_provenance');
  if(input.sourceStatus==='unavailable')globalReasons.push('source_unavailable');
  // Check global order, including opposite-polarity observations; do not silently regroup corrupt chronology.
  const invalid=new Map<string,string[]>();
  input.candidates.forEach((c,i)=>{
    const reasons:string[]=[];
    if(!time(c.timestampMs))reasons.push('invalid_timestamp');
    if(i && time(c.timestampMs)&&time(input.candidates[i-1].timestampMs)&&c.timestampMs<=input.candidates[i-1].timestampMs)reasons.push('non_increasing_timestamp');
    if(reasons.length)invalid.set(c.id,reasons);
  });
  const polarities=(['maximum','minimum'] as const).map(polarity=>{
    const candidates=input.candidates.filter(c=>c.kind===polarity);
    const intervals=candidates.slice(1).map((end,i)=>{
      const start=candidates[i], reasons=[...globalReasons,...(invalid.get(start.id)??[]),...(invalid.get(end.id)??[])];
      const between=input.candidates.slice(input.candidates.indexOf(start),input.candidates.indexOf(end)+1);
      if(between.some(c=>invalid.has(c.id)))reasons.push('invalid_chronology');
      if(between.some(c=>c.participantId!==start.participantId||c.attemptId!==start.attemptId||c.sessionId!==start.sessionId||
        c.side!==start.side||c.direction!==start.direction||c.segmentIndex!==start.segmentIndex))reasons.push('intervening_metadata_change');
      if(start.participantId!==end.participantId||start.attemptId!==end.attemptId||start.sessionId!==end.sessionId)reasons.push('ownership_mismatch');
      if(start.attemptId===null&&start.sessionId===null || end.attemptId===null&&end.sessionId===null)reasons.push('ownership_unknown');
      if(start.side!==end.side)reasons.push('side_mismatch');
      if(start.direction===null||end.direction===null)reasons.push('direction_unknown');
      else if(start.direction!==end.direction)reasons.push('direction_mismatch');
      if(end.timestampMs<=start.timestampMs)reasons.push('non_increasing_timestamp');
      if(input.continuity==='unknown'||start.segmentIndex===null||end.segmentIndex===null)reasons.push('continuity_unknown');
      else if(start.segmentIndex!==end.segmentIndex)reasons.push('segment_mismatch');
      if(input.gaps.some(g=>g.afterMs<end.timestampMs&&g.beforeMs>start.timestampMs))reasons.push('known_gap');
      const unique=[...new Set(reasons)];
      return {start:{...start},end:{...end},polarity,status:unique.length?'unavailable':'available',reasons:unique,
        elapsedMs:unique.length?null:end.timestampMs-start.timestampMs};
    });
    const values=intervals.flatMap(i=>i.elapsedMs===null?[]:[i.elapsedMs]).sort((a,b)=>a-b);
    const count=values.length;
    return {polarity,status:globalReasons.length?'unavailable':!count?'insufficient_evidence':count<intervals.length||input.sourceStatus==='partial'?'partial':'available',
      reasons:[...globalReasons,...(!count?['insufficient_intervals']:[])],intervals,
      summary:{count,meanMs:count?values.reduce((a,b)=>a+b/count,0):null,
        medianMs:count? count%2?values[(count-1)/2]:values[count/2-1]/2+values[count/2]/2:null,
        minimumMs:count?values[0]:null,maximumMs:count?values[count-1]:null}};
  });
  return {algorithmVersion:INTERVAL_VERSION,configurationVersion:'same-polarity-contiguous-1',scientificStatus:'NOT_EVALUATED',
    meaning:'candidate-motion-periodicity-only',physicalCycleCompleteness:'unknown',
    sourceAlgorithmVersion:input.sourceAlgorithmVersion,sourceConfigurationVersion:input.sourceConfigurationVersion,
    sourceStatus:input.sourceStatus,sourceReasons:[...input.sourceReasons],directionSource:input.directionSource,
    timestampProvenance:object(provenance)?{...provenance}:null,continuity:input.continuity,gaps:input.gaps.map(g=>({...g})),
    candidates:input.candidates.map(c=>({...c})),invalidCandidates:[...invalid].map(([id,reasons])=>({id,reasons})),polarities};
}
