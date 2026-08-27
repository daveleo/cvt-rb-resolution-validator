/** Formatting helpers for the UI. The calculation engine returns raw numbers;
 *  all string formatting lives here so it can be tuned without touching maths. */

/** Integer with thousands separators, e.g. 138500 -> "138,500". */
export function int(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Fixed decimals, trimmed group separators kept, e.g. 115.25 -> "115.250". */
export function fixed(value: number, decimals = 3): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function mhz(value: number): string {
  return `${fixed(value, 3)} MHz`;
}

export function khz(value: number): string {
  return `${fixed(value, 3)} kHz`;
}

export function hz(value: number): string {
  return `${fixed(value, 3)} Hz`;
}

export function px(value: number): string {
  return `${int(value)} px`;
}

export function lines(value: number): string {
  return `${int(value)} lines`;
}

export function us(value: number): string {
  return `${fixed(value, 3)} µs`;
}

export function ms(value: number): string {
  return `${fixed(value, 3)} ms`;
}

export function polarity(p: 'positive' | 'negative'): string {
  return p === 'positive' ? 'Positive (+)' : 'Negative (−)';
}

export function resolutionLabel(w: number, h: number, hzValue: number): string {
  return `${int(w)} × ${int(h)} @ ${trimNumber(hzValue)} Hz`;
}

/** "60" not "60.000", but "59.94" stays. */
export function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}
