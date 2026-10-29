"""Draws Fig. 1 of the paper (architecture). Usage: python3 docs/figures/fig1_architecture.py"""
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
plt.rcParams.update({"font.family":"DejaVu Sans"})
W,H=13.0,9.3
fig=plt.figure(figsize=(W,H)); ax=fig.add_axes([0,0,1,1]); ax.set_xlim(0,W); ax.set_ylim(0,H); ax.axis("off")
cols=[("1  Input","#2b5c8a","#eef3f8",0.25),("2  Analysis","#3a7a48","#edf6ef",4.55),("3  Feedback","#7a4a8a","#f4eef7",8.85)]
cw=3.9
def box(x,y,h,title,lines,c,f):
    ax.add_patch(FancyBboxPatch((x,y),cw,h,boxstyle="round,pad=0,rounding_size=0.08",fc=f,ec=c,lw=1.6))
    ax.text(x+0.15,y+h-0.2,title,color=c,fontsize=12.5,fontweight="bold",va="top")
    for i,l in enumerate(lines): ax.text(x+0.15,y+h-0.62-0.33*i,l,fontsize=11,va="top",color="#1d2430")
    return (x,y,h)
ax.text(W/2,H-0.25,"Byzantine Gesture: architecture",ha="center",va="top",fontsize=15,fontweight="bold",color="#1d2430")
for t,c,f,x in cols:
    ax.add_patch(FancyBboxPatch((x,H-1.25),cw,0.48,boxstyle="round,pad=0,rounding_size=0.08",fc=c,ec=c))
    ax.text(x+cw/2,H-1.01,t,ha="center",va="center",color="white",fontsize=13,fontweight="bold")
c,f=cols[0][1],cols[0][2]; x=cols[0][3]
box(x,6.3,1.5,"Teacher reference",["Video file played in the browser","Audio through Web Audio (48 kHz)"],c,f)
stud=box(x,3.7,2.35,"Student source",["Live webcam (960 × 540) and microphone:","echo cancellation, noise suppression","and gain control off, 90 Hz high-pass","or a video file, or a take recorded","in the tool"],c,f)
c,f=cols[1][1],cols[1][2]; x=cols[1][3]
box(x,5.35,2.45,"Hand tracking · MediaPipe Hands",["One instance per side, 21 landmarks","Teacher every 90 ms (160 ms when live)","Student every 90 ms","Hand height → degree, Ni to Pa′","Smoothing: EMA in media time, τ ≈ 0.23 s"],c,f)
box(x,3.75,1.35,"Left-hand commands (live)",["Open palm: freeze · V sign: replay","Index finger: speed · Fist: play"],c,f)
box(x,1.8,1.7,"Pitch · YIN",["4,096-sample frames every 110 ms","Search range 65–1,000 Hz; RMS gate 0.003","Optional tonic Ni: degree labels"],c,f)
c,f=cols[2][1],cols[2][2]; x=cols[2][3]
b1=box(x,6.55,1.25,"Teacher guide",["Hand and voice curves stored","on a 25 Hz grid"],c,f)
b2=box(x,4.15,2.15,"Alignment",["Lock here sets the offset","Nudges of ±0.05 and ±0.25 s","Time link: re-seek above 80 ms,","playback rate 0.5–2× at 30–80 ms","Scores only while drift < 60 ms"],c,f)
b3=box(x,1.95,1.95,"Scoring",["Hand: 2.5 s window, medians removed,","Pearson r and MAD","Voice: cents to the teacher, folded to the","octave; exact ≤ 3 moria, close ≤ 9 moria"],c,f)
b4=box(x,0.5,1.2,"Display and recording",["Indicators, curves, session bars","Takes saved as WebM files"],c,f)
for (a,b) in [(b1,b2),(b2,b3),(b3,b4)]:
    ax.annotate("",xy=(a[0]+cw/2,b[1]+b[2]),xytext=(a[0]+cw/2,a[1]),arrowprops=dict(arrowstyle="-|>",color="#4a5160",lw=1.3))
for xa in (4.2,8.5):
    ax.annotate("",xy=(xa+0.3,5.0),xytext=(xa-0.02,5.0),arrowprops=dict(arrowstyle="simple,head_width=0.9,head_length=0.7,tail_width=0.45",fc="#9aa3ad",ec="none"))
# feedback loop: recorded take -> student source
yb=0.22; xs=0.25+cw/2; xe=8.85+cw/2
ax.plot([xe,xe],[0.5,yb],color="#7a4a8a",lw=1.3,ls="--"); ax.plot([xs,xe],[yb,yb],color="#7a4a8a",lw=1.3,ls="--")
ax.annotate("",xy=(xs,3.7),xytext=(xs,yb),arrowprops=dict(arrowstyle="-|>",color="#7a4a8a",lw=1.3,ls="--"))
ax.text((xs+xe)/2-1.2,yb+0.08,"a recorded take can be reloaded as the student source",ha="center",va="bottom",fontsize=10.5,style="italic",color="#7a4a8a",
        bbox=dict(fc="white",ec="none",pad=1))
fig.savefig(__import__("pathlib").Path(__file__).with_suffix(".png"),dpi=300)
