/* ===================== animacoes.js — aba "Animações" do Ateliê: animações de teste do personagem =====================
   Igual ao antigo "Encaixe da Lumi", só que dentro do programa: cada animação tem TRILHAS (ex.: pernas andando + boca falando
   + olhos piscando) e cada trilha é uma fila de PASSOS. Um passo diz o que muda: presets das sessões (s) e imagens/giro das partes (p).
     passo = { s:{ sessaoId: presetId }, p:{ parteId:{ img, r } } }
   As trilhas andam juntas (cada uma volta ao começo quando acaba), uma troca a cada `vel` ms.
   Gravar um passo = o que está escolhido no modo Testar. No editor, "Pôr no quadro" escreve a animação como chaves. */
'use strict';
const VELOCIDADES = [[80, '0,08 s'], [120, '0,12 s'], [180, '0,18 s'], [250, '0,25 s'], [400, '0,4 s'], [700, '0,7 s'], [1000, '1 s']];
const Animacoes = {
  sel: null, passo: null, tocando: null, _t: null,
  get def() { return Atelie.def; },
  lista() { const d = this.def; return d ? (d.animacoes ||= []) : []; },
  achar(id = this.sel) { return this.lista().find(a => a.id === id) || null; },
  // texto curto de um passo (para o botão do passo)
  rotulo(p) {
    const d = this.def, out = [];
    for (const [sid, pid] of Object.entries(p.s || {})) { const s = d.sessoes.find(x => x.id === sid); const pr = s?.presets.find(x => x.id === pid); out.push(pr ? pr.nome : '?'); }
    for (const [pid, e] of Object.entries(p.p || {})) { const pt = Atelie.parte(pid); const im = pt?.imgs.find(i => i.id === e.img); out.push((im ? im.nome : pt?.nome || '?') + (e.r ? ` ${e.r > 0 ? '+' : ''}${e.r}°` : '')); }
    return out.join(' · ') || '(base)';
  },
  detalhe(p) {
    const d = this.def, l = [];
    for (const [sid, pid] of Object.entries(p.s || {})) { const s = d.sessoes.find(x => x.id === sid); l.push(`${s?.nome || '?'}: ${s?.presets.find(x => x.id === pid)?.nome || '?'}`); }
    for (const [pid, e] of Object.entries(p.p || {})) { const pt = Atelie.parte(pid); l.push(`${pt?.nome || '?'}: ${pt?.imgs.find(i => i.id === e.img)?.nome || '—'}${e.r ? ` (giro ${e.r}°)` : ''}`); }
    return l.join('\n') || 'nada muda (base)';
  },

  /* ---------- tocar ---------- */
  aplicar(passos) { // passos: um por trilha
    const T = Atelie.teste || (Atelie.teste = { sessoes: {}, partes: {} });
    for (const p of passos) { if (!p) continue; Object.assign(T.sessoes, p.s || {}); for (const [pid, e] of Object.entries(p.p || {})) T.partes[pid] = { ...e }; }
  },
  tocar(a) {
    this.parar(true); if (!a) return; const trilhas = (a.trilhas || []).filter(t => t.length); if (!trilhas.length) return UI.toast('Essa animação ainda não tem passos. Escolha no Testar e clique em "+ Passo".', { kind: 'warn' });
    Atelie.edit = null; Atelie.teste = { sessoes: {}, partes: {} }; this.tocando = a.id; this.sel = a.id; this.passo = null;
    let i = 0; const vai = () => { if (!Atelie.teste || this.tocando !== a.id) return this.parar(); Atelie.teste = { sessoes: {}, partes: {} }; this.aplicar(trilhas.map(t => t[i % t.length])); i++; Atelie.desenha(); Atelie.pintaTeste(); };
    vai(); this._t = setInterval(vai, +a.vel || 250); Atelie.pinta();
  },
  parar(quieto) { clearInterval(this._t); this._t = null; const tinha = this.tocando; this.tocando = null; if (tinha && !quieto) Atelie.pinta(); },
  mostrarPasso(a, ti, pi) { this.parar(true); Atelie.edit = null; Atelie.teste = { sessoes: {}, partes: {} }; this.sel = a.id; this.passo = { t: ti, i: pi };
    // o passo aparece por cima do que as outras trilhas têm no passo 1, para ver o conjunto
    this.aplicar(a.trilhas.map((t, n) => n === ti ? null : t[0])); this.aplicar([a.trilhas[ti][pi]]); Atelie.pinta(); },
  // o que está escolhido agora no Testar vira um passo
  passoDaTela() { const T = Atelie.teste || { sessoes: {}, partes: {} }; return { s: clone(T.sessoes || {}), p: clone(T.partes || {}) }; },

  /* ---------- mexer ---------- */
  async nova() {
    const nome = await UI.prompt({ title: 'Animação de teste nova', label: 'Nome (ex.: Andar, Falar, Piscar, Acenar)', ok: 'Criar' }); if (!nome) return;
    const a = { id: uid('an'), nome, vel: 250, trilhas: [[]] }; this.lista().push(a); this.sel = a.id; Atelie.commit();
    if (!Atelie.teste) Atelie.testar(true); UI.toast('Escolha no painel Testar o que aparece no 1º passo e clique em <b>+ Passo</b>. Repita para os próximos.', { kind: 'ok', time: 7000 });
  },
  menu(ev, a) {
    UI.ctx(ev.clientX, ev.clientY, [
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome da animação', value: a.nome }); if (n) { a.nome = n; Atelie.commit(); } } },
      { label: 'Duplicar', icon: 'dup', action: () => { const c = clone(a); c.id = uid('an'); c.nome += ' 2'; const L = this.lista(); L.splice(L.indexOf(a) + 1, 0, c); this.sel = c.id; Atelie.commit(); } },
      { label: 'Trilha nova', icon: 'plus', action: () => { a.trilhas.push([]); this.sel = a.id; Atelie.commit(); } },
      '-', { label: 'Apagar a animação', icon: 'trash', danger: true, action: async () => { if (!(await UI.confirm({ title: `Apagar "${esc(a.nome)}"?`, ok: 'Apagar', danger: true }))) return; this.parar(true); this.def.animacoes = this.lista().filter(x => x !== a); if (this.sel === a.id) this.sel = null; Atelie.commit(); } },
    ]);
  },
  menuPasso(ev, a, ti, pi) {
    const t = a.trilhas[ti], p = t[pi], itens = [
      ...Object.keys(p.s || {}).map(sid => ({ label: `Tirar "${this.def.sessoes.find(x => x.id === sid)?.nome || '?'}" deste passo`, icon: 'x', action: () => { delete p.s[sid]; Atelie.commit(); } })),
      ...Object.keys(p.p || {}).map(pid => ({ label: `Tirar "${Atelie.parte(pid)?.nome || '?'}" deste passo`, icon: 'x', action: () => { delete p.p[pid]; Atelie.commit(); } })),
    ];
    UI.ctx(ev.clientX, ev.clientY, [
      { label: 'Mostrar este passo', icon: 'eye', action: () => this.mostrarPasso(a, ti, pi) },
      { label: 'Trocar pelo que está no Testar', icon: 'redo', action: () => { t[pi] = this.passoDaTela(); Atelie.commit(); } },
      { label: 'Duplicar', icon: 'dup', action: () => { t.splice(pi + 1, 0, clone(p)); Atelie.commit(); } },
      { label: 'Para a esquerda', icon: 'left', disabled: !pi, action: () => { [t[pi - 1], t[pi]] = [t[pi], t[pi - 1]]; Atelie.commit(); } },
      { label: 'Para a direita', icon: 'right', disabled: pi >= t.length - 1, action: () => { [t[pi + 1], t[pi]] = [t[pi], t[pi + 1]]; Atelie.commit(); } },
      ...(itens.length ? ['-', ...itens] : []),
      '-', { label: 'Apagar o passo', icon: 'trash', danger: true, action: () => { t.splice(pi, 1); this.passo = null; Atelie.commit(); } },
    ]);
  },

  /* ---------- aba ---------- */
  pinta(el) {
    const L = this.lista(), def = this.def;
    const topo = h(`<div class="anims-at"><div class="campo2"><button class="btn sm" data-nova>${ic('plus', 13)} Animação</button><button class="btn sm ia" data-ia title="A IA cria animações de teste (andar, falar, piscar…) com as peças que existem">${ic('sparkles', 13)} Criar com a IA</button><span class="sp"></span>${this.tocando ? `<button class="btn sm" data-parar>${ic('pause', 12)} Parar</button>` : ''}</div></div>`);
    $('[data-nova]', topo).onclick = () => this.nova(); $('[data-ia]', topo).onclick = () => Atelie.ia('animacoes'); if ($('[data-parar]', topo)) $('[data-parar]', topo).onclick = () => this.parar();
    if (!L.length) topo.appendChild(h('<div class="vazio">Animações de teste mostram o personagem se mexendo (andar, falar, piscar, acenar…) para conferir se as peças encaixam.<br><br>Crie uma, ou peça para a <b>IA organizar tudo</b>.</div>'));
    for (const a of L) {
      const aberta = this.sel === a.id, toca = this.tocando === a.id, nP = a.trilhas.reduce((n, t) => Math.max(n, t.length), 0);
      const c = h(`<div class="anim ${aberta ? 'aberta' : ''} ${toca ? 'toca' : ''}"><div class="cab"><button class="ibtn play" title="${toca ? 'Parar' : 'Tocar'}">${ic(toca ? 'pause' : 'play', 13)}</button><b>${esc(a.nome)}</b><small>${a.trilhas.length > 1 ? a.trilhas.length + ' trilhas · ' : ''}${nP} passo${nP === 1 ? '' : 's'}</small><span class="sp"></span>
        <select data-vel title="Troca a cada">${VELOCIDADES.map(([v, t]) => `<option value="${v}" ${+a.vel === v ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="ibtn" data-m title="Mais">${ic('dots', 13)}</button></div></div>`);
      $('.play', c).onclick = () => toca ? this.parar() : this.tocar(a);
      $('.cab', c).onclick = ev => { if (ev.target.closest('button,select')) return; this.sel = aberta ? null : a.id; Atelie.pinta(); };
      $('[data-vel]', c).onchange = ev => { a.vel = +ev.target.value; Atelie.commit({ soDesenho: true }); if (toca) this.tocar(a); };
      $('[data-m]', c).onclick = ev => this.menu(ev, a); c.oncontextmenu = ev => { ev.preventDefault(); this.menu(ev, a); };
      if (aberta) {
        a.trilhas.forEach((t, ti) => {
          const tr = h(`<div class="trilha"><div class="tr-t">Trilha ${ti + 1}${a.trilhas.length > 1 ? `<button class="ibtn" data-xt title="Apagar a trilha">${ic('x', 11)}</button>` : ''}</div><div class="passos"></div></div>`), ps = $('.passos', tr);
          t.forEach((p, pi) => { const on = this.passo?.t === ti && this.passo?.i === pi;
            const b = h(`<button class="passo ${on ? 'on' : ''}" title="${esc(this.detalhe(p))}\n\nClique: mostrar · botão direito: opções"><i>${pi + 1}</i><span>${esc(this.rotulo(p))}</span></button>`);
            b.onclick = () => this.mostrarPasso(a, ti, pi); b.oncontextmenu = ev => { ev.preventDefault(); this.menuPasso(ev, a, ti, pi); }; ps.appendChild(b); });
          const add = h(`<button class="passo add" title="O que está escolhido no Testar vira um passo">${ic('plus', 12)} Passo</button>`);
          add.onclick = () => { if (!Atelie.teste) { Atelie.testar(true); return UI.toast('Escolha no Testar o que este passo mostra e clique em + Passo de novo.'); } t.push(this.passoDaTela()); this.passo = { t: ti, i: t.length - 1 }; Atelie.commit(); };
          ps.appendChild(add);
          if ($('[data-xt]', tr)) $('[data-xt]', tr).onclick = () => { a.trilhas.splice(ti, 1); this.passo = null; Atelie.commit(); };
          c.appendChild(tr);
        });
        const mais = h(`<div class="campo2" style="padding:4px 8px 8px"><button class="btn sm" data-tr>${ic('plus', 12)} Trilha</button><span class="dica-a">Trilhas andam juntas: ex. pernas andando + boca falando + olhos piscando.</span></div>`);
        $('[data-tr]', mais).onclick = () => { a.trilhas.push([]); Atelie.commit(); }; c.appendChild(mais);
      }
      topo.appendChild(c);
    }
    el.appendChild(topo); el.appendChild(this.pintaVisual());
  },

  /* ---------- visualização: fundo do palco e fantasma (uma imagem de referência por cima, meio transparente) ---------- */
  vis() { return (this.def.vis ||= { fundo: 'xadrez' }); },
  pintaVisual() {
    const v = this.vis(), f = v.fantasma;
    const box = h(`<div class="props"><div class="titulo-p">Visualização</div>
      <label class="field">Fundo do palco<select data-fundo><option value="xadrez">Transparente (xadrez)</option><option value="branco">Branco</option><option value="cenario">Cenário colorido</option></select></label>
      <div class="campo2"><label class="chk"><input type="checkbox" data-fon ${f?.on ? 'checked' : ''} ${f ? '' : 'disabled'}> Fantasma por cima</label><span class="sp"></span><button class="btn sm" data-fimg>${ic('image', 12)} ${f ? 'Trocar' : 'Escolher'} imagem</button>${f ? `<button class="ibtn" data-fx title="Tirar o fantasma">${ic('x', 12)}</button>` : ''}</div></div>`);
    $('[data-fundo]', box).value = v.fundo || 'xadrez'; $('[data-fundo]', box).onchange = ev => { v.fundo = ev.target.value; Atelie.commit(); };
    $('[data-fon]', box).onchange = ev => { f.on = ev.target.checked; Atelie.commit(); };
    $('[data-fimg]', box).onclick = () => this.escolherFantasma();
    if ($('[data-fx]', box)) $('[data-fx]', box).onclick = () => { delete v.fantasma; Atelie.commit(); };
    if (f) { const sol = () => Atelie.commit({ soDesenho: true }), mx = Math.max(f.w, f.h) * 1.5;
      box.appendChild(Lado.campo('Opacidade', f.op ?? .35, .05, 1, .01, x => { f.op = x; Atelie.desenha(); }, sol));
      box.appendChild(Lado.campo('Posição X', f.x, -mx, mx, 1, x => { f.x = x; Atelie.desenha(); }, sol)); box.appendChild(Lado.campo('Posição Y', f.y, -mx, mx, 1, x => { f.y = x; Atelie.desenha(); }, sol));
      box.appendChild(Lado.campo('Tamanho', f.s ?? 1, .1, 4, .01, x => { f.s = x; Atelie.desenha(); }, sol));
      box.appendChild(h('<div style="color:var(--tx3);font-size:11.5px">O fantasma é a arte inteira (ex.: a base oficial) por cima das peças, para conferir se tudo está no lugar. Não aparece na animação.</div>')); }
    return box;
  },
  async escolherFantasma() {
    const [f] = await pickFiles('image/png,image/jpeg,image/webp', false); if (!f) return;
    const bm = await createImageBitmap(f).catch(() => null); if (!bm) return UI.toast('Não é uma imagem que dá para usar', { kind: 'err' });
    const k = `personagens/${this.def.id}/img/fantasma${uid('f').toLowerCase().replace(/[^a-z0-9]/g, '')}.${f.type === 'image/jpeg' ? 'jpg' : f.type === 'image/webp' ? 'webp' : 'png'}`;
    await Arq.guardar(f, k); Arq.img.set(k, bm);
    const b = Modelo.caixaPersonagem(this.def, Modelo.partesNoEstado(this.def, {})), s = b.h > 0 ? round(b.h / bm.height, 3) : 1;
    this.vis().fantasma = { k, w: bm.width, h: bm.height, x: round(b.x + b.w / 2 - bm.width * s / 2, 1), y: round(b.y + b.h / 2 - bm.height * s / 2, 1), s, op: .35, on: true }; Atelie.commit();
  },
  // desenha o fantasma (chamado pelo Atelie.desenha, já no espaço do mundo)
  desenhaFantasma(ctx) {
    const f = this.def?.vis?.fantasma; if (!f?.on) return; const bm = Arq.bitmap(f.k, () => Atelie.desenha()); if (!bm) return;
    ctx.save(); ctx.globalAlpha = f.op ?? .35; ctx.drawImage(bm, f.x, f.y, f.w * (f.s ?? 1), f.h * (f.s ?? 1)); ctx.restore();
  },
  corFundo() { const fu = this.def?.vis?.fundo; return fu === 'branco' ? '#ffffff' : fu === 'cenario' ? 'cenario' : null; },

  /* ---------- no editor: escrever a animação como chaves a partir do quadro atual ---------- */
  async porNoQuadro(n, def, a) {
    const P = App.P, trilhas = (a.trilhas || []).filter(t => t.length); if (!trilhas.length) return UI.toast('Essa animação não tem passos.', { kind: 'warn' });
    const fppPadrao = Math.max(1, Math.round((+a.vel || 250) / 1000 * P.fps)), maior = Math.max(...trilhas.map(t => t.length));
    const body = h(`<div><label class="field">Quadros por passo<input type="number" min="1" max="48" value="${fppPadrao}" data-f></label><label class="field">Quantas vezes repetir<input type="number" min="1" max="50" value="2" data-r></label>
      <div style="color:var(--tx3);font-size:12px">Começa no quadro ${App.q + 1}. No fim, as partes voltam ao normal.</div></div>`);
    const r = await UI.modal({ title: `Pôr "${a.nome}" na animação`, icon: 'film', body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Pôr', kind: 'primary', collect: x => ({ f: clamp(+$('[data-f]', x.body).value || 1, 1, 48), r: clamp(+$('[data-r]', x.body).value || 1, 1, 50) }) }] });
    if (!r) return; const total = maior * r.r, mexe = new Set(), sess = new Set();
    for (const t of trilhas) for (const p of t) { Object.keys(p.p || {}).forEach(x => mexe.add(x)); Object.keys(p.s || {}).forEach(x => sess.add(x)); }
    for (let i = 0; i < total; i++) {
      const q = App.q + i * r.f, k = Modelo.chave(n, q); k.partes = { ...(k.partes || {}) }; k.sessoes = { ...(k.sessoes || {}) };
      for (const t of trilhas) { const p = t[i % t.length]; Object.assign(k.sessoes, p.s || {}); for (const [pid, e] of Object.entries(p.p || {})) k.partes[pid] = { img: e.img, r: e.r || 0 }; }
      if (!Object.keys(k.sessoes).length) delete k.sessoes; if (!Object.keys(k.partes).length) delete k.partes;
    }
    const fim = App.q + total * r.f, kf = Modelo.chave(n, fim); // volta ao normal no fim
    if (mexe.size) { kf.partes = { ...(kf.partes || {}) }; for (const pid of mexe) kf.partes[pid] = null; }
    if (P.duracao < fim + 1) P.duracao = fim + 1;
    App.commit(`Animação "${a.nome}"`); UI.toast(`"${esc(a.nome)}" posta do quadro ${App.q + 1} ao ${fim}.`, { kind: 'ok' });
  },
};
