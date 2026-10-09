import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import ts from 'typescript';
import * as contract from '../../src/offline/contract.ts';
import * as framing from '../../src/offline/framing.ts';
import * as setup from '../../src/offline/recording-analysis-setup.ts';

const require = createRequire(import.meta.url);
const web = require('react-native-web');
const source = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
function component(path, replacements) {
  const js = ts.transpileModule(source(path), { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => {
    if (!Object.hasOwn(replacements, id)) return require(id);
    const replacement = replacements[id];
    // Preserve ES default-import semantics for test-injected module seams.
    return Object.hasOwn(replacement, 'default') ? { __esModule: true, ...replacement } : replacement;
  }, module, module.exports);
  return module.exports;
}

export function capture(navigationBoundary) {
  const states = [], refs = [], effects = [], callbacks = [], discarded = [], destroyed = [];
  let stateIndex = 0, refIndex = 0, effectIndex = 0, callbackIndex = 0, access, clipResolve, processResolve, cleanupFails = false;
  const camera = { recordAsync: () => new Promise(resolve => { clipResolve = resolve; }), stopRecording() {} };
  const pose = { listSessions: async () => '[]', cancel() {}, addListener: () => ({ remove() {} }),
    deleteSession: () => destroyed.push('session'), deleteAll: () => destroyed.push('all'),
    discardVideo: async uri => { discarded.push(uri); if (cleanupFails) throw Error('synthetic cleanup failure'); },
    processVideoWithSetup: () => new Promise(resolve => { processResolve = resolve; }) };
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
  const effect = (fn, deps) => {
    const i = effectIndex++, previous = effects[i];
    if (!previous || !equal(previous.deps, deps)) effects[i] = { fn, deps, pending: true, cleanup: previous?.cleanup };
  };
  const react = { ...React, useCallback: (fn, deps) => {
    const i = callbackIndex++;
    if (!callbacks[i] || !equal(callbacks[i].deps, deps)) callbacks[i] = { fn, deps };
    return callbacks[i].fn;
  }, useEffect: effect,
    useState: initial => { const i = stateIndex++; if (!(i in states)) states[i] = initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: initial => { const i = refIndex++; refs[i] ??= { current: initial };
      if (initial === null && i === 2) refs[i].current = camera; return refs[i]; } };
  const Capture = component('src/offline/OfflineCapture.tsx', {
    react, 'react-native': { ...web, useWindowDimensions: () => ({ width: 360, height: 720 }), AppState: { addEventListener: () => ({ remove() {} }) } },
    'expo-router': { useFocusEffect: fn => effect(fn, [fn]) }, 'expo-camera': { useCameraPermissions: () => [{ granted: true }, () => {}], CameraView: () => null },
    'expo-video': { useVideoPlayer: () => null, VideoView: () => null }, 'react-native-safe-area-context': { SafeAreaView: web.View },
    '../../modules/gaitsense-pose': { default: pose }, './contract': contract, './framing': framing, './recording-analysis-setup': setup,
    './saved-analysis-binding': { createSavedAnalysisBinding: () => ({ dispose() {}, leave() {} }) },
    './SavedAnalysisPanel': { SavedAnalysisPanel: () => null }, './RecordingAnalysisSetupControls': { RecordingAnalysisSetupControls: () => null },
  }).default;
  let tree;
  function render() { stateIndex = refIndex = effectIndex = callbackIndex = 0;
    tree = Capture({ navigationBoundary, renderWorkspaceHeader: value => { access = value; return null; } });
    for (const item of effects) if (item.pending) { item.cleanup?.(); item.cleanup = item.fn(); item.pending = false; }
  }
  function find(predicate, node) {
    if (Array.isArray(node)) return node.map(child => find(predicate, child)).find(Boolean);
    if (React.isValidElement(node)) return predicate(node) ? node : find(predicate, node.props.children);
  }
  render();
  find(n => typeof n.props.onCameraReady === 'function', tree).props.onCameraReady();
  find(n => n.props.accessibilityRole === 'checkbox', tree).props.onPress();
  render();
  return { render, canLeave: () => access.canLeave(), idle: () => access.idle,
    press: label => find(n => n.props.label === label, tree).props.onPress(),
    control: label => find(n => n.props.label === label, tree).props,
    resolveClip: () => clipResolve({ uri: 'file:///cache/Camera/synthetic.mp4' }),
    resolveProcessing: (raw = '{}') => processResolve(raw), // Parser rejects: exercises real failure cleanup.
    readFrames: value => { pose.readFrames = value; },
    failCleanup: value => { cleanupFails = value; }, discarded, destroyed,
    unmount: () => effects.forEach(item => item.cleanup?.()) };
}
export async function flush() { for (let i = 0; i < 32; i++) await Promise.resolve(); }
export async function recordedPreview(h) {
  const previous = globalThis.setTimeout;
  try { globalThis.setTimeout = fn => { queueMicrotask(fn); return 0; };
    h.press('Record 15-second video');
    assert.equal(h.canLeave(), false); // Same tick, before phase/disabled UI renders.
    await flush(); h.render();
    assert.equal(h.canLeave(), false);
    h.resolveClip(); await flush(); h.render();
  } finally { globalThis.setTimeout = previous; }
}
