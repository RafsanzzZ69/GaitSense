import { useFocusEffect, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useRef } from 'react';
import { Alert, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

type Props = { canLeave: () => boolean; idle: boolean; onHome: () => void; pendingDeparture?: boolean };

export function MeasurementWorkspaceHeader({ canLeave, idle, onHome, pendingDeparture = false }: Props) {
  const navigation = useNavigation();
  const exiting = useRef(false);
  const explainBlockedExit = () => Alert.alert('Finish this recording first',
    'Cancel the countdown, stop and discard the recording, or wait for processing and cleanup to finish before returning Home. If cleanup failed, retry Discard video / retake.');
  const requestHome = useCallback(() => {
    if (exiting.current) return;
    // Read capture refs at activation, including before the next UI render.
    if (!canLeave()) { explainBlockedExit(); return; }
    exiting.current = true;
    try { onHome(); } catch (error) { exiting.current = false; throw error; }
  }, [canLeave, onHome]);

  // Expo Router 57's bundled navigation hook protects pops/replacements too.
  // Replay the original action only when the capture's current refs permit it.
  usePreventRemove(true, ({ data }) => {
    if (canLeave()) navigation.dispatch(data.action);
    else { exiting.current = false; explainBlockedExit(); }
  });
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestHome();
      return true;
    });
    return () => subscription.remove();
  }, [requestHome]));

  return <View style={styles.header}>
    <View style={styles.copy}>
      <Text accessibilityRole="header" style={styles.title}>Gait Measurement</Text>
      <Text style={styles.subtitle}>{idle ? 'Recording and saved measurements' : 'Finish or discard this attempt to return Home'}</Text>
      {pendingDeparture && <Text accessibilityRole="alert" style={styles.subtitle}>Account departure pending. Finish or cancel this attempt, then discard any retained video. Account operations will continue after cleanup. New recordings are blocked.</Text>}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Return to Home"
      accessibilityState={{ disabled: !idle }} disabled={!idle} onPress={requestHome}
      style={[styles.homeButton, !idle && styles.disabled]}>
      <Text style={styles.homeText}>Home</Text>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  copy: { flex: 1, gap: 4 }, title: { color: colors.ink, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  subtitle: { color: colors.inkMuted, fontSize: 13, lineHeight: 20 },
  homeButton: { minWidth: 64, minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.mint },
  homeText: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' }, disabled: { opacity: 0.45 },
});
