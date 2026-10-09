import { Slot, useFocusEffect, useNavigation, usePathname, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { useNavigationSettlement } from '@/navigation/NavigationSettlement';
import type { MeasurementAccess } from './measurement-access';
import { measurementPage } from './measurement-page';
import type { MeasurementPage } from './measurement-page';
import { MeasurementResults } from './MeasurementResults';

function Button({ label, disabled = false, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}
const titles = { setup: 'Prepare your measurement', camera: 'Record your walk', processing: 'Review & process', results: 'Measurement results', history: 'Measurements on this phone' };

export function MeasurementFlow({ access }: { access: MeasurementAccess }) {
  const router = useRouter();
  const navigation = useNavigation();
  const pathname = usePathname();
  const boundary = useNavigationSettlement();
  const [cameraEntered, setCameraEntered] = useState(false);
  const [attemptEntered, setAttemptEntered] = useState(false);
  const [details, setDetails] = useState(false);
  const exiting = useRef(false);
  const requested = pathname.split('/').at(-1) ?? 'setup';
  const page = measurementPage(requested, access.phase, cameraEntered, attemptEntered, !!access.completed);
  const blocked = () => Alert.alert('Finish this attempt first', 'Cancel the countdown, stop and discard the recording, or wait for processing and cleanup. If cleanup failed, retry Discard video / retake.');
  const home = useCallback(() => {
    if (exiting.current) return;
    if (!access.canLeave()) { blocked(); return; }
    exiting.current = true;
    try { router.dismissTo(boundary.canStart() ? '/' : '/account'); }
    catch (error) { exiting.current = false; throw error; }
  }, [access.canLeave, boundary, router]);
  const go = (destination: MeasurementPage) => {
    if (!access.canLeave()) { blocked(); return; }
    setDetails(false);
    router.replace(`/measurement/${destination}`);
  };
  const back = useCallback(() => {
    if (!access.canLeave()) { blocked(); return; }
    if (page === 'camera') { setCameraEntered(false); router.replace('/measurement/setup'); }
    else home();
  }, [access.canLeave, page, home, router]);
  // This hook belongs to the parent measurement route, not its child markers.
  // Internal replaces keep this controller and its live camera mounted.
  usePreventRemove(true, ({ data }) => {
    if (access.canLeave()) navigation.dispatch(data.action);
    else blocked();
  });
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
  }, [back]));
  useEffect(() => {
    const canonical = `/measurement/${page}` as const;
    if (pathname !== canonical && boundary.canStart()) router.replace(canonical);
  }, [page, pathname, router, boundary]);
  useEffect(() => {
    if (access.phase !== 'ready') setAttemptEntered(true);
  }, [access.phase]);
  useEffect(() => {
    setDetails(false);
    if(page !== 'camera') setCameraEntered(false);
  }, [page]);
  const continueToCamera = () => {
    if (!access.canContinue()) return;
    access.prepareCamera();
    setCameraEntered(true);
    router.replace('/measurement/camera');
  };
  return <SafeAreaView style={styles.page}>
    <View style={styles.header}>
      <Text style={styles.brand}>GaitSense · Measurement</Text>
      <Button label={page === 'camera' ? 'Back to setup' : 'Back to Home'} onPress={back} />
    </View>
    {!boundary.canStart() && <Text accessibilityRole="alert" style={styles.body}>Account departure pending. Finish or cancel this attempt and discard any retained video. New recordings are blocked.</Text>}
    <ScrollView removeClippedSubviews={false} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>{titles[page]}</Text>
      {!access.nativeAvailable && <Text accessibilityRole="alert" style={styles.body}>The Android camera-processing module is unavailable. No measurement will be generated.</Text>}
      {page === 'setup' && <>
        <Text style={styles.body}>Keep the entire body visible from the side. Use a stable, upright phone, adequate light and a clear walking path with enough space. Avoid obstructions and follow your selected side and image direction.</Text>
        {access.setup}
        <Button label="Continue to camera" disabled={!access.canContinue()} onPress={continueToCamera} />
        <Button label="View measurements on this phone" disabled={!access.nativeAvailable} onPress={() => go('history')} />
      </>}
      {page === 'camera' && <>
        <Text style={styles.body}>Keep head and feet inside the live image. A three-second countdown starts only when you press Record.</Text>
        <Text style={styles.body}>Visible side: {access.view === 'side_left' ? 'Left side of the person' : 'Right side of the person'} · Image direction: {access.direction === 1 ? 'Right' : access.direction === -1 ? 'Left' : 'Unspecified'} · Upright: {access.upright ? 'Confirmed' : 'Unknown'}</Text>
        {access.camera}
      </>}
      {page === 'processing' && <>
        {access.phase === 'preview' && <><Text style={styles.body}>Review this recording before analyzing it on this phone. You can discard it and try again.</Text>{access.preview}</>}
        {access.phase === 'processing' && <><ActivityIndicator accessibilityLabel="Analyzing locally" />{access.processing}</>}
        {access.phase === 'ready' && !access.completed && <>
          <Text accessibilityRole="alert" style={styles.body}>This attempt did not produce a confirmed saved result. Recording quality, processing or saved readback may have failed. Review details, then prepare another attempt.</Text>
          <Button label="Prepare another recording" onPress={() => { setCameraEntered(false); go('setup'); }} />
          <Button label="View measurements on this phone" onPress={() => go('history')} />
        </>}
      </>}
      {page === 'results' && <><MeasurementResults access={access} />
        <Button label="Done — Home" onPress={home} />
        <Button label="View measurements on this phone" onPress={() => go('history')} />
      </>}
      {page === 'history' && access.nativeAvailable && <>{access.history}
        {access.analysis && access.analysis.status !== 'unselected' && <MeasurementResults access={{ ...access, completed: null }} />}
        <Button label="Prepare a new measurement" onPress={() => go('setup')} />
      </>}
      {!!access.error && <Text accessibilityRole="alert" style={styles.body}>This attempt needs attention. Review Technical details for the recorded error and use the available retry or discard controls.</Text>}
      <Button label={details ? 'Hide Technical details' : 'Technical details'} onPress={() => setDetails(value => !value)} />
      {details && <View style={styles.details}>{access.technical}</View>}
      <Text style={styles.note}>Local processing · No gait upload · Research use, not diagnosis</Text>
    </ScrollView>
    {/* Child routes provide URL identity; presentation lives above Slot so an
        unsafe deep link cannot tear down the one active native camera. */}
    <Slot />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream }, header: { padding: 16, gap: 10, backgroundColor: colors.white },
  brand: { fontSize: 16, fontWeight: '700', color: colors.primaryDark },
  content: { padding: 20, paddingBottom: 48, gap: 18, width: '100%', maxWidth: 680, alignSelf: 'center' },
  title: { fontSize: 28, lineHeight: 35, fontWeight: '700', color: colors.ink }, body: { fontSize: 16, lineHeight: 25, color: colors.inkMuted },
  button: { minHeight: 48, padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: colors.primaryDark },
  buttonText: { fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.white }, disabled: { opacity: .45 },
  details: { gap: 12 }, note: { color: colors.inkMuted, fontSize: 14, lineHeight: 22 },
});
