/* ===================== midia.js — MÍDIA: imagens guardadas para reaproveitar (peças de cenário, objetos…) =====================
   Fica neste computador: a lista no localStorage e as imagens no banco do navegador (loja "arquivos", ids "midia_…").
   Aparece na aba "Mídia" do painel da direita: pôr na cena, baixar, renomear (duplo clique) e tirar. */
'use strict';
const Midia = {
  CHAVE: 'animador-midia', urls: new Map(),
  lista() { try { const l = JSON.parse(localStorage.getItem(this.CHAVE) || '[]'); return Array.isArray(l) ? l : []; } catch { return []; } },
  salva(l) { try { localStorage.setItem(this.CHAVE, JSON.stringify(l)); } catch { UI.toast('Não consegui salvar a lista da Mídia (navegador sem espaço?).', { kind: 'err' }); } },
  async guardar(blob, nome, extra = {}) {
    const arq = await Arq.guardar(blob, uid('midia_')), bm = await createImageBitmap(blob).catch(() => null);
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
    const n = Modelo.novoNo('imagem', { arq: it.arq, nome: it.nome.slice(0, 40), s }); n.chaves[0].s = s; App.inserir(n, 'Imagem da Mídia');
  },
  async baixar(it) { const b = await Arq.pegaBlob(it.arq); if (!b) return UI.toast('Essa imagem não está mais neste computador.', { kind: 'err' }); downloadBlob(b, it.nome.replace(/[\\/:*?"<>|]+/g, '-') + '.png'); },
  async tirar(it) {
    if (!(await UI.confirm({ title: `Tirar "${esc(it.nome)}" da Mídia?`, msg: 'Se ela já está numa animação, continua lá.', ok: 'Tirar', danger: true }))) return;
    this.salva(this.lista().filter(x => x.id !== it.id));
    // só apaga o arquivo se nenhuma animação aberta usa (as salvas guardam a própria referência; o arquivo fica por segurança)
    Lado.pinta();
  },
  async doComputador() { const fs = await pickFiles('image/*', true); for (const f of fs) await this.guardar(f, f.name.replace(/\.[^.]+$/, '')); },
  pinta(el) {
    const l = this.lista();
    const topo = h(`<div class="sessao"><div class="campo2"><button class="btn sm" data-add>${ic('plus', 13)} Do computador</button><button class="btn sm" data-cen>${ic('paisagem', 13)} Cenários</button></div></div>`);
    $('[data-add]', topo).onclick = () => this.doComputador(); $('[data-cen]', topo).onclick = () => Cenarios.abrir(); el.appendChild(topo);
    if (!l.length) { el.appendChild(h('<div class="vazio">A Mídia está vazia.<br>Mande peças de um cenário para cá (janela <b>Cenário</b> → Peças) ou traga imagens do computador.</div>')); return; }
    const g = h('<div class="midia-grade"></div>');
    for (const it of l) {
      const c = h(`<div class="midia-it" title="${esc(it.nome)}${it.w ? ` — ${it.w}×${it.h}` : ''}&#10;Clique: pôr na cena · Duplo clique: renomear"><div class="th"></div><span>${esc(it.nome)}</span>
        <div class="ac"><button class="ibtn" data-b title="Baixar PNG">${ic('download', 12)}</button><button class="ibtn" data-x title="Tirar da Mídia">${ic('trash', 12)}</button></div></div>`);
      this.url(it).then(u => { if (u) $('.th', c).style.backgroundImage = `url('${u}'), repeating-conic-gradient(#3a3a3a 0 25%,#2e2e2e 0 50%)`; else $('.th', c).classList.add('falta'); });
      c.onclick = e => { if (e.target.closest('button')) return; this.porNaCena(it); };
      c.ondblclick = async e => { if (e.target.closest('button')) return; const n = await UI.prompt({ title: 'Nome da imagem', value: it.nome }); if (n) { const ls = this.lista(), x = ls.find(y => y.id === it.id); if (x) { x.nome = n.slice(0, 60); this.salva(ls); Lado.pinta(); } } };
      $('[data-b]', c).onclick = () => this.baixar(it); $('[data-x]', c).onclick = () => this.tirar(it);
      g.appendChild(c);
    }
    el.appendChild(g);
  },
};
