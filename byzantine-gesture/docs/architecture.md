# Architecture

## Runtime model

Everything runs client-side in a single page (`src/index.html`). There is no
server; video files are read with `<input type=file>` / `URL.createObjectURL`
and recordings are held as in-memory Blobs.

```
 teacher video ──▶ MediaPipe Hands ──▶ conducting-hand Y ──▶ scale degree ──▶ tHandS / guideHand
        │                                                          │
        └─▶ WebAudio ──▶ YIN detectPitch ──▶ Hz ──▶ cents vs tonic ┤
                                                                    ▼
 student (live cam │ file │ recording) ──▶ same pipeline ──▶ sHandS / sVoiceS
                                                                    ▼
                    alignment:  t_student = t_teacher + offset  (linked transport)
                                                                    ▼
        evaluation:  Pearson shape window (hand) · folded-cent bands (voice)
                                                                    ▼
                        score bars + match indicators
```

## Alignment

`offset = t_markStudent − t_markTeacher`, set either by the ΚΛΕΙΔΩΜΑ ΕΔΩ
button (both clocks frozen at the same musical event) or by two independent
marks (ΣΗΜΕΙΟ Δ / ΣΗΜΕΙΟ Μ). With ΣΥΝΔΕΣΗ ΧΡΟΝΟΥ enabled, every teacher
play/pause/seek is mirrored to the student; a drift corrector re-seeks the student when the clocks diverge by more than 80 ms and
nudges `playbackRate` within [0.5, 2] for drifts between 30 and 80 ms. Evaluation is
enabled only while the drift stays below 60 ms.

Recorded takes store `teacherT0` (teacher clock at the moment REC started),
so replaying a take sets `offset = −teacherT0` automatically.

## Hand → pitch mapping

In the teacher video, in a student video file, and while a live take is being
recorded, the *highest detected hand* is the conducting hand. In live mode outside
recording, the hand on the right of the image as shown on screen conducts and the hand on the
left gives the transport commands (`classifyGesture`); the commands are off while
recording, so that a gesture cannot stop a take. The midpoint of wrist (0)
and middle-MCP (9) is converted to a continuous scale degree by
`yToNoteF`, an EMA (α = 0.32) smooths it, and the result is stored on the
shared master timeline — which is why alignment matters: evaluation compares
samples *at the same musical time*, not the same wall-clock time.

## Voice

YIN pitch detection runs on 4096-sample frames from an `AnalyserNode`. The audio context is
opened at 48 kHz (the device rate is used only if the browser refuses), so the detector runs
with the same settings as the benchmark in `bench/`. The search range is 65–1,000 Hz.
Frequencies are mapped to scale degrees against the user-set tonic
(ΝΗ button; Chrysanthine diatonic scale, 12-10-8-12-12-10-8 moria, 72 per octave, `BYZ_MORIA`/`BYZ_CENTS`). Student–teacher deviation
is measured in cents folded to the nearest octave (so within ±600 ¢); |¢| ≤ 50 is "exact",
≤ 150 "close", otherwise "off". Differences above 400 ¢ are treated as detection errors and
not scored, and so are frames where either pitch is not yet stable.

## Hand shape score

Over a 2.5 s trailing window, teacher and student scale-degree series are
median-centred and compared with the mean absolute difference and the
Pearson correlation. `r ≥ 0.60 & MAD < 0.8` (or `MAD < 0.45`) is "exact",
`r ≥ 0.35` (or `MAD < 1.1`) is "close"; anti-correlated shapes are always
"off". Register offset (μητρώο) and range ratio are reported as
informational metrics.

## Session log and evaluation card

Every scored contour window and voice frame is also appended to a session log (`SL`) with the teacher time, so that the evaluation card can draw a timeline and compute
summaries (bands, mean and signed deviation, coverage, offset-corrected exact share). The summary and banding helpers live between the
`BEGIN_SCORING_MIRROR` / `END_SCORING_MIRROR` markers of `src/index.html`; `lib/core.mjs` holds the same logic and `tests/mirror.test.mjs` checks that both agree.
Scores are accumulated only when `framesInSync()` holds (drift below 60 ms; always true in LIVE mode). Voice limits are `VOICE_EXACT_C` (50) and `VOICE_CLOSE_C` (150),
overridable with the `voiceExact` and `voiceClose` URL parameters.

## Recording lock and take alignment

`recBusy()` is true from the moment REC is pressed until the recording stops. In that period `triggerGesture` does nothing, the teacher transport and speed handlers return immediately,
the teacher is forced to ×1.0 at the start, and `applyStudentHands` uses the same `pickConductingHand` branch as for recorded files, so only the green skeleton is drawn.
`armTeacherLag()` measures the seconds between the `start` event of the MediaRecorder and the first presented teacher frame (`requestVideoFrameCallback`, or the `playing` event as a fallback);
`finalizeTake` stores it as `take.lag` and `applyTakeSync` uses it as the offset of the take.

## Time stamps of hand results

MediaPipe answers some hundreds of milliseconds (seconds, on a slow computer) after a frame is sent. A result used to be stamped with the clock at the moment it arrived, which shifted
the hand curve of the student, and the guide recorded from the teacher, by that delay. `sendHands` and the live camera loop now push the time of the frame into a small queue
(`pushStamp`), and the result handlers take it back (`takeStamp`), so every sample carries the time of the frame that was analysed. The average delay per stream is shown in the evaluation card
(`hand-tracking delay (teacher / student)`).
