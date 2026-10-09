import { createContext, useContext, useEffect, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createEntryPreferences, type EntryStorage, type EntryPreferencesState } from './entry-preferences';

type Controller = ReturnType<typeof createEntryPreferences>;
export const EntryPreferencesContext = createContext<(EntryPreferencesState & Pick<Controller,
  'getSnapshot' | 'retry' | 'acknowledge' | 'completeOnboarding'>) | null>(null);
export function EntryPreferencesProvider({ children, storage = AsyncStorage }: PropsWithChildren<{ storage?: EntryStorage }>) {
  const [controller] = useState(() => createEntryPreferences(storage));
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { void controller.start(); return controller.stop; }, [controller]);
  return <EntryPreferencesContext.Provider value={{ ...state, getSnapshot: controller.getSnapshot,
    retry: controller.retry, acknowledge: controller.acknowledge, completeOnboarding: controller.completeOnboarding }}>{children}</EntryPreferencesContext.Provider>;
}
export function useEntryPreferences() {
  const value = useContext(EntryPreferencesContext);
  if (!value) throw new Error('App preferences unavailable');
  return value;
}
