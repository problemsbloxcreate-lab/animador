/* ===================== cenaedit.js — EDITOR DE CENÁRIO (janela "Cenário") =====================
   Depois de gerar (pronto ou IA), o cenário vira PEÇAS separadas (cada objeto "o") que dá para:
   escolher clicando · arrastar (Shift = só numa direção) · mudar o tamanho pelos cantos · setas mexem (Shift = 20 px) ·
   trocar a imagem de uma peça · pôr imagens novas (botão ou soltar arquivos) · frente/trás · travar · tirar · Ctrl+Z ·
   CITAR uma peça (ou uma ÁREA) em mensagens · pedir para a IA mudar SÓ aquela peça (ou só aquela área).
   ÁREA: arrastar começando numa peça travada (o Fundo) ou com Alt desenha um retângulo.
   Peça = { id, nome, tipo:'ia'|'img', camadas, idx (sementes do tremido), cv, x, y, w, h, trava, k (imagem guardada) }.
   O estado ({ nome, pecas }) fica no cenário posto na cena (pasta.cenaEd / no.cenaEd): botão direito › "Editar cenário". */
'use strict';
Object.assign(Cenarios, {
  // uma peça desenhada a partir das camadas dela (recortada, com a posição no cenário)
  async desenhaPeca(camadas, idx) {
    const bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    for (const L of camadas) { if (L.degrade || !L.f?.length) continue; const b = this.caixa(L.f); bb.x0 = Math.min(bb.x0, b.x0 - 22); bb.y0 = Math.min(bb.y0, b.y0 - 22); bb.x1 = Math.max(bb.x1, b.x1 + 22); bb.y1 = Math.max(bb.y1, b.y1 + 22); }
    const x = clamp(Math.floor(bb.x0), 0, this.W), y = clamp(Math.floor(bb.y0), 0, this.H), w = clamp(Math.ceil(bb.x1), 0, this.W) - x, h = clamp(Math.ceil(bb.y1), 0, this.H) - y;
    if (w <= 0 || h <= 0) return null;
    return { cv: await this.compor(camadas, idx, { x, y, w, h }, false), x, y, w, h };
  },
  // mexe nas formas: f(x, y) → [x, y] e k = quanto os tamanhos (raio, espessura, escala) mudam
  mapaCamadas(camadas, f, k = 1) {
    const r1 = v => Math.round(v * 10) / 10;
    return camadas.map(L => {
      if (L.degrade) { const g = { ...L.degrade }; g.de = r1(f(0, g.de)[1]); g.ate = r1(f(0, g.ate)[1]); return { ...L, degrade: g }; }
      return { ...L, f: (L.f || []).map(s => {
        const t = s[0], v = s.slice(1), P = i => { const [a, b] = f(v[i], v[i + 1]); v[i] = a; v[i + 1] = b; };
        if (t === 'ret' || t === 'elipse') { P(0); P(2); }
        else if (t === 'red' || t === 'anel') { P(0); P(2); v[4] *= k; }
        else if (t === 'arco') { P(0); P(2); v[6] *= k; }
        else if (t === 'poli') { for (let i = 0; i + 1 < v.length; i += 2) P(i); }
        else if (t === 'linha') { v[0] *= k; for (let i = 1; i + 1 < v.length; i += 2) P(i); }
        else if (t === 'nuvem') { P(0); v[2] = clamp(v[2] * k, .2, 4); }
        else if (t === 'copa') { P(0); v[2] *= k; v[3] *= k; }
        return [t, ...v.map((x, i) => t === 'arco' && (i === 4 || i === 5) ? x : r1(x))];
      }) };
    });
  },
  // cenário (JSON) → peças do editor
  async estadoDe(cena, prog) {
    const ps = await this.desenharPecas(cena, prog);
    return { nome: cena?.nome || 'Cenário', ia: !!cena?.ia, pecas: ps.map((p, i) => ({ id: uid('pc'), nome: p.nome, tipo: 'ia', camadas: p.camadas, idx: p.idx, cv: p.cv, x: p.x, y: p.y, w: p.w, h: p.h,
      trava: i === 0 && p.x <= 0 && p.y <= 0 && p.w >= this.W - 1 && p.h >= this.H - 1 })) };
  },
  // peças do editor → cenário (JSON) só com as peças desenhadas (as imagens da pessoa não entram)
  cenaDe(est) {
    const camadas = [];
    for (const p of est.pecas) if (p.tipo === 'ia') p.camadas.forEach((L, i) => camadas.push(i === 0 ? { ...L, o: p.nome } : (({ o, ...r }) => r)(L)));
    return { nome: est.nome, camadas, ...(est.ia ? { ia: true } : {}) };
  },
  // cenário inteiro desenhado a partir das peças (1920×1080, fundo branco)
  compoe(est, larg = this.W) {
    const k = larg / this.W, cv = document.createElement('canvas'); cv.width = larg; cv.height = Math.round(this.H * k);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.imageSmoothingQuality = 'high';
    for (const p of est.pecas) if (!p.oculta) g.drawImage(p.cv, p.x * k, p.y * k, p.w * k, p.h * k);
    return cv;
  },
  // guardar no projeto (imagens da pessoa vão para o Arq; as peças da IA se redesenham das camadas)
  async serial(est) {
    const pecas = [];
    for (const p of est.pecas) {
      const o = { id: p.id, nome: p.nome, tipo: p.tipo, x: p.x, y: p.y, w: p.w, h: p.h, trava: !!p.trava };
      if (p.tipo === 'ia') Object.assign(o, { camadas: p.camadas, idx: p.idx });
      else { if (!p.k) p.k = await Arq.guardar(await this.blob(p.cv)); o.k = p.k; }
      pecas.push(o);
    }
    return { nome: est.nome, ia: !!est.ia, pecas };
  },
  async deSerial(s) {
    const pecas = [];
    for (const o of s?.pecas || []) {
      if (o.tipo === 'ia') { const d = await this.desenhaPeca(o.camadas, o.idx); if (d) pecas.push({ ...o, cv: d.cv }); continue; }
      let cv = null;
      if (o.k) { const b = await Arq.pegaBlob(o.k).catch(() => null); if (b) cv = await CenaEd.canvasDe(b); }
      else if (o.durl) cv = await CenaEd.canvasDe(await (await fetch(o.durl)).blob());
      if (cv) pecas.push({ ...o, cv });
    }
    return { nome: s?.nome || 'Cenário', ia: !!s?.ia, pecas };
  },
  // arquivo .cenario (para citar em mensagens): o estado com as imagens dentro
  async arquivo(est) {
    const s = await this.serial(est);
    for (const o of s.pecas) if (o.tipo === 'img') { const p = est.pecas.find(x => x.id === o.id); o.durl = p.cv.toDataURL('image/png'); delete o.k; }
    return new Blob([JSON.stringify({ v: 1, tipo: 'cenario-animador', ...s })], { type: 'application/json' });
  },
  async abrirArquivo(f, parte) {
    const j = JSON.parse(await f.text());
    if (j?.tipo === 'cenario-camadas') { if (!App.P) await Home.nova({ w: 1920, h: 1080, fps: 24 }, { nome: 'Cenário: ' + String(j.nome || '').slice(0, 30) }); for (let i = 0; i < 50 && !App.P; i++) await sleep(100); return CenLib.abrir({ def: { ...(await CenLib.importar(j)), origem: 'meu' } }); } // cenário em camadas (js/cenlib.js)
    if (j?.tipo !== 'cenario-animador') throw new Error('Este arquivo não é um cenário do Animador.');
    if (!App.P) await Home.nova({ w: 1920, h: 1080, fps: 24 }, { nome: 'Cenário: ' + String(j.nome || '').slice(0, 30) });
    for (let i = 0; i < 50 && !App.P; i++) await sleep(100);
    return this.abrir({ estado: await this.deSerial(j), sel: parte?.peca || null, area: parte?.area || null });
  },

  /* ---------- IA: mudar SÓ uma peça (ou só uma área) ---------- */
  async pedirPeca(est, peca, pedido) {
    const caixa = p => [Math.round(p.x), Math.round(p.y), Math.round(p.x + p.w), Math.round(p.y + p.h)];
    const outros = est.pecas.filter(p => p !== peca).map(p => ({ objeto: p.nome, caixa: caixa(p) }));
    const fig = CenaEd.miniDe(peca.cv, 512);
    const txt = `CENÁRIO "${est.nome}". Os outros objetos e onde estão (caixas x0,y0,x1,y1 na tela 1920×1080): ${JSON.stringify(outros)}
OBJETO PARA MUDAR: "${peca.nome}", na caixa ${JSON.stringify(caixa(peca))}${peca.tipo === 'ia' ? `, desenhado hoje assim: ${JSON.stringify(peca.camadas)}` : ' (hoje é uma imagem que a pessoa pôs; a figura mostra como ela é: redesenhe no estilo da casa)'}.
A figura acima é esse objeto como está agora.
PEDIDO: ${String(pedido).slice(0, 600)}
Devolva SÓ esse objeto já mudado, no mesmo formato: {"total":N,"camadas":[{"o":"${peca.nome}","c":"#RRGGBB","f":[...]}, ...]}. Mantenha no mesmo lugar e do mesmo tamanho (a não ser que o pedido peça outra coisa). NÃO desenhe o fundo nem os outros objetos.`;
    const out = await IA.chama(await this.sistema(), [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: fig.split(',')[1] } }, { type: 'text', text: txt }]);
    const r = this.limpar(this.lerJSON(out).j, true); if (!r.uteis) throw new Error('A IA não devolveu a peça. Tente explicar de outro jeito.');
    const camadas = r.cena.camadas.map((L, i) => { const { o, ...resto } = L; return i === 0 ? { o: peca.nome, ...resto } : resto; });
    const base = peca.idx?.[0] ?? (500 + (Math.random() * 400 | 0)), idx = camadas.map((_, i) => base + i);
    const d = await this.desenhaPeca(camadas, idx); if (!d) throw new Error('A peça nova ficou fora da tela.');
    return { ...peca, tipo: 'ia', camadas, idx, cv: d.cv, x: d.x, y: d.y, w: d.w, h: d.h, k: undefined };
  },
  // o cenário inteiro (com o que foi mexido à mão); com área, só o que encosta nela pode mudar
  async pedirTudo(est, pedido, area, aoEscrever, aoTentar) {
    const imgs = est.pecas.filter(p => p.tipo === 'img').map(p => `"${p.nome}" em [${[p.x, p.y, p.x + p.w, p.y + p.h].map(Math.round)}]`);
    const extra = (imgs.length ? `\n(Há imagens postas pela pessoa que ficam como estão, não desenhe por cima delas: ${imgs.join(', ')}.)` : '')
      + (area ? `\nMUDE SÓ O QUE ESTÁ NA ÁREA x0,y0,x1,y1 = [${[area.x, area.y, area.x + area.w, area.y + area.h].map(Math.round)}]; os objetos fora dela têm que voltar exatamente iguais.` : '');
    const r = await this.pedirIA(pedido + extra, this.cenaDe(est), aoEscrever, aoTentar);
    const novo = await this.estadoDe(r.cena);
    const toca = p => !area || (p.x < area.x + area.w && p.x + p.w > area.x && p.y < area.y + area.h && p.y + p.h > area.y);
    // fora da área: as peças antigas voltam (mesmo nome); as imagens da pessoa voltam no mesmo lugar da pilha
    const antigas = new Map(est.pecas.filter(p => p.tipo === 'ia').map(p => [p.nome, p]));
    let pecas = novo.pecas.map(p => { const a = antigas.get(p.nome); return area && a && !toca(a) ? a : a ? { ...p, id: a.id, trava: a.trava } : p; });
    if (area) for (const a of antigas.values()) if (!toca(a) && !pecas.includes(a)) pecas.push(a);
    est.pecas.forEach((p, i) => { if (p.tipo === 'img') pecas.splice(Math.min(i, pecas.length), 0, p); });
    return { ...r, estado: { nome: r.cena.nome || est.nome, ia: true, pecas } };
  },
});

/* ---------- a parte da tela: palco com peças, barra da peça escolhida e lista ---------- */
const CenaEd = {
  async canvasDe(blob) { const bm = await createImageBitmap(blob); const c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); bm.close?.(); return c; },
  miniDe(cv, max = 240, fundo) { const k = Math.min(1, max / Math.max(cv.width, cv.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(cv.width * k)); c.height = Math.max(1, Math.round(cv.height * k)); const g = c.getContext('2d'); if (fundo) { g.fillStyle = fundo; g.fillRect(0, 0, c.width, c.height); } g.drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL(fundo ? 'image/jpeg' : 'image/png', .85); },
  // o = { pc (canvas da prévia), barra, lista, aoMudar(), aoEscolher(), ia(pecaOuArea), citar(peca|area), midia(peca), baixar(peca), ocupado() }
  criar(o) {
    const ed = { est: null, sel: null, area: null, desf: [], ref: [], o }, pc = o.pc, W = Cenarios.W, H = Cenarios.H;
    const k = () => pc.width / W, aTela = e => { const r = pc.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    const peca = id => ed.est?.pecas.find(p => p.id === id);
    ed.foto = () => ed.est.pecas.map(p => ({ ...p }));
    ed.guarda = () => { ed.desf.push(ed.foto()); if (ed.desf.length > 60) ed.desf.shift(); ed.ref = []; };
    ed.desfaz = (volta) => { const de = volta ? ed.ref : ed.desf, para = volta ? ed.desf : ed.ref; const s = de.pop(); if (!s) return; para.push(ed.foto()); ed.est.pecas = s; if (!peca(ed.sel)) ed.sel = null; ed.pinta(); o.aoMudar?.(); };
    ed.usa = (est, sel, area) => { ed.est = est; ed.sel = sel && est.pecas.find(p => p.id === sel || p.nome === sel)?.id || null; ed.area = area || null; ed.desf = []; ed.ref = []; ed.pinta(); };
    // ---- desenho ----
    ed.desenha = (vivo) => {
      const g = pc.getContext('2d'), s = k(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#fff'; g.fillRect(0, 0, pc.width, pc.height); g.imageSmoothingQuality = 'high';
      if (!ed.est) return;
      for (const p of ed.est.pecas) { const v = vivo?.id === p.id ? vivo : p; if (p.oculta) continue; g.drawImage(p.cv, v.x * s, v.y * s, v.w * s, v.h * s); }
      const p = peca(ed.sel); if (p) { const v = vivo?.id === p.id ? vivo : p;
        g.save(); g.strokeStyle = '#19d3f0'; g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(v.x * s, v.y * s, v.w * s, v.h * s); g.setLineDash([]);
        if (!p.trava) { g.fillStyle = '#19d3f0'; for (const [cx, cy] of ed.cantos(v)) g.fillRect(cx * s - 5, cy * s - 5, 10, 10); }
        g.fillStyle = 'rgba(0,0,0,.7)'; g.font = '600 12px sans-serif'; const t = p.nome + (p.trava ? ' (travada)' : ''), tw = g.measureText(t).width + 10, ty = Math.max(0, v.y * s - 20);
        g.fillRect(v.x * s, ty, tw, 18); g.fillStyle = '#fff'; g.fillText(t, v.x * s + 5, ty + 13); g.restore(); }
      const a = vivo?.area || ed.area; if (a) { g.save(); g.fillStyle = 'rgba(25,211,240,.12)'; g.fillRect(a.x * s, a.y * s, a.w * s, a.h * s); g.strokeStyle = '#ffd36b'; g.lineWidth = 2; g.setLineDash([5, 4]); g.strokeRect(a.x * s, a.y * s, a.w * s, a.h * s); g.restore(); }
    };
    ed.cantos = v => [[v.x, v.y], [v.x + v.w, v.y], [v.x + v.w, v.y + v.h], [v.x, v.y + v.h]];
    // ---- quem está debaixo do mouse (pela cor de verdade, não só a caixa) ----
    ed.acha = (x, y) => {
      const ps = ed.est?.pecas || [];
      for (let i = ps.length - 1; i >= 0; i--) { const p = ps[i]; if (p.oculta || x < p.x || y < p.y || x > p.x + p.w || y > p.y + p.h) continue;
        try { const px = Math.floor((x - p.x) / p.w * p.cv.width), py = Math.floor((y - p.y) / p.h * p.cv.height); if (p.cv.getContext('2d', { willReadFrequently: true }).getImageData(px, py, 1, 1).data[3] > 25) return p; } catch { return p; } }
      return null;
    };
    // ---- mouse: escolher, arrastar, cantos (tamanho), área ----
    pc.addEventListener('pointerdown', e => {
      if (!ed.est || o.ocupado?.() || e.button !== 0) return; pc.focus(); const [x, y] = aTela(e), s = k(); let modo = null, p = peca(ed.sel), canto = -1;
      if (p && !p.trava) canto = ed.cantos(p).findIndex(([cx, cy]) => Math.abs(cx - x) * s < 9 && Math.abs(cy - y) * s < 9);
      if (canto >= 0) modo = 'tam'; else { const achada = e.altKey ? null : ed.acha(x, y); if (achada && !achada.trava) { p = achada; modo = 'mover'; } else { p = achada; modo = 'area'; } }
      if (p?.id !== ed.sel || modo === 'area') { ed.sel = p?.id || null; if (modo !== 'area' || p) ed.area = null; o.aoEscolher?.(); ed.pinta(); }
      pc.setPointerCapture(e.pointerId); const x0 = x, y0 = y, v0 = p ? { id: p.id, x: p.x, y: p.y, w: p.w, h: p.h } : null; let vivo = null, mexeu = false;
      const move = ev => { const [mx, my] = aTela(ev); let dx = mx - x0, dy = my - y0; if (!mexeu && Math.hypot(dx, dy) * s < 3) return; mexeu = true;
        if (modo === 'mover') { if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; } vivo = { ...v0, x: v0.x + dx, y: v0.y + dy }; }
        else if (modo === 'tam') { const fx = canto === 0 || canto === 3 ? v0.x + v0.w : v0.x, fy = canto < 2 ? v0.y + v0.h : v0.y; // canto fixo do outro lado
          const cx = canto === 0 || canto === 3 ? -v0.w : v0.w, cy = canto < 2 ? -v0.h : v0.h, kk = Math.max(10 / Math.min(v0.w, v0.h), ((mx - fx) * cx + (my - fy) * cy) / (v0.w * v0.w + v0.h * v0.h)), w = v0.w * kk, h = v0.h * kk; // o quanto o mouse andou na direção do canto
          vivo = { ...v0, w, h, x: canto === 0 || canto === 3 ? fx - w : fx, y: canto < 2 ? fy - h : fy, kk }; }
        else vivo = { area: { x: Math.min(x0, mx), y: Math.min(y0, my), w: Math.abs(mx - x0), h: Math.abs(my - y0) } };
        ed.desenha(vivo); };
      const sobe = async () => { pc.removeEventListener('pointermove', move); pc.removeEventListener('pointerup', sobe); pc.removeEventListener('pointercancel', sobe);
        if (!mexeu || !vivo) { if (modo === 'area' && !mexeu) { ed.area = null; ed.pinta(); } return; }
        if (modo === 'area') { ed.area = vivo.area.w * s > 6 && vivo.area.h * s > 6 ? vivo.area : null; if (ed.area) { ed.sel = null; o.aoEscolher?.(); } ed.pinta(); return; }
        await ed.poe(p, vivo); };
      pc.addEventListener('pointermove', move); pc.addEventListener('pointerup', sobe); pc.addEventListener('pointercancel', sobe);
    });
    // mudar lugar/tamanho de verdade (a peça da IA se redesenha com as formas no lugar novo, sem perder o jeito)
    ed.poe = async (p, v) => {
      ed.guarda(); const i = ed.est.pecas.indexOf(p); if (i < 0) return;
      if (p.tipo === 'img') ed.est.pecas[i] = { ...p, x: v.x, y: v.y, w: v.w, h: v.h };
      else { const kk = v.w / p.w, f = (x, y) => [v.x + (x - p.x) * kk, v.y + (y - p.y) * kk], camadas = Cenarios.mapaCamadas(p.camadas, f, kk), d = await Cenarios.desenhaPeca(camadas, p.idx);
        ed.est.pecas[i] = d ? { ...p, camadas, cv: d.cv, x: d.x, y: d.y, w: d.w, h: d.h } : { ...p, camadas, x: v.x, y: v.y, w: v.w, h: v.h }; }
      ed.pinta(); o.aoMudar?.();
    };
    pc.addEventListener('mousemove', e => { if (!ed.est || e.buttons) return; const [x, y] = aTela(e), s = k(), p = peca(ed.sel);
      pc.style.cursor = p && !p.trava && ed.cantos(p).some(([cx, cy]) => Math.abs(cx - x) * s < 9 && Math.abs(cy - y) * s < 9) ? 'nwse-resize' : (ed.acha(x, y)?.trava === false ? 'move' : 'crosshair'); });
    pc.addEventListener('contextmenu', e => { e.preventDefault(); if (!ed.est || o.ocupado?.()) return; const [x, y] = aTela(e), a = ed.area && x >= ed.area.x && y >= ed.area.y && x <= ed.area.x + ed.area.w && y <= ed.area.y + ed.area.h ? ed.area : null;
      if (!a) { const p = ed.acha(x, y); ed.sel = p?.id || null; ed.area = null; o.aoEscolher?.(); ed.pinta(); }
      ed.menu(e.clientX, e.clientY); });
    pc.tabIndex = 0;
    const tecla = e => { // teclas valem com a janela aberta (menos escrevendo num campo); some quando a janela fecha
      if (!pc.isConnected) return document.removeEventListener('keydown', tecla);
      if (document.querySelectorAll('.modal-back').length > 1 || document.querySelector('.ctx')) return;
      if (!ed.est || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || o.ocupado?.()) return; const p = peca(ed.sel), ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopPropagation(); ed.desfaz(e.shiftKey); return; }
      if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); e.stopPropagation(); ed.desfaz(true); return; }
      if (!p) return;
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (d && !p.trava) { e.preventDefault(); e.stopPropagation(); const n = e.shiftKey ? 20 : 2; ed.poe(p, { x: p.x + d[0] * n, y: p.y + d[1] * n, w: p.w, h: p.h }); }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); ed.tira(p); }
    };
    document.addEventListener('keydown', tecla);
    // soltar imagens no palco = peças novas onde soltou
    pc.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); e.stopPropagation(); } });
    pc.addEventListener('drop', async e => { const fs = [...(e.dataTransfer?.files || [])].filter(f => /^image\//.test(f.type) || /\.svg$/i.test(f.name)); if (!fs.length || !ed.est) return; e.preventDefault(); e.stopPropagation();
      const [x, y] = aTela(e); await ed.addImagens(fs, x, y); });
    // ---- ações ----
    ed.addImagens = async (fs, cx, cy) => {
      const files = typeof semVetor === 'function' ? await semVetor(fs) : fs; let ultima = null; ed.guarda();
      for (const f of files) { let cv; try { cv = await CenaEd.canvasDe(f); } catch { UI.toast(`Não abri a imagem "${esc(f.name)}".`, { kind: 'err' }); continue; }
        const kk = Math.min(1, 640 / Math.max(cv.width, cv.height)), w = cv.width * kk, h = cv.height * kk, n = ed.est.pecas.length;
        ultima = { id: uid('pc'), nome: String(f.name || 'Imagem').replace(/\.[^.]+$/, '').slice(0, 30) || 'Imagem', tipo: 'img', cv, w, h, x: (cx ?? W / 2) - w / 2 + (cx == null ? n % 5 * 30 : 0), y: (cy ?? H * .55) - h / 2, trava: false };
        ed.est.pecas.push(ultima); }
      if (ultima) { ed.sel = ultima.id; ed.area = null; o.aoEscolher?.(); } ed.pinta(); o.aoMudar?.();
    };
    ed.trocar = async p => { const [f] = await pickFiles('image/*', false); if (!f) return; let cv; try { cv = await CenaEd.canvasDe(f); } catch { return UI.toast('Não abri essa imagem.', { kind: 'err' }); }
      ed.guarda(); const kk = Math.min(p.w / cv.width, p.h / cv.height), w = cv.width * kk, h = cv.height * kk; // cabe na caixa da peça, apoiada embaixo
      const i = ed.est.pecas.indexOf(p); ed.est.pecas[i] = { ...p, tipo: 'img', cv, camadas: undefined, idx: undefined, k: undefined, w, h, x: p.x + (p.w - w) / 2, y: p.y + p.h - h }; ed.pinta(); o.aoMudar?.(); };
    ed.ordem = (p, para) => { const L = ed.est.pecas, i = L.indexOf(p), j = clamp(para === 'frente' ? L.length - 1 : para === 'tras' ? 0 : i + para, 0, L.length - 1); if (i === j) return; ed.guarda(); L.splice(i, 1); L.splice(j, 0, p); ed.pinta(); o.aoMudar?.(); };
    ed.tira = p => { ed.guarda(); ed.est.pecas = ed.est.pecas.filter(x => x !== p); if (ed.sel === p.id) ed.sel = null; ed.pinta(); o.aoMudar?.(); };
    ed.trava = p => { ed.guarda(); const i = ed.est.pecas.indexOf(p); ed.est.pecas[i] = { ...p, trava: !p.trava }; ed.pinta(); };
    ed.renomear = async p => { const n = await UI.prompt({ title: 'Nome da peça', value: p.nome }); if (!n?.trim()) return; ed.guarda(); const i = ed.est.pecas.indexOf(p); ed.est.pecas[i] = { ...p, nome: n.trim().slice(0, 30) }; ed.pinta(); o.aoMudar?.(); };
    ed.menu = (x, y) => {
      const p = peca(ed.sel), a = ed.area;
      UI.ctx(x, y, a && !p ? [{ head: 'Área escolhida' }, { label: 'Pedir para a IA mudar só esta área…', icon: 'sparkles', ai: true, action: () => o.ia(null, a) }, { label: 'Citar esta área em mensagens…', icon: 'chat', action: () => o.citar(null, a) }, { label: 'Tirar a área', icon: 'x', action: () => { ed.area = null; ed.pinta(); } }]
        : p ? [{ head: p.nome },
          { label: 'Pedir para a IA mudar só esta peça…', icon: 'sparkles', ai: true, action: () => o.ia(p) },
          { label: 'Citar esta peça em mensagens…', icon: 'chat', action: () => o.citar(p) }, '-',
          { label: 'Trocar a imagem…', icon: 'image', action: () => ed.trocar(p) }, { label: 'Renomear…', icon: 'edit', action: () => ed.renomear(p) },
          { label: 'Para a frente de tudo', icon: 'up', action: () => ed.ordem(p, 'frente') }, { label: 'Para trás de tudo', icon: 'down', action: () => ed.ordem(p, 'tras') },
          { label: p.trava ? 'Destravar (poder mover)' : 'Travar no lugar', icon: p.trava ? 'unlock' : 'lock', action: () => ed.trava(p) }, '-',
          { label: 'Mandar para a Mídia', icon: 'upload', action: () => o.midia(p) }, { label: 'Baixar PNG', icon: 'download', action: () => o.baixar(p) },
          { label: 'Tirar a peça', icon: 'trash', danger: true, key: 'Del', action: () => ed.tira(p) }]
          : [{ label: 'Pôr imagem…', icon: 'plus', action: async () => ed.addImagens(await pickFiles('image/*', true)) }, { label: 'Dica: arraste no fundo (ou com Alt) para escolher uma área', icon: 'info', disabled: true }]);
    };
    // ---- barra da peça escolhida + lista ----
    ed.pinta = () => { ed.desenha(); ed.pintaBarra(); ed.pintaLista(); o.aoEscolher?.(); };
    ed.pintaBarra = () => {
      const b = o.barra; if (!b) return; const p = peca(ed.sel), a = !p && ed.area;
      b.innerHTML = `<button class="btn sm" data-add title="Pôr imagens do computador (ou solte no cenário)">${ic('plus', 13)} Imagem</button>
        <button class="ibtn" data-un title="Desfazer (Ctrl+Z)" ${ed.desf.length ? '' : 'disabled'}>${ic('undo', 14)}</button><button class="ibtn" data-re title="Refazer (Ctrl+Shift+Z)" ${ed.ref.length ? '' : 'disabled'}>${ic('redo', 14)}</button><span class="ce-sep"></span>
        ${p ? `<b class="ce-nome" title="Clique para renomear">${esc(p.nome)}</b>
          <button class="btn sm ia" data-ia title="A IA muda só esta peça (escreva o que mudar no campo de cima)">${ic('sparkles', 13)} Mudar com a IA</button>
          <button class="ibtn" data-cit title="Citar esta peça em mensagens">${ic('chat', 14)}</button><button class="ibtn" data-tr title="Trocar a imagem">${ic('image', 14)}</button>
          <button class="ibtn" data-fr title="Mais para a frente">${ic('up', 14)}</button><button class="ibtn" data-tz title="Mais para trás">${ic('down', 14)}</button>
          <button class="ibtn" data-tv title="${p.trava ? 'Destravar' : 'Travar no lugar'}">${ic(p.trava ? 'lock' : 'unlock', 14)}</button><button class="ibtn" data-x title="Tirar a peça (Del)">${ic('trash', 14)}</button>`
        : a ? `<b class="ce-nome">Área ${Math.round(a.w)}×${Math.round(a.h)}</b><button class="btn sm ia" data-iaa>${ic('sparkles', 13)} Mudar só a área com a IA</button><button class="ibtn" data-cita title="Citar esta área em mensagens">${ic('chat', 14)}</button><button class="ibtn" data-xa title="Tirar a área">${ic('x', 14)}</button>`
        : '<small class="ce-dica">Clique numa peça para escolher · arraste para mover · cantos mudam o tamanho · arraste no fundo (ou com Alt) para escolher uma área · botão direito: mais</small>'}`;
      const on = (s, f) => { const el = $(s, b); if (el) el.onclick = f; };
      on('[data-add]', async () => ed.addImagens(await pickFiles('image/*', true))); on('[data-un]', () => ed.desfaz(false)); on('[data-re]', () => ed.desfaz(true));
      if (p) { on('.ce-nome', () => ed.renomear(p)); on('[data-ia]', () => o.ia(p)); on('[data-cit]', () => o.citar(p)); on('[data-tr]', () => ed.trocar(p)); on('[data-fr]', () => ed.ordem(p, 1)); on('[data-tz]', () => ed.ordem(p, -1)); on('[data-tv]', () => ed.trava(p)); on('[data-x]', () => ed.tira(p)); }
      if (a) { on('[data-iaa]', () => o.ia(null, a)); on('[data-cita]', () => o.citar(null, a)); on('[data-xa]', () => { ed.area = null; ed.pinta(); }); }
    };
    ed.pintaLista = () => {
      const l = o.lista; if (!l) return; l.innerHTML = '';
      for (const p of [...(ed.est?.pecas || [])].reverse()) { // a da frente em cima
        const it = h(`<div class="cen-peca ${p.id === ed.sel ? 'sel' : ''}" title="${esc(p.nome)} — ${Math.round(p.w)}×${Math.round(p.h)}${p.tipo === 'img' ? ' (imagem)' : ''}"><canvas></canvas><span>${esc(p.nome)}</span>${p.trava ? ic('lock', 11) : ''}${p.tipo === 'img' ? ic('image', 11) : ''}</div>`);
        const c = $('canvas', it), r = Math.min(64 / p.cv.width, 40 / p.cv.height); c.width = Math.max(1, p.cv.width * r); c.height = Math.max(1, p.cv.height * r); c.getContext('2d').drawImage(p.cv, 0, 0, c.width, c.height);
        it.onclick = () => { ed.sel = p.id; ed.area = null; o.aoEscolher?.(); ed.pinta(); pc.focus(); };
        it.oncontextmenu = e => { e.preventDefault(); ed.sel = p.id; ed.area = null; o.aoEscolher?.(); ed.pinta(); ed.menu(e.clientX, e.clientY); };
        l.appendChild(it);
      }
    };
    return ed;
  },
};
