import { useEffect, useState, useSyncExternalStore } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { createDepartureBoundary } from '@/navigation/departure-boundary';
import { NavigationSettlementContext } from '@/navigation/NavigationSettlement';
import { useAuth } from './useAuth';

export const protectedAppRoutes = ['index', 'dashboard', 'assess', 'history', 'login', 'register', 'profile', 'report/[id]'] as const;

export function AndroidAuthGate() {
  const auth = useAuth();
  // Read the controller synchronously when a record handler runs. This closes
  // the native-auth callback -> React-render gap without another subscription.
  const [boundary] = useState(() => createDepartureBoundary(() => auth.getSnapshot().session.status === 'SIGNED_IN'));
  useSyncExternalStore(boundary.subscribe, boundary.getSnapshot, boundary.getSnapshot);
  useEffect(() => { boundary.changed(); }, [boundary, auth.session.status]);
  const signedIn = auth.session.status === 'SIGNED_IN';
  const retaining = !signedIn && boundary.mustRetain();
  const unresolved = auth.session.status === 'RESTORING' || auth.session.status === 'ERROR';
  return <NavigationSettlementContext.Provider value={boundary}>
    {unresolved && !retaining ? <SafeAreaView style={styles.page}>
      <Text style={styles.brand}>GaitSense</Text>
      {auth.session.status === 'RESTORING' ? <>
        <ActivityIndicator accessibilityLabel="Restoring account" />
        <Text style={styles.title}>Restoring your account…</Text>
        <Text style={styles.body}>Your saved sign-in is restored on this phone.</Text>
      </> : <>
        <Text accessibilityRole="alert" style={styles.title}>Account access could not initialize</Text>
        <Text style={styles.body}>Your local measurements have not been deleted. Retry account access to continue.</Text>
      </>}
      <Pressable accessibilityRole="button" accessibilityLabel="Retry account access" onPress={auth.retry} style={styles.button}>
        <Text style={styles.buttonText}>Retry account access</Text>
      </Pressable>
    </SafeAreaView> : <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Protected guard={signedIn}>
        {protectedAppRoutes.map(name => <Stack.Screen key={name} name={name} />)}
      </Stack.Protected>
      <Stack.Protected guard={signedIn || retaining}>
        <Stack.Screen name="offline" dangerouslySingular={() => 'gaitsense-measurement'} />
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
