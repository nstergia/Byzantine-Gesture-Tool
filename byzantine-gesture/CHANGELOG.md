# Changelog

## 1.2.0
- `samples/student_C.mp4`: a take of a second student (written consent; face blurred, background
  darkened), with the expected results in `samples/README.md`.
- EXPORT DATA (CSV) in the evaluation card: one row per scored hand window and voice frame (teacher
  time, teacher and student hand height in degrees, r, MAD, frequencies, folded cents, band), settings
  in `#` header lines. Built by `sessionCsv` in `lib/core.mjs`; the file is saved locally.
- One copy of the code: the page script is now an ES module that imports every numerical routine
  from `lib/core.mjs`. The copies kept in `src/index.html` and the tests that compared them
  (`tests/mirror.test.mjs`) are gone; `tests/app.test.mjs` checks that no core routine is redefined
  in the page, that the page script parses as a module, and tests the logic that exists only in the
  page (left-hand commands, tonic adapter, settings, recording format). 65 tests (41 core, 20 application, 4 WebM).
- `?perf=1` adds a performance section to the evaluation card: pitch-detection time per frame,
  hand-tracking delay, animation-frame rate and share of slow frames, long tasks on the main thread.
  `bench/yin-timing.mjs` times the pitch detector outside the browser.
- Time link: with a reloaded WebM take on a slow computer, LOCK HERE could freeze the student video.
  A seek took longer than the 350 ms the link waited, so it started another seek, and so on. Now no
  seek starts while one is running; during playback, drifts up to 0.5 s are corrected by the student's
  playback rate (0.5-2x), larger ones re-seek at most every 0.6 s, aiming ahead by the last seek's
  duration. Scoring still counts only while the players are within 60 ms.
- Lighter on slow computers: once a guide is locked, scoring reads the teacher's hand from the guide,
  so the teacher's hand tracker runs every 300 ms instead of every 90 ms inside the guided span (it
  only keeps the teacher's skeleton on screen). On an i7-8550U laptop, ?perf=1 had shown the main
  thread busy 84% of the time, mostly with the two hand trackers (about 70 ms per frame each).
- `serve.py` serves `.mjs` files as JavaScript on every Python version.
- The redirect pages (`index.html` at the repository root and in `byzantine-gesture/`) now keep the URL
  parameters; before, opening e.g. `…/?perf=1` or `…/?echo=on` through them silently dropped the parameter.
- Downloaded takes can be reloaded: MediaRecorder writes WebM without a duration or seek index, so a
  downloaded take could not follow the time link. `lib/webm.mjs` (no dependencies) now adds a Duration
  and a Cues index before a take is stored or downloaded, copying every frame byte for byte; WebM files from earlier versions are repaired when loaded. Recording
  stays WebM: Chrome's MP4 recording played back in slow motion when the camera delivered fewer frames
  under load. Tests: `tests/webm.test.mjs` with a synthetic live-WebM fixture.
- `?echo=on` switches the browser's echo cancellation on, for users without headphones; by default it
  stays off because it alters the voice. With loudspeakers and echo cancellation off, the microphone
  also hears the teacher's recording and can inflate the voice score.
- A short reminder recommends headphones the first time the microphone opens while the teacher's sound
  is on (6 seconds, or until clicked).
- `samples/`: a teacher recording and a student take (written consent; faces blurred) for trying the
  tool and for the pYIN comparison.
- `bench/pyin_compare.py` (with `bench/yin-frames.mjs`): agreement of the pitch detector with pYIN on
  the sample voices; results in `bench/pyin-compare.json`. On the male voice about 16% of frames show
  harmonic (octave) errors, which the octave folding of the voice score largely absorbs.
- README: tested browsers (Chrome 156, Edge 156).

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
