# Byzantine Gesture — Alignment & Vocal Evaluation Tool

A zero-install, browser-based teaching tool for Byzantine chant. A teacher video (reference hand gesture + voice) is placed side-by-side with a live webcam feed or a recorded student take. The tool aligns the two timelines, tracks the conducting hand via MediaPipe, analyses vocal pitch (YIN f₀), and scores the student's hand shape and intonation in real time.

All processing is local. No data leaves the browser.

## Quick start

Οδηγίες στα ελληνικά, βήμα βήμα: [ODIGIES.md](ODIGIES.md).

### 1. Online: nothing to install (easiest)

Open **https://nstergia.github.io/Byzantine-Gesture-Tool/** in Chrome or Edge and allow the camera and
microphone when the browser asks. The page itself is loaded from GitHub; the videos you open and the
takes you record stay on your computer and are never uploaded.

### 2. On your own computer (also works without internet)

**Windows** (nothing to install)
1. Download the zip and extract it: right-click it, choose **Extract All**.
2. Open the extracted folder, then the `byzantine-gesture` folder, and double-click **`start.bat`**.
3. If Windows shows *"Windows protected your PC"*, click **More info**, then **Run anyway**.
4. A black window opens and the browser opens the application. Keep the black window open while you
   work; close it when you have finished.

`start.bat` uses Python if the computer has it; otherwise it uses Windows PowerShell, which every
Windows has (`serve.ps1`).

**macOS / Linux**
Double-click `start.sh` (or run `bash start.sh` in a terminal). It needs Python 3: most Linux systems
have it; on macOS the first run may offer to install the "Command Line Tools", which include it.
If you prefer not to install anything, use the online version.

Do not open `index.html` by double-clicking it: browsers allow the camera and microphone only on
`http://localhost` or HTTPS pages.

### Manual way

From the repository root:

```bash
python3 -m http.server 8080
# or
python -m http.server 8080
```

Then open `http://localhost:8080/` in your browser.

(Alternative: `npx serve -l 8080` or `npx http-server -p 8080` if you have Node.js.)

### Requirements
- A desktop browser; tested on Chrome and Edge.
- Webcam and microphone (for live mode). Headphones are recommended but not required: echo
  cancellation is off to keep the voice intact, so with loudspeakers the microphone also hears the
  teacher's recording, which can inflate the voice score. The hand score is unaffected.
- Nothing to install for the online version or on Windows; Python 3 on macOS/Linux (or any static file server).
- No internet connection is needed: MediaPipe and the fonts are bundled in `vendor/`. The page makes no network requests.

## Typical workflow

1. Open `http://localhost:8080/` (you are redirected straight into the application).
2. Load a teacher video (left panel).
3. Choose **LIVE** (webcam) or load/record a student video (right panel).
4. Scrub both timelines to the same musical event and press the lock button (or use the mark buttons). The offset is shown in violet.
5. Enable time-link so the student follows the teacher.
6. Set the tonic while the teacher sings the base note.
7. Press play — the centre panel shows hand height and voice for both, and the score bars accumulate.

## Repository layout

```
index.html              landing redirect (entry point)
src/index.html          the complete application
vendor/                 bundled MediaPipe Hands 0.4.1675469240, Camera Utils 0.3.1675466862,
                        and the Cinzel / Crimson Pro fonts (OFL 1.1)
lib/core.mjs            pure algorithms extracted from the app
tests/core.test.mjs     unit tests for the scientific core
tests/mirror.test.mjs   checks that the app's copies of the core routines behave identically
bench/                  pitch-detector accuracy test and Fig. 4; hand-contour negative control
docs/architecture.md    module & data-flow description
docs/figures/           scripts that draw Figs. 1 and 2 of the paper
start.sh / start.bat    convenience launchers (auto-open browser)
serve.py / serve.ps1    local servers used by the launchers (serve.ps1: Windows without Python)
ODIGIES.md              step-by-step guide in Greek for non-technical users
```

## Testing

Requires Node.js ≥ 18:

```bash
npm test
# or
node --test tests/core.test.mjs tests/mirror.test.mjs
```

Pitch-detector benchmark and hand-contour negative control: see `bench/README.md`.

Compatible with Node 18–24.

## Dependencies

MediaPipe Hands (0.4.1675469240) and Camera Utils (0.3.1675466862) are served from the local `vendor/` directory.  
The fonts (Cinzel, Crimson Pro; SIL Open Font License 1.1) are served from `vendor/fonts/`. Neither family has Greek glyphs, so Greek text uses the browser's serif font.

## Browser support

Tested on Chrome and Edge (desktop). Other browsers with Web Audio, getUserMedia and MediaRecorder may work but are not tested.  
Webcam access requires a secure context (HTTPS or `localhost`).

## License

MIT — see [LICENSE](LICENSE).

## Citation

If you use this software in academic work, please cite it using the metadata in [CITATION.cff](../CITATION.cff) at the root of the repository.

## If the start script does not work

1. Extract the **whole** zip into a folder first, and run `start.bat` (Windows) or `bash start.sh` (macOS/Linux) from inside that folder.
2. Windows: if you see "Python was not found", install Python 3 from https://www.python.org/downloads/ and tick "Add python.exe to PATH".
3. Manual start from any terminal opened in the project folder: `python serve.py 8080` (or `py -3 serve.py 8080`; `python -m http.server 8080` also works, but the browser may then show an old cached copy of the app), then open http://localhost:8080/ in Chrome or Edge.
4. Do not open `index.html` by double-clicking it: the camera and the MediaPipe files need `http://localhost` or HTTPS.

## Reading the voice label

The label under each voice meter tells you what the audio is doing:
- `voice —` : no pitch yet (silence, or the video is paused).
- `mic silent · check input device/level` : the microphone is connected but delivers no signal. Check the input device and level in the system sound settings.
- `audio paused · click the page` : the browser has suspended audio until you interact with the page.
- `no microphone` : the microphone was not connected (permission or device).

`serve.py` is a small wrapper around Python's built-in server. It disables browser caching, so a freshly extracted version is never replaced by an older cached copy, and it answers the browser's favicon request quietly.

## Session evaluation card

Click the **ΑΞΙΟΛΟΓΗΣΗ / EVALUATION** label (top right) to open the results of the session since the last reset:
a timeline of hand and voice verdicts (click it to jump both videos to that moment), the exact / close / off shares of the hand contour and of the voice,
the mean and the signed deviation of the voice, the coverage (share of the teacher's voiced time that was evaluated), the exact share after removing the constant offset,
and the number of windows skipped because of still hands or drift. The text of the card can be copied.

Scores are only accumulated while the two players are within 60 ms of each other (LIVE mode is always in sync).

### Voice limits

The voice is exact within 50 cents of the teacher and close within 150 cents. To try other limits, open the page with parameters, for example
`http://localhost:8080/src/index.html?voiceExact=70&voiceClose=150`.

To see why a left-hand command is or is not recognised, add `?gestures=debug`: a label next to the
left hand shows the recognised pose and how long it has been held (e.g. `❄ FREEZE ●●○○`), which
fingers count as raised (`up`) and extended (`ext`), and `ok X` when the thumb and index touch
(an OK sign, which is never a command).

### Colours

Green means exact, yellow close, red off, and grey (in the timeline) not evaluated. The exact limits are listed in the evaluation card and in the help (the `?` button).
Takes recorded without any sound are flagged with 🔇 and a warning, and recorded takes now show their real length on the progress bar.

## Recording a take

While a take is being recorded (including the 6-second countdown) the teacher video runs at normal speed from the beginning and cannot be paused, sought or sped up,
the left-hand control gestures are switched off, and only the performing hand is drawn, in green. The performing hand is the highest hand in the frame, the same rule that is
used when a recorded take is analysed afterwards.

The recorder and the teacher video never start at exactly the same instant. The application measures the delay between the two (the `start` event of the recorder and the first
frame of the teacher) and applies it as the offset of the take, so that the take opens aligned. The status line reports the delay. A small remaining difference (camera and microphone
latency, or the singer's reaction time) can be corrected with the ±0.05 / ±0.25 buttons or with LOCK HERE.


[![DOI](https://zenodo.org/badge/1433588304.svg)](https://doi.org/10.5281/zenodo.23650181)
