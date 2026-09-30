import test from 'node:test';
import assert from 'node:assert/strict';
import {detectMotionCandidates} from '../src/offline/motion-candidates.ts';
import {calculateCandidateMotionIntervals} from '../src/offline/motion-intervals.ts';
const wave=()=>Array.from({length:25},(_,i)=>({timestampMs:100*i,landmarks:Array.from({length:33},(_,index)=>({index,
 x:.5+([27,28].includes(index)?[-.1,-.07,0,.07,.1,.07,0,-.07][i%8]:0),y:.5,z:0,visibility:.9,presence:.9}))}));
function detect(frames=wave(),side='left',direction=1){
 return detectMotionCandidates({id:'synthetic-session',createdAt:1,durationMs:10000,sampledFrames:100,poseFrames:Math.max(1,frames.length),
 usableFrameRatio:.8,landmarkCount:33,view:`side_${side}`,rawVideoRetained:false,modelSha256:'a'.repeat(64),extractorVersion:'android-pose-0.1.1',
 timestampMethod:'requested-100ms-nearest-decoded-frame',consentVersion:'local-prototype-notice-v1'},frames,{direction,upright:true});
}
// Test-scoped metadata supplied explicitly; no frame/image identity is asserted.
const owner={participantId:'synthetic-person',attemptId:'synthetic-attempt',sessionId:'synthetic-session'};
function map(result,ownership=owner){
 let complete=Array.isArray(result.segments)&&Array.isArray(result.observations)&&Array.isArray(result.gaps);
 if(complete){
   for(const segment of result.segments){
     for(let k=0;k<segment.length;k++){
       const index=segment[k],o=result.observations[index],prev=result.observations[segment[k-1]];
       if(!o||!Number.isFinite(o.value)||o.value===null||o.reasons.length||
          (k && (index!==segment[k-1]+1||o.timestampMs<=prev.timestampMs||o.timestampMs-prev.timestampMs>result.configuration.maxGapMs)))complete=false;
     }
   }
   for(const c of result.candidates){
     if(!result.segments[c.segmentIndex]?.includes(c.observationIndex)||result.observations[c.observationIndex]?.timestampMs!==c.timestampMs)complete=false;
   }
 }
 return {schemaVersion:'candidate-motion-interval-input-1',sourceAlgorithmVersion:result.algorithmVersion,sourceConfigurationVersion:result.configuration.version,
 sourceStatus:result.status,sourceReasons:[...result.reasons],directionSource:'caller-asserted',timestampProvenance:{...result.timestampProvenance},
 continuity:complete?'detector-segments':'unknown',gaps:result.gaps??[],candidates:result.candidates.map((c,i)=>({
 id:`synthetic-candidate-${i}`,...ownership,timestampMs:c.timestampMs,side:c.side,kind:c.kind,direction:result.direction,segmentIndex:complete?c.segmentIndex:null}))};
}
const run=r=>calculateCandidateMotionIntervals(map(r));
const values=r=>r.polarities.map(p=>p.intervals.map(i=>i.elapsedMs));
test('known 800ms waveform, separate polarity intervals and explicit identity',()=>{
 const d=detect(),r=run(d);
 assert.deepEqual(d.candidates.map(c=>c.timestampMs),[400,800,1200,1600,2000]);
 assert.deepEqual(values(r),[[800,800],[800]]);
 assert.deepEqual(r.polarities[0].summary,{count:2,meanMs:800,medianMs:800,minimumMs:800,maximumMs:800});
 assert.equal(r.polarities[0].intervals[0].start.participantId,'synthetic-person');
 assert.equal(r.sourceStatus,'partial'); // Full Session declares 100 requests; only 25 supplied.
 assert.equal(r.scientificStatus,'NOT_EVALUATED');assert.equal(r.physicalCycleCompleteness,'unknown');
});
test('irregular <=100ms requested differences produce 720ms intervals without FPS',()=>{
 const f=wave();f.forEach((frame,i)=>{const t=Math.floor(i/8)*720+[0,80,170,270,360,440,530,630][i%8];frame.timestampMs=t;
 frame.landmarks[27].x=.5-.1*Math.cos(2*Math.PI*t/720);});
 const d=detect(f),r=run(d);assert.deepEqual(d.candidates.map(c=>c.timestampMs),[360,720,1080,1440,1800]);
 assert.deepEqual(values(r),[[720,720],[720]]);assert.ok(r.sourceReasons.includes('irregular_sampling'));
});
for(const side of ['left','right'])for(const direction of [1,-1])test(`${side}, explicit direction ${direction}`,()=>{
 const r=run(detect(wave(),side,direction));assert.deepEqual(values(r),direction===1?[[800,800],[800]]:[[800],[800,800]]);
 assert.ok(r.candidates.every(c=>c.side===side&&c.direction===direction));
});
for(const mode of ['missing','low-confidence'])test(`${mode} separates intervals without bridging detector segments`,()=>{
 let f=wave();if(mode==='missing')f=f.filter(x=>x.timestampMs!==1200);else f[12].landmarks[23].visibility=.1;
 const d=detect(f),r=run(d);assert.equal(d.segments.length,2);
 assert.deepEqual(d.candidates.map(c=>c.timestampMs),[400,800,1600,2000]);
 assert.deepEqual(values(r),[[null],[null]]);assert.ok(r.polarities.every(p=>p.intervals[0].reasons.includes('segment_mismatch')));
 if(mode==='missing')assert.ok(r.polarities[0].intervals[0].reasons.includes('known_gap'));
 else assert.equal(d.observations[12].value,null);
});
for(const damage of ['absent','invalid-member','broken-observation'])test(`unknown continuity for ${damage} evidence`,()=>{
 const d=detect();if(damage==='absent')delete d.segments;
 if(damage==='invalid-member')d.candidates[0].segmentIndex=99;
 if(damage==='broken-observation')d.observations[6].value=null;
 const r=run(d);assert.equal(r.continuity,'unknown');assert.equal(r.polarities[0].summary.count,0);
 assert.ok(r.polarities[0].intervals[0].reasons.includes('continuity_unknown'));
});
test('truncated support keeps only two unlike extrema and no fabricated interval',()=>{
 const d=detect(wave().filter(f=>f.timestampMs>=300&&f.timestampMs<=1700)),r=run(d);
 assert.deepEqual(d.candidates.map(c=>c.timestampMs),[800,1200]);assert.equal(d.status,'insufficient_evidence');
 assert.deepEqual(values(r),[[],[]]);assert.ok(r.polarities.every(p=>p.summary.meanMs===null));
});
test('unavailable source and provenance are preserved',()=>{
 const f=wave();f.forEach(x=>x.landmarks[27].presence=0);const d=detect(f),r=run(d);
 assert.equal(d.status,'unavailable');assert.ok(r.polarities.every(p=>p.status==='unavailable'));
 assert.equal(r.timestampProvenance.actualDecodedFrameTimes,false);assert.equal(r.timestampProvenance.usesStoredDifferences,true);
});
test('contradictory PTS claim rejected, no timestamp reinterpretation',()=>{
 const input=map(detect());input.timestampProvenance.actualDecodedFrameTimes=true;
 const r=calculateCandidateMotionIntervals(input);assert.equal(r.polarities[0].summary.count,0);
 assert.ok(r.polarities[0].intervals[0].reasons.includes('unsupported_timestamp_provenance'));
});
test('ownership mismatch is not inferred away from matching timestamps',()=>{
 const input=map(detect());input.candidates[2].attemptId='other';
 const r=calculateCandidateMotionIntervals(input);assert.equal(r.polarities[0].summary.count,0);
 assert.ok(r.polarities[0].intervals.every(i=>i.reasons.includes('ownership_mismatch')));
});
test('source version and malformed ownership remain explicit errors',()=>{
 const input=map(detect());input.sourceConfigurationVersion='unknown';
 assert.ok(calculateCandidateMotionIntervals(input).polarities[0].reasons.includes('unsupported_source_version'));
 input.candidates[0].participantId=23;assert.throws(()=>calculateCandidateMotionIntervals(input),e=>e.code==='invalid_owner');
});
test('mapping deterministic, independent of repeat execution and never mutates result',()=>{
 const d=detect(),copy=structuredClone(d);assert.deepEqual(run(d),run(d));assert.deepEqual(d,copy);
 assert.ok(!('imageId' in map(d).candidates[0]));
});
