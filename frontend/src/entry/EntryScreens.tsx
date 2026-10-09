import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '@/constants/theme';
import { useEntryPreferences } from './EntryPreferencesProvider';
import { ACKNOWLEDGEMENT_VERSION, entryReady } from './entry-preferences';

export const acknowledgementContent = [
  ['Purpose and limits', 'GaitSense is a prototype gait-analysis research app using your phone camera. It is non-diagnostic and does not provide medical diagnosis or treatment advice. Scientific status: not evaluated.'],
  ['Camera and local processing', 'Camera video is used to measure walking. Pose processing and saved analysis are designed to work locally and offline. Follow the capture and setup instructions for meaningful output.'],
  ['Measurements on this phone', 'Gait measurements are stored on this device. The current app does not upload or synchronize gait videos, landmarks or results to Firebase or other cloud storage. History is shared across accounts on this phone. Signing out does not delete it.'],
  ['Your account', 'Firebase Authentication manages your identity and sign-in session. Initial sign-in and email account operations need internet. An already restored sign-in can use local measurements offline.'],
  ['App use, not study consent', 'This acknowledgement covers use of the GaitSense app. It is not consent to participate in a research study. The recording instructions and local-processing notice still apply to each attempt.'],
] as const;
export const guideSteps = [
  { title: 'Understand your walking recording', paragraphs: [
    'GaitSense uses your phone camera for local gait-analysis research. Measurements can be processed and reviewed offline after your sign-in is restored.',
    'These are research measurements, not a diagnosis or treatment recommendation. Scientific status: not evaluated.',
  ] },
  { title: 'Prepare a clear side view', paragraphs: [
    'Keep the phone stable, use adequate lighting and leave a clear walking path. Keep the whole body, including head and feet, visible from the side.',
    'Choose the anatomical side of the person facing the camera. Travel direction means movement across the image. Confirm an upright image: head toward the top, feet toward the bottom. These are separate setup choices.',
  ] },
  { title: 'Record, review, then process', paragraphs: [
    'Follow the measurement setup and record a short, comfortable walking attempt, approximately 10–15 seconds. Keep the person visible throughout.',
    'Review the recording, then process it on this phone. A low-quality or rejected attempt may need to be repeated. If interrupted or cleanup fails, follow the existing discard or retry instructions.',
  ] },
  { title: 'Review results and local History', paragraphs: [
    'Review projected 2D knee flexion, candidate ankle-motion extrema and candidate-to-candidate temporal intervals when available. These outputs have research limitations and do not establish validated anatomical angles or walking events.',
    'Saved results and History stay on this phone and are shared across app accounts. Signing out leaves them here. Use the measurement workspace to review or explicitly delete local measurements.',
  ] },
] as const;
function Button({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled}
    accessibilityState={{ disabled }} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}
function Page({ title, children }: { title: string; children: ReactNode }) {
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.brand}>GaitSense</Text><Text accessibilityRole="header" style={styles.title}>{title}</Text>
    {children}
  </ScrollView></SafeAreaView>;
}
export function AcknowledgementScreen() {
  const preferences = useEntryPreferences();
  const router = useRouter();
  const [understood, setUnderstood] = useState(false);
  const pending = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const accepted = preferences.versions.acknowledgementVersion === ACKNOWLEDGEMENT_VERSION;
  const continueEntry = async () => {
    if (pending.current || preferences.busy || preferences.status !== 'READY' || (!accepted && !understood)) return;
    pending.current = true;
    try {
      if (!accepted && !await preferences.acknowledge(understood)) return;
      if (!mounted.current) return;
      if (entryReady(preferences.getSnapshot())) {
        if (accepted) router.dismissTo('/account');
        else { router.dismissAll(); router.replace('/'); }
      }
      else router.replace('/guide');
    } finally { pending.current = false; }
  };
  return <Page title="Before you begin">
    <Text style={styles.body}>Please review how this app works and how your measurements are handled.</Text>
    {acknowledgementContent.map(([title, body]) => <View key={title} style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{body}</Text>
    </View>)}
    {accepted ? <Text style={styles.body}>The current app acknowledgement is already saved on this phone. Reviewing it does not require accepting it again.</Text>
      : <Pressable accessibilityRole="checkbox" accessibilityLabel="I understand the app acknowledgement"
        accessibilityState={{ checked: understood, disabled: preferences.busy }} disabled={preferences.busy}
        onPress={() => setUnderstood(value => !value)} style={styles.checkbox}>
        <Text style={styles.cardTitle}>{understood ? '☑' : '☐'} I understand the app acknowledgement</Text>
      </Pressable>}
    {!!preferences.message && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.body}>{preferences.message}</Text>}
    {preferences.busy && <ActivityIndicator accessibilityLabel="Saving app acknowledgement" />}
    <Button title={accepted && entryReady(preferences) ? 'Done' : 'Continue'} disabled={preferences.busy || (!accepted && !understood)} onPress={() => void continueEntry()} />
    <Button title="Account" secondary disabled={preferences.busy} onPress={() => router.dismissTo('/account')} />
  </Page>;
}
export function GuideScreen() {
  const preferences = useEntryPreferences();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const pending = useRef(false), mounted = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const replay = entryReady(preferences);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const back = useCallback(() => {
    if (preferences.busy || pending.current) return;
    if (step > 0) setStep(step - 1);
    else if (replay) router.dismissTo('/account');
    else router.replace('/acknowledgement');
  }, [step, preferences.busy, replay, router]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
  }, [back]));
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  const done = async () => {
    if (pending.current || preferences.busy || step !== guideSteps.length - 1) return;
    pending.current = true;
    try {
      if (!replay && !await preferences.completeOnboarding()) return;
      if (!mounted.current) return;
      if (replay) router.dismissTo('/account');
      else { router.dismissAll(); router.replace('/'); }
    } finally { pending.current = false; }
  };
  const current = guideSteps[step];
  return <SafeAreaView style={styles.page}><ScrollView ref={scroll} contentContainerStyle={styles.content}>
    <Text style={styles.brand}>GaitSense</Text>
    <Text accessibilityLiveRegion="polite" style={styles.body}>App guide · {step + 1} of {guideSteps.length}</Text>
    <Text accessibilityRole="header" style={styles.title}>{current.title}</Text>
    <View style={styles.card}>{current.paragraphs.map(paragraph => <Text key={paragraph} style={styles.body}>{paragraph}</Text>)}</View>
    {!!preferences.message && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.body}>{preferences.message}</Text>}
    {preferences.busy && <ActivityIndicator accessibilityLabel="Saving app guide completion" />}
    {step < guideSteps.length - 1 ? <Button title="Next" disabled={preferences.busy} onPress={() => setStep(Math.min(step + 1, guideSteps.length - 1))} />
      : <Button title="Done" disabled={preferences.busy} onPress={() => void done()} />}
    <Button title="Back" secondary disabled={preferences.busy} onPress={back} />
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingBottom: 40, gap: 20, width: '100%', maxWidth: 560, alignSelf: 'center' },
  brand: { fontSize: 22, fontWeight: '800', color: colors.primaryDark },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700', color: colors.ink },
  card: { padding: 20, gap: 14, backgroundColor: colors.white, borderRadius: radii.sm },
  cardTitle: { fontSize: 18, lineHeight: 26, fontWeight: '600', color: colors.ink },
  body: { fontSize: 16, lineHeight: 25, color: colors.inkMuted },
  checkbox: { minHeight: 52, padding: 16, borderWidth: 1, borderColor: colors.primaryDark, borderRadius: radii.sm },
  button: { minHeight: 52, padding: 14, backgroundColor: colors.primaryDark, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.white, textAlign: 'center' },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primaryDark },
  secondaryText: { color: colors.primaryDark }, pressed: { opacity: .85 }, disabled: { opacity: .6 },
});
