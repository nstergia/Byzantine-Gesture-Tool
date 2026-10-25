# Byzantine Gesture: A real-time, browser-based multimodal assessment environment for Byzantine chant learning

**Athanasia Stergiaki**^[a], **Paraskevi Kritopoulou**^[a], **Kostas Kokkinidis**^[a], **George Patronas**^[b]

[a]: *[Affiliation placeholder — to be completed]*
[b]: *[Affiliation placeholder — to be completed]*

---

## Abstract

Learning Byzantine chant with the Patronas hand method requires the student to synchronise a conducting gesture with singing: the teacher's vertical hand trajectory encodes the melody, making assessment inherently multimodal. Existing computer-assisted tools have relied on dedicated hardware, such as the Microsoft Kinect, and on offline analysis, precluding immediate feedback during practice. This paper presents Byzantine Gesture, a zero-installation, fully client-side web application for the real-time, multimodal assessment of chant learning. Conducting-hand movement is tracked with MediaPipe Hands and vocal pitch estimated with a YIN-based detector; both are mapped onto the nine-degree Byzantine scale and evaluated against a teacher reference on a temporally aligned timeline. It provides interactive offset locking, live match indicators with continuous session scoring for hand-envelope shape and intonation, and recording of aligned student takes. Running entirely in the browser under the MIT license, it requires only a conventional webcam and protects student data by design.

**Keywords:** Byzantine chant; Cheironomy; Gesture recognition; Fundamental frequency estimation; Real-time feedback; Music education; Intangible cultural heritage

---

## Code metadata

| Column | Content |
|---|---|
| **C1** Current code version | v1.0.0 |
| **C2** Permanent link to code/repository | https://github.com/USERNAME/byzantine-gesture *[placeholder — to be completed after repository creation]* |
| **C3** Code Ocean compute capsule | Not applicable — the software is a client-side web application with no server component; a live deployment or the repository README suffices to reproduce execution. |
| **C4** Legal code license | MIT |
| **C5** Code versioning system used | git |
| **C6** Software code languages, tools, and services used | HTML5; JavaScript (ES2020); Web Audio API; WebRTC/MediaStream Recording API; Canvas 2D API; MediaPipe Hands 0.4.1675469240; MediaPipe Camera Utils 0.3.1675466862 |
| **C7** Compilation requirements, operating environments and dependencies | No compilation or installation. Any modern Chromium-based, Firefox, or WebKit browser. Webcam/microphone access requires a secure context (HTTPS or localhost). Node.js ≥ 18 is required only for running the unit-test suite (`npm test`). |
| **C8** Link to developer documentation/manual | https://github.com/USERNAME/byzantine-gesture#readme *[placeholder]*; architecture description in `docs/architecture.md` |
| **C9** Support email for questions | *[placeholder — to be completed]* |

---

## 1. Motivation and significance

### 1.1. The Patronas hand method and multimodal chant learning

Byzantine chant (ψαλτική τέχνη) is an unaccompanied monophonic tradition whose pedagogy has always been intertwined with cheironomy: the teacher indicates melodic movement with vertical hand gestures above a reference point, and the student answers with the voice. In the Patronas hand method, the vertical position of the conducting hand maps onto the nine-degree Byzantine scale — Νη, Πα, Βου, Γα, Δι, Κε, Ζω, Νη΄, Πα΄ — so that the hand trajectory is, in effect, a graphical score performed in real time. Competent performance therefore couples two modalities that must be assessed together: the *shape* of the hand envelope (intervals, direction, register) and the *intonation* of the sung voice against the same scale. Any assessment environment that examines only one of the two modalities captures, at best, half of the skill.

Because the tradition is transmitted primarily through oral apprenticeship, few digital tools exist to support it, and those that do typically address either audio analysis or notation, not the gesture–voice coupling that defines the method. The present work fills this gap with a tool built around exactly this coupling.

### 1.2. From offline pipelines to real-time feedback

The direct predecessor of this software is MAML (Machine Assessment of Multimodal Learning), a research system developed at the University of Macedonia between 2017 and 2019, in the context of a Greek national grant (GGET) awarded in recognition of the university's participation in the European I-TREASURES project on intangible cultural heritage. MAML assessed Byzantine chant learners by fusing skeletal data captured with a Microsoft Kinect depth sensor with audio features, using dynamic time warping (DTW), hidden Markov models (HMMs) and random forests; it achieved approximately 82% agreement with expert assessors [1,2]. Despite this accuracy, the system could not leave the laboratory: it required dedicated and discontinued hardware, batch-style offline processing, and substantial technical support. Critically, its feedback arrived long after the performance — whereas motor-skill learning theory is unambiguous that feedback must be immediate to be maximally effective.

Byzantine Gesture is a ground-up re-engineering motivated by a single question: *can the same multimodal assessment be delivered instantly, anywhere, with equipment a student already owns?* The answer implemented here replaces the depth sensor with an ordinary RGB webcam, replaces the offline machine-learning pipeline with lightweight in-browser algorithms, and moves the feedback loop from minutes to milliseconds.

### 1.3. Significance

The significance of the work is threefold:

- **Pedagogical.** It provides the first real-time assessment environment for the Patronas method, giving learners immediate, legible feedback on both gesture and voice while they practise, and giving teachers an objective record of a session rather than a retrospective impression.
- **Accessibility and preservation.** By running in any modern browser with no installation and no cost, it removes the hardware and expertise barriers that confined earlier research prototypes to laboratories, and supports the teaching of a tradition recognised by UNESCO as intangible cultural heritage of humanity [5].
- **Methodological.** The temporal-alignment problem — comparing a teacher reference with a student recording that almost never starts at the same clock time — is solved here with an interactive, auditable offset mechanism rather than an opaque black-box synchronisation, keeping the human teacher in the loop. The same architecture generalises to other gestural-vocal disciplines.

---

## 2. Software description

Byzantine Gesture is a single-page web application implemented in HTML5 and vanilla JavaScript. All processing — video decoding, hand tracking, pitch estimation, alignment, scoring — is performed client-side in the browser; no account, server, or network transfer of media is involved, which makes the tool privacy-preserving by construction and trivially deployable (any static file host, or a local `python -m http.server`).

The workspace (Fig. 2) is organised around three areas. The **teacher panel** loads a reference video containing a model performance (hand and voice). The **student panel** operates in three mutually exclusive modes: *live* (webcam + microphone), *video* (uploaded recording), or *recorded take* (an in-browser capture with the camera and microphone). The **centre panel** hosts a dual time-series graph of hand height and vocal pitch for both performers on a common timeline, live match indicators, note readouts for the Byzantine scale degrees, a gesture guide, and session-level score bars.

The core workflow is comparative: the teacher's performance serves as the reference curve; the student's performance is mapped onto the same timeline through an explicit alignment step and is then scored continuously, modality by modality, while both videos play.

---

## 3. Software architecture

The application is deliberately monolithic at deployment (one self-contained HTML document, `src/index.html`) but decomposes cleanly into five cooperating subsystems (Fig. 1):

1. **Input and capture layer.** Teacher videos and student files are read through the File API and decoded by the HTML5 `<video>` element; the live mode acquires camera and microphone streams via `getUserMedia`; the recording mode multiplexes both into a WebM stream through the MediaStream Recording API. Each recorded take stores the teacher clock reading at the moment recording begins (`teacherT0`), which anchors the take to the reference timeline.
2. **Gesture-tracking subsystem.** MediaPipe Hands extracts 21 landmarks per detected hand at interactive frame rates. The highest hand in the frame is selected as the conducting hand; in live mode, the leftmost hand is additionally reserved for transport-control gestures. Landmark midpoints are mapped to a continuous scale degree, smoothed with an exponential moving average (α = 0.32), and stamped onto the shared master timeline.
3. **Audio-analysis subsystem.** A Web Audio `AnalyserNode` feeds 4096-sample frames to a YIN fundamental-frequency estimator [3]; detected frequencies are quantised to the nearest degree of the Byzantine scale computed in just intonation relative to a user-supplied tonic (Νη). A high-pass filter and RMS gating suppress low-frequency noise and non-voiced frames.
4. **Temporal-alignment subsystem.** Because recorded takes rarely start at the same musical moment as the reference, all evaluation is performed on aligned time, `t_student = t_teacher + offset`. The offset is established interactively (scrubbing, mark-in points, or a one-button "lock here") and refined with ±0.05–1 s nudges; an optional linked-transport mode mirrors every play/pause/seek of the teacher onto the student and applies small playback-rate corrections when residual drift exceeds a threshold.
5. **Evaluation and presentation subsystem.** Hand-envelope similarity is computed over a sliding 2.5 s window as the Pearson correlation and mean absolute difference between median-centred teacher and student scale-degree series, augmented by register-offset and range-ratio diagnostics; vocal similarity is computed in folded cents with 50/150 cent accuracy bands. Results drive match indicators, a dual time-series plot, and aggregated session bars.

For testability, the pure algorithms of subsystems 2–4 (YIN detection, scale quantisation, cent folding, gesture classification, guide-curve interpolation, Pearson statistics, offset computation) are extracted verbatim into an ES module (`lib/core.mjs`) that is exercised by a 23-case unit-test suite (`node --test`) running in continuous integration. External dependencies are pinned to exact versions (MediaPipe Hands 0.4.1675469240, Camera Utils 0.3.1675466862) so that an archived release reproduces byte-identical behaviour.

---

## 4. Software functionalities

- **F1 — Teacher reference loading.** Local video files of any container/codec supported by the browser; audio is routed through the Web Audio graph for analysis, with an independent listen/mute control.
- **F2 — Three student modes.** Live webcam; uploaded video; and in-browser recording, with automatic mode switching and a mirror toggle for the live view.
- **F3 — Take recording and management.** One-button capture of synchronised camera + microphone into WebM, with a countdown that starts the teacher reference simultaneously; takes are listed chronologically, reloadable for evaluation, and downloadable.
- **F4 — Interactive temporal alignment.** Dual scrub bars with frame-stepping, mark-in points (ΣΗΜΕΙΟ Δ/Μ), one-button offset locking, fine nudges, and linked transport with automatic take anchoring via `teacherT0`.
- **F5 — Conducting-hand tracking.** Real-time skeleton overlay on both panels; the highest hand drives the scale-degree readout (Νη–Πα΄) and the hand curve on the graph.
- **F6 — Left-hand transport gestures (live mode).** Open palm freezes the teacher video; a V-sign replays the last four seconds; a raised index steps to a slower speed; a fist resets speed to ×1; an OK sign starts playback — allowing hands-free control while practising.
- **F7 — Vocal analysis.** YIN-based f₀ tracking from teacher audio, student microphone, or recorded takes; quantisation to Byzantine scale degrees against a user-set tonic (ΝΗ button); per-frame note labels with frequency readout.
- **F8 — Real-time dual evaluation.** Simultaneous match indicators for hand shape (exact/close/off from correlation and mean absolute difference, with register and range diagnostics) and voice (cents deviation in 50/150 cent bands, octave-folded); evaluation is suspended automatically whenever the two clocks drift out of alignment, guaranteeing that only comparable moments are scored.
- **F9 — Session analytics.** Accumulated percentage bars for both modalities (exact/close/off), mean absolute error, register offset, range ratio, and a persistent score pill; one-click reset for a new exercise.
- **F10 — Reference-guide mode.** The teacher's hand (and voice) curves can be captured once and locked as a semi-transparent guide, so that a student may later follow the stored reference without reloading the video.
- **F11 — Privacy by design.** No cookies, no analytics, no uploads; recordings never leave the device unless the user explicitly downloads them.

---

## 5. Illustrative examples

*Distance-learning practice session.* A student preparing an exam in Byzantine chant receives from the teacher a short reference video of a heirmologic phrase, performed with the hand method. The student serves the application over localhost and loads the video into the teacher panel; the right panel is in live mode. Because the phrase's opening is ornamented, the student first records a take (F3): after a six-second countdown the teacher video starts exactly as recording begins, so the take is automatically anchored to the reference clock. The student switches the panel to the recorded take, scrubs both timelines to the same cadence, presses "lock here" (F4), and engages linked transport.

During playback, the conducting-hand skeletons of teacher and student are overlaid on their panels, while the centre graph draws both hand curves and both pitch curves on the aligned timeline (F5, F7). The student observes the hand indicator alternate between gold ("close", correlation moderate, register offset +0.8 degrees — the student's hand sits consistently lower than the model) and green ("exact") on the plain syllabic passages; the voice indicator reports small upward deviations on the ascent to Κε. The session bars (F9) quantify the outcome: the phrase was performed three times, and the student can see the green fraction of the voice bar improving across takes — immediate, concrete evidence of progress that would previously have required a teacher's physical presence. The take is then downloaded and sent to the teacher, who loads it as a student video and reviews the same indicators and scores.

---

## 6. Impact

**On teaching and learning.** The tool converts an otherwise ephemeral interaction — a student's attempt, a teacher's impression — into an inspectable, replayable, quantified record. Immediate feedback tightens the practice loop for a skill that couples motor and vocal control; the register and range diagnostics reveal systematic habits (a consistently low hand, an undersized envelope) that are difficult to convey verbally. Because nothing must be installed and no data leaves the device, the tool is usable in conservatories, parish choirs, and private homes alike, including settings where institutional IT policies prohibit software installation.

**On the research community.** Earlier work on multimodal assessment of Byzantine chant was validated on laboratory hardware that is no longer manufactured; this release transfers the approach to commodity devices and provides, for the first time, a versioned, MIT-licensed, tested codebase with a pinned dependency set, enabling replication and extension. Recorded takes constitute aligned multimodal corpora (gesture + audio + score time) that can support future machine-learning studies under explicit consent.

**On intangible cultural heritage.** By lowering the cost of structured practice, the software supports transmission of the Patronas method to diaspora learners and self-taught students who lack access to a living teacher, complementing UNESCO-recognised safeguarding efforts for Byzantine chant [5].

---

## 7. Conclusions and future work

We presented Byzantine Gesture, a real-time, browser-based, multimodal assessment environment for learning Byzantine chant with the Patronas hand method. It replaces an offline, special-hardware research pipeline with an instant, zero-install, privacy-preserving tool, and it places an auditable temporal-alignment mechanism at the centre of the evaluation so that a human teacher always controls what is compared with what. The scientific core — YIN pitch estimation, Byzantine-scale quantisation, gesture classification, shape correlation, offset computation — is unit-tested and continuously integrated.

Planned developments include: (i) elastic, measure-level alignment based on dynamic time warping, to replace the current global offset and handle tempo rubato within a phrase; (ii) migration from the legacy MediaPipe Hands solution API to the supported Tasks API, future-proofing the tracking subsystem; (iii) classroom studies measuring learning gains against the MAML baseline and against traditional instruction; and (iv) support for the moving reference point (μετάβαση) used in advanced cheironomy, and for additional scale systems of the wider Eastern chant family.

---

## Acknowledgements

The software continues research initiated under the MAML project (University of Macedonia, 2017–2019), funded by the Greek General Secretariat for Research and Innovation (GGET) in the context of the European I-TREASURES project. *[Funding statement placeholder — to be completed.]*

## References

[1] K. Kokkinidis, et al., "Learning Byzantine Music in a Sensory-Motor Based Environment," in *Proc. WEI-ETL (International Conference on Wireless, Educacion, Innovation, Technology, Electronics, Learning)*, Rome, Italy, 2019. *[complete volume/pages if available]*

[2] K. Kokkinidis, P. Mastoras, A. Stergiaki, P. Kritopoulou, "Gesture recognition & Chanting assessment for Byzantine Music learning," in *Proc. 2nd International Conference on Advanced Research in Education*, Paris, France, 2019. *[complete volume/pages if available]*

[3] A. de Cheveigné, H. Kawahara, "YIN, a fundamental frequency estimator for speech and music," *The Journal of the Acoustical Society of America* 111(4), 1917–1930, 2002.

[4] C. Lugaresi, et al., "MediaPipe: A framework for building perception pipelines," arXiv:1906.08172, 2019.

[5] UNESCO, "Byzantine chant," inscribed 2019 on the Representative List of the Intangible Cultural Heritage of Humanity.

---

**Figures to prepare for submission:**

- **Figure 1.** Architecture diagram of the five subsystems (Section 3) and their data flow.
- **Figure 2.** Screenshot of the workspace: teacher panel, dual time-series graph with match indicators and score bars, student panel.
- **Figure 3.** Detail of the alignment bar during offset locking (scrub bars, nudge buttons, offset readout).
- **Figure 4.** Example session score bars after three takes of the same phrase (hand and voice).
