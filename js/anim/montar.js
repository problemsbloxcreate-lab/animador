/* ===================== anim/montar.js — montar o boneco sozinho =====================
   Entrada: a imagem do personagem INTEIRO (referência) + as PARTES separadas (arquivos soltos ou uma folha).
   1) acha onde cada parte fica na referência (comparando os pixels — funciona mesmo com partes escondidas atrás de outras)
   2) junta desenhos alternativos da mesma parte (boca A/B/C, olho aberto/fechado…) num só nó com troca de desenho
   3) descobre quem é pai de quem (pelo nome e pela posição), o pivô de cada junta e a ordem (quem fica na frente)
   A IA pode conferir/renomear depois — e sempre PERGUNTA antes de mexer nas imagens. */
'use strict';

const Montar = {
  pixels(img, k, white = true) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data, rgb = new Float32Array(w * h * 3), a = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) { const al = d[i * 4 + 3] / 255; a[i] = al; for (let c = 0; c < 3; c++) rgb[i * 3 + c] = white ? d[i * 4 + c] * al + 255 * (1 - al) : d[i * 4 + c]; }
    return { w, h, rgb, a };
  },
  samples(P, max = 1500) {
    const pts = []; for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.a[y * P.w + x] > .75) pts.push(x, y);
    const n = pts.length / 2, step = Math.max(1, Math.floor(n / max)), out = [];
    for (let i = 0; i < n; i += step) out.push(pts[i * 2], pts[i * 2 + 1]);
    return out;
  },
  cost(R, P, pts, x0, y0, cap = 110) {
    let s = 0, c = 0;
    for (let i = 0; i < pts.length; i += 2) {
      const x = pts[i] + x0, y = pts[i + 1] + y0; if (x < 0 || y < 0 || x >= R.w || y >= R.h) { s += cap; c++; continue; }
      const ri = (y * R.w + x) * 3, pi = (pts[i + 1] * P.w + pts[i]) * 3;
      const d = Math.abs(R.rgb[ri] - P.rgb[pi]) + Math.abs(R.rgb[ri + 1] - P.rgb[pi + 1]) + Math.abs(R.rgb[ri + 2] - P.rgb[pi + 2]);
      s += Math.min(cap, d); c++;
    }
    return c ? s / c : 1e9;
  },
  // procura a parte na referência: grosso (imagem pequena) → fino (tamanho real)
  async locate(refImg, partImg, scale = 1) {
    const RW = refImg.naturalWidth, RH = refImg.naturalHeight, kc = Math.min(1, 240 / Math.max(RW, RH));
    const R = this.pixels(refImg, kc), P = this.pixels(partImg, kc * scale), pts = this.samples(P, 900);
    if (!pts.length) return null;
    let best = { c: 1e9, x: 0, y: 0 };
    for (let y = -P.h + 2; y < R.h - 1; y++) { for (let x = -P.w + 2; x < R.w - 1; x++) { const c = this.cost(R, P, pts, x, y); if (c < best.c) best = { c, x, y }; } if (y % 24 === 0) await new Promise(r => setTimeout(r, 0)); }
    // fino
    const kf = Math.min(1, 900 / Math.max(RW, RH)), R2 = this.pixels(refImg, kf), P2 = this.pixels(partImg, kf * scale), pts2 = this.samples(P2, 2500);
    const cx = Math.round(best.x / kc * kf), cy = Math.round(best.y / kc * kf), rad = Math.ceil(kf / kc) + 3; let b2 = { c: 1e9, x: cx, y: cy };
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) { const c = this.cost(R2, P2, pts2, x, y); if (c < b2.c) b2 = { c, x, y }; }
    return { x: b2.x / kf, y: b2.y / kf, score: b2.c, w: partImg.naturalWidth * scale, h: partImg.naturalHeight * scale };
  },
  // as partes podem ter vindo em outro tamanho que a referência: testa algumas escalas nas maiores
  async findScale(refImg, parts) {
    const big = [...parts].sort((a, b) => b.img.naturalWidth * b.img.naturalHeight - a.img.naturalWidth * a.img.naturalHeight).slice(0, 2);
    let best = { s: 1, c: 1e9 };
    for (const s of [1, .5, .625, .75, .875, 1.15, 1.3, 1.5, 1.75, 2, 2.5, 3]) {
      if (big.some(p => p.img.naturalWidth * s > refImg.naturalWidth * 1.15 || p.img.naturalHeight * s > refImg.naturalHeight * 1.15)) continue;
      let c = 0; for (const p of big) c += (await this.locate(refImg, p.img, s))?.score ?? 999;
      if (c < best.c) best = { s, c };
      if (s === 1 && c / big.length < 18) break; // já encaixou perfeito no tamanho original
    }
    return best.s;
  },
  alphaMask(img, x, y, w, h, W, H, k) {
    // máscara da parte já posicionada, numa grade pequena do tamanho da referência
    const gw = Math.max(1, Math.round(W * k)), gh = Math.max(1, Math.round(H * k)), cv = document.createElement('canvas'); cv.width = gw; cv.height = gh;
    const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, x * k, y * k, w * k, h * k);
    const d = g.getImageData(0, 0, gw, gh).data, m = new Uint8Array(gw * gh); for (let i = 0; i < gw * gh; i++) m[i] = d[i * 4 + 3] > 100 ? 1 : 0;
    return { m, gw, gh };
  },
  baseName(n) { return String(n || '').replace(/\.[^.]+$/, '').replace(/[\s_\-]*(\(?\d+\)?|[a-h]|x|abert[oa]s?|fechad[oa]s?|meio|sorrindo|triste|brav[oa]s?|feliz|surpres[oa]|piscando|grito|[aeiou]|mbp|fv|wq|neutr[oa]s?|open|closed|half|smile)$/i, '').trim().toLowerCase() || String(n).toLowerCase(); },

  async build(projectId, refFile, partFiles, onStep = () => { }) {
    const st = (t) => onStep(t);
    st('Carregando a referência…');
    const refRt = await Assets.addBlob(refFile, refFile.name || 'referencia.png', projectId, 'image');
    let partRts = [];
    for (const f of partFiles) partRts.push(await Assets.addBlob(f, f.name || 'parte.png', projectId, 'image'));
    // uma folha só com várias partes → separa sozinho
    if (partRts.length === 1 && typeof SpriteSplit !== 'undefined') {
      st('Separando as partes da folha…');
      const A = await SpriteSplit.analyze(partRts[0].img, { juntar: false });
      if (A.parts.length > 1) {
        const sheet = partRts[0]; partRts = [];
        for (let i = 0; i < A.parts.length; i++) {
          const p = A.parts[i], ids = new Set(p.ids), [x0, y0, x1, y1] = p.box, w = x1 - x0 + 1, h = y1 - y0 + 1;
          const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = (y0 + y) * A.W + x0 + x; if (!ids.has(A.lab[q])) continue; const k = q * 4, j = (y * w + x) * 4; im.data[j] = A.d[k]; im.data[j + 1] = A.d[k + 1]; im.data[j + 2] = A.d[k + 2]; im.data[j + 3] = A.d[k + 3]; }
          g.putImageData(im, 0, 0); const blob = await new Promise(r => c.toBlob(r, 'image/png'));
          partRts.push(await Assets.addBlob(blob, `parte ${String(i + 1).padStart(2, '0')}.png`, projectId, 'image'));
        }
        sheet.meta.hiddenSheet = true;
      }
    }
    const ref = refRt.img, RW = ref.naturalWidth, RH = ref.naturalHeight;
    const parts = partRts.map(rt => ({ rt, img: rt.img, name: rt.meta.name.replace(/\.[^.]+$/, '') }));
    st('Descobrindo o tamanho das partes…');
    const scale = await this.findScale(ref, parts);
    for (let i = 0; i < parts.length; i++) { st(`Encaixando as partes na referência… ${i + 1}/${parts.length}`); parts[i].loc = await this.locate(ref, parts[i].img, scale); }
    // 2) desenhos da mesma parte (mesmo nome-base e no mesmo lugar)
    const groups = [];
    for (const p of parts) {
      if (!p.loc) continue;
      const b = this.baseName(p.name), cx = p.loc.x + p.loc.w / 2, cy = p.loc.y + p.loc.h / 2;
      const g = groups.find(g => g.base === b && Math.hypot(g.cx - cx, g.cy - cy) < Math.max(g.w, g.h, p.loc.w, p.loc.h) * .45);
      if (g) g.items.push(p); else groups.push({ base: b, cx, cy, w: p.loc.w, h: p.loc.h, items: [p] });
    }
    // o desenho que mais combina com a referência é o padrão
    groups.forEach(g => g.items.sort((a, b) => a.loc.score - b.loc.score));
    const rig = Rig.newRig({ name: 'Personagem', ref: refRt.meta.id, w: RW, h: RH });
    const k = Math.min(1, 300 / Math.max(RW, RH));
    const nodes = groups.map(g => {
      const main = g.items[0], n = Rig.newNode({ name: groups.filter(x => x.base === g.base).length > 1 ? main.name : (g.items.length > 1 ? g.base : main.name) });
      n._g = g; n._loc = main.loc; n._mask = this.alphaMask(main.img, main.loc.x, main.loc.y, main.loc.w, main.loc.h, RW, RH, k);
      n._area = n._mask.m.reduce((a, b) => a + b, 0); n.side = Roles.side(n.name);
      return n;
    });
    // 3) quem fica na frente: na área em que duas partes se cobrem, quem bate com a referência está na frente
    st('Descobrindo quem fica na frente…');
    const R = this.pixels(ref, k), front = new Map(nodes.map(n => [n.id, 0]));
    const P = new Map(nodes.map(n => { const im = n._g.items[0].img, cv = document.createElement('canvas'); cv.width = R.w; cv.height = R.h; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(im, n._loc.x * k, n._loc.y * k, n._loc.w * k, n._loc.h * k); const d = g.getImageData(0, 0, R.w, R.h).data; return [n.id, d]; }));
    const overlap = (a, b) => { let c = 0, ea = 0, eb = 0, sx = 0, sy = 0; const da = P.get(a.id), db = P.get(b.id); for (let i = 0; i < R.w * R.h; i++) { if (da[i * 4 + 3] > 150 && db[i * 4 + 3] > 150) { c++; sx += i % R.w; sy += (i / R.w) | 0; for (let ch = 0; ch < 3; ch++) { ea += Math.abs(da[i * 4 + ch] - R.rgb[i * 3 + ch]); eb += Math.abs(db[i * 4 + ch] - R.rgb[i * 3 + ch]); } } } return { c, ea, eb, cx: c ? sx / c / k : 0, cy: c ? sy / c / k : 0 }; };
    const ov = {};
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) { const o = overlap(nodes[i], nodes[j]); ov[nodes[i].id + '|' + nodes[j].id] = ov[nodes[j].id + '|' + nodes[i].id] = o; if (o.c > 4) { if (o.ea < o.eb) front.set(nodes[i].id, front.get(nodes[i].id) + 1); else front.set(nodes[j].id, front.get(nodes[j].id) + 1); } }
    const ovl = (a, b) => ov[a.id + '|' + b.id] || { c: 0 };
    // 4) pais: pelo papel (nome) e lado; senão a parte maior que mais encosta
    st('Ligando os ossos…');
    const byRole = r => nodes.filter(n => n.role === r);
    const area = n => n._area;
    let root = byRole('quadril')[0] || byRole('tronco')[0] || [...nodes].sort((a, b) => area(b) - area(a))[0];
    for (const n of nodes) {
      if (n === root) continue;
      const def = Roles.def(n.role); let par = null;
      if (def) for (const pr of def[2]) { const cand = byRole(pr).filter(c => c !== n && (!n.side || !c.side || c.side === n.side)); if (cand.length) { par = cand.sort((a, b) => ovl(n, b).c - ovl(n, a).c || Math.hypot(a._loc.x - n._loc.x, a._loc.y - n._loc.y) - Math.hypot(b._loc.x - n._loc.x, b._loc.y - n._loc.y))[0]; break; } }
      if (!par) { const cand = nodes.filter(c => c !== n && area(c) > area(n) * 1.05 && ovl(n, c).c > 2).sort((a, b) => ovl(n, b).c - ovl(n, a).c); par = cand[0] || root; }
      n.parent = par.id;
    }
    // evita ciclos
    for (const n of nodes) { let p = n, seen = new Set(); while (p && p.parent) { if (seen.has(p.id)) { p.parent = root.id === p.id ? null : root.id; break; } seen.add(p.id); p = nodes.find(x => x.id === p.parent); } }
    root.parent = null;
    // 5) pivôs: meio da área em que a parte encosta no pai; no rosto (olho, boca…) o próprio centro
    for (const n of nodes) {
      const L = n._loc; let px = L.x + L.w / 2, py = L.y + L.h / 2;
      const par = nodes.find(x => x.id === n.parent);
      if (n === root) { py = L.y + L.h * .55; }
      else if (['olho', 'boca', 'nariz', 'sobrancelha'].includes(n.role)) { /* centro */ }
      else if (par) {
        const o = ovl(n, par);
        if (o.c > 3) { px = o.cx; py = o.cy; if (n.role === 'cabeca') py = Math.max(o.cy, L.y + L.h * .75); }
        else { // não encosta: ponto da parte mais perto do pai
          const pc = { x: par._loc.x + par._loc.w / 2, y: par._loc.y + par._loc.h / 2 }; px = clamp(pc.x, L.x, L.x + L.w); py = clamp(pc.y, L.y, L.y + L.h);
        }
      }
      n.px = round(px, 1); n.py = round(py, 1);
      n.drawings = n._g.items.map(it => ({ asset: it.rt.meta.id, name: it.name, ox: round(it.loc.x - n.px, 1), oy: round(it.loc.y - n.py, 1), w: round(it.loc.w, 1), h: round(it.loc.h, 1) }));
      const def = Roles.def(n.role); n.limit = def?.[3] ? [...def[3]] : null; if (n === root) n.limit = null;
      if (def?.[4]) n.follow = { lag: 3, amt: .5 };
      if (['mao', 'pe'].includes(n.role)) n.ik = true;
    }
    // olho/boca soltos com um desenho só (ex.: "olhos fechados", "boca fechada") são CAMADAS por cima do rosto:
    // ganham um desenho vazio = "como está no desenho" (olho aberto / boca aberta) — assim piscar e falar funcionam
    for (const n of nodes) if (['olho', 'boca'].includes(n.role) && n.drawings.length === 1) {
      const nm = n.drawings[0].name || '';
      if (n.role === 'olho') { n.drawings.unshift({ asset: null, name: 'aberto (do desenho)', ox: 0, oy: 0, w: 1, h: 1 }); n.d = 0; }
      else { n.drawings.push({ asset: null, name: /fech|closed/i.test(nm) ? 'aberta (do desenho)' : 'como no desenho', ox: 0, oy: 0, w: 1, h: 1 }); n.d = 1; }
    }
    // pupila em camada: recortada pelo branco do olho (pai), fica por cima dele e só desliza (não gira)
    for (const n of nodes) if (n.role === 'pupila') { const par = nodes.find(x => x.id === n.parent); if (par?.role === 'olho') { n.clip = par.id; n.limit = null; } }
    // ordem (z): quem ganhou mais "na frente" fica por cima; rosto sempre na frente da cabeça
    const ord = [...nodes].sort((a, b) => front.get(a.id) - front.get(b.id)); ord.forEach((n, i) => n.z = i);
    for (const n of nodes) if (['olho', 'boca', 'nariz', 'sobrancelha', 'pupila'].includes(n.role)) { const par = nodes.find(x => x.id === n.parent); if (par && n.z <= par.z) n.z = par.z + .5; }
    [...nodes].sort((a, b) => a.z - b.z).forEach((n, i) => n.z = i);
    for (const n of nodes) { delete n._g; delete n._loc; delete n._mask; delete n._area; }
    rig.nodes = nodes;
    nodes.forEach(n => n.tip = Rig.computeTip(n));
    // origem do personagem: pés no meio
    const op = this.pixels(ref, k); let minx = 1e9, maxx = -1, maxy = -1; for (let y = 0; y < op.h; y++) for (let x = 0; x < op.w; x++) if (op.a[y * op.w + x] > .3) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); maxy = Math.max(maxy, y); }
    rig.ox = round((minx + maxx) / 2 / k, 1); rig.oy = round(maxy / k, 1);
    rig.scaleFound = scale;
    rig.quality = round(parts.reduce((a, p) => a + (p.loc?.score || 0), 0) / Math.max(1, parts.length), 1);
    st('Pronto!');
    return rig;
  },
};
