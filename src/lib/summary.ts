import type { ValidationResult } from '../cvt';
import { fixed, int } from './format';

/** Plain-text summary suitable for pasting into an email or Teams message. */
export function resultSummaryText(r: ValidationResult): string {
  const w = int(r.requestedWidth);
  const h = int(r.requestedHeight);
  const hz = r.requestedRefreshRate;
  const lines: string[] = [];

  lines.push(`Resolution: ${w} × ${h} @ ${hz} Hz`);

  if (r.verdict === 'valid') {
    lines.push('CVT-RB v1: Valid candidate (exact)');
    lines.push(`CVT-RB active resolution: ${int(r.timing.hActive)} × ${int(r.timing.vActive)}`);
  } else {
    lines.push('CVT-RB v1: Not exact');
    lines.push(`Calculated active width: ${int(r.timing.hActive)} px`);
    lines.push(`Recommended higher width: ${int(r.higherWidth)} px`);
    lines.push(`Nearest lower width: ${int(r.lowerWidth)} px`);
    lines.push(
      `Recommended resolution: ${int(r.recommendedWidth)} × ${h} @ ${hz} Hz`,
    );
  }

  lines.push('');
  lines.push(`Pixel clock: ${fixed(r.timing.pixelClockMHz, 3)} MHz`);
  lines.push(`Actual refresh: ${fixed(r.timing.actualRefreshRate, 3)} Hz`);
  lines.push(`H total / V total: ${int(r.timing.hTotal)} / ${int(r.timing.vTotal)}`);
  lines.push('');
  lines.push('Checked against CVT-RB v1 timing only — not GPU / OS / display compatibility.');

  return lines.join('\n');
}
