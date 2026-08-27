import { describe, expect, it } from 'vitest';
import {
  CvtInputError,
  calculateCvtRbV1,
  higherWidth,
  lowerWidth,
  normalizeWidth,
} from '../cvtRbV1';
import { nearbyWidths, orientationOf, validateResolution } from '../recommend';

/**
 * Reference implementation used for cross-checking: Linux kernel DRM
 * `drm_cvt_mode()` (reduced-blanking branch), which is also mirrored by
 * edid-decode `edid_cvt_mode`. See README.md "Verification".
 *
 * The expected numbers below were produced by running the same algorithm
 * by hand / against edid-decode, NOT copied from this implementation.
 */

describe('normalizeWidth (CVT 8-pixel granularity, rounds down)', () => {
  const cases: Array<[number, number]> = [
    [945, 944],
    [944, 944],
    [952, 952],
    [953, 952],
    [959, 952],
    [960, 960],
  ];
  it.each(cases)('%i -> %i', (input, expected) => {
    expect(normalizeWidth(input)).toBe(expected);
  });
});

describe('lowerWidth / higherWidth recommendations', () => {
  it.each<[number, number]>([
    [945, 952],
    [946, 952],
    [951, 952],
    [952, 952],
    [953, 960],
  ])('higherWidth(%i) -> %i', (input, expected) => {
    expect(higherWidth(input)).toBe(expected);
  });

  it.each<[number, number]>([
    [945, 944],
    [944, 944],
    [952, 952],
    [953, 952],
    [960, 960],
  ])('lowerWidth(%i) -> %i', (input, expected) => {
    expect(lowerWidth(input)).toBe(expected);
  });
});

describe('calculateCvtRbV1 – known timings', () => {
  it('1920 x 1080 @ 60 (16:9)', () => {
    const t = calculateCvtRbV1(1920, 1080, 60);
    expect(t.hActive).toBe(1920);
    expect(t.vActive).toBe(1080);
    expect(t.exactHorizontalMatch).toBe(true);
    expect(t.hBlank).toBe(160);
    expect(t.hTotal).toBe(2080);
    expect(t.hFrontPorch).toBe(48);
    expect(t.hSync).toBe(32);
    expect(t.hBackPorch).toBe(80);
    expect(t.vSync).toBe(5);
    expect(t.vTotal).toBe(1111);
    expect(t.vBlank).toBe(31);
    expect(t.vFrontPorch).toBe(3);
    expect(t.vBackPorch).toBe(23);
    expect(t.pixelClockMHz).toBeCloseTo(138.5, 3);
    expect(t.actualRefreshRate).toBeCloseTo(59.933, 2);
    expect(t.hSyncPolarity).toBe('positive');
    expect(t.vSyncPolarity).toBe('negative');
  });

  it('952 x 1680 @ 60 (portrait, custom aspect) – primary reference case', () => {
    const t = calculateCvtRbV1(952, 1680, 60);
    expect(t.hActive).toBe(952);
    expect(t.vActive).toBe(1680);
    expect(t.exactHorizontalMatch).toBe(true);
    expect(t.hBlank).toBe(160);
    expect(t.hTotal).toBe(1112);
    expect(t.hFrontPorch).toBe(48);
    expect(t.hSync).toBe(32);
    expect(t.hBackPorch).toBe(80);
    expect(t.vSync).toBe(10);
    expect(t.vTotal).toBe(1728);
    expect(t.vBlank).toBe(48);
    expect(t.vBackPorch).toBe(35);
    expect(t.pixelClockMHz).toBeCloseTo(115.25, 3);
    // ~59.98 Hz – the 0.25 MHz clock rounding pulls it just under 60.
    expect(t.actualRefreshRate).toBeCloseTo(59.978, 2);
  });

  it('945 x 1680 @ 60 – width normalises to 944', () => {
    const t = calculateCvtRbV1(945, 1680, 60);
    expect(t.hActive).toBe(944);
    expect(t.exactHorizontalMatch).toBe(false);
    expect(t.hTotal).toBe(1104);
    expect(t.vActive).toBe(1680);
    expect(t.vTotal).toBe(1728);
    expect(t.pixelClockMHz).toBeCloseTo(114.25, 3);
  });

  it('944 x 1680 @ 60 – exact match, same timing as the 945 request', () => {
    const t = calculateCvtRbV1(944, 1680, 60);
    expect(t.hActive).toBe(944);
    expect(t.exactHorizontalMatch).toBe(true);
    expect(t.hTotal).toBe(1104);
    expect(t.vTotal).toBe(1728);
    expect(t.vBackPorch).toBe(35);
    expect(t.pixelClockMHz).toBeCloseTo(114.25, 3);
    expect(t.actualRefreshRate).toBeCloseTo(59.888, 2);
  });

  it('960 x 1680 @ 60', () => {
    const t = calculateCvtRbV1(960, 1680, 60);
    expect(t.hActive).toBe(960);
    expect(t.exactHorizontalMatch).toBe(true);
    expect(t.hTotal).toBe(1120);
    expect(t.vTotal).toBe(1728);
    expect(t.pixelClockMHz).toBeCloseTo(116.0, 3);
  });

  it('1680 x 945 @ 60 (landscape 16:9)', () => {
    const t = calculateCvtRbV1(1680, 945, 60);
    expect(t.hActive).toBe(1680);
    expect(t.vActive).toBe(945);
    expect(t.vSync).toBe(5);
    expect(t.hTotal).toBe(1840);
    expect(t.vTotal).toBe(972);
    expect(t.pixelClockMHz).toBeCloseTo(107.25, 3);
    expect(t.actualRefreshRate).toBeCloseTo(59.968, 2);
  });

  it('3840 x 2160 @ 60 (16:9 UHD)', () => {
    const t = calculateCvtRbV1(3840, 2160, 60);
    expect(t.hActive).toBe(3840);
    expect(t.vActive).toBe(2160);
    expect(t.vSync).toBe(5);
    expect(t.hTotal).toBe(4000);
    expect(t.vTotal).toBe(2222);
    expect(t.vBlank).toBe(62);
    expect(t.vBackPorch).toBe(54);
    expect(t.pixelClockMHz).toBeCloseTo(533.0, 3);
    expect(t.actualRefreshRate).toBeCloseTo(59.968, 2);
  });
});

describe('calculateCvtRbV1 – derived-value sanity', () => {
  it('h frequency and periods are internally consistent', () => {
    const t = calculateCvtRbV1(952, 1680, 60);
    // hFreq (kHz) = pixelClock (MHz*1000) / hTotal
    expect(t.horizontalFrequencyKHz).toBeCloseTo((t.pixelClockMHz * 1000) / t.hTotal, 3);
    // vertical period (ms) ~ 1000 / actual refresh
    expect(t.verticalPeriodMs).toBeCloseTo(1000 / t.actualRefreshRate, 3);
    // horizontal period (us) ~ 1000 / hFreq(kHz)
    expect(t.horizontalPeriodUs).toBeCloseTo(1000 / t.horizontalFrequencyKHz, 3);
  });

  it('never returns NaN for a valid request', () => {
    const t = calculateCvtRbV1(1234, 5678, 50);
    for (const value of Object.values(t)) {
      if (typeof value === 'number') expect(Number.isNaN(value)).toBe(false);
    }
  });
});

describe('calculateCvtRbV1 – input validation', () => {
  it.each<[string, () => unknown]>([
    ['zero width', () => calculateCvtRbV1(0, 1080, 60)],
    ['negative width', () => calculateCvtRbV1(-1920, 1080, 60)],
    ['fractional width', () => calculateCvtRbV1(1920.5, 1080, 60)],
    ['zero height', () => calculateCvtRbV1(1920, 0, 60)],
    ['fractional height', () => calculateCvtRbV1(1920, 1080.1, 60)],
    ['zero refresh', () => calculateCvtRbV1(1920, 1080, 0)],
    ['negative refresh', () => calculateCvtRbV1(1920, 1080, -60)],
    ['NaN refresh', () => calculateCvtRbV1(1920, 1080, Number.NaN)],
    ['absurd width', () => calculateCvtRbV1(999999, 1080, 60)],
    ['absurd refresh', () => calculateCvtRbV1(1920, 1080, 100000)],
  ])('throws CvtInputError for %s', (_label, fn) => {
    expect(fn).toThrow(CvtInputError);
  });
});

describe('nearbyWidths', () => {
  it('945 -> 928, 936, 944, 952 (recommended), 960, 968', () => {
    const list = nearbyWidths(945).map((n) => n.width);
    expect(list).toEqual([928, 936, 944, 952, 960, 968]);
    const rec = nearbyWidths(945).find((n) => n.recommended);
    expect(rec?.width).toBe(952);
  });

  it('marks an on-grid requested width and keeps a symmetric window', () => {
    const list = nearbyWidths(952);
    expect(list.map((n) => n.width)).toEqual([928, 936, 944, 952, 960, 968]);
    expect(list.find((n) => n.recommended)?.width).toBe(952);
    expect(list.find((n) => n.isRequested)?.width).toBe(952);
  });

  it('never contains a non-positive width', () => {
    for (const n of nearbyWidths(8)) expect(n.width).toBeGreaterThan(0);
  });
});

describe('orientationOf', () => {
  it('classifies portrait / landscape / square', () => {
    expect(orientationOf(952, 1680).kind).toBe('portrait');
    expect(orientationOf(1920, 1080).kind).toBe('landscape');
    expect(orientationOf(1000, 1000).kind).toBe('square');
  });
});

describe('validateResolution', () => {
  it('945 x 1680 @ 60 -> not-exact, recommends higher (952)', () => {
    const r = validateResolution(945, 1680, 60);
    expect(r.verdict).toBe('not-exact');
    expect(r.normalizedWidth).toBe(944);
    expect(r.lowerWidth).toBe(944);
    expect(r.higherWidth).toBe(952);
    expect(r.recommendedWidth).toBe(952);
    expect(r.timing.hActive).toBe(944);
    expect(r.orientation.kind).toBe('portrait');
  });

  it('952 x 1680 @ 60 -> valid', () => {
    const r = validateResolution(952, 1680, 60);
    expect(r.verdict).toBe('valid');
    expect(r.recommendedWidth).toBe(952);
    expect(r.timing.exactHorizontalMatch).toBe(true);
  });

  it('1920 x 1080 @ 60 -> valid (already divisible by 8)', () => {
    expect(validateResolution(1920, 1080, 60).verdict).toBe('valid');
  });
});
