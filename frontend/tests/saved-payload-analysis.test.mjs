import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSavedPayload as run, SAVED_PAYLOAD_LIMITS} from '../src/offline/saved-payload-analysis.ts';
import {analyzeSavedSession} from '../src/offline/session-analysis.ts';

function fixture() {
 const id='12345678-1234-4234-8234-123456789abc';
 const session={id,createdAt:1,durationMs:10000,sampledFrames:100,poseFrames:100,
  usableFrameRatio:1,landmarkCount:33,view:'side_left',rawVideoRetained:false,modelSha256:'a'.repeat(64),
  extractorVersion:'android-pose-0.1.1',timestampMethod:'requested-100ms-nearest-decoded-frame',
  consentVersion:'local-prototype-notice-v1',diagnostics:'decoded=1920x1080'};
 const frames=Array.from({length:100},(_,n)=>({timestampMs:n*100,
  landmarks:Array.from({length:33},(_,index)=>({index,
   x:index===27?.5+[-.1,-.07,0,.07,.1,.07,0,-.07][n%8]:.5,
   y:index===23?.3:index===25?.5:index===27?.7:.5,z:0,visibility:.9,presence:.9}))}));
 const setup={geometry:{inferenceWidth:768,inferenceHeight:432,
  source:'caller-asserted-inference-dimensions',assumption:'constant-inference-dimensions-within-session'},
  direction:1,upright:true,continuity:'detector-segments'};
 return {session,frames,setup};
}
function request(f) {return {selectedSessionId:f.session.id,
 sessionRead:{sessionId:f.session.id,status:'loaded',payload:JSON.stringify(f.session)},
 framesRead:{sessionId:f.session.id,status:'loaded',payload:JSON.stringify(f.frames)},setup:f.setup};}

test('valid native-shaped JSON binding, independent candidate times and intervals',()=>{
 const f=fixture(),q=request(f),before=structuredClone(q),r=run(q),a=r.analysis;
 assert.equal(r.status,'available');assert.deepEqual(q,before);assert.deepEqual(run(q),r);
 assert.equal(r.binding.verification,'caller-bound-ids-only');assert.equal(r.counts.loaded,100);
 assert.equal(a.components.knee.result.geometry.source,'caller-asserted-inference-dimensions');
 assert.equal(a.components.knee.result.observations[2].value,0);
 assert.deepEqual(a.components.motion.result.candidates.filter(c=>c.kind==='maximum').map(c=>c.timestampMs),
  Array.from({length:12},(_,k)=>400+800*k));
 assert.deepEqual(a.components.intervals.result.polarities[0].intervals.map(i=>i.elapsedMs),Array(11).fill(800));
});
for(const field of ['selectedSessionId','sessionRead','framesRead','summary'])test(`identity mismatch: ${field}`,()=>{
 const f=fixture(),q=request(f);
 if(field==='selectedSessionId')q.selectedSessionId='foreign';
 else if(field==='summary'){f.session.id='foreign';q.sessionRead.payload=JSON.stringify(f.session);}
 else q[field].sessionId='foreign';
 assert.deepEqual(run(q).reasons,['session_identity_mismatch']);assert.equal(run(q).analysis,null);
});
for(const [label,edit,reason] of [
 ['empty read',f=>f.frames=[],'frame_count_mismatch'],
 ['incomplete read',f=>f.frames.pop(),'frame_count_mismatch'],
 ['extra frame',f=>f.session.poseFrames=99,'frame_count_mismatch'],
 ['wrong sampled count',f=>f.session.sampledFrames=101,'invalid_session_counts_or_metadata'],
 ['duplicate',f=>f.frames[2].timestampMs=100,'duplicate_timestamp'],
 ['nonadjacent duplicate',f=>f.frames[2].timestampMs=0,'duplicate_timestamp'],
 ['decreasing',f=>[f.frames[1],f.frames[2]]=[f.frames[2],f.frames[1]],'decreasing_timestamp'],
 ['negative',f=>f.frames[0].timestampMs=-1,'invalid_timestamp'],
 ['fractional',f=>f.frames[0].timestampMs=.5,'invalid_timestamp'],
 ['duration boundary',f=>f.frames[99].timestampMs=10000,'invalid_timestamp'],
 ['missing timestamp',f=>delete f.frames[1].timestampMs,'invalid_timestamp'],
 ['null frame',f=>f.frames[1]=null,'invalid_frame'],
 ['missing landmark',f=>f.frames[1].landmarks.pop(),'invalid_landmarks'],
 ['null landmark',f=>f.frames[1].landmarks[0]=null,'invalid_landmark_record'],
 ['wrong index',f=>f.frames[1].landmarks[0].index=1,'invalid_landmark_record'],
 ['missing confidence',f=>delete f.frames[1].landmarks[0].presence,'invalid_landmark_record'],
 ['string coordinate',f=>f.frames[1].landmarks[0].x='0','invalid_landmark_record'],
 ['nonfinite coordinate serializes null',f=>f.frames[1].landmarks[0].x=Infinity,'invalid_landmark_record'],
 ['confidence outside range',f=>f.frames[1].landmarks[0].visibility=1.1,'invalid_landmark_confidence'],
])test(label,()=>{const f=fixture();edit(f);const r=run(request(f));assert.equal(r.status,'incompatible');assert.deepEqual(r.reasons,[reason]);assert.equal(r.analysis,null);});
for(const name of ['session','frames'])test(`${name} load failure is not processing failure`,()=>{
 const q=request(fixture());q[`${name}Read`]={sessionId:q.selectedSessionId,status:'failed',reason:'synthetic IO failure'};
 const r=run(q);assert.equal(r.status,'load-failed');assert.deepEqual(r.reasons,[`${name}_load_failed`]);
 assert.equal(r.detail,'synthetic IO failure');assert.equal(r.analysis,null);
});
for(const [label,edit,reason] of [
 ['missing frames envelope',q=>delete q.framesRead,'invalid_frames_read'],
 ['bad session JSON',q=>q.sessionRead.payload='{','invalid_session'],
 ['bad frames JSON',q=>q.framesRead.payload='{','malformed_frames_json'],
 ['nonarray frames',q=>q.framesRead.payload='{}','invalid_frames'],
 ['too many frames',q=>q.framesRead.payload=JSON.stringify(Array(161).fill(null)),'invalid_frames'],
 ['oversize frames',q=>q.framesRead.payload=' '.repeat(SAVED_PAYLOAD_LIMITS.frameText+1),'frames_payload_too_large'],
 ['oversize session',q=>q.sessionRead.payload=' '.repeat(SAVED_PAYLOAD_LIMITS.sessionText+1),'session_payload_too_large'],
 ['invalid direction',q=>q.setup.direction=0,'invalid_setup'],
 ['invalid upright',q=>q.setup.upright='true','invalid_setup'],
 ['invalid continuity',q=>q.setup.continuity='assumed','invalid_setup'],
 ['invalid owner',q=>q.setup.participantId='bad id','invalid_setup'],
])test(label,()=>{const q=request(fixture());edit(q);assert.deepEqual(run(q).reasons,[reason]);});
for(const geometry of [undefined,null,{}, {inferenceWidth:0,inferenceHeight:432},
 {inferenceWidth:768,inferenceHeight:432,source:'diagnostics'}])test(`missing/invalid explicit geometry ${JSON.stringify(geometry)}`,()=>{
 const f=fixture();f.setup.geometry=geometry;const r=run(request(f));
 assert.equal(r.status,'partial');assert.equal(r.analysis.components.knee.status,'unavailable');
 assert.ok(r.analysis.components.knee.reasons.includes('missing_geometry'));
 assert.equal(r.analysis.components.motion.status,'available');assert.equal(r.analysis.components.intervals.status,'available');
});
test('explicit geometry works without diagnostics and overrides conflicting text',()=>{
 const f=fixture();delete f.session.diagnostics;const a=run(request(f)).analysis;
 f.session.diagnostics='decoded=1x999';const b=run(request(f)).analysis;
 assert.deepEqual(a.components,b.components);assert.equal(b.components.knee.result.geometry.aspectRatio,768/432);
});
for(const [key,value,reason] of [['direction',undefined,'direction_required'],['upright',undefined,'upright_required'],['upright',false,'upright_required']])
 test(`missing assertion ${key} ${value}`,()=>{
  const f=fixture();f.setup[key]=value;const a=run(request(f)).analysis;
  assert.equal(a.components.knee.status,'available');assert.deepEqual(a.components.motion.reasons,[reason]);assert.equal(a.components.intervals.status,'unavailable');
 });
test('absent setup preserves unavailable components and unknown ownership/continuity',()=>{
 const q=request(fixture());delete q.setup;const r=run(q);assert.equal(r.status,'unavailable');
 assert.equal(r.analysis.context.participantId,null);assert.equal(r.analysis.context.attemptId,null);
 assert.equal(r.analysis.context.continuity,'unknown');assert.equal(r.analysis.components.knee.result.geometry,null);
});
test('no continuity assertion blocks only intervals',()=>{
 const f=fixture();delete f.setup.continuity;const a=run(request(f)).analysis;
 assert.equal(a.components.motion.status,'available');assert.equal(a.components.knee.status,'available');assert.equal(a.components.intervals.status,'unavailable');
});
for(const id of ['id with spaces','পরীক্ষা','x'.repeat(129)])test(`incompatible interval ID ${id.length}`,()=>{
 const f=fixture();f.session.id=id;const a=run(request(f)).analysis;
 assert.equal(a.session.id,id);assert.equal(a.components.knee.status,'available');assert.equal(a.components.motion.status,'available');
 assert.deepEqual(a.components.intervals.reasons,['interval_session_id_incompatible']);
});
test('extraction omissions, quality masks, exclusions and provenance survive unchanged',()=>{
 const f=fixture();f.frames.splice(12,1);f.session.poseFrames=99;f.frames[20].landmarks[23].presence=.2;
 f.frames[40].landmarks[27].x=1.1;f.setup.participantId='synthetic-person';f.setup.attemptId='synthetic-attempt';
 const r=run(request(f)),a=r.analysis;
 const direct=analyzeSavedSession({session:f.session,frames:f.frames,geometry:f.setup.geometry,
 context:{sessionId:f.session.id,view:f.session.view,side:'left',...f.setup},processing:{status:'completed',reason:null}});
 assert.deepEqual(a.components,direct.components);assert.equal(r.counts.omittedAtExtraction,1);
 assert.equal(a.components.motion.result.observations[20].value,null);
 assert.ok(a.components.motion.result.exclusions.length>0);assert.ok(a.components.intervals.reasons.includes('segment_mismatch'));
 assert.equal(a.components.intervals.result.timestampProvenance.actualDecodedFrameTimes,false);
 assert.equal(a.components.motion.result.timestampProvenance.method,f.session.timestampMethod);
 assert.equal(a.session.modelSha256,f.session.modelSha256);assert.equal(a.session.extractorVersion,f.session.extractorVersion);
 assert.equal(a.evidence.actualFramePts,'not-available');assert.equal(a.evidence.exactImageCorrespondence,'not-established');
 assert.equal(a.scientificStatus,'NOT_EVALUATED');assert.equal(a.context.participantId,'synthetic-person');
});
test('flat motion is a successful read with insufficient evidence',()=>{
 const f=fixture();f.frames.forEach(x=>x.landmarks[27].x=.5);const r=run(request(f));
 assert.equal(r.analysis.processing.status,'completed');assert.equal(r.analysis.components.motion.status,'insufficient_evidence');
});
test('malformed root never throws',()=>{for(const q of [null,undefined,[],{},1])assert.equal(run(q).status,'incompatible');});

test('explicit inference aspect controls projected geometry without diagnostic parsing',()=>{
 const f=fixture();f.setup.geometry.inferenceWidth=200;f.setup.geometry.inferenceHeight=100;
 for(const frame of f.frames){
  Object.assign(frame.landmarks[23],{x:.4,y:.3});
  Object.assign(frame.landmarks[25],{x:.5,y:.5});
  Object.assign(frame.landmarks[27],{x:.6,y:.3});
 }
 // Pixel vectors (-20,-20), (20,-20) are orthogonal: 90-degree flexion.
 const a=run(request(f)).analysis;
 assert.ok(Math.abs(a.components.knee.result.observations[0].value-90)<1e-12);
 assert.equal(a.components.knee.result.geometry.aspectRatio,2);
});

test('irregular requested times remain visible and are never presented as actual PTS',()=>{
 const f=fixture();f.frames[1].timestampMs=101;const a=run(request(f)).analysis;
 assert.equal(a.components.motion.result.observations[1].timestampMs,101);
 assert.ok(a.components.motion.reasons.includes('irregular_sampling'));
 assert.equal(a.components.motion.result.timestampProvenance.actualDecodedFrameTimes,false);
});
