# Changelog

## 1.0.3
- Pitch detector: the lowest frequency of the search range (65 Hz) is now detected. The dip
  search stopped one lag short of 48000/65, so a tone at exactly 65 Hz returned no pitch.
  Estimates within 10 cents of either limit are now accepted (interpolation scatter).
  Fixed in both `lib/core.mjs` and `src/index.html`.
- Audio is opened at 48 kHz on every computer (device rate only if the browser refuses), so the
  application runs the detector with the same settings as the benchmark.
- Fonts (Cinzel, Crimson Pro; SIL OFL 1.1) are now served from `vendor/fonts/`; the page makes
  no network requests at all (previously it requested the fonts from Google Fonts).
- Removed an empty, unused file (`vendor/hands/hands_solution_simd_wasm_bin.data`).
- New tests: detection at 65 Hz (44.1 and 48 kHz) and at 1,000 Hz; the page loads nothing from
  the network; audio is opened at 48 kHz. 44 tests in total (36 core, 8 application).
- Benchmark re-run (`bench/summary.json`, Fig. 4); figure labels no longer overlap.
- `docs/architecture.md`: octave folding (±600 cents, with the 400-cent skip), sampling rate,
  and which hand conducts in each mode. Scripts for Figs. 1 and 2 in `docs/figures/`.

## 1.0.2
- Repository layout: README, LICENSE and CITATION.cff at the repository root;
  the application README restored in `byzantine-gesture/`. No change to the code.
  (The archived 1.0.1 release had these files in the wrong folder.)

## 1.0.1
- Pitch detector: the YIN dip search now starts at the shortest lag of the search range
  (it started two samples later, so frequencies above about 970 Hz were read an octave low; the detector now works up to the 1,000 Hz limit).
  Fixed in both `lib/core.mjs` and `src/index.html`.
- `classifyGesture` in `lib/core.mjs` now matches the classifier the application uses
  (fist = play; the OK sign is not a command). Tests updated.
- New tests: detection at 960, 980 and 995 Hz; the application's copies of the pitch detector and
  the gesture classifier are checked against the core (`tests/mirror.test.mjs`).
- Added `bench/` with the script and data of the pitch-accuracy test (paper, Section 3.2).

## 1.0.0
- First release.
