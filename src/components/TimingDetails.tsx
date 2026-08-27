import type { CvtRbTiming } from '../cvt';
import { hz, int, khz, mhz, ms, polarity, px, us } from '../lib/format';

interface Row {
  label: string;
  value: string;
  hint?: string;
}

export function TimingDetails({
  timing,
  requestedWidth,
  requestedRefreshRate,
}: {
  timing: CvtRbTiming;
  requestedWidth: number;
  requestedRefreshRate: number;
}) {
  const summary: Row[] = [
    { label: 'Requested H active', value: px(requestedWidth) },
    {
      label: 'Calculated H active',
      value: px(timing.hActive),
      hint: timing.exactHorizontalMatch ? 'matches request' : 'rounded to 8-px grid',
    },
    { label: 'V active', value: `${int(timing.vActive)} lines` },
    { label: 'Refresh rate requested', value: hz(requestedRefreshRate) },
    { label: 'Actual calculated refresh rate', value: hz(timing.actualRefreshRate) },
    { label: 'Pixel clock', value: mhz(timing.pixelClockMHz) },
    { label: 'Horizontal frequency', value: khz(timing.horizontalFrequencyKHz) },
  ];

  const horizontal: Row[] = [
    { label: 'H total', value: px(timing.hTotal) },
    { label: 'H blank', value: px(timing.hBlank) },
    { label: 'H front porch', value: px(timing.hFrontPorch) },
    { label: 'H sync width', value: px(timing.hSync) },
    { label: 'H back porch', value: px(timing.hBackPorch) },
    { label: 'H sync polarity', value: polarity(timing.hSyncPolarity) },
    { label: 'Horizontal period', value: us(timing.horizontalPeriodUs) },
  ];

  const vertical: Row[] = [
    { label: 'V total', value: `${int(timing.vTotal)} lines` },
    { label: 'V blank', value: `${int(timing.vBlank)} lines` },
    { label: 'V front porch', value: `${int(timing.vFrontPorch)} lines` },
    { label: 'V sync width', value: `${int(timing.vSync)} lines` },
    { label: 'V back porch', value: `${int(timing.vBackPorch)} lines` },
    { label: 'V sync polarity', value: polarity(timing.vSyncPolarity) },
    { label: 'Vertical period', value: ms(timing.verticalPeriodMs) },
  ];

  return (
    <div className="timing">
      <TimingTable caption="Summary" rows={summary} />
      <TimingTable caption="Horizontal" rows={horizontal} />
      <TimingTable caption="Vertical" rows={vertical} />
    </div>
  );
}

function TimingTable({ caption, rows }: { caption: string; rows: Row[] }) {
  return (
    <table className="timing__table">
      <caption className="timing__caption">{caption}</caption>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>
              <span className="timing__value">{row.value}</span>
              {row.hint && <span className="timing__hint"> {row.hint}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
