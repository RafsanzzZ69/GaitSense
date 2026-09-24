import type { PoseFrame, Report, Session } from './client';

// Deliberately synthetic examples. Never import private participant recordings here.
export const sampleSessions: Session[] = [
  { id: 'sample-2', createdAt: '2026-09-21T08:30:00Z', status: 'completed', assessmentId: 'sample-report', capture: { angle: 'side_left', durationSeconds: 12, resolution: { width: 1280, height: 720 } } },
  { id: 'sample-1', createdAt: '2026-09-14T08:30:00Z', status: 'completed', assessmentId: 'sample-previous', capture: { angle: 'side_left', durationSeconds: 12 } },
];
export const sampleReport: Report = {
  id: 'sample-report', sessionId: 'sample-2', createdAt: sampleSessions[0].createdAt, angle: 'side_left',
  pipelineVersion: '0.2.0', kind: 'measurement_report', limitations: ['Illustrative values only. No clinical interpretation.'],
  features: { metrics: { cadenceSpm: 108, kneeFlexionLeftDeg: 48.2, armSwingLeftDeg: 22.4 },
    definitions: { cadenceSpm: { unit: 'steps/minute', method: 'Illustrative candidate step timing' },
      kneeFlexionLeftDeg: { unit: 'degrees', method: 'Illustrative projected 2D knee flexion' },
      armSwingLeftDeg: { unit: 'degrees', method: 'Illustrative projected arm-angle range' } },
    unavailable: { walkingSpeedMps: 'Requires independently validated spatial calibration.',
      overallScore: 'No clinically validated health score is enabled.', fallRisk: 'No validated fall-risk model is enabled.' },
    quality: { usableFrameRatio: 0.94, meanLandmarkVisibility: 0.96, warnings: ['These values and the animated skeleton are synthetic demonstration data.'] } },
};
export const sampleFrames: PoseFrame[] = Array.from({ length: 90 }, (_, i) => {
  const phase = Math.PI / 3 + i / 15 * Math.PI * 1.8;
  const landmarks = Array.from({ length: 33 }, (_, index) => ({ index, x: .5, y: .19, z: 0, visibility: 1 }));
  const put = (index: number, x: number, y: number) => { landmarks[index] = { ...landmarks[index], x, y }; };
  put(0, .5, .16); put(11, .46, .29); put(12, .53, .29); put(23, .47, .54); put(24, .53, .54);
  for (const [side, sign] of [[0, 1], [1, -1]]) {
    const swing = Math.sin(phase) * sign;
    put(13 + side, .5 - swing * .075, .4); put(15 + side, .5 - swing * .14, .50);
    put(25 + side, .5 + swing * .10, .69); put(27 + side, .5 + swing * .17, .86 - Math.max(0, swing) * .08);
    put(29 + side, .5 + swing * .17, .88 - Math.max(0, swing) * .08);
    put(31 + side, .54 + swing * .17, .88 - Math.max(0, swing) * .08);
  }
  return { timestampMs: i * 1000 / 15, landmarks };
});
