import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import ts from 'typescript';
import * as theme from '../../src/constants/theme.ts';
import { createDepartureBoundary } from '../../src/navigation/departure-boundary.ts';
import { entryReady } from '../../src/entry/entry-preferences.ts';
import { load } from './auth-controller-harness.mjs';
const { appEntry } = load('src/entry/app-entry.ts');
const require = createRequire(import.meta.url);
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const Stack = () => null;
Stack.Screen = () => null;
Stack.Protected = () => null;
// Exercise installed Expo's actual screen-filtering implementation. RN view
// rendering and native transitions remain physical acceptance, not mock proof.
const filterSource = require('node:fs').readFileSync(require.resolve('expo-router/build/layouts/withLayoutContext'), 'utf8');
const filterBody = filterSource.slice(filterSource.indexOf('function useFilterScreenChildren('), filterSource.indexOf('\n/**'));
const filter = new Function('react_1', 'Screen_1', 'Protected_1', 'NativeTabTrigger_1', filterBody + '\nreturn useFilterScreenChildren;')(
  { ...React, useMemo: fn => fn() }, { isScreen: node => node?.type === Stack.Screen },
  { isProtectedReactElement: node => node?.type === Stack.Protected }, { isNativeTabTrigger: () => false });

export function gate(initial = 'RESTORING', initialPreferences = { status: 'READY', versions: { acknowledgementVersion: 1, onboardingVersion: 1 }, busy: false, message: '' }) {
  const auth = { session: { status: initial, user: initial === 'SIGNED_IN' ? { emailVerified: false } : null }, getSnapshot: () => auth, retry() {} };
  const preferences = { ...initialPreferences, getSnapshot: () => preferences, retry() {} };
  const boundary = createDepartureBoundary(() => auth.getSnapshot().session.status === 'SIGNED_IN' && entryReady(preferences.getSnapshot()));
  const modules = { react: { ...React, useState: () => [boundary], useSyncExternalStore: (_, get) => get(), useEffect() {} },
    'expo-router': { Stack }, 'react-native': { StyleSheet: { create: value => value }, ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '@/constants/theme': theme,
    '@/navigation/departure-boundary': { createDepartureBoundary }, '@/navigation/NavigationSettlement': { NavigationSettlementContext: { Provider: 'SettlementProvider' } },
    '@/entry/EntryPreferencesProvider': { useEntryPreferences: () => preferences }, '@/entry/entry-preferences': { entryReady }, '@/entry/app-entry': { appEntry },
    './useAuth': { useAuth: () => auth } };
  const js = ts.transpileModule(read('src/auth/AndroidAuthGate.tsx'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => modules[id] ?? require(id), module, module.exports);
  return { auth, preferences, boundary, routes() {
    const child = module.exports.AndroidAuthGate().props.children;
    return child.type === Stack ? filter(child.props.children).screens.map(screen => screen.name) : [];
  }, tree: () => module.exports.AndroidAuthGate().props.children, protectedAppRoutes: module.exports.protectedAppRoutes };
}
