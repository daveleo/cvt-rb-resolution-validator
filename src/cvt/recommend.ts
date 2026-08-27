import {
  CVT_H_GRANULARITY,
  calculateCvtRbV1,
  higherWidth,
  lowerWidth,
  normalizeWidth,
  type CvtRbTiming,
} from './cvtRbV1';

export interface NearbyWidth {
  width: number;
  recommended: boolean;
  isRequested: boolean;
}

/**
 * A short list of CVT-compatible widths around the requested value, for the
 * "Nearby CVT-RB widths" picker. Keeps the same height / refresh rate.
 * The recommended entry is the next width >= the request (we prefer growing
 * the canvas rather than shrinking it).
 */
export function nearbyWidths(requestedWidth: number): NearbyWidth[] {
  const lower = lowerWidth(requestedWidth);
  const higher = higherWidth(requestedWidth);
  const g = CVT_H_GRANULARITY;

  const recommended = higher;

  let candidates: number[];
  if (lower === higher) {
    // Already on the grid – show three below and two above.
    candidates = [lower - 3 * g, lower - 2 * g, lower - g, lower, lower + g, lower + 2 * g];
  } else {
    candidates = [lower - 2 * g, lower - g, lower, higher, higher + g, higher + 2 * g];
  }

  return candidates
    .filter((w) => w > 0)
    .map((w) => ({
      width: w,
      recommended: w === recommended,
      isRequested: w === requestedWidth,
    }));
}

export type Verdict = 'valid' | 'not-exact';

export interface Orientation {
  kind: 'portrait' | 'landscape' | 'square';
  label: string;
}

export function orientationOf(width: number, height: number): Orientation {
  if (width === height) return { kind: 'square', label: 'Square' };
  if (width > height) return { kind: 'landscape', label: 'Landscape' };
  return { kind: 'portrait', label: 'Portrait' };
}

export interface ValidationResult {
  verdict: Verdict;
  timing: CvtRbTiming;

  requestedWidth: number;
  requestedHeight: number;
  requestedRefreshRate: number;

  /** CVT-RB active width (requested width rounded down to the 8-px grid). */
  normalizedWidth: number;
  /** Largest compatible width <= request. */
  lowerWidth: number;
  /** Smallest compatible width >= request. */
  higherWidth: number;
  /** The width we advise the user to adopt (defaults to the higher one). */
  recommendedWidth: number;

  orientation: Orientation;
  nearby: NearbyWidth[];
}

/**
 * Full validation for the UI: runs the real CVT-RB v1 timing calculation and
 * layers the 8-pixel-granularity verdict and width recommendations on top.
 */
export function validateResolution(
  width: number,
  height: number,
  refreshRate: number,
): ValidationResult {
  const timing = calculateCvtRbV1(width, height, refreshRate);

  const normalized = normalizeWidth(width);
  const lower = lowerWidth(width);
  const higher = higherWidth(width);
  const exact = width === normalized;

  return {
    verdict: exact ? 'valid' : 'not-exact',
    timing,

    requestedWidth: width,
    requestedHeight: height,
    requestedRefreshRate: refreshRate,

    normalizedWidth: normalized,
    lowerWidth: lower,
    higherWidth: higher,
    recommendedWidth: exact ? normalized : higher,

    orientation: orientationOf(width, height),
    nearby: nearbyWidths(width),
  };
}
