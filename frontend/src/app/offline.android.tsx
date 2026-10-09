import { Redirect } from 'expo-router';
// Compatibility entry: the scoped measurement layout owns the only controller.
export default function AndroidMeasurementWorkspace() { return <Redirect href="/measurement/setup" />; }
