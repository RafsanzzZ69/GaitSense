import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {readAnalysisMetadata} from '../src/offline/analysis-metadata.ts';
import {parseSession} from '../src/offline/contract.ts';
import {analyzeSavedPayload} from '../src/offline/saved-payload-analysis.ts';
import {createSavedSessionLoader} from '../src/offline/saved-session-loader.ts';
import {presentSavedAnalysis} from '../src/offline/analysis-presentation.ts';
import {savedAnalysisPanel} from '../src/offline/saved-analysis-binding.ts';
const golden=JSON.parse(readFileSync(new URL('./fixtures/analysis-metadata-v1.json',import.meta.url),'utf8'));
const native=readFileSync(new URL('../modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt',import.meta.url),'utf8');
function fixture(metadata=structuredClone(golden),view='side_left') {
 const session={id:'saved-geometry',createdAt:1,durationMs:10000,sampledFrames:100,poseFrames:100,usableFrameRatio:1,
  landmarkCount:33,view,rawVideoRetained:false,modelSha256:'a'.repeat(64),extractorVersion:'android-pose-0.1.1',
  timestampMethod:'requested-100ms-nearest-decoded-frame',consentVersion:'local-prototype-notice-v1',diagnostics:'encoded=1920x1080; rotation=90; decoded=1920x1080'};
 if(metadata!==undefined)session.analysisMetadata=metadata;
 const frames=Array.from({length:100},(_,n)=>({timestampMs:n*100,landmarks:Array.from({length:33},(_,index)=>({index,
  x:index===27||index===28?.5+[-.1,-.07,0,.07,.1,.07,0,-.07][n%8]:.5,
  y:index===23||index===24?.3:index===25||index===26?.5:index===27||index===28?.7:.5,z:0,visibility:.9,presence:.9}))}));
 return {session,frames};
}
const caller=(w=768,h=432)=>({inferenceWidth:w,inferenceHeight:h,source:'caller-asserted-inference-dimensions',assumption:'constant-inference-dimensions-within-session'});
function run(f=fixture(),setup={}) {return analyzeSavedPayload({selectedSessionId:f.session.id,
 sessionRead:{sessionId:f.session.id,status:'loaded',payload:JSON.stringify(f.session)},
 framesRead:{sessionId:f.session.id,status:'loaded',payload:JSON.stringify(f.frames)},setup});}
const knee=r=>r.analysis.components.knee;
function unavailable(r,reason){assert.equal(knee(r).status,'unavailable');assert.ok(knee(r).reasons.includes(reason));
 assert.ok(knee(r).result.observations.every(o=>o.value===null&&o.reasons.includes(reason)));}
function store() {
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
 const sql=[...native.matchAll(/db\.execSQL\("(CREATE TABLE [^"]+)"\)/g)].map(m=>m[1]);assert.equal(sql.length,2);
 sql.forEach(statement=>db.exec(statement));return db;
}

test('native JSON golden fixture yields explicit bitmap geometry and unassessed assertions',()=>{
 const r=readAnalysisMetadata(golden);assert.equal(r.status,'recognized');
 assert.equal(r.metadata.geometry.inferenceWidth,768);assert.equal(r.metadata.geometry.inferenceHeight,432);
 assert.equal(r.metadata.geometry.source,'native-inference-bitmap');assert.equal(r.metadata.geometry.constantDimensions,true);
 assert.equal(r.metadata.geometry.observedInferenceCalls,100);assert.equal(r.metadata.geometry.scope,'all-inference-calls');
 for(const key of ['direction','upright'])assert.deepEqual(r.metadata[key],{status:'unassessed',value:null,source:null});
});
test('stored native geometry reaches knee without caller input; other prerequisites stay missing',()=>{
 const r=run();assert.equal(r.status,'partial');assert.equal(knee(r).status,'available');
 assert.equal(knee(r).result.observations[2].value,0);assert.equal(knee(r).result.geometry.aspectRatio,768/432);
 assert.equal(r.setupProvenance.geometry,'persisted-native');assert.equal(r.analysis.components.motion.status,'unavailable');
 assert.equal(r.analysis.context.direction,null);assert.equal(r.analysis.context.upright,false);
 assert.equal(r.analysis.context.participantId,null);assert.equal(r.analysis.context.attemptId,null);assert.equal(r.analysis.context.continuity,'unknown');
});
test('independently constructed pixel-space right angle uses inference aspect',()=>{
 const f=fixture(),points=f.frames[2].landmarks;
 Object.assign(points[23],{x:384/768,y:116/432});Object.assign(points[25],{x:384/768,y:216/432});
 Object.assign(points[27],{x:484/768,y:216/432});
 assert.ok(Math.abs(knee(run(f)).result.observations[2].value-90)<1e-8);
});
test('matching caller geometry retains native source, count and transform evidence',()=>{
 const r=run(fixture(),{geometry:caller()});assert.equal(knee(r).result.geometry.source,'native-inference-bitmap');
 assert.equal(knee(r).result.geometry.observedInferenceCalls,100);
 assert.deepEqual(knee(r).result.geometry.transform,golden.geometry.transform);
});
for(const g of [caller(432,768),caller(767,432),caller(384,216),{},'invalid'])test(`conflicting/invalid supplied geometry ${JSON.stringify(g)} fails knee only`,()=>{
 const r=run(fixture(),{geometry:g,direction:1,upright:true,continuity:'detector-segments'});
 unavailable(r,'geometry_conflict');assert.equal(r.status,'partial');assert.equal(r.analysis.components.motion.status,'available');
 assert.equal(r.analysis.components.intervals.status,'available');assert.equal(knee(r).result.geometry,null);
});
test('caller null represents absent setup when native geometry is available',()=>{
 assert.equal(knee(run(fixture(),{geometry:null})).result.geometry.source,'native-inference-bitmap');
});
test('old records without metadata retain caller-only adapter behavior',()=>{
 const f=fixture();delete f.session.analysisMetadata;
 unavailable(run(f),'missing_geometry');assert.equal(knee(run(f,{geometry:caller()})).status,'available');
 assert.equal(knee(run(f,{geometry:caller()})).result.geometry.source,'caller-asserted-inference-dimensions');
});
test('historical diagnostic dimensions and rotation never provide structured geometry',()=>{
 const f=fixture();delete f.session.analysisMetadata;
 unavailable(run(f),'missing_geometry');assert.equal(readAnalysisMetadata(f.session.analysisMetadata).status,'absent');
});
for(const [field,value] of [['inferenceWidth',0],['inferenceHeight',0],['inferenceWidth',-1],['inferenceHeight',-1],
 ['inferenceWidth',768.5],['inferenceHeight',432.5],['inferenceWidth',Number.MAX_SAFE_INTEGER+1],
 ['inferenceHeight',Number.MAX_SAFE_INTEGER+1],['inferenceWidth',769],['inferenceHeight','432']])
 test(`invalid native ${field}=${value} fails metadata safely while History remains readable`,()=>{
 const f=fixture();f.session.analysisMetadata.geometry[field]=value;
 assert.equal(parseSession(JSON.stringify(f.session)).id,'saved-geometry');unavailable(run(f),'invalid_analysis_metadata');
});
for(const value of [null,[],{},'text',{...golden,geometry:null}])test(`malformed optional metadata ${JSON.stringify(value)} affects knee only`,()=>{
 const r=run(fixture(value),{direction:1,upright:true,continuity:'detector-segments'});
 unavailable(r,'invalid_analysis_metadata');assert.equal(r.analysis.components.motion.status,'available');
});
test('unknown metadata version degrades knee and cannot be bypassed with caller geometry',()=>{
 const f=fixture();f.session.analysisMetadata.contractVersion='saved-analysis-metadata-99';
 unavailable(run(f,{geometry:caller()}),'unsupported_analysis_metadata_version');
 assert.equal(parseSession(JSON.stringify(f.session)).id,f.session.id);
});
for(const field of ['source','constantDimensions','scope','observedInferenceCalls','transform'])test(`native ${field} evidence must be recognized`,()=>{
 const f=fixture();f.session.analysisMetadata.geometry[field]=null;unavailable(run(f),'invalid_analysis_metadata');
});
test('inference counts are checked against declared sampled and saved counts',()=>{
 for(const count of [99,101]){const f=fixture();f.session.analysisMetadata.geometry.observedInferenceCalls=count;unavailable(run(f),'invalid_analysis_metadata');}
});
test('varying dimensions cannot be overridden by a caller constant-dimension assertion',()=>{
 const f=fixture();f.session.analysisMetadata.geometry={status:'unavailable',reason:'varying-inference-dimensions',constantDimensions:false,observedInferenceCalls:100};
 unavailable(run(f,{geometry:caller()}),'varying_inference_dimensions');
});
test('no-inference metadata cannot claim constant geometry',()=>{
 const value=structuredClone(golden);value.geometry={status:'unavailable',reason:'no-inference-calls',constantDimensions:false,observedInferenceCalls:0};
 assert.equal(readAnalysisMetadata(value).status,'recognized');unavailable(run(fixture(value)),'invalid_analysis_metadata');
});
for(const [field,value] of [['applicationRotationDegrees',90],['applicationMirror',true],['decoderOrientation','upright']])
 test(`unrecognized transform ${field} cannot establish evidence`,()=>{
 const f=fixture();f.session.analysisMetadata.geometry.transform[field]=value;unavailable(run(f),'invalid_analysis_metadata');
});
test('direction and upright cannot be introduced as persisted assertions under version 1',()=>{
 for(const key of ['direction','upright']){const f=fixture();f.session.analysisMetadata[key]={status:'asserted',value:key==='direction'?1:true,source:'side_left'};
  const r=run(f);unavailable(r,'invalid_analysis_metadata');assert.equal(r.analysis.context.direction,null);assert.equal(r.analysis.context.upright,false);}
});
for(const view of ['side_left','side_right'])test(`${view} remains a side selection, never direction/upright evidence`,()=>{
 const r=run(fixture(structuredClone(golden),view));assert.equal(knee(r).status,'available');
 assert.equal(r.analysis.context.direction,null);assert.equal(r.setupProvenance.direction,'not-supplied');
 assert.equal(r.setupProvenance.upright,'not-confirmed');
});
test('evidence boundaries and requested timestamps are unchanged',()=>{
 const r=run();assert.equal(r.scientificStatus,'NOT_EVALUATED');assert.equal(r.binding.verification,'caller-bound-ids-only');
 assert.equal(r.analysis.evidence.actualFramePts,'not-available');assert.equal(r.analysis.evidence.exactImageCorrespondence,'not-established');
 assert.equal(knee(r).result.timestampProvenance.actualDecodedFrameTimes,false);assert.equal(knee(r).result.observations[2].timestampMs,200);
});
test('SQLite summary roundtrip reads old/new JSON without migration; existing cascade semantics remain',()=>{
 const db=store();try{
  const fresh=fixture(),old=fixture();delete old.session.analysisMetadata;old.session.id='old-session';
  for(const f of [old,fresh]){db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(f.session.id,1,JSON.stringify(f.session));
   f.frames.forEach(frame=>db.prepare('INSERT INTO frames VALUES (?,?,?)').run(f.session.id,frame.timestampMs,JSON.stringify(frame.landmarks)));}
  const raw=db.prepare('SELECT summary FROM sessions WHERE id=?').get('saved-geometry').summary;
  assert.equal(parseSession(raw).analysisMetadata.geometry.inferenceWidth,768);
  const loadedFrames=db.prepare('SELECT timestamp,landmarks FROM frames WHERE session_id=? ORDER BY timestamp').all('saved-geometry').map(row=>({timestampMs:row.timestamp,landmarks:JSON.parse(row.landmarks)}));
  assert.equal(knee(run({session:parseSession(raw),frames:loadedFrames})).status,'available');
  assert.equal(parseSession(db.prepare('SELECT summary FROM sessions WHERE id=?').get('old-session').summary).analysisMetadata,undefined);
  db.prepare('DELETE FROM sessions WHERE id=?').run('saved-geometry');assert.equal(db.prepare('SELECT count(*) AS n FROM frames WHERE session_id=?').get('saved-geometry').n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM frames WHERE session_id=?').get('old-session').n,100);
  db.prepare('DELETE FROM sessions').run();assert.equal(db.prepare('SELECT count(*) AS n FROM frames').get().n,0);
 }finally{db.close();}
});
test('real loader/presenter exposes persisted geometry, missing assertions and partial result',async()=>{
 const f=fixture(),l=createSavedSessionLoader({listSessions:async()=>JSON.stringify([f.session]),readFrames:async()=>JSON.stringify(f.frames)});
 await l.select(f.session.id);const p=presentSavedAnalysis(l.getState()),panel=savedAnalysisPanel(p);
 assert.equal(p.status,'partial');assert.equal(p.dataStatus,'loaded');assert.equal(p.setup.geometry.status,'persisted-native');
 assert.equal(p.setup.geometry.value.source,'native-inference-bitmap');assert.equal(p.setup.direction.status,'required');assert.equal(p.setup.upright.status,'required');
 assert.equal(p.scientificStatus,'NOT_EVALUATED');assert.ok(panel.groups[0].lines.some(line=>line.endsWith(': persisted-native')));
});
test('unknown metadata extras are not forwarded as geometry evidence',()=>{
 const f=fixture();f.session.analysisMetadata.geometry.transform.secret='arbitrary';f.session.analysisMetadata.geometry.imageId='fabricated';
 const r=run(f);assert.equal(knee(r).result.geometry.imageId,undefined);assert.equal(knee(r).result.geometry.transform.secret,undefined);
});
test('production wiring observes actual resized bitmap on all calls and saves metadata in summary JSON',()=>{
 assert.match(native,/val image = BitmapImageBuilder\(bitmap\).build\(\)[\s\S]*analysisMetadata.observe\(bitmap.width, bitmap.height\)\s*val poses = detector.detectForVideo/);
 assert.match(native,/\.put\("analysisMetadata", analysisMetadata.toJson\(\)\)/);
 assert.match(native,/SQLiteOpenHelper\(context, "gaitsense-offline.db", null, 1\)/);
 assert.match(native,/SELECT summary FROM sessions ORDER BY created DESC LIMIT 100/);
});
