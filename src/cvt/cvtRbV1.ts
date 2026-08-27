/**
 * VESA Coordinated Video Timings – Reduced Blanking, version 1 (CVT-RB v1).
 *
 * This is a clean-room re-implementation of the CVT-RB v1 timing generator.
 * The control flow, constants and integer-rounding behaviour follow the
 * well-known open reference implementation in the Linux kernel DRM subsystem:
 *
 *   drivers/gpu/drm/drm_modes.c  ->  drm_cvt_mode(), "Reduced blanking" branch
 *   (GPL-2.0, Intel Corporation / kernel contributors)
 *
 * The same algorithm is implemented by edid-decode (`edid_cvt_mode`) and by
 * libdisplay-info (`di_cvt_compute`). Values produced here were cross-checked
 * against edid-decode output – see README.md ("Verification").
 *
 * Only the non-interlaced, no-margin path is implemented: that is what a custom
 * desktop / LED-wall resolution uses in practice.
 *
 * No proprietary VESA standards text is reproduced. Only publicly documented
 * numeric constants from the open implementations above are used.
 */

/** Character-cell horizontal granularity, in pixels. */
export const CVT_H_GRANULARITY = 8;
/** Minimum number of vertical back-porch lines. */
const CVT_MIN_V_BPORCH = 6;
/** Pixel-clock stepping for reduced blanking, in kHz (0.25 MHz). */
const CVT_CLOCK_STEP_KHZ = 250;
/** Minimum vertical blanking interval, in microseconds. */
const CVT_RB_MIN_VBLANK_US = 460;
/** Fixed horizontal sync width for reduced blanking, in pixels. */
const CVT_RB_H_SYNC = 32;
/** Fixed horizontal blanking for reduced blanking, in pixels. */
const CVT_RB_H_BLANK = 160;
/** Fixed vertical front-porch for reduced blanking, in lines. */
const CVT_RB_VFPORCH = 3;
/** Fixed-point scaling factor used by the reference implementation. */
const HV_FACTOR = 1000;

export type SyncPolarity = 'positive' | 'negative';

export interface CvtRbTiming {
  // --- what the user asked for ---
  requestedWidth: number;
  requestedHeight: number;
  requestedRefreshRate: number;

  // --- active area actually produced by CVT-RB v1 ---
  hActive: number;
  vActive: number;

  /** true when requestedWidth is already on the CVT 8-pixel grid. */
  exactHorizontalMatch: boolean;

  // --- horizontal timing (pixels) ---
  hTotal: number;
  hBlank: number;
  hFrontPorch: number;
  hSync: number;
  hBackPorch: number;

  // --- vertical timing (lines) ---
  vTotal: number;
  vBlank: number;
  vFrontPorch: number;
  vSync: number;
  vBackPorch: number;

  // --- derived clocks / frequencies ---
  /** Pixel clock in MHz, already rounded to the 0.25 MHz CVT-RB grid. */
  pixelClockMHz: number;
  /** Horizontal scan frequency in kHz. */
  horizontalFrequencyKHz: number;
  /** Frame rate that the rounded pixel clock actually yields, in Hz. */
  actualRefreshRate: number;

  hSyncPolarity: SyncPolarity;
  vSyncPolarity: SyncPolarity;

  /** One horizontal line period, in microseconds. */
  horizontalPeriodUs: number;
  /** One frame period, in milliseconds. */
  verticalPeriodMs: number;
}

/**
 * VESA CVT vertical sync-pulse width, derived from the aspect ratio of the
 * *requested* active area. Unknown ratios fall back to 10 lines ("custom").
 * Matches the table in drm_cvt_mode().
 */
function vSyncWidthForAspect(width: number, height: number): number {
  if (height % 3 === 0 && (height * 4) / 3 === width) return 4; // 4:3
  if (height % 9 === 0 && (height * 16) / 9 === width) return 5; // 16:9
  if (height % 10 === 0 && (height * 16) / 10 === width) return 6; // 16:10
  if (height % 4 === 0 && (height * 5) / 4 === width) return 7; // 5:4
  if (height % 9 === 0 && (height * 15) / 9 === width) return 7; // 15:9
  return 10; // custom
}

/**
 * Normalise a horizontal active value onto the CVT 8-pixel character grid.
 * CVT rounds *down* to the nearest multiple of 8.
 */
export function normalizeWidth(width: number): number {
  return Math.floor(width / CVT_H_GRANULARITY) * CVT_H_GRANULARITY;
}

/** Largest CVT-compatible width that is <= the requested width. */
export function lowerWidth(width: number): number {
  return Math.floor(width / CVT_H_GRANULARITY) * CVT_H_GRANULARITY;
}

/** Smallest CVT-compatible width that is >= the requested width. */
export function higherWidth(width: number): number {
  return Math.ceil(width / CVT_H_GRANULARITY) * CVT_H_GRANULARITY;
}

export class CvtInputError extends Error {}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    throw new CvtInputError(`${label} must be a number.`);
  }
  if (!Number.isInteger(value)) {
    throw new CvtInputError(`${label} must be a whole number.`);
  }
  if (value <= 0) {
    throw new CvtInputError(`${label} must be greater than zero.`);
  }
}

/**
 * Compute CVT-RB v1 timing for a requested active resolution and refresh rate.
 *
 * @param width        Requested horizontal active pixels (positive integer).
 * @param height       Requested vertical active lines (positive integer).
 * @param refreshRate  Requested refresh rate in Hz (> 0).
 * @throws CvtInputError on invalid input.
 */
export function calculateCvtRbV1(
  width: number,
  height: number,
  refreshRate: number,
): CvtRbTiming {
  assertPositiveInteger(width, 'Horizontal pixels');
  assertPositiveInteger(height, 'Vertical pixels');

  if (!Number.isFinite(refreshRate) || Number.isNaN(refreshRate) || refreshRate <= 0) {
    throw new CvtInputError('Refresh rate must be greater than zero.');
  }

  // Guard rails against nonsensical values (keeps the maths sane, avoids
  // absurd clocks). These bounds are deliberately generous.
  if (width > 16384 || height > 16384) {
    throw new CvtInputError('Resolution is out of the supported range (max 16384 per axis).');
  }
  if (refreshRate > 1000) {
    throw new CvtInputError('Refresh rate is out of the supported range (max 1000 Hz).');
  }

  const vFieldRate = refreshRate;

  // 1. Horizontal active is rounded DOWN to the 8-pixel character grid.
  const hActive = normalizeWidth(width);
  if (hActive <= 0) {
    throw new CvtInputError('Horizontal pixels must be at least 8.');
  }
  const vActive = height;
  const exactHorizontalMatch = width === hActive;

  const vSync = vSyncWidthForAspect(width, height);

  // 8. Estimate the horizontal period (fixed-point, integer division –
  //    matches the reference implementation exactly).
  const numerator = HV_FACTOR * 1_000_000 - CVT_RB_MIN_VBLANK_US * HV_FACTOR * vFieldRate;
  const hPeriod = Math.floor(numerator / (vActive * vFieldRate));
  if (hPeriod <= 0) {
    throw new CvtInputError(
      'Refresh rate is too high for this vertical resolution under CVT-RB v1.',
    );
  }

  // 9-10. Vertical blanking, in lines.
  let vBlankLines = Math.floor((CVT_RB_MIN_VBLANK_US * HV_FACTOR) / hPeriod) + 1;
  const minVBlank = CVT_RB_VFPORCH + vSync + CVT_MIN_V_BPORCH;
  if (vBlankLines < minVBlank) {
    vBlankLines = minVBlank;
  }

  // 11. Vertical totals.
  const vTotal = vActive + vBlankLines;
  const vFrontPorch = CVT_RB_VFPORCH;
  const vBackPorch = vBlankLines - vFrontPorch - vSync;

  // 12. Horizontal totals (all fixed for reduced blanking).
  const hBlank = CVT_RB_H_BLANK;
  const hTotal = hActive + hBlank;
  const hSyncEnd = hActive + hBlank / 2;
  const hSyncStart = hSyncEnd - CVT_RB_H_SYNC;
  const hFrontPorch = hSyncStart - hActive;
  const hSync = CVT_RB_H_SYNC;
  const hBackPorch = hTotal - hSyncEnd;

  // 13. Pixel clock: htotal / hperiod, then floored onto the 0.25 MHz grid.
  let pixelClockKHz = Math.floor((hTotal * HV_FACTOR * 1000) / hPeriod);
  pixelClockKHz -= pixelClockKHz % CVT_CLOCK_STEP_KHZ;
  const pixelClockHz = pixelClockKHz * 1000;
  const pixelClockMHz = pixelClockKHz / 1000;

  // 14. Derived frequencies from the rounded clock.
  const horizontalFrequencyKHz = pixelClockHz / hTotal / 1000;
  const actualRefreshRate = pixelClockHz / (hTotal * vTotal);
  const horizontalPeriodUs = (hTotal / pixelClockHz) * 1_000_000;
  const verticalPeriodMs = ((hTotal * vTotal) / pixelClockHz) * 1000;

  return {
    requestedWidth: width,
    requestedHeight: height,
    requestedRefreshRate: refreshRate,

    hActive,
    vActive,
    exactHorizontalMatch,

    hTotal,
    hBlank,
    hFrontPorch,
    hSync,
    hBackPorch,

    vTotal,
    vBlank: vBlankLines,
    vFrontPorch,
    vSync,
    vBackPorch,

    pixelClockMHz,
    horizontalFrequencyKHz,
    actualRefreshRate,

    // Reduced blanking: HSync positive, VSync negative.
    hSyncPolarity: 'positive',
    vSyncPolarity: 'negative',

    horizontalPeriodUs,
    verticalPeriodMs,
  };
}
