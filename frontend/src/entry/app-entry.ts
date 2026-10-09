import { ACKNOWLEDGEMENT_VERSION, ONBOARDING_VERSION, type EntryPreferencesState } from './entry-preferences';

export function appEntry(authStatus: string, preferences: EntryPreferencesState) {
  if (authStatus === 'RESTORING') return 'AUTH_RESTORING';
  if (authStatus === 'ERROR') return 'AUTH_ERROR';
  if (authStatus !== 'SIGNED_IN') return 'SIGNED_OUT';
  if (preferences.status === 'RESTORING') return 'PREFERENCES_RESTORING';
  if (preferences.status === 'ERROR') return 'PREFERENCES_ERROR';
  if (preferences.versions.acknowledgementVersion !== ACKNOWLEDGEMENT_VERSION) return 'ACK_REQUIRED';
  if (preferences.versions.onboardingVersion !== ONBOARDING_VERSION) return 'ONBOARDING_REQUIRED';
  return 'APP_READY';
}
