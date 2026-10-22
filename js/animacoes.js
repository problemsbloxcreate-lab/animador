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
  sel: null, passo: null, tocando: null, _t: null, passoSel: null, // passoSel = { t, i }: o passo escolhido na timeline (js/linha.js)
  // o passo parado na tela (timeline): { a, ti, pi, p } — aí clicar numa pose muda ESTE passo
  passoAtual() { if (!this.tocando || !this.pausado || !this.passoSel || this.poseFixa) return null; const a = this.achar(this.tocando), t = a?.trilhas?.[this.passoSel.t]; if (!t?.length) return null; const pi = ((this.passoSel.i % t.length) + t.length) % t.length; return { a, ti: this.passoSel.t, pi, p: t[pi] }; },
  irPara(a, ti, pi) { this.parar(true); this.poseFixa = null; this.passo = null; this.sel = a.id; this.tocando = a.id; this.pausado = true; this.i = pi; this.passoSel = { t: ti, i: pi }; Atelie.edit = null; Atelie.editPasso = null; Atelie.teste = this.frame(a, pi); Atelie.pinta(); },
  // a pose (preset) da sessão s neste passo (null = Padrão). Vai para o passo que já manda nessa sessão agora (ou o da trilha escolhida)
  usarPose(s, pr) {
    const st = this.passoAtual(); if (!st) return; const L = this.passosAgora(st.a, this.i); let alvo = L.filter(x => x.p.s && s.id in x.p.s).pop()?.p || st.p;
    alvo.s = alvo.s || {}; if (pr) alvo.s[s.id] = pr.id; else delete alvo.s[s.id]; Atelie.teste = this.frame(st.a, this.i); Atelie.commit();
  },
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
  // dá para mexer nas peças: pausado, pose do editor, ou o Testar aberto sem animação tocando
  get mexivel() { return this.parado || (!!Atelie.teste && !this.tocando); },
  get rodando() { return !!(this.tocando && !this.pausado); },
  frameAtual() { if (this.poseFixa) return this.poseFixa; const a = this.achar(this.tocando); return a ? this.frame(a, this.i) : Atelie.teste || null; },
  tocar(a, de = 0) {
    this.parar(true); window.Falas?.parar(); if (!a) return; const trilhas = (a.trilhas || []).filter(t => t.length); if (!trilhas.length) return UI.toast('Essa animação ainda não tem passos. Escolha no Testar e clique em "+ Passo".', { kind: 'warn' });
    this.poseFixa = null; Atelie.edit = null; Atelie.editPasso = null; Atelie.teste = this.frame(a, de); this.tocando = a.id; this.sel = a.id; this.passo = null; this.passoSel = null; this.pausado = false; this.i = de;
    const vai = () => { if (!Atelie.teste || this.tocando !== a.id) return this.parar(); Atelie.teste = this.frame(a, this.i); Atelie.desenha(); Atelie.pintaTesteLeve(); this.i++; };
    vai(); this._t = setInterval(vai, +a.vel || 250); Atelie.pinta();
  },
  // pausa no passo que está na tela (clicar numa peça arruma aquele passo/preset); continuar segue dali
  pausar(quieto) { const a = this.achar(this.tocando); if (!a || this.pausado) return; clearInterval(this._t); this._t = null; this.pausado = true; this.i = Math.max(0, this.i - 1); Atelie.teste = this.frame(a, this.i); Atelie.pinta(); if (!quieto) UI.toast('Pausado. Clique numa peça para arrumar <b>este passo</b> (ou o preset que ele usa).', { time: 4000 }); },
  continuar() { const a = this.achar(this.tocando); if (!a) return; Atelie.edit = null; Atelie.editPasso = null; this.tocar(a, this.i + 1); },
  passoMais(d) { const a = this.achar(this.tocando); if (!a) return; if (!this.pausado) this.pausar(true); this.i = this.i + d; this.passoSel = { t: this.passoSel?.t ?? 0, i: this.i }; Atelie.teste = this.frame(a, this.i); Atelie.edit = null; Atelie.editPasso = null; Atelie.pinta(); },
  parar(quieto) { clearInterval(this._t); this._t = null; const tinha = this.tocando; this.tocando = null; this.pausado = false; if (Atelie.editPasso) Atelie.editPasso = null; if (tinha && !quieto) Atelie.pinta(); },
  // com a animação pausada (ou a pose do editor): clicou na peça → o que ela edita (o passo da trilha, o preset da sessão, ou a base)
  alvoPausa(pid) {
    Atelie.edit = null; Atelie.editPasso = null; const def = this.def, F = this.frameAtual(); if (!F) return;
    // passo parado na timeline: tudo que mexer na peça (posição, giro, imagem) vale SÓ neste passo (keyframe)
    const st = this.passoAtual(); if (st) { const L = this.passosAgora(st.a, this.i), x = L.filter(y => y.p.p?.[pid]).pop() || L.find(y => y.ti === st.ti) || L[L.length - 1]; Atelie.editPasso = { a: st.a.id, ti: x.ti, pi: x.pi }; return; }
    const a = this.poseFixa ? null : this.achar(this.tocando);
    if (a) { const L = this.passosAgora(a, this.i).filter(x => x.p.p?.[pid]); if (L.length) { const x = L[L.length - 1]; Atelie.editPasso = { a: a.id, ti: x.ti, pi: x.pi }; return; } }
    let achou = null; for (const s of def.sessoes) { const prId = F.sessoes?.[s.id]; const pr = prId && s.presets.find(p => p.id === prId); if (pr?.estado?.[pid]) achou = { s: s.id, p: pr.id }; }
    if (achou) Atelie.edit = achou;
  },
  passoEditado() { const e = Atelie.editPasso, a = e && this.achar(e.a); return a?.trilhas?.[e.ti]?.[e.pi] || null; },
  textoAlvo() { const st = this.passoAtual(); if (st) return `passo ${st.pi + 1}`; // para o selo "editando: …"
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
    a.trilhas = [[{ s: {}, p: {} }]]; Atelie.commit(); this.irPara(a, 0, 0); UI.toast('Animação criada com 1 passo. Na timeline embaixo: clique num passo e escolha as <b>poses</b> dele (aba Poses); <b>+ Passo</b> cria o próximo.', { kind: 'ok', time: 8000 });
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
    // aba Animações: só a lista (os passos ficam na TIMELINE embaixo do palco) + o que é extra, fechado em seções
    const L = this.lista(), def = this.def;
    const box = h(`<div class="anims-at"><div class="campo2"><button class="btn sm" data-nova>${ic('plus', 13)} Animação</button><button class="btn sm ia" data-ia title="A IA cria animações de teste (andar, falar, piscar…) com as poses que existem">${ic('sparkles', 13)} Criar com a IA</button></div></div>`);
    $('[data-nova]', box).onclick = () => this.nova(); $('[data-ia]', box).onclick = () => Atelie.ia('animacoes');
    if (!L.length) box.appendChild(h('<div class="vazio">Nenhuma animação de teste ainda (andar, falar, piscar, acenar…).</div>'));
    for (const a of L) {
      const on = this.sel === a.id, toca = this.tocando === a.id && !this.pausado, nP = a.trilhas.reduce((n, t) => Math.max(n, t.length), 0);
      const c = h(`<div class="ab-item ${on ? 'on' : ''}"><button class="ibtn" data-p title="${toca ? 'Pausar' : 'Tocar'}">${ic(toca ? 'pause' : 'play', 13)}</button><span class="ab-nome">${esc(a.nome)}</span><small>${nP} passo${nP === 1 ? '' : 's'}${a.trilhas.length > 1 ? ` · ${a.trilhas.length} trilhas` : ''}</small><button class="ibtn" data-m title="Mais">${ic('dots', 13)}</button></div>`);
      c.onclick = ev => { if (ev.target.closest('button')) return; this.parar(true); this.passoSel = null; this.sel = a.id; Atelie.teste = null; Atelie.pinta(); };
      $('[data-p]', c).onclick = () => { this.sel = a.id; Linha.tocaPausa(); };
      $('[data-m]', c).onclick = ev => this.menu(ev, a); c.oncontextmenu = ev => { ev.preventDefault(); this.menu(ev, a); };
      ordenavel(c, 'anim', a.id, (id, antes) => { const L2 = this.lista(), i = L2.findIndex(x => x.id === id), j = L2.indexOf(a); if (i >= 0) { moveNaLista(L2, i, j, antes); Atelie.commit(); } });
      box.appendChild(c);
    }
    el.appendChild(box);
    // extras, fechados (abrem com um clique): vídeos de referência, áudios de teste e o visual do palco
    const sec = (titulo, icone, conteudo, aberta) => { const d = h(`<details class="ab-sec" ${aberta ? 'open' : ''}><summary>${ic(icone, 13)} ${titulo}</summary></details>`); conteudo(d); el.appendChild(d); };
    sec('Vídeos de referência (para a IA)', 'film', d => d.appendChild(RefsAnim.campo({ lista: () => (def.refsAnim ||= []), chave: () => `personagens/${def.id}/img/ref${uid('').toLowerCase().replace(/[^a-z0-9]/g, '')}.jpg`, mudou: () => Atelie.commit({ soDesenho: true }) })), false);
    if (window.Falas) sec('Áudios de teste (fala)', 'mic', d => Falas.pinta(d), (def.audios || []).length > 0);
    sec('Fundo do palco e fantasma', 'image', d => d.appendChild(this.pintaVisual()), !!def.vis?.fantasma?.on);
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
    const [f] = await pickFiles('image/png,image/jpeg,image/webp,' + VETOR, false); if (!f) return;
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
    if (!r) return; const vi = Modelo.vistaDaAnim(def, a.id); if (vi && def.vistas?.length > 1) Modelo.chave(n, App.q).vista = vi; // a animação é de uma vista: o personagem fica nela
    const fim = this.escreve(n, a, App.q, r.f, r.r); App.commit(`Animação "${a.nome}"`); UI.toast(`"${esc(a.nome)}" posta do quadro ${App.q + 1} ao ${fim}.`, { kind: 'ok' });
  },
  // escreve a animação como chaves no editor: de q0, fpp quadros por passo, reps vezes (devolve o último quadro)
  escreve(n, a, q0, fpp, reps) {
    const P = App.P, trilhas = (a.trilhas || []).filter(t => t.length); if (!trilhas.length) return q0; const maior = Math.max(...trilhas.map(t => t.length)), total = maior * reps, mexe = new Set();
    for (const t of trilhas) for (const p of t) Object.keys(p.p || {}).forEach(x => mexe.add(x));
    for (let i = 0; i < total; i++) {
      const q = q0 + i * fpp, k = Modelo.chave(n, q); k.partes = { ...(k.partes || {}) }; k.sessoes = { ...(k.sessoes || {}) };
      for (const t of trilhas) { const p = t[i % t.length]; Object.assign(k.sessoes, p.s || {}); for (const [pid, e] of Object.entries(p.p || {})) k.partes[pid] = { ...(e.img ? { img: e.img } : {}), r: e.r || 0, x: e.x || 0, y: e.y || 0, ...(e.d ? { d: e.d } : {}), ...(e.ap ? { ap: e.ap } : {}), ...(e.z != null ? { z: e.z } : {}) }; }
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
    await DB.put('arquivos', { def: clone(def), sessoes: est.sessoes || {}, partes, vista: est.vista || null, quadro: App.q, anim: P.nome, projeto: P.id, no: n.id, em: Date.now() }, 'pose-abrir:' + def.id); // projeto/no: o que for só deste keyframe volta para esta chave
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('atelie', def.id); u.searchParams.set('pose', '1');
    const w = window.open(u.href, '_blank'); if (!w) UI.toast('O navegador bloqueou a aba nova. Libere pop-ups para o Animador e tente de novo.', { kind: 'warn', time: 6000 });
    else UI.toast(`<b>${esc(def.nome)}</b> abriu no Ateliê na pose do quadro ${App.q + 1}. Quando o personagem for salvo lá, esta animação recebe a mudança sozinha.`, { kind: 'ok', time: 6000 });
  },
  /* ---------- editor → "Abrir no Ateliê como pose nova": o jeito que o personagem está neste quadro (vista, poses, ajustes e o espelho)
     vira um PRESET novo ou uma VISTA nova, para arrumar só aquele ângulo. O quadro passa a usar a pose nova na hora. ---------- */
  espelhar(n) { const q = App.q, t = Modelo.transf(n, q); Modelo.poeTransf(n, q, { sx: (t.sx || 1) < 0 ? 1 : -1 }); App.commit('Espelhar o personagem'); },
  async poseNova(n) {
    const P = App.P, def0 = P?.personagens?.[n?.ref]; if (!def0) return; App.pausa?.(); const q = App.q;
    const est = Modelo.estadoPersonagem(n, q), dv = Modelo.naVista(def0, est.vista), vNome = def0.vistas?.length ? Modelo.vistaDe(def0, dv._vista || def0.vistas[0]?.id)?.nome || '' : '', espelhado = (Modelo.transf(n, q).sx || 1) < 0;
    const sess = dv.sessoes || [], sPose = sess.find(s => !(s.partes || []).length) || sess.find(s => /pose/i.test(s.nome));
    const body = h(`<div><label class="field">Nome<input type="text" data-n value="${esc(`Pose do quadro ${q + 1}`)}"></label>
      <div class="field">Criar como</div><div class="nv-como">
        <label class="chk"><input type="radio" name="como" value="preset" checked> Um <b>preset novo</b> da vista ${esc(vNome || 'atual')}, na sessão <select data-s>${sess.map(s => `<option value="${s.id}" ${s === sPose ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}<option value="__nova" ${sPose ? '' : 'selected'}>+ Poses especiais (nova)</option></select></label>
        <label class="chk"><input type="radio" name="como" value="vista"> Uma <b>vista nova</b> (cópia ${espelhado ? 'espelhada ' : ''}da vista ${esc(vNome || 'atual')}), para arrumar esse ângulo inteiro</label></div>
      ${espelhado ? `<label class="chk np-ia" style="margin-top:8px"><input type="checkbox" data-esp checked> O personagem está <b>espelhado</b> aqui: levar o espelho para dentro da pose (assim dá para arrumar o lado certo, ex.: a franja) e tirar o espelho deste quadro</label>` : ''}
      <div style="color:var(--tx3);font-size:12px;margin-top:10px">Abre o Ateliê numa aba nova já nessa pose. O quadro ${q + 1} passa a usar a pose nova; o que você arrumar lá volta para cá ao salvar (Ctrl+S ou nuvem).</div></div>`);
    const r = await UI.modal({ title: 'Abrir no Ateliê como pose nova', icon: 'edit', width: 520, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Abrir no Ateliê', kind: 'primary', collect: () => ({ nome: $('[data-n]', body).value.trim() || `Pose do quadro ${q + 1}`, como: $('input[name=como]:checked', body).value, sessao: $('[data-s]', body)?.value, espelho: !!$('[data-esp]', body)?.checked }) }] });
    if (!r) return;
    const partes = {}; for (const [k, v] of Object.entries(est.partes || {})) if (v) partes[k] = v;
    await DB.put('arquivos', { def: clone(def0), sessoes: est.sessoes || {}, partes, vista: dv._vista || def0.vistas?.[0]?.id || null, quadro: q, anim: P.nome, em: Date.now(),
      acao: { ...r, projeto: P.id, no: n.id, quadro: q } }, 'pose-abrir:' + def0.id);
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('atelie', def0.id); u.searchParams.set('pose', '1');
    const w = window.open(u.href, '_blank'); if (!w) return UI.toast('O navegador bloqueou a aba nova. Libere pop-ups para o Animador e tente de novo.', { kind: 'warn', time: 6000 });
    UI.toast(`Abrindo no Ateliê como ${r.como === 'vista' ? 'vista nova' : 'preset novo'}…`, { time: 4000 });
  },
  // no Ateliê: cria o preset/vista pedido pelo editor a partir da pose do quadro e avisa o editor (o quadro passa a usar)
  async criaPoseNova(r, a) {
    const def = Atelie.def, F = { sessoes: { ...(r.sessoes || {}) }, partes: clone(r.partes || {}) }, raizes = () => def.partes.filter(p => def.raiz ? p.id === def.raiz : !p.pai);
    const msg = { tipo: 'pose-pronta', projeto: a.projeto, no: a.no, quadro: a.quadro, tiraEspelho: !!a.espelho };
    if (a.como === 'vista') {
      const de = def.vistaAtual, tipo = Modelo.vistaDe(def)?.tipo || 'outra'; await Atelie.criaVista({ nome: a.nome, tipo, de, como: a.espelho ? 'espelho' : 'copia' });
      msg.vista = def.vistaAtual; this.poseFixa = { ...F, quadro: a.quadro, anim: r.anim || '', projeto: a.projeto, no: a.no }; Atelie.teste = clone(F);
      UI.toast(`Vista <b>${esc(a.nome)}</b> criada${a.espelho ? ' (espelhada)' : ''} com a pose do quadro ${a.quadro + 1}. Arrume o que precisar: vale só para esta vista.`, { kind: 'ok', time: 7000 });
    } else {
      let s = def.sessoes.find(x => x.id === a.sessao); if (!s) { s = def.sessoes.find(x => x.nome === 'Poses especiais') || { id: uid('s'), nome: 'Poses especiais', partes: [], presets: [] }; if (!def.sessoes.includes(s)) def.sessoes.push(s); }
      // o preset guarda como as partes estão no quadro (menos as que outras sessões escolhidas controlam: elas continuam mandando)
      const outras = def.sessoes.filter(x => x !== s && F.sessoes[x.id] && (x.partes || []).length).flatMap(x => x.partes), estQ = Modelo.partesNoEstado(def, F), estado = {};
      for (const p of def.partes) { if (outras.includes(p.id)) continue; const e = estQ[p.id] || {}, b = p.base, d = {};
        for (const c of ['img', 'x', 'y', 'r', 's', 'sx', 'vis']) if (e[c] !== undefined && e[c] !== b[c]) d[c] = e[c]; if (e.d && JSON.stringify(e.d) !== JSON.stringify(b.d || {})) d.d = clone(e.d);
        if (Object.keys(d).length) estado[p.id] = d; }
      if (a.espelho) for (const p of raizes()) estado[p.id] = { ...(estado[p.id] || {}), sx: -((estQ[p.id]?.sx ?? p.base.sx) || 1) };
      const pr = { id: uid('pr'), nome: a.nome, estado }; s.presets.push(pr); msg.sessao = s.id; msg.preset = pr.id; msg.tiraAjustes = Object.keys(estado).filter(pid => F.partes[pid]); // os ajustes do quadro foram para dentro do preset
      // mostra o quadro inteiro (com as outras sessões); clicar numa peça arruma o preset que manda nela (quase sempre o novo)
      const semAj = Object.fromEntries(Object.entries(F.partes).filter(([pid]) => !estado[pid]));
      this.poseFixa = { sessoes: { ...F.sessoes, [s.id]: pr.id }, partes: semAj, quadro: a.quadro, anim: r.anim || '', projeto: a.projeto, no: a.no }; Atelie.teste = clone({ sessoes: this.poseFixa.sessoes, partes: semAj }); Atelie.editPasso = null; Atelie.edit = { s: s.id, p: pr.id }; Atelie.aba = 'sessoes'; Atelie.commit();
      UI.toast(`Preset <b>${esc(s.nome)} › ${esc(a.nome)}</b> criado${a.espelho ? ' (espelhado)' : ''} com a pose do quadro ${a.quadro + 1}. Arraste as peças para arrumar: vale só para este preset.`, { kind: 'ok', time: 7000 });
    }
    Atelie.pinta(); Atelie.enquadrar(); await Atelie.guardarLocalJa?.(); // guarda o rascunho aqui (a animação recebe pela mensagem abaixo)
    try { new BroadcastChannel('animador').postMessage({ ...msg, def: JSON.parse(JSON.stringify(def)) }); } catch { }
  },
  // no Ateliê (aba aberta pelo editor): entra na pose guardada
  async entrarNaPose(id) {
    const r = await DB.get('arquivos', 'pose-abrir:' + id).catch(() => null); if (!r) return false; DB.del('arquivos', 'pose-abrir:' + id).catch(() => { });
    // animações que só existem na cópia da animação (ex.: criadas pela IA do editor) entram no personagem
    const novas = (r.def?.animacoes || []).filter(x => !(Atelie.def.animacoes || []).some(y => y.id === x.id || y.nome === x.nome));
    if (novas.length) { (Atelie.def.animacoes ||= []).push(...clone(novas)); Atelie.commit(); UI.toast(`${novas.length} animação(ões) da animação aberta entraram no personagem (${esc(novas.map(x => x.nome).join(', '))}).`, { kind: 'ok', time: 6000 }); }
    if (r.vista && r.vista !== Atelie.def.vistaAtual && Atelie.def.vistas?.some(v => v.id === r.vista)) await Atelie.trocaVista(r.vista); // abre na vista daquele quadro
    if (r.acao) { await this.criaPoseNova(r, r.acao); return true; } // "Abrir no Ateliê como pose nova"
    this.poseFixa = { sessoes: r.sessoes || {}, partes: r.partes || {}, quadro: r.quadro || 0, anim: r.anim || '', projeto: r.projeto, no: r.no };
    Atelie.teste = { sessoes: { ...this.poseFixa.sessoes }, partes: clone(this.poseFixa.partes) }; Atelie.edit = null; Atelie.editPasso = null; Atelie.pinta(); Atelie.enquadrar();
    UI.toast(`Pose do quadro ${this.poseFixa.quadro + 1} de "${esc(this.poseFixa.anim)}". Clique numa peça para arrumar o preset que ela usa (ou a base).`, { time: 7000 });
    return true;
  },
  async reservaDaPose(id) { const r = await DB.get('arquivos', 'pose-abrir:' + id).catch(() => null); return r?.def || null; },
};
