import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMeasurement } from '../src/web/format.ts';

test('small nonzero movement measurements never display as zero', () => {
  assert.equal(formatMeasurement(0.002697), '0.00270');
  assert.equal(formatMeasurement(-0.001349), '-0.00135');
  assert.equal(formatMeasurement(108), '108');
  assert.equal(formatMeasurement(48.234), '48.23');
  assert.equal(formatMeasurement(0), '0');
  assert.equal(formatMeasurement(NaN), 'Unavailable');
});
