import { useEffect, useState, useSyncExternalStore } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { createDepartureBoundary } from '@/navigation/departure-boundary';
import { NavigationSettlementContext } from '@/navigation/NavigationSettlement';
import { useAuth } from './useAuth';
import { useEntryPreferences } from '@/entry/EntryPreferencesProvider';
import { entryReady } from '@/entry/entry-preferences';
import { appEntry } from '@/entry/app-entry';

export const protectedAppRoutes = ['index', 'dashboard', 'assess', 'history', 'login', 'register', 'profile', 'report/[id]'] as const;

export function AndroidAuthGate() {
  const auth = useAuth();
  const preferences = useEntryPreferences();
  // Read the controller synchronously when a record handler runs. This closes
  // the native-auth callback -> React-render gap without another subscription.
  const [boundary] = useState(() => createDepartureBoundary(() => auth.getSnapshot().session.status === 'SIGNED_IN'
    && entryReady(preferences.getSnapshot())));
  useSyncExternalStore(boundary.subscribe, boundary.getSnapshot, boundary.getSnapshot);
  useEffect(() => { boundary.changed(); }, [boundary, auth.session.status, preferences.status, preferences.versions]);
  const signedIn = auth.session.status === 'SIGNED_IN';
  const entry = appEntry(auth.session.status, preferences);
  const ready = entry === 'APP_READY';
  const retaining = (!ready || boundary.isPending()) && boundary.mustRetain();
  const unresolved = entry === 'AUTH_RESTORING' || entry === 'AUTH_ERROR'
    || entry === 'PREFERENCES_RESTORING' || entry === 'PREFERENCES_ERROR';
  const local = entry === 'PREFERENCES_RESTORING' || entry === 'PREFERENCES_ERROR';
  const restoring = entry === 'AUTH_RESTORING' || entry === 'PREFERENCES_RESTORING';
  return <NavigationSettlementContext.Provider value={boundary}>
    {unresolved && !retaining ? <SafeAreaView style={styles.page}>
      <Text style={styles.brand}>GaitSense</Text>
      {restoring ? <>
        <ActivityIndicator accessibilityLabel={local ? 'Restoring app preferences' : 'Restoring account'} />
        <Text style={styles.title}>{local ? 'Restoring app preferences…' : 'Restoring your account…'}</Text>
        <Text style={styles.body}>{local ? 'Checking your saved app acknowledgement and guide on this phone.' : 'Your saved sign-in is restored on this phone.'}</Text>
      </> : <>
        <Text accessibilityRole="alert" style={styles.title}>{local ? 'App preferences could not be restored' : 'Account access could not initialize'}</Text>
        <Text style={styles.body}>{local ? 'Your local measurements have not been deleted. Retry restoring app preferences to continue.' : 'Your local measurements have not been deleted. Retry account access to continue.'}</Text>
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel={local ? 'Retry app preferences' : 'Retry account access'}
        onPress={local ? () => void preferences.retry() : auth.retry} style={styles.button}>
        <Text style={styles.buttonText}>{local ? 'Retry app preferences' : 'Retry account access'}</Text>
      </Pressable>
    </SafeAreaView> : <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Protected guard={ready && !boundary.isPending() && !retaining}>
        {protectedAppRoutes.map(name => <Stack.Screen key={name} name={name} />)}
      </Stack.Protected>
      <Stack.Protected guard={(ready && !boundary.isPending()) || retaining}>
        <Stack.Screen name="measurement" dangerouslySingular={() => 'gaitsense-measurement'} />
      </Stack.Protected>
      <Stack.Protected guard={ready && !boundary.isPending() && !retaining}>
        <Stack.Screen name="offline" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && (entry === 'ONBOARDING_REQUIRED' || ready) && !boundary.isPending() && !retaining}>
        <Stack.Screen name="guide" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && preferences.status === 'READY' && !boundary.isPending() && !retaining}>
        <Stack.Screen name="acknowledgement" />
      </Stack.Protected>
      {/* While settlement is pending, no other destination can cover the owner. */}
      <Stack.Protected guard={!retaining}>
        <Stack.Screen name="account" />
      </Stack.Protected>
    </Stack>}
  </NavigationSettlementContext.Provider>;
}
const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 24, gap: 20, backgroundColor: colors.cream },
  brand: { fontSize: 25, fontWeight: '800', color: colors.primaryDark },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 25, color: colors.inkMuted },
  button: { minHeight: 52, padding: 14, borderRadius: 12, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.white },
});
