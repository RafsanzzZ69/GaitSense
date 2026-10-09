import { Text, View } from 'react-native';
import type { MeasurementAccess } from './measurement-access';
import { savedAnalysisPanel } from '../offline/saved-analysis-binding';

// Both immediate and reopened results consume the SAME saved loader projection.
// No metrics, scientific context or placeholder values are calculated here.
export function MeasurementResults({ access }: { access: MeasurementAccess }) {
  const presentation = access.analysis;
  const session = presentation?.selection.sessionId ? access.selectedSession : access.completed;
  const panel = presentation && savedAnalysisPanel(presentation);
  return <View style={{ gap: 16 }}>
    {session && <>
      <Text>{new Date(session.createdAt).toLocaleString()}</Text>
      <Text>Recording quality: {(session.usableFrameRatio * 100).toFixed(0)}% usable · {session.poseFrames} pose frames</Text>
      <Text>Visible side: {session.view === 'side_left' ? 'Left side of the person' : 'Right side of the person'}</Text>
    </>}
    <Text accessibilityLiveRegion="polite">{presentation?.label ?? 'Loading saved analysis…'}</Text>
    {panel?.groups.filter(group => ['Projected 2D knee flexion', 'Candidate ankle-motion extrema', 'Candidate-to-candidate temporal intervals'].some(label => group.title.startsWith(label)))
      .map(group => <View key={group.title} style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700' }}>{group.title}</Text>
        {/* A bounded excerpt of existing observations; full reasons stay in details. */}
        {group.lines.slice(1, 4).map((line, index) => <Text key={index} selectable>{line}</Text>)}
      </View>)}
    <Text>These research measurements are not a diagnosis. Projected angles are not validated anatomical 3D angles. Motion extrema are candidates, not confirmed foot contacts; candidate intervals are not validated step or stride times.</Text>
    <Text>Scientific status: not evaluated. Timing uses requested samples; actual decoded-frame timestamps and physical-cycle completeness are not established.</Text>
  </View>;
}
