import type { ValidationResult } from '../cvt';
import { int, resolutionLabel } from '../lib/format';

export function ResultCard({
  result,
  onPickWidth,
}: {
  result: ValidationResult;
  onPickWidth: (width: number) => void;
}) {
  const { verdict, timing } = result;
  const requested = resolutionLabel(
    result.requestedWidth,
    result.requestedHeight,
    result.requestedRefreshRate,
  );
  const active = `${int(timing.hActive)} × ${int(timing.vActive)}`;

  if (verdict === 'valid') {
    return (
      <div className="result result--valid" role="status" aria-live="polite">
        <p className="result__badge">
          <span className="result__icon" aria-hidden="true">
            ✓
          </span>
          Valid CVT-RB v1 candidate
        </p>

        <dl className="result__facts">
          <div>
            <dt>Requested resolution</dt>
            <dd>{requested}</dd>
          </div>
          <div>
            <dt>CVT-RB active resolution</dt>
            <dd className="result__big">{active}</dd>
          </div>
          <div>
            <dt>Orientation</dt>
            <dd>{result.orientation.label}</dd>
          </div>
        </dl>

        <p className="result__note">
          Horizontal resolution is correctly aligned to the CVT 8-pixel granularity.
        </p>
        <p className="result__disclaimer">
          This confirms CVT-RB v1 timing validity only — not that a specific GPU, driver,
          operating system, interface or receiving device will accept it.
        </p>
      </div>
    );
  }

  return (
    <div className="result result--warn" role="status" aria-live="polite">
      <p className="result__badge">
        <span className="result__icon" aria-hidden="true">
          ⚠
        </span>
        Not an exact CVT-RB v1 resolution
      </p>

      <dl className="result__facts">
        <div>
          <dt>Requested resolution</dt>
          <dd>{requested}</dd>
        </div>
        <div>
          <dt>CVT-RB active resolution</dt>
          <dd className="result__big">{active}</dd>
        </div>
        <div>
          <dt>Orientation</dt>
          <dd>{result.orientation.label}</dd>
        </div>
      </dl>

      <p className="result__note">
        CVT-RB v1 requires the horizontal active resolution to follow an 8-pixel granularity.{' '}
        {int(result.requestedWidth)} pixels cannot therefore be represented exactly — the
        calculation uses {int(timing.hActive)}.
      </p>

      <div className="result__reco">
        <div className="result__reco-primary">
          <p className="result__reco-label">Recommended higher resolution</p>
          <button
            type="button"
            className="result__reco-value"
            onClick={() => onPickWidth(result.higherWidth)}
          >
            {int(result.higherWidth)} × {int(result.requestedHeight)}
          </button>
        </div>
        <div className="result__reco-secondary">
          <p className="result__reco-label">Nearest lower resolution</p>
          <button
            type="button"
            className="result__reco-value result__reco-value--minor"
            onClick={() => onPickWidth(result.lowerWidth)}
          >
            {int(result.lowerWidth)} × {int(result.requestedHeight)}
          </button>
        </div>
      </div>

      <p className="result__disclaimer">
        We default the recommendation to the <strong>higher</strong> width because growing the
        canvas is usually safer than shrinking it for LED / AV work.
      </p>
    </div>
  );
}
