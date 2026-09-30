import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSession, parseFrames} from '../src/offline/contract.ts';
import {analyzeSavedSession as run} from '../src/offline/session-analysis.ts';

// Synthetic JSON shaped like listSessions/readFrames; no database or private data.
function fixture() {
 const id='12345678-1234-4234-8234-123456789abc';
 const session=parseSession(JSON.stringify({id,createdAt:1,durationMs:10000,sampledFrames:100,
  poseFrames:100,usableFrameRatio:1,landmarkCount:33,view:'side_left',rawVideoRetained:false,
  modelSha256:'a'.repeat(64),extractorVersion:'android-pose-0.1.1',
  timestampMethod:'requested-100ms-nearest-decoded-frame',consentVersion:'local-prototype-notice-v1',
  diagnostics:'encoded=1080x1920;rotation=90;decoded=1920x1080'}));
 const frames=parseFrames(JSON.stringify(Array.from({length:100},(_,n)=>({timestampMs:n*100,
  landmarks:Array.from({length:33},(_,index)=>({index,
   x:index===27?.5+[-.1,-.07,0,.07,.1,.07,0,-.07][n%8]:.5,
   y:index===23?.3:index===25?.5:index===27?.7:.5,z:0,visibility:.9,presence:.9}))}))));
 return {session,frames,context:{sessionId:id,participantId:null,attemptId:null,view:'side_left',
  side:'left',direction:1,upright:true,continuity:'detector-segments'},processing:{status:'completed',reason:null}};
}
test('UUID saved JSON: independently enumerated extrema, geometry and intervals',()=>{
 const f=fixture(),r=run(f);
 assert.equal(r.status,'available');assert.equal(r.components.knee.result.observations[2].value,0);
 // Maxima 400+800k (k=0..11); minima 800+800k (k=0..11), all have 200ms support.
 const maxima=Array.from({length:12},(_,k)=>400+800*k);
 const minima=Array.from({length:12},(_,k)=>800+800*k);
 for(const [kind,times] of [['maximum',maxima],['minimum',minima]]){
  assert.deepEqual(r.components.motion.result.candidates.filter(c=>c.kind===kind).map(c=>c.timestampMs),times);
 }
 const p=r.components.intervals.result.polarities[0];
 assert.equal(p.summary.count,11);
 assert.deepEqual(p.intervals.map(i=>i.elapsedMs),Array(11).fill(800));
 assert.deepEqual(p.intervals.map(i=>[i.start.timestampMs,i.end.timestampMs]),
  Array.from({length:11},(_,k)=>[400+800*k,1200+800*k]));
 assert.ok(Math.abs(p.summary.meanMs-800)<1e-12);
 assert.equal(r.components.knee.result.geometry.inferenceWidth,768);
 assert.equal(r.components.knee.result.geometry.inferenceHeight,432);
 assert.equal(r.context.participantId,null);assert.equal(r.context.attemptId,null);
});
for(const [label,edit,reason] of [
 ['missing ID',f=>delete f.session.id,'invalid_session'],
 ['unsupported view',f=>f.session.view='front','invalid_session'],
 ['contradictory side',f=>f.context.side='right','view_side_mismatch'],
 ['foreign session context',f=>f.context.sessionId='another','session_identity_mismatch'],
 ['missing timestamp method',f=>delete f.session.timestampMethod,'invalid_session'],
 ['actual PTS substituted for requested method',f=>f.session.timestampMethod='actual-pts','invalid_session'],
])test(label,()=>{const f=fixture();edit(f);const r=run(f);assert.equal(r.status,'incompatible');assert.deepEqual(r.reasons,[reason]);});
for(const [label,edit,reason] of [
 ['missing timestamp',f=>delete f.frames[1].timestampMs,'invalid_timestamp'],
 ['negative timestamp',f=>f.frames[0].timestampMs=-1,'invalid_timestamp'],
 ['duplicate timestamp',f=>f.frames[1].timestampMs=0,'duplicate_timestamp'],
 ['decreasing timestamp',f=>f.frames.reverse(),'decreasing_timestamp'],
 ['incomplete landmarks',f=>f.frames[1].landmarks.pop(),'invalid_frames'],
 ['contradictory landmark index',f=>f.frames[1].landmarks[3].index=4,'invalid_frames'],
 ['summary frame count mismatch',f=>f.frames.pop(),'frame_count_mismatch'],
])test(label,()=>{const f=fixture();edit(f);const r=run(f);
 for(const name of ['knee','motion']){assert.equal(r.components[name].status,'unavailable');assert.deepEqual(r.components[name].reasons,[reason]);}
 assert.equal(r.components.intervals.status,'unavailable');
});
for(const diagnostics of [undefined,'decoded=unknown','decoded=1920x1080;decoded=1080x1920'])
 test(`missing/ambiguous geometry: ${diagnostics}`,()=>{const f=fixture();f.session.diagnostics=diagnostics;const r=run(f);
 assert.deepEqual(r.components.knee.reasons,['missing_geometry']);assert.equal(r.components.motion.status,'available');assert.equal(r.status,'partial');});
test('direction and upright are supplied assertions, never reconstructed from view',()=>{
 const f=fixture();delete f.context.direction;let r=run(f);
 assert.deepEqual(r.components.motion.reasons,['direction_required']);assert.equal(r.components.knee.status,'available');
 f.context.direction=1;delete f.context.upright;r=run(f);assert.deepEqual(r.components.motion.reasons,['upright_required']);
});
test('empty stored frames, flat successful computation and explicit failure differ',()=>{
 const f=fixture();f.frames=parseFrames('[]');let r=run(f);
 assert.equal(r.status,'unavailable');assert.deepEqual(r.components.motion.reasons,['no_observations']);
 f.processing={status:'failed',reason:'synthetic read failure'};r=run(f);assert.equal(r.status,'failed');assert.equal(r.components.motion.result,null);
 const flat=fixture();flat.frames.forEach(x=>x.landmarks[27].x=.5);r=run(flat);
 assert.equal(r.processing.status,'completed');assert.equal(r.components.motion.status,'insufficient_evidence');assert.deepEqual(r.components.motion.result.candidates,[]);
});
for(const id of ['id with spaces','পরীক্ষা','x'.repeat(129)])test(`incompatible interval ID preserved (${id.length} code units)`,()=>{
 const f=fixture();f.session.id=f.context.sessionId=id;const r=run(f);
 assert.equal(r.session.id,id);assert.equal(r.context.sessionId,id);assert.equal(r.components.knee.status,'available');
 assert.deepEqual(r.components.intervals.reasons,['interval_session_id_incompatible']);assert.equal(r.components.intervals.result,null);
});
test('requested clock and source provenance survive; extra assertions do not establish PTS/images',()=>{
 const f=fixture();f.frames[0].actualPtsMs=7;f.session.imageHash='b'.repeat(64);const r=run(f);
 assert.equal(r.components.motion.result.observations[0].timestampMs,0);
 assert.equal(r.components.motion.result.timestampProvenance.method,f.session.timestampMethod);
 assert.equal(r.components.intervals.result.timestampProvenance.actualDecodedFrameTimes,false);
 assert.equal(r.evidence.actualFramePts,'not-available');assert.equal(r.evidence.exactImageCorrespondence,'not-established');
 assert.equal(r.evidence.candidateIdentity,'analysis-local-index-not-persistent');assert.equal(r.session.modelSha256,f.session.modelSha256);
 assert.equal(r.scientificStatus,'NOT_EVALUATED');
});
test('omitted saved frame and low confidence remain visible with split continuity',()=>{
 const f=fixture();f.frames.splice(12,1);f.session.poseFrames=99;f.frames[20].landmarks[23].presence=.2;
 const r=run(f);assert.equal(r.components.motion.result.quality.missingCount,1);
 assert.deepEqual(r.components.motion.result.gaps,[{afterMs:1100,beforeMs:1300}]);
 assert.equal(r.components.motion.result.observations[20].value,null);
 assert.ok(r.components.motion.result.observations[20].reasons.includes('low_presence'));
 assert.ok(r.components.intervals.reasons.includes('segment_mismatch'));
 assert.equal(r.components.knee.result.observations[20].value,null);
 assert.deepEqual(run(f),r);
});
