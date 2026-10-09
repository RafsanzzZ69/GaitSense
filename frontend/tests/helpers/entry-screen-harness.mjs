import React from 'react';
import * as theme from '../../src/constants/theme.ts';
import * as preferences from '../../src/entry/entry-preferences.ts';
import { load } from './auth-controller-harness.mjs';

export function entryScreen(mode, controller) {
  const states = [], refs = [], effects = [], nodes = [], navigations = [];
  let cursor = 0, refCursor = 0, effectCursor = 0, back;
  const router = Object.fromEntries(['replace', 'dismissAll', 'dismissTo'].map(name => [name, (...args) => navigations.push([name, ...args])]));
  const hooks = { ...React,
    useCallback: fn => fn,
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial;
      return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef(initial) { const i = refCursor++; return refs[i] ??= { current: initial }; },
    useEffect(fn, deps) { const i = effectCursor++, previous = effects[i];
      if (!previous || deps.some((dep, n) => dep !== previous.deps[n])) effects[i] = { fn, deps, pending: true, cleanup: previous?.cleanup }; },
  };
  const native = { StyleSheet: { create: value => value }, BackHandler: { addEventListener(_, fn) { back = fn; return { remove() { if (back === fn) back = undefined; } }; } } };
  for (const name of ['ActivityIndicator', 'Pressable', 'ScrollView', 'Text', 'View']) native[name] = name;
  const screens = load('src/entry/EntryScreens.tsx', { react: hooks, 'react-native': native,
    'expo-router': { useRouter: () => router, useFocusEffect: fn => hooks.useEffect(fn, [fn]) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' }, '@/constants/theme': theme,
    './entry-preferences': preferences,
    './EntryPreferencesProvider': { useEntryPreferences: () => ({ ...controller.getSnapshot(), ...controller }) },
  });
  function expand(node) {
    if (Array.isArray(node)) { node.forEach(expand); return; }
    if (!React.isValidElement(node)) { if (typeof node === 'string' || typeof node === 'number') nodes.push(node); return; }
    if (typeof node.type === 'function') { expand(node.type(node.props)); return; }
    nodes.push(node); expand(node.props.children);
  }
  function render() {
    cursor = refCursor = effectCursor = 0; nodes.length = 0;
    expand(mode === 'acknowledgement' ? screens.AcknowledgementScreen() : screens.GuideScreen());
    for (const effect of effects) if (effect.pending) {
      effect.cleanup?.(); effect.cleanup = effect.fn(); effect.pending = false;
    }
  }
  render();
  return { nodes, navigations, render, screens,
    text: () => nodes.filter(n => typeof n === 'string' || typeof n === 'number').join(' ').replace(/\s+/g, ' '),
    button: label => nodes.find(n => n.type === 'Pressable' && n.props.accessibilityLabel === label)?.props,
    back: () => back?.(),
    unmount: () => effects.forEach(effect => effect.cleanup?.()),
  };
}
