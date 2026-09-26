import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraPreviewSize } from '../src/offline/framing.ts';
import { parseSession } from '../src/offline/contract.ts';

test('portrait camera image fits small and large viewports without square cropping', () => {
  for (const [w,h] of [[360,640],[412,915],[640,360],[800,1280]]) {
    const size=cameraPreviewSize(w,h);
    assert.ok(size.width <= w-40);
    assert.ok(size.height <= h*.5+1);
    assert.ok(Math.abs(size.width/size.height-9/16)<.005);
  }
});
test('aggregate diagnostics are optional for historical sessions and typed for new sessions', () => {
  const session={id:'test',createdAt:1,durationMs:14400,sampledFrames:144,poseFrames:144,
    usableFrameRatio:.99,landmarkCount:33,view:'side_left',rawVideoRetained:false,
    modelSha256:'a'.repeat(64),extractorVersion:'test',consentVersion:'local-prototype-notice-v1',
    timestampMethod:'requested-100ms-nearest-decoded-frame'};
  assert.equal(parseSession(JSON.stringify(session)).diagnostics,undefined);
  assert.equal(parseSession(JSON.stringify({...session,diagnostics:'multi=0'})).diagnostics,'multi=0');
  assert.throws(()=>parseSession(JSON.stringify({...session,diagnostics:{points:[]}})));
});
