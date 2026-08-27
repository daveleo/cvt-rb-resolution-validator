import type { NearbyWidth } from '../cvt';
import { int } from '../lib/format';

export function NearbyWidths({
  nearby,
  height,
  refreshRate,
  onPick,
}: {
  nearby: NearbyWidth[];
  height: number;
  refreshRate: number;
  onPick: (width: number) => void;
}) {
  return (
    <section className="nearby" aria-label="Nearby CVT-RB widths">
      <h3 className="nearby__title">Nearby CVT-RB widths</h3>
      <p className="nearby__hint">
        Same height ({int(height)}) and refresh rate ({refreshRate} Hz). Click to recalculate.
      </p>
      <div className="nearby__list">
        {nearby.map((n) => (
          <button
            key={n.width}
            type="button"
            className={
              'chip' +
              (n.recommended ? ' chip--recommended' : '') +
              (n.isRequested ? ' chip--current' : '')
            }
            aria-pressed={n.isRequested}
            onClick={() => onPick(n.width)}
          >
            <span className="chip__value">{int(n.width)}</span>
            {n.recommended && <span className="chip__tag">Recommended</span>}
            {n.isRequested && !n.recommended && <span className="chip__tag">Current</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
