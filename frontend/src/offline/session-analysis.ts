import {parseSession} from './contract.ts';
import {analyzeKneeFlexion} from './knee-flexion.ts';
import {detectMotionCandidates} from './motion-candidates.ts';
import {calculateCandidateMotionIntervals} from './motion-intervals.ts';
import type {Session} from './contract.ts';
import type {MotionResult} from './motion-candidates.ts';
import type {KneeGeometryInput} from './knee-flexion.ts';

export const SESSION_ANALYSIS_VERSION='session-analysis-3';
export type AnalysisRequest={session:unknown;frames:unknown;
 geometry?:KneeGeometryInput|null;
 setupConflicts?: ('direction_conflict'|'upright_conflict'|'invalid_persisted_setup')[];
 context:{sessionId:string;participantId:string|null;attemptId:string|null;view:string;side:'left'|'right';
 direction:1|-1|null;upright:boolean;directionSource?:'caller-asserted'|'operator-recording-setup';continuity:'detector-segments'|'unknown'};
 processing:{status:'completed'|'failed';reason:string|null}};
type Failure={status:'unavailable';reasons:string[];result:null};
function unavailable(...reasons:string[]):Failure{return {status:'unavailable',reasons,result:null};}
const object=(x:unknown):x is Record<string,unknown>=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ownerId=(x:unknown)=>x===null||typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x);
/** Compose freshly computed results from one session/frame input; external result bundles are not accepted. */
export function analyzeSavedSession(request:AnalysisRequest){
 const base={contractVersion:SESSION_ANALYSIS_VERSION,scientificStatus:'NOT_EVALUATED',
  evidence:{actualFramePts:'not-available',exactImageCorrespondence:'not-established',sourceImages:'not-supplied',
   candidateIdentity:'analysis-local-index-not-persistent'},
  limitations:['projected-2d-knee-not-anatomical-validation','motion-extrema-not-contacts','intervals-not-step-or-stride-time','physical-cycle-completeness-unknown']};
 function fail(status:'incompatible'|'failed',reasons:string[],session:Session|null=null){
  return {...base,status,reasons,session,context:request?.context??null,processing:request?.processing??null,
   components:{knee:unavailable(...reasons),motion:unavailable(...reasons),intervals:unavailable(...reasons)}};
 }
 if(!object(request)||!object(request.context)||!object(request.processing))return fail('incompatible',['invalid_request']);
 let session:Session;
 try{session=parseSession(JSON.stringify(request.session));}catch{return fail('incompatible',['invalid_session']);}
 const ctx=request.context,p=request.processing,reasons:string[]=[];
 if(ctx.sessionId!==session.id)reasons.push('session_identity_mismatch');
 if(ctx.view!==session.view||ctx.side!==(session.view==='side_left'?'left':'right'))reasons.push('view_side_mismatch');
 if(!ownerId(ctx.participantId)||!ownerId(ctx.attemptId))reasons.push('invalid_ownership');
 if(!['detector-segments','unknown'].includes(ctx.continuity))reasons.push('invalid_continuity_request');
 if(ctx.directionSource !== undefined && !['caller-asserted','operator-recording-setup'].includes(ctx.directionSource))reasons.push('invalid_direction_source');
 if(request.setupConflicts !== undefined && (!Array.isArray(request.setupConflicts) ||
   request.setupConflicts.some(r=>!['direction_conflict','upright_conflict','invalid_persisted_setup'].includes(r))))reasons.push('invalid_setup_conflicts');
 if(reasons.length)return fail('incompatible',reasons,session);
 if(p.status==='failed'&&typeof p.reason==='string'&&p.reason.trim())return fail('failed',['processing_failed',p.reason],session);
 if(p.status!=='completed'||p.reason!==null)return fail('incompatible',['invalid_processing_state'],session);
 // Both engines accept dense frame lists. Prevent sparse arrays from bypassing detector validation.
 if(!Array.isArray(request.frames)||Array.from({length:request.frames.length},(_,i)=>i).some(i=>!Object.hasOwn(request.frames as object,i)))
  return fail('incompatible',['invalid_frames'],session);
 const knee=analyzeKneeFlexion(session,request.frames,request.geometry);
 const conflicts=request.setupConflicts ?? [];
 const motion=conflicts.length ? null : detectMotionCandidates(session,request.frames,{direction:ctx.direction as 1|-1,upright:ctx.upright as true});
 const kneeComponent={status:knee.status,reasons:[...knee.reasons],result:knee};
 const motionComponent=motion ? {status:motion.status,reasons:[...motion.reasons],result:motion} : unavailable(...conflicts);
 const continuity=motion && ctx.continuity==='detector-segments'&&verifiedContinuity(motion)?'detector-segments':'unknown';
 // Session IDs in the existing Session contract are arbitrary strings; interval ownership uses a
 // restricted identifier grammar. Never rename or encode one silently to manufacture compatibility.
 let intervals:Failure|{status:string;reasons:string[];result:ReturnType<typeof calculateCandidateMotionIntervals>};
 if(!motion)intervals=unavailable('motion_setup_unavailable',...conflicts);
 else if(!ownerId(session.id))intervals=unavailable('interval_session_id_incompatible');
 else {
  const result=calculateCandidateMotionIntervals({schemaVersion:'candidate-motion-interval-input-1',
   sourceAlgorithmVersion:motion.algorithmVersion,sourceConfigurationVersion:motion.configuration.version,
   sourceStatus:motion.status,sourceReasons:motion.reasons,directionSource:ctx.directionSource ?? 'caller-asserted',
   timestampProvenance:motion.timestampProvenance,continuity,gaps:motion.gaps,
   candidates:motion.candidates.map((c,i)=>({id:`candidate-${i}`,participantId:ctx.participantId,attemptId:ctx.attemptId,sessionId:session.id,
    timestampMs:c.timestampMs,side:c.side,kind:c.kind,direction:motion.direction,segmentIndex:continuity==='unknown'?null:c.segmentIndex}))});
  const count=result.polarities.reduce((n,p)=>n+p.summary.count,0);
  intervals={status:!count?'unavailable':result.polarities.some(p=>p.status!=='available')?'partial':'available',
   reasons:[...new Set(result.polarities.flatMap(p=>[...p.reasons,...p.intervals.flatMap(i=>i.reasons)]))],result};
 }
 const components={knee:kneeComponent,motion:motionComponent,intervals};
 const states=Object.values(components).map(c=>c.status);
 return {...base,session:{...session},context:{...ctx},processing:{...p},components,
  status:states.every(s=>s==='available')?'available':states.every(s=>s==='unavailable')?'unavailable':'partial',reasons:[]};
}
function verifiedContinuity(r:MotionResult){
 for(const segment of r.segments){
  for(let i=0;i<segment.length;i++){
   const o=r.observations[segment[i]],previous=r.observations[segment[i-1]];
   if(!o||o.value===null||!Number.isFinite(o.value)||o.reasons.length||
    (i>0&&(segment[i]!==segment[i-1]+1||o.timestampMs<=previous.timestampMs||o.timestampMs-previous.timestampMs>r.configuration.maxGapMs)))return false;
  }
 }
 return r.candidates.every(c=>r.segments[c.segmentIndex]?.includes(c.observationIndex)&&r.observations[c.observationIndex]?.timestampMs===c.timestampMs);
}
