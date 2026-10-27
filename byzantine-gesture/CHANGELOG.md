# Changelog

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
