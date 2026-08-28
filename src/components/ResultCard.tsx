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
  const effective = `${int(timing.hActive)} × ${int(timing.vActive)}`;
  const requestedDims = `${int(result.requestedWidth)} × ${int(result.requestedHeight)}`;

  if (verdict === 'valid') {
    return (
      <div className="result result--valid" role="status" aria-live="polite">
        <p className="result__badge">
          <span className="result__icon" aria-hidden="true">
            ✓
          </span>
          No resolution problems found
        </p>

        <dl className="result__facts">
          <div>
            <dt>Resolution</dt>
            <dd className="result__big">{requestedDims}</dd>
          </div>
          <div>
            <dt>Refresh rate</dt>
            <dd>{result.requestedRefreshRate} Hz</dd>
          </div>
          <div>
            <dt>Orientation</dt>
            <dd>{result.orientation.label}</dd>
          </div>
        </dl>

        <p className="result__note">
          {int(result.requestedWidth)} is a multiple of 8, so the width lands on the grid that
          every standard custom timing uses and this resolution can be created exactly. Height
          and refresh rate are fine.
        </p>
        <p className="result__disclaimer">
          This checks the resolution numbers only — not whether a specific GPU, driver, operating
          system, cable or receiving device will accept it.
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
        {int(result.requestedWidth)} isn’t a supported width
      </p>

      <dl className="result__facts">
        <div>
          <dt>Requested resolution</dt>
          <dd>{requested}</dd>
        </div>
        <div>
          <dt>Closest it can be built as</dt>
          <dd className="result__big">{effective}</dd>
        </div>
        <div>
          <dt>Orientation</dt>
          <dd>{result.orientation.label}</dd>
        </div>
      </dl>

      <p className="result__note">
        Every standard way of building a custom timing — in Windows, GPU drivers and tools like
        CRU — steps the width in blocks of 8 pixels. {int(result.requestedWidth)} doesn’t land on
        that grid, so it can’t be set up exactly. Height ({int(result.requestedHeight)}) and
        refresh rate ({result.requestedRefreshRate} Hz) are fine.
      </p>

      <div className="result__reco">
        <div className="result__reco-primary">
          <p className="result__reco-label">Recommended (round up)</p>
          <button
            type="button"
            className="result__reco-value"
            onClick={() => onPickWidth(result.higherWidth)}
          >
            {int(result.higherWidth)} × {int(result.requestedHeight)}
          </button>
        </div>
        <div className="result__reco-secondary">
          <p className="result__reco-label">Alternative (round down)</p>
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
        We suggest the <strong>larger</strong> width by default — growing the canvas is usually
        safer than shrinking it for LED / AV work.
      </p>
    </div>
  );
}
