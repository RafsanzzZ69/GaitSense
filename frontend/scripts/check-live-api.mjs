// Explicit acceptance test against the local API using only our temporary fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createClient } from '../src/web/client.ts';

const account = JSON.parse(await readFile(new URL('../../tmp/web-acceptance-account.json', import.meta.url), 'utf8'));
assert.match(account.email, /^webcheck-\d+@example\.com$/);
const api = createClient('http://127.0.0.1:8000/api/v1');
const tokens = await api.send('/auth/login', { email: account.email, password: account.password });
api.save(tokens);
const profile = await api.get('/me/profile');
assert.ok(profile.displayName);
const documents = await api.get('/consent-documents');
assert.ok(documents.length >= 4);
const consents = await api.get('/me/consents');
assert.equal(consents.filter(c => c.status === 'accepted').length, 4);
let session = await api.send('/sessions', { angle: 'front', platform: 'web', protocolVersion: '0.2.0' }, 'POST', { 'Idempotency-Key': 'frontend-client-acceptance-v1' });
if (session.status === 'created') {
  const file = new File([await readFile(fileURLToPath(new URL('../../research/gaitsense_poc/videos/IMG_6836.MOV', import.meta.url)))], 'walking.MOV', { type: 'video/quicktime' });
  const form = new FormData(); form.append('file', file);
  const upload = await api.raw(`/sessions/${session.id}/video`, { method: 'POST', body: form });
  assert.equal(upload.status, 201);
}
if (session.status !== 'completed') await api.send(`/sessions/${session.id}/process`);
for (let attempt = 0; attempt < 90; attempt++) {
  session = await api.get(`/sessions/${session.id}`);
  if (session.status === 'completed') break;
  assert.notEqual(session.status, 'failed', JSON.stringify(session.processingError));
  await new Promise(resolve => setTimeout(resolve, 2000));
}
assert.equal(session.status, 'completed');
const report = await api.get(`/assessments/${session.assessmentId}`);
assert.equal(report.sessionId, session.id);
const pose = await api.get(`/sessions/${session.id}/pose?chunk=0`);
assert.ok(pose.frames.length > 0);
assert.ok((await api.get('/sessions?limit=10')).items.some(s => s.id === session.id));
const comparison = await api.get('/progress');
assert.ok(comparison.status);
const assets = await api.get(`/sessions/${session.id}/media`);
assert.ok((await (await api.raw(`/media/${assets[0].id}/content`)).blob()).size > 0);
assert.ok((await (await api.raw('/me/export')).text()).length > 0);
await api.send('/auth/logout');
api.clear();
console.log(JSON.stringify({ result: 'passed', checks: ['login', 'profile', 'consents', 'session creation', 'multipart upload', 'worker completion', 'report', 'pose', 'history', 'progress', 'private video download', 'export', 'logout'], poseFrames: pose.frames.length }));
