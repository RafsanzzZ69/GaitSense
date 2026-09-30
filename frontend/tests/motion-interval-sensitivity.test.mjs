import test from 'node:test';
import assert from 'node:assert/strict';
import {detectMotionCandidates, MOTION_CONFIGURATION} from '../src/offline/motion-candidates.ts';
import {calculateCandidateMotionIntervals} from '../src/offline/motion-intervals.ts';
// Analytic triangle: minima at kT, maxima at (k+1/2)T. Binary amplitude gives exact half-sample ties.
const triangle=(t,T=800)=>.125*(1-4*Math.abs((t%T)/T-.5));
const frame=(t,T=800)=>({timestampMs:t,landmarks:Array.from({length:33},(_,index)=>({index,
 x:.5+(index===27?triangle(t,T):0),y:.5,z:0,visibility:.9,presence:.9}))});
const sample=(step=100,phase=0)=>Array.from({length:Math.floor(2400/step)+1},(_,i)=>frame(phase+i*step));
function pipeline(frames,continuity='detector-segments'){
 const d=detectMotionCandidates({id:'sensitivity-session',createdAt:1,durationMs:10000,sampledFrames:100,poseFrames:frames.length,
 usableFrameRatio:.8,landmarkCount:33,view:'side_left',rawVideoRetained:false,modelSha256:'a'.repeat(64),
 extractorVersion:'android-pose-0.1.1',timestampMethod:'requested-100ms-nearest-decoded-frame',consentVersion:'local-prototype-notice-v1'},frames,{direction:1,upright:true});
 // Direct production result, retained in this test; IDs/ownership are explicitly synthetic.
 const input={schemaVersion:'candidate-motion-interval-input-1',sourceAlgorithmVersion:d.algorithmVersion,sourceConfigurationVersion:d.configuration.version,
 sourceStatus:d.status,sourceReasons:d.reasons,directionSource:'caller-asserted',timestampProvenance:d.timestampProvenance,continuity,gaps:d.gaps,
 candidates:d.candidates.map((c,i)=>({id:`synthetic-${i}`,participantId:'p',attemptId:'a',sessionId:'sensitivity-session',
 timestampMs:c.timestampMs,side:c.side,kind:c.kind,direction:d.direction,segmentIndex:continuity==='unknown'?null:c.segmentIndex}))};
 return {d,r:calculateCandidateMotionIntervals(input)};
}
function verify(out,times,intervals){
 assert.deepEqual(out.d.candidates.map(c=>c.timestampMs),times);
 assert.deepEqual(out.r.polarities.map(p=>p.intervals.map(i=>i.elapsedMs)),intervals);
 assert.equal(out.r.scientificStatus,'NOT_EVALUATED');assert.equal(out.r.physicalCycleCompleteness,'unknown');
 assert.equal(out.r.timestampProvenance.actualDecodedFrameTimes,false);
}
for(const [phase,times,intervals] of [
 [0,[400,800,1200,1600,2000],[[800,800],[800]]],
 [25,[425,825,1225,1625,2025],[[800,800],[800]]],
 [50,[],[[],[]]],
 [75,[375,775,1175,1575,1975],[[800,800],[800]]],
])test(`phase ${phase}ms: independent centers and intervals`,()=>{
 const out=pipeline(sample(100,phase));verify(out,times,intervals);
 if(phase===50){assert.equal(out.d.status,'insufficient_evidence');assert.ok(out.d.exclusions.some(e=>e.reason==='ambiguous_plateau'));
 assert.ok(out.r.polarities.every(p=>p.status==='insufficient_evidence'&&p.summary.meanMs===null));}
 else assert.deepEqual(out.r.polarities.map(p=>p.summary.meanMs),[800,800]);
});
for(const step of [80,100,125])test(`sampling spacing ${step}ms`,()=>{
 const out=pipeline(sample(step));verify(out,step===125?[]:[400,800,1200,1600,2000],step===125?[[],[]]:[[800,800],[800]]);
 if(step===125){assert.equal(out.d.gaps.length,19);assert.equal(out.d.status,'insufficient_evidence');}
});
test('85-95ms jitter: supplied times yield 720ms intervals',()=>{
 const out=pipeline(Array.from({length:25},(_,n)=>frame(n*90+[0,5,0,-5][n%4]+20,720)));
 verify(out,[380,740,1100,1460,1820],[[720,720],[720]]);
 assert.equal(out.r.polarities[0].summary.meanMs,720);
});
test('90-110ms jitter splits continuity, no FPS recovery',()=>{
 const out=pipeline(Array.from({length:25},(_,n)=>frame(Math.floor(n/2)*200+(n%2?90:0))));
 verify(out,[],[[],[]]);assert.equal(out.d.gaps.length,12);assert.equal(out.d.status,'insufficient_evidence');
});
test('unresolved local plateau hides a peak without missing observations: observed interval doubles',()=>{
 const f=sample();for(const t of [1100,1200,1300])f.find(x=>x.timestampMs===t).landmarks[27].x=.625;
 // Original 800ms movement has an intended peak at 1200; its supplied landmark signal is flattened.
 // This is synthetic measurement distortion, not a known data gap or proof of a physical cycle.
 const out=pipeline(f);verify(out,[400,800,1600,2000],[[1600],[800]]);
 assert.equal(out.d.segments.length,1);assert.equal(out.d.gaps.length,0);assert.equal(out.d.quality.validCount,25);
 assert.ok(out.d.exclusions.some(e=>e.observationIndex===12&&e.reason==='ambiguous_plateau'));
 assert.equal(out.r.polarities[0].intervals[0].status,'available');assert.equal(out.r.polarities[0].summary.meanMs,1600);
});
for(const mode of ['missing','low-confidence'])test(`same omitted peak with known ${mode} continuity break excludes 1600ms`,()=>{
 let f=sample();if(mode==='missing')f=f.filter(x=>x.timestampMs!==1200);else f[12].landmarks[24].presence=.1;
 const out=pipeline(f);verify(out,[400,800,1600,2000],[[null],[null]]);
 assert.equal(out.d.segments.length,2);assert.ok(out.r.polarities.every(p=>p.intervals[0].reasons.includes('segment_mismatch')));
});
test('unknown continuity never becomes eligible periodicity',()=>{
 const out=pipeline(sample(),'unknown');verify(out,[400,800,1200,1600,2000],[[null,null],[null]]);
 assert.ok(out.r.polarities.every(p=>p.intervals.every(i=>i.reasons.includes('continuity_unknown'))));
});
test('boundary truncation and insufficient repetition do not fabricate intervals',()=>{
 const out=pipeline(sample().filter(f=>f.timestampMs>=300&&f.timestampMs<=1700));
 verify(out,[800,1200],[[],[]]);assert.equal(out.d.status,'insufficient_evidence');
 assert.ok(out.d.exclusions.some(e=>e.reason==='boundary_support'));assert.ok(out.r.polarities.every(p=>p.summary.count===0));
});
test('all invalid observations preserve unavailable status',()=>{
 const f=sample();f.forEach(x=>x.landmarks[27].visibility=0);const out=pipeline(f);verify(out,[],[[],[]]);
 assert.equal(out.d.status,'unavailable');assert.ok(out.r.polarities.every(p=>p.status==='unavailable'));
});
test('frozen detector parameters remain exact',()=>{
 assert.deepEqual(MOTION_CONFIGURATION,{version:'ankle-motion-quality-1',confidence:.6,maxGapMs:100,supportMs:200,
 minimumProminence:.02,minimumSeparationMs:400,interpolation:'none'});
});
