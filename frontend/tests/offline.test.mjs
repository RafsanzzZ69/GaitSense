import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { canProcess, canRecord, parseFrames, parseSession } from '../src/offline/contract.ts';

const summary=()=>({id:'synthetic-test',createdAt:1,durationMs:12000,sampledFrames:120,poseFrames:100,
  usableFrameRatio:.8,landmarkCount:33,view:'side_left',rawVideoRetained:false,
  modelSha256:'a'.repeat(64),extractorVersion:'test',consentVersion:'local-prototype-notice-v1',
  timestampMethod:'requested-100ms-nearest-decoded-frame'});
const frame=()=>({timestampMs:0,landmarks:Array.from({length:33},(_,index)=>({index,x:.5,y:.5,z:0,visibility:.8,presence:.8}))});
test('offline recording requires native module, consent, camera ready and idle state',()=>{
  assert.equal(canRecord('ready',true,true,true),true);
  for(const phase of ['countdown','recording','preview','processing']) assert.equal(canRecord(phase,true,true,true),false);
  assert.equal(canRecord('ready',false,true,true),false);
  assert.equal(canRecord('ready',true,false,true),false);
  assert.equal(canRecord('ready',true,true,false),false);
});
test('offline processing only accepts consented local preview',()=>{
  assert.equal(canProcess('preview','file:///cache/Camera/test.mp4',true),true);
  assert.equal(canProcess('recording','file:///test.mp4',true),false);
  assert.equal(canProcess('preview','https://example.com/video',true),false);
  assert.equal(canProcess('preview',null,true),false);
  assert.equal(canProcess('preview','file:///test.mp4',false),false);
});
test('saved summary accepts real contract and refuses malformed/privacy mismatches',()=>{
  assert.equal(parseSession(JSON.stringify(summary())).landmarkCount,33);
  for(const [key,value] of Object.entries({rawVideoRetained:true,landmarkCount:32,usableFrameRatio:.3,poseFrames:999,durationMs:100,view:'front',modelSha256:'missing'})) {
    assert.throws(()=>parseSession(JSON.stringify({...summary(),[key]:value})));
  }
});
test('pose frame validation requires 33 finite landmarks and ordered timestamps',()=>{
  assert.equal(parseFrames(JSON.stringify([frame()])).length,1);
  assert.throws(()=>parseFrames(JSON.stringify([frame(),frame()])));
  const short=frame();short.landmarks.pop();assert.throws(()=>parseFrames(JSON.stringify([short])));
  const missing=frame();missing.landmarks[0].x=null;assert.throws(()=>parseFrames(JSON.stringify([missing])));
  const confidence=frame();confidence.landmarks[0].visibility=2;assert.throws(()=>parseFrames(JSON.stringify([confidence])));
});
const kotlin=readFileSync(new URL('../modules/gaitsense-pose/android/src/main/java/expo/modules/gaitsensepose/GaitSensePoseModule.kt',import.meta.url),'utf8');
function db(){
  const store=new DatabaseSync(':memory:'); store.exec('PRAGMA foreign_keys=ON');
  const definitions=[...kotlin.matchAll(/db\.execSQL\("(CREATE TABLE [^"]+)"\)/g)].map(m=>m[1]);
  assert.equal(definitions.length,2);definitions.forEach(sql=>store.exec(sql));return store;
}
test('actual native SQLite schema persists summaries/frames and cascades deletion',()=>{
  const store=db();try{
    store.prepare('INSERT INTO sessions VALUES (?,?,?)').run('test',1,JSON.stringify(summary()));
    store.prepare('INSERT INTO frames VALUES (?,?,?)').run('test',0,JSON.stringify(frame().landmarks));
    assert.equal(JSON.parse(store.prepare('SELECT landmarks FROM frames WHERE session_id=?').get('test').landmarks).length,33);
    store.prepare('DELETE FROM sessions WHERE id=?').run('test');
    assert.equal(store.prepare('SELECT count(*) AS n FROM frames').get().n,0);
  }finally{store.close();}
});
test('SQLite rollback leaves no partial session or orphan frames',()=>{
  const store=db();try{
    store.exec('BEGIN');store.prepare('INSERT INTO sessions VALUES (?,?,?)').run('test',1,'{}');
    store.prepare('INSERT INTO frames VALUES (?,?,?)').run('test',0,'[]');store.exec('ROLLBACK');
    assert.equal(store.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
    assert.throws(()=>store.prepare('INSERT INTO frames VALUES (?,?,?)').run('missing',0,'[]'));
  }finally{store.close();}
});
test('Android permissions disable audio/storage access and privacy plugin is configured',()=>{
  const config=JSON.parse(readFileSync(new URL('../app.json',import.meta.url),'utf8')).expo;
  assert.ok(config.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'));
  assert.ok(config.plugins.includes('./plugins/withOfflinePrivacy.cjs'));
  assert.equal(config.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-camera')[1].recordAudioAndroid,false);
});
const model=new URL('../modules/gaitsense-pose/android/src/main/assets/pose_landmarker_full.task',import.meta.url);
test('prepared bundled model matches pinned Android checksum',{skip:!existsSync(model)},()=>{
  assert.equal(createHash('sha256').update(readFileSync(model)).digest('hex'),'5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1');
});
