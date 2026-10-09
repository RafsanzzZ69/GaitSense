import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="offline" dangerouslySingular={Platform.OS === 'android' ? () => 'gaitsense-measurement' : undefined} />
      </Stack>
    </SafeAreaProvider>
  );
}
