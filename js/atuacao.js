/* ===================== atuacao.js — ATUAÇÃO AUTOMÁTICA do personagem (movimento gerado por código) =====================
   O personagem continua montado pelas poses (presets) das chaves, mas entre uma pose e a próxima o código "atua":
   - LÊ A PRÓXIMA POSE: olhando as chaves para a frente, sabe quando cada parte vai trocar de desenho/giro e para que lado
     ela vai (o "eixo" de cada desenho = do pivô até o meio do desenho, medido nos pixels; ex.: braço caído aponta para
     baixo, acenando aponta para cima). Antes da troca a parte faz ANTECIPAÇÃO (recua um pouco para o lado contrário),
     na troca o desenho novo nasce girado vindo da pose de antes e chega com MOLA (passa um pouco e volta).
   - CORPO reage às trocas grandes (agacha um tico antes e estica depois) e RESPIRA quando está parado.
   - CABELO tem continuidade: atrasa e balança quando o corpo gira ou o personagem anda/pula/cai.
   - PERNAS compensam o giro do corpo (os pés não "patinam").
   - "Pose viva" (moving hold): numa pose parada, braços e cabelo nunca ficam 100% estáticos.
   Como as peças são VETOR (SVG), girar/esticar não perde qualidade (o desenho é feito no tamanho da tela).
   Fica no nó do personagem: n.atuacao = { on, forca (0–2), resp, mola, cabelo } — nada muda nas chaves; desligar = volta ao de antes.
   Entra em Render.pecasPersonagem (palco, câmera, exportar e deformar usam o mesmo caminho). */
'use strict';

const Atuacao = {
  PADRAO: { on: true, forca: 1, resp: true, mola: true, cabelo: true },
  ligada(n) { return !!(n && n.atuacao && n.atuacao.on !== false); },
  opcoes(n) { return { ...this.PADRAO, ...(n.atuacao || {}) }; },

  // tipo da parte pelo nome (o Ateliê usa nomes em português; aceita inglês também)
  tipo(p) {
    const s = String(p.nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (/olho|boca|sobrancelha|nariz|rosto|cilio|pupila|eye|mouth|brow|face|blush|bochecha/.test(s)) return 'rosto';
    if (/cabelo|franja|trança|tranca|rabo|cacho|hair|chapeu|laco|fita/.test(s)) return 'cabelo';
    if (/perna|pe\b|pes\b|bota|sapato|leg|foot|feet/.test(s)) return 'perna';
    if (/referencia|^ref\b|modelo|fantasma/.test(s)) return 'nada';
    return 'membro';
  },

  /* ---------- eixo de cada desenho (graus, no espaço da parte): do pivô até o meio da tinta ---------- */
  _eixos: new Map(), _cv: null,
  eixo(img) {
    if (!img?.k) return null; const ch = img.k + '|' + (img.pivo?.x ?? '') + ',' + (img.pivo?.y ?? '') + '|' + (img.ajuste?.x || 0) + ',' + (img.ajuste?.y || 0);
    if (this._eixos.has(ch)) return this._eixos.get(ch);
    const bm = Render.bm(img.k); if (!bm) return null; // ainda carregando: tenta de novo no próximo quadro
    let r = null;
    try {
      const N = 48, c = this._cv || (this._cv = document.createElement('canvas')); c.width = N; c.height = N;
      const x = c.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, N, N); x.drawImage(bm, 0, 0, N, N);
      const d = x.getImageData(0, 0, N, N).data; let sx = 0, sy = 0, sa = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = d[(j * N + i) * 4 + 3]; if (a > 40) { sx += (i + .5) * a; sy += (j + .5) * a; sa += a; } }
      if (sa > 0) {
        const px = img.pivo?.x ?? img.w / 2, py = img.pivo?.y ?? img.h / 2;
        const vx = sx / sa / N * img.w - px + (img.ajuste?.x || 0), vy = sy / sa / N * img.h - py + (img.ajuste?.y || 0);
        if (Math.hypot(vx, vy) > Math.max(img.w, img.h) * .12) r = Math.atan2(vy, vx) * 180 / Math.PI; // perto demais do pivô = sem direção
      }
    } catch { r = null; }
    this._eixos.set(ch, r); return r;
  },

  /* ---------- linha do tempo das poses do nó (calculada uma vez por mudança nas chaves) ---------- */
  _cache: new Map(),
  assinatura(n, def) {
    const s = JSON.stringify(n.chaves || {}); let h = 2166136261;
    for (let i = 0; i < s.length; i += 3) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return s.length + ':' + (h >>> 0) + ':' + (def.modificado || 0);
  },
  linha(n, def) {
    const sig = this.assinatura(n, def), c = this._cache.get(n.id); if (c && c.sig === sig) return c;
    const ks = Modelo.quadrosChave(n), estados = [];
    for (const k of (ks.length ? ks : [0])) {
      const e = Modelo.estadoPersonagem(n, k), dv = Modelo.naVista(def, e.vista);
      const pt = Modelo.partesNoEstado(dv, e), ant = estados[estados.length - 1];
      const chave = dv.partes.map(p => { const x = pt[p.id] || {}; return p.id + ':' + x.img + ':' + (x.r || 0) + ':' + (x.vis !== false); }).join('|') + '#' + (e.vista || '');
      if (ant && ant.chave === chave) continue; // pose igual (só mudou posição do nó): não é troca
      estados.push({ q: k, vista: e.vista || null, dv, pt, chave });
    }
    // trocas de cada parte: [{ q, de:{img,r}, para:{img,r} }]
    const trocas = {};
    for (let i = 1; i < estados.length; i++) {
      const a = estados[i - 1], b = estados[i]; if ((a.vista || '') !== (b.vista || '')) continue; // trocou de vista: sem transição
      for (const p of b.dv.partes) {
        const ea = a.pt[p.id], eb = b.pt[p.id]; if (!ea || !eb || ea.vis === false || eb.vis === false) continue;
        if (ea.img === eb.img && Math.abs((ea.r || 0) - (eb.r || 0)) < .01) continue;
        (trocas[p.id] ||= []).push({ q: b.q, dur: b.q - a.q, de: { img: ea.img, r: ea.r || 0 }, para: { img: eb.img, r: eb.r || 0 } });
      }
    }
    const out = { sig, estados, trocas, corpo: new Map() };
    this._cache.set(n.id, out); return out;
  },

  // quanto (graus) a parte gira de uma pose para a outra: diferença dos eixos dos desenhos + diferença do giro
  delta(p, t) {
    const ia = p.imgs.find(i => i.id === t.de.img), ib = p.imgs.find(i => i.id === t.para.img);
    let d = t.para.r - t.de.r, mesma = t.de.img === t.para.img;
    if (!mesma) { const ea = this.eixo(ia), eb = this.eixo(ib); if (ea == null || eb == null) return { d: 0, mesma, ok: false }; let x = (eb + t.para.r) - (ea + t.de.r); x = ((x + 540) % 360) - 180; d = x; }
    return { d, mesma, ok: true };
  },
  // mola amortecida: começa em 1 e chega em 0 passando um pouco do ponto
  mola(t) { if (t >= 1) return 0; return Math.exp(-4.2 * t) * Math.cos(2.5 * Math.PI * t) * (1 - t * t * t * .5); },
  ruido(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash(i + s * 13.1) * (1 - u) + hash(i + 1 + s * 13.1) * u) * 2 - 1; },
  semente(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h >>> 0) % 997; },

  // extra de giro de UMA parte no quadro q (antecipação da próxima troca + mola da última)
  giroParte(p, lista, q, fps, o) {
    if (!lista?.length || !o.mola) return { r: 0, ev: 0 };
    const ANT = Math.max(2, Math.round(fps * .12)), SET = Math.max(5, Math.round(fps * .42)), f = o.forca;
    let r = 0, ev = 0;
    // a última troca que já aconteceu
    let ult = null; for (const t of lista) { if (t.q <= q) ult = t; else break; }
    if (ult && q - ult.q < SET) {
      const { d, mesma, ok } = this.delta(p, ult);
      if (ok && Math.abs(d) > .5) { const ini = mesma ? d : Math.max(-30, Math.min(30, d * .5)); const t = (q - ult.q) / SET; r -= ini * this.mola(t) * (mesma ? 1 : f); ev = Math.max(ev, Math.min(1, Math.abs(d) / 110) * (1 - t)); }
    }
    // a PRÓXIMA troca (lê a próxima pose): recua para o lado contrário antes de ir
    const prox = lista.find(t => t.q > q);
    if (prox && prox.q - q <= ANT && prox.dur > ANT + 1) {
      const { d, mesma, ok } = this.delta(p, prox);
      if (ok && !mesma && Math.abs(d) > 8) { const t = 1 - (prox.q - q) / ANT; r -= Math.sign(d) * Math.min(Math.abs(d) * .1, 9) * f * Ease.inOut(Math.max(0, t)); }
    }
    return { r, ev };
  },

  // reação do corpo (raiz) no quadro q: { sy (esticar/agachar), r }
  corpoEm(def, n, L, q, fps, o) {
    const ch = q + ':' + o.forca + ':' + o.mola; if (L.corpo.has(ch)) return L.corpo.get(ch);
    let sy = 0, r = 0; const ANT = Math.max(2, Math.round(fps * .12)), SET = Math.max(5, Math.round(fps * .42)), f = o.forca;
    if (o.mola) {
      const dv = L.estados.length ? (L.estados.filter(e => e.q <= q).pop() || L.estados[0]).dv : Modelo.naVista(def, null);
      // junta as trocas de todas as partes que não são rosto, por quadro
      const porQ = new Map();
      for (const p of dv.partes) { const tp = this.tipo(p); if (tp === 'rosto' || tp === 'nada' || !L.trocas[p.id]) continue;
        for (const t of L.trocas[p.id]) { if (t.q < q - SET || t.q > q + ANT) continue; const { d, ok } = this.delta(p, t); if (!ok) continue; const v = porQ.get(t.q) || { m: 0, s: 0, dur: t.dur }; v.m += Math.abs(d); v.s += d; v.dur = Math.min(v.dur, t.dur); porQ.set(t.q, v); } }
      for (const [k, v] of porQ) {
        const m = Math.min(1, v.m / 140); if (m < .05) continue;
        if (k <= q) { const t = (q - k) / SET; if (t < 1) { const g = this.mola(t); sy += .022 * m * f * g; r += Math.max(-2.5, Math.min(2.5, -v.s * .02)) * f * g; } }
        else if (k - q <= ANT && v.dur > ANT + 1) { const t = 1 - (k - q) / ANT; sy -= .016 * m * f * Ease.inOut(t); }
      }
    }
    const out = { sy, r }; if (L.corpo.size > 5000) L.corpo.clear(); L.corpo.set(ch, out); return out;
  },

  /* ---------- aplica no estado das partes do quadro q (devolve um estado novo; o de entrada não muda) ---------- */
  aplica(P, n, q, dv, ep) {
    const def = P.personagens[n.ref]; if (!def) return ep; const o = this.opcoes(n), fps = P.fps || 24, f = o.forca;
    if (!(f > 0)) return ep;
    const L = this.linha(n, def), out = {}; for (const [k, v] of Object.entries(ep)) out[k] = { ...v };
    const raiz = dv.partes.find(p => p.id === dv.raiz) || dv.partes.find(p => !p.pai);
    const cp = raiz ? this.corpoEm(def, n, L, q, fps, o) : { sy: 0, r: 0 };
    // respiração (só o corpo; escala só na altura: s maior e sx compensa a largura)
    let resp = 0; if (o.resp) resp = Math.sin(q / fps * Math.PI * 2 / 3.1 + this.semente(n.id)) * .007 * Math.min(1.5, f);
    if (raiz && out[raiz.id]) { const e = out[raiz.id], k = 1 + resp + cp.sy; e.s = (e.s ?? 1) * k; e.sx = (e.sx || 1) / k; e.r = (e.r || 0) + cp.r; }
    // movimento do próprio nó (andar, pular, cair) para o cabelo atrasar
    let vx = 0, vr = 0, vy = 0;
    if (o.cabelo) { const t0 = Modelo.transf(n, q), t1 = Modelo.transf(n, Math.max(0, q - 3)); vx = (t0.x - t1.x) / 3; vy = (t0.y - t1.y) / 3; vr = (t0.r - t1.r) / 3; }
    const cpAntes = o.cabelo && raiz ? this.corpoEm(def, n, L, Math.max(0, q - 3), fps, o) : { r: 0 };
    for (const p of dv.partes) {
      const e = out[p.id]; if (!e || e.vis === false || p === raiz) continue; const tp = this.tipo(p), sem = this.semente(p.id);
      if (tp === 'rosto' || tp === 'nada') continue;
      if (tp === 'perna') { e.r = (e.r || 0) - cp.r; continue; } // pés no chão
      if (tp === 'cabelo') {
        if (!o.cabelo) continue;
        const lag = (cpAntes.r - cp.r) * 1.4 - vx * .045 - vr * .8 + Math.max(-4, Math.min(4, vy * .02));
        const vivo = this.ruido(q / fps * .9, sem) * 1.1 + Math.sin(q / fps * Math.PI * 2 / 2.3 + sem) * .5;
        e.r = (e.r || 0) + Math.max(-9, Math.min(9, lag * f)) + vivo * Math.min(1.5, f); continue;
      }
      // membros: antecipação + mola entre poses, e "pose viva"
      const g = this.giroParte(p, L.trocas[p.id], q, fps, o);
      e.r = (e.r || 0) + g.r;
      if (o.resp && p.pai) e.r += this.ruido(q / fps * .55, sem) * 1.3 * Math.min(1.5, f);
    }
    return out;
  },
};
