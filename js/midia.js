/* ===================== midia.js — MÍDIA: imagens guardadas para reaproveitar (peças de cenário, objetos…) =====================
   Fica neste computador: a lista no localStorage e as imagens no banco do navegador (loja "arquivos", ids "midia_…").
   Aparece na aba "Mídia" do painel da direita: pôr na cena, baixar, renomear (duplo clique) e tirar. */
'use strict';
const Midia = {
  CHAVE: 'animador-midia', urls: new Map(),
  lista() { try { const l = JSON.parse(localStorage.getItem(this.CHAVE) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } },
  salva(l) { try { localStorage.setItem(this.CHAVE, JSON.stringify(l)); } catch { UI.toast('Não consegui salvar a lista da Mídia (navegador sem espaço?).', { kind: 'err' }); } },
  async guardar(blob, nome, extra = {}) {
    const arq = await Arq.guardar(blob, uid('midia_')), bm = await Arq.deBlob(blob, arq);
    const it = { id: uid('m'), nome: String(nome || 'Imagem').slice(0, 60), arq, w: bm?.width || 0, h: bm?.height || 0, criado: Date.now(), ...extra };
    const l = this.lista(); l.unshift(it); this.salva(l); if (bm) Arq.img.set(arq, bm);
    window.EstudioConta?.espaco?.atualizar?.(); if (Lado.atual === 'midia') Lado.pinta();
    return it;
  },
  async url(it) { if (this.urls.has(it.arq)) return this.urls.get(it.arq); const b = await Arq.pegaBlob(it.arq); if (!b) return null; const u = URL.createObjectURL(b); this.urls.set(it.arq, u); return u; },
  async porNaCena(it) {
    const P = App.P, bm = await new Promise(ok => { const b = Arq.bitmap(it.arq, ok); if (b) ok(b); });
    if (!bm) return UI.toast('Essa imagem não está mais neste computador.', { kind: 'err' });
    const s = round(Math.min(1, P.w * .8 / bm.width, P.h * .8 / bm.height), 3);
    const n = Modelo.novoNo('imagem', { arq: it.arq, nome: it.nome.slice(0, 40), s }); n.chaves[0].s = s; if (it.vetor || bm instanceof HTMLImageElement) n.vetor = true; App.inserir(n, 'Imagem da Mídia');
  },
  async baixar(it) { const b = await Arq.pegaBlob(it.arq); if (!b) return UI.toast('Essa imagem não está mais neste computador.', { kind: 'err' }); downloadBlob(b, it.nome.replace(/[\\/:*?"<>|]+/g, '-') + (b.type === 'image/svg+xml' ? '.svg' : '.png')); },
  async tirar(it) {
    if (!(await UI.confirm({ title: `Tirar "${esc(it.nome)}" da Mídia?`, msg: 'Se ela já está numa animação, continua lá.', ok: 'Tirar', danger: true }))) return;
    this.salva(this.lista().filter(x => x.id !== it.id));
    // só apaga o arquivo se nenhuma animação aberta usa (as salvas guardam a própria referência; o arquivo fica por segurança)
    Lado.pinta();
  },
  async doComputador() { const fs = await pickFiles('image/*', true); for (const f of fs) { const { blob, svg } = await Vetor.blobDeArquivo(f); await this.guardar(blob, f.name.replace(/\.[^.]+$/, ''), svg ? { vetor: true } : {}); } },
  // pastas da Mídia (neste computador): [{ nome, cor }]
  pastas() { try { const l = JSON.parse(localStorage.getItem(this.CHAVE + '-pastas') || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } },
  salvaPastas(l) { try { localStorage.setItem(this.CHAVE + '-pastas', JSON.stringify(l)); } catch { } },
  mudaItem(id, f) { const l = this.lista(), x = l.find(y => y.id === id); if (x) { f(x); this.salva(l); } Lado.pinta(); },
  async novaPasta() { const n = (await UI.prompt({ title: 'Pasta nova na Mídia', label: 'Ex.: árvores, móveis, céus', value: '' }))?.trim().slice(0, 40); if (!n) return null; const ps = this.pastas(); if (!ps.some(p => p.nome === n)) { ps.push({ nome: n }); this.salvaPastas(ps); } Lado.pinta(); return n; },
  pinta(el) {
    const l = this.lista(), ps = this.pastas(), fechadas = this.fechadas || (this.fechadas = new Set());
    const topo = h(`<div class="sessao"><div class="campo2"><button class="btn sm" data-add>${ic('plus', 13)} Do computador</button><button class="btn sm ia" data-cen>${ic('paisagem', 13)} Cenários</button><button class="btn sm" data-pasta>${ic('folder', 13)} Pasta</button></div></div>`);
    $('[data-add]', topo).onclick = () => this.doComputador(); $('[data-cen]', topo).onclick = () => Cenarios.abrir(); $('[data-pasta]', topo).onclick = () => this.novaPasta(); el.appendChild(topo);
    if (!l.length && !ps.length) { el.appendChild(h('<div class="vazio">A Mídia está vazia.<br>Mande peças de um cenário para cá (janela <b>Cenário</b> → Peças) ou traga imagens do computador.</div>')); return; }
    const solta = (alvo, pasta) => {
      alvo.ondragover = e => { if (e.dataTransfer.types.includes('text/midia')) { e.preventDefault(); alvo.classList.add('drop-dentro'); } };
      alvo.ondragleave = e => { if (!alvo.contains(e.relatedTarget)) alvo.classList.remove('drop-dentro'); };
      alvo.ondrop = e => { e.preventDefault(); e.stopPropagation(); alvo.classList.remove('drop-dentro'); const id = e.dataTransfer.getData('text/midia'); if (id) this.mudaItem(id, x => { if (pasta) x.pasta = pasta; else delete x.pasta; }); };
    };
    const grade = itens => { const g = h('<div class="midia-grade"></div>'); for (const it of itens) g.appendChild(this.card(it, l, ps)); return g; };
    for (const pa of ps) {
      const dentro = l.filter(it => it.pasta === pa.nome), aberta = !fechadas.has(pa.nome);
      const cab = h(`<div class="midia-pasta ${pa.cor ? 'com-cor' : ''}" style="${pa.cor ? `--pc:${pa.cor}` : ''}" title="Clique: abrir/fechar · solte imagens aqui · botão direito: opções">${ic(aberta ? 'down' : 'right', 12)}${ic('folder', 14)}<b>${esc(pa.nome)}</b><small>${dentro.length}</small></div>`);
      cab.onclick = () => { aberta ? fechadas.add(pa.nome) : fechadas.delete(pa.nome); Lado.pinta(); };
      cab.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [
        menuCor(pa.cor, c => { const L = this.pastas(), x = L.find(y => y.nome === pa.nome); if (x) { if (c) x.cor = c; else delete x.cor; this.salvaPastas(L); } Lado.pinta(); }),
        { label: 'Renomear a pasta', icon: 'edit', action: async () => { const n = (await UI.prompt({ title: 'Nome da pasta', value: pa.nome }))?.trim().slice(0, 40); if (!n || n === pa.nome) return; const L = this.pastas(); if (L.some(y => y.nome === n)) return UI.toast('Já existe uma pasta com esse nome'); L.find(y => y.nome === pa.nome).nome = n; this.salvaPastas(L); const it = this.lista(); it.forEach(x => { if (x.pasta === pa.nome) x.pasta = n; }); this.salva(it); Lado.pinta(); } },
        '-', { label: 'Desfazer a pasta (as imagens ficam)', icon: 'trash', action: () => { this.salvaPastas(this.pastas().filter(y => y.nome !== pa.nome)); const it = this.lista(); it.forEach(x => { if (x.pasta === pa.nome) delete x.pasta; }); this.salva(it); Lado.pinta(); } },
      ]); };
      solta(cab, pa.nome); el.appendChild(cab);
      if (aberta) { const g = grade(dentro); if (!dentro.length) g.appendChild(h('<div class="vazio" style="grid-column:1/-1;padding:6px">Arraste imagens para cá.</div>')); solta(g, pa.nome); el.appendChild(g); }
    }
    const soltas = l.filter(it => !it.pasta || !ps.some(p => p.nome === it.pasta));
    if (ps.length && soltas.length) el.appendChild(h(`<div class="midia-pasta solta">${ic('image', 14)}<b>Sem pasta</b><small>${soltas.length}</small></div>`));
    const g = grade(soltas); solta(g, null); el.appendChild(g);
  },
  card(it, l, ps) {
    const c = h(`<div class="midia-it" draggable="true" title="${esc(it.nome)}${it.w ? ` — ${it.w}×${it.h}` : ''}&#10;Clique: pôr na cena · Duplo clique: renomear · arraste para uma pasta"><div class="th"></div><span>${esc(it.nome)}</span>
      <div class="ac"><button class="ibtn" data-b title="Baixar PNG">${ic('download', 12)}</button><button class="ibtn" data-x title="Tirar da Mídia">${ic('trash', 12)}</button></div></div>`);
    this.url(it).then(u => { if (u) $('.th', c).style.backgroundImage = `url('${u}'), repeating-conic-gradient(#3a3a3a 0 25%,#2e2e2e 0 50%)`; else $('.th', c).classList.add('falta'); });
    c.onclick = e => { if (e.target.closest('button')) return; this.porNaCena(it); };
    c.ondblclick = async e => { if (e.target.closest('button')) return; const n = await UI.prompt({ title: 'Nome da imagem', value: it.nome }); if (n) this.mudaItem(it.id, x => { x.nome = n.slice(0, 60); }); };
    c.ondragstart = e => { e.dataTransfer.setData('text/midia', it.id); e.dataTransfer.effectAllowed = 'move'; };
    c.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [
      { label: 'Pôr na cena', icon: 'plus', action: () => this.porNaCena(it) },
      { label: 'Mover para a pasta', icon: 'folder', sub: [{ label: '(sem pasta)', checked: !it.pasta, action: () => this.mudaItem(it.id, x => { delete x.pasta; }) }, ...ps.map(p => ({ label: p.nome, checked: it.pasta === p.nome, action: () => this.mudaItem(it.id, x => { x.pasta = p.nome; }) })), '-', { label: 'Pasta nova…', icon: 'plus', action: async () => { const n = await this.novaPasta(); if (n) this.mudaItem(it.id, x => { x.pasta = n; }); } }] },
      { label: 'Baixar PNG', icon: 'download', action: () => this.baixar(it) }, '-', { label: 'Tirar da Mídia', icon: 'trash', danger: true, action: () => this.tirar(it) },
    ]); };
    $('[data-b]', c).onclick = () => this.baixar(it); $('[data-x]', c).onclick = () => this.tirar(it);
    return c;
  },
};
