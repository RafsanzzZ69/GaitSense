import { Slot } from 'expo-router';
import { WebProvider } from '@/web/context';
import '@/web/styles.css';
export default function Layout() { return <WebProvider><Slot /></WebProvider>; }
