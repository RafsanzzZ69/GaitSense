// Portrait 16:9 image, fitted into half the window so capture controls remain reachable.
// These are layout points, not encoded video pixels. CameraX chooses capture resolution.
export function cameraPreviewSize(windowWidth: number, windowHeight: number) {
  const width = Math.max(1, Math.floor(Math.min(windowWidth - 40, windowHeight * .5 * 9 / 16)));
  return { width, height: Math.round(width * 16 / 9) };
}
