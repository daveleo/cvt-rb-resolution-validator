---
name: CVT-RB resolution validator
status: maintained
priority:
version: 
deadline:
next: None. Finished public tool
updated: 2026-10-07
repo: daveleo/cvt-rb-resolution-validator
url: https://daveleo.github.io/cvt-rb-resolution-validator/
---

# CVT-RB resolution validator

Checks whether a custom resolution is compatible with CVT Reduced Blanking v1 timing.

## What it is for

A public web page for salespeople, integrators and technicians: enter a width, height and refresh rate and it tells you, in plain language, whether that custom resolution can be built cleanly (in CRU, a scaler or an LED processor) before anyone tries. The main check is the 8-pixel width rule; it also shows a full CVT Reduced Blanking v1 reference timing.

## How to run

- Use it: https://daveleo.github.io/cvt-rb-resolution-validator/ (runs entirely in the browser).
- Develop (Node.js 20+): `npm install`, then `npm run dev` (http://localhost:5173).
- Test: `npm test` (calculation engine). Type-check: `npm run typecheck`.
- Build: `npm run build` (into `dist\`), check it with `npm run preview`.
- Publish: `npm run deploy` (pushes the build to `gh-pages`; this changes the live site, so ask first).

## How to use

Type the resolution and refresh rate. If the width isn't a multiple of 8, the page says so and suggests the nearest widths above and below (for example 945 × 1680 → 952 or 944). Open **Technical Timing Details** for the full CVT-RB v1 timing. The inputs are always in the address bar (`?w=952&h=1680&hz=60`), so you can send a result to a customer as a link.

## What is what

- `src\cvt\`: the timing calculation engine (CVT-RB v1, width rule) with its unit tests.
- `src\components\`, `App.tsx`, `styles.css`: the page.
- `src\lib\`: URL parameters, number formatting and the plain-language summary.
- `scripts\deploy-gh-pages.sh`: publish script. `.github\deploy.yml.example`: an optional GitHub Actions deploy (not active).
- `README.md`: full explanation of the rule, the algorithm, sources and verification.

## Current state

Finished and public (2026-08-28).
