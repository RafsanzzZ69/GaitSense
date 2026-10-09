import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
const require=createRequire(import.meta.url);
const read=path => readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const cache = new Map();
export function load(path, replacements = {}) {
  const js = ts.transpileModule(read(path), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => {
    if (Object.hasOwn(replacements, id)) return replacements[id];
    if (id.startsWith('.')) {
      const target = path.slice(0, path.lastIndexOf('/') + 1) + id.slice(2) + '.ts';
      if (!cache.has(target)) cache.set(target, load(target));
      return cache.get(target);
    }
    return require(id);
  }, module, module.exports);
  return module.exports;
}
const { createAuthController } = load('src/auth/auth-controller.ts');
const { authErrorMessage, resetConfirmation, validateAuthForm } = load('src/auth/auth-errors.ts');
export const user = (uid = 'test-user', emailVerified = false) => ({ uid, email: 'fixture@example.test', displayName: null, photoURL: null, emailVerified, providerIds: ['password'] });
export const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
export function fixture(overrides = {}) {
  const calls = []; let next, error, removals = 0, clock = 100000;
  const adapter = {
    subscribe: (a, b) => { calls.push(['subscribe']); next = a; error = b; return () => { removals++; }; },
    register: async (...args) => { calls.push(['register', ...args]); return 'test-user'; },
    login: async (...args) => { calls.push(['login', ...args]); },
    reset: async (...args) => { calls.push(['reset', ...args]); },
    verify: async (...args) => { calls.push(['verify', ...args]); },
    signOut: async () => { calls.push(['signout']); },
    refresh: async () => { calls.push(['refresh']); return user('test-user', true); }, ...overrides,
  };
  const controller = createAuthController(adapter, () => clock);
  return { controller, calls, emit: value => next(value), error: () => error(), advance: ms => { clock += ms; }, get removals() { return removals; } };
}