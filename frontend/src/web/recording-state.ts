export function canChooseVideo(status?: string): boolean {
  return !status || status === 'created';
}

export function canProcessRecording(status: string | undefined, hasFile: boolean): boolean {
  if (canChooseVideo(status)) return hasFile;
  return ['uploaded', 'failed', 'cancelled'].includes(status!);
}
