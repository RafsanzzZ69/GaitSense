export const ACKNOWLEDGEMENT_VERSION = 1;
export const ONBOARDING_VERSION = 1;
export const ENTRY_PREFERENCES_KEY = 'gaitsense.app-entry.v1';
export type EntryVersions = Readonly<{ acknowledgementVersion: number; onboardingVersion: number }>;
export type EntryPreferencesState = {
  status: 'RESTORING' | 'READY' | 'ERROR';
  versions: EntryVersions;
  busy: boolean;
  message: string;
};
export interface EntryStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
const empty = (): EntryVersions => Object.freeze({ acknowledgementVersion: 0, onboardingVersion: 0 });
export function parseEntryVersions(raw: string | null): EntryVersions {
  if (raw === null) return empty();
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid app preferences');
  const fields = value as Record<string, unknown>;
  const version = (key: string) => {
    const v = fields[key] ?? 0;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new Error('Invalid app preference version');
    return v;
  };
  return Object.freeze({ acknowledgementVersion: version('acknowledgementVersion'), onboardingVersion: version('onboardingVersion') });
}
export function entryReady(state: EntryPreferencesState): boolean {
  return state.status === 'READY' && state.versions.acknowledgementVersion === ACKNOWLEDGEMENT_VERSION
    && state.versions.onboardingVersion === ONBOARDING_VERSION;
}
export function createEntryPreferences(storage: EntryStorage) {
  let state: EntryPreferencesState = { status: 'RESTORING', versions: empty(), busy: false, message: '' };
  let active = false, generation = 0;
  const observers = new Set<() => void>();
  const publish = (next: EntryPreferencesState) => { state = next; observers.forEach(observer => observer()); };
  const getSnapshot = () => state;
  async function restore() {
    if (active) return;
    active = true;
    const current = ++generation;
    publish({ status: 'RESTORING', versions: empty(), busy: false, message: '' });
    try {
      const versions = parseEntryVersions(await storage.getItem(ENTRY_PREFERENCES_KEY));
      if (active && current === generation) publish({ ...state, status: 'READY', versions });
    } catch {
      if (active && current === generation) publish({ ...state, status: 'ERROR', message: 'App preferences could not be restored. Please retry. Your measurements are unchanged.' });
    }
  }
  const stop = () => { active = false; generation++; };
  async function save(kind: 'acknowledgement' | 'onboarding', understood = false): Promise<boolean> {
    if (!active || state.status !== 'READY' || state.busy) return false;
    if (kind === 'acknowledgement' && !understood) return false;
    if (kind === 'onboarding' && state.versions.acknowledgementVersion !== ACKNOWLEDGEMENT_VERSION) return false;
    const field = kind === 'acknowledgement' ? 'acknowledgementVersion' : 'onboardingVersion';
    const version = kind === 'acknowledgement' ? ACKNOWLEDGEMENT_VERSION : ONBOARDING_VERSION;
    if (state.versions[field] === version) return true;
    const versions = Object.freeze({ ...state.versions, [field]: version });
    const current = generation;
    publish({ ...state, busy: true, message: '' });
    try {
      // One allowlisted, nonsecret record. Publish completion only after durable
      // storage reports success; identity and gait data never enter this record.
      await storage.setItem(ENTRY_PREFERENCES_KEY, JSON.stringify(versions));
      if (!active || current !== generation) return false;
      publish({ ...state, versions });
      return true;
    } catch {
      if (active && current === generation) publish({ ...state, message: 'Your progress could not be saved. Please try again.' });
      return false;
    } finally {
      if (active && current === generation) publish({ ...state, busy: false });
    }
  }
  return { getSnapshot, subscribe(observer: () => void) { observers.add(observer); return () => { observers.delete(observer); }; },
    start: restore, stop, retry: () => { stop(); return restore(); },
    acknowledge: (understood: boolean) => save('acknowledgement', understood), completeOnboarding: () => save('onboarding') };
}
