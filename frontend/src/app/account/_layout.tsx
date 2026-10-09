import { Redirect } from 'expo-router';
// Keep account routes native-only; preserve the existing web showcase.
export default function UnsupportedAccountLayout() { return <Redirect href="/" />; }
