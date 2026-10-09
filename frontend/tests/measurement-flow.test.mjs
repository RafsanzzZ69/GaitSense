import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { createRequire } from 'node:module';
import { renderToStaticMarkup } from 'react-dom/server';
import { flow, access } from './helpers/measurement-flow-harness.mjs';
import { capture, flush, recordedPreview } from './helpers/capture-harness.mjs';
import { gate } from './helpers/entry-gate-harness.mjs';
import { load } from './helpers/auth-controller-harness.mjs';
import { createDepartureBoundary } from '../src/navigation/departure-boundary.ts';
import { measurementPage } from '../src/measurement/measurement-page.ts';
import { parseSession } from '../src/offline/contract.ts';
import { snapshotRecordingSetup } from '../src/offline/recording-analysis-setup.ts';
import { createSavedAnalysisBinding, savedAnalysisPanel } from '../src/offline/saved-analysis-binding.ts';
const require=createRequire(import.meta.url), web=require('react-native-web');
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const session=()=>({id:'synthetic-3b',createdAt:1,durationMs:12000,sampledFrames:120,poseFrames:100,usableFrameRatio:.8,landmarkCount:33,
  view:'side_left',rawVideoRetained:false,modelSha256:'a'.repeat(64),extractorVersion:'test',consentVersion:'local-prototype-notice-v1',timestampMethod:'requested-100ms-nearest-decoded-frame'});
const controller=(initialize=true)=>capture(createDepartureBoundary(()=>true),[],{professional:true,initialize});
function cameraFlow(overrides={}){const h=flow(access({canContinue:()=>true,...overrides}));h.button('Continue to camera').onPress();h.render();return h;}
function resultHtml(presentation, completed=null){
  const Results=load('src/measurement/MeasurementResults.tsx',{'react-native':web,'../offline/saved-analysis-binding':{savedAnalysisPanel}}).MeasurementResults;
  return renderToStaticMarkup(React.createElement(Results,{access:access({analysis:presentation,completed,selectedSession:completed})}));
}

test('Home enters Setup while retaining the synchronous duplicate-navigation latch',()=>{
  assert.match(read('src/home/HomeScreen.tsx'),/router\.push\('\/measurement\/setup'\)/);
  assert.match(read('src/home/HomeScreen.tsx'),/if \(opening.current\) return/);
});
test('actual Setup presentation never renders the camera or processing surface',()=>{
  const h=flow(access());assert.ok(h.has('Existingsetup'));assert.equal(h.has('ExistingCamera'),false);assert.equal(h.has('Existingprocessing'),false);
});
test('controller requires explicit per-recording notice before continuation',()=>{
  const h=controller(false);assert.equal(h.access.canContinue(),false);h.consent();h.render();assert.equal(h.access.canContinue(),true);h.unmount();
});
test('stale disabled Continue cannot route to camera',()=>{
  const h=flow(access());assert.equal(h.button('Continue to camera').disabled,true);h.button('Continue to camera').onPress();assert.deepEqual(h.navigations,[]);
});
test('controller continuation reuses the existing setup validator instead of accepting invalid values',()=>{
  const h=controller();h.setupControls().onDirection(0);h.render();assert.equal(h.access.canContinue(),false);
  h.setupControls().onDirection(-1);h.render();assert.equal(h.access.canContinue(),true);assert.equal(h.access.direction,-1);h.unmount();
});
test('valid setup initializes Camera only on deliberate continuation, without recording',()=>{
  let preparations=0,records=0;const h=cameraFlow({prepareCamera:()=>preparations++,record:()=>records++});
  assert.ok(h.has('ExistingCamera'));assert.equal(h.has('Existingsetup'),false);assert.equal(preparations,1);assert.equal(records,0);
});
test('re-entering camera resets readiness rather than reusing a detached preview',()=>{
  const h=controller();assert.equal(h.access.ready,true);h.access.prepareCamera();h.render();assert.equal(h.access.ready,false);assert.equal(h.access.canRecord,false);h.unmount();
});
test('Camera fragment retains the existing rear muted 720p 16:9 lifecycle',()=>{
  const h=controller();const find=node=>React.isValidElement(node)&&node.props.onCameraReady?node:Array.isArray(node)?node.map(find).find(Boolean):React.isValidElement(node)?find(node.props.children):undefined;
  const camera=find(h.access.camera);assert.equal(camera.props.facing,'back');assert.equal(camera.props.mute,true);assert.equal(camera.props.videoQuality,'720p');assert.equal(camera.props.ratio,'16:9');h.unmount();
});
test('only the scoped parent mounts OfflineCapture; child markers own no state/camera',()=>{
  assert.equal((read('src/app/measurement/_layout.android.tsx').match(/<OfflineCapture /g)||[]).length,1);
  for(const name of ['setup','camera','processing','results','history'])assert.doesNotMatch(read(`src/app/measurement/${name}.tsx`),/useState|CameraView|OfflineCapture|Pose\.|useEffect/);
  assert.doesNotMatch(read('src/app/offline.android.tsx'),/import OfflineCapture/);
});
test('single navigation lease refuses another simultaneous measurement controller',()=>{
  const b=createDepartureBoundary(()=>true),h=capture(b,[],{professional:true});assert.throws(()=>b.register(()=>true),/already owns/);h.unmount();assert.doesNotThrow(()=>b.register(()=>true));
});
test('rapid record activations retain one recording and one frozen attempt',async()=>{
  const h=controller(),previous=globalThis.setTimeout;
  try{globalThis.setTimeout=fn=>{queueMicrotask(fn);return 0;};for(let i=0;i<20;i++)h.access.record();await flush();h.render();assert.equal(h.cameraCalls.length,1);assert.deepEqual(h.cameraCalls[0],{maxDuration:15,maxFileSize:140000000});h.resolveClip();await flush();h.render();await h.access.discard();await flush();}
  finally{globalThis.setTimeout=previous;h.unmount();}
});
test('recording completion presents review in Processing without automatic extraction',async()=>{
  const h=controller();await recordedPreview(h);assert.equal(h.access.phase,'preview');assert.equal(h.processCalls.length,0);
  const f=cameraFlow();Object.assign(f.access,h.access);f.render();assert.equal(f.has('ExistingCamera'),false);assert.match(f.text(),/Review this recording/);assert.equal(f.navigations.at(-1)[1],'/measurement/processing');h.unmount();
});
test('Processing uses the existing native operation exactly once',async()=>{
  const h=controller();await recordedPreview(h);const process=h.access.process;process();process();h.render();assert.equal(h.processCalls.length,1);assert.equal(h.access.phase,'processing');h.resolveProcessing();await flush();h.unmount();
});
test('success publishes a saved result only after native readback and cleanup',async()=>{
  const h=controller();await recordedPreview(h);let resolveFrames;h.readFrames(()=>new Promise(resolve=>{resolveFrames=resolve;}));h.access.process();h.render();h.resolveProcessing(JSON.stringify(session()));await flush();h.render();
  assert.equal(h.access.completed,null);assert.equal(h.canLeave(),false);resolveFrames('[]');await flush();h.render();assert.equal(h.access.completed.id,session().id);assert.deepEqual(h.selections,[session().id]);assert.equal(h.canLeave(),true);assert.equal(h.access.phase,'ready');h.unmount();
});
test('successful controller completion transitions Processing to Results with no second process',()=>{
  const h=cameraFlow();h.access.phase='preview';h.render();h.render();h.access.phase='processing';h.render();h.access.phase='ready';h.access.completed=session();h.render();assert.equal(h.navigations.at(-1)[1],'/measurement/results');assert.ok(h.has('ResultsFromSavedLoader'));assert.equal(h.has('ExistingCamera'),false);
});
test('saved readback failure never masquerades as successful Results',async()=>{
  const h=controller();await recordedPreview(h);h.readFrames(async()=>{throw Error('synthetic readback failure');});h.access.process();h.resolveProcessing(JSON.stringify(session()));await flush();h.render();assert.equal(h.access.completed,null);assert.match(h.access.error,/readback failure/);assert.equal(h.canLeave(),true);assert.deepEqual(h.selections,[]);h.unmount();
});
test('quality rejection remains failed with diagnostics and unchanged cleanup',async()=>{
  const h=controller();await recordedPreview(h);h.access.process();h.rejectProcessing(Error('QUALITY_REJECTED usable=69%; required=70%'));await flush();h.render();assert.equal(h.access.completed,null);assert.match(h.access.error,/QUALITY_REJECTED/);assert.equal(h.discarded.length,1);assert.equal(h.canLeave(),true);h.unmount();
});
test('failed processing retains a bounded retry page instead of invented zero metrics',()=>{
  const h=cameraFlow();h.access.phase='processing';h.render();h.render();h.access.phase='ready';h.access.error='quality rejected';h.render();assert.match(h.text(),/did not produce a confirmed saved result/);assert.ok(h.button('Prepare another recording'));assert.equal(h.has('ResultsFromSavedLoader'),false);
});
test('retained cleanup failure keeps preview/discard controls and blocks Home',async()=>{
  const h=controller();await recordedPreview(h);h.failCleanup(true);h.access.process();h.resolveProcessing();await flush();h.render();assert.equal(h.access.phase,'preview');assert.equal(h.canLeave(),false);
  const f=flow(access({...h.access}),{pathname:'/measurement/processing'});f.back();assert.equal(f.navigations.length,0);assert.equal(f.alerts.length,1);h.failCleanup(false);h.access.discard();await flush();h.render();assert.equal(h.canLeave(),true);h.unmount();
});
test('native progress is retained; presentation introduces no fake progress stages',()=>{
  assert.match(read('src/offline/OfflineCapture.tsx'),/onProgress.*setProgress\(Math.round\(e.percent\)\)/);
  assert.doesNotMatch(read('src/measurement/MeasurementFlow.tsx'),/setInterval|percent|Math\.random|Calculating results|Saving measurement/);
});
test('Technical details stays secondary and can be expanded without changing controller state',()=>{
  const h=flow(access());assert.equal(h.has('RawDiagnostics'),false);h.button('Technical details').onPress();h.render();assert.ok(h.has('RawDiagnostics'));h.button('Hide Technical details').onPress();h.render();assert.equal(h.has('RawDiagnostics'),false);
});
test('Setup Back returns Home without processing or data mutation',()=>{
  const h=flow(access());assert.equal(h.back(),true);assert.deepEqual(h.navigations,[['dismissTo','/']]);assert.equal(h.has('ExistingCamera'),false);
});
test('idle Camera Back removes the preview and returns Setup with replacement',()=>{
  const h=cameraFlow();h.back();h.render();assert.deepEqual(h.navigations.at(-1),['replace','/measurement/setup']);assert.equal(h.has('ExistingCamera'),false);
});
for(const phase of ['countdown','recording','processing'])test(`${phase} Back preserves the live owner and explains existing settlement`,()=>{
  const h=flow(access({phase,canLeave:()=>false}),{pathname:`/measurement/${phase==='processing'?'processing':'camera'}`});const before=h.navigations.length;
  assert.equal(h.back(),true);assert.equal(h.navigations.length,before);assert.match(h.alerts[0][1],/Cancel the countdown, stop and discard/);h.remove({type:'POP'});assert.equal(h.dispatches.length,0);
});
test('safe external removal replays the original navigation action',()=>{
  const h=flow(access()),action={type:'POP',payload:{count:1}};h.remove(action);assert.equal(h.dispatches[0],action);
});
test('Results Back dismisses to Home and cannot restart Camera or processing',()=>{
  const h=flow(access({completed:session()}),{pathname:'/measurement/results'});h.back();assert.deepEqual(h.navigations,[['dismissTo','/']]);assert.equal(h.has('ExistingCamera'),false);assert.equal(h.has('Existingprocessing'),false);
});
test('Results offers History through replacement; it renders existing device history',()=>{
  const h=flow(access({completed:session()}),{pathname:'/measurement/results'});h.button('View measurements on this phone').onPress();h.render();assert.deepEqual(h.navigations.at(-1),['replace','/measurement/history']);assert.ok(h.has('Existinghistory'));
});
for(const phase of ['countdown','recording','processing','preview'])test(`deep-link attempts cannot hide ${phase} presentation`,()=>{
  const h=flow(access({phase,canLeave:()=>false}),{pathname:'/measurement/setup'});h.deepLink('/measurement/results');assert.equal(h.has('ResultsFromSavedLoader'),false);
  assert.ok(h.has(phase==='countdown'||phase==='recording'?'ExistingCamera':phase==='preview'?'Existingpreview':'Existingprocessing'));
});
test('fresh/direct Camera, Processing and Results entries recover to Setup with no fake restoration',()=>{
  for(const page of ['camera','processing','results']){const h=flow(access(),{pathname:`/measurement/${page}`});assert.deepEqual(h.navigations,[['replace','/measurement/setup']]);assert.equal(h.has('ExistingCamera'),false);assert.equal(h.has('ResultsFromSavedLoader'),false);}
});
test('auth loss during Setup removes protected measurement entry immediately',()=>{
  const h=gate('SIGNED_IN');assert.ok(h.routes().includes('measurement'));h.auth.session={status:'SIGNED_OUT',user:null};assert.deepEqual(h.routes(),['account']);
});
for(const phase of ['recording','processing'])test(`auth loss during ${phase} retains only the admitted measurement route`,()=>{
  const h=gate('SIGNED_IN');let safe=false;h.boundary.register(()=>safe);h.auth.session={status:'SIGNED_OUT',user:null};assert.deepEqual(h.routes(),['measurement']);assert.equal(h.boundary.canStart(),false);safe=true;h.boundary.changed();assert.deepEqual(h.routes(),['account']);
});
test('pending sign-out preserves processing save/readback semantics without deleting History',async()=>{
  const b=createDepartureBoundary(()=>true),h=capture(b,[],{professional:true});await recordedPreview(h);h.readFrames(async()=>'[]');h.access.process();const departure=b.requestDeparture();assert.equal(b.mustRetain(),true);h.resolveProcessing(JSON.stringify(session()));await flush();h.render();assert.equal(await departure.ready,true);assert.equal(h.access.completed.id,session().id);assert.deepEqual(h.destroyed,[]);assert.equal(b.canStart(),false);departure.release();h.unmount();
});
test('signed-out and incomplete onboarding cannot create any measurement controller entry',()=>{
  const {StackRouter}=require('expo-router/build/react-navigation/routers/StackRouter');
  for(const h of [gate('SIGNED_OUT'),gate('SIGNED_IN',{status:'READY',versions:{acknowledgementVersion:0,onboardingVersion:0}})]){
    const router=StackRouter({}),options={routeNames:h.routes(),routeParamList:{},routeGetIdList:{}},state=router.getInitialState(options);
    assert.equal(router.getStateForAction(state,{type:'PUSH',payload:{name:'measurement',params:{screen:'camera'}}},options),null);
  }
});
test('measurement URLs never serialize pose frames or scientific payloads',()=>{
  const source=read('src/measurement/MeasurementFlow.tsx');assert.doesNotMatch(source,/JSON\.stringify|searchParams|landmarks|frames|push\(/);assert.match(source,/router\.replace/);
});
test('unknown direction/upright remain valid while invalid setup values are rejected',()=>{
  assert.deepEqual(snapshotRecordingSetup('side_left',null,false),{view:'side_left',direction:null,upright:null});
  for(const args of [['image_left',1,true],['side_right',0,true],['side_left',1,null]])assert.throws(()=>snapshotRecordingSetup(...args),/Invalid recording/);
  assert.deepEqual(snapshotRecordingSetup('side_right',-1,true),{view:'side_right',direction:-1,upright:true});
});
test('70% session quality and requested timestamp contracts remain enforced',()=>{
  assert.doesNotThrow(()=>parseSession(JSON.stringify({...session(),usableFrameRatio:.7})));
  assert.throws(()=>parseSession(JSON.stringify({...session(),usableFrameRatio:.699})),/Invalid/);
  assert.throws(()=>parseSession(JSON.stringify({...session(),timestampMethod:'actual-decoded-PTS'})),/Invalid/);
});
test('native selected-side quality thresholds stay at visibility/presence 0.6',()=>{
  const source=read('modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/RequiredJointQualityGate.kt');
  assert.equal((source.match(/>= \.6f/g)||[]).length,2);assert.doesNotMatch(source,/firebase|Firebase|\bUID\b/);
});
test('SQLite/History remain device-wide and no account/cloud ownership enters measurement',()=>{
  const native=read('modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt');assert.doesNotMatch(native,/Firebase|firebase|\bUID\b|user_id|account_id/);
  for(const path of ['src/offline/OfflineCapture.tsx','src/measurement/MeasurementFlow.tsx','src/measurement/MeasurementResults.tsx'])assert.doesNotMatch(read(path),/Firebase|firebase|Firestore|Storage|AsyncStorage|useAuth|\buid\b|fetch\(/);
});
test('real saved binding supplies identical unavailable presentation to immediate and History results',async()=>{
  const publications=[],s=session(),binding=createSavedAnalysisBinding({listSessions:async()=>JSON.stringify([s]),readFrames:async()=>JSON.stringify(Array.from({length:100},(_,index)=>({timestampMs:index*100,landmarks:Array.from({length:33},(_,i)=>({index:i,x:.5,y:.5,z:0,visibility:.9,presence:.9}))})))},p=>publications.push(p));
  await binding.select(s.id);const first=publications.at(-1),immediate=resultHtml(first,s);await binding.select(s.id);const reopened=resultHtml(publications.at(-1),s);
  assert.equal(first.selection.sessionId,s.id);assert.equal(first.status,'unavailable');assert.equal(immediate,reopened);assert.match(immediate,/Projected 2D knee flexion/);assert.match(immediate,/Candidate ankle-motion extrema/);assert.match(immediate,/Candidate-to-candidate temporal intervals/);assert.doesNotMatch(immediate,/0 degrees|gait score|health score/);binding.dispose();
});
test('Results loading renders no invented metrics or previous session values',()=>{
  const html=resultHtml(null);assert.match(html,/Loading saved analysis/);assert.doesNotMatch(html,/80%|100 pose|0 degrees|synthetic/);
});
test('result summary follows selected saved-session identity rather than an older completion',async()=>{
  const publications=[],s=session(),binding=createSavedAnalysisBinding({listSessions:async()=>JSON.stringify([s]),readFrames:async()=>'[]'},p=>publications.push(p));await binding.select(s.id);
  const Results=load('src/measurement/MeasurementResults.tsx',{'react-native':web,'../offline/saved-analysis-binding':{savedAnalysisPanel}}).MeasurementResults;
  const html=renderToStaticMarkup(React.createElement(Results,{access:access({analysis:publications.at(-1),completed:{...s,poseFrames:99},selectedSession:s})}));
  assert.match(html,/100 pose frames/);assert.doesNotMatch(html,/99 pose frames/);binding.dispose();
});
test('measurement web fallback redirects Home without account/onboarding assumptions',()=>{
  assert.match(read('src/app/measurement/_layout.tsx'),/Redirect href="\/"/);assert.doesNotMatch(read('src/app/measurement/_layout.tsx'),/AuthProvider|EntryPreferences|firebase|OfflineCapture/);
});
