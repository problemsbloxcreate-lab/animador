/* ===================== camadas.js — imagem com CAMADAS no Ateliê (estilo Photoshop) =====================
   img.camadas = [{ id, nome, k, op, modo, vis }] (a primeira é a de baixo), img.camAtiva = id da camada em que se pinta.
   Todas as camadas têm o tamanho da imagem. img.k continua sendo a imagem final (achatada): o palco, o editor, a nuvem e as
   animações não precisam saber de camadas. Cada mudança grava chaves novas (o Ctrl+Z do Ateliê volta tudo).
   As chaves das camadas entram em Modelo.chavesImgs (vão para a nuvem, backup e .atelieanimador). */
'use strict';
const Camadas = {
  MODOS: [['source-over', 'Normal'], ['multiply', 'Multiplicar'], ['screen', 'Tela'], ['overlay', 'Sobrepor'], ['darken', 'Escurecer'], ['lighten', 'Clarear'], ['color-dodge', 'Subexposição de cor'], ['color-burn', 'Superexposição de cor'],
    ['hard-light', 'Luz forte'], ['soft-light', 'Luz suave'], ['difference', 'Diferença'], ['exclusion', 'Exclusão'], ['hue', 'Matiz'], ['saturation', 'Saturação'], ['color', 'Cor'], ['luminosity', 'Luminosidade']],
  tem(img) { return !!img?.camadas?.length; },
  ativa(img) { return img.camadas.find(c => c.id === img.camAtiva) || img.camadas[img.camadas.length - 1]; },
  tamanho(img) { const b = Arq.img.get(img.camadas?.[0]?.k) || Arq.img.get(img.k); return b ? [b.width, b.height] : [Math.round(img.w), Math.round(img.h)]; },
  async garante(img) { await Arq.garantir([img.k, ...(img.camadas || []).map(c => c.k)]); },
  // junta as camadas (de baixo para cima); troca = { idDaCamada: canvas } para mostrar um traço ainda sendo feito
  compoe(img, troca = {}) {
    const [W, H] = this.tamanho(img), cv = new OffscreenCanvas(W, H), x = cv.getContext('2d');
    for (const c of img.camadas) { if (c.vis === false) continue; const bm = troca[c.id] || Arq.img.get(c.k); if (!bm) continue; x.globalAlpha = c.op ?? 1; x.globalCompositeOperation = c.modo || 'source-over'; x.drawImage(bm, 0, 0, W, H); }
    return cv;
  },
  async chave(blob) { const iid = uid('im').toLowerCase().replace(/[^a-z0-9]/g, ''), k = `personagens/${Atelie.def.id}/img/${iid}.png`; await Arq.guardar(blob, k); Arq.img.set(k, await createImageBitmap(blob)); return k; },
  async guarda(cv) { try { cv.getContext?.('2d'); } catch { } /* canvas sem desenho não vira PNG sem um contexto */ return this.chave(await cv.convertToBlob({ type: 'image/png' })); },
  // refaz a imagem final (img.k) a partir das camadas
  async achata(img) { await this.garante(img); img.k = await this.guarda(this.compoe(img)); return img.k; },
  async mudou(img) { await this.achata(img); Atelie.commit(); },
  // ---------- virar imagem com camadas / voltar a ser simples ----------
  async virar(img, quieto) {
    if (this.tem(img)) return; await Arq.garantir([img.k]); const id = uid('cm');
    img.camadas = [{ id, nome: img.nome || 'Camada 1', k: img.k, op: 1, modo: 'source-over', vis: true }]; img.camAtiva = id; if (quieto) return; Atelie.commit();
    UI.toast(`<b>${esc(img.nome)}</b> agora tem camadas: veja em <b>Pintar e cores › Camadas</b>.`, { kind: 'ok' });
  },
  async achatarTudo(img) { if (!this.tem(img)) return; await this.achata(img); delete img.camadas; delete img.camAtiva; Atelie.commit(); UI.toast('Camadas juntadas: voltou a ser uma imagem só (Ctrl+Z desfaz).', { kind: 'ok' }); },
  // ---------- camadas novas ----------
  async poe(img, cv, nome, acima = true) {
    const k = await this.guarda(cv), c = { id: uid('cm'), nome: nome || `Camada ${img.camadas.length + 1}`, k, op: 1, modo: 'source-over', vis: true }, i = img.camadas.findIndex(x => x.id === img.camAtiva);
    img.camadas.splice(acima && i >= 0 ? i + 1 : img.camadas.length, 0, c); img.camAtiva = c.id; await this.mudou(img); return c;
  },
  async vazia(img) { const [W, H] = this.tamanho(img); return this.poe(img, new OffscreenCanvas(W, H), `Camada ${img.camadas.length + 1}`); },
  // um desenho (bitmap) vira camada: centralizado; escala = quantos pixels desta imagem valem um pixel dele (para manter o tamanho no palco)
  async deBitmap(img, bm, nome, escala = 1) {
    const [W, H] = this.tamanho(img), cv = new OffscreenCanvas(W, H), x = cv.getContext('2d'); let w = bm.width * escala, h = bm.height * escala;
    const caber = Math.min(1, W / w, H / h); w *= caber; h *= caber; x.imageSmoothingQuality = 'high'; x.drawImage(bm, (W - w) / 2, (H - h) / 2, w, h);
    return this.poe(img, cv, nome);
  },
  async deArquivo(img, f) { const bm = await createImageBitmap(f); return this.deBitmap(img, bm, f.name.replace(/\.[^.]+$/, '').slice(0, 40)); },
  // outra imagem do personagem vira camada desta, no mesmo tamanho que ela tem no palco
  async deImagem(img, outra) {
    await Arq.garantir([outra.k, img.k]); const bo = Arq.img.get(outra.k), [W] = this.tamanho(img); if (!bo) return;
    const pxPorUnidade = W / img.w, escala = (outra.w * pxPorUnidade) / bo.width; return this.deBitmap(img, bo, outra.nome, escala);
  },
  // ---------- mexer nas camadas ----------
  async duplicar(img, c) { const bm = Arq.img.get(c.k); if (!bm) return; const [W, H] = this.tamanho(img), cv = new OffscreenCanvas(W, H); cv.getContext('2d').drawImage(bm, 0, 0); img.camAtiva = c.id; const n = await this.poe(img, cv, c.nome + ' (cópia)'); n.op = c.op; n.modo = c.modo; await this.mudou(img); },
  async apagar(img, c) { if (img.camadas.length < 2) return UI.toast('A imagem precisa de pelo menos uma camada (ou junte tudo).', { kind: 'warn' }); const i = img.camadas.indexOf(c); img.camadas.splice(i, 1); img.camAtiva = img.camadas[Math.max(0, i - 1)].id; await this.mudou(img); },
  async mesclarAbaixo(img, c) {
    const i = img.camadas.indexOf(c); if (i < 1) return; const de = img.camadas[i - 1], [W, H] = this.tamanho(img), cv = new OffscreenCanvas(W, H), x = cv.getContext('2d');
    x.globalAlpha = de.op ?? 1; x.globalCompositeOperation = de.modo || 'source-over'; if (de.vis !== false) x.drawImage(Arq.img.get(de.k), 0, 0); x.globalAlpha = c.op ?? 1; x.globalCompositeOperation = c.modo || 'source-over'; if (c.vis !== false) x.drawImage(Arq.img.get(c.k), 0, 0);
    de.k = await this.guarda(cv); de.op = 1; de.modo = 'source-over'; de.vis = true; img.camadas.splice(i, 1); img.camAtiva = de.id; await this.mudou(img);
  },
  async ordem(img, c, d) { const i = img.camadas.indexOf(c), j = i + d; if (j < 0 || j >= img.camadas.length) return; [img.camadas[i], img.camadas[j]] = [img.camadas[j], img.camadas[i]]; await this.mudou(img); },
  async moverPara(img, c, j) { const i = img.camadas.indexOf(c); if (i < 0 || j === i) return; img.camadas.splice(i, 1); img.camadas.splice(clamp(j, 0, img.camadas.length), 0, c); await this.mudou(img); },
  // move os pixels da camada (ferramenta "Mover camada")
  deslocado(bm, dx, dy) { const cv = new OffscreenCanvas(bm.width, bm.height); cv.getContext('2d').drawImage(bm, Math.round(dx), Math.round(dy)); return cv; },
  // ---------- painel (aba Pintar e cores) ----------
  painel(el) {
    const a = Pintura.alvo(), box = h(`<div class="sessao cam-sec"><h4>${ic('layers', 13)} Camadas</h4></div>`); el.appendChild(box);
    if (!a) { box.appendChild(h('<div class="vazio">Escolha uma parte com imagem.</div>')); return; }
    const img = a.img;
    // imagem sem camadas: já aparece com a camada pronta (a própria imagem); a primeira coisa que mexer nas camadas cria de verdade
    if (!this.tem(img)) {
      const r = h(`<div class="cam-lista"><div class="cam-l on" title="A imagem inteira é a primeira camada. Ponha mais camadas com os botões de baixo."><span class="ibtn" style="opacity:.5">${ic('eye', 13)}</span><canvas width="40" height="40"></canvas><span class="nm">${esc(img.nome || 'Camada 1')}</span><small>100%</small></div></div>`);
      const bm = Arq.img.get(img.k); if (bm) { const x = $('canvas', r).getContext('2d'), k = Math.min(40 / bm.width, 40 / bm.height); x.drawImage(bm, (40 - bm.width * k) / 2, (40 - bm.height * k) / 2, bm.width * k, bm.height * k); }
      box.appendChild(r);
      const outras = Atelie.def.partes.flatMap(p => p.imgs.filter(i => i !== img).map(i => ({ p, i })));
      const bar = h(`<div class="cam-bar"><button class="btn sm" data-n title="Camada vazia por cima">${ic('plus', 12)} Camada</button><button class="btn sm" data-f title="Uma imagem do computador vira camada">${ic('upload', 12)} Imagem…</button><button class="btn sm" data-o2 title="Outra imagem do personagem vira camada" ${outras.length ? '' : 'disabled'}>${ic('image', 12)} Do personagem</button></div>`);
      $('[data-n]', bar).onclick = async () => { await this.virar(img, true); await this.vazia(img); };
      $('[data-f]', bar).onclick = async () => { const fs = await pickFiles('image/*', true); if (!fs?.length) return; await this.virar(img, true); for (const f of fs) await this.deArquivo(img, f); };
      $('[data-o2]', bar).onclick = ev => UI.ctx(ev.clientX, ev.clientY, [{ head: 'Pôr como camada' }, ...[...new Set(outras.map(o => o.p))].map(p => ({ label: p.nome, icon: 'layers', sub: outras.filter(o => o.p === p).map(o => ({ label: o.i.nome, img: o.i.k, action: async () => { await this.virar(img, true); await this.deImagem(img, o.i); } })) }))]);
      box.appendChild(bar); return;
    }
    const lista = h('<div class="cam-lista"></div>'); box.appendChild(lista);
    [...img.camadas].reverse().forEach(c => { // de cima para baixo, como no Photoshop
      const at = c.id === img.camAtiva, r = h(`<div class="cam-l ${at ? 'on' : ''}" draggable="true" title="Clique: pintar nesta camada · duplo clique: renomear · arraste para mudar a ordem"><button class="ibtn" data-v title="Mostrar/esconder">${ic(c.vis === false ? 'eyeOff' : 'eye', 13)}</button><canvas width="40" height="40"></canvas><span class="nm">${esc(c.nome)}</span><small>${Math.round((c.op ?? 1) * 100)}%${c.modo && c.modo !== 'source-over' ? ' · ' + (this.MODOS.find(m => m[0] === c.modo)?.[1] || '') : ''}</small></div>`);
      const bm = Arq.img.get(c.k); if (bm) { const x = $('canvas', r).getContext('2d'), k = Math.min(40 / bm.width, 40 / bm.height); x.drawImage(bm, (40 - bm.width * k) / 2, (40 - bm.height * k) / 2, bm.width * k, bm.height * k); }
      r.onclick = ev => { if (ev.target.closest('[data-v]')) { c.vis = c.vis === false; return this.mudou(img); } img.camAtiva = c.id; Atelie.commit(); };
      r.ondblclick = async () => { const n = (await UI.prompt({ title: 'Nome da camada', value: c.nome }))?.trim(); if (n) { c.nome = n.slice(0, 40); Atelie.commit(); } };
      r.oncontextmenu = ev => { ev.preventDefault(); img.camAtiva = c.id; UI.ctx(ev.clientX, ev.clientY, [{ head: c.nome },
        { label: 'Duplicar camada', icon: 'dup', action: () => this.duplicar(img, c) }, { label: 'Mesclar com a de baixo', icon: 'down', disabled: img.camadas.indexOf(c) < 1, action: () => this.mesclarAbaixo(img, c) },
        { label: 'Subir', icon: 'up', action: () => this.ordem(img, c, 1) }, { label: 'Descer', icon: 'down', action: () => this.ordem(img, c, -1) },
        { label: 'Transformar (tamanho, giro, espelhar)…', icon: 'move', action: () => Ajustes.transformar() }, { label: 'Ajustes de cor…', icon: 'palette', action: () => Ajustes.abrir() },
        '-', { label: 'Apagar camada', icon: 'trash', danger: true, action: () => this.apagar(img, c) }]); };
      r.ondragstart = ev => { ev.dataTransfer.setData('text/camada', c.id); }; r.ondragover = ev => { if (ev.dataTransfer.types.includes('text/camada')) { ev.preventDefault(); r.classList.add('drop-dentro'); } }; r.ondragleave = () => r.classList.remove('drop-dentro');
      r.ondrop = ev => { ev.preventDefault(); r.classList.remove('drop-dentro'); const de = img.camadas.find(x => x.id === ev.dataTransfer.getData('text/camada')); if (de && de !== c) this.moverPara(img, de, img.camadas.indexOf(c)); };
      lista.appendChild(r); });
    const c = this.ativa(img), op = h(`<div class="cam-op"><select data-m title="Modo de mistura">${this.MODOS.map(([v, n]) => `<option value="${v}" ${(c.modo || 'source-over') === v ? 'selected' : ''}>${n}</option>`).join('')}</select><input type="range" min="0" max="100" value="${Math.round((c.op ?? 1) * 100)}" data-o title="Opacidade"><output>${Math.round((c.op ?? 1) * 100)}%</output></div>`);
    $('[data-m]', op).onchange = ev => { c.modo = ev.target.value; this.mudou(img); };
    // prévia da opacidade por cima da imagem final; ao soltar, a de antes volta a ser a original (senão o Ctrl+Z mostraria a prévia)
    $('[data-o]', op).oninput = ev => { op._orig ??= [img.k, Arq.img.get(img.k)]; c.op = +ev.target.value / 100; $('output', op).textContent = ev.target.value + '%'; Arq.img.set(img.k, this.compoe(img)); Atelie.desenha(); };
    $('[data-o]', op).onchange = async () => { const o = op._orig; op._orig = null; try { await this.achata(img); } finally { if (o?.[1]) Arq.img.set(o[0], o[1]); } Atelie.commit(); }; // a prévia fica até a imagem nova estar pronta (sem piscar)
    box.appendChild(op);
    const outras = Atelie.def.partes.flatMap(p => p.imgs.filter(i => i !== img).map(i => ({ p, i })));
    const bar = h(`<div class="cam-bar"><button class="btn sm" data-n title="Camada vazia">${ic('plus', 12)} Camada</button><button class="btn sm" data-f title="Uma imagem do computador vira camada">${ic('upload', 12)} Imagem…</button><button class="btn sm" data-o2 title="Outra imagem do personagem vira camada" ${outras.length ? '' : 'disabled'}>${ic('image', 12)} Do personagem</button><button class="btn sm" data-a title="Junta tudo: volta a ser uma imagem só">Juntar tudo</button></div>`);
    $('[data-n]', bar).onclick = () => this.vazia(img);
    $('[data-f]', bar).onclick = async () => { const fs = await pickFiles('image/*', true); for (const f of fs || []) await this.deArquivo(img, f); };
    $('[data-o2]', bar).onclick = ev => UI.ctx(ev.clientX, ev.clientY, [{ head: 'Pôr como camada' }, ...[...new Set(outras.map(o => o.p))].map(p => ({ label: p.nome, icon: 'layers', sub: outras.filter(o => o.p === p).map(o => ({ label: o.i.nome, img: o.i.k, action: () => this.deImagem(img, o.i) })) }))]);
    $('[data-a]', bar).onclick = () => this.achatarTudo(img);
    box.appendChild(bar);
  },
};
