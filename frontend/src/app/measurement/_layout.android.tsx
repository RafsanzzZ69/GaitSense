import OfflineCapture from '@/offline/OfflineCapture';
import { MeasurementFlow } from '@/measurement/MeasurementFlow';
import { useNavigationSettlement } from '@/navigation/NavigationSettlement';

export default function MeasurementLayout() {
  const boundary = useNavigationSettlement();
  return <OfflineCapture navigationBoundary={boundary} renderMeasurement={access => <MeasurementFlow access={access} />} />;
}
