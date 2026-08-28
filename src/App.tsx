import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CvtInputError, validateResolution, type ValidationResult } from './cvt';
import { Collapsible } from './components/Collapsible';
import { NearbyWidths } from './components/NearbyWidths';
import { ResultCard } from './components/ResultCard';
import { TimingDetails } from './components/TimingDetails';
import { resultSummaryText } from './lib/summary';
import {
  DEFAULT_INPUT,
  inputFromQuery,
  queryFromInput,
  shareUrl,
  type ResolutionInput,
} from './lib/url';

type Parsed =
  | { ok: true; result: ValidationResult }
  | { ok: false; message: string };

function parseInput(input: ResolutionInput): Parsed {
  const width = Number(input.width);
  const height = Number(input.height);
  const refreshRate = Number(input.refreshRate);

  if (input.width.trim() === '' || input.height.trim() === '' || input.refreshRate.trim() === '') {
    return { ok: false, message: 'Enter horizontal pixels, vertical pixels and a refresh rate.' };
  }

  try {
    return { ok: true, result: validateResolution(width, height, refreshRate) };
  } catch (err) {
    if (err instanceof CvtInputError) return { ok: false, message: err.message };
    return { ok: false, message: 'Could not calculate a timing for these values.' };
  }
}

function useCopyButton(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const copy = useCallback((text: string) => {
    const done = () => {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [copied, copy];
}

function fallbackCopy(text: string, done: () => void) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    /* ignore */
  }
  document.body.removeChild(ta);
}

export function App() {
  const [input, setInput] = useState<ResolutionInput>(() =>
    inputFromQuery(window.location.search),
  );

  // Keep the URL query string in sync so a reload / share reproduces the view.
  useEffect(() => {
    const query = queryFromInput(input);
    const next = `${window.location.pathname}?${query}`;
    window.history.replaceState(null, '', next);
  }, [input]);

  const parsed = useMemo(() => parseInput(input), [input]);

  const [linkCopied, copyLink] = useCopyButton();
  const [resultCopied, copyResult] = useCopyButton();

  const setField = (field: keyof ResolutionInput) => (value: string) => {
    // digits and a single dot only – keeps the field numeric without type=number quirks
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
    setInput((prev) => ({ ...prev, [field]: value }));
  };

  const pickWidth = (width: number) => {
    setInput((prev) => ({ ...prev, width: String(width) }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Calculation is already live; this just blurs / confirms intent.
  };

  return (
    <div className="page">
      <header className="masthead">
        <h1 className="masthead__title">Resolution Compatibility Checker</h1>
        <p className="masthead__subtitle">
          Check whether a custom width, height and refresh rate can be set up as a clean custom
          display resolution — before you build it in CRU or a display processor.
        </p>
      </header>

      <main className="layout">
        <section className="panel" aria-label="Resolution input">
          <form className="form" onSubmit={onSubmit}>
            <div className="form__grid">
              <Field
                id="width"
                label="Width (pixels)"
                value={input.width}
                onChange={setField('width')}
                inputMode="numeric"
              />
              <Field
                id="height"
                label="Height (pixels)"
                value={input.height}
                onChange={setField('height')}
                inputMode="numeric"
              />
              <Field
                id="hz"
                label="Refresh rate (Hz)"
                value={input.refreshRate}
                onChange={setField('refreshRate')}
                inputMode="decimal"
              />
            </div>

            <div className="form__actions">
              <button type="submit" className="btn btn--primary">
                Check Resolution
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setInput(DEFAULT_INPUT)}
              >
                Reset to 1920 × 1080 @ 60
              </button>
            </div>
            <p className="form__hint">Results update automatically as you type.</p>
          </form>
        </section>

        {parsed.ok ? (
          <>
            <ResultCard result={parsed.result} onPickWidth={pickWidth} />

            <div className="toolbar">
              <button
                type="button"
                className="btn btn--tool"
                onClick={() => copyLink(shareUrl(input))}
              >
                {linkCopied ? 'Link copied ✓' : 'Copy Link'}
              </button>
              <button
                type="button"
                className="btn btn--tool"
                onClick={() => copyResult(resultSummaryText(parsed.result))}
              >
                {resultCopied ? 'Result copied ✓' : 'Copy Result'}
              </button>
            </div>

            <NearbyWidths
              nearby={parsed.result.nearby}
              height={parsed.result.requestedHeight}
              refreshRate={parsed.result.requestedRefreshRate}
              onPick={pickWidth}
            />

            <Collapsible title="Why does the width have to be a multiple of 8?">
              <p>
                A custom resolution is really a set of “timing” numbers. Every standard way of
                generating those numbers — the CVT and GTF formulas built into Windows, graphics
                drivers and tools like CRU — steps the horizontal width in blocks of 8 pixels.
                So widths such as 944, 952, 960 and 968 are fine, while 945, 950 or 953 don’t
                land on the grid and can’t be entered exactly.
              </p>
              <p>
                Heights and refresh rates are not affected by this rule — only the width.
              </p>
              <p className="why__split">
                <strong>Resolution alignment</strong> — whether the numbers you typed can be
                expressed as a standard timing. That’s what this tool checks.
                <br />
                <strong>Hardware / Windows compatibility</strong> — whether your GPU, driver,
                operating system, cable, EDID and receiving hardware will actually run it. That
                depends on the specific equipment and is not checked here.
              </p>
            </Collapsible>

            <Collapsible title="Technical Timing Details">
              <TimingDetails
                timing={parsed.result.timing}
                requestedWidth={parsed.result.requestedWidth}
                requestedRefreshRate={parsed.result.requestedRefreshRate}
              />
              <p className="timing__footnote">
                The figures above are a worked example, calculated with the VESA CVT Reduced
                Blanking v1 formula. The 8-pixel width rule shown in the result applies to{' '}
                <em>all</em> standard timing methods (CVT, CVT-RB v1 and v2, GTF) — not just this
                one. A valid timing here does not guarantee any specific hardware will accept it.
              </p>
            </Collapsible>
          </>
        ) : (
          <div className="result result--error" role="alert">
            <p className="result__badge">
              <span className="result__icon" aria-hidden="true">
                ✕
              </span>
              Check your input
            </p>
            <p className="result__note">{parsed.message}</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>
          <strong>Resolution Compatibility Checker</strong>
        </p>
        <p>
          Timing calculations are intended as an engineering aid. Whether a resolution is
          accepted also depends on your GPU, driver, operating system, cable and display
          hardware. Not affiliated with or endorsed by VESA.
        </p>
      </footer>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode: 'numeric' | 'decimal';
}) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field__input"
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
