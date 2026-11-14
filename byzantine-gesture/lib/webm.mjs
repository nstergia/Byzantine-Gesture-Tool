// Make a WebM file written by MediaRecorder seekable.
//
// Chrome and Edge write WebM takes as a live stream: the Segment and the Clusters have "unknown"
// size, and there is neither a Duration nor a Cues index. Such a file plays from the start, but a
// browser cannot jump inside it reliably, so a downloaded take could not follow the time link when
// reloaded. fixWebm() rewrites only the container: Segment and Clusters get their real sizes, Info
// gets a Duration, and a Cues element (one cue per cluster that starts with a video key frame) is
// placed before the clusters. Every frame (SimpleBlock/BlockGroup) is copied byte for byte.
// The function works on a Uint8Array and has no dependencies, so it runs in the browser and in Node.

const ID = {
  EBML: 0x1a45dfa3, Segment: 0x18538067, SeekHead: 0x114d9b74, Info: 0x1549a966, Tracks: 0x1654ae6b,
  Cluster: 0x1f43b675, Cues: 0x1c53bb6b, Tags: 0x1254c367, Chapters: 0x1043a770, Attachments: 0x1941a469,
  Void: 0xec, TimestampScale: 0x2ad7b1, Duration: 0x4489, TrackEntry: 0xae, TrackNumber: 0xd7, TrackType: 0x83,
  Timestamp: 0xe7, SimpleBlock: 0xa3, BlockGroup: 0xa0, Block: 0xa1,
  CuePoint: 0xbb, CueTime: 0xb3, CueTrackPositions: 0xb7, CueTrack: 0xf7, CueClusterPosition: 0xf1,
};
const SEGMENT_LEVEL = new Set([ID.SeekHead, ID.Info, ID.Tracks, ID.Cluster, ID.Cues, ID.Tags, ID.Chapters, ID.Attachments, ID.EBML, ID.Segment]);

function readId(b, p) {
  const first = b[p];
  if (first === undefined) return null;
  let len = 1;
  for (let mask = 0x80; len <= 4 && !(first & mask); mask >>= 1) len++;
  if (len > 4 || p + len > b.length) return null;
  let id = 0;
  for (let i = 0; i < len; i++) id = id * 256 + b[p + i];
  return { id, len };
}
function readSize(b, p) {
  const first = b[p];
  if (first === undefined) return null;
  let len = 1;
  for (let mask = 0x80; len <= 8 && !(first & mask); mask >>= 1) len++;
  if (len > 8 || p + len > b.length) return null;
  let v = first & (0xff >> len), allOnes = v === (0xff >> len);
  for (let i = 1; i < len; i++) { v = v * 256 + b[p + i]; if (b[p + i] !== 0xff) allOnes = false; }
  return { size: allOnes ? -1 : v, len };
}
function readUint(b, p, n) { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[p + i]; return v; }

function idBytes(id) {
  const out = [];
  while (id > 0) { out.unshift(id & 0xff); id = Math.floor(id / 256); }
  return out;
}
function size8(n) {                       // 8-byte EBML size: 0x01 followed by 7 bytes
  const out = [0x01];
  for (let i = 6; i >= 0; i--) out.push(Math.floor(n / 2 ** (8 * i)) & 0xff);
  return out;
}
function uint8(n) { const out = []; for (let i = 7; i >= 0; i--) out.push(Math.floor(n / 2 ** (8 * i)) & 0xff); return out; }
function element(id, payload) { return [...idBytes(id), ...size8(payload.length), ...payload]; }

/** Parse the children of an element with known bounds [start, end). */
function children(b, start, end) {
  const out = [];
  let p = start;
  while (p < end) {
    const id = readId(b, p); if (!id) break;
    const sz = readSize(b, p + id.len); if (!sz || sz.size < 0) break;
    const data = p + id.len + sz.len;
    if (data + sz.size > end) break;
    out.push({ id: id.id, start: p, data, end: data + sz.size });
    p = data + sz.size;
  }
  return out;
}

/** Returns a seekable copy of a WebM file, or the input unchanged if it is not a WebM it understands. */
export function fixWebm(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const h = readId(b, 0);
  if (!h || h.id !== ID.EBML) return b;
  const hs = readSize(b, h.len);
  const headerEnd = h.len + hs.len + hs.size;
  const sid = readId(b, headerEnd);
  if (!sid || sid.id !== ID.Segment) return b;
  const ss = readSize(b, headerEnd + sid.len);
  let p = headerEnd + sid.len + ss.len;
  const segEnd = ss.size < 0 ? b.length : Math.min(b.length, p + ss.size);

  let info = null, tracks = null; const clusters = [], others = [];
  while (p < segEnd) {
    const id = readId(b, p); if (!id) break;
    const sz = readSize(b, p + id.len); if (!sz) break;
    const data = p + id.len + sz.len;
    let end;
    if (sz.size >= 0) end = Math.min(data + sz.size, segEnd);
    else {                                 // unknown size (a live Cluster): ends at the next segment-level element
      end = data;
      while (end < segEnd) {
        const cid = readId(b, end); if (!cid || SEGMENT_LEVEL.has(cid.id)) break;
        const csz = readSize(b, end + cid.len); if (!csz || csz.size < 0) break;
        const next = end + cid.len + csz.len + csz.size;
        if (next > segEnd) break;          // truncated last element: drop it
        end = next;
      }
    }
    const el = { id: id.id, start: p, data, end };
    if (id.id === ID.Info) info = el;
    else if (id.id === ID.Tracks) tracks = el;
    else if (id.id === ID.Cluster) clusters.push(el);
    else if (id.id !== ID.SeekHead && id.id !== ID.Cues && id.id !== ID.Void) others.push(el);
    if (end <= p) break;
    p = end;
  }
  if (!info || !tracks || !clusters.length) return b;

  // timestamp scale and the video track
  let scale = 1000000;
  for (const c of children(b, info.data, info.end)) if (c.id === ID.TimestampScale) scale = readUint(b, c.data, c.end - c.data);
  let videoTrack = null;
  for (const te of children(b, tracks.data, tracks.end)) {
    if (te.id !== ID.TrackEntry) continue;
    let num = null, type = null;
    for (const c of children(b, te.data, te.end)) {
      if (c.id === ID.TrackNumber) num = readUint(b, c.data, c.end - c.data);
      if (c.id === ID.TrackType) type = readUint(b, c.data, c.end - c.data);
    }
    if (type === 1 && videoTrack === null) videoTrack = num;
  }

  // cluster contents, last timestamp, key-frame clusters
  let lastT = 0; const frameGaps = []; let prevVideoT = null;
  for (const cl of clusters) {
    cl.kids = children(b, cl.data, cl.end);
    cl.t = 0; cl.key = false;
    for (const k of cl.kids) if (k.id === ID.Timestamp) cl.t = readUint(b, k.data, k.end - k.data);
    let firstVideoSeen = false;
    for (const k of cl.kids) {
      let blk = null, isSimple = false;
      if (k.id === ID.SimpleBlock) { blk = k; isSimple = true; }
      else if (k.id === ID.BlockGroup) blk = children(b, k.data, k.end).find((x) => x.id === ID.Block) || null;
      if (!blk) continue;
      const tn = readSize(b, blk.data); if (!tn) continue;
      const rel = ((b[blk.data + tn.len] << 8) | b[blk.data + tn.len + 1]) << 16 >> 16;
      const t = cl.t + rel;
      if (t > lastT) lastT = t;
      if (tn.size === videoTrack) {
        if (prevVideoT !== null && t > prevVideoT) frameGaps.push(t - prevVideoT);
        prevVideoT = t;
        if (!firstVideoSeen) { firstVideoSeen = true; cl.key = isSimple ? (b[blk.data + tn.len + 2] & 0x80) !== 0 : true; }
      }
    }
  }
  frameGaps.sort((x, y) => x - y);
  const lastFrame = frameGaps.length ? frameGaps[Math.floor(frameGaps.length / 2)] : 0;
  const duration = lastT + lastFrame;                 // in timestamp-scale units

  // Info with Duration (float64)
  const infoKids = children(b, info.data, info.end).filter((c) => c.id !== ID.Duration);
  const dv = new DataView(new ArrayBuffer(8)); dv.setFloat64(0, duration);
  const infoPayload = [];
  for (const c of infoKids) infoPayload.push(...b.subarray(c.start, c.end));
  infoPayload.push(...idBytes(ID.Duration), 0x88, ...new Uint8Array(dv.buffer));
  const infoBytes = element(ID.Info, infoPayload);
  const tracksBytes = Array.from(b.subarray(tracks.start, tracks.end));

  // clusters re-written with their real sizes
  const clusterBytes = clusters.map((cl) => {
    const payload = b.subarray(cl.kids.length ? cl.kids[0].start : cl.data, cl.kids.length ? cl.kids[cl.kids.length - 1].end : cl.data);
    return { head: [...idBytes(ID.Cluster), ...size8(payload.length)], payload, t: cl.t, key: cl.key };
  });

  // Cues before the clusters: fixed-size entries, so the layout is known before positions are filled in
  const cueTargets = clusterBytes.filter((c) => c.key || videoTrack === null);
  const cueTrack = videoTrack === null ? 1 : videoTrack;
  const cuePointLen = (() => {
    const ctp = element(ID.CueTrackPositions, [...idBytes(ID.CueTrack), 0x81, cueTrack, ...idBytes(ID.CueClusterPosition), 0x88, ...uint8(0)]);
    return element(ID.CuePoint, [...idBytes(ID.CueTime), 0x88, ...uint8(0), ...ctp]).length;
  })();
  const cuesLen = idBytes(ID.Cues).length + 8 + cuePointLen * cueTargets.length;
  let pos = infoBytes.length + tracksBytes.length + cuesLen;
  for (const c of clusterBytes) { c.pos = pos; pos += c.head.length + c.payload.length; }
  const cuesPayload = [];
  for (const c of cueTargets) {
    const ctp = element(ID.CueTrackPositions, [...idBytes(ID.CueTrack), 0x81, cueTrack, ...idBytes(ID.CueClusterPosition), 0x88, ...uint8(c.pos)]);
    cuesPayload.push(...element(ID.CuePoint, [...idBytes(ID.CueTime), 0x88, ...uint8(c.t), ...ctp]));
  }
  const cuesBytes = element(ID.Cues, cuesPayload);

  let segDataLen = infoBytes.length + tracksBytes.length + cuesBytes.length;
  for (const c of clusterBytes) segDataLen += c.head.length + c.payload.length;
  for (const o of others) segDataLen += o.end - o.start;
  const segHead = [...idBytes(ID.Segment), ...size8(segDataLen)];

  const total = headerEnd + segHead.length + segDataLen;
  const out = new Uint8Array(total);
  let w = 0;
  const put = (arr) => { out.set(arr, w); w += arr.length; };
  put(b.subarray(0, headerEnd)); put(segHead); put(infoBytes); put(tracksBytes); put(cuesBytes);
  for (const c of clusterBytes) { put(c.head); put(c.payload); }
  for (const o of others) put(b.subarray(o.start, o.end));
  return out;
}

/** Duration in seconds written in a WebM file's Info, or null (used by the tests). */
export function webmDuration(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const h = readId(b, 0); if (!h || h.id !== ID.EBML) return null;
  const hs = readSize(b, h.len); const headerEnd = h.len + hs.len + hs.size;
  const sid = readId(b, headerEnd); const ss = readSize(b, headerEnd + sid.len);
  const start = headerEnd + sid.len + ss.len, end = ss.size < 0 ? b.length : start + ss.size;
  let p = start;
  while (p < end) {
    const id = readId(b, p); const sz = readSize(b, p + id.len); if (!id || !sz || sz.size < 0) return null;
    const data = p + id.len + sz.len;
    if (id.id === ID.Info) {
      let scale = 1000000, dur = null;
      for (const c of children(b, data, data + sz.size)) {
        if (c.id === ID.TimestampScale) scale = readUint(b, c.data, c.end - c.data);
        if (c.id === ID.Duration) { const v = new DataView(b.buffer, b.byteOffset + c.data, c.end - c.data); dur = c.end - c.data === 8 ? v.getFloat64(0) : v.getFloat32(0); }
      }
      return dur === null ? null : dur * scale / 1e9;
    }
    p = data + sz.size;
  }
  return null;
}

/** Frames of a WebM file as {track, time, bytes} in file order (used by the tests). */
export function listBlocks(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  const fixed = fixWebm(b);                   // parse through the same code path with known sizes
  const h = readId(fixed, 0); const hs = readSize(fixed, h.len); const headerEnd = h.len + hs.len + hs.size;
  const sid = readId(fixed, headerEnd); const ss = readSize(fixed, headerEnd + sid.len);
  const start = headerEnd + sid.len + ss.len, end = start + ss.size, out = [];
  for (const el of children(fixed, start, end)) {
    if (el.id !== ID.Cluster) continue;
    const kids = children(fixed, el.data, el.end);
    let ct = 0;
    for (const k of kids) if (k.id === ID.Timestamp) ct = readUint(fixed, k.data, k.end - k.data);
    for (const k of kids) {
      if (k.id !== ID.SimpleBlock && k.id !== ID.BlockGroup) continue;
      const blk = k.id === ID.SimpleBlock ? k : children(fixed, k.data, k.end).find((x) => x.id === ID.Block);
      if (!blk) continue;
      const tn = readSize(fixed, blk.data);
      const rel = ((fixed[blk.data + tn.len] << 8) | fixed[blk.data + tn.len + 1]) << 16 >> 16;
      out.push({ track: tn.size, time: ct + rel, bytes: fixed.slice(blk.data, blk.end) });
    }
  }
  return out;
}

/** True if the file has a Cues index (used by the tests). */
export function hasCues(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  for (let i = 0; i + 4 <= b.length; i++) if (b[i] === 0x1c && b[i + 1] === 0x53 && b[i + 2] === 0xbb && b[i + 3] === 0x6b) return true;
  return false;
}
