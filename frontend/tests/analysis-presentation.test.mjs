import test from 'node:test';
import assert from 'node:assert/strict';
import {presentSavedAnalysis as present} from '../src/offline/analysis-presentation.ts';
import {createSavedSessionLoader} from '../src/offline/saved-session-loader.ts';
import {analyzeSavedSession} from '../src/offline/session-analysis.ts';
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
function loader(f=fixture(),overrides={}) {return createSavedSessionLoader({listSessions:async()=>JSON.stringify([f.session]),
 readFrames:async()=>JSON.stringify(f.frames),...overrides});}
async function loaded(f=fixture(),overrides={}) {const l=loader(f,overrides);await l.select(f.session.id,f.setup);return l;}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function racing(){const reads=[];const l=loader(fixture(),{listSessions:async()=>JSON.stringify([fixture('A').session,fixture('B').session]),
 readFrames(id){const d=deferred();reads.push({id,...d});return d.promise;}});return {l,reads};}

test('initial state is unselected with no component measurements or assessed setup',()=>{
 const p=present(loader().getState());assert.equal(p.status,'unselected');assert.equal(p.dataStatus,'not-loaded');
 assert.equal(p.selection.sessionId,null);assert.equal(p.components.knee.status,'not-analyzed');
 assert.equal(p.components.knee.details,null);assert.equal(p.setup.geometry.status,'not-assessed');
});
test('loading presents current identity and no stale output',async()=>{
 const c=racing(),a=c.l.select('A',fixture().setup);await Promise.resolve();
 const p=present(c.l.getState());assert.equal(p.status,'loading');assert.equal(p.selection.sessionId,'A');
 assert.equal(p.dataStatus,'loading');assert.equal(p.components.motion.details,null);
 c.reads[0].resolve(JSON.stringify(fixture().frames));await a;
});
test('fully calculated result has independent expected angle, candidate times and intervals',async()=>{
 const p=present((await loaded()).getState());assert.equal(p.status,'calculated');assert.equal(p.dataStatus,'loaded');
 assert.equal(p.components.knee.status,'available');assert.equal(p.components.knee.details.observations[2].value,0);
 assert.deepEqual(p.components.motion.details.candidates.filter(c=>c.kind==='maximum').map(c=>c.timestampMs),
  Array.from({length:12},(_,k)=>400+800*k));
 assert.equal(p.components.intervals.details.polarities[0].summary.count,11);
 assert.equal(p.components.intervals.details.polarities[0].intervals[0].elapsedMs,800);
});
test('missing geometry retains partial state, null knee values and supported motion',async()=>{
 const f=fixture();delete f.setup.geometry;const p=present((await loaded(f)).getState());
 assert.equal(p.status,'partial');assert.equal(p.components.knee.status,'unavailable');
 assert.ok(p.components.knee.reasons.includes('missing_geometry'));assert.equal(p.components.knee.details.observations[2].value,null);
 assert.equal(p.components.motion.status,'available');assert.equal(p.setup.geometry.status,'required');assert.equal(p.setup.geometry.value,null);
});
for(const key of ['direction','upright'])test(`missing ${key} is explicit, knee remains available`,async()=>{
 const f=fixture();delete f.setup[key];const p=present((await loaded(f)).getState());
 assert.equal(p.status,'partial');assert.equal(p.setup[key].status,'required');assert.equal(p.components.knee.status,'available');
 assert.equal(p.components.motion.status,'unavailable');assert.ok(p.components.motion.reasons.includes(`${key}_required`));
 assert.equal(p.components.intervals.status,'unavailable');
});
test('both motion prerequisites remain explicit despite detector early return',async()=>{
 const f=fixture();delete f.setup.direction;delete f.setup.upright;const p=present((await loaded(f)).getState());
 assert.equal(p.setup.direction.status,'required');assert.equal(p.setup.upright.status,'required');
});
test('missing all setup is loaded-but-unavailable, not a read failure',async()=>{
 const f=fixture();delete f.setup;const p=present((await loaded(f)).getState());assert.equal(p.status,'unavailable');
 assert.equal(p.dataStatus,'loaded');assert.equal(p.failureDetail,null);assert.equal(p.components.motion.status,'unavailable');
 assert.equal(p.setup.ownership.participantId,null);assert.equal(p.setup.ownership.attemptId,null);
});
for(const method of ['listSessions','readFrames'])test(`${method} failure is a read failure, not unavailable analysis`,async()=>{
 const p=present((await loaded(fixture(),{[method]:async()=>{throw Error('synthetic read failure');}})).getState());
 assert.equal(p.status,'load-failed');assert.equal(p.dataStatus,'failed');assert.equal(p.failureDetail,'synthetic read failure');
 assert.equal(p.components.knee.status,'not-analyzed');assert.equal(p.analysisStatus,null);
});
for(const method of ['listSessions','readFrames'])test(`malformed ${method} is rejected data`,async()=>{
 const p=present((await loaded(fixture(),{[method]:async()=>'{'})).getState());
 assert.equal(p.status,'invalid-data');assert.equal(p.dataStatus,'rejected');assert.equal(p.components.motion.details,null);
});
test('count discrepancy remains a rejected payload with its reason',async()=>{
 const f=fixture();f.frames.pop();const p=present((await loaded(f)).getState());
 assert.equal(p.status,'invalid-data');assert.deepEqual(p.reasons,['frame_count_mismatch']);
});
test('missing ID in native list never claims global nonexistence',async()=>{
 const l=loader();await l.select('outside-list');const p=present(l.getState());assert.equal(p.status,'unavailable');
 assert.equal(p.dataStatus,'not-loaded');assert.deepEqual(p.reasons,['session_not_in_loaded_list']);
 assert.ok(p.limitations.includes('summary-list-limited-to-100-not-a-database-existence-check'));
});
test('processing failure from real wrapper remains distinct from read rejection',async()=>{
 const f=fixture(),state=(await loaded(f)).getState();
 const failed=analyzeSavedSession({session:f.session,frames:f.frames,geometry:f.setup.geometry,
  context:{sessionId:'A',participantId:null,attemptId:null,view:'side_left',side:'left',direction:1,upright:true,continuity:'unknown'},
  processing:{status:'failed',reason:'synthetic processing failure'}});
 // The current native loader persists successes only; exercise the wrapper failure branch explicitly.
 const p=present({...state,status:'failed',result:{...state.result,status:'failed',analysis:failed,detail:null}});
 assert.equal(p.status,'processing-failed');assert.equal(p.failureDetail,'synthetic processing failure');
 assert.equal(p.components.knee.status,'unavailable');assert.equal(p.components.knee.details,null);
});
for(const same of [false,true])test(`${same?'same-ID reselection':'A to B'} late old success cannot change presentation`,async()=>{
 const c=racing(),setup=fixture().setup,a=c.l.select('A',setup);await Promise.resolve();
 const id=same?'A':'B',b=c.l.select(id,setup);await Promise.resolve();
 assert.equal(present(c.l.getState()).selection.generation,2);
 c.reads[1].resolve(JSON.stringify(fixture(id).frames));await b;
 const before=present(c.l.getState());assert.equal(before.selection.sessionId,id);assert.equal(before.status,'calculated');
 c.reads[0].resolve('[]');await a;assert.deepEqual(present(c.l.getState()),before);
});
test('obsolete error cannot replace newer calculated presentation',async()=>{
 const c=racing(),a=c.l.select('A',fixture().setup);await Promise.resolve();const b=c.l.select('B',fixture().setup);await Promise.resolve();
 c.reads[1].resolve(JSON.stringify(fixture().frames));await b;c.reads[0].reject(Error('obsolete'));await a;
 const p=present(c.l.getState());assert.equal(p.status,'calculated');assert.equal(p.selection.sessionId,'B');assert.equal(p.failureDetail,null);
});
for(const action of ['clear','invalidate','dispose'])test(`${action} during load removes presentation and ignores old completion`,async()=>{
 const c=racing(),a=c.l.select('A',fixture().setup);await Promise.resolve();c.l[action]();const p=present(c.l.getState());
 assert.equal(p.status,action==='clear'?'unselected':'unavailable');assert.equal(p.selection.sessionId,null);
 assert.equal(p.components.knee.details,null);c.reads[0].resolve(JSON.stringify(fixture().frames));await a;
 assert.deepEqual(present(c.l.getState()),p);
});
test('quality exclusions and nulls remain visible rather than becoming zero',async()=>{
 const f=fixture();f.frames[20].landmarks[23].presence=.2;const p=present((await loaded(f)).getState());
 assert.equal(p.status,'partial');assert.equal(p.components.knee.details.observations[20].value,null);
 assert.equal(p.components.motion.details.observations[20].value,null);
 assert.ok(p.components.motion.details.observations[20].reasons.includes('low_presence'));
 assert.ok(p.components.motion.details.exclusions.some(e=>e.observationIndex===0&&e.reason==='boundary_support'));
 const rejected=p.components.intervals.details.polarities.flatMap(x=>x.intervals).filter(x=>x.reasons.includes('segment_mismatch'));
 assert.ok(rejected.length);assert.ok(rejected.every(x=>x.elapsedMs===null));
});
test('empty interval summaries keep null mean and insufficient-evidence status',async()=>{
 const f=fixture();f.frames.forEach(x=>x.landmarks[27].x=.5);const p=present((await loaded(f)).getState());
 assert.equal(p.status,'partial');assert.equal(p.components.motion.status,'insufficient_evidence');
 assert.equal(p.components.intervals.status,'unavailable');assert.equal(p.components.intervals.details.polarities[0].summary.meanMs,null);
 assert.equal(p.components.intervals.details.polarities[0].summary.count,0);
});
test('versions and requested-clock provenance are preserved; evidence remains unavailable',async()=>{
 const p=present((await loaded()).getState());assert.equal(p.contractVersion,'saved-analysis-presentation-2');
 assert.equal(p.provenance.adapterVersion,'saved-payload-analysis-2');assert.equal(p.provenance.analysisVersion,'session-analysis-2');
 assert.equal(p.components.knee.details.algorithmVersion,'projected-knee-1');assert.equal(p.components.motion.details.algorithmVersion,'ankle-motion-extrema-1');
 assert.equal(p.components.intervals.details.algorithmVersion,'candidate-motion-interval-1');
 assert.equal(p.provenance.extractorVersion,'android-pose-0.1.1');assert.equal(p.provenance.modelSha256,'a'.repeat(64));
 assert.equal(p.provenance.timestampMethod,'requested-100ms-nearest-decoded-frame');
 assert.equal(p.components.intervals.details.timestampProvenance.actualDecodedFrameTimes,false);
 assert.equal(p.provenance.actualDecodedFramePts,'not-available');assert.equal(p.provenance.exactImageCorrespondence,'not-established');
 assert.equal(p.provenance.frameOwnership,'not-independently-authenticated');assert.equal(p.provenance.binding.verification,'caller-bound-ids-only');
 assert.equal(p.scientificStatus,'NOT_EVALUATED');
});
test('explicit setup values and requested versus used continuity remain separate',async()=>{
 const f=fixture();f.setup.participantId='synthetic-person';const p=present((await loaded(f)).getState());
 assert.equal(p.setup.geometry.value.inferenceWidth,768);assert.equal(p.setup.direction.value,1);assert.equal(p.setup.upright.value,true);
 assert.equal(p.setup.continuity.status,'requested');assert.equal(p.setup.continuity.used,'detector-segments');
 assert.equal(p.setup.ownership.participantId,'synthetic-person');assert.equal(p.setup.ownership.attemptId,null);
});
test('deterministic frozen detached presentation does not mutate loader state',async()=>{
 const state=(await loaded()).getState(),before=structuredClone(state),a=present(state),b=present(state);
 assert.deepEqual(a,b);assert.deepEqual(state,before);assert.ok(Object.isFrozen(a));assert.ok(Object.isFrozen(a.components.knee.details.observations));
 assert.throws(()=>{a.components.knee.details.observations[2].value=99;},TypeError);
 state.result.analysis.components.knee.result.observations[2].value=99;assert.equal(a.components.knee.details.observations[2].value,0);
});
test('safe labels do not name confirmed contacts, clinical decisions or validated gait times',async()=>{
 const p=present((await loaded()).getState());assert.equal(p.components.knee.label,'Projected 2D knee flexion');
 assert.equal(p.components.motion.label,'Candidate ankle-motion extrema');assert.equal(p.components.intervals.label,'Candidate-to-candidate temporal intervals');
 const labels=[p.label,...Object.values(p.components).map(c=>c.label)].join(' ');
 assert.doesNotMatch(labels,/heel strike|step time|stride time|fall.risk|diagnosis|normal gait/i);
 assert.equal(p.scientificStatus,'NOT_EVALUATED');assert.equal(JSON.stringify(p).includes('decoded=1920x1080'),false);
});
