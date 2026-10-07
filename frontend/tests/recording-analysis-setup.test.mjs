import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {DatabaseSync} from 'node:sqlite';
import {snapshotRecordingSetup,serializeRecordingSetup,createRecordingSetupBinding} from '../src/offline/recording-analysis-setup.ts';
import {readAnalysisMetadata} from '../src/offline/analysis-metadata.ts';
import {analyzeSavedPayload} from '../src/offline/saved-payload-analysis.ts';
import {createSavedSessionLoader} from '../src/offline/saved-session-loader.ts';
import {presentSavedAnalysis} from '../src/offline/analysis-presentation.ts';
import * as setupModule from '../src/offline/recording-analysis-setup.ts';
import * as contract from '../src/offline/contract.ts';
import * as framing from '../src/offline/framing.ts';
const require=createRequire(import.meta.url),web=require('react-native-web');
const golden=JSON.parse(readFileSync(new URL('./fixtures/analysis-metadata-v2.json',import.meta.url),'utf8'));
function fixture(metadata=structuredClone(golden),view='side_left') {
 const session={id:'operator-setup',createdAt:1,durationMs:10000,sampledFrames:100,poseFrames:100,usableFrameRatio:1,landmarkCount:33,
  view,rawVideoRetained:false,modelSha256:'a'.repeat(64),extractorVersion:'android-pose-0.1.1',timestampMethod:'requested-100ms-nearest-decoded-frame',
  consentVersion:'local-prototype-notice-v1',diagnostics:'rotation=90; side_left; decoded=1920x1080',analysisMetadata:metadata};
 const frames=Array.from({length:100},(_,n)=>({timestampMs:n*100,landmarks:Array.from({length:33},(_,index)=>({index,
  x:index===27||index===28?.5+[-.1,-.07,0,.07,.1,.07,0,-.07][n%8]:.5,
  y:index===23||index===24?.3:index===25||index===26?.5:index===27||index===28?.7:.5,z:0,visibility:.9,presence:.9}))}));
 return {session,frames};
}
function analyze(f=fixture(),setup={}) {return analyzeSavedPayload({selectedSessionId:f.session.id,
 sessionRead:{sessionId:f.session.id,status:'loaded',payload:JSON.stringify(f.session)},
 framesRead:{sessionId:f.session.id,status:'loaded',payload:JSON.stringify(f.frames)},setup});}
const unassessed=()=>({status:'unassessed',value:null,source:null});
for(const direction of [1,-1,null])test('recording snapshot serializes explicit image-x direction '+direction,()=>{
 const s=snapshotRecordingSetup('side_right',direction,true);
 assert.deepEqual(JSON.parse(serializeRecordingSetup(s)),{contractVersion:'recording-analysis-setup-1',direction,upright:true});
 assert.ok(Object.isFrozen(s));
});
for(const view of ['side_left','side_right'])test(view+' cannot supply direction or upright',()=>{
 const s=snapshotRecordingSetup(view,null,false);assert.equal(s.direction,null);assert.equal(s.upright,null);
 const f=fixture(undefined,view);f.session.analysisMetadata.direction=unassessed();f.session.analysisMetadata.upright=unassessed();
 const r=analyze(f);assert.equal(r.analysis.context.direction,null);assert.equal(r.analysis.context.upright,false);
});
test('attempt binding prevents overwrite and clears before a new recording',()=>{
 const b=createRecordingSetupBinding(),draft={direction:1,upright:true};b.start('side_left',draft.direction,draft.upright);
 draft.direction=-1;draft.upright=false;assert.deepEqual(b.get(),{view:'side_left',direction:1,upright:true});
 assert.throws(()=>b.start('side_right',-1,false));b.clear();assert.equal(b.get(),null);
 assert.deepEqual(b.start('side_right',null,false),{view:'side_right',direction:null,upright:null});
 b.clear();b.clear();assert.equal(b.get(),null);
});
test('v2 fixture parser preserves operator assertions and native geometry independently',()=>{
 const r=readAnalysisMetadata(golden);assert.equal(r.status,'recognized');assert.deepEqual(r.metadata,golden);
});
test('v1 remains unassessed and rejects persisted assessed values',()=>{
 const v1=JSON.parse(readFileSync(new URL('./fixtures/analysis-metadata-v1.json',import.meta.url),'utf8'));
 assert.equal(readAnalysisMetadata(v1).status,'recognized');assert.deepEqual(v1.direction,unassessed());
 assert.equal(analyze(fixture(v1)).analysis.components.motion.reasons[0],'direction_required');
 v1.direction=golden.direction;assert.equal(readAnalysisMetadata(v1).reason,'invalid_analysis_metadata');
});
for(const [key,value] of [['direction',0],['direction',2],['direction','1'],['direction',true],['upright',false],['upright',1],['upright','true']])
 test('malformed '+key+' assertion '+JSON.stringify(value)+' cannot be bypassed with caller setup',()=>{
 const f=fixture();f.session.analysisMetadata[key].value=value;
 assert.equal(readAnalysisMetadata(f.session.analysisMetadata).reason,'invalid_analysis_metadata');
 const r=analyze(f,{direction:1,upright:true});assert.deepEqual(r.analysis.components.motion.reasons,['invalid_persisted_setup']);
});
for(const key of ['direction','upright'])test('unknown '+key+' source is rejected',()=>{
 const m=structuredClone(golden);m[key].source='camera-rotation';assert.equal(readAnalysisMetadata(m).reason,'invalid_analysis_metadata');
});
for(const direction of [1,-1])test('persisted '+direction+' direction and upright reach the detector without caller setup',()=>{
 const f=fixture();f.session.analysisMetadata.direction.value=direction;const r=analyze(f);
 assert.equal(r.analysis.context.direction,direction);assert.equal(r.analysis.context.upright,true);
 assert.equal(r.analysis.components.motion.status,'available');assert.ok(r.analysis.components.motion.result.candidates.length>0);
 assert.ok(Math.abs(r.analysis.components.motion.result.observations[0].value-direction*(-.1))<1e-8);
 assert.equal(r.setupProvenance.direction,'operator-recording-setup');assert.equal(r.setupProvenance.upright,'operator-recording-setup');
 assert.equal(r.analysis.components.knee.result.geometry.source,'native-inference-bitmap');
 assert.ok(r.analysis.components.intervals.reasons.includes('continuity_unknown'));
 assert.equal(r.analysis.components.intervals.result.directionSource,'operator-recording-setup');
 assert.equal(r.analysis.components.intervals.status,'unavailable');
});
test('matching caller setup retains authoritative persisted operator provenance',()=>{
 const r=analyze(fixture(),{direction:1,upright:true});assert.equal(r.analysis.components.motion.status,'available');
 assert.equal(r.setupProvenance.direction,'operator-recording-setup');assert.equal(r.setupProvenance.upright,'operator-recording-setup');
});
for(const direction of [1,-1])for(const matching of [false,true])test(`persisted ${direction} intervals with checked detector continuity, matching caller ${matching}`,()=>{
 const f=fixture();f.session.analysisMetadata.direction.value=direction;
 const setup={continuity:'detector-segments',...(matching?{direction,upright:true}:{})};
 const r=analyze(f,setup),i=r.analysis.components.intervals;
 assert.equal(i.status,'available');assert.equal(i.result.directionSource,'operator-recording-setup');
 assert.equal(i.result.continuity,'detector-segments');
 assert.deepEqual(i.result.polarities.map(p=>p.summary.count),[11,11]);
 assert.ok(i.result.polarities.every(p=>p.intervals.every(v=>v.elapsedMs===800)));
 assert.equal(i.result.timestampProvenance.actualDecodedFrameTimes,false);
 assert.equal(r.analysis.components.knee.result.geometry.source,'native-inference-bitmap');
 assert.equal(r.setupProvenance.direction,'operator-recording-setup');
});
for(const [setup,reasons] of [[{direction:-1},['direction_conflict']],[{upright:false},['upright_conflict']],
 [{direction:-1,upright:false},['direction_conflict','upright_conflict']]])test('conflicts '+reasons+' disable motion and intervals only',()=>{
 const r=analyze(fixture(),setup);assert.equal(r.status,'partial');assert.equal(r.analysis.components.knee.status,'available');
 assert.equal(r.analysis.components.motion.status,'unavailable');assert.equal(r.analysis.components.motion.result,null);
 assert.deepEqual(r.analysis.components.motion.reasons,reasons);assert.deepEqual(r.analysis.components.intervals.reasons,['motion_setup_unavailable',...reasons]);
 assert.equal(r.analysis.components.intervals.result,null);
});
test('v2 unassessed fields preserve caller-only behavior',()=>{
 const f=fixture();f.session.analysisMetadata.direction=unassessed();f.session.analysisMetadata.upright=unassessed();
 const missing=analyze(f);assert.equal(missing.analysis.components.motion.reasons[0],'direction_required');
 const r=analyze(f,{direction:-1,upright:true});assert.equal(r.analysis.components.motion.status,'available');
 assert.equal(r.setupProvenance.direction,'caller-asserted');assert.equal(r.setupProvenance.upright,'caller-asserted');
});
test('upright alone does not supply direction and direction alone does not confirm upright',()=>{
 for(const key of ['direction','upright']){const f=fixture();f.session.analysisMetadata[key]=unassessed();
  assert.ok(analyze(f).analysis.components.motion.reasons.includes(key+'_required'));}
});
test('valid setup does not bypass landmark quality requirements',()=>{
 const f=fixture();f.frames.forEach(frame=>frame.landmarks[24].visibility=.1);
 const r=analyze(f);assert.equal(r.analysis.components.motion.status,'unavailable');assert.ok(r.analysis.components.motion.reasons.includes('low_visibility'));
 assert.ok(r.analysis.components.motion.result.observations.every(o=>o.value===null));
});
test('diagnostics and rotations never establish assertions; missing PTS/image evidence remains',()=>{
 const f=fixture();f.session.analysisMetadata.direction=unassessed();f.session.analysisMetadata.upright=unassessed();
 const r=analyze(f);assert.equal(r.analysis.context.direction,null);assert.equal(r.analysis.context.upright,false);
 assert.equal(r.analysis.evidence.actualFramePts,'not-available');assert.equal(r.analysis.evidence.exactImageCorrespondence,'not-established');
 assert.equal(r.binding.verification,'caller-bound-ids-only');assert.equal(r.scientificStatus,'NOT_EVALUATED');
});
test('production loader and presentation distinguish persisted assertions and caller conflicts',async()=>{
 const f=fixture(),loader=createSavedSessionLoader({listSessions:async()=>JSON.stringify([f.session]),readFrames:async()=>JSON.stringify(f.frames)});
 await loader.select(f.session.id);let p=presentSavedAnalysis(loader.getState());
 assert.equal(p.setup.direction.status,'persisted-operator');assert.equal(p.setup.direction.value,1);assert.equal(p.setup.direction.source,'operator-recording-setup');
 assert.equal(p.setup.upright.status,'persisted-operator');assert.equal(p.setup.upright.value,true);assert.equal(p.setup.geometry.status,'persisted-native');
 assert.equal(p.scientificStatus,'NOT_EVALUATED');
 await loader.select(f.session.id,{direction:-1,upright:false});p=presentSavedAnalysis(loader.getState());
 assert.equal(p.setup.direction.status,'conflict');assert.equal(p.setup.direction.value,null);assert.equal(p.setup.upright.status,'conflict');
 assert.equal(p.setup.upright.value,null);
 assert.deepEqual(p.components.motion.reasons,['direction_conflict','upright_conflict']);
});
test('v2 summary JSON roundtrip through production SQLite schema preserves explicit assertions',()=>{
 const kotlin=readFileSync(new URL('../modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt',import.meta.url),'utf8');
 const db=new DatabaseSync(':memory:');try {
  db.exec('PRAGMA foreign_keys=ON');for(const match of kotlin.matchAll(/db\.execSQL\("(CREATE TABLE [^"]+)"\)/g))db.exec(match[1]);
  const f=fixture();db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(f.session.id,1,JSON.stringify(f.session));
  const loaded=contract.parseSession(db.prepare('SELECT summary FROM sessions WHERE id=?').get(f.session.id).summary);
  const r=analyze({session:loaded,frames:f.frames});assert.equal(r.analysis.context.direction,1);assert.equal(r.analysis.context.upright,true);
  assert.deepEqual(loaded.analysisMetadata.direction,{status:'asserted',value:1,source:'operator-recording-setup'});
 }finally{db.close();}
});
function component(file,replacements) {
 const source=readFileSync(new URL('../src/offline/'+file,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};new Function('require','module','exports',js)(id=>Object.hasOwn(replacements,id)?replacements[id]:require(id),module,module.exports);return module.exports;
}
test('actual setup controls expose separate accessible direction radios and upright checkbox',()=>{
 const controls=[],native={...web,Pressable:props=>{controls.push(props);return React.createElement(web.Pressable,props);}};
 const C=component('RecordingAnalysisSetupControls.tsx',{'react-native':native}).RecordingAnalysisSetupControls;
 const selected=[];let upright=false;
 const html=renderToStaticMarkup(React.createElement(C,{direction:null,upright:false,disabled:false,onDirection:v=>selected.push(v),onUpright:v=>{upright=v;}}));
 assert.match(html,/image orientation is upright/);assert.match(html,/Holding the phone upright alone does not establish this/);
 const radios=controls.filter(c=>c.accessibilityRole==='radio');assert.equal(radios.length,3);assert.equal(radios[0].accessibilityState.checked,true);
 radios[1].onPress();radios[2].onPress();radios[0].onPress();assert.deepEqual(selected,[1,-1,null]);
 const checkbox=controls.find(c=>c.accessibilityRole==='checkbox');assert.equal(checkbox.accessibilityLabel,'Confirm upright image orientation for this recording');
 checkbox.onPress();assert.equal(upright,true);assert.equal(new Set(controls.map(c=>c.accessibilityLabel)).size,4);
 for(const c of controls)assert.ok(c.style.minHeight>=48);
});
test('setup controls announce disabled state while the recording snapshot is locked',()=>{
 const controls=[],native={...web,Pressable:props=>{controls.push(props);return React.createElement(web.Pressable,props);}};
 const C=component('RecordingAnalysisSetupControls.tsx',{'react-native':native}).RecordingAnalysisSetupControls;
 renderToStaticMarkup(React.createElement(C,{direction:-1,upright:true,disabled:true,onDirection(){},onUpright(){}}));
 assert.equal(controls.length,4);assert.ok(controls.every(c=>c.disabled&&c.accessibilityState.disabled));
});
test('actual capture/native wiring snapshots before countdown and passes the same setup with captured side',()=>{
 const ui=readFileSync(new URL('../src/offline/OfflineCapture.tsx',import.meta.url),'utf8');
 assert.match(ui,/recordingSetup.current.start\(view,direction,upright\);[\s\S]*for\(let i=3/);
 assert.match(ui,/processVideoWithSetup\(source,setup.view,consent,serializeRecordingSetup\(setup\)\)/);
 assert.match(ui,/if\(!uriRef.current\) resetSetup\(\)/);assert.match(ui,/mounted.current=false; interrupted.current=true;\s*recordingSetup.current.clear\(\)/);
 const kotlin=readFileSync(new URL('../modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt',import.meta.url),'utf8');
 assert.match(kotlin,/RecordingAnalysisSetup.fromJson\(setupJson\)/);assert.match(kotlin,/\.put\("analysisMetadata", analysisMetadata.toJson\(setup\)\)/);
 assert.match(kotlin,/processRecording\(uri, view, consent, null, promise\)/);
});

// Controlled hooks execute the real capture handlers without a native camera or a
// React scheduler. This checks request/lifetime wiring, not Android rendering.
function captureHarness({processingFails=false}={}) {
 const states=[],refs=[],effects=[],requests=[],discarded=[];let stateIndex=0,refIndex=0,nullRefs=0;
 let resolveClip,rejectClip;const clip=new Promise((resolve,reject)=>{resolveClip=resolve;rejectClip=reject;});
 const camera={recordAsync:()=>clip,stopRecording(){}};
 let cleanupFails=false;
 const f=fixture();const pose={listSessions:async()=>JSON.stringify([f.session]),readFrames:async()=>JSON.stringify(f.frames),cancel(){},
  addListener:()=>({remove(){}}),discardVideo:async uri=>{discarded.push(uri);if(cleanupFails)throw Error('synthetic cleanup failure');},
  processVideoWithSetup:async(...args)=>{requests.push(args);if(processingFails)throw Error('synthetic read failure');return JSON.stringify(f.session);}};
 const react={...React,useState:initial=>{const i=stateIndex++;if(!(i in states))states[i]=initial;
   return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},
  useRef:initial=>{const i=refIndex++;if(!refs[i]){refs[i]={current:initial};if(initial===null&&++nullRefs===2)refs[i].current=camera;}return refs[i];},
  useEffect:fn=>{effects.push(fn);},useCallback:fn=>fn};
 const native={...web,useWindowDimensions:()=>({width:320,height:640}),AppState:{addEventListener:()=>({remove(){}})}};
 function Setup() {return null;}
 const Capture=component('OfflineCapture.tsx',{react,'react-native':native,'expo-camera':{useCameraPermissions:()=>[{granted:true},()=>{}],CameraView:()=>null},
  'expo-video':{useVideoPlayer:()=>null,VideoView:()=>null},'expo-router':{useFocusEffect(){}},'react-native-safe-area-context':{SafeAreaView:web.View},
  '../../modules/gaitsense-pose':{__esModule:true,default:pose},'./contract':contract,'./framing':framing,'./saved-analysis-binding':{},'./SavedAnalysisPanel':{SavedAnalysisPanel:()=>null},
  './recording-analysis-setup':setupModule,'./RecordingAnalysisSetupControls':{RecordingAnalysisSetupControls:Setup}}).default;
 let tree;function render(){stateIndex=refIndex=0;effects.length=0;tree=Capture();return tree;}
 function find(predicate,node){if(Array.isArray(node)){for(const child of node){const result=find(predicate,child);if(result)return result;}}
  else if(React.isValidElement(node)){if(predicate(node))return node;return find(predicate,node.props.children);}return null;}
 render();states[2]=true;states[3]=true;render();
 const cleanups=effects.map(fn=>fn()).filter(fn=>typeof fn==='function');
 return {render,setup:()=>find(n=>n.type===Setup,tree).props,press:label=>find(n=>n.props.label===label,tree).props.onPress(),
  active:()=>refs.find(r=>r.current&&typeof r.current.start==='function').current.get(),resolveClip,rejectClip,requests,discarded,
  failCleanup(value){cleanupFails=value;},cameraReady(){find(n=>typeof n.props.onCameraReady==='function',tree).props.onCameraReady();},
  unmount(){cleanups.forEach(fn=>fn());}};
}
async function flush(){for(let i=0;i<32;i++)await Promise.resolve();}
async function start(h) {
 const previous=globalThis.setTimeout;globalThis.setTimeout=fn=>{queueMicrotask(fn);return 0;};
 try{h.press('Record 15-second video');await flush();}finally{globalThis.setTimeout=previous;}
}
test('real capture snapshots at countdown; later setup changes cannot alter native process request',async()=>{
 const h=captureHarness();h.setup().onDirection(-1);h.setup().onUpright(true);h.render();await start(h);
 assert.deepEqual(h.active(),{view:'side_left',direction:-1,upright:true});
 h.setup().onDirection(1);h.setup().onUpright(false);h.resolveClip({uri:'file:///cache/Camera/mock.mp4'});await flush();h.render();
 h.press('Extract landmarks on this phone');await flush();
 assert.equal(h.requests.length,1);assert.equal(h.requests[0][1],'side_left');
 assert.deepEqual(JSON.parse(h.requests[0][3]),{contractVersion:'recording-analysis-setup-1',direction:-1,upright:true});
 assert.equal(h.active(),null);h.render();assert.equal(h.setup().direction,null);assert.equal(h.setup().upright,false);
});
test('real capture resets setup on discard and cancelled countdown',async()=>{
 const h=captureHarness();h.setup().onDirection(1);h.render();await start(h);h.resolveClip({uri:'file:///cache/Camera/mock.mp4'});await flush();h.render();
 h.press('Discard video / retake');await flush();assert.equal(h.active(),null);h.render();assert.equal(h.setup().direction,null);
 const cancel=captureHarness();cancel.setup().onUpright(true);cancel.render();
 cancel.press('Record 15-second video');cancel.render();cancel.press('Cancel countdown');
 // The existing countdown timer checks cancellation on its next wake; do not bypass it.
 await new Promise(resolve=>setTimeout(resolve,1100));await flush();assert.equal(cancel.active(),null);cancel.render();assert.equal(cancel.setup().upright,false);
});
test('real capture clears setup after recording or processing failure',async()=>{
 const recording=captureHarness();await start(recording);recording.rejectClip(Error('synthetic camera failure'));await flush();assert.equal(recording.active(),null);
 const processing=captureHarness({processingFails:true});processing.setup().onDirection(1);processing.render();await start(processing);
 processing.resolveClip({uri:'file:///cache/Camera/mock.mp4'});await flush();processing.render();processing.press('Extract landmarks on this phone');await flush();
 assert.equal(processing.active(),null);assert.ok(processing.discarded.includes('file:///cache/Camera/mock.mp4'));
});
test('real unmount clears setup and late camera completion discards rather than processing',async()=>{
 const h=captureHarness();h.setup().onDirection(-1);h.render();await start(h);h.unmount();assert.equal(h.active(),null);
 h.resolveClip({uri:'file:///cache/Camera/mock.mp4'});await flush();assert.equal(h.requests.length,0);assert.deepEqual(h.discarded,['file:///cache/Camera/mock.mp4']);
});
test('failed discard retains the original setup; successful retry resets the next recording',async()=>{
 const h=captureHarness();h.setup().onDirection(1);h.setup().onUpright(true);h.render();await start(h);
 h.resolveClip({uri:'file:///cache/Camera/mock.mp4'});await flush();h.render();h.failCleanup(true);h.press('Discard video / retake');await flush();
 assert.deepEqual(h.active(),{view:'side_left',direction:1,upright:true});h.render();assert.equal(h.setup().disabled,true);
 h.failCleanup(false);h.press('Discard video / retake');await flush();h.render();assert.equal(h.active(),null);
 assert.equal(h.setup().direction,null);assert.equal(h.setup().upright,false);h.cameraReady();h.render();await start(h);
 assert.deepEqual(h.active(),{view:'side_left',direction:null,upright:null});
});
