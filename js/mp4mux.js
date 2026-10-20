/* ===================== mp4mux.js — monta arquivo .mp4 (H.264 + AAC), formato padrão do YouTube ===================== */
'use strict';

class Mp4Mux {
  // o = { video: { width, height, fps }, audio: { sampleRate, channels } | null }
  constructor(o) {
    this.o = o; this.v = []; this.a = []; this.vKeys = []; this.aDur = [];
    this.vts = 90000; this.vDelta = Math.round(90000 / o.video.fps);
    this.avcC = null; this.asc = null;
  }
  setVideoConfig(d) { if (d && d.length) this.avcC = d; }
  setAudioConfig(d) { if (d && d.length) this.asc = d; }
  addVideo(data, key) { this.v.push(data); if (key) this.vKeys.push(this.v.length); }
  addAudio(data, dur = 1024) { this.a.push(data); this.aDur.push(dur); }

  /* ---------- ajudantes de bytes ---------- */
  static cat(parts) { let n = 0; for (const p of parts) n += p.length; const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; }
  static u8(v) { return Uint8Array.of(v & 255); }
  static u16(v) { return Uint8Array.of((v >> 8) & 255, v & 255); }
  static u32(v) { return Uint8Array.of((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); }
  static str(s) { return Uint8Array.from(s, c => c.charCodeAt(0)); }
  static zeros(n) { return new Uint8Array(n); }
  static box(type, ...parts) { const body = Mp4Mux.cat(parts.flat()); return Mp4Mux.cat([Mp4Mux.u32(body.length + 8), Mp4Mux.str(type), body]); }
  static full(type, version, flags, ...parts) { return Mp4Mux.box(type, Mp4Mux.u32((version << 24) | flags), ...parts); }
  static matrix() { const { u32 } = Mp4Mux; return [u32(0x10000), u32(0), u32(0), u32(0), u32(0x10000), u32(0), u32(0), u32(0), u32(0x40000000)]; }

  ascFallback() {
    const sr = this.o.audio.sampleRate, ch = this.o.audio.channels;
    const idx = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350].indexOf(sr);
    const f = idx < 0 ? 3 : idx;
    return Uint8Array.of((2 << 3) | (f >> 1), ((f & 1) << 7) | (ch << 3));
  }

  /* ---------- caixas ---------- */
  stblVideo(offsets) {
    const { box, full, u16, u32, zeros, str, cat } = Mp4Mux, W = this.o.video.width, H = this.o.video.height, n = this.v.length;
    const avc1 = box('avc1', zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(W), u16(H), u32(0x480000), u32(0x480000), u32(0), u16(1),
      cat([Uint8Array.of(16), str('Estudio Problems'), zeros(15)]), u16(0x18), u16(0xffff), box('avcC', this.avcC || new Uint8Array(0)));
    const stsd = full('stsd', 0, 0, u32(1), avc1);
    const stts = full('stts', 0, 0, u32(1), u32(n), u32(this.vDelta));
    const stss = full('stss', 0, 0, u32(this.vKeys.length), this.vKeys.map(k => u32(k)));
    const stsc = full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1));
    const stsz = full('stsz', 0, 0, u32(0), u32(n), this.v.map(s => u32(s.length)));
    const stco = full('stco', 0, 0, u32(n), offsets.map(o => u32(o)));
    return box('stbl', stsd, stts, stss, stsc, stsz, stco);
  }
  stblAudio(offsets) {
    const { box, full, u8, u16, u32, zeros, cat } = Mp4Mux, n = this.a.length, sr = this.o.audio.sampleRate, ch = this.o.audio.channels;
    const asc = this.asc || this.ascFallback();
    const dsi = cat([u8(0x05), u8(asc.length), asc]);
    const dcd = cat([u8(0x04), u8(13 + dsi.length), u8(0x40), u8(0x15), zeros(3), u32(192000), u32(192000), dsi]);
    const sl = Uint8Array.of(0x06, 0x01, 0x02);
    const esd = cat([u8(0x03), u8(3 + dcd.length + sl.length), u16(1), u8(0), dcd, sl]);
    const mp4a = box('mp4a', zeros(6), u16(1), zeros(8), u16(ch), u16(16), u16(0), u16(0), u32(sr * 65536 >>> 0), full('esds', 0, 0, esd));
    // durações agrupadas
    const runs = []; for (const d of this.aDur) { const r = runs[runs.length - 1]; if (r && r[1] === d) r[0]++; else runs.push([1, d]); }
    return box('stbl', full('stsd', 0, 0, u32(1), mp4a), full('stts', 0, 0, u32(runs.length), runs.map(([c, d]) => [u32(c), u32(d)]).flat()),
      full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)), full('stsz', 0, 0, u32(0), u32(n), this.a.map(s => u32(s.length))), full('stco', 0, 0, u32(n), offsets.map(o => u32(o))));
  }
  trak(id, kind, durTs, ts, movieDur, stbl) {
    const { box, full, u16, u32, zeros, str, cat } = Mp4Mux, vid = kind === 'vide';
    const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(movieDur), zeros(8), u16(0), u16(0), u16(vid ? 0 : 0x100), u16(0), Mp4Mux.matrix(),
      u32(vid ? this.o.video.width * 65536 >>> 0 : 0), u32(vid ? this.o.video.height * 65536 >>> 0 : 0));
    const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(durTs), u16(0x55c4), u16(0));
    const hdlr = full('hdlr', 0, 0, u32(0), str(kind), zeros(12), cat([str(vid ? 'VideoHandler' : 'SoundHandler'), zeros(1)]));
    const mh = vid ? full('vmhd', 0, 1, u16(0), zeros(6)) : full('smhd', 0, 0, u16(0), u16(0));
    const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
    return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', mh, dinf, stbl)));
  }
  moov(vOff, aOff) {
    const { full, box, u16, u32, zeros } = Mp4Mux;
    const vDurTs = this.v.length * this.vDelta, vDurMs = Math.round(vDurTs / this.vts * 1000);
    const hasA = this.o.audio && this.a.length, aDurTs = this.aDur.reduce((s, d) => s + d, 0), aDurMs = hasA ? Math.round(aDurTs / this.o.audio.sampleRate * 1000) : 0;
    const movieDur = Math.max(vDurMs, aDurMs);
    const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(movieDur), u32(0x10000), u16(0x100), zeros(10), Mp4Mux.matrix(), zeros(24), u32(hasA ? 3 : 2));
    const traks = [this.trak(1, 'vide', vDurTs, this.vts, vDurMs, this.stblVideo(vOff))];
    if (hasA) traks.push(this.trak(2, 'soun', aDurTs, this.o.audio.sampleRate, aDurMs, this.stblAudio(aOff)));
    return box('moov', mvhd, ...traks);
  }
  finish() {
    const { box, u32, str, cat } = Mp4Mux;
    const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
    const zv = this.v.map(() => 0), za = this.a.map(() => 0);
    const moovSize = this.moov(zv, za).length; // o tamanho não muda com os valores
    let off = ftyp.length + moovSize + 8;
    const vOff = this.v.map(s => { const o = off; off += s.length; return o; });
    const aOff = this.a.map(s => { const o = off; off += s.length; return o; });
    const mdatSize = off - ftyp.length - moovSize;
    if (off > 0xffffffff) throw new Error('Vídeo grande demais (mais de 4 GB). Exporte em partes ou numa resolução menor.');
    const moov = this.moov(vOff, aOff);
    return new Blob([ftyp, moov, cat([u32(mdatSize), str('mdat')]), ...this.v, ...this.a], { type: 'video/mp4' });
  }
}
if (typeof module !== 'undefined') module.exports = Mp4Mux;
