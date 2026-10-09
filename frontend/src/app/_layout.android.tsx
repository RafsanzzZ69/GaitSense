import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/auth/AuthProvider';

// Stable root subscription; no auth-dependent keys, redirects or capture gates.
export default function AndroidRootLayout() {
  return <SafeAreaProvider><AuthProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="offline" dangerouslySingular={() => 'gaitsense-measurement'} />
    </Stack>
  </AuthProvider></SafeAreaProvider>;
}
