import test from 'node:test';
import assert from 'node:assert/strict';
import {createSavedSessionLoader, SUMMARY_LIST_LIMIT} from '../src/offline/saved-session-loader.ts';
function fixture(id='A') {
 const session={id,createdAt:1,durationMs:10000,sampledFrames:100,poseFrames:100,
  usableFrameRatio:1,landmarkCount:33,view:'side_left',rawVideoRetained:false,modelSha256:'a'.repeat(64),
  extractorVersion:'android-pose-0.1.1',timestampMethod:'requested-100ms-nearest-decoded-frame',
  consentVersion:'local-prototype-notice-v1',diagnostics:'decoded=1920x1080'};
 const frames=Array.from({length:100},(_,n)=>({timestampMs:n*100,
  landmarks:Array.from({length:33},(_,index)=>({index,x:index===27?.5+[-.1,-.07,0,.07,.1,.07,0,-.07][n%8]:.5,
   y:index===23?.3:index===25?.5:index===27?.7:.5,z:0,visibility:.9,presence:.9}))}));
 const setup={geometry:{inferenceWidth:768,inferenceHeight:432,source:'caller-asserted-inference-dimensions',
  assumption:'constant-inference-dimensions-within-session'},direction:1,upright:true,continuity:'detector-segments'};
 return {session,frames,setup};
}
function deferred() {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function controlled() {
 const summaries=[],frames=[];
 const loader=createSavedSessionLoader({listSessions(){const d=deferred();summaries.push(d);return d.promise;},
  readFrames(id){const d=deferred();frames.push({id,...d});return d.promise;}});
 return {loader,summaries,frames};
}
async function metadata(c,index,id) {c.summaries[index].resolve(JSON.stringify([fixture(id).session]));await Promise.resolve();}
function ready(c,id) {const s=c.loader.getState();assert.equal(s.status,'ready');assert.equal(s.selectedSessionId,id);
 assert.equal(s.result.analysis.session.id,id);assert.equal(s.result.binding.framesReadId,id);return s;}
async function complete(c,index,id,promise) {await metadata(c,index,id);c.frames.at(-1).resolve(JSON.stringify(fixture(id).frames));await promise;return ready(c,id);}
function immediate(f=fixture(), overrides={}) {return createSavedSessionLoader({listSessions:async()=>JSON.stringify([f.session]),
 readFrames:async()=>JSON.stringify(f.frames),...overrides});}

test('successful selection publishes loading then ready with caller-bound result',async()=>{
 const c=controlled(),f=fixture();assert.equal(c.loader.getState().status,'unavailable');
 const p=c.loader.select('A',f.setup);assert.equal(c.loader.getState().status,'loading');
 await metadata(c,0,'A');assert.deepEqual(c.frames.map(x=>x.id),['A']);assert.equal(c.loader.getState().status,'loading');
 c.frames[0].resolve(JSON.stringify(f.frames));assert.equal(await p,undefined);const s=ready(c,'A');
 assert.equal(s.result.binding.verification,'caller-bound-ids-only');assert.equal(s.result.analysis.scientificStatus,'NOT_EVALUATED');
});
for(const stage of ['summary','frames'])test(`${stage} rejection retains explicit adapter failure`,async()=>{
 const c=controlled(),p=c.loader.select('A',fixture().setup);
 if(stage==='frames'){await metadata(c,0,'A');c.frames[0].reject(new Error('read failed'));}
 else c.summaries[0].reject(new Error('read failed'));
 await p;const s=c.loader.getState();assert.equal(s.status,'failed');assert.equal(s.result.status,'load-failed');
 assert.deepEqual(s.reasons,[stage==='summary'?'session_load_failed':'frames_load_failed']);assert.equal(s.result.detail,'read failed');
 if(stage==='summary')assert.equal(c.frames.length,0);
});
for(const [label,raw,reason] of [['malformed JSON','{','invalid_summary_list'],['nonarray','{}','invalid_summary_list'],
 ['null row','[null]','invalid_summary_list'],['oversize text',' '.repeat(SUMMARY_LIST_LIMIT+1),'invalid_summary_list'],
 ['too many rows',JSON.stringify(Array(101).fill({id:'A'})),'invalid_summary_list'],
 ['duplicate selected ID',JSON.stringify([fixture().session,fixture().session]),'ambiguous_session_summary']])
 test(label,async()=>{const l=immediate(fixture(),{listSessions:async()=>raw,readFrames:()=>{throw Error('must not read');}});
 await l.select('A');assert.equal(l.getState().status,'failed');assert.deepEqual(l.getState().reasons,[reason]);});
test('missing selection in limited native list is unavailable, not proof of deletion',async()=>{
 const l=immediate(fixture('B'));await l.select('A');assert.equal(l.getState().status,'unavailable');
 assert.deepEqual(l.getState().reasons,['session_not_in_loaded_list']);assert.equal(l.getState().result,null);
});
for(const [label,change,reason] of [['invalid summary',f=>delete f.session.durationMs,'invalid_session'],
 ['count mismatch',f=>f.frames.pop(),'frame_count_mismatch'],['invalid landmark',f=>f.frames[0].landmarks.pop(),'invalid_landmarks']])
 test(label,async()=>{const f=fixture();change(f);const l=immediate(f);await l.select('A',f.setup);
 assert.equal(l.getState().status,'failed');assert.deepEqual(l.getState().result.reasons,[reason]);});
test('malformed frame JSON is delegated to adapter',async()=>{
 const l=immediate(fixture(),{readFrames:async()=>'{'});await l.select('A');assert.equal(l.getState().status,'failed');
 assert.deepEqual(l.getState().reasons,['malformed_frames_json']);
});
test('A summary completing after B ready cannot publish or start frame read',async()=>{
 const c=controlled(),a=c.loader.select('A',fixture().setup),b=c.loader.select('B',fixture().setup);
 const state=await complete(c,1,'B',b);await metadata(c,0,'A');await a;
 assert.equal(c.loader.getState(),state);assert.deepEqual(c.frames.map(x=>x.id),['B']);
});
test('A frames completing after B ready cannot replace B',async()=>{
 const c=controlled(),a=c.loader.select('A',fixture().setup);await metadata(c,0,'A');
 const b=c.loader.select('B',fixture().setup),state=await complete(c,1,'B',b);
 c.frames[0].resolve(JSON.stringify(fixture('A').frames));await a;assert.equal(c.loader.getState(),state);ready(c,'B');
});
test('A completing while B loads cannot replace B loading state',async()=>{
 const c=controlled(),a=c.loader.select('A',fixture().setup);await metadata(c,0,'A');const b=c.loader.select('B',fixture().setup);
 const state=c.loader.getState();c.frames[0].resolve(JSON.stringify(fixture().frames));await a;assert.equal(c.loader.getState(),state);
 await complete(c,1,'B',b);
});
test('same-ID reselection uses generation, not ID equality',async()=>{
 const c=controlled(),a=c.loader.select('A',fixture().setup);await metadata(c,0,'A');
 const b=c.loader.select('A',fixture().setup),state=await complete(c,1,'A',b);assert.equal(state.generation,2);
 c.frames[0].resolve('[]');await a;assert.equal(c.loader.getState(),state);ready(c,'A');
});
test('rapid A B C selections publish only C despite reverse summary completion',async()=>{
 const c=controlled(),a=c.loader.select('A'),b=c.loader.select('B'),p=c.loader.select('C',fixture().setup);
 const state=await complete(c,2,'C',p);await metadata(c,1,'B');await metadata(c,0,'A');await Promise.all([a,b]);
 assert.equal(c.loader.getState(),state);assert.equal(c.frames.length,1);
});
for(const stage of ['summary','frames'])test(`obsolete ${stage} rejection after newer success is ignored`,async()=>{
 const c=controlled(),a=c.loader.select('A',fixture().setup);if(stage==='frames')await metadata(c,0,'A');
 const b=c.loader.select('B',fixture().setup),state=await complete(c,1,'B',b);
 (stage==='frames'?c.frames[0]:c.summaries[0]).reject(Error('obsolete failure'));await a;assert.equal(c.loader.getState(),state);
});
for(const action of ['clear','invalidate','dispose'])for(const stage of ['summary','frames'])
 test(`${action} during ${stage} load invalidates pending publication`,async()=>{
 const c=controlled(),p=c.loader.select('A',fixture().setup);if(stage==='frames')await metadata(c,0,'A');
 c.loader[action]();const state=c.loader.getState();assert.equal(state.status,'unavailable');assert.equal(state.selectedSessionId,null);
 assert.deepEqual(state.reasons,[action==='clear'?'no_selection':action==='dispose'?'disposed':'invalidated']);
 if(stage==='frames')c.frames[0].resolve(JSON.stringify(fixture().frames));else await metadata(c,0,'A');
 await p;assert.equal(c.loader.getState(),state);
 if(action==='dispose'){await c.loader.select('B');c.loader.clear();c.loader.invalidate();c.loader.dispose();assert.equal(c.loader.getState(),state);}
 else {const q=c.loader.select('B',fixture().setup);await complete(c,1,'B',q);}
});
test('setup is captured before async reads, including geometry and ownership',async()=>{
 const c=controlled(),f=fixture();f.setup.participantId='person';f.setup.attemptId='attempt';
 const p=c.loader.select('A',f.setup);f.setup.geometry.inferenceWidth=1;f.setup.direction=-1;f.setup.participantId='changed';
 const s=await complete(c,0,'A',p),a=s.result.analysis;
 assert.equal(a.components.knee.result.geometry.inferenceWidth,768);assert.equal(a.context.direction,1);
 assert.equal(a.context.participantId,'person');assert.equal(a.context.attemptId,'attempt');
});
test('missing geometry gives ready partial analysis despite diagnostic geometry',async()=>{
 const f=fixture();delete f.setup.geometry;const l=immediate(f);await l.select('A',f.setup);const s=l.getState();
 assert.equal(s.status,'ready');assert.equal(s.result.status,'partial');assert.equal(s.result.analysis.components.knee.status,'unavailable');
 assert.equal(s.result.analysis.components.motion.status,'available');assert.equal(s.result.analysis.components.knee.result.geometry,null);
});
test('missing setup stays analytically unavailable with no invented assertions',async()=>{
 const l=immediate();await l.select('A');const s=l.getState();assert.equal(s.status,'unavailable');assert.ok(s.result.analysis);
 assert.equal(s.result.analysis.context.participantId,null);assert.equal(s.result.analysis.context.direction,null);
 assert.equal(s.result.analysis.context.upright,false);
});
test('requested clock, quality exclusions and evidence limits survive coordinator',async()=>{
 const f=fixture();f.frames[20].landmarks[23].presence=.2;const l=immediate(f);await l.select('A',f.setup);
 const a=l.getState().result.analysis;assert.equal(a.components.motion.result.observations[20].value,null);
 assert.ok(a.components.motion.result.exclusions.length);assert.equal(a.components.motion.result.observations[1].timestampMs,100);
 assert.equal(a.components.motion.result.timestampProvenance.method,f.session.timestampMethod);
 assert.equal(a.components.intervals.result.timestampProvenance.actualDecodedFrameTimes,false);
 assert.equal(a.evidence.actualFramePts,'not-available');assert.equal(a.evidence.exactImageCorrespondence,'not-established');
});
test('synchronous native throws and non-Error rejection are handled',async()=>{
 const l=immediate(fixture(),{listSessions(){throw null;}});await l.select('A');assert.equal(l.getState().status,'failed');
 assert.equal(l.getState().result.detail,'native_read_rejected');
});
test('invalid selection makes no native calls',async()=>{
 const c=controlled();await c.loader.select('');assert.equal(c.loader.getState().status,'failed');assert.equal(c.summaries.length,0);
});

test('excessively nested summary fails explicitly instead of leaving loading pending',async()=>{
 const raw='[{"id":"A","extra":'+'['.repeat(20000)+'0'+']'.repeat(20000)+'}]';
 const l=immediate(fixture(),{listSessions:async()=>raw,readFrames:()=>{throw Error('must not read');}});
 await l.select('A');assert.equal(l.getState().status,'failed');assert.deepEqual(l.getState().reasons,['invalid_session_summary']);
});
