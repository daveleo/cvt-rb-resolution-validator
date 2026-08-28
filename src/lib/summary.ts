import type { ValidationResult } from '../cvt';
import { fixed, int } from './format';

/** Plain-text summary suitable for pasting into an email or Teams message. */
export function resultSummaryText(r: ValidationResult): string {
  const w = int(r.requestedWidth);
  const h = int(r.requestedHeight);
  const hz = r.requestedRefreshRate;
  const lines: string[] = [];

  lines.push(`Requested: ${w} × ${h} @ ${hz} Hz`);

  if (r.verdict === 'valid') {
    lines.push('Status: OK — width is a multiple of 8, can be set up exactly');
  } else {
    lines.push(`Status: NOT SUPPORTED — width ${w} is not a multiple of 8`);
    lines.push(`Closest it can be built as: ${int(r.timing.hActive)} × ${h}`);
    lines.push(`Recommended: ${int(r.higherWidth)} × ${h} @ ${hz} Hz  (round up)`);
    lines.push(`Alternative: ${int(r.lowerWidth)} × ${h} @ ${hz} Hz  (round down)`);
  }

  lines.push('');
  lines.push('Reference timing (VESA CVT-RB v1):');
  lines.push(`  Pixel clock:   ${fixed(r.timing.pixelClockMHz, 3)} MHz`);
  lines.push(`  Actual refresh: ${fixed(r.timing.actualRefreshRate, 3)} Hz`);
  lines.push(`  H total / V total: ${int(r.timing.hTotal)} / ${int(r.timing.vTotal)}`);
  lines.push('');
  lines.push(
    'Note: checks resolution alignment only. The 8-pixel width rule applies to all',
  );
  lines.push(
    'standard timing methods. Actual GPU / OS / display compatibility is not checked.',
  );

  return lines.join('\n');
}
