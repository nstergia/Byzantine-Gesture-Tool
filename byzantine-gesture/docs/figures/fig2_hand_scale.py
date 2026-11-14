"""Draws Fig. 2 of the paper (hand axis vs. Chrysanthine scale). Usage: python3 docs/figures/fig2_hand_scale.py"""
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
names=["Ni","Pa","Vou","Ga","Di","Ke","Zo","Ni′","Pa′"]
moria=[0,12,22,30,42,54,64,72,84]          # = BYZ_MORIA in lib/core.mjs
plt.rcParams.update({"font.family":"DejaVu Sans","font.size":11})
fig,ax=plt.subplots(figsize=(7.2,5.2))
xL,xR=0.0,1.0
yl=[i/8 for i in range(9)]                  # hand axis: equal steps
yr=[m/84 for m in moria]                    # moria axis: true interval sizes
c_line="#41597a"
for x in (xL,xR): ax.plot([x,x],[0,1],color="#222",lw=1.4)
for i,n in enumerate(names):
    ax.plot([xL,xR],[yl[i],yr[i]],color="#9aa7b8",lw=0.9,ls=(0,(3,2)),zorder=1)
    ax.plot([xL-0.03,xL+0.03],[yl[i]]*2,color="#222",lw=1.4)
    ax.plot([xR-0.03,xR+0.03],[yr[i]]*2,color="#222",lw=1.4)
    ax.text(xL-0.06,yl[i],n,ha="right",va="center",fontsize=12,fontweight="bold")
    ax.text(xR+0.06,yr[i],n,ha="left",va="center",fontsize=12,fontweight="bold")
for i in range(8):
    ax.text(xR-0.07,(yr[i]+yr[i+1])/2,str(moria[i+1]-moria[i]),ha="right",va="center",fontsize=10,color="#7a3e00")
ax.annotate("",xy=(-0.42,0.95),xytext=(-0.42,0.05),arrowprops=dict(arrowstyle="-|>",color="#444",lw=1.2))
ax.text(-0.47,0.5,"hand higher in the frame",rotation=90,ha="center",va="center",fontsize=10,color="#444")
ax.text(xL,1.08,"Hand axis\n(equal steps; frame height 4–96%)",ha="center",va="bottom",fontsize=10.5,fontweight="bold")
ax.text(xR,1.08,"Chrysanthine diatonic scale\n(interval sizes in moria)",ha="center",va="bottom",fontsize=10.5,fontweight="bold")
ax.text(0.5,-0.09,"1 moria = 1/72 octave ≈ 16.7 cents;  Ni–Pa′ = 84 moria",ha="center",va="top",fontsize=9.5,color="#444")
ax.set_xlim(-0.55,1.35); ax.set_ylim(-0.14,1.22); ax.axis("off")
fig.tight_layout(); fig.savefig(__import__("pathlib").Path(__file__).with_suffix(".png"),dpi=300)
