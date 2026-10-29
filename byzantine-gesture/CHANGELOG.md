# Changelog

## 1.1.0
- Hand-contour score: a positive correlation (r ≥ 0.35) is now required for "exact" and
  "close", and a window where the student's hand is still while the teacher's moves is "off".
  Up to 1.0.3, MAD < 0.45 alone gave "exact", so a still or unrelated hand scored "exact" in
  about half of the windows when the teacher moved little. A hand that follows the teacher is
  graded as before. Rule texts in the help and the evaluation card updated (Greek and English).
- Left-hand commands are recognised at any distance from the camera: every threshold of
  `classifyGesture` is now a multiple of the palm size, with x corrected for the frame's aspect
  ratio, and the open palm (FREEZE) no longer needs a widely spread thumb. Up to 1.0.3 the
  thresholds were fixed fractions of the frame, so FREEZE was recognised only with the hand very
  close to the camera, and a fist close to the camera was missed. One unrecognised frame inside
  a held pose no longer restarts the count.
- FREEZE could stop working for the rest of a session: resuming playback from some controls
  (e.g. the student's play button with the time link on) left the teacher marked as frozen, so
  every later FREEZE was ignored and scoring paused. Any start of playback now ends a FREEZE.
- Voices in another octave (a woman or a child with a male teacher, or the reverse) are now named
  with the right degree: the student's voice is moved by whole octaves to the teacher's octave
  before the degree is found, and any voice outside Ni..Pa′ is moved into the scale. Up to 1.0.3
  such a voice was pinned to Ni or Pa′, so the degree label and the voice curve were wrong (the
  score was already octave-independent and does not change).
- Changing from one command straight to another (fist into open palm: PLAY then FREEZE, or the
  reverse) was often lost: after a command, every pose was ignored until the hand passed through
  an unrecognised pose. Now only holding the same pose is ignored; a different pose counts at once.
- The zone for a single left hand is now the left 45 % of the image (was 40 %).
  `?gestures=debug` shows next to the left hand what it is recognised as, how long the pose has
  been held, and which fingers count as raised and extended.
- README and ODIGIES.md recommend headphones (not required) for live voice scoring.
- Runs with nothing installed: `start.bat` falls back to `serve.ps1` (Windows PowerShell) when
  Python is missing, and the repository can be served by GitHub Pages (`index.html` and
  `.nojekyll` at the root). New plain-language guide in Greek, `ODIGIES.md`; README quick start
  rewritten for non-technical users.
- Hand smoothing is now defined in media time (`emaStep`) instead of per tracked frame, and
  restarts after a backward jump (seek, replay) or a gap of more than 0.5 s. The two trackers
  drop frames independently when the computer is busy; per-frame smoothing then delayed the two
  curves by different amounts, so the teacher's video compared with itself scored about 96-97 %
  exact. At 90 ms per frame the weight is the former 0.32, so nothing changes when no frame is lost.
- New benchmarks: `bench/hand-control.mjs` (negative control: still, unrelated, opposite and
  following hands; current rule vs. the rule of 1.0.x) and `bench/self-agreement.mjs`
  (teacher compared with itself, with frame drops; per-frame vs. media-time smoothing).
- Pitch detector: the lowest frequency of the search range (65 Hz) is now detected. The dip
  search stopped one lag short of 48000/65, so a tone at exactly 65 Hz returned no pitch.
  Estimates within 10 cents of either limit are now accepted (interpolation scatter).
  Fixed in both `lib/core.mjs` and `src/index.html`.
- Audio is opened at 48 kHz on every computer (device rate only if the browser refuses), so the
  application runs the detector with the same settings as the benchmark.
- Fonts (Cinzel, Crimson Pro; SIL OFL 1.1) are now served from `vendor/fonts/`; the page makes
  no network requests at all (previously it requested the fonts from Google Fonts).
- Removed an empty, unused file (`vendor/hands/hands_solution_simd_wasm_bin.data`).
- Tests: 55 in total (40 core, 15 application), including the new hand rules, smoothing and
  gesture poses at 70-280 px, detection at
  65 Hz and 1,000 Hz, no network requests, and 48 kHz audio.
- Pitch benchmark re-run (`bench/summary.json`, Fig. 4); figure labels no longer overlap.
- `docs/architecture.md`: hand rules, octave folding (±600 cents, with the 400-cent skip),
  sampling rate, and which hand conducts in each mode. Scripts for Figs. 1 and 2 in `docs/figures/`.

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
