import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthProvider';
import { AndroidAuthGate } from '@/auth/AndroidAuthGate';
import { EntryPreferencesProvider } from '@/entry/EntryPreferencesProvider';

// One stable native auth owner; the gate retains only unsettled capture work.
export default function AndroidRootLayout() {
  return <SafeAreaProvider><AuthProvider>
    <StatusBar style="dark" />
    <EntryPreferencesProvider><AndroidAuthGate /></EntryPreferencesProvider>
  </AuthProvider></SafeAreaProvider>;
}
