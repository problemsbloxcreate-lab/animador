/* ===================== atelie.js — Ateliê de personagens (montagem por partes) =====================
   1) PARTES: corpo, cabeça, cabelo, olhos, braços… cada uma com várias IMAGENS para trocar. Cada parte encaixa no pai
      (ex.: olhos → cabeça → corpo): mexeu no pai, as partes de cima vão junto; trocou a imagem, ela continua no lugar certo.
   2) MONTAR (Base): arraste as peças para o lugar; Alt+arrastar muda o PIVÔ (ponto de giro); "Só esta imagem" corrige
      uma imagem que ficou torta sem mexer nas outras.
   3) SESSÕES e PRESETS: "Olhos" → assustado, surpreso, triste, fechado… "Perna direita" → chutando, inclinada…
      "Pose" (corpo todo). Editando um preset, o que você mexe vale só para ele.
   Teclas: setas movem (Shift = 10) · Q/E giram (Shift = 15°) · + / − tamanho · F espelha · [ ] frente/trás · Tab próxima parte
           · H esconde · Delete/Backspace apaga (a parte, as partes marcadas ou a imagem clicada) · Ctrl+Z desfaz · Ctrl+S guarda neste computador (a nuvem: botão da nuvem).
   RAIZ: a parte principal (def.raiz), destacada em amarelo na hierarquia. Ctrl+clique / Shift+clique marcam várias partes;
   arrastar partes para "Imagens de…" (ou o menu "Mover para imagens de") transforma partes que entraram sem querer em imagens trocáveis. */
'use strict';
const SESSOES_PRONTAS = [
  { nome: 'Olhos', acha: /olho|eye|pupila|cílio|cilio/i, presets: ['normal', 'assustado', 'surpreso', 'triste', 'fechado', 'bravo'] },
  { nome: 'Sobrancelhas', acha: /sobrancelha|brow/i, presets: ['normal', 'brava', 'triste', 'levantada'] },
  { nome: 'Boca', acha: /boca|mouth|lábio|labio|dente/i, presets: ['fechada', 'meio aberta', 'aberta', 'sorriso', 'triste'] },
  { nome: 'Braço direito', acha: /bra[cç]o.*(dir|d\b)|m[aã]o.*(dir|d\b)|antebra[cç]o.*(dir|d\b)/i, presets: ['parado', 'acenando', 'apontando'] },
  { nome: 'Braço esquerdo', acha: /bra[cç]o.*(esq|e\b)|m[aã]o.*(esq|e\b)|antebra[cç]o.*(esq|e\b)/i, presets: ['parado', 'na cintura'] },
  { nome: 'Perna direita', acha: /perna.*(dir|d\b)|p[eé].*(dir|d\b)|coxa.*(dir|d\b)/i, presets: ['parada', 'chutando', 'inclinada'] },
  { nome: 'Perna esquerda', acha: /perna.*(esq|e\b)|p[eé].*(esq|e\b)|coxa.*(esq|e\b)/i, presets: ['parada', 'passo'] },
  { nome: 'Pose', acha: /.*/, presets: ['em pé', 'pulando', 'sentado'] },
];
const Atelie = {
  def: null, sel: null, edit: null, vista: { x: 0, y: 0, z: 1 }, pilha: [], refazer: [], ultimo: null, volta: false, aba: 'peca', modoMover: 'preset', sujo: false, base0: null, multi: new Set(), focoImg: null, teste: null,
  // o Ateliê abre numa aba nova do navegador (Voltar fecha a aba); se o navegador bloquear, abre aqui mesmo
  abrirAba(id) {
    if (this.emAba) return this.abrir(id);
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('atelie', id || 'novo');
    const w = window.open(u.href, '_blank'); if (!w) return this.abrir(id, { volta: !!App.P });
  },
  async abrir(id, o = {}) {
    this.volta = !!o.volta; let def;
    let doRascunho = false, novo = null;
    if (o.def) def = o.def; // veio de um arquivo .atelieanimador
    else if (id) { const t = UI.toast('<span class="spin-dot"></span> Abrindo o personagem…', { time: 60000 }), r = await DB.get('arquivos', this.chaveRascunho(id)).catch(() => null); this._rascNuvem = !!r?.nuvem;
      try { def = await Nuvem.abrir(id); this._temNuvem = true; } catch (e) { this._temNuvem = false; if (!r?.def && !o.reserva) { t.remove(); return UI.toast('Não abriu: ' + esc(e.message), { kind: 'err' }); } } t.remove();
      if (!def && !r?.def && o.reserva) { def = o.reserva; doRascunho = true; } // só existe na animação (ex.: veio de um .animador): usa a cópia de lá
      if (r?.def && !def) { def = r.def; doRascunho = true; } // ainda não foi para a nuvem: só existe o rascunho deste computador
      else if (r?.def && JSON.stringify(r.def) !== JSON.stringify(def)) {
        const usa = await UI.modal({ title: 'Tem um rascunho neste computador', icon: 'save', width: 460, body: `<div>As mudanças de <b>${esc(r.def.nome)}</b> feitas neste computador (guardadas ${fmtDate(r.em)}) <b>ainda não foram para a nuvem</b>.<br><br>A versão da nuvem é de ${def.modificado ? fmtDate(def.modificado) : 'antes'}.</div>`,
          buttons: [{ label: 'Abrir a da nuvem (descartar o rascunho)', value: 'nuvem' }, { label: 'Continuar o rascunho', kind: 'primary', value: 'rascunho' }] });
        if (usa === 'rascunho') { this.base0Nuvem = JSON.stringify(def); def = r.def; doRascunho = true; } else if (usa === 'nuvem') await this.apagarRascunho(id); else return;
      } }
    else { novo = await this.assistenteNovo(); if (!novo) return; def = Modelo.novoPersonagem(novo.nome); }
    // NA NUVEM: depois da 1ª vez em "Salvar na nuvem", toda mudança vai sozinha para a nuvem. Antes disso o personagem é LOCAL (só neste computador).
    this.naNuvem = !o.def && !!id && !!def && !(doRascunho && !this._temNuvem && !this._rascNuvem); this._temNuvem = this._rascNuvem = false; this.erroNuvem = null; clearTimeout(this._tn);
    this.def = def; this.sel = (def.raiz && def.partes.some(p => p.id === def.raiz) ? def.raiz : def.partes[0]?.id) || null; this.multi = new Set(); this.focoImg = null; this.edit = null; this.pilha = []; this.refazer = []; this.ultimo = JSON.stringify(def); this.base0 = o.def || !id ? this.ultimo : this.base0Nuvem || this.ultimo; this.base0Nuvem = null; this.modoMover = 'preset'; this.sujo = !id || !!o.def || doRascunho; this.rascunhoEm = doRascunho ? Date.now() : null; this.salvandoLocal = false; this.teste = null; Pintura.selecao = null; clearInterval(this._roda); Animacoes.parar(true); Animacoes.sel = null; Animacoes.passo = null;
    await Arq.garantir(def.partes.flatMap(p => p.imgs.map(i => i.k)));
    Telas.mostra('atelie'); this.liga(); this.pinta(); this.enquadrar(); if (o.def) this.rascunho();
    if (this.naNuvem && this.sujo) this.agendaNuvem(); // mudanças guardadas aqui que ainda não foram: vão agora
    if (novo?.fs.length) await this.montarNovo(novo); document.title = def.nome + ' — Ateliê · ANIMADOR · Estúdio Problems';
  },
  // tela do personagem novo (qualquer personagem): nome, as imagens (camadas do desenho ou peças soltas) e, se quiser, a IA organiza tudo
  async assistenteNovo() {
    let fs = [];
    const body = h(`<div class="novo-p"><label class="field">Nome do personagem<input type="text" data-n placeholder="Nome do personagem"></label>
      <div class="field">Imagens <small>(opcional) — as peças do personagem em PNG com fundo transparente. O melhor: as camadas do desenho exportadas no mesmo tamanho (já encaixam sozinhas).</small></div>
      <div class="np-drop" data-d tabindex="0">${ic('upload', 22)}<b>Arraste as imagens aqui</b><small>ou clique para escolher</small></div><div class="np-lista" data-l></div>
      <label class="chk np-ia"><input type="checkbox" data-ia checked> ${ic('sparkles', 13)} A IA organiza tudo (partes, raiz, encaixes, pontos de giro, camadas, sessões, presets e animações de teste)</label>
      <textarea rows="2" data-p placeholder="Opcional: dicas para a IA. Ex.: &quot;as bocas são para falar&quot;, &quot;o corpo é a raiz&quot;"></textarea></div>`);
    const lista = $('[data-l]', body), drop = $('[data-d]', body), ia = $('[data-ia]', body), urls = [];
    const pintaL = () => { urls.forEach(u => URL.revokeObjectURL(u)); urls.length = 0; lista.innerHTML = '';
      fs.forEach((f, i) => { const u = URL.createObjectURL(f); urls.push(u); const c = h(`<div class="np-im" title="${esc(f.name)}"><img src="${u}" alt=""><span>${esc(f.name.replace(/\.[^.]+$/, ''))}</span><button class="ibtn" title="Tirar">${ic('x', 11)}</button></div>`); $('button', c).onclick = () => { fs.splice(i, 1); pintaL(); }; lista.appendChild(c); });
      drop.classList.toggle('tem', !!fs.length); $('b', drop).textContent = fs.length ? `${fs.length} imagem(ns) — arraste mais se quiser` : 'Arraste as imagens aqui';
      $('.np-ia', body).hidden = $('[data-p]', body).hidden = !fs.length; };
    const poe = l => { fs = fs.concat([...l].filter(f => /^image\//.test(f.type) || /\.(png|webp|gif|jpe?g)$/i.test(f.name))); pintaL(); };
    drop.onclick = async () => { const l = await pickFiles('image/png,image/webp,image/gif,image/jpeg', true); if (l) poe(l); };
    drop.ondragover = e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); drop.classList.add('drop-dentro'); } }; drop.ondragleave = () => drop.classList.remove('drop-dentro');
    drop.ondrop = e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('drop-dentro'); poe(e.dataTransfer.files); };
    pintaL(); setTimeout(() => $('[data-n]', body).focus(), 60);
    const pega = a => { const n = $('[data-n]', a.body).value.trim(); if (!n) { $('[data-n]', a.body).focus(); UI.toast('Dê um nome ao personagem'); return false; } return n; };
    const r = await UI.modal({ title: 'Personagem novo', icon: 'layers', width: 560, body, buttons: [
      { label: 'Cancelar', value: null, left: true },
      { label: 'Pular (só o nome)', onClick: a => { const n = pega(a); return n ? { nome: n, fs: [], ia: false } : false; } },
      { label: 'Criar', kind: 'primary', onClick: a => { const n = pega(a); return n ? { nome: n, fs, ia: ia.checked && !!fs.length, pedido: $('[data-p]', a.body).value.trim() } : false; } }] });
    urls.forEach(u => setTimeout(() => URL.revokeObjectURL(u), 2000)); return r;
  },
  async montarNovo(novo) {
    await this.addImagens(novo.fs, true); // cada imagem vira uma parte (camadas do mesmo tamanho já ficam no lugar)
    const t = UI.toast('<span class="spin-dot"></span> Aparando as sobras transparentes…', { time: 120000 });
    try { await Pintura.apararLista(this.def.partes.flatMap(p => p.imgs)); } catch { } t.remove(); this.commit(); this.enquadrar();
    if (novo.ia) await this.iaOrganizar('organizar', novo.pedido || '');
  },
  async sair() {
    // nada se perde ao sair: guarda já neste computador e, se o personagem é da nuvem, manda o que falta
    await this.guardarLocalJa();
    if (this.naNuvem && this.sujo) { const t = UI.toast('<span class="spin-dot"></span> Mandando as últimas mudanças para a nuvem…', { time: 60000 }); await this.sincronizar(true); t.remove();
      if (this.sujo && !(await UI.confirm({ title: 'Não foi para a nuvem', msg: 'As últimas mudanças ficaram guardadas <b>só neste computador</b> (' + esc(this.erroNuvem || 'sem conexão') + '). Ao abrir de novo aqui, elas vão para a nuvem.', ok: 'Sair mesmo assim', danger: true }))) return; }
    if (this.emAba) { this.sujo = false; window.close(); setTimeout(() => { if (!window.closed) { history.replaceState(null, '', location.pathname); this.emAba = false; Telas.mostra('home'); Home.aba('personagens'); } }, 300); return; }
    if (this.volta && App.P) { Telas.mostra('editor'); App.titulo(); App.atualiza(); } else { Telas.mostra('home'); Home.aba('personagens'); }
  },
  commit(o = {}) { const s = JSON.stringify(this.def); if (s !== this.ultimo) { this.pilha.push(this.ultimo); if (this.pilha.length > 120) this.pilha.shift(); this.refazer = []; this.ultimo = s; this.sujo = true; this.rascunho(); } if (!o.soDesenho) this.pinta(); else this.desenha(); },
  undo() { if (!this.pilha.length) return; this.refazer.push(this.ultimo); this.ultimo = this.pilha.pop(); this.def = JSON.parse(this.ultimo); this.sujo = true; this.rascunho(); this.pinta(); },
  redo() { if (!this.refazer.length) return; this.pilha.push(this.ultimo); this.ultimo = this.refazer.pop(); this.def = JSON.parse(this.ultimo); this.sujo = true; this.rascunho(); this.pinta(); },

  /* ---------- RASCUNHO: toda mudança fica guardada NESTE navegador (se cair a energia, nada se perde). Só "Salvar na nuvem" manda para a equipe.
     Guardado em arquivos["rascunho:<id do personagem>"] = { def, em, thumb }. As imagens novas já ficam no navegador (Arq). ---------- */
  chaveRascunho(id = this.def?.id) { return 'rascunho:' + id; },
  rascunho() {
    if (!this.def) return; this.salvandoLocal = true; this.pintaEstado(); clearTimeout(this._tr);
    this._tr = setTimeout(async () => { try { const def = JSON.parse(this.ultimo || JSON.stringify(this.def)); let thumb = null; try { thumb = this.miniatura(); } catch { }
      await DB.put('arquivos', { tipo: 'rascunho-atelie', def, em: Date.now(), thumb, nuvem: !!this.naNuvem }, this.chaveRascunho(def.id)); this.rascunhoEm = Date.now(); } catch (e) { UI.toast('Não consegui guardar no navegador: ' + esc(e.message), { kind: 'err' }); }
      this.salvandoLocal = false; this.pintaEstado(); window.EstudioConta?.espaco?.atualizar?.(); if (this.naNuvem) this.agendaNuvem(); }, 500);
  },
  // guarda já (sem esperar) neste computador
  async guardarLocalJa() {
    if (!this.def || (!this.sujo && !this.salvandoLocal)) return; clearTimeout(this._tr);
    try { const def = JSON.parse(this.ultimo || JSON.stringify(this.def)); let thumb = null; try { thumb = this.miniatura(); } catch { }
      await DB.put('arquivos', { tipo: 'rascunho-atelie', def, em: Date.now(), thumb, nuvem: !!this.naNuvem }, this.chaveRascunho(def.id)); this.rascunhoEm = Date.now(); return true; }
    catch (e) { UI.toast('Não consegui guardar no navegador: ' + esc(e.message), { kind: 'err' }); return false; }
    finally { this.salvandoLocal = false; this.pintaEstado(); window.EstudioConta?.espaco?.atualizar?.(); }
  },
  /* ---------- ENVIO AUTOMÁTICO para a nuvem (só personagens que já foram para a nuvem uma vez) ---------- */
  agendaNuvem() { clearTimeout(this._tn); this._tn = setTimeout(() => this.sincronizar(), 4000); this.pintaEstado(); },
  async sincronizar(agora) {
    clearTimeout(this._tn); if (!this.naNuvem || !this.def) return;
    if (this.enviando) { this.denovo = true; if (agora) await this.enviando; return; }
    const snap = this.ultimo || JSON.stringify(this.def), def = JSON.parse(snap); if (!def.partes.length) return;
    this.erroNuvem = null; this.pintaEstado();
    this.enviando = (async () => {
      try { try { def.thumb = this.miniatura(); } catch { }
        if (def.iaPlano?.resumo) { try { const c = IA.correcoes(def.iaPlano.resumo, IA.resumo(def)); def.iaCorrecoes = [...new Set([...(def.iaCorrecoes || []), ...c])].slice(-40); } catch { } }
        await Nuvem.salvar(def);
        if ((this.ultimo || JSON.stringify(this.def)) === snap) { this.sujo = false; await DB.del('arquivos', this.chaveRascunho(def.id)).catch(() => { }); this.rascunhoEm = null; }
        if (this.def?.id === def.id) { this.def.modificado = def.modificado; this.def.autor = def.autor; this.def.edicoes = def.edicoes; this.def.thumb = def.thumb; }
        if (App.P?.personagens?.[def.id]) { App.P.personagens[def.id] = clone(def); App.commit('Personagem atualizado'); }
        try { new BroadcastChannel('animador').postMessage({ tipo: 'personagem', def }); } catch { }
      } catch (e) { this.erroNuvem = e.message || 'sem conexão'; }
    })();
    await this.enviando; this.enviando = null; this.pintaEstado(); $('#at-salvar') && this.pintaBotaoNuvem();
    if (this.denovo) { this.denovo = false; if (this.sujo) return this.sincronizar(agora); }
  },
  // Ctrl+S: guarda neste computador (NÃO manda para a nuvem; só o botão da nuvem manda — ou sozinho, se ele já está lá)
  async salvarLocal() {
    try { new BroadcastChannel('animador').postMessage({ tipo: 'personagem', def: JSON.parse(JSON.stringify(this.def)) }); } catch { } // a animação aberta na outra aba recebe já
    if (!this.def) return; const ok = await this.guardarLocalJa(); if (ok === false) return;
    if (this.naNuvem) { UI.toast(`<b>${esc(this.def.nome)}</b> guardado neste computador e indo para a nuvem.`, { kind: 'ok' }); this.sincronizar(); }
    else UI.toast(`<b>${esc(this.def.nome)}</b> guardado <b>neste computador</b>. Para a equipe ver, clique na nuvem (Salvar na nuvem).`, { kind: 'ok', time: 5000 });
    await this.avisoLocais();
  },
  // aviso de quantos personagens do Ateliê estão só neste computador (aparece sempre que salva)
  async avisoLocais() {
    const rs = (await this.rascunhos()).filter(r => !r.nuvem && !(this.naNuvem && r.def.id === this.def?.id)); if (!rs.length) return;
    const atualLocal = !this.naNuvem && rs.some(r => r.def.id === this.def?.id), n = rs.length;
    const body = h(`<div><div>${n === 1 ? 'Este personagem do Ateliê' : `Estes ${n} personagens do Ateliê`} ainda <b>não ${n === 1 ? 'está' : 'estão'} na nuvem</b>: ${n === 1 ? 'fica' : 'ficam'} só neste computador. A equipe não vê, e se este navegador for limpo ${n === 1 ? 'ele some' : 'eles somem'}.</div>
      <div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr));margin-top:12px">${rs.slice(0, 24).map(r => `<div class="pc"><div class="th" style="aspect-ratio:1;${r.thumb ? `background-image:url('${r.thumb}')` : ''}">${r.thumb ? '' : ic('layers', 20)}</div><div class="in"><b>${esc(r.def.nome)}</b></div></div>`).join('')}</div>
      <div style="margin-top:10px;color:var(--tx3);font-size:12.5px">Para mandar um deles: abra no Ateliê e clique em <b>Salvar na nuvem</b> (o botão com a nuvem). Depois disso, toda mudança vai sozinha.</div></div>`);
    const r = await UI.modal({ title: `${n} ${n === 1 ? 'personagem não está' : 'personagens não estão'} na nuvem`, icon: 'cloud', width: 520, body,
      buttons: [...(atualLocal ? [{ label: 'Salvar este na nuvem', kind: 'primary', value: 'nuvem' }] : []), { label: 'Ok', value: null, ...(atualLocal ? {} : { kind: 'primary' }) }] });
    if (r === 'nuvem') this.salvar({ semAviso: true });
  },
  pintaBotaoNuvem() {
    const b = $('#at-salvar'); if (!b) return;
    const txt = !this.naNuvem ? 'Salvar na nuvem' : this.enviando ? 'Enviando…' : this.sujo ? 'Enviar agora' : 'Na nuvem';
    b.innerHTML = `${ic('cloud', 15)} ${txt}`; b.classList.toggle('primary', !this.naNuvem || !!this.sujo);
    b.title = this.naNuvem ? 'Este personagem está na nuvem da equipe: as mudanças vão sozinhas (clique para mandar agora).' : 'Salvar na nuvem da equipe (Ctrl+S guarda só neste computador)';
  },
  async apagarRascunho(id = this.def?.id) { clearTimeout(this._tr); this.salvandoLocal = false; this.rascunhoEm = null; try { await DB.del('arquivos', this.chaveRascunho(id)); } catch { } },
  async rascunhos() { try { const ks = (await DB.keys('arquivos')).filter(k => String(k).startsWith('rascunho:')); return (await Promise.all(ks.map(k => DB.get('arquivos', k)))).filter(r => r?.def).sort((a, b) => b.em - a.em); } catch { return []; } },
  // selo ao lado do Salvar: salvo na nuvem / só neste computador
  pintaEstado() {
    const el = $('#at-estado'); if (!el || !this.def) return; const hora = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const [cls, ico, txt, dica] = this.naNuvem ? (
        this.enviando ? ['nuvem', 'cloud', 'Enviando para a nuvem…', 'As mudanças estão indo para a nuvem da equipe.']
      : this.erroNuvem && this.sujo ? ['local', 'alert', 'Não foi para a nuvem', 'Ficou guardado neste computador. Tenta de novo sozinho na próxima mudança, ou clique em "Enviar agora". (' + this.erroNuvem + ')']
      : this.sujo ? ['nuvem', 'cloud', 'Mudanças indo para a nuvem…', 'Este personagem está na nuvem: as mudanças vão sozinhas em poucos segundos.']
      : ['nuvem', 'cloud', 'Salvo na nuvem', 'Esta versão é a que está na nuvem da equipe; as próximas mudanças vão sozinhas.'])
      : this.salvandoLocal ? ['local', 'save', 'Guardando no computador…', 'Guardando neste navegador para não perder nada.']
      : ['local', 'save', 'Só neste computador' + (this.rascunhoEm ? ' · ' + hora(this.rascunhoEm) : ''), 'Personagem LOCAL: guardado neste navegador (Ctrl+S), a equipe ainda não vê. Clique na nuvem (Salvar na nuvem) para mandar; depois disso as mudanças vão sozinhas.'];
    el.className = 'at-estado ' + cls; el.title = dica; el.innerHTML = `${ic(ico, 13)}<span>${esc(txt)}</span>`;
  },

  /* ---------- estado que está na tela (base ou preset em edição) ---------- */
  parte(id = this.sel) { return this.def.partes.find(p => p.id === id) || null; },
  // partes marcadas: a escolhida + as do Ctrl/Shift+clique
  selecionadas() { return [...new Set([this.sel, ...this.multi])].map(id => this.parte(id)).filter(Boolean); },
  escolhe(id) { this.sel = id; this.multi.clear(); this.focoImg = null; },
  sessao() { return this.edit ? this.def.sessoes.find(s => s.id === this.edit.s) : null; },
  preset() { const s = this.sessao(); return s ? s.presets.find(p => p.id === this.edit.p) : null; },
  estado() {
    if (this.teste && Animacoes.parado) return Modelo.partesNoEstado(this.def, Animacoes.frameAtual()); // pausado / pose do editor: o quadro inteiro (as edições caem no passo ou preset certo)
    return Modelo.partesNoEstado(this.def, this.teste ? this.teste : this.edit ? { sessoes: { [this.edit.s]: this.edit.p } } : {});
  },
  // muda um campo da parte no modo atual (base ou o preset em edição)
  mudar(pid, vals) {
    const p = this.parte(pid); if (!p) return;
    const ps = this.editPasso && Animacoes.passoEditado(); if (ps) { ps.p = ps.p || {}; ps.p[pid] = { ...(ps.p[pid] || {}), ...vals }; return; } // passo de uma animação de teste (pausada)
    const pr = this.preset();
    if (pr) { const s = this.sessao(); if (s.partes?.length && !s.partes.includes(pid)) { s.partes.push(pid); } pr.estado[pid] = { ...(pr.estado[pid] || {}), ...vals }; }
    else Object.assign(p.base, vals);
  },
  get moverTodos() { return this.modoMover === 'todos'; },
  matParte(pid, est = this.estado()) { const it = Modelo.montar(this.def, est).find(x => x.parte.id === pid); return it ? it.mp || it.m : new DOMMatrix(); },
  matPai(pid, est = this.estado()) { const p = this.parte(pid); return p?.pai ? this.matParte(p.pai, est) : new DOMMatrix(); },

  /* ---------- tela ---------- */
  liga() {
    if (this._ligado) return; this._ligado = true;
    this.cv = $('#at-cv'); this.ctx = this.cv.getContext('2d'); new ResizeObserver(() => this.tamanho()).observe(this.cv.parentElement); this.tamanho();
    this.cv.addEventListener('pointerdown', e => this.desce(e)); this.cv.addEventListener('contextmenu', e => { e.preventDefault(); if (!this._panMexeu && !this.teste) this.menuPalco(e); this._panMexeu = false; }); // botão direito sem arrastar: menu da peça
    this.cv.addEventListener('wheel', e => this.roda(e), { passive: false }); // rodinha do mouse: zoom no ponto do mouse
    $('#at-voltar').onclick = () => this.sair(); $('#at-salvar').onclick = () => this.naNuvem ? this.sincronizar(true) : this.salvar(); $('#at-undo').onclick = () => this.undo(); $('#at-redo').onclick = () => this.redo();
    $('#at-nome').onchange = e => { this.def.nome = e.target.value.trim() || this.def.nome; this.commit(); };
    $('#at-pasta').onchange = e => { this.def.pasta = e.target.value.trim() || 'Personagens'; this.commit(); };
    $('#at-add-parte').onclick = () => this.novaParte(); $$('#at-vista-partes [data-v]').forEach(b => b.onclick = () => { this.vistaPartes = b.dataset.v; this.pintaPartes(); }); $('#at-add-img').onclick = () => this.addImagens(); $('#at-add-pasta').onclick = () => { const p = this.parte(); if (p) this.novaPastaImg(p); else UI.toast('Escolha uma parte primeiro'); };
    // soltar imagens no palco do ateliê: entram na parte escolhida (sem parte escolhida, cada uma vira uma parte)
    const cvA = $('#at-cv'); cvA.ondragover = ev => { if (ev.dataTransfer.types.includes('Files')) ev.preventDefault(); }; cvA.ondrop = ev => { if (ev.dataTransfer.files?.length) { ev.preventDefault(); this.addImagens([...ev.dataTransfer.files], !this.parte()); } };
    $$('#at-abas [data-aba]').forEach(b => b.onclick = () => { this.aba = b.dataset.aba; this.pinta(); });
    $('#at-base').onclick = () => { this.edit = null; this.pinta(); };
    $$('#at-mover [data-modo]').forEach(b => b.onclick = () => this.setModo(b.dataset.modo));
    $('#at-enq').onclick = () => this.enquadrar(); $('#at-testar').onclick = () => this.testar(!this.teste);
    $('#at-ia').innerHTML = `${ic('sparkles', 15)}<span>IA</span>`; $('#at-ia').onclick = () => this.ia();
    addEventListener('keydown', e => this.teclas(e));
    Pintura.liga();
  },
  tamanho() { const r = this.cv.getBoundingClientRect(), d = devicePixelRatio || 1; this.cv.width = Math.max(2, r.width * d); this.cv.height = Math.max(2, r.height * d); this.desenha(); },
  enquadrar() {
    if (!this.cv) return; const r = this.cv.getBoundingClientRect(), b = Modelo.caixaPersonagem(this.def, this.estado()), livre = this.teste && !this.testeMin ? 320 : 0, W = Math.max(200, r.width - livre); // o painel do Testar não cobre o personagem
    const z = Math.min(W / (b.w + 200), r.height / (b.h + 200), 2.5);
    this.vista = { z, x: W / 2 - (b.x + b.w / 2) * z, y: r.height / 2 - (b.y + b.h / 2) * z }; this.desenha();
  },
  V() { const d = devicePixelRatio || 1, v = this.vista; return new DOMMatrix().scale(d).translate(v.x, v.y).scale(v.z); },
  mundo(e) { const r = this.cv.getBoundingClientRect(), v = this.vista; return { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }; },
  desenha() {
    if (!this.ctx || !this.def) return; const ctx = this.ctx, W = this.cv.width, H = this.cv.height, d = devicePixelRatio || 1, V = this.V();
    ctx.setTransform(1, 0, 0, 1, 0, 0); const fundo = Animacoes.corFundo();
    if (fundo === 'cenario') { const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#9fd3f0'); gr.addColorStop(.62, '#9fd3f0'); gr.addColorStop(.62, '#8cc56b'); gr.addColorStop(1, '#8cc56b'); ctx.fillStyle = gr; } else ctx.fillStyle = fundo || '#151515';
    ctx.fillRect(0, 0, W, H);
    // grade xadrez (fundo transparente)
    ctx.save(); ctx.setTransform(V); const g = 50; ctx.fillStyle = '#1b1b1b'; const a = this.mundoTela(0, 0), b2 = this.mundoTela(W / d, H / d);
    if (!fundo) for (let x = Math.floor(a.x / g) * g; x < b2.x; x += g) for (let y = Math.floor(a.y / g) * g; y < b2.y; y += g) if (((x + y) / g) % 2 === 0) ctx.fillRect(x, y, g, g);
    ctx.strokeStyle = fundo ? 'rgba(0,0,0,.1)' : '#2c2c2c'; ctx.lineWidth = 1 / this.vista.z; ctx.beginPath(); ctx.moveTo(-5000, 0); ctx.lineTo(5000, 0); ctx.moveTo(0, -5000); ctx.lineTo(0, 5000); ctx.stroke(); ctx.restore();
    const est = this.estado(), itens = Modelo.montar(this.def, est);
    for (const it of itens) { if (!it.img) continue; const bm = Arq.bitmap(it.img.k, () => this.desenha()); if (!bm) continue; const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2;
      ctx.save(); ctx.setTransform(V.multiply(it.m)); ctx.globalAlpha = this.sel && it.parte.id !== this.sel && this.destacar ? .45 : 1; ctx.drawImage(bm, -px + (it.img.ajuste?.x || 0), -py + (it.img.ajuste?.y || 0), it.img.w, it.img.h); ctx.restore(); }
    ctx.save(); ctx.setTransform(V); Animacoes.desenhaFantasma(ctx); ctx.restore();
    // parte escolhida: só a caixa tracejada (numa cor que contrasta com a peça) e uma cruzinha discreta no centro.
    // O pivô (ponto de giro) só aparece segurando Alt (Alt+arrastar muda o pivô); a alça com seta circular (ou Ctrl+arrastar) gira a peça.
    const it = this.teste && !Animacoes.parado ? null : itens.find(x => x.parte.id === this.sel); this._giro = null;
    if (it?.img) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const T = V.multiply(it.m), px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2, ax = it.img.ajuste?.x || 0, ay = it.img.ajuste?.y || 0;
      const c = [[0, 0], [it.img.w, 0], [it.img.w, it.img.h], [0, it.img.h]].map(([x, y]) => T.transformPoint(new DOMPoint(x - px + ax, y - py + ay))), cor = this.corContraste(it.img);
      const caixa = () => { ctx.beginPath(); c.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); };
      ctx.lineWidth = 3 * d; ctx.strokeStyle = 'rgba(0,0,0,.35)'; caixa(); ctx.stroke(); // sombra fina para aparecer em qualquer fundo
      ctx.lineWidth = 1.6 * d; ctx.strokeStyle = cor; ctx.setLineDash([6 * d, 4 * d]); caixa(); ctx.stroke(); ctx.setLineDash([]);
      const cx = (c[0].x + c[2].x) / 2, cy = (c[0].y + c[2].y) / 2, r = 7 * d; ctx.globalAlpha = .45; ctx.strokeStyle = cor; ctx.lineWidth = 1.4 * d;
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke(); ctx.globalAlpha = 1;
      // alça de girar: ícone de seta circular, meio transparente, na mesma cor que contrasta com a peça
      { const mt = { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 }, piv = T.transformPoint(new DOMPoint(0, 0)), ux = mt.x - cx, uy = mt.y - cy, L = Math.hypot(ux, uy) || 1, gx = mt.x + ux / L * 26 * d, gy = mt.y + uy / L * 26 * d, R = 8 * d;
        this._giro = { x: gx, y: gy, piv };
        ctx.globalAlpha = .82; ctx.beginPath(); ctx.arc(gx, gy, 12 * d, 0, 7); ctx.fillStyle = 'rgba(20,20,20,.5)'; ctx.fill(); ctx.lineWidth = 1 * d; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke();
        ctx.save(); const k = 14 * d / 24; ctx.translate(gx - 12 * k, gy - 12 * k); ctx.scale(k, k); ctx.strokeStyle = cor; ctx.lineWidth = 2.4; ctx.lineCap = ctx.lineJoin = 'round';
        ctx.stroke(new Path2D('M21 12a9 9 0 1 1-2.64-6.36L21 8')); ctx.stroke(new Path2D('M21 3v5h-5')); ctx.restore(); ctx.globalAlpha = 1; }
      if (this.alt) { const piv = T.transformPoint(new DOMPoint(0, 0)); ctx.globalAlpha = .8; ctx.beginPath(); ctx.arc(piv.x, piv.y, 5 * d, 0, 7); ctx.fillStyle = '#ff6b6b'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * d; ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.restore();
    }
    Pintura.desenhaCursor(ctx);
  },
  _corImg: new Map(),
  corContraste(img) {
    const k = img.k; if (this._corImg.has(k)) return this._corImg.get(k); const bm = Arq.img.get(k); if (!bm) return '#3d8bff';
    const S = 32, c = new OffscreenCanvas(S, S).getContext('2d', { willReadFrequently: true }); c.drawImage(bm, 0, 0, S, S); const D = c.getImageData(0, 0, S, S).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < D.length; i += 4) if (D[i + 3] > 120) { r += D[i]; g += D[i + 1]; b += D[i + 2]; n++; } if (n) { r /= n; g /= n; b /= n; }
    const cand = [[47, 123, 255], [255, 47, 160], [22, 192, 96], [155, 92, 255], [0, 200, 255], [255, 138, 31]];
    const dist = q => Math.hypot((q[0] - r) * .9, (q[1] - g) * 1.2, (q[2] - b) * .8), best = cand.reduce((a, q) => dist(q) > dist(a) ? q : a);
    const cor = `rgb(${best.join(',')})`; this._corImg.set(k, cor); return cor;
  },
  mundoTela(x, y) { const v = this.vista; return { x: (x - v.x) / v.z, y: (y - v.y) / v.z }; },
  roda(e) { e.preventDefault(); const r = this.cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = this.vista, z = clamp(v.z * Math.exp(-e.deltaY * .0015), .05, 20); v.x = mx - (mx - v.x) * z / v.z; v.y = my - (my - v.y) * z / v.z; v.z = z; this.desenha(); },
  // qual peça está embaixo do mouse (a da frente)
  acha(w) {
    const itens = Modelo.montar(this.def, this.estado()).filter(i => i.img).reverse();
    for (const it of itens) { const loc = it.m.inverse().transformPoint(new DOMPoint(w.x, w.y)), px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2, x = loc.x + px - (it.img.ajuste?.x || 0), y = loc.y + py - (it.img.ajuste?.y || 0);
      if (x >= 0 && y >= 0 && x <= it.img.w && y <= it.img.h) { const bm = Arq.img.get(it.img.k); if (!bm || this.opaco(bm, x * bm.width / it.img.w, y * bm.height / it.img.h)) return it; } }
    return null;
  },
  _alfa: new Map(),
  opaco(bm, x, y) { let c = this._alfa.get(bm); if (!c) { c = new OffscreenCanvas(bm.width, bm.height).getContext('2d', { willReadFrequently: true }); c.drawImage(bm, 0, 0); this._alfa.set(bm, c); } return c.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] > 20; },
  desce(e) {
    try { this.cv.setPointerCapture(e.pointerId); } catch { } const d = devicePixelRatio || 1;
    const fim = (mov, up) => { const m = ev => mov(ev), u = ev => { this.cv.removeEventListener('pointermove', m); this.cv.removeEventListener('pointerup', u); up?.(ev); }; this.cv.addEventListener('pointermove', m); this.cv.addEventListener('pointerup', u); };
    if (e.button === 1 || e.button === 2 || this.espaco) { const v = this.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; let mexeu = false;
      this._panMexeu = false; return fim(ev => { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 3) mexeu = this._panMexeu = true; v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; this.desenha(); }); }
    if (this.teste && !Animacoes.parado && e.button === 0) { const v = this.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; return fim(ev => { v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; this.desenha(); }); } // testando: só move a tela
    if (e.button === 0 && Pintura.ferr !== 'mover') return Pintura.desce(e); // pincel, borracha, balde, conta-gotas
    // girar: Ctrl+arrastar na peça escolhida (gira em volta do pivô)
    let pegaGiro = this._giro && Math.hypot(e.offsetX * d - this._giro.x, e.offsetY * d - this._giro.y) < 14 * d; // a alça de girar
    if (!pegaGiro && (e.ctrlKey || e.metaKey) && this.parte() && !this.teste) { const p = this.parte(), piv = this.V().multiply(this.matParte(p.id)).transformPoint(new DOMPoint(0, 0)); this._giro = { piv }; pegaGiro = true; }
    if (pegaGiro) {
      const g = this._giro; this._giro = null; const p = this.parte(), e0 = this.estado()[p.id], ang = ev => Math.atan2(ev.offsetY * d - g.piv.y, ev.offsetX * d - g.piv.x) * 180 / Math.PI, a0 = ang(e);
      return fim(ev => { let r = (e0.r || 0) + ang(ev) - a0; if (ev.shiftKey) r = Math.round(r / 15) * 15; this.mudar(p.id, { r: round(r, 1) }); this.desenha(); }, () => this.commit());
    }
    const w = this.mundo(e), it = this.acha(w);
    if (!it) { const v = this.vista, x0 = e.clientX, y0 = e.clientY, vx = v.x, vy = v.y; let mexeu = false; return fim(ev => { mexeu = true; v.x = vx + ev.clientX - x0; v.y = vy + ev.clientY - y0; this.desenha(); }, () => { if (!mexeu) { this.escolhe(null); this.pinta(); } }); }
    if (it.parte.id !== this.sel || this.multi.size || this.focoImg || this.teste) { this.escolhe(it.parte.id); if (this.teste) Animacoes.alvoPausa(it.parte.id); this.pinta(); }
    const p = it.parte, est = this.estado(), w0 = w;
    if (e.altKey && it.img) { // pivô: muda o ponto de giro sem tirar a peça do lugar
      const img = it.img, inv = it.m.inverse(), l0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), piv0 = { ...(img.pivo || { x: img.w / 2, y: img.h / 2 }) }, enc0 = { ...p.encaixe }, filhos = this.def.partes.filter(f => f.pai === p.id).map(f => [f, { ...f.encaixe }]);
      return fim(ev => { const w2 = this.mundo(ev), l = inv.transformPoint(new DOMPoint(w2.x, w2.y)), dx = l.x - l0.x, dy = l.y - l0.y;
        img.pivo = { x: round(piv0.x + dx, 1), y: round(piv0.y + dy, 1) };
        const lin = it.m.multiply(new DOMMatrix().translate(0, 0)), pai = this.matPai(p.id, est).inverse(), a = pai.multiply(lin);
        const mv = new DOMPoint(dx, dy, 0, 0), dp = new DOMMatrix([a.a, a.b, a.c, a.d, 0, 0]).transformPoint(mv); // deslocamento no espaço do pai
        p.encaixe = { x: round(enc0.x + dp.x, 1), y: round(enc0.y + dp.y, 1) }; for (const [f, e0] of filhos) f.encaixe = { x: round(e0.x - dx, 1), y: round(e0.y - dy, 1) };
        this.desenha(); }, () => this.commit());
    }
    if (this.modoMover === 'preset' && it.img) { // PADRÃO: esta imagem SÓ neste preset (ou só na base)
      const img = it.img, inv = (it.mp || it.m).inverse(), l0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), d0 = { ...(est[p.id]?.d?.[img.id] || { x: 0, y: 0 }) };
      return fim(ev => { const w2 = this.mundo(ev), l = inv.transformPoint(new DOMPoint(w2.x, w2.y)); let dx = l.x - l0.x, dy = l.y - l0.y; if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        this.poeD(p, img, { x: round(d0.x + dx, 1), y: round(d0.y + dy, 1) }); this.desenha(); }, () => this.commit());
    }
    if (this.modoMover === 'imagem' && it.img) { // a mesma imagem em TODOS os presets (e na base)
      const img = it.img, inv = it.m.inverse(), l0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), aj0 = { ...(img.ajuste || { x: 0, y: 0 }) };
      return fim(ev => { const w2 = this.mundo(ev), l = inv.transformPoint(new DOMPoint(w2.x, w2.y)); let dx = l.x - l0.x, dy = l.y - l0.y; if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
        img.ajuste = { x: round(aj0.x + dx, 1), y: round(aj0.y + dy, 1) }; this.desenha(); }, () => this.commit());
    }
    // MOVER TODOS: a parte inteira. Na Base muda o encaixe (onde ela fica no pai); num preset muda só o preset
    const inv = this.matPai(p.id, est).inverse(), a0 = inv.transformPoint(new DOMPoint(w0.x, w0.y)), e0 = { ...est[p.id] }, enc0 = { ...p.encaixe };
    fim(ev => { const w2 = this.mundo(ev), a = inv.transformPoint(new DOMPoint(w2.x, w2.y)); let dx = a.x - a0.x, dy = a.y - a0.y; if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      if (this.edit || this.editPasso) this.mudar(p.id, { x: round((e0.x || 0) + dx, 1), y: round((e0.y || 0) + dy, 1) }); else p.encaixe = { x: round(enc0.x + dx, 1), y: round(enc0.y + dy, 1) }; this.desenha(); }, () => this.commit());
  },
  teclas(e) {
    if ($('#atelie').classList.contains('hidden') || $('#modal-root').children.length) return;
    if (e.target.closest?.('input,textarea,select') && e.target.type !== 'range') return;
    const k = e.key, ctrl = e.ctrlKey || e.metaKey, p = this.parte();
    if (k === ' ') { this.espaco = e.type === 'keydown'; e.preventDefault(); return; }
    if (ctrl && k.toLowerCase() === 'z') { e.preventDefault(); return e.shiftKey ? this.redo() : this.undo(); }
    if (ctrl && k.toLowerCase() === 's') { e.preventDefault(); return this.salvarLocal(); } // Ctrl+S = guardar neste computador
    if (ctrl) { Pintura.teclaCtrl(e); return; }
    if (this.teste && (k.toLowerCase() === 'p' || k === 'Enter') && Animacoes.tocando) { e.preventDefault(); return Animacoes.pausado ? Animacoes.continuar() : Animacoes.pausar(); } // P: pausa/continua
    if (this.teste && Animacoes.parado && (k === ',' || k === '.')) { e.preventDefault(); return Animacoes.passoMais(k === '.' ? 1 : -1); }
    if (this.teste) { if (k === 'Escape' || k.toLowerCase() === 't') { e.preventDefault(); this.testar(false); return; } if (!Animacoes.parado) return; } // testando: só pausado dá para mexer nas peças
    if (k.toLowerCase() === 't' && !e.shiftKey && !e.altKey) { e.preventDefault(); return this.testar(true); }
    if (e.type === 'keydown' && Pintura.tecla(e)) return;
    if ((k === 'Delete' || k === 'Backspace') && Pintura.temSelecao()) { e.preventDefault(); return Pintura.mexeDentro('apagar'); } // área selecionada na imagem
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return this.apagarSelecao(); }
    if (k === 'Escape' && Pintura.selecao) { e.preventDefault(); return Pintura.desmarcar(); }
    if (k === 'Escape' && (this.multi.size || this.focoImg)) { this.multi.clear(); this.focoImg = null; return this.pinta(); }
    if (k === 'Tab') { e.preventDefault(); const ps = this.def.partes; if (!ps.length) return; const i = ps.findIndex(x => x.id === this.sel); this.multi.clear(); this.focoImg = null; this.sel = ps[(i + (e.shiftKey ? -1 : 1) + ps.length) % ps.length].id; return this.pinta(); }
    if (!p) return; const est = this.estado()[p.id], passo = e.shiftKey ? 10 : 1, kk = k.toLowerCase();
    const leva = () => { clearTimeout(this._t); this.desenha(); this._t = setTimeout(() => this.commit(), 300); };
    if (k.startsWith('Arrow')) { e.preventDefault(); const dd = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[k];
      const im = p.imgs.find(i => i.id === est.img);
      if (this.modoMover === 'preset' && im) { const d0 = est.d?.[im.id] || { x: 0, y: 0 }; this.poeD(p, im, { x: round(d0.x + dd[0], 1), y: round(d0.y + dd[1], 1) }); } // só neste preset
      else if (this.modoMover === 'imagem' && im) im.ajuste = { x: round((im.ajuste?.x || 0) + dd[0], 1), y: round((im.ajuste?.y || 0) + dd[1], 1) }; // a mesma imagem em todos
      else if (this.edit || this.editPasso) this.mudar(p.id, { x: (est.x || 0) + dd[0], y: (est.y || 0) + dd[1] }); else p.encaixe = { x: p.encaixe.x + dd[0], y: p.encaixe.y + dd[1] }; return leva(); }
    if (kk === 'q' || kk === 'e') { this.mudar(p.id, { r: round((est.r || 0) + (kk === 'q' ? -1 : 1) * (e.shiftKey ? 15 : 2), 1) }); return leva(); }
    if (k === '+' || k === '=' || k === '-') { this.mudar(p.id, { s: round(clamp((est.s ?? 1) * (k === '-' ? .96 : 1.04), .05, 10), 3) }); return leva(); }
    if (kk === 'f') { this.mudar(p.id, { sx: (est.sx || 1) * -1 }); return leva(); }
    if (kk === 'h') { this.mudar(p.id, { vis: est.vis === false }); return leva(); }
    if (k === '[' || k === ']') return this.passoCamada(p, k === ']' ? 1 : -1);
  },

  /* ---------- painéis ---------- */
  pinta() {
    if (!this.def) return; $('#at-nome').value = this.def.nome; $('#at-pasta').value = this.def.pasta || 'Personagens';
    this.pintaBotaoNuvem(); this.pintaEstado();
    const au = $('#at-autores'); if (au && au._de !== this.def.autor?.em + '/' + (this.def.edicoes || []).length) { au._de = this.def.autor?.em + '/' + (this.def.edicoes || []).length; au.innerHTML = ''; const sl = Autores.selo(this.def); if (sl) au.appendChild(sl); }
    const pr = this.preset(), s = this.sessao();
    $('#at-modo').innerHTML = this.teste && Animacoes.parado ? `${Animacoes.poseFixa ? `Pose do quadro ${Animacoes.poseFixa.quadro + 1}` : 'Pausado'} · arrumando <b>${esc(Animacoes.textoAlvo())}</b>` : Animacoes.tocando ? `Tocando <b>${esc(Animacoes.achar(Animacoes.tocando)?.nome || '')}</b>` : this.teste ? 'Testando os <b>botões</b>' : pr ? `Editando <b>${esc(s.nome)} › ${esc(pr.nome)}</b>` : 'Montando a <b>base</b>';
    $('#at-base').hidden = !pr; $$('#at-mover [data-modo]').forEach(b => b.classList.toggle('on', b.dataset.modo === this.modoMover)); $('#at-mover').hidden = !!this.teste && !Animacoes.parado;
    $('#at-testar').classList.toggle('on', !!this.teste); $('#at-testar').innerHTML = `${ic(this.teste ? 'x' : 'play', 13)} ${this.teste ? 'Sair do teste' : 'Testar'}`; this.pintaTeste(); Pintura.pintaBarra();
    this.pintaPartes(); this.pintaImgs(); $$('#at-abas [data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === this.aba));
    const lado = $('#at-lado'), rol = lado.scrollTop; lado.innerHTML = ''; this.aba === 'peca' ? this.pintaPeca(lado) : this.aba === 'pintar' ? Pintura.pintaAba(lado) : this.aba === 'animacoes' ? Animacoes.pinta(lado) : this.pintaSessoes(lado); lado.scrollTop = rol; this.desenha();
  },
  pintaPartes() {
    const el = $('#at-partes'), ps = this.def.partes; el.innerHTML = '';
    $$('#at-vista-partes [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === (this.vistaPartes || 'arvore')));
    if (this.vistaPartes === 'camadas' && ps.length) return this.pintaCamadas(el);
    if (!ps.length) { el.innerHTML = '<div class="vazio">Comece criando as partes: corpo, cabeça, cabelo, olhos, braços, pernas…<br>(ou solte as imagens aqui: cada imagem vira uma parte)</div>'; }
    const raiz = this.def.raiz, filhos = id => ps.filter(p => (p.pai || null) === id).sort((a, b) => (b.id === raiz) - (a.id === raiz) || (b.z || 0) - (a.z || 0)), est = this.estado(), ordem = this._ordem = [];
    const vai = (pai, nivel) => { for (const p of filhos(pai)) { ordem.push(p.id);
      const ehRaiz = p.id === raiz, marc = p.id !== this.sel && this.multi.has(p.id), mk = this.marcas().partes.has(p.id);
      const r = h(`<div class="no ${p.id === this.sel ? 'sel' : ''} ${marc ? 'multi' : ''} ${ehRaiz ? 'raiz' : ''}" data-pid="${p.id}" style="padding-left:${8 + nivel * 14}px" draggable="true" title="${ehRaiz ? 'RAIZ — a parte principal do personagem · ' : ''}Ctrl+clique ou Shift+clique marcam várias · arraste para &quot;Imagens de…&quot; para virar imagem"><span class="ti">${ic(ehRaiz ? 'star' : p.imgs.length ? 'image' : 'shapes', 13)}</span><span class="nm">${esc(p.nome)} <small style="color:var(--tx3)">${p.imgs.length}</small></span>${mk ? '<i class="ponto-mod" title="Mudou desde a última vez na nuvem"></i>' : ''}${ehRaiz ? '<span class="tag-raiz">raiz</span>' : ''}
        <button class="ibtn ${est[p.id]?.vis === false ? 'off' : ''}" title="Mostrar/esconder (H)">${ic(est[p.id]?.vis === false ? 'eyeOff' : 'eye', 13)}</button></div>`);
      r.onclick = ev => { if (ev.target.closest('.ibtn')) { this.mudar(p.id, { vis: est[p.id]?.vis === false }); return this.commit(); } this.clicaParte(ev, p.id); };
      r.ondblclick = async () => { const n = await UI.prompt({ title: 'Nome da parte', value: p.nome }); if (n) { p.nome = n; this.commit(); } };
      r.oncontextmenu = ev => { ev.preventDefault(); if (p.id !== this.sel && !this.multi.has(p.id)) this.escolhe(p.id); this.focoImg = null; this.pinta(); this.menuParte(ev, p); };
      r.ondragstart = ev => { ev.dataTransfer.setData('text/parte', p.id); this._arrasto = this.multi.has(p.id) ? this.selecionadas().map(x => x.id) : [p.id]; };
      r.ondragover = ev => { const t = ev.dataTransfer.types; if (t.includes('text/parte') || t.includes('Files')) { ev.preventDefault(); ev.stopPropagation(); r.classList.add('drop-dentro'); } };
      r.ondragleave = () => r.classList.remove('drop-dentro');
      r.ondrop = ev => { ev.preventDefault(); ev.stopPropagation(); r.classList.remove('drop-dentro');
        if (ev.dataTransfer.files?.length) { this.sel = p.id; return this.addImagens([...ev.dataTransfer.files], false); } // arquivo em cima da parte: vira imagem dela
        const id = ev.dataTransfer.getData('text/parte'); if (id && id !== p.id) this.porNoPai(id, p.id); };
      el.appendChild(r); vai(p.id, nivel + 1); } };
    vai(null, 0);
    el.ondragover = ev => { if (ev.dataTransfer.types.includes('Files')) ev.preventDefault(); };
    el.ondrop = ev => { if (ev.dataTransfer.files?.length) { ev.preventDefault(); this.addImagens([...ev.dataTransfer.files], true); } };
  },
  // CAMADAS: a ordem real de desenho (de cima = na frente), igual às camadas do Photoshop.
  // Mexer aqui só muda o Z; quem encaixa em quem (a hierarquia) continua igual.
  ordemCamadas() { const est = this.estado(); return this.def.partes.map((p, i) => ({ p, i, z: (p.z || 0) + (est[p.id]?.z || 0) })).sort((a, b) => a.z - b.z || a.i - b.i).map(x => x.p); },
  passoCamada(p, d) { const L = this.ordemCamadas().reverse(), i = L.indexOf(p), j = i - d; if (j < 0 || j >= L.length) return; [L[i], L[j]] = [L[j], L[i]]; this.reordenar(L); },
  reordenar(frenteParaTras) { // reescreve os Z da base: 0 = mais atrás
    const n = frenteParaTras.length, pr = this.preset(), est = pr ? pr.estado : null;
    frenteParaTras.forEach((p, i) => { p.z = (n - 1 - i) - (est?.[p.id]?.z || 0); });
    this.commit();
  },
  pintaCamadas(el) {
    const est = this.estado(), lista = this.ordemCamadas().reverse(), nomeDe = id => this.parte(id)?.nome;
    el.appendChild(h(`<div class="cam-dica">De cima para baixo: quem fica <b>na frente</b>. Arraste para mudar a ordem (o encaixe não muda).${this.preset() ? ' Vale para a base e para todos os presets.' : ''}</div>`));
    lista.forEach((p, i) => {
      const e = est[p.id] || {}, img = p.imgs.find(x => x.id === e.img), bm = img ? Arq.bitmap(img.k, () => this.pintaPartes()) : null;
      const r = h(`<div class="cam ${p.id === this.sel ? 'sel' : ''} ${p.id === this.def.raiz ? 'raiz' : ''}" draggable="true"><span class="grip">${ic('dots', 12)}</span><canvas width="52" height="52"></canvas>
        <span class="nm"><b>${esc(p.nome)}</b><small>${p.id === this.def.raiz ? 'RAIZ (principal)' : p.pai ? 'encaixa em ' + esc(nomeDe(p.pai) || '?') : 'solta (sem pai)'}</small></span><span class="zz" title="Z (maior = mais na frente)">${(p.z || 0) + (e.z || 0)}</span>
        <button class="ibtn" data-up title="Para a frente ( ] )" ${i ? '' : 'disabled'}>${ic('up', 12)}</button><button class="ibtn" data-dn title="Para trás ( [ )" ${i < lista.length - 1 ? '' : 'disabled'}>${ic('down', 12)}</button>
        <button class="ibtn ${e.vis === false ? 'off' : ''}" data-vis title="Mostrar/esconder (H)">${ic(e.vis === false ? 'eyeOff' : 'eye', 12)}</button></div>`);
      if (bm) { const c = $('canvas', r), x = c.getContext('2d'), k = Math.min(52 / bm.width, 52 / bm.height); x.drawImage(bm, (52 - bm.width * k) / 2, (52 - bm.height * k) / 2, bm.width * k, bm.height * k); }
      const move = d => { const L = lista.slice(), j = i + d; [L[i], L[j]] = [L[j], L[i]]; this.reordenar(L); };
      r.onclick = ev => { if (ev.target.closest('button')) return; this.escolhe(p.id); this.pinta(); };
      r.oncontextmenu = ev => { ev.preventDefault(); this.escolhe(p.id); this.pinta(); this.menuParte(ev, p); };
      $('[data-up]', r).onclick = () => move(-1); $('[data-dn]', r).onclick = () => move(1);
      $('[data-vis]', r).onclick = () => { this.mudar(p.id, { vis: e.vis === false }); this.commit(); };
      r.ondragstart = ev => ev.dataTransfer.setData('text/camada', p.id);
      r.ondragover = ev => { if (!ev.dataTransfer.types.includes('text/camada')) return; ev.preventDefault(); const b = r.getBoundingClientRect(), cima = ev.clientY < b.top + b.height / 2; r.classList.toggle('drop-antes', cima); r.classList.toggle('drop-depois', !cima); };
      r.ondragleave = () => r.classList.remove('drop-antes', 'drop-depois');
      r.ondrop = ev => { ev.preventDefault(); const cima = r.classList.contains('drop-antes'); r.classList.remove('drop-antes', 'drop-depois');
        const q = this.parte(ev.dataTransfer.getData('text/camada')); if (!q || q === p) return; const L = lista.filter(x => x !== q); L.splice(L.indexOf(p) + (cima ? 0 : 1), 0, q); this.reordenar(L); };
      el.appendChild(r);
    });
  },
  setModo(m) {
    this.modoMover = m; this.pinta();
    UI.toast({ preset: '<b>Só neste preset:</b> arrastar muda a imagem só no preset que está na tela (ou só na base).', imagem: '<b>Mesma imagem em todos os presets:</b> arrastar move esta imagem em todo lugar que ela aparece (fica verde-água).', todos: '<b>Mover todos:</b> arrastar move a parte inteira — todas as imagens e os presets dela (ficam roxos).' }[m], { time: 4500 });
  },
  setMoverTodos(v) { this.setModo(v ? 'todos' : 'preset'); },
  // posição desta imagem SÓ no preset que está na tela (ou só na base)
  poeD(p, img, v, onde = this.preset()) {
    if (arguments.length < 4 && this.editPasso) { const ps = Animacoes.passoEditado(); if (ps) { const e = ps.p[p.id] = ps.p[p.id] || {}, d = { ...(e.d || {}) }; if (!v || (!v.x && !v.y)) delete d[img.id]; else d[img.id] = { x: v.x, y: v.y }; e.d = d; if (!Object.keys(d).length) delete e.d; return; } }
    const st = onde ? (onde.estado[p.id] || {}) : p.base, d = { ...(st.d || {}) };
    if (!v || (!v.x && !v.y)) delete d[img.id]; else d[img.id] = { x: v.x, y: v.y };
    if (onde) { const s = this.sessao(); if (s?.partes?.length && !s.partes.includes(p.id)) s.partes.push(p.id); onde.estado[p.id] = { ...(onde.estado[p.id] || {}), d }; if (!Object.keys(d).length) delete onde.estado[p.id].d; }
    else { p.base.d = d; if (!Object.keys(d).length) delete p.base.d; }
  },
  // onde a imagem aparece: a base e cada preset que mostra esta imagem nesta parte
  ondeAparece(p, img) {
    const L = []; if (p.base.img === img.id) L.push({ nome: 'base', pr: null });
    for (const s of this.def.sessoes) for (const pr of s.presets) { const e = pr.estado?.[p.id]; if (!e) continue; if ((e.img || p.base.img) === img.id) L.push({ nome: `${s.nome} › ${pr.nome}`, pr }); }
    return L;
  },
  aplicarPosicaoEmTodos(p, img) {
    const v = this.estado()[p.id]?.d?.[img.id] || { x: 0, y: 0 }, L = this.ondeAparece(p, img).filter(o => o.pr !== this.preset());
    for (const o of L) this.poeD(p, img, v, o.pr); this.commit();
    UI.toast(L.length ? `Posição de "${esc(img.nome)}" aplicada em ${L.length} lugar(es): ${esc(L.map(o => o.nome).slice(0, 4).join(', '))}${L.length > 4 ? '…' : ''}.` : 'Esta imagem não aparece em outros presets.', { kind: L.length ? 'ok' : 'warn', time: 6000 });
  },
  // botão direito numa peça do palco
  menuPalco(e) {
    const it = this.acha(this.mundo(e)); if (!it) return; if (it.parte.id !== this.sel) { this.escolhe(it.parte.id); this.pinta(); }
    const p = it.parte, n = p.imgs.length;
    UI.ctx(e.clientX, e.clientY, [
      { head: `${p.nome}${it.img ? ' › ' + it.img.nome : ''}` },
      { label: `Mover só ${this.edit ? 'neste preset' : 'na base'}`, checked: this.modoMover === 'preset', action: () => this.setModo('preset') },
      { label: 'Mover a mesma imagem em todos os presets', checked: this.modoMover === 'imagem', action: () => this.setModo('imagem') },
      { label: `Mover todos (a parte inteira${n > 1 ? `: ${n} imagens` : ''} e os presets)`, icon: 'layers', checked: this.moverTodos, action: () => this.setModo('todos') },
      it.img && '-', it.img && { label: 'Aplicar esta posição aos presets com a mesma imagem', icon: 'copy', action: () => this.aplicarPosicaoEmTodos(p, it.img) },
      it.img && this.estado()[p.id]?.d?.[it.img.id] && { label: `Voltar ao lugar (${this.edit ? 'neste preset' : 'na base'})`, icon: 'undo', action: () => { this.poeD(p, it.img, null); this.commit(); } },
      it.img && (it.img.ajuste?.x || it.img.ajuste?.y) && { label: 'Tirar o ajuste da imagem em todos os presets', icon: 'undo', action: () => { it.img.ajuste = { x: 0, y: 0 }; this.commit(); } },
      '-', { label: 'Opções da parte…', icon: 'dots', action: () => this.menuParte(e, p) },
    ].filter(Boolean));
  },
  /* ---------- o que mudou desde a última vez na nuvem (fica colorido até "Salvar na nuvem") ---------- */
  marcas() {
    if (this._mk?.de === this.ultimo && this._mk?.base === this.base0) return this._mk;
    const out = { partes: new Set(), imgs: new Set(), presets: new Set(), de: this.ultimo, base: this.base0 }; this._mk = out;
    const B = this.base0 ? JSON.parse(this.base0) : null; if (!B || !this.def) return out;
    const bp = Object.fromEntries(B.partes.map(p => [p.id, p])), bi = {}, bpr = {};
    for (const p of B.partes) for (const i of p.imgs) bi[i.id] = JSON.stringify([i.k, i.pivo, i.ajuste, i.w, i.h, i.z || 0]);
    for (const s of B.sessoes) for (const pr of s.presets) bpr[pr.id] = JSON.stringify(pr.estado || {});
    const toda = new Set(); // partes que mexeram por inteiro (encaixe, pai, base…): todas as imagens e presets dela contam
    for (const p of this.def.partes) { const b = bp[p.id];
      const semD = x => { const { d, ...r } = x || {}; return r; };
      if (!b || JSON.stringify([p.pai, p.encaixe, semD(p.base), p.z || 0]) !== JSON.stringify([b.pai, b.encaixe, semD(b.base), b.z || 0])) { out.partes.add(p.id); toda.add(p.id); }
      else for (const iid of new Set([...Object.keys(p.base.d || {}), ...Object.keys(b.base.d || {})])) if (JSON.stringify(p.base.d?.[iid]) !== JSON.stringify(b.base.d?.[iid])) { out.imgs.add(iid); out.partes.add(p.id); } // só a posição na base
      for (const i of p.imgs) if (toda.has(p.id) || bi[i.id] !== JSON.stringify([i.k, i.pivo, i.ajuste, i.w, i.h, i.z || 0])) { out.imgs.add(i.id); out.partes.add(p.id); } }
    for (const s of this.def.sessoes) for (const pr of s.presets) { const usa = Object.entries(pr.estado || {});
      if (bpr[pr.id] !== JSON.stringify(pr.estado || {}) || usa.some(([pid, e]) => toda.has(pid) || (e.img && out.imgs.has(e.img) && this.imgMudouFora(pid, e.img, B)))) out.presets.add(pr.id); }
    return out;
  },
  // a imagem mudou por ela mesma (ajuste, pixels, pivô) — não só a posição dela na base
  imgMudouFora(pid, iid, B) { const p = this.parte(pid), i = p?.imgs.find(x => x.id === iid), b = B.partes.find(x => x.id === pid)?.imgs.find(x => x.id === iid); return !b || JSON.stringify([i?.k, i?.pivo, i?.ajuste, i?.w, i?.h, i?.z || 0]) !== JSON.stringify([b.k, b.pivo, b.ajuste, b.w, b.h, b.z || 0]); },
  // presets que mexem na parte (para pintar de roxo no "mover todos")
  presetsDaParte(pid) { const L = new Set(); for (const s of this.def.sessoes) for (const pr of s.presets) if (pr.estado?.[pid] || (s.partes || []).includes(pid)) L.add(pr.id); return L; },
  menuParte(e, p) {
    const sel = this.selecionadas(), varias = sel.length > 1 && sel.includes(p), lista = varias ? sel : [p], ids = lista.map(x => x.id);
    const destinos = this.def.partes.filter(x => !ids.includes(x.id));
    const ehRaiz = p.id === this.def.raiz;
    UI.ctx(e.clientX, e.clientY, [
      varias && { head: `${lista.length} PARTES MARCADAS` },
      !varias && { label: ehRaiz ? 'Deixar de ser a raiz' : 'Marcar como raiz (principal)', icon: 'star', action: () => this.marcarRaiz(p) },
      !varias && { label: this.moverTodos ? 'Mover só neste preset (voltar)' : 'Mover todos (a parte inteira e os presets)', icon: 'layers', checked: this.moverTodos, action: () => { this.escolhe(p.id); this.setModo(this.moverTodos ? 'preset' : 'todos'); } },
      { label: varias ? `Mover as ${lista.length} para imagens de` : 'Mover para imagens de', icon: 'image', disabled: !destinos.length, sub: destinos.map(d => ({ label: d.nome, icon: d.id === this.def.raiz ? 'star' : null, action: () => this.virarImagens(lista, d) })) },
      '-',
      !varias && { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome da parte', value: p.nome }); if (n) { p.nome = n; this.commit(); } } },
      !varias && { label: 'Parte nova encaixada nesta', icon: 'plus', action: () => this.novaParte(p.id) },
      !varias && { label: 'Duplicar (ex.: braço esquerdo → direito)', icon: 'dup', action: () => this.duplicarParte(p) },
      !varias && p.pai && { label: 'Soltar do pai', icon: 'layers', action: () => this.porNoPai(p.id, null) },
      !varias && '-', !varias && { label: 'Para a frente', icon: 'up', key: ']', action: () => this.passoCamada(p, 1) }, !varias && { label: 'Para trás', icon: 'down', key: '[', action: () => this.passoCamada(p, -1) }, !varias && { label: 'Ver as camadas', icon: 'layers', action: () => { this.vistaPartes = 'camadas'; this.pintaPartes(); } },
      '-', { label: varias ? `Apagar as ${lista.length} partes` : 'Apagar a parte', icon: 'trash', key: 'Delete', danger: true, action: () => this.apagarPartes(lista) },
    ].filter(Boolean));
  },
  // pôr a parte dentro de outra mantendo o lugar na tela
  porNoPai(id, paiId, o = {}) {
    const p = this.parte(id); if (!p) return; let a = paiId; while (a) { if (a === id) return UI.toast('Uma parte não pode encaixar nela mesma'); a = this.parte(a)?.pai; }
    if (paiId && this.def.raiz === id) { delete this.def.raiz; if (!o.semCommit) UI.toast(`"${esc(p.nome)}" encaixou em outra parte e deixou de ser a raiz.`); }
    const est = this.estado(), mundo = this.matParte(id, est).transformPoint(new DOMPoint(0, 0)); p.pai = paiId;
    const est2 = this.estado(), inv = this.matPai(id, est2).inverse(), l = inv.transformPoint(mundo), e = est2[id] || {};
    const sem = new DOMMatrix().translate(e.x || 0, e.y || 0); p.encaixe = { x: round(l.x - sem.e, 1), y: round(l.y - sem.f, 1) }; if (!o.semCommit) this.commit();
  },
  // muda o ponto de giro/encaixe da parte para (x,y) da imagem que aparece, sem tirar nada do lugar (todas as imagens e as partes filhas acompanham)
  pivoEm(p, x, y, est = this.estado()) {
    const it = Modelo.montar(this.def, est).find(i => i.parte.id === p.id), img = it?.img; if (!img) return;
    const pv = img.pivo || { x: img.w / 2, y: img.h / 2 }, dx = x - pv.x, dy = y - pv.y; if (Math.abs(dx) + Math.abs(dy) < .5) return;
    const a = this.matPai(p.id, est).inverse().multiply(it.m), dp = new DOMMatrix([a.a, a.b, a.c, a.d, 0, 0]).transformPoint(new DOMPoint(dx, dy, 0, 0));
    for (const i of p.imgs) { const q = i.pivo || { x: i.w / 2, y: i.h / 2 }; i.pivo = { x: round(q.x + dx, 2), y: round(q.y + dy, 2) }; }
    p.encaixe = { x: round(p.encaixe.x + dp.x, 1), y: round(p.encaixe.y + dp.y, 1) };
    for (const f of this.def.partes.filter(f => f.pai === p.id)) f.encaixe = { x: round(f.encaixe.x - dx, 1), y: round(f.encaixe.y - dy, 1) };
  },
  // clique na lista de partes: normal escolhe; Ctrl marca/desmarca mais uma; Shift marca o trecho até a escolhida
  clicaParte(ev, id) {
    this.focoImg = null;
    if ((ev.ctrlKey || ev.metaKey) && this.sel && id !== this.sel) { this.multi.has(id) ? this.multi.delete(id) : this.multi.add(id); return this.pinta(); }
    if (ev.shiftKey && this.sel && id !== this.sel) { const o = this._ordem || [], a = o.indexOf(this.sel), b = o.indexOf(id); if (a >= 0 && b >= 0) { for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (o[i] !== this.sel) this.multi.add(o[i]); return this.pinta(); } }
    this.escolhe(id); this.pinta();
  },
  // RAIZ: a parte principal (normalmente o corpo). Fica no topo da hierarquia, sem pai, destacada em amarelo.
  marcarRaiz(p) {
    if (this.def.raiz === p.id) { delete this.def.raiz; this.commit(); return UI.toast(`"${esc(p.nome)}" não é mais a raiz.`); }
    if (p.pai) this.porNoPai(p.id, null, { semCommit: true });
    this.def.raiz = p.id; this.commit(); UI.toast(`<b>${esc(p.nome)}</b> agora é a raiz (a parte principal).`, { kind: 'ok' });
  },
  // Delete / Backspace: o mesmo que clicar em apagar (a imagem clicada em "Imagens de…", ou as partes marcadas)
  apagarSelecao() {
    const f = this.focoImg, p = f && this.parte(f.p), img = p?.imgs.find(i => i.id === f.img);
    if (img) return this.tirarImg(p, img);
    const lista = this.selecionadas(); if (!lista.length) return UI.toast('Escolha uma parte (ou clique numa imagem) para apagar');
    this.apagarPartes(lista);
  },
  async apagarPartes(lista) {
    if (lista.length === 1) return this.apagarParte(lista[0]);
    if (!(await UI.confirm({ title: `Apagar ${lista.length} partes?`, msg: lista.map(p => esc(p.nome)).join(', ') + '. As partes encaixadas nelas passam para o pai delas.', ok: 'Apagar', danger: true }))) return;
    this.tirarPartes(lista); this.sel = this.def.raiz || this.def.partes[0]?.id || null; this.multi.clear(); this.focoImg = null; this.commit();
  },
  // tira as partes do personagem (sem confirmar nem salvar): filhos vão para o avô que fica; sessões e presets esquecem delas
  tirarPartes(lista) {
    const ids = new Set(lista.map(p => p.id)), fica = id => { while (id && ids.has(id)) id = this.parte(id)?.pai || null; return id || null; };
    for (const f of this.def.partes.filter(x => !ids.has(x.id) && ids.has(x.pai))) this.porNoPai(f.id, fica(f.pai), { semCommit: true });
    this.def.partes = this.def.partes.filter(x => !ids.has(x.id)); if (ids.has(this.def.raiz)) delete this.def.raiz;
    for (const s of this.def.sessoes) { s.partes = (s.partes || []).filter(x => !ids.has(x)); for (const pr of s.presets) for (const id of ids) delete pr.estado[id]; }
  },
  // partes que entraram sem querer viram IMAGENS (trocáveis) de outra parte. Ex.: 3 partes "olho aberto/fechado/bravo" → imagens de "Olhos".
  // Parte com 1 imagem: a imagem leva o nome da parte. Com várias: vão juntas numa pasta com o nome da parte.
  virarImagens(lista, alvo, pasta = null, o = {}) {
    lista = lista.filter(p => p && p.id !== alvo.id); if (!lista.length) return;
    const vazias = lista.filter(p => !p.imgs.length), comImg = lista.filter(p => p.imgs.length); let n = 0;
    for (const p of comImg) {
      const varias = p.imgs.length > 1;
      const est = this.estado(), mS = this.matParte(p.id, est), mA = this.matParte(alvo.id, est).inverse();
      for (const img of p.imgs) { const c = { ...img, id: uid('i') }; if (!varias) c.nome = p.nome;
        // a imagem continua no MESMO lugar na tela: o pivô dela é refeito no espaço da parte de destino
        const pv = img.pivo || { x: img.w / 2, y: img.h / 2 }, aj = img.ajuste || { x: 0, y: 0 }, tl = mA.transformPoint(mS.transformPoint(new DOMPoint(aj.x - pv.x, aj.y - pv.y)));
        if (isFinite(tl.x) && isFinite(tl.y)) c.pivo = { x: round(aj.x - tl.x, 2), y: round(aj.y - tl.y, 2) }; const pa = pasta || (varias ? p.nome : null); if (pa) c.pasta = pa; else delete c.pasta; alvo.imgs.push(c); n++; }
      if (varias && !pasta) { alvo.pastas = alvo.pastas || []; if (!alvo.pastas.includes(p.nome)) alvo.pastas.push(p.nome); }
    }
    if (pasta) { alvo.pastas = alvo.pastas || []; if (!alvo.pastas.includes(pasta)) alvo.pastas.push(pasta); }
    if (!alvo.base.img && alvo.imgs.length) alvo.base.img = alvo.imgs[0].id;
    this.tirarPartes(comImg); if (o.semCommit) return; this.escolhe(alvo.id); this.commit();
    UI.toast(n ? `${comImg.length > 1 ? comImg.length + ' partes viraram' : '"' + esc(comImg[0].nome) + '" virou'} ${n} imagem(ns) de <b>${esc(alvo.nome)}</b>. Clique numa imagem para trocar; dois cliques renomeiam (o editor troca pelo nome).${vazias.length ? ' Partes sem imagem ficaram como estavam.' : ''}` : 'Essas partes não têm imagens para mover.', { kind: n ? 'ok' : 'warn', time: 7000 });
  },
  novaParte(pai = null) { const p = Modelo.novaParte('Parte ' + (this.def.partes.length + 1), pai ?? (this.parte()?.id || null)); p.z = this.def.partes.length; this.def.partes.push(p); this.sel = p.id; this.commit(); setTimeout(() => this.addImagens(null, false), 50); },
  duplicarParte(p) {
    const mapa = {}, copia = (q, novoPai) => { const c = clone(q); c.id = uid('pt'); mapa[q.id] = c.id; c.pai = novoPai; c.nome = q.nome.replace(/esquerd[oa]/i, m => /a$/.test(m) ? 'direita' : 'direito').replace(/direit[oa]/i, m => /a$/.test(m) ? 'esquerda' : 'esquerdo'); if (c.nome === q.nome) c.nome += ' (cópia)';
      c.imgs = c.imgs.map(i => ({ ...i })); c.base.sx = -(c.base.sx || 1); c.encaixe = { x: q === p ? -q.encaixe.x : q.encaixe.x, y: q.encaixe.y }; this.def.partes.push(c);
      for (const f of this.def.partes.filter(x => x.pai === q.id && !Object.values(mapa).includes(x.id))) copia(f, c.id); return c; };
    const c = copia(p, p.pai); this.sel = c.id; this.commit(); UI.toast('Parte duplicada e espelhada. Arraste para o lugar.', { kind: 'ok' });
  },
  async apagarParte(p) {
    const filhos = this.def.partes.filter(x => x.pai === p.id);
    if (!(await UI.confirm({ title: `Apagar "${esc(p.nome)}"?`, msg: filhos.length ? `As ${filhos.length} parte(s) encaixadas nela passam para o pai dela.` : 'As imagens dela saem do personagem.', ok: 'Apagar', danger: true }))) return;
    this.tirarPartes([p]); this.sel = this.def.raiz || this.def.partes[0]?.id || null; this.multi.clear(); this.focoImg = null; this.commit();
  },
  // imagens: viram variações da parte escolhida (ou, soltas na lista de partes, uma parte nova cada)
  async addImagens(fs, cadaUmaParte, pasta = null) {
    fs = fs || await pickFiles('image/png,image/webp,image/gif,image/jpeg', true); fs = (fs || []).filter(f => /^image\//.test(f.type) || /\.(png|webp|gif|jpe?g)$/i.test(f.name)); if (!fs.length) return;
    let p = this.parte();
    for (const f of fs) {
      const bm = await createImageBitmap(f).catch(() => null); if (!bm) { UI.toast(`"${esc(f.name)}" não é uma imagem que dá para usar`, { kind: 'err' }); continue; }
      let blob = f; if (bm.width > 2048 || bm.height > 2048 || f.size > 3 * 1048576) { const k = Math.min(1, 2048 / Math.max(bm.width, bm.height)), c = new OffscreenCanvas(Math.round(bm.width * k), Math.round(bm.height * k)); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); blob = await c.convertToBlob({ type: 'image/png' }); }
      const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : blob.type === 'image/gif' ? 'gif' : 'png', iid = uid('im').toLowerCase().replace(/[^a-z0-9]/g, '');
      const k = `personagens/${this.def.id}/img/${iid}.${ext}`; await Arq.guardar(blob, k); Arq.img.set(k, await createImageBitmap(blob));
      const nome = f.name.replace(/\.[^.]+$/, '').slice(0, 40);
      if (cadaUmaParte || !p) { p = Modelo.novaParte(nome, null); p.z = this.def.partes.length; this.def.partes.push(p); }
      const img = { id: uid('i'), nome, k, w: bm.width > 2048 || bm.height > 2048 ? Math.round(bm.width * Math.min(1, 2048 / Math.max(bm.width, bm.height))) : bm.width, h: bm.width > 2048 || bm.height > 2048 ? Math.round(bm.height * Math.min(1, 2048 / Math.max(bm.width, bm.height))) : bm.height };
      img.pivo = { x: img.w / 2, y: img.h / 2 }; img.ajuste = { x: 0, y: 0 }; if (pasta && !cadaUmaParte) img.pasta = pasta; p.imgs.push(img);
      if (!p.base.img) p.base.img = img.id; else if (!cadaUmaParte) this.mudar(p.id, { img: img.id });
      if (cadaUmaParte) p = null;
    }
    if (!this.sel) this.sel = this.def.partes[0]?.id; this.commit(); this.enquadrar();
  },
  // imagens da parte escolhida, em pastas (ex.: "olhos", "bocas"). Arrastar arquivos aqui põe nesta parte; numa pasta, dentro dela.
  pintaImgs() {
    const el = $('#at-imgs'), p = this.parte(); $('#at-imgs-t').textContent = p ? `Imagens de "${p.nome}"` : 'Imagens'; $('#at-imgs-t').title = p ? 'Arraste partes da lista de cima para cá: elas viram imagens trocáveis desta parte' : ''; el.innerHTML = '';
    if (!p) { el.innerHTML = '<div class="vazio" style="grid-column:1/-1">Escolha uma parte.</div>'; return; }
    p.pastas = [...new Set([...(p.pastas || []), ...p.imgs.map(i => i.pasta).filter(Boolean)])];
    const atual = this.estado()[p.id]?.img, fechadas = this.pastasFechadas || (this.pastasFechadas = new Set());
    const solta = (alvo, pasta) => { // soltar arquivos do computador ou uma imagem arrastada daqui
      alvo.ondragover = ev => { const t = ev.dataTransfer.types; if (t.includes('Files') || t.includes('text/img') || t.includes('text/parte')) { ev.preventDefault(); ev.stopPropagation(); alvo.classList.add('drop-dentro'); } };
      alvo.ondragleave = ev => { if (!alvo.contains(ev.relatedTarget)) alvo.classList.remove('drop-dentro'); };
      alvo.ondrop = ev => { ev.preventDefault(); ev.stopPropagation(); alvo.classList.remove('drop-dentro');
        if (ev.dataTransfer.files?.length) return this.addImagens([...ev.dataTransfer.files], false, pasta);
        const pid = ev.dataTransfer.getData('text/parte'); if (pid) { const ids = this._arrasto?.includes(pid) ? this._arrasto : [pid]; this._arrasto = null; return this.virarImagens(ids.map(i => this.parte(i)), p, pasta); } // parte arrastada da lista: vira imagem desta parte
        const img = p.imgs.find(i => i.id === ev.dataTransfer.getData('text/img')); if (img && (img.pasta || null) !== pasta) { if (pasta) img.pasta = pasta; else delete img.pasta; this.commit(); } };
    };
    const card = img => {
      const bm = Arq.bitmap(img.k, () => this.pintaImgs()), c = h(`<div class="im ${img.id === atual ? 'on' : ''} ${this.focoImg?.img === img.id ? 'foco' : ''} ${this.marcas().imgs.has(img.id) ? 'mod' : ''} ${this.moverTodos ? 'todos' : this.modoMover === 'imagem' && img.id === atual ? 'mesma' : ''}" draggable="true" title="${esc(img.nome)} — clique para usar${this.edit ? ' neste preset' : ' na base'} · arraste para uma pasta"><span>${esc(img.nome)}</span><button class="ibtn x" title="Tirar a imagem">${ic('x', 12)}</button></div>`);
      if (bm) { const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96; const k = Math.min(96 / bm.width, 96 / bm.height); cv.getContext('2d').drawImage(bm, (96 - bm.width * k) / 2, (96 - bm.height * k) / 2, bm.width * k, bm.height * k); c.style.backgroundImage = `url(${cv.toDataURL()})`; }
      c.onclick = ev => { if (ev.target.closest('.x')) return; this.focoImg = { p: p.id, img: img.id }; this.mudar(p.id, { img: img.id }); this.commit(); this.pintaImgs(); };
      c.ondblclick = () => this.renomearImg(img);
      c.ondragstart = ev => { ev.dataTransfer.setData('text/img', img.id); ev.dataTransfer.effectAllowed = 'move'; };
      c.oncontextmenu = ev => { ev.preventDefault(); UI.ctx(ev.clientX, ev.clientY, [
        { label: 'Usar esta imagem', icon: 'check', action: () => { this.mudar(p.id, { img: img.id }); this.commit(); } },
        { label: 'Renomear', icon: 'edit', action: () => this.renomearImg(img) },
        { label: 'Mover para a pasta', icon: 'folder', sub: [{ label: '(sem pasta)', checked: !img.pasta, action: () => { delete img.pasta; this.commit(); } }, ...p.pastas.map(n => ({ label: n, checked: img.pasta === n, action: () => { img.pasta = n; this.commit(); } })), '-', { label: 'Pasta nova…', icon: 'plus', action: async () => { const n = await this.novaPastaImg(p); if (n) { img.pasta = n; this.commit(); } } }] },
        '-', { label: 'Tirar a imagem', icon: 'trash', key: 'Delete', danger: true, action: () => this.tirarImg(p, img) },
      ]); };
      $('.x', c).onclick = () => this.tirarImg(p, img);
      return c;
    };
    for (const nome of p.pastas) {
      const dentro = p.imgs.filter(i => i.pasta === nome), aberta = !fechadas.has(p.id + '/' + nome);
      const corP = p.pastaCores?.[nome];
      const cab = h(`<div class="pasta-img ${aberta ? 'aberta' : ''} ${corP ? 'com-cor' : ''}" data-pasta="${esc(nome)}" style="${corP ? `--pc:${corP}` : ''}" title="Clique para abrir/fechar · solte imagens aqui · botão direito: opções">${ic(aberta ? 'down' : 'right', 12)}${ic('folder', 14)}<b>${esc(nome)}</b><small>${dentro.length}</small><span class="sp"></span><button class="ibtn" data-add title="Pôr imagens nesta pasta">${ic('plus', 13)}</button></div>`);
      cab.onclick = ev => { if (ev.target.closest('[data-add]')) return; const k = p.id + '/' + nome; fechadas.has(k) ? fechadas.delete(k) : fechadas.add(k); this.pintaImgs(); };
      $('[data-add]', cab).onclick = () => this.addImagens(null, false, nome);
      cab.oncontextmenu = ev => { ev.preventDefault(); UI.ctx(ev.clientX, ev.clientY, [
        { label: 'Pôr imagens nesta pasta…', icon: 'plus', action: () => this.addImagens(null, false, nome) },
        menuCor(corP, c => { p.pastaCores = p.pastaCores || {}; if (c) p.pastaCores[nome] = c; else delete p.pastaCores[nome]; this.commit(); }),
        { label: 'Renomear a pasta', icon: 'edit', action: async () => { const n = (await UI.prompt({ title: 'Nome da pasta', value: nome }))?.trim(); if (!n || n === nome) return; if (p.pastas.includes(n)) return UI.toast('Já existe uma pasta com esse nome'); p.pastas = p.pastas.map(x => x === nome ? n : x); dentro.forEach(i => i.pasta = n); this.commit(); } },
        '-', { label: 'Desfazer a pasta (as imagens ficam)', icon: 'trash', action: () => { p.pastas = p.pastas.filter(x => x !== nome); dentro.forEach(i => delete i.pasta); this.commit(); } },
      ]); };
      solta(cab, nome); el.appendChild(cab);
      if (aberta) { for (const img of dentro) el.appendChild(card(img)); if (!dentro.length) el.appendChild(h('<div class="vazio pasta-vazia">Pasta vazia: arraste imagens para cá.</div>')); }
    }
    const soltas = p.imgs.filter(i => !i.pasta);
    if (p.pastas.length && soltas.length) el.appendChild(h(`<div class="pasta-img solta">${ic('image', 14)}<b>Sem pasta</b><small>${soltas.length}</small></div>`));
    for (const img of soltas) el.appendChild(card(img));
    const add = h(`<div class="im add" title="Pôr imagens nesta parte (ou arraste os arquivos para cá)">${ic('plus', 18)}</div>`); add.onclick = () => this.addImagens(); el.appendChild(add);
    solta(el, null);
  },
  async novaPastaImg(p) {
    const n = (await UI.prompt({ title: 'Pasta nova', label: 'Ex.: olhos, bocas, mãos, roupas', value: '' }))?.trim().slice(0, 30); if (!n) return null;
    p.pastas = p.pastas || []; if (!p.pastas.includes(n)) p.pastas.push(n); this.commit(); return n;
  },
  async renomearImg(img) { const n = await UI.prompt({ title: 'Nome da imagem', label: 'Ex.: aberto, fechado, chutando', value: img.nome }); if (n) { img.nome = n; this.commit(); } },
  async tirarImg(p, img) {
    if (!(await UI.confirm({ title: `Tirar a imagem "${esc(img.nome)}"?`, ok: 'Tirar', danger: true }))) return;
    if (this.focoImg?.img === img.id) this.focoImg = null; p.imgs = p.imgs.filter(i => i !== img); if (p.base.img === img.id) p.base.img = p.imgs[0]?.id || null;
    for (const s of this.def.sessoes) for (const pr of s.presets) if (pr.estado[p.id]?.img === img.id) delete pr.estado[p.id].img; this.commit();
  },
  pintaPeca(el) {
    const p = this.parte(); if (!p) { el.appendChild(h('<div class="vazio">Escolha uma parte na lista ou clique numa peça.</div>')); return; }
    const est = this.estado()[p.id] || {}, img = p.imgs.find(i => i.id === est.img);
    const box = h(`<div class="props"><div class="titulo-p">${esc(p.nome)} · ${this.edit ? esc(this.preset().nome) : 'base'}</div>
      <button class="btn sm raiz-bt ${p.id === this.def.raiz ? 'on' : ''}" data-raiz title="A raiz é a parte principal do personagem (normalmente o corpo): fica no topo e destacada na hierarquia">${ic('star', 13)} ${p.id === this.def.raiz ? 'É a raiz (principal)' : 'Marcar como raiz'}</button>
      <label class="field">Encaixa em<select data-pai><option value="">(nada — solta no topo)</option>${this.def.partes.filter(x => x.id !== p.id).map(x => `<option value="${x.id}" ${x.id === p.pai ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label></div>`);
    $('[data-pai]', box).onchange = ev => this.porNoPai(p.id, ev.target.value || null); $('[data-raiz]', box).onclick = () => this.marcarRaiz(p);
    const mexe = (c, v) => { this.mudar(p.id, { [c]: v }); this.desenha(); }, sol = () => this.commit();
    if (this.edit) { box.appendChild(Lado.campo('Mover X', est.x || 0, -500, 500, 1, v => mexe('x', v), sol)); box.appendChild(Lado.campo('Mover Y', est.y || 0, -500, 500, 1, v => mexe('y', v), sol)); }
    else { box.appendChild(Lado.campo('Encaixe X', p.encaixe.x, -1500, 1500, 1, v => { p.encaixe.x = v; this.desenha(); }, sol)); box.appendChild(Lado.campo('Encaixe Y', p.encaixe.y, -1500, 1500, 1, v => { p.encaixe.y = v; this.desenha(); }, sol)); }
    box.appendChild(Lado.campo('Girar', est.r || 0, -180, 180, .5, v => mexe('r', v), sol)); box.appendChild(Lado.campo('Tamanho', est.s ?? 1, .05, 4, .01, v => mexe('s', v), sol));
    const o = h(`<div class="campo2"><label class="chk"><input type="checkbox" data-sx ${est.sx < 0 ? 'checked' : ''}> Espelhar (F)</label><label class="chk"><input type="checkbox" data-v ${est.vis !== false ? 'checked' : ''}> Aparece (H)</label>
      <span class="sp"></span><span style="color:var(--tx2)">Camada</span><input type="number" value="${p.z || 0}" data-z style="width:54px" title="Maior = mais na frente ( [ e ] )"></div>`);
    $('[data-sx]', o).onchange = ev => { this.mudar(p.id, { sx: ev.target.checked ? -1 : 1 }); this.commit(); }; $('[data-v]', o).onchange = ev => { this.mudar(p.id, { vis: ev.target.checked }); this.commit(); };
    $('[data-z]', o).onchange = ev => { p.z = +ev.target.value; this.commit(); }; box.appendChild(o);
    if (this.edit && this.preset().estado[p.id]) { const lb = h(`<button class="btn sm">${ic('undo', 13)} Esta parte igual à base neste preset</button>`); lb.onclick = () => { delete this.preset().estado[p.id]; this.commit(); }; box.appendChild(lb); }
    if (img) {
      box.appendChild(h(`<div class="titulo-p">Imagem "${esc(img.nome)}"</div>`));
      box.appendChild(Lado.campo('Pivô X', img.pivo.x, 0, img.w, 1, v => { img.pivo.x = v; this.desenha(); }, sol)); box.appendChild(Lado.campo('Pivô Y', img.pivo.y, 0, img.h, 1, v => { img.pivo.y = v; this.desenha(); }, sol));
      box.appendChild(Lado.campo('Só ela X', img.ajuste.x, -300, 300, 1, v => { img.ajuste.x = v; this.desenha(); }, sol)); box.appendChild(Lado.campo('Só ela Y', img.ajuste.y, -300, 300, 1, v => { img.ajuste.y = v; this.desenha(); }, sol));
      box.appendChild(h('<div style="color:var(--tx3);font-size:11.5px">Pivô = ponto de giro (Alt + arrastar na peça). Arrastar a peça move <b>só esta imagem</b> ("Só ela"); para mover a parte inteira (todas as imagens e presets), botão direito na peça › <b>Mover todos</b>. Laranja = mudou desde a última vez na nuvem.</div>'));
    }
    el.appendChild(box);
  },
  pintaSessoes(el) {
    const def = this.def, box = h(`<div class="sessoes-at"><div class="campo2"><button class="btn sm" data-nova>${ic('plus', 13)} Sessão</button><button class="btn sm" data-prontas>${ic('layers', 13)} Sessões prontas</button></div></div>`);
    $('[data-nova]', box).onclick = () => this.novaSessao(); $('[data-prontas]', box).onclick = () => this.sessoesProntas();
    if (!def.sessoes.length) box.appendChild(h('<div class="vazio">Sessões são grupos de presets: <b>Olhos</b> (assustado, surpreso, triste, fechado…), <b>Boca</b>, <b>Perna direita</b> (chutando, inclinada…), <b>Pose</b> (corpo todo).<br><br>Na animação, cada sessão vira uma fila de botões: clicou, virou chave naquele quadro.</div>'));
    for (const s of def.sessoes) {
      const aberta = this.edit?.s === s.id, nomesPartes = (s.partes || []).map(id => this.parte(id)?.nome).filter(Boolean);
      const c = h(`<div class="sess ${aberta ? 'aberta' : ''}"><div class="cab"><b>${esc(s.nome)}</b><small title="Partes que esta sessão mexe">${nomesPartes.length ? esc(nomesPartes.slice(0, 3).join(', ')) + (nomesPartes.length > 3 ? '…' : '') : 'todas as partes'}</small>
        <button class="ibtn ia" data-ia title="Criar um preset com a IA">${ic('sparkles', 13)}</button><button class="ibtn" data-m title="Mais">${ic('dots', 13)}</button></div><div class="lista presets"></div></div>`);
      const l = $('.lista', c);
      const mk = this.marcas(), pS = this.parte(), imS = pS && pS.imgs.find(i => i.id === this.estado()[pS.id]?.img), daParte = this.moverTodos && this.sel ? this.presetsDaParte(this.sel) : this.modoMover === 'imagem' && imS ? new Set(this.ondeAparece(pS, imS).map(o => o.pr?.id).filter(Boolean)) : null;
      for (const pr of s.presets) { const b = h(`<button class="${aberta && this.edit.p === pr.id ? 'on' : ''} ${mk.presets.has(pr.id) ? 'mod' : ''} ${daParte?.has(pr.id) ? (this.moverTodos ? 'todos' : 'mesma') : ''}" title="Clique para editar · botão direito: opções${mk.presets.has(pr.id) ? ' · mudou desde a última vez na nuvem' : ''}">${esc(pr.nome)}</button>`);
        b.onclick = () => { this.edit = { s: s.id, p: pr.id }; this.pinta(); }; b.oncontextmenu = ev => { ev.preventDefault(); this.menuPreset(ev, s, pr); }; l.appendChild(b); }
      const add = h(`<button title="Preset novo com o que está na tela">+ preset</button>`); add.onclick = () => this.novoPreset(s); l.appendChild(add);
      $('[data-ia]', c).onclick = () => this.presetIA(s); $('[data-m]', c).onclick = ev => this.menuSessao(ev, s);
      box.appendChild(c);
    }
    el.appendChild(box);
  },
  async novaSessao(nome) {
    const def = this.def, body = h(`<div><label class="field">Nome da sessão<input type="text" value="${esc(nome || '')}" placeholder="Ex.: Olhos, Boca, Perna direita, Pose"></label>
      <div class="field">Partes que ela mexe <small>(nenhuma marcada = todas, para poses do corpo todo)</small><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${def.partes.map(p => `<label class="chk"><input type="checkbox" value="${p.id}" ${p.id === this.sel ? 'checked' : ''}> ${esc(p.nome)}</label>`).join('')}</div></div></div>`);
    const r = await UI.modal({ title: 'Sessão nova', icon: 'layers', body, enterValue: true, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar', kind: 'primary', collect: a => ({ nome: $('input[type=text]', a.body).value.trim(), partes: $$('input[type=checkbox]:checked', a.body).map(i => i.value) }) }] });
    if (!r?.nome) return; const s = { id: uid('s'), nome: r.nome, partes: r.partes, presets: [] }; def.sessoes.push(s); this.aba = 'sessoes'; this.commit(); this.novoPreset(s, 'normal');
  },
  sessoesProntas() {
    const def = this.def; let n = 0;
    for (const sp of SESSOES_PRONTAS) {
      if (def.sessoes.some(s => s.nome.toLowerCase() === sp.nome.toLowerCase())) continue;
      const partes = sp.nome === 'Pose' ? [] : def.partes.filter(p => sp.acha.test(p.nome)).map(p => p.id); if (sp.nome !== 'Pose' && !partes.length) continue;
      const s = { id: uid('s'), nome: sp.nome, partes, presets: sp.presets.map(nm => ({ id: uid('pr'), nome: nm, estado: {} })) }; def.sessoes.push(s); n++;
    }
    this.aba = 'sessoes'; this.commit(); UI.toast(n ? `${n} sessões criadas pelos nomes das partes, com presets vazios: clique em cada preset e monte.` : 'Dê nomes às partes (ex.: "Olho direito", "Boca", "Perna direita") para eu achar as sessões.', { kind: n ? 'ok' : 'warn', time: 6000 });
  },
  // preset novo = como as partes da sessão estão agora na tela
  async novoPreset(s, nome) {
    nome = nome || await UI.prompt({ title: `Preset novo em "${s.nome}"`, label: 'Nome (ex.: assustado, chutando)', ok: 'Criar' }); if (!nome) return;
    const est = this.estado(), partes = s.partes?.length ? s.partes : this.def.partes.map(p => p.id), estado = {};
    for (const pid of partes) { const p = this.parte(pid); if (!p) continue; const e = est[pid], b = p.base, d = {}; for (const c of ['img', 'x', 'y', 'r', 's', 'sx', 'vis']) if (e[c] !== b[c] && e[c] !== undefined) d[c] = e[c]; if (Object.keys(d).length) estado[pid] = d; }
    const pr = { id: uid('pr'), nome, estado }; s.presets.push(pr); this.edit = { s: s.id, p: pr.id }; this.aba = 'sessoes'; this.commit();
  },
  async presetIA(s) {
    const pedido = await UI.prompt({ title: `Preset com a IA em "${s.nome}"`, label: 'Descreva (ex.: "olhos de susto, bem abertos", "chutando para a frente")', ok: 'Criar', icon: 'sparkles', ia: true }); if (!pedido) return;
    const t = UI.toast('<span class="spin-dot"></span> A IA está montando o preset…', { time: 120000 });
    try { const pr = await IA.criarPreset(this.def, s, pedido); t.remove(); s.presets.push(pr); this.edit = { s: s.id, p: pr.id }; this.commit(); UI.toast(`Preset "${esc(pr.nome)}" criado. Confira e ajuste se precisar.`, { kind: 'ok' }); }
    catch (e) { t.remove(); UI.toast('A IA não conseguiu: ' + esc(e.message), { kind: 'err' }); }
  },
  menuSessao(e, s) {
    UI.ctx(e.clientX, e.clientY, [
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome da sessão', value: s.nome }); if (n) { s.nome = n; this.commit(); } } },
      { label: 'Escolher as partes', icon: 'layers', action: async () => { const body = h(`<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${this.def.partes.map(p => `<label class="chk"><input type="checkbox" value="${p.id}" ${(s.partes || []).includes(p.id) ? 'checked' : ''}> ${esc(p.nome)}</label>`).join('')}</div>`);
        const r = await UI.modal({ title: `Partes de "${s.nome}"`, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Pronto', kind: 'primary', collect: a => $$('input:checked', a.body).map(i => i.value) }] }); if (r) { s.partes = r; this.commit(); } } },
      '-', { label: 'Apagar a sessão', icon: 'trash', danger: true, action: async () => { if (await UI.confirm({ title: `Apagar "${esc(s.nome)}" e os presets dela?`, ok: 'Apagar', danger: true })) { this.def.sessoes = this.def.sessoes.filter(x => x !== s); if (this.edit?.s === s.id) this.edit = null; this.commit(); } } },
    ]);
  },
  menuPreset(e, s, pr) {
    UI.ctx(e.clientX, e.clientY, [
      { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome do preset', value: pr.nome }); if (n) { pr.nome = n; this.commit(); } } },
      { label: 'Duplicar', icon: 'dup', action: () => { const c = clone(pr); c.id = uid('pr'); c.nome += ' 2'; s.presets.splice(s.presets.indexOf(pr) + 1, 0, c); this.edit = { s: s.id, p: c.id }; this.commit(); } },
      { label: 'Voltar à base (limpar)', icon: 'undo', action: () => { pr.estado = {}; this.commit(); } },
      '-', { label: 'Apagar', icon: 'trash', danger: true, action: () => { s.presets = s.presets.filter(x => x !== pr); if (this.edit?.p === pr.id) this.edit = null; this.commit(); } },
    ]);
  },

  /* ---------- TESTAR: os mesmos botões do editor (sessões, presets e imagens por nome), para ver se tudo funciona.
     Nada muda o personagem; achou algo errado, "Arrumar" abre o preset (ou a parte) para corrigir. ---------- */
  testar(on) {
    clearInterval(this._roda); this._roda = null; Animacoes.parar(true); Animacoes.passo = null; Animacoes.poseFixa = null; this.editPasso = null; if (!on) this.edit = null;
    const antes = !!this.teste; this.teste = on ? { sessoes: {}, partes: {} } : null; if (on) { this.edit = null; this.multi.clear(); this.focoImg = null; }
    this.pinta(); if (antes !== !!on) this.enquadrar();
  },
  // problemas de um preset: vazio, parte que não existe mais, imagem que não existe mais
  problemas(pr) {
    const out = []; if (!Object.keys(pr.estado || {}).length) out.push('está vazio (não muda nada)');
    for (const [pid, e] of Object.entries(pr.estado || {})) { const p = this.parte(pid); if (!p) { out.push('usa uma parte que foi apagada'); continue; } if (e.img && !p.imgs.some(i => i.id === e.img)) out.push(`a imagem de "${p.nome}" foi tirada`); }
    return [...new Set(out)];
  },
  pintaTeste() {
    let el = $('#at-teste'); if (!this.teste) { el?.remove(); return; }
    if (!el) { el = h('<div id="at-teste" class="at-teste"></div>'); $('.at-palco').appendChild(el); } el.classList.toggle('min', !!this.testeMin);
    const T = this.teste, def = this.def, rol = el.scrollTop; el.innerHTML = '';
    el.appendChild(h(`<div class="tt-cab"><b>${ic('play', 13)} Testar os botões</b><span class="sp"></span><button class="btn sm" data-zera title="Tudo na base">Base</button><button class="ibtn" data-min title="${this.testeMin ? 'Abrir o painel' : 'Recolher o painel'}">${ic(this.testeMin ? 'down' : 'up', 13)}</button><button class="ibtn" data-x title="Sair do teste (Esc)">${ic('x', 13)}</button></div>`));
    $('[data-zera]', el).onclick = () => { Animacoes.parar(true); this.teste = { sessoes: {}, partes: {} }; this.pinta(); }; $('[data-min]', el).onclick = () => { this.testeMin = !this.testeMin; this.pintaTeste(); this.enquadrar(); }; $('[data-x]', el).onclick = () => this.testar(false);
    if (Animacoes.tocando || Animacoes.poseFixa) { const a = Animacoes.achar(Animacoes.tocando), pf = Animacoes.poseFixa;
      const bar = h(`<div class="tt-play">${pf ? `<b>${ic('film', 13)} ${esc(pf.anim || 'Animação')} · quadro ${pf.quadro + 1}</b><small>clique numa peça para arrumar; ao salvar, a animação recebe a mudança</small>` : `
        <button class="btn sm" data-pp title="Pausar / continuar (P)">${ic(Animacoes.pausado ? 'play' : 'pause', 13)} ${Animacoes.pausado ? 'Continuar' : 'Pausar'}</button>
        <button class="ibtn" data-ant title="Passo anterior ( , )">${ic('prev', 13)}</button><button class="ibtn" data-prox title="Próximo passo ( . )">${ic('next', 13)}</button>
        <span>${esc(a?.nome || '')} · passo ${(Animacoes.i % Math.max(1, ...(a?.trilhas || [[1]]).map(t => t.length))) + 1}</span>`}</div>`);
      if (!pf) { $('[data-pp]', bar).onclick = () => Animacoes.pausado ? Animacoes.continuar() : Animacoes.pausar(); $('[data-ant]', bar).onclick = () => Animacoes.passoMais(-1); $('[data-prox]', bar).onclick = () => Animacoes.passoMais(1); }
      el.appendChild(bar); }
    el.appendChild(h('<div class="tt-dica">Clique como no editor e veja a peça mudar. Botão vermelho = tem problema (passe o mouse). Errado? Clique em <b>Arrumar</b>.</div>'));
    if (!def.sessoes.length) el.appendChild(h('<div class="vazio">Ainda não tem sessões (olhos, boca, poses…). Crie na aba <b>Sessões e poses</b>.</div>'));
    for (const s of def.sessoes) {
      const esc1 = T.sessoes[s.id], box = h(`<div class="tt-s"><div class="tt-t"><b>${esc(s.nome)}</b><span class="sp"></span><button class="ibtn" data-roda title="Passar por todos os presets">${ic('loop', 13)}</button><button class="btn sm" data-arruma ${esc1 ? '' : 'disabled'} title="Editar o preset escolhido">${ic('edit', 12)} Arrumar</button></div><div class="lista presets"></div></div>`);
      const l = $('.lista', box);
      for (const pr of s.presets) { const pb = this.problemas(pr), b = h(`<button class="${esc1 === pr.id ? 'on' : ''} ${pb.length ? 'ruim' : ''} ${this.marcas().presets.has(pr.id) ? 'mod' : ''}" title="${pb.length ? esc('Problema: ' + pb.join('; ')) : 'Clique para ver'}">${esc(pr.nome)}</button>`);
        b.onclick = () => { clearInterval(this._roda); this._roda = null; Animacoes.parar(true); if (T.sessoes[s.id] === pr.id) delete T.sessoes[s.id]; else T.sessoes[s.id] = pr.id; this.pinta(); };
        b.ondblclick = () => this.arrumar(s, pr); b.oncontextmenu = ev => { ev.preventDefault(); UI.ctx(ev.clientX, ev.clientY, [{ label: 'Arrumar este preset', icon: 'edit', action: () => this.arrumar(s, pr) }]); };
        l.appendChild(b); }
      if (!s.presets.length) l.appendChild(h('<span class="tt-nada">sem presets</span>'));
      $('[data-arruma]', box).onclick = () => { const pr = s.presets.find(x => x.id === T.sessoes[s.id]); if (pr) this.arrumar(s, pr); };
      $('[data-roda]', box).onclick = () => { clearInterval(this._roda); if (!s.presets.length) return; let i = Math.max(0, s.presets.findIndex(x => x.id === T.sessoes[s.id])); this._roda = setInterval(() => { if (!this.teste) return clearInterval(this._roda); i = (i + 1) % s.presets.length; T.sessoes[s.id] = s.presets[i].id; this.pinta(); }, 700); };
      el.appendChild(box);
    }
    const varias = def.partes.filter(p => p.imgs.length > 1);
    if (varias.length) { el.appendChild(h('<div class="tt-t" style="margin-top:6px"><b>Imagens por nome</b></div>'));
      const est = this.estado();
      for (const p of varias) { const box = h(`<div class="tt-s"><div class="tt-t"><small>${esc(p.nome)}</small><span class="sp"></span><button class="btn sm" data-arruma title="Ir para a parte">${ic('edit', 12)} Arrumar</button></div><div class="lista presets"></div></div>`), l = $('.lista', box);
        for (const img of p.imgs) { const b = h(`<button class="${est[p.id]?.img === img.id ? 'on' : ''}">${esc(img.nome)}</button>`); b.onclick = () => { Animacoes.parar(true); T.partes[p.id] = { ...(T.partes[p.id] || {}), img: img.id }; this.pinta(); }; l.appendChild(b); }
        $('[data-arruma]', box).onclick = () => { this.testar(false); this.escolhe(p.id); this.aba = 'peca'; this.pinta(); };
        el.appendChild(box); } }
    el.scrollTop = rol;
  },
  arrumar(s, pr) { this.testar(false); this.edit = { s: s.id, p: pr.id }; this.aba = 'sessoes'; const p1 = Object.keys(pr.estado || {}).find(id => this.parte(id)); if (p1) this.escolhe(p1); this.pinta(); UI.toast(`Arrumando <b>${esc(s.nome)} › ${esc(pr.nome)}</b>. O que você mexer vale só para este preset.`, { kind: 'ok' }); },

  /* ---------- IA no Ateliê: cria um preset novo numa sessão, ou preenche de uma vez os presets que estão vazios ---------- */
  async ia(modoIni) {
    const def = this.def; if (!def.partes.length) return UI.toast('Ponha as partes do personagem antes de usar a IA.', { kind: 'warn' });
    const atual = this.edit?.s || def.sessoes[0]?.id || '';
    const body = h(`<div><label class="field">O que a IA deve fazer<select data-modo>
        <option value="organizar">Organizar tudo automaticamente (partes, raiz, encaixes, camadas, sessões, presets e animações de teste)</option>
        <option value="animacoes">Criar animações de teste (andar, falar, piscar…)</option>
        <option value="preset">Criar um preset numa sessão</option><option value="vazios">Preencher os presets vazios de uma sessão</option></select></label>
      <label class="field" data-so-s>Sessão<select data-s>${def.sessoes.map(s => `<option value="${s.id}" ${s.id === atual ? 'selected' : ''}>${esc(s.nome)} (${s.presets.length})</option>`).join('')}<option value="__nova">+ Sessão nova…</option></select></label>
      <label class="field">Pedido <small data-dica></small><textarea rows="3" data-p></textarea></label>
      <div data-aviso style="color:var(--tx3);font-size:11.5px"></div></div>`);
    const modo = $('[data-modo]', body), troca = () => { const m = modo.value; $('[data-so-s]', body).hidden = !['preset', 'vazios'].includes(m);
      $('[data-p]', body).placeholder = { organizar: 'Opcional. Ex.: "a raiz é o corpo", "as bocas são para falar"', animacoes: 'Opcional. Ex.: "andar, falar e acenar feliz"', preset: 'Ex.: olhos de susto, bem abertos · chutando para a frente', vazios: 'Opcional' }[m];
      $('[data-aviso]', body).innerHTML = m === 'organizar' ? 'A IA vê as peças e monta tudo de uma vez. Depois você só ajusta à mão o que precisar (um <b>Ctrl+Z</b> desfaz tudo).' : ''; };
    modo.value = modoIni || (def.sessoes.length || def.animacoes?.length ? 'preset' : 'organizar'); modo.onchange = troca; troca();
    const r = await UI.modal({ title: 'IA do Ateliê', icon: 'sparkles', kind: 'ia', width: 520, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Fazer', kind: 'primary ia', icon: 'sparkles', collect: a => ({ modo: modo.value, s: $('[data-s]', a.body).value, pedido: $('[data-p]', a.body).value.trim() }) }] });
    if (!r) return;
    if (r.modo === 'organizar' || r.modo === 'animacoes') return this.iaOrganizar(r.modo, r.pedido);
    let s = def.sessoes.find(x => x.id === r.s);
    if (r.s === '__nova' || !s) { const nome = await UI.prompt({ title: 'Sessão nova', label: 'Nome (ex.: Olhos, Boca, Pose)', ok: 'Criar' }); if (!nome) return; s = { id: uid('s'), nome, partes: [], presets: [] }; def.sessoes.push(s); this.commit(); }
    const fila = r.modo === 'vazios' ? s.presets.filter(p => !Object.keys(p.estado || {}).length).map(p => ({ pr: p, pedido: p.nome + (r.pedido ? ' — ' + r.pedido : '') })) : r.pedido ? [{ pr: null, pedido: r.pedido }] : [];
    if (!fila.length) return UI.toast(r.modo === 'vazios' ? 'Essa sessão não tem presets vazios.' : 'Escreva o que a IA deve criar.', { kind: 'warn' });
    const t = UI.toast(`<span class="spin-dot"></span> <span data-p>A IA está montando…</span>`, { time: 600000 }); let feitos = 0, ultimo = null;
    try {
      for (const it of fila) { const e = t.querySelector('[data-p]'); if (e) e.textContent = `A IA está montando "${it.pedido}"… (${feitos + 1}/${fila.length})`;
        const novo = await IA.criarPreset(this.def, s, it.pedido); if (it.pr) { it.pr.estado = novo.estado; ultimo = it.pr; } else { s.presets.push(novo); ultimo = novo; } feitos++; this.commit({ soDesenho: true }); }
      t.remove(); this.aba = 'sessoes'; this.teste = { sessoes: { [s.id]: ultimo.id }, partes: {} }; this.edit = null; this.pinta();
      UI.toast(`${feitos} preset(s) feitos pela IA em <b>${esc(s.nome)}</b>. Está no modo <b>Testar</b>: clique nos botões para conferir e em Arrumar se precisar.`, { kind: 'ok', time: 7000 });
    } catch (e) { t.remove(); this.pinta(); UI.toast(`A IA parou${feitos ? ` depois de ${feitos}` : ''}: ` + esc(e.message), { kind: 'err' }); }
  },
  async iaOrganizar(modo, pedido) {
    const t = UI.toast(`<span class="spin-dot"></span> <span data-p>A IA está olhando as peças…</span>`, { time: 600000 });
    try {
      await Arq.garantir(this.def.partes.flatMap(p => p.imgs.map(i => i.k)));
      const plano = await IA.organizar(this.def, modo, pedido, txt => { const e = t.querySelector('[data-p]'); if (e) e.textContent = `A IA está organizando… (${Math.round(txt.length / 100) / 10} mil letras)`; });
      t.remove(); const feito = this.aplicarPlano(plano, modo), avisos = (plano.avisos || []).filter(Boolean).slice(0, 5);
      this.aba = (this.def.animacoes || []).length ? 'animacoes' : 'sessoes'; this.testar(true);
      UI.toast(`<b>Pronto.</b> ${feito.join(' · ') || 'A IA achou que já estava tudo certo.'}<br>Confira no <b>Testar</b> e na aba <b>Animações</b>; ajuste à mão o que precisar (Ctrl+Z desfaz tudo).`, { kind: 'ok', time: 12000 });
      if (avisos.length) UI.modal({ title: 'A IA deixou uns avisos', icon: 'info', width: 460, body: `<div>${avisos.map(a => `<p style="margin:0 0 8px">• ${esc(String(a))}</p>`).join('')}<div style="color:var(--tx3);font-size:12px">Dá para separar peças com <b>Seleção</b>/<b>Laço</b> › <b>Recortar → parte nova</b> na aba Pintar, e depois pedir para a IA organizar de novo.</div></div>`, buttons: [{ label: 'Entendi', kind: 'primary', value: true }] });
    } catch (e) { t.remove(); UI.toast('A IA não conseguiu organizar: ' + esc(e.message), { kind: 'err', time: 7000 }); }
  },
  // aplica o plano da IA (nomes → ids). Tudo num commit só.
  aplicarPlano(pl, modo) {
    const def = this.def, feito = [], nome = n => IA.acha(def.partes, n), img = (p, n) => p && n ? IA.acha(p.imgs, n) : null;
    if (modo !== 'animacoes') {
      let n = 0; for (const j of pl.juntar || []) { const alvo = nome(j.em), ps = (j.partes || []).map(nome).filter(p => p && p !== alvo); if (alvo && ps.length) { this.virarImagens(ps, alvo, null, { semCommit: true }); n += ps.length; } } if (n) feito.push(`${n} parte(s) viraram imagens`);
      n = 0; for (const [de, para] of Object.entries(pl.renomear_partes || {})) { const p = nome(de); if (p && para) { p.nome = String(para).slice(0, 40); n++; } }
      for (const r of pl.renomear_imagens || []) { const p = nome(r.parte), i = img(p, r.de); if (i && r.para) { i.nome = String(r.para).slice(0, 40); n++; } } if (n) feito.push(`${n} nome(s) arrumados`);
      const rz = nome(pl.raiz); if (rz) { if (rz.pai) this.porNoPai(rz.id, null, { semCommit: true }); def.raiz = rz.id; feito.push(`raiz: ${rz.nome}`); }
      n = 0; for (const [fi, pa] of Object.entries(pl.pais || {})) { const f = nome(fi), p = pa ? nome(pa) : null; if (f && f !== rz && (p?.id || null) !== (f.pai || null) && (!pa || p)) { let a = p?.id, ciclo = false; while (a) { if (a === f.id) { ciclo = true; break; } a = this.parte(a)?.pai; } if (!ciclo) { this.porNoPai(f.id, p?.id || null, { semCommit: true }); n++; } } } if (n) feito.push(`${n} encaixe(s)`);
      n = 0; for (const [pn, v] of Object.entries(pl.pivos || {})) { const p = nome(pn), est = this.estado(), im = p && p.imgs.find(i => i.id === est[p.id]?.img); if (!im || !v || !isFinite(+v.x) || !isFinite(+v.y)) continue; this.pivoEm(p, clamp(+v.x, -.2, 1.2) * im.w, clamp(+v.y, -.2, 1.2) * im.h, est); n++; } if (n) feito.push(`${n} ponto(s) de giro`);
      if (Array.isArray(pl.camadas) && pl.camadas.length) { const L = pl.camadas.map(nome).filter(Boolean), resto = def.partes.filter(p => !L.includes(p)); const ordem = [...new Set([...resto, ...L])]; ordem.forEach((p, i) => p.z = i); feito.push('camadas'); }
      n = 0; for (const s0 of pl.sessoes || []) {
        let s = def.sessoes.find(x => x.nome.toLowerCase() === String(s0.nome || '').toLowerCase()); if (!s) { s = { id: uid('s'), nome: String(s0.nome || 'Sessão').slice(0, 30), partes: [], presets: [] }; def.sessoes.push(s); }
        const ps = (s0.partes || []).map(nome).filter(Boolean).map(p => p.id); if (ps.length) s.partes = [...new Set([...(s.partes || []), ...ps])];
        for (const pr0 of s0.presets || []) { const estado = {}; for (const [pn, e0] of Object.entries(pr0.estado || {})) { const p = nome(pn); if (!p) continue; const e = typeof e0 === 'string' ? { img: e0 } : e0 || {}, v = {}, im = img(p, e.img); if (im) v.img = im.id; for (const c of ['x', 'y', 'r', 's']) if (e[c] != null && isFinite(+e[c])) v[c] = +e[c]; if (Object.keys(v).length) estado[p.id] = v; }
          let pr = s.presets.find(x => x.nome.toLowerCase() === String(pr0.nome || '').toLowerCase()); if (pr && Object.keys(pr.estado || {}).length) continue;
          if (!pr) { pr = { id: uid('pr'), nome: String(pr0.nome || 'preset').slice(0, 40), estado: {} }; s.presets.push(pr); } pr.estado = estado; n++; } }
      if (n) feito.push(`${n} preset(s)`);
    }
    let n = 0; for (const a0 of pl.animacoes || []) {
      const trilhas = (a0.trilhas || []).map(t => (t || []).map(p0 => { const p = { s: {}, p: {} }; for (const [pn, v0] of Object.entries(p0 || {})) { const pt = nome(pn); if (!pt) continue; const v = typeof v0 === 'string' ? { img: v0 } : v0 || {}, im = img(pt, v.img); const num = c => v[c] != null && isFinite(+v[c]); if (!im && !num('r') && !num('x') && !num('y')) continue; p.p[pt.id] = { ...(im ? { img: im.id } : {}), ...(num('r') ? { r: +v.r } : {}), ...(num('x') ? { x: +v.x } : {}), ...(num('y') ? { y: +v.y } : {}) }; } return p; }).filter(p => Object.keys(p.p).length)).filter(t => t.length);
      if (!trilhas.length) continue; const L = def.animacoes ||= [], velha = L.find(x => x.nome.toLowerCase() === String(a0.nome || '').toLowerCase());
      const a = { id: velha?.id || uid('an'), nome: String(a0.nome || 'Animação').slice(0, 40), vel: clamp(+a0.vel || 250, 60, 2000), trilhas };
      if (velha) L[L.indexOf(velha)] = a; else L.push(a); n++;
    }
    if (n) feito.push(`${n} animação(ões) de teste`);
    def.iaPlano = { em: Date.now(), resumo: IA.resumo(def) }; // para aprender: ao salvar na nuvem, compara com o que a equipe ajustou
    this.sel = def.raiz || this.sel; this.multi.clear(); this.commit(); return feito;
  },

  /* ---------- salvar na nuvem da equipe ---------- */
  async salvar(o = {}) {
    const def = this.def; if (!def.partes.length) return UI.toast('Ponha pelo menos uma parte antes de salvar.', { kind: 'warn' });
    if (this.naNuvem) return this.sincronizar(true);
    def.thumb = this.miniatura();
    // aprendizado: o que a equipe corrigiu depois da IA organizar vai junto (a IA lê isso nos próximos personagens)
    if (def.iaPlano?.resumo) { try { const c = IA.correcoes(def.iaPlano.resumo, IA.resumo(def)); def.iaCorrecoes = [...new Set([...(def.iaCorrecoes || []), ...c])].slice(-40); } catch { } }
    const t = UI.toast('<span class="spin-dot"></span> <span data-p>Salvando na nuvem…</span>', { time: 600000 });
    try { await Nuvem.salvar(def, txt => { const e = t.querySelector('[data-p]'); if (e) e.textContent = txt; }); t.remove(); await this.apagarRascunho(def.id); this.sujo = false; this.ultimo = JSON.stringify(def); this.base0 = this.ultimo; this.pinta();
      if (App.P?.personagens?.[def.id]) { App.P.personagens[def.id] = clone(def); App.commit('Personagem atualizado'); }
      try { new BroadcastChannel('animador').postMessage({ tipo: 'personagem', def: JSON.parse(JSON.stringify(def)) }); } catch { } // avisa as outras abas (a animação aberta atualiza o personagem)
      this.naNuvem = true; this.pintaBotaoNuvem(); this.pintaEstado();
      UI.toast(`<b>${esc(def.nome)}</b> salvo na nuvem da equipe (pasta "${esc(def.pasta)}"). Agora as mudanças vão sozinhas para a nuvem.`, { kind: 'ok', time: 5000 });
      if (!o.semAviso) await this.avisoLocais(); }
    catch (e) { t.remove(); UI.toast('Não salvou: ' + esc(e.message), { kind: 'err', time: 7000 }); }
  },
  miniatura() {
    const est = Modelo.partesNoEstado(this.def, {}), b = Modelo.caixaPersonagem(this.def, est), S = 160, k = Math.min(S / b.w, S / b.h) * .92, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), base = new DOMMatrix().translate(S / 2, S / 2).scale(k).translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    for (const it of Modelo.montar(this.def, est)) { if (!it.img) continue; const bm = Arq.img.get(it.img.k); if (!bm) continue; x.setTransform(base.multiply(it.m)); x.drawImage(bm, -(it.img.pivo?.x ?? it.img.w / 2) + (it.img.ajuste?.x || 0), -(it.img.pivo?.y ?? it.img.h / 2) + (it.img.ajuste?.y || 0), it.img.w, it.img.h); }
    return c.toDataURL('image/png');
  },
};
addEventListener('keyup', e => { if (e.key === ' ') Atelie.espaco = false; if (e.key === 'Alt' && Atelie.alt) { Atelie.alt = false; Atelie.desenha(); } });
addEventListener('keydown', e => { if (e.key === 'Alt' && !Atelie.alt && !$('#atelie').classList.contains('hidden')) { Atelie.alt = true; Atelie.desenha(); } });
addEventListener('blur', () => { if (Atelie.alt) { Atelie.alt = false; Atelie.desenha(); } });

/* ---------- escolher um personagem da biblioteca da equipe ---------- */
const Biblioteca = {
  async escolher() {
    const body = h('<div><div class="vazio"><span class="spin-dot"></span> Carregando a biblioteca da equipe…</div></div>');
    let escolhido = null;
    const p = UI.modal({ title: 'Pôr um personagem', icon: 'layers', width: 640, body, buttons: [{ label: 'Criar personagem novo', left: true, onClick: () => { setTimeout(() => Atelie.abrirAba(null), 50); return true; } }, { label: 'Cancelar', value: null }] });
    try {
      const [lista, locais] = await Promise.all([Nuvem.lista().catch(e => { if (!navigator.onLine) return []; throw e; }), Atelie.rascunhos().then(rs => rs.filter(r => !r.nuvem))]);
      body.innerHTML = '';
      // personagens LOCAIS (só neste computador): dá para usar na animação; a equipe não vê até ele ir para a nuvem
      if (locais.length) { body.appendChild(h(`<div class="sec">${ic('save', 14)} Só neste computador <small style="color:var(--tx3);font-weight:400;margin-left:6px">a equipe não vê</small></div>`)); const g = h('<div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))"></div>');
        for (const r of locais) { const c = h(`<div class="pc rasc"><div class="th" style="aspect-ratio:1;${r.thumb ? `background-image:url('${r.thumb}')` : ''}"></div><div class="in"><b>${esc(r.def.nome)}</b></div><span class="tag-local">${ic('save', 11)} só aqui</span></div>`);
          c.onclick = async () => { c.style.opacity = .5; escolhido = clone(r.def); await Arq.garantir(r.def.partes.flatMap(p => p.imgs.map(i => i.k))).catch(() => { }); $('#modal-root .modal-back [data-x]')?.click(); }; g.appendChild(c); }
        body.appendChild(g); if (lista.length) body.appendChild(h(`<div class="sec">${ic('cloud', 14)} Na nuvem da equipe</div>`)); }
      if (!lista.length && !locais.length) body.innerHTML = '<div class="vazio">Nenhum personagem ainda. Crie o primeiro no Ateliê.</div>';
      else if (lista.length) { const pastas = [...new Set(lista.map(x => x.pasta))];
        for (const pa of pastas) { body.appendChild(Home.tituloPasta(pa)); const g = h('<div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))"></div>');
          for (const it of lista.filter(x => x.pasta === pa)) { const c = h(`<div class="pc"><div class="th" style="aspect-ratio:1;${it.thumb ? `background-image:url('${it.thumb}')` : ''}"></div><div class="in"><b>${esc(it.nome)}</b></div></div>`);
            const selo = Autores.selo(it); if (selo) c.appendChild(selo);
            c.onclick = async () => { c.style.opacity = .5; try { escolhido = await Nuvem.abrir(it.id); } catch (e) { UI.toast(esc(e.message), { kind: 'err' }); } $('#modal-root .modal-back [data-x]')?.click(); }; g.appendChild(c); }
          body.appendChild(g); } }
    } catch (e) { body.innerHTML = `<div class="vazio">Não consegui abrir a biblioteca: ${esc(e.message)}</div>`; }
    await p; return escolhido;
  },
};
