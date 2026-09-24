import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, ApiError } from '../src/web/client.ts';

const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });
const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json'}});

test('consent-required API response explains how to continue',async()=>{
  globalThis.fetch=async()=>json({detail:{code:'CONSENT_REQUIRED',types:['data_processing']}},409);
  await assert.rejects(createClient('https://api.example.com').send('/sessions',{}),/Review the current notices/);
});

test('an unauthorized request without tokens also resets a stale UI session',async()=>{
  let expired=0;const api=createClient('https://api.example.com',()=>expired++);
  globalThis.fetch=async()=>json({detail:'Authentication required'},401);
  await assert.rejects(api.send('/auth/logout'),/Authentication required/);
  assert.equal(expired,1);
});

test('expired logout refreshes before revoking the session', async () => {
  const api=createClient('https://api.example.com');api.save({accessToken:'old',refreshToken:'refresh'});
  const requests=[];
  globalThis.fetch=async(url,options)=>{
    requests.push(url);
    if(url.endsWith('/auth/refresh'))return json({accessToken:'new',refreshToken:'rotated'});
    return options.headers.get('Authorization')==='Bearer old'?json({detail:'expired'},401):new Response(null,{status:204});
  };
  await api.send('/auth/logout');
  assert.deepEqual(requests,['https://api.example.com/auth/logout','https://api.example.com/auth/refresh','https://api.example.com/auth/logout']);
});

test('a rejected retry clears authentication instead of leaving a stale account screen',async()=>{
  let expired=0;const api=createClient('https://api.example.com',()=>expired++);
  api.save({accessToken:'old',refreshToken:'refresh'});
  globalThis.fetch=async(url)=>url.endsWith('/auth/refresh')?json({accessToken:'new',refreshToken:'rotated'}):json({detail:'revoked'},401);
  await assert.rejects(api.get('/me/profile'),/revoked/);
  assert.equal(expired,1);
});

test('uses the configured API and attaches an in-memory bearer token', async () => {
  const client=createClient('https://api.example.com/api/v1/');client.save({accessToken:'test-access',refreshToken:'test-refresh'});
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.example.com/api/v1/me');assert.equal(options.headers.get('Authorization'),'Bearer test-access');return json({id:'user'});};
  assert.deepEqual(await client.get('/me'),{id:'user'});
});
test('empty API configuration never sends a public-showcase request',async()=>{
  globalThis.fetch=()=>assert.fail('Must not call a backend');
  await assert.rejects(createClient('').get('/me'),/public showcase/);
});
test('returns validation messages without leaking response internals',async()=>{
  globalThis.fetch=async()=>json({detail:[{msg:'Invalid email'},{msg:'Password too short'}]},422);
  await assert.rejects(createClient('https://api.example.com').send('/auth/register',{}),e=>e instanceof ApiError&&e.status===422&&e.message==='Invalid email. Password too short');
});
test('does not set a JSON header for multipart uploads',async()=>{
  globalThis.fetch=async(_,options)=>{assert.equal(options.headers.has('Content-Type'),false);assert.ok(options.body instanceof FormData);return json({id:'asset'});};
  await createClient('https://api.example.com').raw('/sessions/one/video',{method:'POST',body:new FormData()});
});
test('handles empty 204 responses',async()=>{
  globalThis.fetch=async()=>new Response(null,{status:204});
  assert.equal(await createClient('https://api.example.com').send('/auth/logout'),undefined);
});
test('parallel unauthorized requests rotate the refresh token only once',async()=>{
  let refreshes=0;const client=createClient('https://api.example.com');client.save({accessToken:'old',refreshToken:'refresh'});
  globalThis.fetch=async(url,options)=>{
    if(url.endsWith('/auth/refresh')){refreshes++;await new Promise(r=>setTimeout(r,10));return json({accessToken:'new',refreshToken:'rotated'});}
    return options.headers.get('Authorization')==='Bearer new'?json({ok:true}):json({detail:'expired'},401);
  };
  const results=await Promise.all([client.get('/me'),client.get('/sessions')]);
  assert.equal(refreshes,1);assert.ok(results.every(r=>r.ok));
});
test('logout during refresh cannot restore the ended session',async()=>{
  let resolve;const delayed=new Promise(r=>{resolve=r;});let expired=0;
  const client=createClient('https://api.example.com',()=>expired++);client.save({accessToken:'old',refreshToken:'refresh'});
  globalThis.fetch=async(url)=>url.endsWith('/auth/refresh')?delayed:json({detail:'expired'},401);
  const pending=client.get('/me');await new Promise(r=>setTimeout(r,5));client.clear();resolve(json({accessToken:'new',refreshToken:'rotated'}));
  await assert.rejects(pending,/expired/);assert.equal(expired,1);
  globalThis.fetch=async(_,options)=>{assert.equal(options.headers.has('Authorization'),false);return json({ok:true});};await client.get('/public');
});
test('failed refresh clears session and surfaces unauthorized',async()=>{
  let expired=0;const client=createClient('https://api.example.com',()=>expired++);client.save({accessToken:'old',refreshToken:'refresh'});
  globalThis.fetch=async()=>json({detail:'expired'},401);
  await assert.rejects(client.get('/me'),/expired/);assert.equal(expired,1);
});
test('network failure produces an actionable message',async()=>{
  globalThis.fetch=async()=>{throw new TypeError('network failed');};
  await assert.rejects(createClient('https://api.example.com').get('/me'),/Cannot reach GaitSense/);
});
