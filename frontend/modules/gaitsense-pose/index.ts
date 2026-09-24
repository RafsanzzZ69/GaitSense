import { requireOptionalNativeModule } from 'expo-modules-core';
export interface OfflinePoseNative {
  processVideo(uri: string, view: string, consent: boolean): Promise<string>;
  listSessions(): Promise<string>;
  readFrames(id: string): Promise<string>;
  discardVideo(uri: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
  deleteAll(): Promise<void>;
  clearTemporaryVideos(): Promise<number>;
  cancel(): void;
  addListener(event: 'onProgress', listener: (event: {percent: number}) => void): {remove(): void};
}
// Expo Go/iOS/web must show unsupported, never simulate a successful extraction.
export default requireOptionalNativeModule<OfflinePoseNative>('GaitSensePose');
