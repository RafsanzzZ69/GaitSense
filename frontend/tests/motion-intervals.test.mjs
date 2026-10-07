import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCandidateMotionIntervals as run} from '../src/offline/motion-intervals.ts';
function fixture(times=[100,900,1700]){
 return {schemaVersion:'candidate-motion-interval-input-1',sourceAlgorithmVersion:'ankle-motion-extrema-1',sourceConfigurationVersion:'ankle-motion-quality-1',
 sourceStatus:'available',sourceReasons:[],directionSource:'caller-asserted',timestampProvenance:{method:'requested-100ms-nearest-decoded-frame',actualDecodedFrameTimes:false,usesStoredDifferences:true},
 continuity:'detector-segments',gaps:[],candidates:times.map((timestampMs,i)=>({id:`c${i}`,timestampMs,side:'left',kind:'maximum',segmentIndex:0,participantId:'p',attemptId:'a',sessionId:'s',direction:1}))};
}
const maximum=f=>run(f).polarities[0];
test('regular intervals and ownership retained',()=>{
 const f=fixture(),r=run(f),m=r.polarities[0];assert.deepEqual(m.intervals.map(i=>i.elapsedMs),[800,800]);
 assert.deepEqual(m.summary,{count:2,meanMs:800,medianMs:800,minimumMs:800,maximumMs:800});
 assert.equal(m.intervals[0].start.id,'c0');assert.equal(m.intervals[0].end.attemptId,'a');
 assert.equal(r.scientificStatus,'NOT_EVALUATED');assert.equal(r.physicalCycleCompleteness,'unknown');
});
test('irregular supplied differences never use FPS; even median',()=>{
 const m=maximum(fixture([17,628,1605,3000,3501]));
 assert.deepEqual(m.intervals.map(i=>i.elapsedMs),[611,977,1395,501]);
 assert.deepEqual(m.summary,{count:4,meanMs:871,medianMs:794,minimumMs:501,maximumMs:1395});
});
for(const times of [[],[100]])test(`insufficient ${times.length} candidates`,()=>{
 const m=maximum(fixture(times));assert.equal(m.status,'insufficient_evidence');assert.equal(m.summary.count,0);assert.equal(m.summary.meanMs,null);assert.equal(m.summary.medianMs,null);
});
test('opposite polarities interleave without creating cross-polarity intervals',()=>{
 const f=fixture([100,500,900,1300]);f.candidates[1].kind=f.candidates[3].kind='minimum';
 const r=run(f);assert.deepEqual(r.polarities.map(p=>p.intervals.map(i=>i.elapsedMs)),[[800],[800]]);
});
for(const [field,value,reason] of [['side','right','side_mismatch'],['direction',-1,'direction_mismatch'],['direction',null,'direction_unknown'],
 ['segmentIndex',1,'segment_mismatch'],['segmentIndex',null,'continuity_unknown'],['participantId','q','ownership_mismatch'],['attemptId','b','ownership_mismatch'],['sessionId','t','ownership_mismatch']])
 test(`reject interval ${reason}/${field}`,()=>{const f=fixture([100,900]);f.candidates[1][field]=value;const i=maximum(f).intervals[0];assert.equal(i.elapsedMs,null);assert.ok(i.reasons.includes(reason));});
test('consistent reversed direction is supported',()=>{const f=fixture();f.candidates.forEach(c=>c.direction=-1);assert.equal(maximum(f).summary.meanMs,800);});
test('known gap excludes only crossing interval',()=>{const f=fixture();f.gaps=[{afterMs:400,beforeMs:600}];const m=maximum(f);assert.deepEqual(m.intervals.map(i=>i.elapsedMs),[null,800]);assert.ok(m.intervals[0].reasons.includes('known_gap'));});
for(const times of [[100,100,900],[900,100,1700],[100,NaN,1700]])test(`invalid ordered timestamps ${times}`,()=>{
 const m=maximum(fixture(times));assert.equal(m.summary.count,0);assert.ok(m.intervals.every(i=>i.elapsedMs===null));
});
test('unknown continuity and ownership remain unavailable',()=>{
 const f=fixture();f.continuity='unknown';assert.equal(maximum(f).summary.count,0);
 f.continuity='detector-segments';f.candidates.forEach(c=>{c.attemptId=null;c.sessionId=null;});
 assert.ok(maximum(f).intervals[0].reasons.includes('ownership_unknown'));
});
for(const provenance of [null,{method:'actual-pts',actualDecodedFrameTimes:true,usesStoredDifferences:true},{method:'requested-100ms-nearest-decoded-frame',actualDecodedFrameTimes:true,usesStoredDifferences:true}])
 test(`unsupported provenance ${JSON.stringify(provenance)}`,()=>{const f=fixture();f.timestampProvenance=provenance;assert.equal(maximum(f).status,'unavailable');assert.ok(maximum(f).intervals[0].reasons.includes('unsupported_timestamp_provenance'));});
test('unavailable detector cannot produce intervals',()=>{const f=fixture();f.sourceStatus='unavailable';f.sourceReasons=['no_observations'];const r=run(f);assert.equal(r.polarities[0].summary.count,0);assert.deepEqual(r.sourceReasons,['no_observations']);});
test('boundary truncated source keeps candidate differences without imputing boundaries',()=>{const f=fixture([400,1200]);f.sourceStatus='insufficient_evidence';f.sourceReasons=['boundary_support'];const r=run(f);assert.equal(r.polarities[0].summary.count,1);assert.equal(r.candidates.length,2);assert.deepEqual(r.sourceReasons,['boundary_support']);});
test('multiple attempts retain boundary exclusion, not cross-recording intervals',()=>{const f=fixture([100,900,1800,2600]);f.candidates.slice(2).forEach(c=>c.attemptId='b');assert.deepEqual(maximum(f).intervals.map(i=>i.elapsedMs),[800,null,800]);});
test('invalid opposite polarity chronology is not silently bypassed',()=>{const f=fixture([100,NaN,900]);f.candidates[1].kind='minimum';assert.ok(maximum(f).intervals[0].reasons.includes('invalid_chronology'));});
test('input mutation and sorting never occur',()=>{const f=fixture(),copy=structuredClone(f);assert.deepEqual(run(f),run(f));assert.deepEqual(f,copy);f.candidates.reverse();assert.equal(maximum(f).summary.count,0);});
test('duplicate identities and malformed gaps reject explicitly',()=>{const f=fixture();f.candidates[1].id='c0';assert.throws(()=>run(f),e=>e.code==='duplicate_id');const g=fixture();g.gaps=[{afterMs:600,beforeMs:400}];assert.throws(()=>run(g),e=>e.code==='invalid_gap');});
test('opposite polarity metadata transition cannot bridge continuity',()=>{const f=fixture([100,500,900]);f.candidates[1].kind='minimum';f.candidates[1].direction=-1;assert.ok(maximum(f).intervals[0].reasons.includes('intervening_metadata_change'));});

for(const source of ['caller-asserted','operator-recording-setup'])for(const direction of [1,-1])
 test(`explicit source ${source} direction ${direction} retains provenance and arithmetic`,()=>{
  const f=fixture();f.directionSource=source;f.candidates.forEach(c=>c.direction=direction);
  const copy=structuredClone(f),r=run(f);
  assert.equal(r.directionSource,source);assert.deepEqual(r.polarities[0].intervals.map(i=>i.elapsedMs),[800,800]);
  assert.equal(r.polarities[0].summary.meanMs,800);assert.equal(r.algorithmVersion,'candidate-motion-interval-1');
  assert.equal(r.scientificStatus,'NOT_EVALUATED');assert.equal(r.physicalCycleCompleteness,'unknown');
  assert.equal(r.meaning,'candidate-motion-periodicity-only');assert.deepEqual(f,copy);
 });
for(const source of [null,undefined,'unassessed','camera-side','operator-inferred'])
 test(`unknown direction source ${source} fails closed`,()=>{
  const f=fixture();f.directionSource=source;const r=run(f);
  assert.equal(r.directionSource,source);assert.equal(r.polarities[0].status,'unavailable');
  assert.ok(r.polarities[0].intervals.every(i=>i.elapsedMs===null&&i.reasons.includes('unsupported_direction_source')));
 });
for(const [name,change,reason] of [
 ['unassessed direction',f=>f.candidates.forEach(c=>c.direction=null),'direction_unknown'],
 ['timestamp source',f=>f.timestampProvenance.actualDecodedFrameTimes=true,'unsupported_timestamp_provenance'],
 ['duplicate times',f=>f.candidates[1].timestampMs=100,'non_increasing_timestamp'],
 ['invalid time',f=>f.candidates[1].timestampMs=NaN,'invalid_timestamp'],
 ['continuity',f=>f.continuity='unknown','continuity_unknown'],
 ['segment',f=>f.candidates[1].segmentIndex=1,'segment_mismatch'],
 ['gap',f=>f.gaps=[{afterMs:400,beforeMs:600}],'known_gap'],
 ['side',f=>f.candidates[1].side='right','side_mismatch'],
 ['direction',f=>f.candidates[1].direction=-1,'direction_mismatch'],
 ['session',f=>f.candidates[1].sessionId='other','ownership_mismatch'],
 ['unknown ownership',f=>f.candidates.forEach(c=>{c.sessionId=null;c.attemptId=null;}),'ownership_unknown'],
 ['source unavailable',f=>f.sourceStatus='unavailable','source_unavailable']
 ])test(`operator source does not bypass ${name}`,()=>{
  const f=fixture([100,900]);f.directionSource='operator-recording-setup';change(f);
  const r=run(f),i=r.polarities[0].intervals[0];assert.equal(i.elapsedMs,null);assert.ok(i.reasons.includes(reason));
  assert.equal(r.polarities[0].summary.count,0);assert.equal(r.polarities[0].summary.meanMs,null);
  assert.ok(!i.reasons.includes('unsupported_direction_source'));
 });
test('operator source retains polarity separation and insufficient evidence',()=>{
 const f=fixture([100,500]);f.directionSource='operator-recording-setup';f.candidates[1].kind='minimum';
 const r=run(f);assert.deepEqual(r.polarities.map(p=>p.intervals),[[],[]]);
 assert.ok(r.polarities.every(p=>p.status==='insufficient_evidence'&&p.summary.meanMs===null));
});
