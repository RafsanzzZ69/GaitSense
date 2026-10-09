import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '@/constants/theme';
import { useAuth } from './useAuth';
import { validateAuthForm } from './auth-errors';
import type { AuthOperation } from './auth-types';

type Mode = 'welcome' | 'login' | 'register' | 'reset' | 'verification';
export const authRoutes = {
  welcome: '/account', login: '/account/sign-in', register: '/account/create',
  reset: '/account/reset', verification: '/account/verification',
} as const;

function Button({ title, onPress, disabled = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled}
    accessibilityState={{ disabled }} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

export function AuthScreen({ mode }: { mode: Mode }) {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(true);
  const pending = useRef(false);
  const navigated = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const leaveForms = (verification = false) => {
    // Clear the independent account stack; never push Home over a gait owner.
    router.dismissAll();
    router.replace(verification ? authRoutes.verification : '/');
  };
  useEffect(() => {
    if ((mode === 'register' || mode === 'login') && auth.session.status === 'SIGNED_IN' && !auth.busy && !navigated.current) {
      navigated.current = true;
      leaveForms(mode === 'register' && !auth.session.user.emailVerified);
    }
  }, [mode, auth.session, auth.busy]);
  const blocked = submitting || auth.busy !== null || auth.session.status === 'RESTORING' || auth.session.status === 'ERROR';
  const execute = async (operation: AuthOperation) => {
    if (pending.current || blocked) return;
    if (operation === 'register' || operation === 'login' || operation === 'reset') {
      const invalid = validateAuthForm(operation, email, password, confirmation);
      if (invalid) { setMessage(invalid); return; }
    }
    pending.current = true;
    setSubmitting(true);
    setMessage('');
    try {
      const result = await auth.run(operation, email, password, confirmation);
      if (mounted.current) { setMessage(result.message); setPassword(''); setConfirmation(''); }
    } finally {
      pending.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };
  const heading = { welcome: 'Welcome to GaitSense', login: 'Sign in with email', register: 'Create your account', reset: 'Reset your password', verification: 'Verify your email' }[mode];
  const field = (label: string, value: string, change: (value: string) => void, kind: 'email' | 'password' | 'confirmation') => <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={change} editable={!blocked}
      autoCapitalize="none" autoCorrect={false} keyboardType={kind === 'email' ? 'email-address' : 'default'}
      autoComplete={kind === 'email' ? 'email' : mode === 'register' ? 'new-password' : 'current-password'}
      textContentType={kind === 'email' ? 'emailAddress' : mode === 'register' ? 'newPassword' : 'password'}
      importantForAutofill="yes" secureTextEntry={kind !== 'email' && !showPassword}
      returnKeyType="done" onSubmitEditing={() => { if (mode === 'register' || mode === 'login' || mode === 'reset') void execute(mode); }}
      style={styles.input} />
  </View>;
  return <SafeAreaView style={styles.page}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.brand}>GaitSense</Text>
        <Text accessibilityRole="header" style={styles.title}>{heading}</Text>
        <Text style={styles.body}>Your account identifies the app user. Measurements remain on this phone and are shared across accounts on this device.</Text>
        {auth.session.status === 'RESTORING' && <View accessibilityLiveRegion="polite"><ActivityIndicator accessibilityLabel="Restoring account" /><Text style={styles.body}>Restoring your account…</Text></View>}
        {auth.session.status === 'ERROR' && <View><Text accessibilityRole="alert" style={styles.body}>Account access could not initialize. Local measurements are still available.</Text><Button title="Retry account access" onPress={auth.retry} /></View>}
        {mode === 'welcome' && (auth.session.status === 'SIGNED_IN' ? <>
          <Text style={styles.body}>An account is signed in on this phone.</Text>
          {!auth.session.user.emailVerified && <Button title="Email verification" onPress={() => router.push(authRoutes.verification)} disabled={blocked} />}
          <Button title="Continue to local app" onPress={() => leaveForms()} />
        </> : <>
          <Button title="Sign in with email" onPress={() => router.push(authRoutes.login)} disabled={blocked} />
          <Button title="Create account" onPress={() => router.push(authRoutes.register)} disabled={blocked} secondary />
        </>)}
        {(mode === 'register' || mode === 'login' || mode === 'reset') && <>
          {field('Email', email, setEmail, 'email')}
          {mode !== 'reset' && <>
            {field('Password', password, setPassword, 'password')}
            {mode === 'register' && field('Confirm password', confirmation, setConfirmation, 'confirmation')}
            <Button title={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(value => !value)} disabled={blocked} secondary />
          </>}
          {mode === 'register' && <Text style={styles.body}>Use a password that meets this account service’s policy. Email verification will be requested after registration.</Text>}
          <Button title={submitting ? 'Please wait…' : mode === 'register' ? 'Create account' : mode === 'login' ? 'Sign in' : 'Send reset instructions'} disabled={blocked} onPress={() => void execute(mode)} />
          {mode === 'login' && <Button title="Forgot password" disabled={blocked} onPress={() => router.push(authRoutes.reset)} secondary />}
        </>}
        {mode === 'verification' && (auth.session.status === 'SIGNED_IN' ? <>
          <Text style={styles.body}>{auth.session.user.emailVerified ? 'Firebase reports that your email is verified.' : 'Check your inbox for the verification link. If the email did not arrive, you can request another. Verification does not block local gait measurement.'}</Text>
          {!auth.session.user.emailVerified && <Button title="Resend verification email" disabled={blocked} onPress={() => void execute('resend')} />}
          <Button title="I have verified — refresh" disabled={blocked} onPress={() => void execute('refresh')} secondary />
          <Text style={styles.body}>Resending and refreshing need internet. Continue locally at any time.</Text>
          <Button title="Continue to local app" onPress={() => leaveForms()} secondary />
        </> : <Text style={styles.body}>Sign in with email to manage email verification.</Text>)}
        {message !== '' && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
        {auth.busy && <ActivityIndicator accessibilityLabel="Account operation in progress" />}
        {mode !== 'welcome' && <Button title="Back to account welcome" onPress={() => router.dismissTo(authRoutes.welcome)} secondary />}
        {(mode !== 'verification' || auth.session.status !== 'SIGNED_IN') && <Button title="Return to Home" onPress={() => leaveForms()} secondary />}
        <Text style={styles.caption}>Email account operations need internet. During this transition, Home and local measurement remain available without signing in. App entry protection comes in a later checkpoint. Non-diagnostic; scientific status: not evaluated.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  flex: { flex: 1 }, page: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 24, gap: 18, paddingBottom: 40, maxWidth: 560, width: '100%', alignSelf: 'center' },
  brand: { fontSize: 22, fontWeight: '800', color: colors.primaryDark },
  title: { fontSize: 30, lineHeight: 38, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 25, color: colors.inkMuted },
  field: { gap: 8 }, label: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.inkMuted, borderRadius: radii.sm, padding: 14, backgroundColor: colors.white, color: colors.ink, fontSize: 16 },
  button: { minHeight: 52, padding: 14, borderRadius: radii.sm, backgroundColor: colors.primaryDark, justifyContent: 'center', alignItems: 'center' },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.primaryDark },
  secondaryText: { color: colors.primaryDark }, pressed: { opacity: 0.85 }, disabled: { opacity: 0.6 },
  message: { color: colors.ink, fontSize: 16, lineHeight: 24 }, caption: { color: colors.inkMuted, fontSize: 14, lineHeight: 22 },
});
