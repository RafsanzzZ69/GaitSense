import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSavedAnalysisBinding, savedAnalysisPanel} from '../src/offline/saved-analysis-binding.ts';
function fixture(id='A') {
 const session={id,createdAt:1,durationMs:10000,sampledFrames:100,poseFrames:100,usableFrameRatio:1,
  landmarkCount:33,view:'side_left',rawVideoRetained:false,modelSha256:'a'.repeat(64),extractorVersion:'android-pose-0.1.1',
  timestampMethod:'requested-100ms-nearest-decoded-frame',consentVersion:'local-prototype-notice-v1',diagnostics:'decoded=1920x1080'};
 const frames=Array.from({length:100},(_,n)=>({timestampMs:n*100,landmarks:Array.from({length:33},(_,index)=>({index,
  x:index===27?.5+[-.1,-.07,0,.07,.1,.07,0,-.07][n%8]:.5,y:index===23?.3:index===25?.5:index===27?.7:.5,z:0,visibility:.9,presence:.9}))}));
 return {session,frames,setup:{geometry:{inferenceWidth:768,inferenceHeight:432,source:'caller-asserted-inference-dimensions',
  assumption:'constant-inference-dimensions-within-session'},direction:1,upright:true,continuity:'detector-segments'}};
}
function harness(f=fixture(),overrides={}) {
 const publications=[],calls=[];
 const history=Object.freeze([Object.freeze(f.session)]);
 const native={listSessions:async()=>{calls.push('list');return JSON.stringify(history);},
  readFrames:async id=>{calls.push(id);return JSON.stringify(f.frames);},
  deleteSession(){assert.fail('analysis must not delete');},deleteAll(){assert.fail('analysis must not delete');},...overrides};
 return {binding:createSavedAnalysisBinding(native,p=>publications.push(p)),publications,calls,history};
}
const text=p=>JSON.stringify(savedAnalysisPanel(p));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function race(){const pending=[];const h=harness(fixture(),{listSessions:async()=>JSON.stringify([fixture('A').session,fixture('B').session]),
 readFrames(id){const d=deferred();pending.push({id,...d});return d.promise;}});return {...h,pending};}

test('screen selection publishes loading and actual selected session using read-only native methods',async()=>{
 const h=harness(),before=JSON.stringify(h.history),p=h.binding.select('A');
 assert.equal(h.publications[0].status,'loading');assert.equal(h.publications[0].selection.sessionId,'A');await p;
 assert.deepEqual(h.calls,['list','A']);assert.equal(h.publications.at(-1).status,'unavailable');
 assert.equal(JSON.stringify(h.history),before);assert.match(text(h.publications.at(-1)),/NOT_EVALUATED/);
});
test('production call without setup exposes all missing requirements despite diagnostics',async()=>{
 const h=harness();await h.binding.select('A');const p=h.publications.at(-1),panel=savedAnalysisPanel(p);
 assert.equal(panel.status,'unavailable');assert.equal(p.dataStatus,'loaded');
 for(const key of ['geometry','direction','upright'])assert.equal(p.setup[key].status,'required');
 assert.match(text(p),/missing geometry/);assert.match(text(p),/direction required/);assert.doesNotMatch(text(p),/decoded=1920x1080/);
});
test('legitimately supplied setup can render partial result without knee geometry',async()=>{
 const f=fixture();delete f.setup.geometry;const h=harness(f);await h.binding.select('A',f.setup);const p=h.publications.at(-1);
 assert.equal(savedAnalysisPanel(p).status,'partial');assert.equal(p.components.motion.status,'available');
 assert.match(text(p),/maximum candidate at 400 ms requested/);assert.match(text(p),/800 milliseconds/);
 assert.match(text(p),/Projected 2D knee flexion · unavailable/);
});
test('null knee values render unavailable, whereas real zero is preserved',async()=>{
 const f=fixture(),h=harness(f);await h.binding.select('A');
 let k=savedAnalysisPanel(h.publications.at(-1)).groups[1];assert.ok(k.lines.includes('200 ms requested: Unavailable; missing geometry'));
 await h.binding.select('A',f.setup);k=savedAnalysisPanel(h.publications.at(-1)).groups[1];
 assert.ok(k.lines.includes('200 ms requested: 0 degrees; none'));
});
for(const method of ['listSessions','readFrames'])test(`${method} failure stays in analysis panel and leaves History unchanged`,async()=>{
 const h=harness(fixture(),{[method]:async()=>{throw Error('synthetic IO failure');}}),before=JSON.stringify(h.history);
 await h.binding.select('A');const p=h.publications.at(-1);assert.equal(p.status,'load-failed');assert.match(text(p),/synthetic IO failure/);
 assert.equal(JSON.stringify(h.history),before);
});
test('invalid frame data is distinctly rejected',async()=>{
 const h=harness(fixture(),{readFrames:async()=>'{'});await h.binding.select('A');const p=h.publications.at(-1);
 assert.equal(p.status,'invalid-data');assert.match(text(p),/malformed frames json/);
});
for(const same of [false,true])test(`screen ${same?'same-ID reselection':'session switch'} ignores stale completion`,async()=>{
 const h=race(),a=h.binding.select('A');await Promise.resolve();const b=h.binding.select(same?'A':'B');await Promise.resolve();
 h.pending[1].resolve(JSON.stringify(fixture().frames));await b;const count=h.publications.length,last=h.publications.at(-1);
 assert.equal(last.selection.generation,2);assert.equal(last.selection.sessionId,same?'A':'B');
 h.pending[0].resolve('[]');await a;assert.equal(h.publications.length,count);assert.equal(h.publications.at(-1),last);
});
for(const action of ['clear','leave'])test(`${action} during loading suppresses pending UI publication`,async()=>{
 const h=race(),p=h.binding.select('A');await Promise.resolve();h.binding[action]();const count=h.publications.length,last=h.publications.at(-1);
 assert.equal(last.selection.sessionId,null);assert.equal(last.status,action==='clear'?'unselected':'unavailable');
 h.pending[0].resolve(JSON.stringify(fixture().frames));await p;assert.equal(h.publications.length,count);
});
test('focus/unmount disposal prevents setState publication even on read rejection',async()=>{
 const h=race(),p=h.binding.select('A');await Promise.resolve();h.binding.dispose();const count=h.publications.length;
 h.pending[0].reject(Error('late read failure'));await p;h.binding.clear();h.binding.leave();await h.binding.select('B');
 assert.equal(h.publications.length,count);assert.equal(h.pending.length,1);
});
test('component reasons and exclusion rows reach the actual panel formatter',async()=>{
 const f=fixture();f.frames[20].landmarks[23].presence=.2;const h=harness(f);await h.binding.select('A',f.setup);
 const p=h.publications.at(-1);assert.equal(p.status,'partial');assert.match(text(p),/2000 ms requested: Unavailable; low presence/);
 assert.match(text(p),/Excluded observation 0: boundary support/);assert.match(text(p),/segment mismatch/);
});
test('evidence and scientific restrictions remain in visible panel copy',async()=>{
 const h=harness();await h.binding.select('A');const t=text(h.publications.at(-1));
 assert.match(t,/NOT_EVALUATED/);assert.match(t,/Actual decoded-frame PTS unavailable/);assert.match(t,/Exact-image correspondence not established/);
 assert.match(t,/not independently authenticated/);assert.match(t,/not validated step or stride times/);
});
test('actual Android route and screen wire tested binding, cleanup and formatter without scientific setup defaults',()=>{
 const capture=readFileSync(new URL('../src/offline/OfflineCapture.tsx',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../src/offline/SavedAnalysisPanel.tsx',import.meta.url),'utf8');
 const history=readFileSync(new URL('../src/app/history.android.tsx',import.meta.url),'utf8');
 assert.match(history,/Redirect href="\/offline"/);assert.match(capture,/useFocusEffect\(useCallback/);
 assert.match(capture,/binding\.dispose\(\)/);assert.match(capture,/analysisBinding\.current\?\.leave\(\)/);
 assert.match(capture,/analysisBinding\.current\?\.select\(s\.id\)/);assert.match(capture,/<SavedAnalysisPanel presentation=\{analysis\}/);
 assert.match(panel,/savedAnalysisPanel\(presentation\)/);assert.doesNotMatch(panel,/Pose\.|deleteSession|deleteAll|fixture/);
});

function persistedFixture(){
 const f=fixture();f.session.analysisMetadata=JSON.parse(readFileSync(new URL('./fixtures/analysis-metadata-v2.json',import.meta.url),'utf8'));
 return f;
}
test('History selection requests and uses freshly checked detector segments with persisted setup',async()=>{
 const f=persistedFixture(),h=harness(f),before=JSON.stringify(f);await h.binding.select('A');const p=h.publications.at(-1);
 assert.equal(p.components.intervals.status,'available');assert.equal(p.setup.continuity.status,'requested');
 assert.equal(p.setup.continuity.requested,'detector-segments');assert.equal(p.setup.continuity.used,'detector-segments');
 assert.equal(p.components.intervals.details.directionSource,'operator-recording-setup');
 assert.deepEqual(p.components.intervals.details.polarities.map(v=>v.summary.count),[11,11]);
 assert.ok(p.components.intervals.details.polarities.every(v=>v.intervals.every(i=>i.elapsedMs===800)));
 assert.equal(p.components.intervals.details.physicalCycleCompleteness,'unknown');
 assert.equal(p.components.intervals.details.timestampProvenance.actualDecodedFrameTimes,false);
 assert.equal(p.provenance.actualDecodedFramePts,'not-available');assert.equal(p.provenance.exactImageCorrespondence,'not-established');
 assert.equal(p.provenance.frameOwnership,'not-independently-authenticated');assert.equal(p.scientificStatus,'NOT_EVALUATED');
 assert.equal(JSON.stringify(f),before);assert.deepEqual(h.calls,['list','A']);
 assert.match(text(p),/800 milliseconds/);assert.match(text(p),/not validated step or stride times/);
});
for(const continuity of ['unknown',undefined])test(`explicit caller setup keeps ${continuity} continuity unavailable`,async()=>{
 const h=harness(persistedFixture());await h.binding.select('A',continuity===undefined?{}:{continuity});const p=h.publications.at(-1);
 assert.equal(p.setup.continuity.used,'unknown');assert.equal(p.components.intervals.status,'unavailable');
 assert.ok(p.components.intervals.reasons.includes('continuity_unknown'));
 assert.ok(p.components.intervals.details.polarities.every(v=>v.summary.meanMs===null));
});
for(const cause of ['omitted-pose','low-confidence'])test(`History ${cause} splits segments and blocks crossing intervals`,async()=>{
 const f=persistedFixture();
 if(cause==='omitted-pose'){f.frames=f.frames.filter(v=>v.timestampMs!==1200);f.session.poseFrames=99;}
 else f.frames[12].landmarks[23].visibility=.1;
 const h=harness(f);await h.binding.select('A');const p=h.publications.at(-1),m=p.components.motion.details,i=p.components.intervals.details;
 assert.equal(p.setup.continuity.used,'detector-segments');assert.equal(m.segments.length,2);
 assert.equal(p.components.intervals.status,'partial');
 assert.ok(i.polarities.every(v=>v.intervals[0].elapsedMs===null&&v.intervals[0].reasons.includes('segment_mismatch')));
 assert.ok(i.polarities.every(v=>v.intervals.slice(1).every(i=>i.elapsedMs===800)));
 if(cause==='omitted-pose'){
  assert.deepEqual(i.gaps,[{afterMs:1100,beforeMs:1300}]);
  assert.ok(i.polarities.every(v=>v.intervals[0].reasons.includes('known_gap')));
 }else {assert.equal(m.observations[12].value,null);assert.ok(m.observations[12].reasons.includes('low_visibility'));}
});
test('History request cannot bypass insufficient extrema or missing historical assertions',async()=>{
 const f=persistedFixture();f.frames.forEach(v=>v.landmarks[27].x=.5);const h=harness(f);await h.binding.select('A');
 let p=h.publications.at(-1);assert.equal(p.components.intervals.status,'unavailable');
 assert.ok(p.components.intervals.details.polarities.every(v=>v.summary.count===0&&v.summary.meanMs===null));
 const old=fixture();old.session.analysisMetadata=JSON.parse(readFileSync(new URL('./fixtures/analysis-metadata-v1.json',import.meta.url),'utf8'));
 const legacy=harness(old);await legacy.binding.select('A');p=legacy.publications.at(-1);
 assert.equal(p.components.knee.status,'available');assert.equal(p.components.motion.status,'unavailable');
 assert.equal(p.components.intervals.status,'unavailable');assert.equal(p.setup.direction.status,'required');assert.equal(p.setup.upright.status,'required');
});
test('explicit caller direction and checked continuity retain caller provenance',async()=>{
 const f=fixture(),h=harness(f);await h.binding.select('A',f.setup);const p=h.publications.at(-1);
 assert.equal(p.components.intervals.status,'available');assert.equal(p.components.intervals.details.directionSource,'caller-asserted');
 assert.equal(p.setup.continuity.used,'detector-segments');
});
test('direction disagreement still blocks motion and intervals while knee survives',async()=>{
 const h=harness(persistedFixture());await h.binding.select('A',{direction:-1,continuity:'detector-segments'});const p=h.publications.at(-1);
 assert.equal(p.components.knee.status,'available');assert.deepEqual(p.components.motion.reasons,['direction_conflict']);
 assert.deepEqual(p.components.intervals.reasons,['motion_setup_unavailable','direction_conflict']);assert.equal(p.components.intervals.details,null);
 assert.equal(p.setup.continuity.used,null);
});
test('History does not pair unlike polarities when only two extrema have support',async()=>{
 const f=persistedFixture();f.frames=f.frames.filter(v=>v.timestampMs>=300&&v.timestampMs<=1700);f.session.poseFrames=f.frames.length;
 const h=harness(f);await h.binding.select('A');const p=h.publications.at(-1);
 assert.deepEqual(p.components.motion.details.candidates.map(c=>c.timestampMs),[800,1200]);
 assert.equal(p.components.intervals.status,'unavailable');
 assert.ok(p.components.intervals.details.polarities.every(v=>v.intervals.length===0&&v.summary.meanMs===null));
});
test('History side selection uses that side signal, never candidates from the other ankle',async()=>{
 const f=persistedFixture();f.session.view='side_right';const h=harness(f);await h.binding.select('A');const p=h.publications.at(-1);
 assert.equal(p.components.motion.details.side,'right');assert.deepEqual(p.components.motion.details.candidates,[]);
 assert.equal(p.components.intervals.status,'unavailable');
});
