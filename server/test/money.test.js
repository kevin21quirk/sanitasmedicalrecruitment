// Pure-function tests for decimal-safe money helpers (acceptance #7, #10 partial).
// No database required.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toPence, fromPence, toHundredths, toThousandths, lineAmountPence, pctOfPence,
} from '../lib/money.js';

test('toPence parses NUMERIC strings without float error', () => {
  assert.equal(toPence('12.50'), 1250);
  assert.equal(toPence('0.1'), 10);
  assert.equal(toPence(14.5), 1450);
  assert.equal(toPence('-3.25'), -325);
  assert.equal(toPence(null), null);
  assert.equal(toPence(''), null);
  // rounding half-up on the third decimal
  assert.equal(toPence('13.005'), 1301);
  assert.equal(toPence('13.004'), 1300);
  assert.throws(() => toPence('abc'));
});

test('fromPence formats back to pounds', () => {
  assert.equal(fromPence(1250), '12.50');
  assert.equal(fromPence(0), '0.00');
  assert.equal(fromPence(null), null);
});

test('hour/multiplier scalers', () => {
  assert.equal(toHundredths('13.5'), 1350);
  assert.equal(toHundredths(8), 800);
  assert.equal(toThousandths('1.25'), 1250);
  assert.equal(toThousandths(1.5), 1500);
  assert.equal(toThousandths(null), 1000);
});

test('lineAmountPence: rate x hours x uplift, rounded to pence (#7)', () => {
  // £14.50 x 8h = £116.00
  assert.equal(lineAmountPence(1450, 800), 11600);
  // £14.50 x 8h x 1.25 weekend = £145.00
  assert.equal(lineAmountPence(1450, 800, 1250), 14500);
  // £20.00 x 8h x 1.5 bank holiday = £240.00
  assert.equal(lineAmountPence(2000, 800, 1500), 24000);
  // 7.5h x £13.33 x 1.15 → £114.97 (rounds half-up from 114.97125)
  assert.equal(lineAmountPence(1333, 750, 1150), 11497);
});

test('pctOfPence: employer NI percentage (#10)', () => {
  // 15% of £145.00 = £21.75
  assert.equal(pctOfPence(14500, 15), 2175);
  // 13.8% of £100.00 = £13.80
  assert.equal(pctOfPence(10000, 13.8), 1380);
});
