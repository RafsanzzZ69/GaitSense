/** Keep small, normalized measurements visible instead of rounding them to zero. */
export function formatMeasurement(value: number): string {
  if (!Number.isFinite(value)) return 'Unavailable';
  if (Number.isInteger(value)) return String(value);
  return Math.abs(value) < 0.01 ? value.toPrecision(3) : value.toFixed(2);
}
