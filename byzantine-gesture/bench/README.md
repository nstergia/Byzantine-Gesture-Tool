# Pitch-detector benchmark (Section 3.2)

```
node bench/pitch-accuracy.mjs > bench/summary.json   # writes bench/results.csv
python3 bench/plot_fig4.py                          # draws bench/fig4_pitch_accuracy.png (needs matplotlib)
```

Synthetic signals at 48 kHz, 4,096-sample frames, 95 quarter-tone steps from 65 to 982 Hz,
five frames each: a pure sine, a voice-like tone (eight harmonics, amplitude 1/h, random phases),
and the same tone with white noise at 20 dB and 10 dB SNR. The random seed is fixed, so every run
gives the same numbers.
