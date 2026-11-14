"""Draws Fig. 4 of the paper from bench/results.csv (run pitch-accuracy.mjs first).
Usage: python3 bench/plot_fig4.py  ->  bench/fig4_pitch_accuracy.png"""
import csv
from collections import defaultdict
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

here = Path(__file__).parent
errs = defaultdict(lambda: defaultdict(list))   # condition -> true_hz -> [error_cents or None]
for r in csv.DictReader(open(here / "results.csv")):
    errs[r["condition"]][float(r["true_hz"])].append(float(r["error_cents"]) if r["error_cents"] else None)

def share(cond, limit):
    vals = [e for v in errs[cond].values() for e in v]
    return 100 * sum(1 for e in vals if e is not None and abs(e) <= limit) / len(vals)

def per_freq(cond):
    f = sorted(errs[cond]); mean, lo, hi = [], [], []
    for x in f:
        a = [abs(e) for e in errs[cond][x] if e is not None]
        mean.append(sum(a) / len(a) if a else float("nan")); lo.append(min(a) if a else float("nan")); hi.append(max(a) if a else float("nan"))
    return f, mean, lo, hi

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 11})
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5.07), gridspec_kw={"width_ratios": [1.15, 1]})

f, m, _, _ = per_freq("voice")
f10, m10, lo10, hi10 = per_freq("voice10")
ax1.fill_between(f10, lo10, hi10, color="#9b2c2c", alpha=0.15, lw=0, label="min–max at 10 dB")
ax1.plot(f, m, color="#1f3a5f", lw=1.8, label="Voice-like tone (clean)")
ax1.plot(f10, m10, color="#9b2c2c", lw=1.5, label="Voice-like tone + 10 dB SNR")
ax1.axhline(50, color="#555", lw=0.8, ls="--"); ax1.text(990, 52, "50 cents", ha="right", va="bottom", fontsize=9, color="#555")
ax1.set(xlim=(60, 1000), ylim=(0, 65), xlabel="Frequency (Hz)", ylabel="Absolute error (cents)")
ax1.set_title("(a) Mean absolute error per frequency", fontweight="bold")
ax1.grid(alpha=0.3); ax1.legend(loc="upper left", fontsize=9.5)

conds = [("sine", "Pure sine"), ("voice", "Voice-like"), ("voice20", "+ 20 dB SNR"), ("voice10", "+ 10 dB SNR")]
x = range(len(conds)); w = 0.36
s10 = [share(c, 10) for c, _ in conds]; s50 = [share(c, 50) for c, _ in conds]
b1 = ax2.bar([i - w / 2 for i in x], s10, w, color="#2c7a7b", edgecolor="#1a1a1a", lw=0.6, label="within 10 cents")
b2 = ax2.bar([i + w / 2 for i in x], s50, w, color="#d4a65a", edgecolor="#1a1a1a", lw=0.6, label="within 50 cents")
for bars in (b1, b2):
    for b in bars:
        v = b.get_height(); lab = f"{v:.1f}".replace(".0", "")
        ax2.text(b.get_x() + b.get_width() / 2, v + 1, lab, ha="center", fontsize=9, fontweight="bold")
ax2.set_xticks(list(x)); ax2.set_xticklabels([l for _, l in conds], fontsize=10)
ax2.set(ylim=(0, 115), ylabel="Share of frames (%)")
ax2.set_title("(b) Share of frames within 10 and 50 cents", fontweight="bold")
ax2.grid(axis="y", alpha=0.3); ax2.legend(loc="lower left", fontsize=9.5, framealpha=0.95)

fig.tight_layout()
fig.savefig(here / "fig4_pitch_accuracy.png", dpi=300)
print("saved", here / "fig4_pitch_accuracy.png")
