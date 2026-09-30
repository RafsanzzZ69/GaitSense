import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import * as binding from '../src/offline/saved-analysis-binding.ts';
import * as framing from '../src/offline/framing.ts';
import * as contract from '../src/offline/contract.ts';
import {createSavedSessionLoader} from '../src/offline/saved-session-loader.ts';
import {presentSavedAnalysis} from '../src/offline/analysis-presentation.ts';

// Existing Node runner + installed TypeScript/React DOM/react-native-web. This is
// real server rendering of production TSX, NOT a mounted native renderer. Event
// props are captured before RN Web consumes them. Expansion uses a controlled hook
// value to check the real handler and both branches, not a simulated React scheduler.
const require=createRequire(import.meta.url), web=require('react-native-web');
function component(file, replacements) {
 const source=readFileSync(new URL(`../src/offline/${file}`,import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const module={exports:{}};
 new Function('require','module','exports',js)(id=>Object.hasOwn(replacements,id)?replacements[id]:require(id),module,module.exports);
 return module.exports;
}
function renderer({expanded,history,phase='ready'}={}) {
 const controls=[],texts=[],views=[];
 const native={...web,useWindowDimensions:()=>({width:320,height:640}),
  Pressable:props=>{controls.push(props);return React.createElement(web.Pressable,props);},
  Text:props=>{texts.push(props);return React.createElement(web.Text,props);},
  View:props=>{views.push(props);return React.createElement(web.View,props);}};
 let requestedExpansion=expanded,arrayState=0;
 const react=expanded===undefined?React:{...React,useState:()=>[expanded,value=>{requestedExpansion=typeof value==='function'?value(expanded):value;}]};
 const Panel=component('SavedAnalysisPanel.tsx',{'react-native':native,react,'./saved-analysis-binding':binding}).SavedAnalysisPanel;
 function render(p,onClear=()=>{}) {
  controls.length=0;texts.length=0;views.length=0;
  return renderToStaticMarkup(React.createElement(Panel,{presentation:p,onClear}));
 }
 function screen() {
  const OfflineCapture=component('OfflineCapture.tsx',{'react-native':native,
   react:{...React,useState:initial=>React.useState(initial==='ready'?phase:Array.isArray(initial)&&arrayState++===0?history:initial)},
   'expo-router':{useFocusEffect(){}},'expo-camera':{useCameraPermissions:()=>[{granted:false},()=>{}]},
   'expo-video':{},'react-native-safe-area-context':{SafeAreaView:web.View},
   '../../modules/gaitsense-pose':{default:{}},'./framing':framing,'./contract':contract,
   './saved-analysis-binding':binding,'./SavedAnalysisPanel':{SavedAnalysisPanel:Panel}}).default;
  return renderToStaticMarkup(React.createElement(OfflineCapture));
 }
 return {render,screen,controls,texts,views,get requestedExpansion(){return requestedExpansion;}};
}
function fixture(id='A') {
 const session={id,createdAt:1,durationMs:10000,sampledFrames:100,poseFrames:100,usableFrameRatio:1,
  landmarkCount:33,view:'side_left',rawVideoRetained:false,modelSha256:'a'.repeat(64),extractorVersion:'android-pose-0.1.1',
  timestampMethod:'requested-100ms-nearest-decoded-frame',consentVersion:'local-prototype-notice-v1',diagnostics:'decoded=1920x1080'};
 const frames=Array.from({length:100},(_,n)=>({timestampMs:n*100,landmarks:Array.from({length:33},(_,index)=>({index,
  x:index===27?.5+[-.1,-.07,0,.07,.1,.07,0,-.07][n%8]:.5,y:index===23?.3:index===25?.5:index===27?.7:.5,z:0,visibility:.9,presence:.9}))}));
 const setup={geometry:{inferenceWidth:768,inferenceHeight:432,source:'caller-asserted-inference-dimensions',
  assumption:'constant-inference-dimensions-within-session'},direction:1,upright:true,continuity:'detector-segments'};
 return {session,frames,setup};
}
function reads(f=fixture(),overrides={}) {return {listSessions:async()=>JSON.stringify([f.session]),readFrames:async()=>JSON.stringify(f.frames),...overrides};}
async function loaded(f=fixture(),setup=f.setup,overrides={}) {
 const loader=createSavedSessionLoader(reads(f,overrides));await loader.select(f.session.id,setup);return presentSavedAnalysis(loader.getState());
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function racing() {
 const pending=[],publications=[],r=renderer();
 const b=binding.createSavedAnalysisBinding(reads(fixture(),{listSessions:async()=>JSON.stringify([fixture('A').session,fixture('B').session]),
  readFrames:()=>{const d=deferred();pending.push(d);return d.promise;}}),p=>publications.push({p,html:r.render(p)}));
 return {b,pending,publications};
}

test('actual History row renders a session-specific accessible analysis control; initial panel is absent',()=>{
 const session=Object.freeze(fixture().session),history=Object.freeze([session]),r=renderer({history});
 const html=r.screen(),button=r.controls.find(c=>c.accessibilityLabel==='View saved analysis for session A');
 assert.ok(button);assert.equal(button.accessibilityRole,'button');assert.equal(button.disabled,false);
 assert.match(html,/View saved analysis/);assert.doesNotMatch(html,/Close saved analysis/);
 assert.equal(history[0],session);
});
test('loading renders identity and a polite status heading without old measurements',()=>{
 const l=createSavedSessionLoader(reads());void l.select('A');const r=renderer(),html=r.render(presentSavedAnalysis(l.getState()));
 assert.match(html,/Loading saved session/);assert.match(html,/Selected session: A/);assert.doesNotMatch(html,/0 degrees/);
 assert.ok(r.texts.some(t=>t.children==='Loading saved session'&&t.accessibilityLiveRegion==='polite'&&t.accessibilityRole==='header'));
});
test('analysis control exposes disabled state while native processing is active',()=>{
 const r=renderer({history:[fixture().session],phase:'processing'});r.screen();
 const button=r.controls.find(c=>c.accessibilityLabel==='View saved analysis for session A');
 assert.equal(button.disabled,true);assert.equal(button.accessibilityState.disabled,true);
});
test('native read failure and rejected JSON have distinct rendered headings',async()=>{
 const failed=await loaded(fixture(),{}, {readFrames:async()=>{throw Error('synthetic read failure');}});
 const rejected=await loaded(fixture(),{}, {readFrames:async()=>'{'}),r=renderer();
 assert.match(r.render(failed),/Saved-session read failed/);assert.match(r.render(failed),/Data: failed/);
 assert.match(r.render(rejected),/Saved data or setup could not be accepted/);assert.match(r.render(rejected),/Data: rejected/);
 assert.match(r.render(rejected),/malformed frames json/);
});
test('partial rendering keeps missing knee geometry separate from available motion and intervals',async()=>{
 const f=fixture();delete f.setup.geometry;const p=await loaded(f),html=renderer({expanded:true}).render(p);
 assert.match(html,/Partial analysis/);assert.match(html,/Projected 2D knee flexion · unavailable/);
 assert.match(html,/Candidate ankle-motion extrema · available/);assert.match(html,/maximum candidate at 400 ms requested/);
 assert.match(html,/800 milliseconds/);assert.match(html,/missing geometry/);
});
test('loaded but fully unavailable displays all missing setup and excludes diagnostic geometry',async()=>{
 const html=renderer().render(await loaded(fixture(),{}));
 assert.match(html,/Analysis unavailable/);assert.match(html,/Data: loaded/);
 assert.match(html,/Explicit inference dimensions valid throughout this session: required/);
 assert.match(html,/One travel direction in image x: required/);assert.match(html,/Explicit upright orientation confirmation: required/);
 assert.doesNotMatch(html,/decoded=1920x1080|1920 × 1080/);
});
for(const key of ['direction','upright'])test(`missing ${key} renders a reason without disabling supported knee output`,async()=>{
 const f=fixture();delete f.setup[key];const html=renderer({expanded:true}).render(await loaded(f));
 assert.match(html,/Partial analysis/);assert.match(html,/Projected 2D knee flexion · available/);
 assert.match(html,key==='direction'?/direction required/:/upright required/);
});
test('null observation renders Unavailable, genuine numeric zero remains a number',async()=>{
 const r=renderer({expanded:true}),missing=r.render(await loaded(fixture(),{}));
 assert.match(missing,/200 ms requested: Unavailable; missing geometry/);assert.doesNotMatch(missing,/0 degrees/);
 assert.match(r.render(await loaded()),/200 ms requested: 0 degrees; none/);
});
test('expand and collapse handlers request opposite state; both rendered branches announce it',async()=>{
 const p=await loaded(),closed=renderer({expanded:false});const closedHtml=closed.render(p);
 const show=closed.controls.find(c=>c.accessibilityLabel?.startsWith('Show observations and exclusions for Projected'));
 assert.equal(show.accessibilityState.expanded,false);assert.doesNotMatch(closedHtml,/200 ms requested: 0 degrees/);
 show.onPress();assert.equal(closed.requestedExpansion,true);
 const open=renderer({expanded:true}),openHtml=open.render(p);
 const hide=open.controls.find(c=>c.accessibilityLabel?.startsWith('Hide observations and exclusions for Projected'));
 assert.equal(hide.accessibilityState.expanded,true);assert.match(openHtml,/200 ms requested: 0 degrees/);
 hide.onPress();assert.equal(open.requestedExpansion,false);
});
test('component exclusions are retained when expanded; evidence is visible even when collapsed',async()=>{
 const f=fixture();f.frames[20].landmarks[23].presence=.2;const p=await loaded(f);
 const html=renderer({expanded:true}).render(p);assert.match(html,/2000 ms requested: Unavailable; low presence/);
 assert.match(html,/Excluded observation 0: boundary support/);
 const closed=renderer().render(p);assert.match(closed,/Actual decoded-frame PTS unavailable/);
 assert.match(closed,/Exact-image correspondence not established/);assert.match(closed,/not independently authenticated/);
});
test('labels and scientific status describe research outputs without validated gait claims',async()=>{
 const r=renderer(),html=r.render(await loaded());
 assert.match(html,/NOT_EVALUATED \(not scientifically evaluated\)/);
 const headings=r.texts.filter(t=>t.accessibilityRole==='header').map(t=>t.children).join('\n');
 assert.match(headings,/Projected 2D knee flexion/);assert.match(headings,/Candidate ankle-motion extrema/);
 assert.match(headings,/Candidate-to-candidate temporal intervals/);
 assert.doesNotMatch(headings,/heel strikes?|steps?|strides?|contacts?|cadence|clinical/i);
 assert.ok(r.texts.some(t=>t.accessibilityLabel==='Scientific status: not evaluated. Research prototype, not a health assessment.'));
 assert.match(html,/not validated step or stride times/);
});
test('interactive controls have roles, unique expansion labels and at least 48 point expansion targets',async()=>{
 const r=renderer();r.render(await loaded());const expand=r.controls.filter(c=>c.accessibilityState?.expanded!==undefined);
 assert.equal(expand.length,3);assert.equal(new Set(expand.map(c=>c.accessibilityLabel)).size,3);
 for(const c of expand){assert.equal(c.accessibilityRole,'button');assert.ok(web.StyleSheet.flatten(c.style).minHeight>=48);}
 assert.equal(r.controls.at(-1).accessibilityRole,'button');assert.ok(web.StyleSheet.flatten(r.controls.at(-1).style).minHeight>=48);
});
test('long identity/reasons and all bounded observation rows are retained without line caps',async()=>{
 const p=structuredClone(await loaded()),long='Long explanation with unavailable evidence. '.repeat(50);
 p.selection.sessionId='session-'+ 'x'.repeat(240);p.components.knee.reasons=[long];
 const r=renderer({expanded:true}),html=r.render(p);
 assert.ok(html.includes(p.selection.sessionId));assert.ok(html.includes(long));assert.match(html,/9900 ms requested/);
 assert.match(html,/maximum candidate at 9200 ms requested/);assert.match(html,/8400 → 9200 ms requested: 800 milliseconds/);
 assert.ok(r.texts.every(t=>t.numberOfLines===undefined&&t.ellipsizeMode===undefined));
 assert.ok(r.views.every(v=>web.StyleSheet.flatten(v.style)?.height===undefined));
 // Content retention and style constraints only: SSR does not measure Android wrapping.
});
for(const same of [false,true])test(`rendered publications ignore obsolete ${same?'same-ID':'other-session'} completion`,async()=>{
 const h=racing(),a=h.b.select('A');await Promise.resolve();const b=h.b.select(same?'A':'B');await Promise.resolve();
 assert.equal(h.publications.at(-1).p.selection.generation,2);assert.match(h.publications.at(-1).html,/Loading saved session/);
 h.pending[1].resolve(JSON.stringify(fixture().frames));await b;const count=h.publications.length,last=h.publications.at(-1);
 assert.match(last.html,new RegExp(`Selected session: ${same?'A':'B'}`));
 h.pending[0].reject(Error('obsolete error'));await a;assert.equal(h.publications.length,count);assert.equal(h.publications.at(-1),last);
});
test('close control clears selection and suppresses late completion; reopening gets fresh loading',async()=>{
 const h=racing(),a=h.b.select('A');await Promise.resolve();const r=renderer();
 r.render(h.publications.at(-1).p,()=>h.b.clear());r.controls.at(-1).onPress();
 assert.equal(h.publications.at(-1).p.status,'unselected');const count=h.publications.length;
 h.pending[0].resolve('[]');await a;assert.equal(h.publications.length,count);
 const b=h.b.select('B');await Promise.resolve();assert.match(h.publications.at(-1).html,/Loading saved session/);
 h.pending[1].resolve(JSON.stringify(fixture().frames));await b;assert.match(h.publications.at(-1).html,/Selected session: B/);
});
test('background invalidation removes identity and measurements from rendered publication',async()=>{
 const h=racing(),a=h.b.select('A');await Promise.resolve();h.b.leave();const last=h.publications.at(-1),count=h.publications.length;
 assert.match(last.html,/Selected session: None/);assert.doesNotMatch(last.html,/0 degrees/);
 h.pending[0].resolve('[]');await a;assert.equal(h.publications.length,count);
});
test('disposed binding never invokes rendering subscriber after pending completion',async()=>{
 const h=racing(),a=h.b.select('A');await Promise.resolve();h.b.dispose();const count=h.publications.length;
 h.pending[0].reject(Error('after unmount'));await a;await h.b.select('B');assert.equal(h.publications.length,count);
});
test('native lifecycle wiring disposes on blur/unmount, invalidates on background and hides cleared selection',()=>{
 const source=readFileSync(new URL('../src/offline/OfflineCapture.tsx',import.meta.url),'utf8');
 assert.match(source,/useFocusEffect\(useCallback\(\(\)=>\{\s*setAnalysis\(null\)/);
 assert.match(source,/return \(\)=>\{binding\.dispose\(\);analysisBinding\.current=null;/);
 assert.match(source,/if\(state !== 'active'\) \{\s*analysisBinding\.current\?\.leave\(\)/);
 assert.match(source,/analysis && analysis.status!=='unselected' && <SavedAnalysisPanel/);
 assert.match(source,/select\(s.id\)/);
 const panel=readFileSync(new URL('../src/offline/SavedAnalysisPanel.tsx',import.meta.url),'utf8');
 assert.match(panel,/key=\{`\$\{presentation.selection.generation\}:\$\{group.title\}`\}/);
 // These are wiring assertions, not a mounted Router/AppState lifecycle test.
});
