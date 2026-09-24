import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, shadow } from '@/constants/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Logo({ light = false }: { light?: boolean }) {
  return <View style={styles.logo}><View style={styles.logoMark}><Ionicons name="walk" size={20} color={colors.white} /></View><Text style={[styles.logoText, light && { color: colors.white }]}>GaitSense</Text></View>;
}

const nav = [
  { href: '/dashboard', label: 'Overview', icon: 'grid-outline' as IconName },
  { href: '/assess', label: 'New assessment', icon: 'scan-outline' as IconName },
  { href: '/history', label: 'Progress', icon: 'stats-chart-outline' as IconName },
  { href: '/profile', label: 'Profile', icon: 'person-outline' as IconName },
];

export function AppShell({ children, title, subtitle, action }: PropsWithChildren<{ title: string; subtitle?: string; action?: ReactNode }>) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const pathname = usePathname();
  return (
    <View style={styles.shell}>
      {wide && <View style={styles.sidebar}>
        <Logo light />
        <View style={styles.navList}>{nav.map(item => {
          const active = pathname === item.href;
          return <Link key={item.href} href={item.href as never} asChild><Pressable accessibilityLabel={item.label} style={[styles.navItem, active && styles.navActive]}><Ionicons name={item.icon} size={20} color={active ? colors.white : '#A7C2BB'} /><Text style={[styles.navText, active && { color: colors.white }]}>{item.label}</Text></Pressable></Link>;
        })}</View>
        <View style={styles.sideNotice}><Ionicons name="shield-checkmark-outline" size={22} color="#8FE0CC" /><Text style={styles.sideNoticeTitle}>Your data, protected</Text><Text style={styles.sideNoticeText}>Health data stays private and controlled by you.</Text></View>
      </View>}
      <SafeAreaView style={styles.main} edges={['top', 'left', 'right']}>
        <View style={styles.topbar}>
          {!wide && <Logo />}
          <View style={styles.heading}><Text style={styles.pageTitle}>{title}</Text>{subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}</View>
          {action ?? <View style={styles.avatar}><Text style={styles.avatarText}>MR</Text></View>}
        </View>
        <View style={styles.content}>{children}</View>
        {!wide && <View style={styles.bottomNav}>{nav.map(item => {
          const active = pathname === item.href;
          return <Link key={item.href} href={item.href as never} asChild><Pressable accessibilityLabel={item.label} style={styles.bottomItem}><Ionicons name={active ? item.icon.replace('-outline', '') as IconName : item.icon} size={22} color={active ? colors.primary : '#7B8B91'} /><Text style={[styles.bottomText, active && { color: colors.primary }]}>{item.label === 'New assessment' ? 'Assess' : item.label}</Text></Pressable></Link>;
        })}</View>}
      </SafeAreaView>
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) { return <View style={[styles.card, style]}>{children}</View>; }

export function Button({ label, icon, secondary, onPress }: { label: string; icon?: IconName; secondary?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, pressed && { opacity: .82 }]}>{icon && <Ionicons name={icon} size={19} color={secondary ? colors.primary : colors.white} />}<Text style={[styles.buttonText, secondary && { color: colors.primary }]}>{label}</Text></Pressable>;
}

export function SectionTitle({ children, action }: PropsWithChildren<{ action?: ReactNode }>) { return <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{children}</Text>{action}</View>; }

export function ScoreRing({ score, size = 154 }: { score: number; size?: number }) {
  const inner = size - 18;
  return <View accessibilityLabel={`Health score ${score} out of 100`} style={[styles.scoreOuter, { width: size, height: size, borderRadius: size / 2 }]}><View style={[styles.scoreInner, { width: inner, height: inner, borderRadius: inner / 2 }]}><Text style={[styles.scoreValue, { fontSize: size * .29 }]}>{score}</Text><Text style={styles.scoreUnit}>out of 100</Text></View></View>;
}

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: 'row', backgroundColor: colors.cream },
  sidebar: { width: 246, backgroundColor: colors.ink, padding: 28, paddingTop: 34 },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 10 }, logoMark: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, logoText: { fontSize: 21, fontWeight: '800', color: colors.ink, letterSpacing: -.5 },
  navList: { marginTop: 52, gap: 8 }, navItem: { height: 48, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14, borderRadius: 12 }, navActive: { backgroundColor: colors.primary }, navText: { color: '#A7C2BB', fontSize: 15, fontWeight: '600' },
  sideNotice: { marginTop: 'auto', borderWidth: 1, borderColor: '#27444A', borderRadius: radii.md, padding: 16, gap: 7 }, sideNoticeTitle: { color: colors.white, fontWeight: '700', marginTop: 4 }, sideNoticeText: { color: '#9EB6B2', fontSize: 12, lineHeight: 18 },
  main: { flex: 1 }, topbar: { minHeight: 92, paddingHorizontal: Platform.OS === 'web' ? 36 : 20, paddingVertical: 16, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 18 }, heading: { flex: 1 }, pageTitle: { fontSize: 25, color: colors.ink, fontWeight: '800', letterSpacing: -.6 }, pageSubtitle: { color: colors.inkMuted, marginTop: 4, fontSize: 13 }, avatar: { width: 40, height: 40, backgroundColor: colors.mint, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: colors.primaryDark, fontWeight: '800' },
  content: { flex: 1, width: '100%', maxWidth: 1320, alignSelf: 'center', padding: Platform.OS === 'web' ? 32 : 18, paddingBottom: 100 },
  bottomNav: { height: 72, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', position: 'absolute', left: 0, right: 0, bottom: 0 }, bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }, bottomText: { fontSize: 10, color: '#7B8B91', fontWeight: '600' },
  card: { backgroundColor: colors.white, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: 22, ...shadow },
  button: { minHeight: 48, backgroundColor: colors.primary, borderRadius: 13, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, secondaryButton: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primary }, buttonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, letterSpacing: -.2 },
  scoreOuter: { borderWidth: 9, borderColor: colors.mint, borderTopColor: colors.primary, borderRightColor: colors.primary, borderBottomColor: colors.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-25deg' }] }, scoreInner: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '25deg' }] }, scoreValue: { fontWeight: '800', color: colors.ink, lineHeight: 48 }, scoreUnit: { color: colors.inkMuted, fontSize: 11, marginTop: 4 },
});
