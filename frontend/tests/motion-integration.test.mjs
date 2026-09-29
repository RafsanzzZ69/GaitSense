import test from 'node:test';
import assert from 'node:assert/strict';
import { detectMotionCandidates } from '../src/offline/motion-candidates.ts';
import { matchSyntheticMotionEvents } from '../src/validation/motion-matching.ts';
import { evaluateSyntheticMotionCohort } from '../src/validation/motion-cohort.ts';

// Piecewise sampled waveform, specified independently of detector output:
// period 800ms, maxima 400+800k and minima 800+800k inside [0,3000).
const MAX = [400, 1200, 2000, 2800], MIN = [800, 1600, 2400];
const frames = () => Array.from({ length: 100 }, (_, n) => ({ timestampMs: n*100,
  landmarks: Array.from({ length:33 }, (_, index) => ({ index,
    x: .5 + ([27,28].includes(index) ? [-.1,-.07,0,.07,.1,.07,0,-.07][n%8] : 0),
    y:.5, z:0, visibility:.9, presence:.9 })) }));
function recording({ id='a', participantId='p', side='left', direction=1, input=frames(),
  maxima=direction===1 ? MAX : MIN, minima=direction===1 ? MIN : MAX, ambiguous=false } = {}) {
  const session = { id, createdAt:1, durationMs:10000, sampledFrames:100, poseFrames:Math.max(1,input.length),
    usableFrameRatio:.8, landmarkCount:33, view:`side_${side}`, rawVideoRetained:false,
    modelSha256:'a'.repeat(64), extractorVersion:'android-pose-0.1.1',
    timestampMethod:'requested-100ms-nearest-decoded-frame', consentVersion:'local-prototype-notice-v1' };
  const detector = detectMotionCandidates(session, input, { direction, upright:true });
  assert.equal(detector.side, side);
  assert.equal(detector.timestampProvenance.actualDecodedFrameTimes, false);
  const regions = (ambiguous ? [[0,1000,'evaluable'],[1000,1400,'ambiguous'],[1400,3000,'evaluable']] : [[0,3000,'evaluable']])
    .map(([startMs,endMs,status],i) => ({ id:`${id}-region${i}`, startMs,endMs,status,reason:status==='evaluable'?null:'synthetic reference ambiguity' }));
  // Synthetic image identity is explicitly supplied by the fixture, never inferred from proximity.
  const images = new Map(input.map((f,i) => [f.timestampMs, `${id}-synthetic-image${i}`]));
  function event(role, t, i, polarity) {
    const region = regions.find(r => t>=r.startMs && t<r.endMs);
    assert.ok(region);
    return { id:`${id}-${role}-${polarity}-${i}`,participantId,attemptId:id,regionId:region.id,side,polarity,
      requestedMs:t, actualPtsMs:null,ptsMethod:'unknown',
      imageId:role==='candidate'?images.get(t):`${id}-independent-reference-image-${polarity}-${i}`,
      status:region.status==='evaluable'?'scorable':region.status,reason:region.reason };
  }
  const attempt = { id,participantId,view:session.view,side,status:'recorded',reason:null,scoringStartMs:0,
    timestampMethod:session.timestampMethod,correspondence:'asserted-exact-image',
    modelStatus:detector.status,modelReason:detector.status==='available'?null:detector.reasons.join(','),regions,
    slots:Array.from({length:30},(_,i) => {
      const o=detector.observations.find(o=>o.timestampMs===i*100);
      return {requestedMs:i*100,model:!o?'missing':o.value===null?'invalid':'valid',
        reason:!o?'no detector observation':o.value===null?o.reasons.join(','):null};
    }),
    references:[...maxima.map((t,i)=>event('reference',t,i,'maximum')),...minima.map((t,i)=>event('reference',t,i,'minimum'))],
    candidates:detector.candidates.filter(c=>c.timestampMs<3000).map((c,i)=>event('candidate',c.timestampMs,i,c.kind)) };
  return {attempt,detector,session,images,direction,
    owner:{participantId,attemptId:id}}; // Synthetic sidecar; never evidence authentication.
}
function verifySidecar(rec) {
  assert.ok(rec.detector && rec.session && rec.images instanceof Map && rec.owner, 'missing synthetic sidecar');
  const {attempt:a,detector:d}=rec;
  assert.deepEqual(rec.owner,{participantId:a.participantId,attemptId:a.id});
  assert.equal(rec.session.id,a.id);assert.equal(rec.session.view,a.view);
  assert.equal(rec.direction,d.direction);assert.equal(a.side,d.side);
  assert.equal(a.timestampMethod,d.timestampProvenance.method);
  const centers=d.candidates.filter(c=>c.timestampMs>=0 && c.timestampMs<3000);
  assert.equal(a.candidates.length,centers.length,'dropped or duplicated mapped candidate');
  for(const c of centers){
    assert.ok(d.segments[c.segmentIndex]?.includes(c.observationIndex),'wrong detector segment');
    assert.equal(d.observations[c.observationIndex]?.timestampMs,c.timestampMs);
    const events=a.candidates.filter(e=>e.requestedMs===c.timestampMs && e.polarity===c.kind);
    assert.equal(events.length,1,'incorrect mapped timestamp or polarity');
    assert.equal(events[0].side,c.side);
    assert.equal(events[0].imageId,rec.images.get(c.timestampMs));
  }
}
function failed() {
  const a=recording({id:'failed'}).attempt;
  return {...a,status:'failed',reason:'synthetic capture failure',scoringStartMs:null,modelStatus:'unavailable',modelReason:'no capture',
    regions:[],references:[],candidates:[],slots:Array.from({length:30},()=>({requestedMs:null,model:'missing',reason:'no capture'}))};
}
function pipeline(records, extra=[], pilots=[]) {
  const attempts=records.map(r=>r.attempt ?? r);
  const matching={schemaVersion:'synthetic-motion-matching-1',evidenceKind:'synthetic',algorithmVersion:'motion-matching-1',
    configurationVersion:'motion-match-100ms-1',attempts};
  const participants=[...new Set(attempts.map(a=>a.participantId))].map(id=>({id,partition:pilots.includes(id)?'pilot':'evaluation',
    trials:attempts.filter(a=>a.participantId===id).map(a=>({id:`trial-${a.id}`,status:a.status==='failed'?'failed':'completed',reason:a.reason,
      attempts:[{id:a.id,replaces:null,approval:null}]}))}));
  participants.push(...extra);
  const ledger={schemaVersion:'synthetic-motion-cohort-1',evidenceKind:'synthetic',participants,matching};
  const matched=matchSyntheticMotionEvents(matching);
  for(const rec of records) if((rec.attempt ?? rec).status==='recorded') verifySidecar(rec);
  return {ledger,matching:matched,cohort:evaluateSyntheticMotionCohort(ledger)};
}
const metrics = r => r.cohort.partitions[1].polarities;
const pending = id => ({id,partition:'evaluation',trials:[{id:`trial-${id}`,status:'unattempted',reason:'not collected',attempts:[]}]});
test('analytic motion passes actual detector, matcher and cohort with provenance',()=>{
  const rec=recording(), r=pipeline([rec]), [max,min]=metrics(r);
  assert.deepEqual(rec.detector.candidates.filter(c=>c.kind==='maximum' && c.timestampMs<3000).map(c=>c.timestampMs),MAX);
  assert.deepEqual(rec.detector.candidates.filter(c=>c.kind==='minimum' && c.timestampMs<3000).map(c=>c.timestampMs),MIN);
  assert.deepEqual(max.counts,{S:30,Q:30,V:30,R:4,D:4,T:4,misses:0,extras:0});
  assert.equal(min.counts.T,3); assert.equal(max.recall,1); assert.equal(min.precision,1);
  assert.equal(max.timing.maeMs,0); assert.equal(max.uncertainty.recall.interval.lower,1);
  assert.equal(r.cohort.scientificDecision,'NOT_EVALUATED'); assert.equal(r.cohort.authenticity,'not-established');
  assert.equal(r.cohort.timestampProvenance.actualPtsUsedForMatching,false);
  for(const c of rec.attempt.candidates){assert.equal(c.actualPtsMs,null);assert.equal(c.imageId,rec.images.get(c.requestedMs));}
  assert.notEqual(rec.attempt.references[0].imageId,rec.attempt.candidates[0].imageId);
  assert.deepEqual(r.matching.attempts,r.cohort.partitions[1].participants[0].attempts);
});
test('independently shifted reference times preserve signed timing errors and one-to-one pairs',()=>{
  const r=pipeline([recording({maxima:[450,1250,2050,2850],minima:[750,1550,2350]})]);
  assert.equal(metrics(r)[0].timing.biasMs,-50);assert.ok(Math.abs(metrics(r)[1].timing.biasMs-50)<1e-12);
  for(const p of r.matching.attempts[0].polarities){assert.equal(new Set(p.pairs.map(x=>x.candidateId)).size,p.counts.T);assert.equal(p.timing.maeMs,50);}
});
for(const mode of ['missing','low-confidence']) test(`${mode} observation breaks detector support but retains reference miss`,()=>{
  let input=frames(); if(mode==='missing') input=input.filter(f=>f.timestampMs!==300);else input[3].landmarks[24].presence=.1;
  const rec=recording({input}),r=pipeline([rec]),m=metrics(r)[0];
  assert.equal(rec.detector.segments.length,2);assert.equal(rec.detector.status,'partial');
  assert.equal(m.counts.R,4);assert.equal(m.counts.D,3);assert.equal(m.counts.misses,1);
  assert.equal(m.recall,.75);assert.equal(m.coverage.jointSignal,29/30);
  assert.equal(rec.attempt.slots[3].model,mode==='missing'?'missing':'invalid');
  assert.ok(rec.detector.exclusions.some(e=>e.reason==='boundary_support'));
});
test('extra detected motion remains extra against independent reference set',()=>{
  const r=pipeline([recording({maxima:[400,1200,2000]})]);
  assert.equal(metrics(r)[0].counts.extras,1);assert.equal(metrics(r)[0].precision,.75);
});
for(const side of ['left','right']) for(const direction of [1,-1]) test(`${side} direction ${direction} is explicit and polarity isolated`,()=>{
  const rec=recording({side,direction}),r=pipeline([rec]);
  assert.equal(rec.detector.direction,direction);
  assert.equal(metrics(r)[0].counts.T,direction===1?4:3);assert.equal(metrics(r)[1].counts.T,direction===1?3:4);
  assert.ok(rec.attempt.candidates.every(c=>c.side===side));
});
test('reference ambiguity is independent of model segment identity',()=>{
  const rec=recording({ambiguous:true}),r=pipeline([rec]),m=metrics(r)[0];
  assert.equal(rec.detector.segments.length,1);assert.equal(rec.attempt.regions.length,3);
  assert.equal(m.counts.T,3);assert.equal(m.unscorableReferences,1);assert.equal(m.unscorableCandidates,1);
  assert.equal(m.counts.misses,0);assert.equal(m.counts.extras,0);assert.equal(m.coverage.reference,26/30);
});
test('failed attempt, unattempted trial and zero-attempt person retain distinct accounting',()=>{
  const r=pipeline([recording(),failed()],[pending('q')]),[m]=metrics(r);
  assert.equal(m.counts.S,60);assert.equal(m.counts.R,4);assert.equal(m.recall,null);
  assert.equal(m.attemptedParticipantDescriptive.recall,1);assert.equal(m.pooledDescriptive.referenceCoverage,.5);
  const p=r.cohort.partitions[1].participants.find(p=>p.id==='p');assert.equal(p.failedTrials,1);
  assert.equal(r.cohort.partitions[1].collectionStatus,'incomplete');
});
test('multiple attempts and pilot isolation distinguish balanced from pooled rates',()=>{
  const bad=frames();bad.forEach(f=>f.landmarks[27].presence=0);
  const r=pipeline([recording(),recording({id:'b'}),recording({id:'c',participantId:'q',input:bad}),recording({id:'pilot',participantId:'pilot'})],[],['pilot']);
  assert.equal(metrics(r)[0].recall,.5);assert.equal(metrics(r)[0].pooledDescriptive.recall,2/3);
  assert.equal(metrics(r)[0].coverage.jointSignal,.5);assert.equal(r.cohort.partitions[0].polarities[0].recall,1);
});
for(const mode of ['empty','invalid','flat']) test(`${mode} detector result is retained without fabricated success`,()=>{
  const input=mode==='empty'?[]:frames();
  if(mode==='invalid')input.forEach(f=>f.landmarks[27].visibility=0);
  if(mode==='flat')input.forEach(f=>f.landmarks[27].x=.5);
  const rec=recording({input}),r=pipeline([rec]);
  assert.equal(rec.detector.status,mode==='flat'?'insufficient_evidence':'unavailable');
  assert.equal(r.matching.attempts[0].modelStatus,rec.detector.status);
  assert.equal(metrics(r)[0].counts.misses,4);assert.equal(metrics(r)[0].recall,0);assert.equal(metrics(r)[0].precision,null);
  assert.equal(metrics(r)[0].coverage.jointSignal,mode==='flat'?1:0);
});
test('bad ownership, side and configuration reject at actual matching boundary',()=>{
  for(const [field,value,code] of [['participantId','other','ownership_mismatch'],['side','right','side_mismatch']]){
    const rec=recording();rec.attempt.candidates[0][field]=value;
    assert.throws(()=>pipeline([rec]),e=>e.code===code);
  }
  const r=pipeline([recording()]);r.ledger.matching.configurationVersion='wrong';
  assert.throws(()=>evaluateSyntheticMotionCohort(r.ledger),e=>e.code==='unsupported_version');
});
test('ledger ordering and bootstrap reproducibility; time-ordered detector inputs are not shuffled',()=>{
  const r=pipeline([recording(),recording({id:'b',participantId:'q'})],[pending('z')]);
  r.ledger.participants.reverse();r.ledger.matching.attempts.reverse();
  r.ledger.matching.attempts.forEach(a=>{a.references.reverse();a.candidates.reverse();a.regions.reverse();});
  assert.deepEqual(evaluateSyntheticMotionCohort(r.ledger),r.cohort);
});


test('explicit synthetic PTS does not replace the requested matching clock',()=>{
  const rec=recording({maxima:[450,1250,2050,2850]});
  rec.attempt.candidates.forEach(c=>{c.actualPtsMs=c.requestedMs+17;c.ptsMethod='decoder';});
  const r=pipeline([rec]);
  assert.equal(metrics(r)[0].timing.biasMs,-50);
  assert.equal(r.cohort.timestampProvenance.actualPtsUsedForMatching,false);
  assert.equal(r.matching.attempts[0].polarities[0].pairs[0].candidateMs,400);
});
test('unattempted trial remains incomplete without inventing an additional attempt',()=>{
  const r=pipeline([recording()]);
  r.ledger.participants[0].trials.push({id:'pending-trial',status:'unattempted',reason:'pending',attempts:[]});
  const out=evaluateSyntheticMotionCohort(r.ledger).partitions[1];
  assert.equal(out.collectionStatus,'incomplete');assert.equal(out.participants[0].unattemptedTrials,1);
  assert.equal(out.polarities[0].counts.S,30);assert.equal(out.polarities[0].recall,1);
});
test('different reference regions cannot join nearby candidate and reference events',()=>{
  const rec=recording({maxima:[450,1200,2000,2800]});
  rec.attempt.regions=[{id:'before',startMs:0,endMs:425,status:'evaluable',reason:null},
    {id:'after',startMs:425,endMs:3000,status:'evaluable',reason:null}];
  for(const e of [...rec.attempt.references,...rec.attempt.candidates])e.regionId=e.requestedMs<425?'before':'after';
  const m=metrics(pipeline([rec]))[0];assert.equal(m.counts.T,3);assert.equal(m.counts.misses,1);assert.equal(m.counts.extras,1);
});
for(const [name,change] of [
  ['missing sidecar',r=>delete r.detector],
  ['wrong sidecar owner',r=>r.owner.participantId='other'],
  ['wrong segment',r=>r.detector.candidates[0].segmentIndex=999],
  ['wrong image correspondence',r=>r.images.set(400,'unrelated-image')],
  ['shifted matching timestamp',r=>r.attempt.candidates[0].requestedMs=401],
  ['wrong polarity',r=>r.attempt.candidates[0].polarity='minimum'],
  ['dropped candidate',r=>r.attempt.candidates.shift()],
]) test(`sidecar guard detects ${name}`,()=>{
  const rec=recording();change(rec);assert.throws(()=>pipeline([rec]),assert.AssertionError);
});
test('hand-specified pair identities and errors detect remapped events',()=>{
  const r=pipeline([recording({maxima:[450,1250,2050,2850],minima:[750,1550,2350]})]);
  assert.deepEqual(r.matching.attempts[0].polarities[0].pairs.map(p=>[p.referenceId,p.candidateId,p.referenceMs,p.candidateMs,p.signedErrorMs]),[
    ['a-reference-maximum-0','a-candidate-maximum-0',450,400,-50],
    ['a-reference-maximum-1','a-candidate-maximum-2',1250,1200,-50],
    ['a-reference-maximum-2','a-candidate-maximum-4',2050,2000,-50],
    ['a-reference-maximum-3','a-candidate-maximum-6',2850,2800,-50],
  ]);
});
test('independent collection inventory catches deleted failure and pending trial',()=>{
  const r=pipeline([recording(),failed()],[pending('q')]);
  const checkInventory=out=>{
    const people=out.partitions[1].participants;
    assert.deepEqual(people.map(p=>[p.id,p.failedTrials,p.unattemptedTrials]),[['p',1,0],['q',0,1]]);
    assert.equal(people.flatMap(p=>p.attempts).length,2);
  };
  checkInventory(r.cohort);
  const lostFailure=structuredClone(r.ledger);
  lostFailure.matching.attempts=lostFailure.matching.attempts.filter(a=>a.id!=='failed');
  lostFailure.participants[0].trials=lostFailure.participants[0].trials.filter(t=>t.id!=='trial-failed');
  assert.throws(()=>checkInventory(evaluateSyntheticMotionCohort(lostFailure)),assert.AssertionError);
  const lostPerson=structuredClone(r.ledger);lostPerson.participants=lostPerson.participants.filter(p=>p.id!=='q');
  assert.throws(()=>checkInventory(evaluateSyntheticMotionCohort(lostPerson)),assert.AssertionError);
});
