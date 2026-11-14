# Pitch-detector benchmark (Section 3.2)

```
node bench/pitch-accuracy.mjs > bench/summary.json   # writes bench/results.csv
python3 bench/plot_fig4.py                          # draws bench/fig4_pitch_accuracy.png (needs matplotlib)
```

Synthetic signals at 48 kHz, 4,096-sample frames, 95 quarter-tone steps from 65 to 982 Hz,
five frames each: a pure sine, a voice-like tone (eight harmonics, amplitude 1/h, random phases),
and the same tone with white noise at 20 dB and 10 dB SNR. The random seed is fixed, so every run
gives the same numbers.

# Hand-contour negative control (Section 3)

```
node bench/hand-control.mjs > bench/hand-control.json
```

Synthetic 2.5 s windows built as in the application (28 student samples every 90 ms, medians
removed, Pearson r and MAD), with teacher movement of 0.3, 0.6 and 1.0 scale degrees (SD).
The student hand follows the teacher (150 ms late, with tracking noise), follows with a range
2.4 times wider, is held still, moves independently, or moves in the opposite direction.
Each window is graded with the current rule and with the rule of versions 1.0.0-1.0.3.
2,000 windows per condition; the seed is fixed.

# Hand-contour self-agreement (Section 3)

```
node bench/self-agreement.mjs > bench/self-agreement.json
```

The teacher's video compared with itself. The two trackers see the same hand but drop frames
independently (probabilities 0/0, 0.1/0.1, 0.1/0.35 and 0.3/0.3 for teacher/student), with
landmark noise SD 0.02 degrees; 20 synthetic contours of 120 s. The hand is smoothed either per
tracked frame (as up to the 1.1.0 development version) or in media time (`emaStep`, current).

# Pitch detector against pYIN on real voices (Section 3.2)

```
python3 bench/pyin_compare.py samples/teacher.mp4 samples/student_C_s1_take1_audio.webm samples/student_C_s1_take2_audio.webm samples/student_take.mp4 samples/student_B.mp4 samples/student_C.mp4 > bench/pyin-compare.json
```

Requires ffmpeg, Node.js 18+ and Python 3 with librosa. Both detectors run on the same 4,096-sample
frames every 110 ms; frames voiced in both are compared in cents. pYIN serves as a reference, not as
ground truth. `harmonicErrors` counts frames more than 600 cents apart (the detector locked onto a
harmonic); `within50AfterOctaveFolding` is the share within 50 cents once differences are folded to
the nearest octave, as the voice score does. `onlyYIN` and `onlyPYIN` count frames in which only one
detector found a pitch; they are left out of the comparison. `student_B.mp4` is the blurred,
re-encoded copy of student B's take; its values differ from those of the original video by one frame
or less.

# Time of one pitch detection

```
node bench/yin-timing.mjs
```

Times `detectPitch` on 4,096-sample frames at 48 kHz (2,000 runs after warm-up) and reports the share
of the main thread it takes at the application's rate (two detections every 110 ms). In the browser,
`?perf=1` reports the same quantity for a real session, together with hand-tracking delay and frame rate.

# Sensitivity of the hand rule to its thresholds

```
node bench/hand-sensitivity.mjs > bench/hand-sensitivity.json
```

Moves each threshold of the hand rule (r 0.60 and 0.35, MAD 0.8 and 0.45) one step down and one step up
while the others keep their defaults, and reports the share of exact windows for a following, an
unrelated, a still and an opposite hand (teacher SD 0.3, 0.6 and 1.0 degrees pooled). Under every
variant a following hand stays at 96-100% exact, an unrelated hand at 15-17%, and still and opposite
hands at 0%.
