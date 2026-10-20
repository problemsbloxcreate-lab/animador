/* ===================== anim/folha.js — ler uma FOLHA DE MODELO (model sheet) =====================
   Folhas como as de estúdio: turnaround, cabeça em 8 direções, expressões, olhos, bocas, mãos, partes do corpo…
   1) acha cada desenho (os quadros de fundo semitransparente e o fundo são ignorados)
   2) separa rótulos (títulos) e paleta de cores
   3) junta desenhos parecidos e lado a lado em GRUPOS (ex.: as 8 cabeças, as bocas, as mãos)
   Depois você (ou a IA) diz o que é cada grupo e o estúdio cria as partes com troca de desenho. */
'use strict';

const FOLHA_TIPOS = {
  inteiro: 'Personagem inteiro (poses / turnaround)', pecas: 'Peças soltas (cada desenho vira uma parte)', expressao: 'Expressões (cabeça inteira)', cabeca: 'Cabeça (direções / expressões)', rosto: 'Rosto base', olho: 'Olhos', pupila: 'Pupilas (mexem dentro do olho)', sobrancelha: 'Sobrancelhas', boca: 'Bocas',
  nariz: 'Nariz', orelha: 'Orelhas', cabelo: 'Cabelo / franja', tronco: 'Tronco / roupa de cima', quadril: 'Saia / quadril', braco: 'Braços', antebraco: 'Antebraços', mao: 'Mãos',
  coxa: 'Coxas', perna: 'Pernas', pe: 'Pés / sapatos', acessorio: 'Acessórios', ignorar: '— ignorar —',
};
const Folha = {
  async parse(img, o = {}) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    // fundo: transparente/semitransparente (quadros) — o desenho é o que é quase opaco
    let transp = 0; for (let i = 3; i < d.length; i += 4 * 53) if (d[i] < 200) transp++;
    const useA = transp > d.length / 4 / 53 * .1, thr = o.alfa ?? 200, bg = [d[0], d[1], d[2]];
    const on = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) { const k = i * 4; on[i] = useA ? (d[k + 3] >= thr && !(d[k + 3] < 251 && d[k] > 192 && d[k + 1] > 192 && d[k + 2] > 192 && Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]) < 28) ? 1 : 0) : (Math.abs(d[k] - bg[0]) + Math.abs(d[k + 1] - bg[1]) + Math.abs(d[k + 2] - bg[2]) > 60 ? 1 : 0); }
    // componentes (com 1 px de folga)
    const lab = new Int32Array(W * H), st = new Int32Array(W * H), comps = []; let n = 0;
    for (let i = 0; i < W * H; i++) {
      if (!on[i] || lab[i]) continue; n++; let sp = 0; st[sp++] = i; lab[i] = n; let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0, sr = 0, sg = 0, sb = 0, sr2 = 0;
      while (sp) { const p = st[--sp], x = p % W, y = (p / W) | 0, k = p * 4; area++; sr += d[k]; sg += d[k + 1]; sb += d[k + 2]; sr2 += d[k] * d[k]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx; if (on[q] && !lab[q]) { lab[q] = n; st[sp++] = q; } } }
      if (area < 18) continue;
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, mr = sr / area, std = Math.sqrt(Math.max(0, sr2 / area - mr * mr));
      comps.push({ ids: [n], area, box: [x0, y0, x1, y1], fill: area / (bw * bh), col: [mr, sg / area, sb / area], std });
    }
    for (const c of comps) { const bw = c.box[2] - c.box[0] + 1, bh = c.box[3] - c.box[1] + 1; c.label = c.fill > .55 && bw / bh > 2.6 && bh < H * .06 && bw > W * .03 && c.col[2] > c.col[1] + 12 && c.col[0] + c.col[1] + c.col[2] < 520; }
    // junta pedacinhos colados (pupila no olho, brilho, etc.) — nunca com rótulos
    const inside = (a, b) => a[0] >= b[0] && a[1] >= b[1] && a[2] <= b[2] && a[3] <= b[3];
    // texto dentro de um rótulo: some junto com o rótulo
    const near = (a, b, m) => a[0] - m <= b[2] && b[0] - m <= a[2] && a[1] - m <= b[3] && b[1] - m <= a[3];
    comps.sort((a, b) => b.area - a.area);
    const items = [];
    for (const c of comps) { const host = c.label ? null : items.find(it => !it.label && near(it.box, c.box, 3) && it.area > c.area && !(inside(c.box, it.box) && false)); if (host) { host.ids.push(...c.ids); host.area += c.area; host.box = [Math.min(host.box[0], c.box[0]), Math.min(host.box[1], c.box[1]), Math.max(host.box[2], c.box[2]), Math.max(host.box[3], c.box[3])]; } else items.push({ ...c }); }
    // rótulos (retângulos cheios e largos) e paleta (bolinhas de uma cor só)
    for (const it of items) {
      const bw = it.box[2] - it.box[0] + 1, bh = it.box[3] - it.box[1] + 1;
      if (it.label || items.some(L => L.label && L !== it && inside(it.box, [L.box[0] - 2, L.box[1] - 2, L.box[2] + 2, L.box[3] + 2]))) it.kind = 'rotulo';
      else if (it.std < 10 && it.fill > .65 && Math.abs(bw - bh) < 6 && bw < W * .04) it.kind = 'paleta';
      else if (bw * bh < 160) it.kind = 'lixo';
      else it.kind = 'desenho';
    }
    // textinhos (FRENTE, 3/4 ESQ…) — finos e baixos
    for (const it of items) { if (it.kind !== 'desenho') continue; const bw = it.box[2] - it.box[0] + 1, bh = it.box[3] - it.box[1] + 1; if (bh < H * .022 && bw > bh * 1.6 && (it.fill < .42 || it.col[0] + it.col[1] + it.col[2] > 360)) it.kind = 'texto'; }
    // desenhos colados uns nos outros (ex.: expressões lado a lado) → separa pelos "vales" da silhueta
    const splitIt = (it, depth = 0) => {
      const [x0, y0, x1, y1] = it.box, bw = x1 - x0 + 1, bh = y1 - y0 + 1; if (depth > 5 || bw * bh < 4000) return [it];
      const ids = new Set(it.ids), col = new Float32Array(bw), row = new Float32Array(bh);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (ids.has(lab[y * W + x])) { col[x - x0]++; row[y - y0]++; }
      const cut = (pr, n, other) => { const mx = Math.max(...pr); let best = -1, bv = 1e9; for (let i = Math.round(n * .18); i < n - Math.round(n * .18); i++) { const v = (pr[i - 1] + pr[i] + pr[i + 1]) / 3; if (v < bv) { bv = v; best = i; } } return bv < mx * .1 && n > other * .9 ? best : -1; };
      const cx = cut(col, bw, bh), cy = cx < 0 ? cut(row, bh, bw * .6) : -1;
      if (cx < 0 && cy < 0) return [it];
      const parts = cx >= 0 ? [[x0, y0, x0 + cx, y1], [x0 + cx + 1, y0, x1, y1]] : [[x0, y0, x1, y0 + cy], [x0, y0 + cy + 1, x1, y1]];
      return parts.flatMap(b => { let X0 = W, Y0 = H, X1 = 0, Y1 = 0, a = 0; for (let y = b[1]; y <= b[3]; y++) for (let x = b[0]; x <= b[2]; x++) if (ids.has(lab[y * W + x])) { a++; if (x < X0) X0 = x; if (x > X1) X1 = x; if (y < Y0) Y0 = y; if (y > Y1) Y1 = y; } if (a < 30) return []; return splitIt({ ...it, box: [X0, Y0, X1, Y1], area: a, fill: a / ((X1 - X0 + 1) * (Y1 - Y0 + 1)), kind: 'desenho' }, depth + 1); });
    };
    const draws = items.filter(i => i.kind === 'desenho').flatMap(it => splitIt(it));
    // GRUPOS pelos rótulos da folha (o título roxo no canto de cada quadro): cada desenho vai para o rótulo acima-à-esquerda mais perto
    const chips = items.filter(i => i.kind === 'rotulo');
    const groups = [], inPanel = new Map();
    for (const it of draws) {
      const cx = (it.box[0] + it.box[2]) / 2, top = it.box[1];
      let best = null, bd = 1e9; for (const c of chips) { if (c.box[3] > top + 12 || c.box[0] > cx + 12) continue; const dd = (top - c.box[3]) + (cx - c.box[0]) * .9; if (dd < bd) { bd = dd; best = c; } }
      const key = best || 'solto'; if (!inPanel.has(key)) inPanel.set(key, []); inPanel.get(key).push(it);
    }
    const med = a => { const b = [...a].sort((x, y) => x - y); return b[b.length >> 1] || 1; };
    const rowsOf = list => { const L = [...list].sort((a, b) => (a.box[1] + a.box[3]) - (b.box[1] + b.box[3])), rows = []; for (const it of L) { const cy = (it.box[1] + it.box[3]) / 2, hh = it.box[3] - it.box[1]; const r = rows.find(r => Math.abs(r.cy - cy) < Math.max(hh, r.h) * .45); if (r) { r.items.push(it); r.cy = (r.cy * (r.items.length - 1) + cy) / r.items.length; r.h = Math.max(r.h, hh); } else rows.push({ cy, h: hh, items: [it] }); } rows.sort((a, b) => a.cy - b.cy); rows.forEach(r => r.items.sort((a, b) => a.box[0] - b.box[0])); return rows; };
    const pushG = (list, chip) => { if (!list.length) return; const box = [Math.min(...list.map(i => i.box[0])), Math.min(...list.map(i => i.box[1])), Math.max(...list.map(i => i.box[2])), Math.max(...list.map(i => i.box[3]))]; groups.push({ id: uid('g_'), items: list, box, panel: chip ? chip.box : null, chip: chip || null }); };
    for (const [pn, list] of inPanel) {
      if (pn === 'solto') { for (const r of rowsOf(list)) pushG(r.items); continue; }
      const rows = rowsOf(list), merged = [];
      for (const r of rows) { const hm = med(r.items.map(i => i.box[3] - i.box[1])), wm = med(r.items.map(i => i.box[2] - i.box[0])), L = merged[merged.length - 1]; if (L && Math.max(hm, L.hm) / Math.min(hm, L.hm) < 1.35 && Math.max(wm, L.wm) / Math.min(wm, L.wm) < 1.45 && r.items.length > 1 === L.items.length > 1) { L.items.push(...r.items); } else merged.push({ hm, wm, items: [...r.items] }); }
      // quadro com peças de tamanhos muito diferentes (ex.: "corpo — partes") = um grupo só
      // quadro com peças de tamanhos bem diferentes (ex.: "corpo — partes") = um grupo só de PEÇAS
      const sizes = list.map(i => (i.box[2] - i.box[0]) * (i.box[3] - i.box[1])), spread = Math.max(...sizes) / Math.max(1, Math.min(...sizes));
      if (merged.length > 3 && (merged.filter(m => m.items.length <= 2).length >= merged.length / 2 || spread > 25)) { pushG(merged.flatMap(m => m.items), pn); groups[groups.length - 1].pecas = true; } else for (const m of merged) pushG(m.items, pn);
    }
    groups.sort((a, b) => (a.panel?.[1] ?? a.box[1]) - (b.panel?.[1] ?? b.box[1]) > 40 ? 1 : (b.panel?.[1] ?? b.box[1]) - (a.panel?.[1] ?? a.box[1]) > 40 ? -1 : (a.panel?.[0] ?? a.box[0]) - (b.panel?.[0] ?? b.box[0]) || a.box[1] - b.box[1]);
    groups.forEach((g2, i) => { g2.nome = `Grupo ${i + 1}`; g2.tipo = this.guessType(g2, W, H); });
    return { W, H, lab, d, items, groups, labels: items.filter(i => i.kind === 'rotulo') };
  },
  // quadros de fundo semitransparente (em 1/4 do tamanho, para ser rápido)
  panels(d, W, H) {
    const k = 4, w = Math.ceil(W / k), h = Math.ceil(H / k), m = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let c = 0; for (let dy = 0; dy < k; dy += 2) for (let dx = 0; dx < k; dx += 2) { const X = x * k + dx, Y = y * k + dy; if (X < W && Y < H && d[(Y * W + X) * 4 + 3] > 50) c++; } m[y * w + x] = c >= 2 ? 1 : 0; }
    // fecha (junta o brilho em volta dos desenhos num quadro só) e depois abre um pouco (separa quadros vizinhos)
    const morph = (src, r, dil) => { const o = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = dil ? 0 : 1; for (let dy = -r; dy <= r && v === (dil ? 0 : 1); dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy, q = X < 0 || Y < 0 || X >= w || Y >= h ? 0 : src[Y * w + X]; if (dil ? q : !q) { v = dil ? 1 : 0; break; } } o[y * w + x] = v; } return o; };
    const er = morph(morph(m, 1, false), 1, true);
    const lab = new Int32Array(w * h), st = new Int32Array(w * h), out = []; let n = 0;
    for (let i = 0; i < w * h; i++) { if (!er[i] || lab[i]) continue; n++; let sp = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, a = 0; st[sp++] = i; lab[i] = n; while (sp) { const p = st[--sp], x = p % w, y = (p / w) | 0; a++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; for (const q of [p - 1, p + 1, p - w, p + w]) if (q >= 0 && q < w * h && er[q] && !lab[q] && Math.abs((q % w) - x) <= 1) { lab[q] = n; st[sp++] = q; } } if (a * k * k > 9000 && a / ((x1 - x0 + 1) * (y1 - y0 + 1)) > .55) out.push([(x0 - 1) * k, (y0 - 1) * k, (x1 + 2) * k, (y1 + 2) * k]); }
    return out;
  },
  // palpite do tipo pelo tamanho/forma (a IA ou você corrigem depois)
  guessType(g, W, H) {
    if (g.pecas) return 'pecas';
    const it = g.items[0], bw = it.box[2] - it.box[0], bh = it.box[3] - it.box[1], n = g.items.length, big = bh > H * .22;
    if (big && bh > bw * 1.6) return 'inteiro';
    if (n >= 4 && bh > H * .07 && bh < H * .17 && bw > bh * .7) return 'cabeca';
    if (bw < W * .04 && bh < H * .035 && bw > bh * 1.6) return n > 3 ? 'boca' : 'sobrancelha';
    if (bw < W * .05 && bh < H * .05) return 'olho';
    return 'ignorar';
  },
  // recorta um desenho (com o alfa original, sem o fundo semitransparente)
  async crop(P, it, pad = 3) {
    const ids = new Set(it.ids), [x0, y0, x1, y1] = it.box, X0 = Math.max(0, x0 - pad), Y0 = Math.max(0, y0 - pad), X1 = Math.min(P.W - 1, x1 + pad), Y1 = Math.min(P.H - 1, y1 + pad), w = X1 - X0 + 1, h = Y1 - Y0 + 1;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const q = (Y0 + y) * P.W + X0 + x; let keep = ids.has(P.lab[q]); if (!keep && P.d[q * 4 + 3] > 120) { for (let dy = -1; dy <= 1 && !keep; dy++) for (let dx = -1; dx <= 1 && !keep; dx++) { const qq = q + dy * P.W + dx; if (qq >= 0 && ids.has(P.lab[qq])) keep = true; } } if (!keep) continue; const k = q * 4, j = (y * w + x) * 4; im.data[j] = P.d[k]; im.data[j + 1] = P.d[k + 1]; im.data[j + 2] = P.d[k + 2]; im.data[j + 3] = P.d[k + 3]; }
    g.putImageData(im, 0, 0);
    return new Promise(r => c.toBlob(r, 'image/png'));
  },
  // imagem com números por cima (para a IA dizer o que é cada grupo)
  numbered(img, P, maxW = 1400) {
    const k = Math.min(1, maxW / P.W), c = document.createElement('canvas'); c.width = Math.round(P.W * k); c.height = Math.round(P.H * k); const g = c.getContext('2d');
    g.fillStyle = '#5b9e6e'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    P.groups.forEach((gr, i) => { const [x0, y0, x1, y1] = gr.box.map(v => v * k); g.strokeStyle = '#ff2a55'; g.lineWidth = 2; g.strokeRect(x0, y0, x1 - x0, y1 - y0); g.fillStyle = '#ff2a55'; g.fillRect(x0, y0, 22 + String(i + 1).length * 7, 16); g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.fillText(String(i + 1), x0 + 4, y0 + 12); });
    return c.toDataURL('image/jpeg', .85);
  },
  async askAI(img, P) {
    if (!AIClient.ready) throw new Error('A IA do Estúdio Problems não está ligada (servidor da Cloudflare). Dê os nomes dos grupos à mão — é rápido.');
    const url = this.numbered(img, P), b64 = url.split(',')[1];
    const sys = `Você é assistente de rig de animação 2D (Toon Boom Harmony). Recebe uma FOLHA DE MODELO com grupos numerados (caixas vermelhas). Para CADA número diga o que é. Responda só linhas JSON, uma por grupo:
{"grupo":N,"tipo":"${Object.keys(FOLHA_TIPOS).join('|')}","nome":"nome curto em português","desenhos":["nome de cada desenho, da esquerda p/ direita e de cima p/ baixo", ...]}
Ex.: cabeças em 8 direções → tipo cabeca, desenhos ["frente","3/4 esq","lado esq","3/4 costas","costas","3/4 dir","lado dir","3/4 frente"]. Bocas → tipo boca com nomes como "fechada","sorriso","aberta","A","O","grito". Olhos → "aberto","meio","fechado","olhando esq"... Turnaround → tipo inteiro.
Não invente grupos. Não peça para mudar a imagem.`;
    const j = await AIClient.call([{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: `São ${P.groups.length} grupos. Diga o que é cada um.` }] }], sys);
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n'); let n = 0;
    for (const l of text.split('\n')) { const s = l.trim(); if (!s.startsWith('{')) continue; try { const o = JSON.parse(s), g = P.groups[(+o.grupo || 0) - 1]; if (!g) continue; if (FOLHA_TIPOS[o.tipo]) g.tipo = o.tipo; if (o.nome) g.nome = String(o.nome).slice(0, 40); if (Array.isArray(o.desenhos)) g.nomes = o.desenhos.map(String); n++; } catch { } }
    return n;
  },
};

/* ---------- monta um personagem a partir dos grupos da folha (layout padrão de TV; você ajusta no modo Montar) ---------- */
Folha.LAYOUT = { // [x, y] em fração da altura (origem = pés no meio, y para cima é negativo), como encaixar o desenho no pivô, z
  quadril: { p: [0, -.5], at: 'top', z: 3 }, tronco: { p: [0, -.5], at: 'bottom', z: 4 }, cabeca: { p: [0, -.76], at: 'bottom', z: 8, over: .04 },
  braco: { p: [.12, -.73], at: 'top', z: 5 }, antebraco: { p: [0, 0], at: 'top', z: 6, chain: 'braco' }, mao: { p: [0, 0], at: 'top', z: 7, chain: 'antebraco|braco' },
  coxa: { p: [.06, -.47], at: 'top', z: 1 }, perna: { p: [0, 0], at: 'top', z: 1.5, chain: 'coxa' }, pe: { p: [0, 0], at: 'top', z: 2, chain: 'perna|coxa' },
  cabelo: { face: [0, -.1], z: 9 }, olho: { face: [0, .02], z: 10 }, pupila: { face: [0, .02], z: 10.5 }, sobrancelha: { face: [0, -.12], z: 11 }, nariz: { face: [0, .1], z: 10 }, boca: { face: [0, .24], z: 10 }, orelha: { face: [.42, 0], z: 7.5 }, rosto: { face: [0, 0], z: 8.5 }, acessorio: { face: [0, -.3], z: 12 },
};
Folha.buildRig = async function (projectId, P, groups, onStep = () => { }) {
  const use = groups.filter(g => g.tipo && g.tipo !== 'ignorar'); if (!use.length) throw new Error('Marque pelo menos um grupo (o que é cada desenho).');
  // 1) recorta (a folha original não muda)
  const cut = new Map(); let n = 0, tot = use.reduce((a, g) => a + g.items.length, 0);
  for (const g of use) for (let i = 0; i < g.items.length; i++) { onStep(`Recortando desenhos… ${++n}/${tot}`); const it = g.items[i], blob = await this.crop(P, it), nm = (g.nomes?.[i] || `${g.nome} ${i + 1}`); const rt = await Assets.addBlob(blob, nm + '.png', projectId, 'image'); cut.set(it, { asset: rt.meta.id, w: rt.img.naturalWidth, h: rt.img.naturalHeight, name: nm }); }
  const D = (g, i) => cut.get(g.items[i]);
  const T = t => use.filter(g => g.tipo === t);
  const inteiro = T('inteiro'), parts = use.filter(g => g.tipo !== 'inteiro' && g.tipo !== 'expressao');
  const head = T('cabeca')[0], headH = head ? Math.max(...head.items.map((_, i) => D(head, i).h)) : 0;
  const Hc = inteiro.length ? Math.max(...inteiro.flatMap(g => g.items.map((_, i) => D(g, i).h))) : headH ? headH * 4.2 : Math.max(...use.flatMap(g => g.items.map((_, i) => D(g, i).h))) * 2.2;
  const rig = Rig.newRig({ name: 'Personagem', w: Math.round(Hc * .8), h: Math.round(Hc) }); rig.ox = rig.w / 2; rig.oy = rig.h;
  const X = x => rig.w / 2 + x * Hc, Y = y => rig.h + y * Hc;
  const dr = (d, ox, oy) => ({ asset: d.asset, name: d.name, ox: round(ox, 1), oy: round(oy, 1), w: d.w, h: d.h });
  // só desenhos inteiros (turnaround / poses) → um nó com troca de desenho (PNGtuber de folha)
  if (!parts.length) {
    const node = Rig.newNode({ name: 'Corpo', role: 'inteiro', px: rig.w / 2, py: rig.h * .55 });
    for (const g of inteiro) g.items.forEach((_, i) => { const d = D(g, i); node.drawings.push(dr(d, -d.w / 2, rig.h - node.py - d.h)); });
    rig.nodes = [node]; rig.ref = node.drawings[0]?.asset || null; rig.quality = null; return rig;
  }
  if (inteiro.length) rig.ref = D(inteiro[0], 0).asset;
  const made = {}; // papel → [nós]
  const add = (role, side, g, idx) => {
    const L = this.LAYOUT[role] || { face: [0, 0], z: 6 }, d0 = D(g, idx[0]);
    const name = (FOLHA_TIPOS[role] || g.nome).replace(/ \/.*$/, '').replace(/s$/, '') + (side ? ' ' + side : '');
    const n = Rig.newNode({ name: g.nome && !/^Grupo/.test(g.nome) ? g.nome + (side ? ' ' + side : '') : name, role, side });
    const sx = side === 'esq' ? -1 : side === 'dir' ? 1 : 0;
    if (role === 'pupila' && made.olho?.[0]) { const e = made.olho[0]; n.parent = e.id; n.px = e.px; n.py = e.py; n.clip = e.id; n.drawings = idx.map(i => { const d = D(g, i); return dr(d, -d.w / 2, -d.h / 2); }); }
    else if (L.face) { const h0 = made.cabeca?.[0]; const hc = h0 ? { x: h0.px, y: h0.py - (h0._dh || headH) * .55 } : { x: X(0), y: Y(-.88) }; const hh = h0?._dh || headH || Hc * .22; n.px = hc.x + L.face[0] * hh * (sx || (role === 'orelha' ? 1 : 0)); n.py = hc.y + L.face[1] * hh; n.parent = h0?.id || null; n.drawings = idx.map(i => { const d = D(g, i); return dr(d, -d.w / 2, -d.h / 2); }); }
    else {
      let px = X(L.p[0] * (sx || 0)), py = Y(L.p[1]);
      if (L.chain) { const par = L.chain.split('|').map(r => (made[r] || []).find(m => !side || m.side === side)).find(Boolean); if (par) { px = par.px + (par._bx || 0); py = par.py + par._dh * .92; n.parent = par.id; } }
      n.px = px; n.py = py;
      n.drawings = idx.map(i => { const d = D(g, i); return L.at === 'bottom' ? dr(d, -d.w / 2, -d.h + (L.over || 0) * d.h) : dr(d, -d.w / 2, -d.h * .06); });
      n._dh = L.at === 'bottom' ? -d0.h : d0.h;
    }
    if (role === 'cabeca') n._dh = d0.h;
    n.z = L.z; const def = Roles.def(role); n.limit = def?.[3] ? [...def[3]] : null; if (def?.[4]) n.follow = { lag: 3, amt: .5 }; if (['mao', 'pe'].includes(role)) n.ik = true;
    (made[role] ||= []).push(n); rig.nodes.push(n); return n;
  };
  // peças soltas: cada desenho vira uma parte, com o papel tirado do nome (a IA dá os nomes: "braço esq", "mão aberta"…)
  for (const g of T('pecas')) g.items.forEach((it, i) => { const nm = g.nomes?.[i] || `${g.nome} ${i + 1}`, role = Roles.of(nm); if (role === 'parte') return; const sub = { ...g, nome: nm, items: [it], nomes: [nm] }; (T(role).length ? null : null); this._extra ||= []; this._extra.push([role, Roles.side(nm), sub]); });
  const order = ['quadril', 'tronco', 'cabeca', 'rosto', 'cabelo', 'orelha', 'olho', 'pupila', 'sobrancelha', 'nariz', 'boca', 'braco', 'antebraco', 'mao', 'coxa', 'perna', 'pe', 'acessorio'];
  for (const role of order) for (const g of T(role)) {
    const idx = g.items.map((_, i) => i);
    if (['braco', 'antebraco', 'mao', 'coxa', 'perna', 'pe', 'orelha'].includes(role)) {
      // dois lados: os mesmos desenhos nos dois (troque o desenho de cada lado no painel Desenhos)
      const a = add(role, 'esq', g, idx), b = add(role, 'dir', g, idx); if (idx.length > 1) b.d = 1;
    } else add(role, '', g, idx);
  }
  for (const [role, side, g] of this._extra || []) { const ex = (made[role] || []).find(m => (m.side || '') === side); if (ex) { const d = D(g, 0); ex.drawings.push({ ...ex.drawings[0], asset: d.asset, name: d.name, w: d.w, h: d.h, ox: round(ex.drawings[0].ox + (ex.drawings[0].w - d.w) / 2, 1) }); } else add(role, side, g, [0]); }
  this._extra = null;
  // expressões = desenhos extras da cabeça
  const hd = made.cabeca?.[0]; for (const g of T('expressao')) g.items.forEach((_, i) => { const d = D(g, i); if (hd) hd.drawings.push({ asset: d.asset, name: d.name, w: d.w, h: d.h, ox: round(-d.w / 2, 1), oy: round(-d.h, 1) }); });
  // pais que faltaram: tronco → quadril; cabeça → tronco; braço → tronco; coxa → quadril
  const first = r => made[r]?.[0];
  for (const n of rig.nodes) if (!n.parent) { const def = Roles.def(n.role), par = def?.[2].map(first).find(Boolean); if (par && par !== n) n.parent = par.id; }
  const root = first('quadril') || first('tronco') || rig.nodes[0];
  for (const n of rig.nodes) if (n !== root && !n.parent) n.parent = root.id;
  root.parent = null;
  [...rig.nodes].sort((a, b) => a.z - b.z).forEach((n, i) => n.z = i);
  rig.nodes.forEach(n => { delete n._dh; delete n._bx; n.tip = Rig.computeTip(n); });
  rig.quality = null; rig.fromSheet = true;
  return rig;
};
