import React from 'react';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { load } from './auth-controller-harness.mjs';
const { appEntry } = load('src/entry/app-entry.ts');
import * as theme from '../../src/constants/theme.ts';
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
export function screen(mode, { signedIn = false, verified = false, status, run, requestSignOut, preferences = { status: 'READY', versions: { acknowledgementVersion: 1, onboardingVersion: 1 } } } = {}) {
  const states = [], refs = [], effects = [], navigations = [], operations = [], alerts = [];
  let cursor = 0, refCursor = 0, effectCursor = 0, tree, updates = 0;
  const auth = { session: signedIn ? { status: 'SIGNED_IN', user: { uid: 'fixture', emailVerified: verified } } : { status: status || 'SIGNED_OUT', user: null }, busy: null,
    run: async (...args) => { operations.push(args); return run ? run(...args) : { ok: true, message: 'Synthetic operation outcome' }; }, getSnapshot: () => auth, requestSignOut: async boundary => { operations.push(['signout', boundary]); return requestSignOut ? requestSignOut(boundary) : { ok: true, message: 'Session command accepted' }; }, retry: () => operations.push(['retry']) };
  const hooks = { ...React,
    useState: initial => { const i = cursor++; if (!(i in states)) states[i] = initial;
      return [states[i], value => { updates++; states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: initial => { const i = refCursor++; return refs[i] ??= { current: initial }; },
    useEffect: (fn, deps) => { const i = effectCursor++; const previous = effects[i];
      if (!previous || deps.some((dep, n) => dep !== previous.deps[n])) effects[i] = { fn, deps, pending: true, cleanup: previous?.cleanup }; },
  };
  const native = { Alert: { alert: (...args) => alerts.push(args) }, StyleSheet: { create: value => value }, Platform: { OS: 'android' } };
  for (const name of ['ActivityIndicator', 'KeyboardAvoidingView', 'Pressable', 'ScrollView', 'Text', 'TextInput', 'View']) native[name] = name;
  const boundary = { requestDeparture() {} };
  const replacements = { react: hooks, 'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { useRouter: () => Object.fromEntries(['push', 'dismissAll', 'replace', 'dismissTo'].map(name => [name, (...args) => navigations.push([name, ...args])])) },
    '@/entry/EntryPreferencesProvider': { useEntryPreferences: () => ({ ...preferences, getSnapshot: () => preferences }) }, '@/entry/app-entry': { appEntry }, '@/navigation/NavigationSettlement': { useNavigationSettlement: () => boundary }, '@/constants/theme': theme, './useAuth': { useAuth: () => auth } };
  const js = ts.transpileModule(read('src/auth/AuthScreens.tsx'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => {
    if (Object.hasOwn(replacements, id)) return replacements[id];
    if (id === './auth-errors') {
      const source = ts.transpileModule(read('src/auth/auth-errors.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
      const errors = { exports: {} }; new Function('module', 'exports', source)(errors, errors.exports); return errors.exports;
    }
    return require(id);
  }, module, module.exports);
  const nodes = [];
  function expand(node) {
    if (Array.isArray(node)) { node.forEach(expand); return; }
    if (!React.isValidElement(node)) { if (typeof node === 'string') nodes.push(node); return; }
    if (typeof node.type === 'function') { expand(node.type(node.props)); return; }
    nodes.push(node); expand(node.props.children);
  }
  function render() {
    cursor = refCursor = effectCursor = 0; nodes.length = 0;
    tree = module.exports.AuthScreen({ mode }); expand(tree);
    for (const effect of effects) if (effect?.pending) {
      effect.cleanup?.(); effect.cleanup = effect.fn(); effect.pending = false;
    }
  }
  render();
  return { auth, nodes, operations, navigations, alerts, boundary, render, get updates() { return updates; },
    text: () => nodes.filter(n => typeof n === 'string').join(' '),
    field: label => nodes.find(n => n.type === 'TextInput' && n.props.accessibilityLabel === label).props,
    button: label => nodes.find(n => n.type === 'Pressable' && n.props.accessibilityLabel === label).props,
    fill(email = 'fixture@example.test', password = 'pass', confirmation = password) {
      this.field('Email').onChangeText(email);
      if (mode !== 'reset') this.field('Password').onChangeText(password);
      if (mode === 'register') this.field('Confirm password').onChangeText(confirmation);
      render();
    },
    unmount: () => effects.forEach(effect => effect.cleanup?.()),
  };
}