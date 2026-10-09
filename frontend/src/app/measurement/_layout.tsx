import { Redirect } from 'expo-router';
// Android owns this flow; existing web/showcase destinations stay unchanged.
export default function MeasurementLayout() { return <Redirect href="/" />; }
