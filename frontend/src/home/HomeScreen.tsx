import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const opening = useRef(false);
  const [starting, setStarting] = useState(false);
  useFocusEffect(useCallback(() => {
    opening.current = false;
    setStarting(false);
  }, []));

  const startMeasurement = () => {
    // A ref closes the rapid-tap window before React can disable the button.
    if (opening.current) return;
    opening.current = true;
    setStarting(true);
    try {
      router.push('/offline');
    } catch (error) {
      opening.current = false;
      setStarting(false);
      throw error;
    }
  };

  return <SafeAreaView style={styles.page}>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.brand}>
        <View style={styles.brandMark}><Ionicons name="walk-outline" size={28} color={colors.primaryDark} /></View>
        <Text accessibilityRole="header" style={styles.brandName}>GaitSense</Text>
      </View>
      <View style={styles.introduction}>
        <Text accessibilityRole="header" style={styles.title}>Your next measurement starts here.</Text>
        <Text style={styles.description}>Offline gait analysis using your phone camera.</Text>
      </View>
      <View style={styles.measurementCard}>
        <Text accessibilityRole="header" style={styles.cardTitle}>A guided walking recording</Text>
        <Text style={styles.body}>Set up a side view, record a short walk, then process it on this phone.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Start Gait Measurement"
          accessibilityState={{ disabled: starting, busy: starting }} disabled={starting}
          onPress={startMeasurement} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, starting && styles.disabled]}>
          <Text style={styles.buttonText}>{starting ? 'Opening measurement…' : 'Start Gait Measurement'}</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.white} />
        </Pressable>
        <Text style={styles.caption}>Saved measurements and History are available inside the measurement workspace.</Text>
      </View>
      <View style={styles.localCard}>
        <Ionicons name="phone-portrait-outline" size={24} color={colors.primaryDark} />
        <View style={styles.localCopy}>
          <Text accessibilityRole="header" style={styles.cardTitle}>Processed locally. Stored on this phone.</Text>
          <Text style={styles.body}>Recording, pose processing and saved measurements work without internet. Gait recordings and results are not uploaded.</Text>
        </View>
      </View>
      <View style={styles.researchNote}>
        <Text accessibilityRole="header" style={styles.noteTitle}>For research, not diagnosis</Text>
        <Text style={styles.noteText}>Scientific status: not evaluated. GaitSense is not clinically validated and does not provide a diagnosis or treatment guidance.</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, paddingBottom: 40, gap: 24, maxWidth: 640, width: '100%', alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: { width: 52, height: 52, borderRadius: radii.md, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: colors.ink, fontSize: 25, fontWeight: '800', letterSpacing: -0.5 },
  introduction: { gap: 12, paddingTop: 12 },
  title: { color: colors.ink, fontSize: 32, lineHeight: 39, fontWeight: '700', letterSpacing: -0.6 },
  description: { color: colors.inkMuted, fontSize: 18, lineHeight: 28 },
  measurementCard: { backgroundColor: colors.white, borderRadius: radii.lg, padding: 24, gap: 16, borderWidth: 1, borderColor: colors.line },
  cardTitle: { color: colors.ink, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  body: { color: colors.inkMuted, fontSize: 16, lineHeight: 25 },
  primaryButton: { minHeight: 56, paddingVertical: 16, paddingHorizontal: 20, borderRadius: radii.md, backgroundColor: colors.primaryDark, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  buttonText: { flex: 1, color: colors.white, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  pressed: { opacity: 0.85 }, disabled: { opacity: 0.65 },
  caption: { color: colors.inkMuted, fontSize: 14, lineHeight: 22 },
  localCard: { flexDirection: 'row', gap: 16, padding: 20, backgroundColor: colors.mintLight, borderRadius: radii.md },
  localCopy: { flex: 1, gap: 8 },
  researchNote: { gap: 8, paddingHorizontal: 4 },
  noteTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  noteText: { color: colors.inkMuted, fontSize: 14, lineHeight: 22 },
});
