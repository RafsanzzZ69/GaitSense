import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canChooseVideo, canProcessRecording } from '../src/web/recording-state.ts';

test('a resumed empty session can still receive a video',()=>{
  assert.equal(canChooseVideo('created'),true);
  assert.equal(canProcessRecording('created',false),false);
  assert.equal(canProcessRecording('created',true),true);
  assert.equal(canProcessRecording(undefined,false),false);
});
test('in-flight, completed and deleting sessions cannot be processed again',()=>{
  for(const status of ['uploading','queued','processing','completed','deleting']){
    assert.equal(canChooseVideo(status),false);
    assert.equal(canProcessRecording(status,true),false);
  }
  for(const status of ['uploaded','failed','cancelled'])assert.equal(canProcessRecording(status,false),true);
});
