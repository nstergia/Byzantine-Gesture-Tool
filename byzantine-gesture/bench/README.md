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
