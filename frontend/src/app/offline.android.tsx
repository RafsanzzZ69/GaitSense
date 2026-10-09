import { useRouter } from 'expo-router';
import OfflineCapture from '@/offline/OfflineCapture';
import { MeasurementWorkspaceHeader } from '@/home/MeasurementWorkspaceHeader';
import { useNavigationSettlement } from '@/navigation/NavigationSettlement';

export default function AndroidMeasurementWorkspace() {
  const router = useRouter();
  const navigationBoundary = useNavigationSettlement();
  const pendingDeparture = !navigationBoundary.canStart();
  return <OfflineCapture navigationBoundary={navigationBoundary} renderWorkspaceHeader={({ canLeave, idle }) =>
    <MeasurementWorkspaceHeader canLeave={canLeave} idle={idle} pendingDeparture={pendingDeparture}
      onHome={() => router.dismissTo(pendingDeparture ? '/account' : '/')} />
  } />;
}
