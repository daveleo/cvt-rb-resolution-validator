# Resolution Compatibility Checker

> Check whether a custom width, height and refresh rate can be set up as a clean
> custom display resolution — before you try to create it in CRU, a scaler or an
> LED processor.

A small, static, single-page web app for AV / LED-display salespeople, system
integrators and technicians. Enter a width, height and refresh rate; the app
tells you, in plain language, whether that resolution can be built exactly.

The headline check is the **8-pixel horizontal width rule**: every standard way
of generating a custom timing (the CVT and GTF formulas used by Windows, GPU
drivers and tools like CRU) steps the width in blocks of 8 pixels. So `945 × 1680`
is flagged because 945 is not a multiple of 8, and the app recommends
`952 × 1680` (or the lower `944 × 1680`). Heights and refresh rates are not
affected by this rule.

Under the hood the app also computes a full reference timing with the VESA
**CVT Reduced Blanking v1** algorithm, shown in the collapsible *Technical Timing
Details* section. The 8-pixel width rule is not specific to CVT-RB — it is common
to CVT, CVT-RB v1/v2 and GTF — so the main result does not single that standard
out as "the cause".

**Live site:** <https://daveleo.github.io/cvt-rb-resolution-validator/>

No backend. No database. No login. No external API. No analytics. Everything runs
locally in the browser.

---

## Contents

- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [The 8-pixel width rule](#the-8-pixel-width-rule)
- [The CVT-RB v1 implementation](#the-cvt-rb-v1-implementation)
- [Verification & sources](#verification--sources)
- [URL parameters](#url-parameters)
- [Testing](#testing)
- [Deployment](#deployment)
- [Scope & disclaimer](#scope--disclaimer)

---

## Quick start

Requires **Node.js 20+**.

```bash
npm install
npm run dev        # local dev server (http://localhost:5173)
npm test           # run the calculation-engine unit tests
npm run build      # production build -> dist/
npm run preview    # serve the production build locally
```

## Scripts

| Script              | What it does                                        |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Vite dev server with hot reload                    |
| `npm test`          | Vitest unit tests (calculation engine), single run |
| `npm run test:watch`| Vitest in watch mode                               |
| `npm run typecheck` | `tsc` type-check with no emit                      |
| `npm run build`     | Type-check + Vite production build into `dist/`    |
| `npm run preview`   | Serve `dist/` locally to sanity-check the build   |

## Project structure

```
src/
  cvt/
    cvtRbV1.ts          # pure CVT-RB v1 timing calculation (no UI, no formatting)
    recommend.ts        # 8-px verdict, width recommendations, nearby widths
    index.ts            # barrel re-export
    tests/
      cvtRbV1.test.ts   # unit tests for the engine + helpers
  components/
    ResultCard.tsx      # the big green / amber result
    TimingDetails.tsx   # collapsible technical timing tables
    NearbyWidths.tsx    # clickable nearby CVT-RB widths
    Collapsible.tsx     # <details>/<summary> disclosure
  lib/
    format.ts           # number/unit formatting helpers
    url.ts              # ?w=&h=&hz= parsing + share URL
    summary.ts          # "Copy Result" plain-text builder
  App.tsx               # page composition + state
  main.tsx              # React entry
  styles.css            # all styling (light + dark, responsive)
```

The calculation is deliberately **separated from the UI**. `calculateCvtRbV1()`
is a pure function that returns structured data — no strings are formatted inside
it.

```ts
import { calculateCvtRbV1 } from './src/cvt';

const timing = calculateCvtRbV1(952, 1680, 60);
// -> { hActive: 952, vActive: 1680, exactHorizontalMatch: true,
//      hTotal: 1112, hBlank: 160, hFrontPorch: 48, hSync: 32, hBackPorch: 80,
//      vTotal: 1728, vBlank: 48, vFrontPorch: 3, vSync: 10, vBackPorch: 35,
//      pixelClockMHz: 115.25, horizontalFrequencyKHz: ~103.642,
//      actualRefreshRate: ~59.978, hSyncPolarity: 'positive',
//      vSyncPolarity: 'negative', ... }
```

---

## The 8-pixel width rule

The check the user actually sees is simple and standard-agnostic:

```
supported  ⇔  width mod 8 === 0
lower  = floor(width / 8) * 8
higher = ceil (width / 8) * 8      // recommended by default
```

This is not a CVT-RB v1 quirk. The horizontal "character cell granularity" of
**8 pixels** is shared by:

| Method | Horizontal step |
| ------ | --------------- |
| CVT standard blanking | 8 px |
| CVT Reduced Blanking v1 | 8 px |
| CVT Reduced Blanking v2 | 8 px |
| GTF (Generalized Timing Formula) | 8 px |

CTA-861 / DMT are fixed lookup tables, not formulas, and their entries are all
multiples of 8 as well. So a width like 945 cannot be produced exactly by *any*
of the standard timing generators — only by a fully hand-built custom timing with
no standard behind it. That is why the UI blames "the 8-pixel width rule", not
CVT-RB.

Heights and refresh rates have no comparable restriction here.

---

## The CVT-RB v1 implementation

`src/cvt/cvtRbV1.ts` is a clean-room re-implementation of the **VESA Coordinated
Video Timings – Reduced Blanking, version 1** timing generator. It follows the
control flow, constants and integer-rounding behaviour of the widely used open
reference implementations (see [Verification & sources](#verification--sources)).
Only the non-interlaced, no-margin path is implemented — that is what a custom
desktop / LED-wall timing uses in practice.

**No proprietary VESA standards text is reproduced.** Only publicly documented
numeric constants from the open-source implementations are used.

This engine powers the *Technical Timing Details* section as a worked reference
example (pixel clock, porches, totals, actual refresh). The pass/fail verdict
itself only needs the [8-pixel width rule](#the-8-pixel-width-rule).

### Algorithm outline

Given requested `width`, `height`, `refreshRate`:

1. **Horizontal active** is rounded **down** to the 8-pixel character grid:
   `hActive = floor(width / 8) * 8`. If `width !== hActive` the requested width
   cannot be represented exactly by CVT-RB v1.
2. **Vertical sync width** is chosen from the aspect ratio of the *requested*
   active area (4:3 → 4, 16:9 → 5, 16:10 → 6, 5:4 / 15:9 → 7, otherwise 10 lines).
3. **Horizontal period** is estimated with fixed-point integer maths from the
   minimum vertical blanking interval (460 µs) and the field rate.
4. **Vertical blanking** in lines is derived from that period, then clamped to a
   minimum of `V front porch (3) + V sync + V back porch (6)`.
5. **Horizontal blanking is fixed** for reduced blanking: `H blank = 160`,
   `H sync = 32`, giving `H front porch = 48` and `H back porch = 80`.
6. **Pixel clock** = `H total / H period`, floored onto the **0.25 MHz** CVT-RB
   grid.
7. **Actual refresh rate**, **H frequency** and the line/frame periods are then
   recomputed from that rounded pixel clock, so the displayed refresh is what the
   timing really produces (typically a touch under the requested value).

### Constants used

| Constant                         | Value    |
| -------------------------------- | -------- |
| Character-cell granularity       | 8 px     |
| Min vertical back porch          | 6 lines  |
| Pixel-clock step (reduced)       | 0.25 MHz |
| Min vertical blanking interval   | 460 µs   |
| H sync width (reduced, fixed)    | 32 px    |
| H blanking (reduced, fixed)      | 160 px   |
| V front porch (reduced, fixed)   | 3 lines  |
| Sync polarity (reduced)          | H +, V − |

### This is CVT-RB **v1** specifically

The implementation is **not** CVT standard (GTF-style) blanking, **not** CVT-RB
v2, **not** CTA-861 and **not** DMT. The distinguishing markers of v1 used here:
fixed 160-pixel H blank, fixed 32-pixel H sync, 460 µs minimum V blank, 0.25 MHz
clock step, and H-positive / V-negative sync.

---

## Verification & sources

The calculation was cross-checked against established open implementations of the
VESA CVT algorithm:

| Reference implementation | Where |
| ------------------------ | ----- |
| **Linux kernel — DRM** `drm_cvt_mode()` (reduced-blanking branch) | `drivers/gpu/drm/drm_modes.c` — <https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/tree/drivers/gpu/drm/drm_modes.c> |
| **edid-decode** `edid_cvt_mode()` | <https://git.linuxtv.org/edid-decode.git/tree/edid-decode.cpp> |
| **libdisplay-info** `di_cvt_compute()` | <https://gitlab.freedesktop.org/emersion/libdisplay-info/-/blob/main/cvt.c> |

The control flow and rounding in `cvtRbV1.ts` follow the Linux DRM
implementation. The reference cases below were verified against that algorithm
and against edid-decode's CVT-RB output:

| Requested        | H active | H total | V total | Pixel clock | Actual refresh |
| ---------------- | -------- | ------- | ------- | ----------- | -------------- |
| 1920×1080 @ 60   | 1920     | 2080    | 1111    | 138.500 MHz | 59.933 Hz      |
| 952×1680 @ 60    | 952      | 1112    | 1728    | 115.250 MHz | 59.978 Hz      |
| 945×1680 @ 60    | **944**  | 1104    | 1728    | 114.250 MHz | 59.888 Hz      |
| 3840×2160 @ 60   | 3840     | 4000    | 2222    | 533.000 MHz | 59.968 Hz      |

For `952×1680 @ 60`: H blank 160, H front porch 48, H sync 32, H back porch 80,
V blank 48 (V front porch 3, V sync 10, V back porch 35) — matching the expected
reference behaviour.

Run `npm test` to check all cases.

---

## URL parameters

The current inputs are always reflected in the query string, so any calculation
can be shared with a customer:

```
https://<your-site>/?w=952&h=1680&hz=60
```

Opening that link populates the fields and calculates immediately. The **Copy
Link** button copies the current URL; **Copy Result** copies a plain-text summary
suitable for email or Teams.

---

## Testing

Unit tests live in `src/cvt/tests/` and cover the calculation engine and the
recommendation helpers:

- Known timings: 1920×1080@60, 1680×945@60, 945×1680@60, 944×1680@60,
  952×1680@60, 960×1680@60, 3840×2160@60
- Horizontal normalization: `945→944, 944→944, 952→952, 953→952, 959→952, 960→960`
- Higher-width recommendation: `945→952, 946→952, 951→952, 952→952, 953→960`
- Input validation (zero / negative / fractional / NaN / absurd values)
- Internal consistency of derived frequencies and periods
- `nearbyWidths`, `orientationOf`, `validateResolution`

```bash
npm test
```

---

## Deployment

The build output in `dist/` is a fully static site. `vite.config.ts` sets
`base: './'` so it works from any path or domain without further configuration.

### GitHub Pages — current setup (`gh-pages` branch)

This repo publishes from the **`gh-pages`** branch, which holds the built
`dist/` output. In **Settings → Pages**, Source is
**Deploy from a branch → `gh-pages` / `root`**. To publish a new version after
changing the code:

```bash
npm run deploy      # runs scripts/deploy-gh-pages.sh: build + push to gh-pages
```

The site publishes to `https://<user>.github.io/<repo>/` — for this repo,
<https://daveleo.github.io/cvt-rb-resolution-validator/>.

### GitHub Pages — automated via Actions (optional)

A ready-made workflow is included as **`.github/deploy.yml.example`**. It builds,
tests and deploys on every push to `main`. To enable it:

1. Move it into place: `.github/deploy.yml.example` → `.github/workflows/deploy.yml`
   (committing a file under `.github/workflows/` needs a token/login with the
   `workflow` scope).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`.

### GitHub Pages — manual with the `gh-pages` package

```bash
npm run build
npx gh-pages -d dist
```

### Cloudflare Pages

- Framework preset: **None / Vite**
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `20`

### Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- (Or drag-and-drop the `dist/` folder into the Netlify dashboard.)

### Any ordinary web server

```bash
npm run build
# copy the contents of dist/ to the web root (Apache, nginx, IIS, S3, …)
```

No server-side runtime, rewrite rules or environment variables are required.

---

## Scope & disclaimer

This tool checks whether the resolution numbers **line up with a standard
timing** — principally the 8-pixel horizontal width rule. It does **not**
guarantee that a given GPU, graphics driver, operating system, cable/interface,
EDID, display controller or LED processor will accept the resolution. Those are
separate **hardware / OS compatibility** questions the tool does not attempt to
answer.

Not affiliated with, or endorsed by, VESA. No VESA logos or standards text are
used.

## License

MIT — see [LICENSE](LICENSE).
