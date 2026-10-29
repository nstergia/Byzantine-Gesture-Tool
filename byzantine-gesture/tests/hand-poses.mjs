// Hand poses for the gesture tests: approximate MediaPipe landmark layouts in hand units
// (wrist at 0,0; y down; wrist to middle fingertip about 0.9), placed in a 960 x 540 frame
// at a chosen size in pixels, rotation and landmark noise.
// Realistic hand poses in hand units (wrist at 0,0; y down; wrist→middle tip ≈ 0.9)
const MCP={i:[-.12,-.45],m:[0,-.47],r:[.11,-.44],p:[.21,-.39]};
const ext={i:[[-.14,-.62],[-.15,-.73],[-.16,-.83]], m:[[0,-.66],[0,-.78],[0,-.90]],
           r:[[.12,-.61],[.13,-.71],[.14,-.80]],   p:[[.24,-.52],[.26,-.60],[.28,-.67]]};
const curl={i:[[-.13,-.55],[-.12,-.46],[-.11,-.38]], m:[[0,-.57],[.01,-.47],[.01,-.39]],
            r:[[.11,-.54],[.11,-.45],[.10,-.38]],   p:[[.21,-.48],[.20,-.41],[.19,-.35]]};
const thumbOut=[[-.18,-.10],[-.30,-.22],[-.38,-.33],[-.45,-.43]];
const thumbIn =[[-.15,-.10],[-.22,-.20],[-.17,-.30],[-.08,-.34]];   // across the palm
export function pose(name){
  const f={i:'e',m:'e',r:'e',p:'e'}; let th=thumbOut;
  if(name==='fist'){ Object.keys(f).forEach(k=>f[k]='c'); th=thumbIn; }
  if(name==='palm-thumbin'){ th=[[-.16,-.10],[-.24,-.21],[-.26,-.31],[-.25,-.40]]; }   // fingers open, thumb close to index
  if(name==='v'){ f.r='c'; f.p='c'; th=thumbIn; }
  if(name==='index'){ f.m='c'; f.r='c'; f.p='c'; th=thumbIn; }
  const pts=[[0,0],...th];
  for(const k of ['i','m','r','p']) pts.push(MCP[k], ...(f[k]==='e'?ext[k]:curl[k]));
  if(name==='ok'){ // index curls to touch the thumb tip, others open
    pts[5]=MCP.i; pts[6]=[-.20,-.58]; pts[7]=[-.27,-.55]; pts[8]=[-.30,-.48];
    pts[1]=[-.18,-.10]; pts[2]=[-.27,-.22]; pts[3]=[-.31,-.35]; pts[4]=[-.31,-.46];
  }
  return pts;
}
export function place(pts, handPx, rotDeg, noise, rnd, W=960, H=540){
  const a=rotDeg*Math.PI/180, c=Math.cos(a), s=Math.sin(a);
  const g=()=> (rnd()-0.5)*2*noise;
  return pts.map(([x,y])=>{ const xr=x*c-y*s+g(), yr=x*s+y*c+g();
    return {x:0.25+xr*handPx/W, y:0.65+yr*handPx/H, z:0}; });
}
