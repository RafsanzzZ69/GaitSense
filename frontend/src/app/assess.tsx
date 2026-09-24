import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppShell, Button, Card } from '@/components/ui';
import { colors, radii } from '@/constants/theme';

export default function Assess() {
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { width } = useWindowDimensions();
  const wide = width >= 960;
  const start = () => {
    setRecording(true); setSeconds(0);
    timer.current = setInterval(() => setSeconds(s => { if (s >= 14) { if (timer.current) clearInterval(timer.current); setRecording(false); setTimeout(() => router.push('/report/latest'), 400); return 15; } return s + 1; }), 1000);
  };
  const stop = () => { if (timer.current) clearInterval(timer.current); setRecording(false); };
  return <AppShell title="New assessment" subtitle="Follow the setup guide for the most reliable result.">
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={[styles.layout, !wide && { flexDirection: 'column' }]}>
        <View style={styles.cameraColumn}>
          <View style={styles.cameraFrame}>
            {permission?.granted ? <CameraView style={StyleSheet.absoluteFill} facing="back" /> : <View style={styles.placeholder}><View style={styles.person}><View style={styles.head} /><View style={styles.torso} /><View style={styles.legs}><View style={styles.leg} /><View style={[styles.leg, { transform: [{ rotate: '-8deg' }] }]} /></View></View><Text style={styles.cameraTitle}>Camera preview</Text><Text style={styles.cameraText}>Allow camera access to frame the walking path.</Text></View>}
            <View style={styles.guideBox}><View style={[styles.corner, styles.tl]} /><View style={[styles.corner, styles.tr]} /><View style={[styles.corner, styles.bl]} /><View style={[styles.corner, styles.br]} /></View>
            <View style={styles.quality}><View style={[styles.qualityDot, { backgroundColor: permission?.granted ? colors.success : colors.amber }]} /><Text style={styles.qualityText}>{permission?.granted ? 'Camera ready' : 'Preview unavailable'}</Text></View>
            {recording && <View style={styles.timer}><View style={styles.recordDot} /><Text style={styles.timerText}>00:{String(seconds).padStart(2, '0')} / 00:15</Text></View>}
          </View>
          {!permission?.granted ? <Button label="Allow camera access" icon="camera-outline" onPress={requestPermission} /> : <Button label={recording ? 'Stop recording' : 'Start 15-second recording'} icon={recording ? 'stop' : 'radio-button-on'} onPress={recording ? stop : start} />}
          {Platform.OS === 'web' && <Text style={styles.browserNote}>Your browser may ask for camera permission. Video processing will be connected to the GaitSense API in the next backend phase.</Text>}
        </View>
        <View style={styles.guideColumn}>
          <Card><Text style={styles.overline}>BEFORE YOU RECORD</Text><Text style={styles.title}>Set up your space</Text>{[
            ['resize-outline', 'Keep 4â€“6 metres clear', 'Use a flat, uncluttered walking path.'],
            ['phone-portrait-outline', 'Place the phone steadily', 'Keep the full body visible from head to feet.'],
            ['sunny-outline', 'Use even lighting', 'Avoid bright windows directly behind you.'],
            ['walk-outline', 'Walk naturally', 'Do not change your usual pace or posture.'],
          ].map((s, i) => <View key={s[1]} style={styles.stepRow}><View style={styles.stepIcon}><Ionicons name={s[0] as never} size={20} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.stepTitle}>{i + 1}. {s[1]}</Text><Text style={styles.stepText}>{s[2]}</Text></View></View>)}</Card>
          <Card style={styles.safety}><Ionicons name="medical-outline" size={22} color={colors.coral} /><View style={{ flex: 1 }}><Text style={styles.safetyTitle}>Safety first</Text><Text style={styles.safetyText}>Ask someone to assist if you feel unsteady. Stop immediately if walking causes pain or dizziness.</Text></View></Card>
        </View>
      </View>
    </ScrollView>
  </AppShell>;
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 30 }, layout: { flexDirection: 'row', gap: 26 }, cameraColumn: { flex: 1.5, gap: 15 }, guideColumn: { flex: 1, gap: 16 }, cameraFrame: { minHeight: 510, backgroundColor: '#142B34', borderRadius: radii.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, placeholder: { alignItems: 'center' }, cameraTitle: { color: colors.white, fontSize: 18, fontWeight: '800', marginTop: 20 }, cameraText: { color: '#9CB1B3', fontSize: 12, marginTop: 7 }, person: { width: 80, height: 190, alignItems: 'center' }, head: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#5C7478' }, torso: { width: 5, height: 84, backgroundColor: '#5C7478' }, legs: { flexDirection: 'row', gap: 18 }, leg: { height: 68, width: 5, backgroundColor: '#5C7478', transformOrigin: 'top' }, guideBox: { position: 'absolute', width: '53%', height: '80%' }, corner: { position: 'absolute', width: 32, height: 32, borderColor: '#77D8C2' }, tl: { top: 0, left: 0, borderTopWidth: 2, borderLeftWidth: 2 }, tr: { top: 0, right: 0, borderTopWidth: 2, borderRightWidth: 2 }, bl: { bottom: 0, left: 0, borderBottomWidth: 2, borderLeftWidth: 2 }, br: { bottom: 0, right: 0, borderBottomWidth: 2, borderRightWidth: 2 }, quality: { position: 'absolute', left: 18, top: 18, backgroundColor: 'rgba(5,18,24,.72)', paddingHorizontal: 11, paddingVertical: 8, borderRadius: radii.pill, flexDirection: 'row', alignItems: 'center', gap: 7 }, qualityDot: { width: 7, height: 7, borderRadius: 4 }, qualityText: { color: colors.white, fontSize: 10, fontWeight: '700' }, timer: { position: 'absolute', top: 18, right: 18, backgroundColor: 'rgba(5,18,24,.78)', borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 }, recordDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F06B5C' }, timerText: { color: colors.white, fontSize: 11, fontWeight: '700' }, browserNote: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, textAlign: 'center' }, overline: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, title: { color: colors.ink, fontSize: 22, fontWeight: '800', marginTop: 8, marginBottom: 16 }, stepRow: { flexDirection: 'row', gap: 13, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EDF1EF' }, stepIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: colors.mintLight, alignItems: 'center', justifyContent: 'center' }, stepTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' }, stepText: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 4 }, safety: { flexDirection: 'row', gap: 12, backgroundColor: '#FFF6F3', borderColor: '#F4D8D2', padding: 17 }, safetyTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' }, safetyText: { color: colors.inkMuted, fontSize: 10, lineHeight: 16, marginTop: 4 },
});
