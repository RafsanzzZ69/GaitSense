import { useRouter } from 'expo-router';
import OfflineCapture from '@/offline/OfflineCapture';
import { MeasurementWorkspaceHeader } from '@/home/MeasurementWorkspaceHeader';

export default function AndroidMeasurementWorkspace() {
  const router = useRouter();
  return <OfflineCapture renderWorkspaceHeader={({ canLeave, idle }) =>
    <MeasurementWorkspaceHeader canLeave={canLeave} idle={idle} onHome={() => router.dismissTo('/')} />
  } />;
}
