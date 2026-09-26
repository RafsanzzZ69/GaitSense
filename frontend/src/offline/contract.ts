export type CapturePhase = 'ready' | 'countdown' | 'recording' | 'preview' | 'processing';
export type SideView = 'side_left' | 'side_right';
export type Session = {
  diagnostics?: string;
  id: string; createdAt: number; durationMs: number; sampledFrames: number;
  poseFrames: number; usableFrameRatio: number; landmarkCount: number;
  view: SideView; rawVideoRetained: boolean; modelSha256: string;
  extractorVersion: string; timestampMethod: string; consentVersion: string;
};
export type Landmark = {index: number; x: number; y: number; z: number; visibility: number; presence: number};
export type PoseFrame = {timestampMs: number; landmarks: Landmark[]};
export function canRecord(phase: CapturePhase, consent: boolean, ready: boolean, nativeAvailable: boolean) {
  return phase === 'ready' && consent && ready && nativeAvailable;
}
export function canProcess(phase: CapturePhase, uri: string | null, consent: boolean) {
  return phase === 'preview' && !!uri?.startsWith('file://') && consent;
}
export function parseSession(raw: string): Session {
  const value = JSON.parse(raw);
  if (!value || (value.diagnostics !== undefined && (typeof value.diagnostics !== 'string' || value.diagnostics.length > 2000)) || typeof value.id !== 'string' || !value.id || value.landmarkCount !== 33 ||
      value.rawVideoRetained !== false || !['side_left', 'side_right'].includes(value.view) ||
      !Number.isFinite(value.createdAt) || !Number.isFinite(value.durationMs) || value.durationMs < 9500 || value.durationMs > 16000 ||
      !Number.isInteger(value.sampledFrames) || value.sampledFrames <= 0 ||
      !Number.isInteger(value.poseFrames) || value.poseFrames <= 0 || value.poseFrames > value.sampledFrames ||
      !Number.isFinite(value.usableFrameRatio) || value.usableFrameRatio < .7 || value.usableFrameRatio > 1 ||
      !/^[a-f0-9]{64}$/.test(value.modelSha256) || typeof value.extractorVersion !== 'string' ||
      value.consentVersion !== 'local-prototype-notice-v1' ||
      value.timestampMethod !== 'requested-100ms-nearest-decoded-frame') throw new Error('Invalid saved landmark summary; no result displayed.');
  return value;
}
export function parseFrames(raw: string): PoseFrame[] {
  const frames = JSON.parse(raw);
  if (!Array.isArray(frames) || frames.length > 160) throw new Error('Invalid saved pose frames.');
  let previous = -1;
  for (const frame of frames) {
    if (!Number.isFinite(frame.timestampMs) || frame.timestampMs <= previous || frame.timestampMs >= 16000 ||
        !Array.isArray(frame.landmarks) || frame.landmarks.length !== 33) throw new Error('Invalid pose timestamps or landmark count.');
    previous = frame.timestampMs;
    frame.landmarks.forEach((p: Landmark, i: number) => {
      if (p.index !== i || ![p.x,p.y,p.z,p.visibility,p.presence].every(Number.isFinite) ||
          p.visibility < 0 || p.visibility > 1 || p.presence < 0 || p.presence > 1) throw new Error('Invalid landmark coordinates/confidence.');
    });
  }
  return frames;
}
