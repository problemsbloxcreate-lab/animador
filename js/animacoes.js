/* ===================== animacoes.js — aba "Animações" do Ateliê: animações de teste do personagem =====================
   Para qualquer personagem (nasceu do antigo "Encaixe da Lumi"): cada animação tem TRILHAS (ex.: pernas andando + boca falando
   + olhos piscando) e cada trilha é uma fila de PASSOS. Um passo diz o que muda: presets das sessões (s) e imagens/giro das partes (p).
     passo = { s:{ sessaoId: presetId }, p:{ parteId:{ img, r } } }
   As trilhas andam juntas (cada uma volta ao começo quando acaba), uma troca a cada `vel` ms.
   Gravar um passo = o que está escolhido no modo Testar. No editor, "Pôr no quadro" escreve a animação como chaves. */
'use strict';
// arrastar para mudar a ordem (animações, trilhas, passos, sessões, presets): el aceita itens do mesmo "tipo"; horizontal = antes/depois pela metade da largura
function ordenavel(el, tipo, valor, aoSoltar, horizontal) {
  const T = 'text/ordem-' + tipo; el.draggable = true;
  el.addEventListener('dragstart', ev => { ev.stopPropagation(); ev.dataTransfer.setData(T, JSON.stringify(valor)); ev.dataTransfer.effectAllowed = 'move'; el.classList.add('arrastando'); });
  el.addEventListener('dragend', () => el.classList.remove('arrastando'));
  el.addEventListener('dragover', ev => { if (!ev.dataTransfer.types.includes(T)) return; ev.preventDefault(); ev.stopPropagation(); const b = el.getBoundingClientRect(), antes = horizontal ? ev.clientX < b.left + b.width / 2 : ev.clientY < b.top + b.height / 2; el.classList.toggle('ord-antes', antes); el.classList.toggle('ord-depois', !antes); el.classList.toggle('ord-h', !!horizontal); });
  el.addEventListener('dragleave', () => el.classList.remove('ord-antes', 'ord-depois'));
  el.addEventListener('drop', ev => { if (!ev.dataTransfer.types.includes(T)) return; ev.preventDefault(); ev.stopPropagation(); const antes = el.classList.contains('ord-antes'); el.classList.remove('ord-antes', 'ord-depois'); try { aoSoltar(JSON.parse(ev.dataTransfer.getData(T)), antes); } catch (e) { console.warn(e); } });
}
// tira o item da posição i e põe antes/depois de j (na mesma lista)
function moveNaLista(L, i, j, antes) { if (i === j) return; const [x] = L.splice(i, 1); if (i < j) j--; L.splice(antes ? j : j + 1, 0, x); }
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
    for (const [pid, e] of Object.entries(p.p || {})) { const pt = Atelie.parte(pid); const im = pt?.imgs.find(i => i.id === e.img); out.push((im ? im.nome : pt?.nome || '?') + (e.r ? ` ${e.r > 0 ? '+' : ''}${e.r}°` : '') + (e.x || e.y ? ' ↕' : '')); }
    return out.join(' · ') || '(base)';
  },
  detalhe(p) {
    const d = this.def, l = [];
    for (const [sid, pid] of Object.entries(p.s || {})) { const s = d.sessoes.find(x => x.id === sid); l.push(`${s?.nome || '?'}: ${s?.presets.find(x => x.id === pid)?.nome || '?'}`); }
    for (const [pid, e] of Object.entries(p.p || {})) { const pt = Atelie.parte(pid); l.push(`${pt?.nome || '?'}: ${pt?.imgs.find(i => i.id === e.img)?.nome || '—'}${e.r ? ` (giro ${e.r}°)` : ''}${e.x || e.y ? ` (mexe ${Math.round(e.x || 0)},${Math.round(e.y || 0)})` : ''}`); }
    return l.join('\n') || 'nada muda (base)';
  },

  /* ---------- tocar ---------- */
  aplicar(passos) { // passos: um por trilha
    const T = Atelie.teste || (Atelie.teste = { sessoes: {}, partes: {} });
    for (const p of passos) { if (!p) continue; Object.assign(T.sessoes, p.s || {}); for (const [pid, e] of Object.entries(p.p || {})) T.partes[pid] = { ...e }; }
  },
  // o quadro i da animação (todas as trilhas juntas): { sessoes, partes }
  frame(a, i) { const T = { sessoes: {}, partes: {} }; for (const t of (a.trilhas || []).filter(t => t.length)) { const p = t[((i % t.length) + t.length) % t.length]; Object.assign(T.sessoes, p.s || {}); for (const [pid, e] of Object.entries(p.p || {})) T.partes[pid] = { ...e }; } return T; },
  // passos que estão na tela agora (um por trilha) — para saber o que editar quando clica numa peça com a animação pausada
  passosAgora(a, i) { return (a.trilhas || []).map((t, ti) => t.length ? { ti, pi: ((i % t.length) + t.length) % t.length, p: t[((i % t.length) + t.length) % t.length] } : null).filter(Boolean); },
  // PAUSADO (animação parada num passo) ou POSE FIXA (veio do editor: "Editar no Ateliê"): a tela mostra esse quadro e dá para arrumar as peças
  get parado() { return !!(this.poseFixa || (this.tocando && this.pausado)); },
  frameAtual() { if (this.poseFixa) return this.poseFixa; const a = this.achar(this.tocando); return a ? this.frame(a, this.i) : null; },
  tocar(a, de = 0) {
    this.parar(true); window.Falas?.parar(); if (!a) return; const trilhas = (a.trilhas || []).filter(t => t.length); if (!trilhas.length) return UI.toast('Essa animação ainda não tem passos. Escolha no Testar e clique em "+ Passo".', { kind: 'warn' });
    this.poseFixa = null; Atelie.edit = null; Atelie.editPasso = null; Atelie.teste = this.frame(a, de); this.tocando = a.id; this.sel = a.id; this.passo = null; this.pausado = false; this.i = de;
    const vai = () => { if (!Atelie.teste || this.tocando !== a.id) return this.parar(); Atelie.teste = this.frame(a, this.i); Atelie.desenha(); Atelie.pintaTeste(); this.i++; };
    vai(); this._t = setInterval(vai, +a.vel || 250); Atelie.pinta();
  },
  // pausa no passo que está na tela (clicar numa peça arruma aquele passo/preset); continuar segue dali
  pausar() { const a = this.achar(this.tocando); if (!a || this.pausado) return; clearInterval(this._t); this._t = null; this.pausado = true; this.i = Math.max(0, this.i - 1); Atelie.teste = this.frame(a, this.i); Atelie.pinta(); UI.toast('Pausado. Clique numa peça para arrumar <b>este passo</b> (ou o preset que ele usa).', { time: 4000 }); },
  continuar() { const a = this.achar(this.tocando); if (!a) return; Atelie.edit = null; Atelie.editPasso = null; this.tocar(a, this.i + 1); },
  passoMais(d) { const a = this.achar(this.tocando); if (!a) return; if (!this.pausado) this.pausar(); this.i = this.i + d; Atelie.teste = this.frame(a, this.i); Atelie.edit = null; Atelie.editPasso = null; Atelie.pinta(); },
  parar(quieto) { clearInterval(this._t); this._t = null; const tinha = this.tocando; this.tocando = null; this.pausado = false; if (Atelie.editPasso) Atelie.editPasso = null; if (tinha && !quieto) Atelie.pinta(); },
  // com a animação pausada (ou a pose do editor): clicou na peça → o que ela edita (o passo da trilha, o preset da sessão, ou a base)
  alvoPausa(pid) {
    Atelie.edit = null; Atelie.editPasso = null; const def = this.def, F = this.frameAtual(); if (!F) return;
    const a = this.poseFixa ? null : this.achar(this.tocando);
    if (a) { const L = this.passosAgora(a, this.i).filter(x => x.p.p?.[pid]); if (L.length) { const x = L[L.length - 1]; Atelie.editPasso = { a: a.id, ti: x.ti, pi: x.pi }; return; } }
    let achou = null; for (const s of def.sessoes) { const prId = F.sessoes?.[s.id]; const pr = prId && s.presets.find(p => p.id === prId); if (pr?.estado?.[pid]) achou = { s: s.id, p: pr.id }; }
    if (achou) Atelie.edit = achou;
  },
  passoEditado() { const e = Atelie.editPasso, a = e && this.achar(e.a); return a?.trilhas?.[e.ti]?.[e.pi] || null; },
  textoAlvo() { // para o selo "editando: …"
    const p = this.passoEditado(); if (p) { const a = this.achar(Atelie.editPasso.a); return `passo ${Atelie.editPasso.pi + 1} de "${a.nome}"`; }
    const s = Atelie.sessao(), pr = Atelie.preset(); return pr ? `${s.nome} › ${pr.nome}` : 'a base';
  },
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
      { label: 'Citar esta animação em mensagens…', icon: 'chat', action: () => Citacao.atelie({ anim: a.id }) },
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
      { label: 'Mover para a posição', icon: 'move', disabled: t.length < 2, sub: t.map((_, j) => ({ label: `${j + 1}º${j === pi ? ' (aqui)' : ''}`, checked: j === pi, disabled: j === pi, action: () => { const [x] = t.splice(pi, 1); t.splice(j, 0, x); this.passo = { t: ti, i: j }; Atelie.commit(); } })) },
      a.trilhas.length > 1 && { label: 'Mover para a trilha', icon: 'layers', sub: a.trilhas.map((tt, j) => ({ label: `Trilha ${j + 1}${j === ti ? ' (esta)' : ''}`, disabled: j === ti, action: () => { const [x] = t.splice(pi, 1); tt.push(x); this.passo = { t: j, i: tt.length - 1 }; Atelie.commit(); } })) },
      ...(itens.length ? ['-', ...itens] : []),
      '-', { label: 'Apagar o passo', icon: 'trash', danger: true, action: () => { t.splice(pi, 1); this.passo = null; Atelie.commit(); } },
    ].filter(Boolean));
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
      ordenavel($('.cab', c), 'anim', a.id, (id, antes) => { const L2 = this.lista(), i = L2.findIndex(x => x.id === id), j = L2.indexOf(a); if (i >= 0) { moveNaLista(L2, i, j, antes); Atelie.commit(); } }); // arrastar a animação muda a ordem
      if (aberta) {
        a.trilhas.forEach((t, ti) => {
          const tr = h(`<div class="trilha"><div class="tr-t">Trilha ${ti + 1}${a.trilhas.length > 1 ? `<button class="ibtn" data-up title="Subir a trilha" ${ti ? '' : 'disabled'}>${ic('up', 11)}</button><button class="ibtn" data-dn title="Descer a trilha" ${ti < a.trilhas.length - 1 ? '' : 'disabled'}>${ic('down', 11)}</button><button class="ibtn" data-xt title="Apagar a trilha">${ic('x', 11)}</button>` : ''}</div><div class="passos"></div></div>`), ps = $('.passos', tr);
          if ($('[data-up]', tr)) { $('[data-up]', tr).onclick = () => { moveNaLista(a.trilhas, ti, ti - 1, true); this.passo = null; Atelie.commit(); }; $('[data-dn]', tr).onclick = () => { moveNaLista(a.trilhas, ti, ti + 1, false); this.passo = null; Atelie.commit(); }; }
          ordenavel($('.tr-t', tr), 'trilha-' + a.id, ti, (de, antes) => { moveNaLista(a.trilhas, de, ti, antes); this.passo = null; Atelie.commit(); });
          t.forEach((p, pi) => { const on = this.passo?.t === ti && this.passo?.i === pi;
            const b = h(`<button class="passo ${on ? 'on' : ''}" title="${esc(this.detalhe(p))}\n\nClique: mostrar · botão direito: opções"><i>${pi + 1}</i><span>${esc(this.rotulo(p))}</span></button>`);
            b.onclick = () => this.mostrarPasso(a, ti, pi); b.oncontextmenu = ev => { ev.preventDefault(); this.menuPasso(ev, a, ti, pi); }; ps.appendChild(b);
            // arrastar o passo: muda a ordem (também de uma trilha para outra da mesma animação)
            ordenavel(b, 'passo-' + a.id, [ti, pi], ([t0, p0], antes) => { const de = a.trilhas[t0]; if (!de?.[p0]) return; if (t0 === ti) moveNaLista(t, p0, pi, antes); else { const [x] = de.splice(p0, 1); t.splice(antes ? pi : pi + 1, 0, x); } this.passo = null; Atelie.commit(); }, true); });
          const add = h(`<button class="passo add" title="O que está escolhido no Testar vira um passo">${ic('plus', 12)} Passo</button>`);
          add.onclick = () => { if (!Atelie.teste) { Atelie.testar(true); return UI.toast('Escolha no Testar o que este passo mostra e clique em + Passo de novo.'); } t.push(this.passoDaTela()); this.passo = { t: ti, i: t.length - 1 }; Atelie.commit(); };
          ps.appendChild(add);
          ordenavel(add, 'passo-' + a.id, null, ([t0, p0]) => { const de = a.trilhas[t0]; if (!de?.[p0]) return; const [x] = de.splice(p0, 1); t.push(x); this.passo = null; Atelie.commit(); }, true); add.draggable = false; // soltar no "+ Passo" põe no fim desta trilha
          if ($('[data-xt]', tr)) $('[data-xt]', tr).onclick = () => { a.trilhas.splice(ti, 1); this.passo = null; Atelie.commit(); };
          c.appendChild(tr);
        });
        const mais = h(`<div class="campo2" style="padding:4px 8px 8px"><button class="btn sm" data-tr>${ic('plus', 12)} Trilha</button><span class="dica-a">Trilhas andam juntas: ex. pernas andando + boca falando + olhos piscando.</span></div>`);
        $('[data-tr]', mais).onclick = () => { a.trilhas.push([]); Atelie.commit(); }; c.appendChild(mais);
      }
      topo.appendChild(c);
    }
    el.appendChild(topo); if (window.Falas) Falas.pinta(el); el.appendChild(this.pintaVisual());
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
    if (!r) return; const fim = this.escreve(n, a, App.q, r.f, r.r); App.commit(`Animação "${a.nome}"`); UI.toast(`"${esc(a.nome)}" posta do quadro ${App.q + 1} ao ${fim}.`, { kind: 'ok' });
  },
  // escreve a animação como chaves no editor: de q0, fpp quadros por passo, reps vezes (devolve o último quadro)
  escreve(n, a, q0, fpp, reps) {
    const P = App.P, trilhas = (a.trilhas || []).filter(t => t.length); if (!trilhas.length) return q0; const maior = Math.max(...trilhas.map(t => t.length)), total = maior * reps, mexe = new Set();
    for (const t of trilhas) for (const p of t) Object.keys(p.p || {}).forEach(x => mexe.add(x));
    for (let i = 0; i < total; i++) {
      const q = q0 + i * fpp, k = Modelo.chave(n, q); k.partes = { ...(k.partes || {}) }; k.sessoes = { ...(k.sessoes || {}) };
      for (const t of trilhas) { const p = t[i % t.length]; Object.assign(k.sessoes, p.s || {}); for (const [pid, e] of Object.entries(p.p || {})) k.partes[pid] = { ...(e.img ? { img: e.img } : {}), r: e.r || 0, x: e.x || 0, y: e.y || 0, ...(e.d ? { d: e.d } : {}) }; }
      if (!Object.keys(k.sessoes).length) delete k.sessoes; if (!Object.keys(k.partes).length) delete k.partes;
    }
    const fim = q0 + total * fpp, kf = Modelo.chave(n, fim); // volta ao normal no fim
    if (mexe.size) { kf.partes = { ...(kf.partes || {}) }; for (const pid of mexe) kf.partes[pid] = null; }
    if (P.duracao < fim + 1) P.duracao = fim + 1; return fim;
  },
  /* ---------- editor → "Editar no Ateliê": abre o personagem numa aba nova, parado nesta pose (deste quadro) ---------- */
  async editarNoAtelie(n) {
    const P = App.P, def = P?.personagens?.[n?.ref]; if (!def) return; App.pausa?.(); // pausa a animação no quadro atual
    const est = Modelo.estadoPersonagem(n, App.q), partes = {}; for (const [k, v] of Object.entries(est.partes || {})) if (v) partes[k] = v;
    await DB.put('arquivos', { def: clone(def), sessoes: est.sessoes || {}, partes, quadro: App.q, anim: P.nome, em: Date.now() }, 'pose-abrir:' + def.id);
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('atelie', def.id); u.searchParams.set('pose', '1');
    const w = window.open(u.href, '_blank'); if (!w) UI.toast('O navegador bloqueou a aba nova. Libere pop-ups para o Animador e tente de novo.', { kind: 'warn', time: 6000 });
    else UI.toast(`<b>${esc(def.nome)}</b> abriu no Ateliê na pose do quadro ${App.q + 1}. Quando o personagem for salvo lá, esta animação recebe a mudança sozinha.`, { kind: 'ok', time: 6000 });
  },
  // no Ateliê (aba aberta pelo editor): entra na pose guardada
  async entrarNaPose(id) {
    const r = await DB.get('arquivos', 'pose-abrir:' + id).catch(() => null); if (!r) return false; DB.del('arquivos', 'pose-abrir:' + id).catch(() => { });
    // animações que só existem na cópia da animação (ex.: criadas pela IA do editor) entram no personagem
    const novas = (r.def?.animacoes || []).filter(x => !(Atelie.def.animacoes || []).some(y => y.id === x.id || y.nome === x.nome));
    if (novas.length) { (Atelie.def.animacoes ||= []).push(...clone(novas)); Atelie.commit(); UI.toast(`${novas.length} animação(ões) da animação aberta entraram no personagem (${esc(novas.map(x => x.nome).join(', '))}).`, { kind: 'ok', time: 6000 }); }
    this.poseFixa = { sessoes: r.sessoes || {}, partes: r.partes || {}, quadro: r.quadro || 0, anim: r.anim || '' };
    Atelie.teste = { sessoes: { ...this.poseFixa.sessoes }, partes: clone(this.poseFixa.partes) }; Atelie.edit = null; Atelie.editPasso = null; Atelie.pinta(); Atelie.enquadrar();
    UI.toast(`Pose do quadro ${this.poseFixa.quadro + 1} de "${esc(this.poseFixa.anim)}". Clique numa peça para arrumar o preset que ela usa (ou a base).`, { time: 7000 });
    return true;
  },
  async reservaDaPose(id) { const r = await DB.get('arquivos', 'pose-abrir:' + id).catch(() => null); return r?.def || null; },
};
