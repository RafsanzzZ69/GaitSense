import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppShell, Button, Card, ScoreRing, SectionTitle } from '@/components/ui';
import { colors, radii } from '@/constants/theme';
import { history, recommendations, scoreBreakdown } from '@/data/mock';

export default function Dashboard() {
  const { width } = useWindowDimensions();
  const wide = width >= 1080;
  return <AppShell title="Good evening, Mahir" subtitle="Hereâ€™s how your movement is trending.">
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={[styles.heroGrid, !wide && { flexDirection: 'column' }]}>
        <Card style={styles.scoreCard}>
          <View style={styles.scoreCopy}><Text style={styles.overline}>LATEST ASSESSMENT</Text><Text style={styles.cardTitle}>Your movement snapshot</Text><Text style={styles.body}>Your overall gait is stable. Focus on posture and left arm mobility for your next improvement.</Text><View style={styles.changePill}><Ionicons name="trending-up" size={15} color={colors.success} /><Text style={styles.changeText}>3 points since Jul 25</Text></View></View>
          <View style={styles.ringWrap}><ScoreRing score={73} /><Text style={styles.assessed}>Assessed today</Text></View>
        </Card>
        <Card style={styles.startCard}><View style={styles.startIcon}><Ionicons name="scan-outline" size={28} color={colors.primary} /></View><Text style={styles.cardTitle}>Ready for a new walk?</Text><Text style={styles.body}>Find a clear 4â€“6 metre path and ask someone to hold your phone.</Text><Button label="Start assessment" icon="arrow-forward" onPress={() => router.push('/assess')} /></Card>
      </View>

      <View style={[styles.lowerGrid, !wide && { flexDirection: 'column' }]}>
        <View style={styles.mainColumn}>
          <SectionTitle action={<Pressable onPress={() => router.push('/report/latest')}><Text style={styles.link}>Full report â†’</Text></Pressable>}>Health breakdown</SectionTitle>
          <Card style={styles.breakdownCard}>{scoreBreakdown.map((item, i) => <View key={item.label} style={[styles.metric, i === scoreBreakdown.length - 1 && { borderBottomWidth: 0 }]}><View style={styles.metricTop}><Text style={styles.metricLabel}>{item.label}</Text><Text style={styles.metricScore}>{item.score}<Text style={styles.metricUnit}>/100</Text></Text></View><View style={styles.track}><View style={[styles.fill, { width: `${item.score}%`, backgroundColor: item.color }]} /></View></View>)}</Card>
          <SectionTitle>Recommended for you</SectionTitle>
          <View style={styles.recGrid}>{recommendations.map(r => <Card key={r.title} style={styles.recCard}><View style={[styles.recIcon, { backgroundColor: r.tone }]}><Ionicons name={r.icon as never} size={22} color={colors.primaryDark} /></View><Text style={styles.recTitle}>{r.title}</Text><Text style={styles.recDetail}>{r.detail}</Text></Card>)}</View>
        </View>
        <View style={styles.sideColumn}>
          <SectionTitle action={<Pressable onPress={() => router.push('/history')}><Text style={styles.link}>View all</Text></Pressable>}>Recent activity</SectionTitle>
          <Card style={{ padding: 6 }}>{history.map((h, i) => <View key={h.date} style={[styles.historyRow, i < history.length - 1 && styles.historyBorder]}><View style={styles.historyScore}><Text style={styles.historyNumber}>{h.score}</Text></View><View style={{ flex: 1 }}><Text style={styles.historyDate}>{h.date}</Text><Text style={styles.historyNote}>{h.note}</Text></View><Ionicons name="chevron-forward" size={17} color="#A8B5B2" /></View>)}</Card>
          <Card style={styles.riskCard}><View style={styles.riskHead}><Text style={styles.overline}>FALL RISK</Text><View style={styles.lowPill}><Text style={styles.lowText}>LOW</Text></View></View><Text style={styles.riskText}>Your current speed and balance indicators are within a healthy range.</Text><View style={styles.riskLine}><View style={styles.riskDot} /></View></Card>
        </View>
      </View>
    </ScrollView>
  </AppShell>;
}

const styles = StyleSheet.create({
  scroll: { gap: 30 }, heroGrid: { flexDirection: 'row', gap: 20 }, scoreCard: { flex: 2, flexDirection: 'row', minHeight: 240, alignItems: 'center' }, scoreCopy: { flex: 1, paddingRight: 20 }, overline: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, cardTitle: { color: colors.ink, fontSize: 21, fontWeight: '800', marginTop: 9, letterSpacing: -.3 }, body: { color: colors.inkMuted, fontSize: 13, lineHeight: 21, marginTop: 10 }, changePill: { alignSelf: 'flex-start', marginTop: 17, backgroundColor: colors.mintLight, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill }, changeText: { color: colors.success, fontSize: 11, fontWeight: '700' }, ringWrap: { alignItems: 'center', marginHorizontal: 12 }, assessed: { color: colors.inkMuted, fontSize: 10, marginTop: 10 }, startCard: { flex: 1, minWidth: 260, justifyContent: 'center' }, startIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  lowerGrid: { flexDirection: 'row', gap: 28 }, mainColumn: { flex: 2, gap: 2 }, sideColumn: { flex: 1, minWidth: 275, gap: 2 }, link: { color: colors.primary, fontSize: 12, fontWeight: '700' }, breakdownCard: { marginBottom: 27 }, metric: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EDF1EF' }, metricTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 }, metricLabel: { color: colors.ink, fontSize: 13, fontWeight: '600' }, metricScore: { color: colors.ink, fontWeight: '800' }, metricUnit: { color: colors.inkMuted, fontWeight: '500', fontSize: 10 }, track: { height: 7, borderRadius: 5, backgroundColor: '#EDF1EF', overflow: 'hidden' }, fill: { height: '100%', borderRadius: 5 }, recGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, recCard: { flex: 1, minWidth: 170, padding: 16 }, recIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, recTitle: { color: colors.ink, fontWeight: '700', fontSize: 13, marginTop: 13 }, recDetail: { color: colors.inkMuted, fontSize: 10, marginTop: 5 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15 }, historyBorder: { borderBottomWidth: 1, borderBottomColor: '#EDF1EF' }, historyScore: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.mintLight, alignItems: 'center', justifyContent: 'center' }, historyNumber: { color: colors.primaryDark, fontWeight: '800' }, historyDate: { color: colors.ink, fontSize: 12, fontWeight: '700' }, historyNote: { color: colors.inkMuted, fontSize: 10, marginTop: 4 }, riskCard: { marginTop: 24, backgroundColor: '#F4FBF8' }, riskHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, lowPill: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.mint, borderRadius: radii.pill }, lowText: { fontSize: 9, color: colors.primaryDark, fontWeight: '800', letterSpacing: .8 }, riskText: { fontSize: 12, color: colors.inkMuted, lineHeight: 19, marginTop: 15 }, riskLine: { height: 6, backgroundColor: '#D8E9E2', borderRadius: 5, marginTop: 18 }, riskDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.success, marginTop: -4, marginLeft: '18%', borderWidth: 3, borderColor: colors.white },
});
