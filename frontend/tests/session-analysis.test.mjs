import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSavedSession as run} from '../src/offline/session-analysis.ts';
function fixture(){return {session:{id:'s',createdAt:1,durationMs:10000,sampledFrames:100,poseFrames:100,usableFrameRatio:1,landmarkCount:33,
 view:'side_left',rawVideoRetained:false,modelSha256:'a'.repeat(64),extractorVersion:'android-pose-0.1.1',timestampMethod:'requested-100ms-nearest-decoded-frame',
 consentVersion:'local-prototype-notice-v1',diagnostics:'decoded=768x768'},
 frames:Array.from({length:100},(_,n)=>({timestampMs:n*100,landmarks:Array.from({length:33},(_,index)=>({index,
 x:index===27?.5+[-.1,-.07,0,.07,.1,.07,0,-.07][n%8]:.5,y:index===23?.3:index===25?.5:index===27?.7:.5,z:0,visibility:.9,presence:.9}))})),
 context:{sessionId:'s',participantId:null,attemptId:'a',view:'side_left',side:'left',direction:1,upright:true,continuity:'detector-segments'},
 processing:{status:'completed',reason:null}};}
test('real composition yields straight knee and exact 800ms intervals',()=>{
 const r=run(fixture());assert.equal(r.status,'available');assert.equal(r.components.knee.result.observations[2].value,0);
 assert.equal(r.components.motion.result.candidates.length,24);assert.ok(Math.abs(r.components.intervals.result.polarities[0].summary.meanMs-800)<1e-12);
 assert.equal(r.components.intervals.result.polarities[0].summary.count,11);
});
test('knee survives missing direction',()=>{const f=fixture();f.context.direction=null;const r=run(f);assert.equal(r.components.knee.status,'available');assert.equal(r.components.motion.status,'unavailable');assert.ok(r.components.motion.reasons.includes('direction_required'));assert.equal(r.status,'partial');});
test('motion survives missing knee geometry',()=>{const f=fixture();delete f.session.diagnostics;const r=run(f);assert.equal(r.components.knee.status,'unavailable');assert.equal(r.components.motion.status,'available');assert.ok(r.components.knee.reasons.includes('missing_geometry'));});
test('intervals unavailable despite candidates when continuity unknown',()=>{const f=fixture();f.context.continuity='unknown';const r=run(f);assert.ok(r.components.motion.result.candidates.length>0);assert.equal(r.components.intervals.status,'unavailable');assert.ok(r.components.intervals.reasons.includes('continuity_unknown'));});
test('quality masks and exclusions survive',()=>{const f=fixture();f.frames[12].landmarks[23].presence=0;const r=run(f);assert.equal(r.components.knee.result.observations[12].value,null);assert.ok(r.components.motion.result.exclusions.length>0);assert.ok(r.components.intervals.reasons.includes('segment_mismatch'));});
for(const [field,value,reason] of [['sessionId','other','session_identity_mismatch'],['side','right','view_side_mismatch'],['view','side_right','view_side_mismatch']])test(`reject ${field}`,()=>{const f=fixture();f.context[field]=value;const r=run(f);assert.equal(r.status,'incompatible');assert.ok(r.reasons.includes(reason));});
test('direction reversal preserved and invalid assertion rejected',()=>{const f=fixture();f.context.direction=-1;let r=run(f);assert.ok(r.components.intervals.result.candidates.every(c=>c.direction===-1));f.context.direction=0;r=run(f);assert.equal(r.components.motion.status,'unavailable');});
test('unknown PTS/images and local candidate IDs never become authenticity claims',()=>{const r=run(fixture());assert.equal(r.evidence.actualFramePts,'not-available');assert.equal(r.evidence.exactImageCorrespondence,'not-established');assert.equal(r.evidence.candidateIdentity,'analysis-local-index-not-persistent');assert.equal(r.components.intervals.result.timestampProvenance.actualDecodedFrameTimes,false);assert.equal(r.scientificStatus,'NOT_EVALUATED');});
test('flat valid motion produces zero candidates, not processing failure',()=>{const f=fixture();f.frames.forEach(x=>x.landmarks[27].x=.5);const r=run(f);assert.equal(r.processing.status,'completed');assert.equal(r.components.motion.result.candidates.length,0);assert.equal(r.components.motion.status,'insufficient_evidence');assert.equal(r.components.intervals.status,'unavailable');});
test('failed processing differs from completed empty input',()=>{const f=fixture();f.processing={status:'failed',reason:'synthetic decode failure'};assert.equal(run(f).status,'failed');f.processing={status:'completed',reason:null};f.frames=[];const r=run(f);assert.notEqual(r.status,'failed');assert.ok(r.components.knee.reasons.includes('no_observations'));});
test('source and component versions preserved',()=>{const r=run(fixture());assert.equal(r.session.extractorVersion,'android-pose-0.1.1');assert.equal(r.components.knee.result.algorithmVersion,'projected-knee-1');assert.equal(r.components.motion.result.algorithmVersion,'ankle-motion-extrema-1');assert.equal(r.components.intervals.result.algorithmVersion,'candidate-motion-interval-1');});
test('deterministic no input mutation, chronology never sorted',()=>{const f=fixture(),copy=structuredClone(f);assert.deepEqual(run(f),run(f));assert.deepEqual(f,copy);f.frames.reverse();const r=run(f);assert.ok(r.components.motion.reasons.includes('decreasing_timestamp'));});
test('arbitrary saved Session ID blocks only incompatible interval IDs',()=>{const f=fixture();f.session.id=f.context.sessionId='id with spaces';const r=run(f);assert.equal(r.components.knee.status,'available');assert.ok(r.components.intervals.reasons.includes('interval_session_id_incompatible'));});
test('sparse arrays fail safely without invoking unsafe detector iteration',()=>{const f=fixture();delete f.frames[1];assert.equal(run(f).status,'incompatible');});

