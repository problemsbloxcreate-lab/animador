/* ===================== exportar.js — MP4 (H.264 + AAC, padrão do YouTube) e imagem do quadro ===================== */
'use strict';
const Exportar = {
  /* ---------- JANELA DE EXPORTAR: nome do arquivo (ou o do projeto), o que exportar (vídeo MP4, imagem do quadro, só o som, .animador),
     tamanho, qualidade, trecho (tudo / marcado na régua / quadros), som e legendas, com a duração em min:seg e o tamanho estimado.
     Enquanto exporta a janela NÃO fecha (Esc, clique fora e o X ficam travados; dá para cancelar) e mostra quadro X de N, tempo passado e o que falta. ---------- */
  tc(seg) { seg = Math.max(0, seg); const m = Math.floor(seg / 60), s = Math.floor(seg % 60), cs = Math.floor((seg % 1) * 10); return `${m}:${String(s).padStart(2, '0')}${cs ? ',' + cs : ''}`; },
  dur(seg) { seg = Math.round(seg); if (seg < 60) return `${seg} s`; const m = Math.floor(seg / 60), s = seg % 60; return m < 60 ? `${m} min${s ? ` ${s} s` : ''}` : `${Math.floor(m / 60)} h ${m % 60} min`; },
  // k = bits por pixel de cada quadro. Em 1080p a 24 fps: Normal ~8 Mbps (o que o YouTube recomenda), Alta ~12, Máxima ~20 (09/11/2026: antes eram 4, 6 e 10)
  QUAL: { normal: { nome: 'Normal', k: .16 }, alta: { nome: 'Alta', k: .24 }, max: { nome: 'Máxima', k: .4 } },
  // BITRATE (pedido da dona, 09/11/2026): a janela sempre abre em Máxima; digitar no campo Bitrate vira "Personalizada" (1 a 60 Mbps)
  MBPS: [1, 60],
  bps(cfg, W, H, fps) { return cfg.qual === 'custom' && cfg.mbps ? clamp(+cfg.mbps, ...this.MBPS) * 1e6 : W * H * fps * (this.QUAL[cfg.qual] || this.QUAL.max).k; },
  mbpsTxt(b) { return (Math.round(b / 1e5) / 10).toString().replace('.', ','); },
  async abrir(op = {}) {
    const P = App.P, cfg = { nomeProj: true, nome: P.nome, tipo: 'mp4', q: 1, trecho: Folha.trecho ? 'marcado' : 'tudo', de: 0, ate: P.duracao - 1, som: true, leg: true, ...(P.exportar || {}), qual: 'max', mbps: null, ...(op.tipo ? { tipo: op.tipo } : {}) };
    if (cfg.nomeProj) cfg.nome = P.nome; const temSom = (P.audios || []).length > 0, temLeg = (P.legendas || []).length > 0; if (cfg.tipo === 'srt' && !temLeg) cfg.tipo = 'mp4';
    const TIPOS = [['mp4', 'film', 'Vídeo MP4', 'com imagem e som'], ['png', 'image', 'Imagem', 'só o quadro de agora (PNG)'], ['wav', 'music', 'Só o som', 'a mistura em WAV'], ['animador', 'file', 'Arquivo .animador', 'para abrir aqui de novo'], ['srt', 'text', 'Legendas', temLeg ? 'arquivo .srt para o YouTube' : 'este projeto não tem legendas']];
    const body = h(`<div class="exp">
      <div class="rv-banner" data-rv hidden></div>
      <div class="exp-sec"><label class="exp-l">Nome do arquivo</label>
        <div class="exp-nome"><input type="text" data-nome maxlength="80" value="${esc(cfg.nome)}"><span class="exp-ext" data-ext>.mp4</span></div>
        <label class="chk"><input type="checkbox" data-np ${cfg.nomeProj ? 'checked' : ''}> Usar o nome do projeto</label></div>
      <div class="exp-sec"><label class="exp-l">O que exportar</label><div class="exp-tipos">${TIPOS.map(([id, icn, nm, d]) => `<button class="exp-tipo" data-tipo="${id}" ${id === 'srt' && !temLeg ? 'disabled' : ''}>${ic(icn, 18)}<b>${nm}</b><small>${d}</small></button>`).join('')}</div></div>
      <div class="exp-sec" data-so="mp4"><div class="exp-grade">
        <label class="exp-c"><span class="exp-l">Tamanho</span><select data-q>${[[1, 'Original'], [.75, '75%'], [.5, 'Metade (mais rápido)'], [.25, 'Um quarto (rascunho)']].map(([v, n]) => `<option value="${v}" ${+cfg.q === v ? 'selected' : ''}>${n} · ${Math.round(P.w * v / 2) * 2}×${Math.round(P.h * v / 2) * 2}</option>`).join('')}</select></label>
        <label class="exp-c"><span class="exp-l">Qualidade</span><select data-qual>${Object.entries(this.QUAL).map(([id, x]) => `<option value="${id}" ${cfg.qual === id ? 'selected' : ''}>${x.nome}</option>`).join('')}<option value="custom">Personalizada</option></select></label>
        <label class="exp-c"><span class="exp-l">Bitrate (Mbps)</span><input type="number" data-mbps min="${this.MBPS[0]}" max="${this.MBPS[1]}" step="0.5" title="Quanto maior, melhor a imagem e maior o arquivo"></label></div></div>
      <div class="exp-sec" data-so="mp4 wav srt"><label class="exp-l">Trecho</label>
        <div class="exp-seg"><button data-tr="tudo">Tudo</button><button data-tr="marcado" ${Folha.trecho ? '' : 'disabled title="Marque um trecho na régua da timeline (Shift + arrastar)"'}>Marcado na régua</button><button data-tr="quadros">Escolher os quadros</button></div>
        <div class="exp-quadros" data-qd><span>do quadro</span><input type="number" data-de min="1" max="${P.duracao}"><span>até</span><input type="number" data-ate min="1" max="${P.duracao}"></div></div>
      <div class="exp-sec exp-ops" data-so="mp4"><label class="chk"><input type="checkbox" data-som ${cfg.som && temSom ? 'checked' : ''} ${temSom ? '' : 'disabled'}> Com som${temSom ? '' : ' (não tem áudio)'}</label><label class="chk"><input type="checkbox" data-leg ${cfg.leg ? 'checked' : ''} ${temLeg ? '' : 'disabled'}> Com legendas${temLeg ? '' : ' (não tem)'}</label></div>
      <div class="exp-sec exp-ops" data-so="mp4 wav"><label class="chk" title="Mede o volume do trecho e leva para −14 LUFS, o volume dos Shorts e do YouTube. Desligado, fica o volume da mistura. O pico fica sempre em −1 dB, para não estourar."><input type="checkbox" data-niv ${cfg.nivelar !== false && temSom ? 'checked' : ''} ${temSom ? '' : 'disabled'}> Nivelar o volume (−14 LUFS)</label></div>
      <div class="exp-resumo" data-res></div>
      <div class="exp-prog" hidden><div class="exp-barra"><i></i></div><div class="exp-pt"><b data-pp>0%</b><span data-pt></span><span class="sp"></span><span data-pr></span></div></div>
      <div class="exp-fim" hidden></div></div>`);
    const $b = s => $(s, body), nm = $b('[data-nome]'), lim = () => { const [de, ate] = this.limites(P, cfg); return { de, ate, n: ate - de + 1 }; };
    const pinta = () => {
      $$('[data-tipo]', body).forEach(b => b.classList.toggle('on', b.dataset.tipo === cfg.tipo)); $$('[data-tr]', body).forEach(b => b.classList.toggle('on', b.dataset.tr === cfg.trecho));
      $$('[data-so]', body).forEach(s => s.hidden = !s.dataset.so.split(' ').includes(cfg.tipo)); $b('[data-qd]').hidden = cfg.trecho !== 'quadros';
      $b('[data-ext]').textContent = { mp4: '.mp4', png: `.png`, wav: '.wav', animador: '.animador', srt: '.srt' }[cfg.tipo]; nm.disabled = cfg.nomeProj; if (cfg.nomeProj) nm.value = P.nome;
      const L = lim(), seg = L.n / P.fps, W = Math.round(P.w * cfg.q / 2) * 2, H = Math.round(P.h * cfg.q / 2) * 2;
      $b('[data-de]').value = L.de + 1; $b('[data-ate]').value = L.ate + 1;
      const bps = this.bps(cfg, W, H, P.fps); $b('[data-qual]').value = cfg.qual; if (document.activeElement !== $b('[data-mbps]') || cfg.qual !== 'custom') $b('[data-mbps]').value = Math.round(bps / 1e5) / 10;
      const mb = cfg.tipo === 'mp4' ? (bps * seg / 8 + (cfg.som && temSom ? 192000 / 8 * seg : 0)) / 1048576 : cfg.tipo === 'wav' ? seg * 48000 * 4 / 1048576 : 0;
      $b('[data-res]').innerHTML = cfg.tipo === 'png' ? `${ic('image', 14)} Quadro ${App.q + 1} (${this.tc(App.q / P.fps)}) · ${P.w}×${P.h}`
        : cfg.tipo === 'animador' ? `${ic('file', 14)} O projeto inteiro com personagens, imagens e sons, para abrir no Animador`
        : `${ic('clock', 14)} <b>${this.dur(seg)}</b> <span>(${this.tc(L.de / P.fps)} → ${this.tc((L.ate + 1) / P.fps)} · ${L.n} quadros a ${P.fps} fps)</span>${cfg.tipo === 'mp4' ? ` · ${W}×${H} · ${this.mbpsTxt(bps)} Mbps` : cfg.tipo === 'srt' ? ` · ${this.srt(P, L.de, L.ate).n} legendas` : ''}${mb ? ` · cerca de ${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} MB` : ''}`;
      P.exportar = { ...cfg, nome: cfg.nomeProj ? undefined : cfg.nome };
    };
    nm.oninput = () => { cfg.nome = nm.value; }; $b('[data-np]').onchange = e => { cfg.nomeProj = e.target.checked; if (!cfg.nomeProj) cfg.nome = nm.value || P.nome; pinta(); if (!cfg.nomeProj) nm.focus(); };
    $$('[data-tipo]', body).forEach(b => b.onclick = () => { cfg.tipo = b.dataset.tipo; pinta(); botao(); });
    $$('[data-tr]', body).forEach(b => b.onclick = () => { cfg.trecho = b.dataset.tr; if (b.dataset.tr === 'quadros') { const L = lim(); cfg.de = L.de; cfg.ate = L.ate; } pinta(); });
    $b('[data-de]').onchange = e => { cfg.trecho = 'quadros'; cfg.de = clamp(+e.target.value - 1, 0, P.duracao - 1); if (cfg.ate < cfg.de) cfg.ate = cfg.de; pinta(); };
    $b('[data-ate]').onchange = e => { cfg.trecho = 'quadros'; cfg.ate = clamp(+e.target.value - 1, 0, P.duracao - 1); if (cfg.ate < cfg.de) cfg.de = cfg.ate; pinta(); };
    $b('[data-q]').onchange = e => { cfg.q = +e.target.value; pinta(); }; $b('[data-qual]').onchange = e => { if (e.target.value === 'custom' && !cfg.mbps) cfg.mbps = Math.round(this.bps(cfg, Math.round(P.w * cfg.q / 2) * 2, Math.round(P.h * cfg.q / 2) * 2, P.fps) / 1e5) / 10; cfg.qual = e.target.value; pinta(); };
    $b('[data-mbps]').onchange = e => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (Number.isFinite(v) && v > 0) { cfg.mbps = clamp(v, ...this.MBPS); cfg.qual = 'custom'; } e.target.blur(); pinta(); };
    $b('[data-som]').onchange = e => { cfg.som = e.target.checked; pinta(); }; $b('[data-leg]').onchange = e => { cfg.leg = e.target.checked; }; $b('[data-niv]').onchange = e => { cfg.nivelar = e.target.checked; };
    // REVISOR: antes de exportar, mostra quantas coisas achou
    Revisor.conta(P).then(r => { const el = $b('[data-rv]'); if (!el || !(r.erro + r.aviso + r.dica)) return; el.hidden = false; el.className = 'rv-banner ' + (r.erro ? 'rv-erro' : r.aviso ? 'rv-aviso' : 'rv-dica');
      el.innerHTML = `${ic(r.erro + r.aviso ? 'alert' : 'info', 15)}<span>O revisor achou ${[r.erro && `${r.erro} erro${r.erro > 1 ? 's' : ''}`, r.aviso && `${r.aviso} aviso${r.aviso > 1 ? 's' : ''}`, r.dica && `${r.dica} dica${r.dica > 1 ? 's' : ''}`].filter(Boolean).join(', ')} antes de exportar.</span><button class="btn sm">Revisar</button>`;
      $('button', el).onclick = () => Revisor.abrir(); }).catch(() => { });
    let api = null; const o = { title: 'Exportar', icon: 'download', width: 560, saiMs: 200, noFocus: true, body, onOpen: a => { api = a; a.el.classList.add('exp-metro'); const x = $('[data-x]', a.el); x.className = 'btn'; x.textContent = 'Fechar'; botao(); }, buttons: [
      { label: 'Exportar', kind: 'primary', onClick: () => this.rodar(P, cfg, body, api, o) }] };
    const botao = () => { const b = api?.foot.querySelector('.btn.primary'); if (b) b.innerHTML = `${ic('download', 14)} ${{ mp4: 'Exportar o vídeo', png: 'Salvar a imagem', wav: 'Exportar o som', animador: 'Baixar o .animador', srt: 'Baixar as legendas' }[cfg.tipo]}`; };
    pinta(); await UI.modal(o); this._cancela = null;
  },
  /* GERAR O VÍDEO PELO PUBLICAÇÕES (pedido da dona, 10/11/2026): o Publicações abre /animador/?nuvem=<id>&exportar=publicacoes&item=<id>
     num quadro dentro dele. Aqui abre a MESMA janela Exportar de sempre (todas as opções; já em MP4 e qualidade Máxima). Ao exportar o vídeo,
     ele NÃO é baixado: vai para o IndexedDB 'ep-publicacoes' ligado ao não publicado (concluido: item) e a página de cima (mesma origem) é
     avisada por postMessage: ep-exp-prog { f, txt } · ep-exp-pronto { id } · ep-exp-erro { msg }. Cancelar = { tipo: 'ep-exp-cancela' } ou fechar a janela. */
  async paraPublicacoes(item, abriu) {
    const pai = window.parent !== window ? window.parent : null; if (!pai) return;
    const diz = m => { try { pai.postMessage({ ...m, item }, location.origin); } catch { } };
    const pub = this._pub = { item, diz, entregue: false, cancelou: false };
    addEventListener('message', e => { if (e.origin === location.origin && e.source === pai && e.data?.tipo === 'ep-exp-cancela') pub.cancelou = true; });
    try {
      if (!abriu || !App.P) throw new Error('Não consegui abrir a animação da nuvem.');
      diz({ tipo: 'ep-exp-prog', f: 0, txt: 'Escolha as opções na janela Exportar aqui embaixo e clique em “Exportar o vídeo”.' });
      await this.abrir({ tipo: 'mp4' });
      if (!pub.entregue) throw new Error('cancelado');
    } catch (e) { if (!pub.entregue) diz({ tipo: 'ep-exp-erro', msg: e?.message === 'cancelado' ? 'cancelado' : String(e?.message || e) }); }
    finally { this._pub = null; }
  },
  async entregaPub(blob, nome, titulo) {
    const pub = this._pub; await this.youtube();
    const id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await EstudioYouTube.fila.poe({ id, blob, nome, titulo: String(titulo || '').slice(0, 100), descricao: '', programa: 'animador', em: Date.now(), concluido: pub.item });
    pub.entregue = true; pub.diz({ tipo: 'ep-exp-pronto', id });
  },
  /* PRONTO → PUBLICAÇÕES (pedido da dona, 10/11/2026): botão com o ícone "Pu" ao lado do Exportar (e no menu ⋯ / botão direito).
     SEM EXPORTAR: põe a animação em "Não publicados" do Publicações (POST /publicacoes no turma-ia) com o nome, uma miniatura do quadro
     de agora (160×90 JPEG), o formato (em pé = Short), o canal padrão Turma do Problems e abrir = /animador/?nuvem=<id>. Lá, "Gerar o
     vídeo aqui" abre esta animação com a janela Exportar. Precisa estar na nuvem. P.publicacoes.id = o item (clicar de novo atualiza o
     mesmo, sem mexer no canal nem na data que a equipe escolheu lá). */
  CANAL_TURMA: { id: 'UC3V4c447QO0zEyTJlsqqSWQ', nome: 'Turma do Problems' },
  miniPub(P, q) {
    const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 160, 90);
    const k = Math.min(160 / P.w, 90 / P.h), w = Math.max(2, Math.round(P.w * k)), h = Math.max(2, Math.round(P.h * k)), t = document.createElement('canvas'); t.width = w; t.height = h;
    try { Render.quadro(t.getContext('2d'), P, q, w, h); g.drawImage(t, (160 - w) / 2, (90 - h) / 2); } catch { }
    return c.toDataURL('image/jpeg', .6);
  },
  /* BOTÃO Pu MOSTRA O ESTADO (pedido da dona, 10/11/2026: só o aviso embaixo ninguém via, o olho está no botão): "Enviando…" enquanto
     anda; depois fica verde com "No Publicações" (P.publicacoes.id) em toda abertura desta animação; e ao terminar o botão pisca e abre um
     BALÃO logo embaixo dele (pubBalao) com o resultado e "Abrir o Publicações". Erros e avisos do Pu também saem no balão. */
  pintaPub() {
    const b = document.getElementById('b-pub'); if (!b) return; const P = App.P, an = !!this._prontoAndando, ok = !!P?.publicacoes?.id && !P.publicacoes.saiu, ds = ok && this.pubDesat(P);
    const k = an ? 'a' : ds ? 'd' + P.publicacoes.em : ok ? 'o' + P.publicacoes.em : 'n'; if (b.dataset.st === k) return; b.dataset.st = k;
    b.classList.toggle('pub-andando', an); b.classList.toggle('pub-ok', ok && !an && !ds); b.classList.toggle('pub-desat', ds && !an);
    let tx = b.querySelector('.pub-tx'); if (!tx) { tx = document.createElement('span'); tx.className = 'pub-tx'; b.appendChild(tx); }
    tx.innerHTML = an ? '<span class="spin-dot"></span> Enviando…' : ds ? ic('alert', 13) + ' Desatualizado' : ok ? ic('check', 13) + ' No Publicações' : '';
    b.title = an ? 'Pondo no Publicações…' : ds ? `A animação mudou depois de ir para o Publicações (lá está a de ${fmtDate(P.publicacoes.em)}). Ela se atualiza sozinha lá quando salvar na nuvem; clique para atualizar agora.`
      : ok ? `Já está no Publicações, em "Não publicados" (atualizado ${fmtDate(P.publicacoes.em)}). Cada vez que salvar na nuvem, atualiza lá também.` : 'Pronto: pôr no Publicações (sem exportar). Lá dá para gerar o vídeo depois.';
  },
  // DESATUALIZADO (pedido da dona, 10/11/2026): a animação mudou (P.modificado) depois da versão que está no Publicações (P.publicacoes.mod)
  pubDesat(P) { const u = P?.publicacoes; return !!(u?.id && !u.saiu && (P.modificado || 0) > (u.mod || u.em || 0) + 1000); },
  // o item do Não publicados com o nome, o formato e a miniatura de agora (o resto — canal, data, modo — fica como a equipe deixou lá)
  itemPub(P, ant, id, q) {
    const base = ant ? (({ meu, por, editadoPor, editadoEm, ...x }) => x)(ant) : { canal: this.CANAL_TURMA, enviadoEm: Date.now(), modo: 'naoListado', privacidade: 'unlisted' };
    return { ...base, id, concluido: true, titulo: String(P.nome || 'Animação').slice(0, 100), programa: 'animador', abrir: '/animador/?nuvem=' + P.id, formato: P.h > P.w ? 'short' : 'longo', thumb: this.miniPub(P, clamp(q || 0, 0, Math.max(0, (P.duracao || 1) - 1))) };
  },
  /* ATUALIZA SOZINHO JUNTO COM O SALVAR NA NUVEM (NuvemAnim.sincronizar, depois de mandar): se está desatualizado, regrava o mesmo item
     (nome, formato, miniatura do quadro escolhido no clique). Saiu de Não publicados (postado/tirado) = marca saiu e NÃO põe de novo;
     na fila de gerar (pedido) = espera a próxima vez. snap = a versão que acabou de ir para a nuvem. Devolve se mudou P.publicacoes. */
  async pubAuto(P, snap) {
    const u = P?.publicacoes; if (!u?.id || u.saiu || !this.pubDesat(snap)) return false;
    const pode = k => window.EstudioPerm?.pode?.(k) ?? true; if (!pode('animador.exportar') || !pode('publicacoes')) return false;
    const L = await (await Nuvem.pede('/publicacoes')).json(), ant = (L.itens || []).find(x => x.id === u.id);
    if (!ant) { P.publicacoes = { ...u, saiu: true }; this.pintaPub(); return true; }
    if (ant.pedido) return false;
    await Nuvem.pede('/publicacoes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item: this.itemPub(snap, ant, u.id, u.q) }) });
    if (P.publicacoes?.id === u.id) P.publicacoes = { ...P.publicacoes, em: Date.now(), mod: snap.modificado || Date.now() }; this.pintaPub(); return true;
  },
  pubBalao(html, tipo = 'ok') {
    document.querySelector('.pub-balao')?.remove(); clearTimeout(this._balaoT); const b = document.getElementById('b-pub');
    if (!b || !b.offsetParent) return UI.toast(html, { kind: tipo });
    const r = b.getBoundingClientRect(), el = h(`<div class="pub-balao ${tipo}" role="status"><span class="pub-balao-ic">${ic(tipo === 'ok' ? 'check' : tipo === 'info' ? 'info' : 'alert', 16)}</span><div class="pub-balao-tx">${html}</div><button class="ibtn" data-x title="Fechar">${ic('x', 13)}</button></div>`);
    el.style.top = Math.round(r.bottom + 8) + 'px'; el.style.right = Math.max(8, Math.round(innerWidth - r.right)) + 'px'; el.style.setProperty('--seta', Math.round(r.width / 2) + 'px');
    document.body.appendChild(el); const fecha = () => { el.remove(); document.removeEventListener('pointerdown', fora, true); clearTimeout(this._balaoT); };
    const fora = e => { if (!el.contains(e.target) && !b.contains(e.target)) fecha(); };
    $('[data-x]', el).onclick = fecha; setTimeout(() => document.addEventListener('pointerdown', fora, true), 0); this._balaoT = setTimeout(fecha, tipo === 'ok' ? 10000 : 8000);
    if (tipo === 'ok') { b.classList.remove('pub-flash'); void b.offsetWidth; b.classList.add('pub-flash'); setTimeout(() => b.classList.remove('pub-flash'), 1600); }
  },
  /* TIRAR DO PUBLICAÇÕES (pedido da dona, 10/11/2026): botão direito no Pu, menu ⋯ e o botão "Tirar de lá" no balão.
     DELETE /publicacoes?id=<item> (o servidor só deixa quem pôs lá ou um ADM). Tira P.publicacoes: o Pu volta ao normal. */
  temPub(P = App.P) { return !!(P?.publicacoes?.id && !P.publicacoes.saiu); },
  async tirarPub() {
    const P = App.P, u = P?.publicacoes; if (!u?.id || this._prontoAndando) return;
    if (!await UI.confirm({ title: 'Tirar do Publicações?', msg: `"${esc(P.nome || 'Animação')}" sai de "Não publicados" no Publicações. A animação continua aqui, e dá para pôr de novo depois pelo botão Pu.`, ok: 'Tirar de lá', danger: true, icon: 'trash' })) return;
    this._prontoAndando = true; this.pintaPub();
    try {
      if (!u.saiu) { try { await Nuvem.pede('/publicacoes?id=' + encodeURIComponent(u.id), { method: 'DELETE' }); }
        catch (e) { return this.pubBalao(e.status === 403 ? 'Só quem pôs no Publicações (ou um ADM) pode tirar de lá.' : 'Não deu para tirar do Publicações: ' + esc(e.message), 'err'); } }
      if (App.P === P) { delete P.publicacoes; try { await App.salvarJa?.(); } catch { } }
      this._prontoAndando = false; this.pintaPub(); this.pubBalao(`<b>Tirada do Publicações</b><small>${esc(P.nome || 'Animação')} não está mais em Não publicados.</small>`, 'info');
    } finally { this._prontoAndando = false; this.pintaPub(); }
  },
  menuPub(x, y) {
    UI.ctx(x, y, [{ label: this.temPub() ? (this.pubDesat(App.P) ? 'Atualizar no Publicações agora' : 'Atualizar no Publicações') : 'Pronto: pôr no Publicações', icon: 'upload', action: () => this.pronto() },
      { label: 'Abrir o Publicações', icon: 'right', action: () => window.open('/publicacoes/', '_blank', 'noopener') },
      App.P?.publicacoes?.id && '-', App.P?.publicacoes?.id && { label: 'Tirar do Publicações', icon: 'trash', danger: true, action: () => this.tirarPub() }].filter(Boolean));
  },
  async pronto() {
    const P = App.P; if (!P || this._prontoAndando) return;
    const pode = k => window.EstudioPerm?.pode?.(k) ?? true;
    if (!pode('animador.exportar') || !pode('publicacoes')) return this.pubBalao('Sua conta não pode mandar para o Publicações. Peça para um ADM liberar.', 'err');
    this._prontoAndando = true; this.pintaPub();
    try {
      try { await App.salvarJa?.(); } catch { }
      if (!NuvemAnim.vai(P)) {
        if (!await UI.confirm({ title: 'Mandar para a nuvem primeiro?', msg: 'Para o Publicações abrir esta animação e gerar o vídeo lá, ela precisa estar na nuvem da equipe.', ok: 'Mandar e continuar', icon: 'upload' })) return;
        try { await NuvemAnim.enviar(P); } catch (e) { return this.pubBalao('Não deu para mandar para a nuvem: ' + esc(e.message), 'err'); }
        if (!NuvemAnim.vai(P)) return this.pubBalao('A animação não foi para a nuvem.', 'err');
      } else if (NuvemAnim.sujo(P)) { try { await NuvemAnim.salvar(P); } catch { } } // a versão da nuvem é a que o Publicações abre
      let L; try { L = await (await Nuvem.pede('/publicacoes')).json(); } catch (e) { return this.pubBalao('Não consegui falar com o Publicações: ' + esc(e.message), 'err'); }
      const ant = P.publicacoes?.id ? (L.itens || []).find(x => x.id === P.publicacoes.id) : null;
      if (ant?.pedido) return this.pubBalao('Esta animação já está na fila do Publicações. <a href="/publicacoes/" target="_blank" rel="noopener">Abrir o Publicações</a>', 'warn');
      if (P.publicacoes?.id && !ant && !await UI.confirm({ title: 'Pôr no Publicações de novo?', msg: 'Esta animação já foi para o Publicações e saiu de "Não publicados" (foi postada ou tirada de lá). Pôr de novo?', ok: 'Pôr de novo' })) return;
      const id = ant ? ant.id : 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const qMini = App.q || 0, item = this.itemPub(P, ant, id, qMini);
      try { await Nuvem.pede('/publicacoes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item }) }); }
      catch (e) { return this.pubBalao('Não deu para pôr no Publicações: ' + esc(e.message), 'err'); }
      if (App.P === P) { P.publicacoes = { id, em: Date.now(), mod: P.modificado || Date.now(), q: qMini }; try { await App.salvarJa?.(); } catch { } }
      this._prontoAndando = false; this.pintaPub();
      this.pubBalao(`<b>${ant ? 'Atualizada no Publicações' : 'Já está no Publicações'}</b><small>${esc(P.nome || 'Animação')} · em Não publicados (${item.formato === 'short' ? 'Shorts' : 'Vídeos longos'})</small><span class="pub-balao-acoes"><a class="btn sm" href="/publicacoes/" target="_blank" rel="noopener">Abrir o Publicações</a><button class="btn sm" data-tirar title="Não quero lá: tirar de Não publicados">Tirar de lá</button></span>`);
      { const t = document.querySelector('.pub-balao [data-tirar]'); if (t) t.onclick = () => { document.querySelector('.pub-balao')?.remove(); this.tirarPub(); }; }
    } finally { this._prontoAndando = false; this.pintaPub(); }
  },
  // carrega o módulo comum do Estúdio só quando a pessoa clica (o porteiro troca o ID do cliente do Google dentro dele)
  youtube() { return window.EstudioYouTube ? Promise.resolve() : (this._yt ||= new Promise((ok, ruim) => { const s = document.createElement('script'); s.src = '/estudio-youtube.js'; s.onload = ok; s.onerror = () => { this._yt = null; ruim(new Error('não consegui carregar o /estudio-youtube.js')); }; document.head.appendChild(s); })); },
  // LEGENDAS PARA O YOUTUBE (pedido da dona, 09/11/2026): .srt em UTF-8, com o tempo contado do começo do trecho; os asteriscos de destaque saem
  srt(P, de, ate) { const fps = P.fps, NL = String.fromCharCode(10), tc = s => { const t = Math.round(s * 1000), p = (n, l = 2) => String(n).padStart(l, '0'); return `${p(Math.floor(t / 3600000))}:${p(Math.floor(t / 60000) % 60)}:${p(Math.floor(t / 1000) % 60)},${p(t % 1000, 3)}`; };
    const L = (P.legendas || []).filter(g => g.ate >= de && g.de <= ate).sort((a, b) => a.de - b.de).map(g => ({ a: Math.max(g.de, de) - de, z: Math.min(g.ate, ate) + 1 - de, t: String(g.texto || '').replace(/[*]/g, '').split(NL).map(x => x.trim()).filter(Boolean).join(NL) })).filter(x => x.t && x.z > x.a);
    return { n: L.length, txt: L.map((x, i) => [i + 1, `${tc(x.a / fps)} --> ${tc(x.z / fps)}`, x.t, ''].join(NL)).join(NL) }; },
  limites(P, cfg) { const ult = P.duracao - 1; if (cfg.trecho === 'marcado' && Folha.trecho) return [Folha.trecho.de, Math.min(ult, Folha.trecho.ate)]; if (cfg.trecho === 'quadros') return [clamp(cfg.de, 0, ult), clamp(cfg.ate, cfg.de, ult)]; return [0, ult]; },
  nomeArq(P, cfg, ext) { return safeName((cfg.nomeProj ? P.nome : (cfg.nome || '').trim()) || P.nome || 'Animação') + ext; },
  // exporta travando a janela (não fecha até acabar; Cancelar para no meio)
  async rodar(P, cfg, body, api, o) {
    const ext = { mp4: '.mp4', png: '.png', wav: '.wav', animador: '.animador', srt: '.srt' }[cfg.tipo], nome = this.nomeArq(P, cfg, ext);
    if (cfg.tipo === 'srt') { const [a, z] = this.limites(P, cfg), r = this.srt(P, a, z); if (!r.n) { UI.toast('Não há legendas neste trecho.', { kind: 'err' }); return false; } downloadBlob(new Blob([r.txt], { type: 'application/x-subrip;charset=utf-8' }), nome); UI.toast(`<b>${esc(nome)}</b> baixado. No YouTube: Legendas › Adicionar › Enviar arquivo.`, { kind: 'ok' }); return true; }
    if (cfg.tipo === 'png') { await this.png(nome); return true; }
    if (cfg.tipo === 'animador') { const b = await Toon.montar(P); downloadBlob(b, nome); UI.toast(`<b>${esc(nome)}</b> baixado.`, { kind: 'ok' }); return true; }
    const [de, ate] = this.limites(P, cfg), foot = api.foot, prog = $('.exp-prog', body), t0 = performance.now(); let cancelou = false;
    // TRAVA: sem Esc, sem clique fora, sem X; os botões viram "Cancelar"
    o.noClose = true; api.el.classList.add('exportando'); $$('.exp-sec, .exp-tipos', body).forEach(s => s.classList.add('travado')); prog.hidden = false; $('.exp-fim', body).hidden = true;
    const btns = [...foot.querySelectorAll('.btn')]; btns.forEach(b => b.hidden = true);
    const cancel = h(`<button class="btn danger">${ic('x', 14)} Cancelar a exportação</button>`); cancel.onclick = () => { cancelou = true; cancel.disabled = true; cancel.textContent = 'Cancelando…'; }; foot.appendChild(cancel);
    const sair = e => { e.preventDefault(); e.returnValue = ''; }; addEventListener('beforeunload', sair);
    const pr = (f, txt) => { const s = (performance.now() - t0) / 1000; $('.exp-barra i', body).style.width = (f * 100).toFixed(1) + '%'; $('[data-pp]', body).textContent = Math.floor(f * 100) + '%'; $('[data-pt]', body).textContent = txt || '';
      $('[data-pr]', body).textContent = `${this.dur(s)} passado${f > .03 && f < 1 ? ` · falta cerca de ${this.dur(s / f - s)}` : ''}`; this._pub?.diz({ tipo: 'ep-exp-prog', f, txt: txt || '' }); if (cancelou || this._pub?.cancelou) throw new Error('cancelado'); };
    const solta = () => { o.noClose = false; api.el.classList.remove('exportando'); $$('.travado', body).forEach(s => s.classList.remove('travado')); cancel.remove(); btns.forEach(b => b.hidden = false); removeEventListener('beforeunload', sair); };
    try {
      const blob = cfg.tipo === 'wav' ? await this.wav(P, de, ate, pr, cfg.nivelar !== false) : await this.mp4({ q: cfg.q, de, ate, qual: cfg.qual, mbps: cfg.qual === 'custom' ? cfg.mbps : null, som: cfg.som, semLegenda: !cfg.leg, nivelar: cfg.nivelar !== false, pr });
      const pub = !!this._pub && cfg.tipo === 'mp4'; // pelo Publicações: o vídeo vai para lá, sem baixar
      if (pub) await this.entregaPub(blob, nome, (cfg.nomeProj ? P.nome : cfg.nome) || P.nome); else downloadBlob(blob, nome); const seg = (ate - de + 1) / P.fps, mb = blob.size / 1048576;
      solta(); prog.hidden = true; const fim = $('.exp-fim', body); fim.hidden = false;
      fim.innerHTML = `${ic('check', 18)}<div><b>${esc(nome)}</b><small>${this.dur(seg)} de vídeo · ${mb < 10 ? mb.toFixed(1).replace('.', ',') : Math.round(mb)} MB · pronto em ${this.dur((performance.now() - t0) / 1000)}</small></div><button class="btn sm">${ic('download', 13)} Baixar de novo</button>`;
      $('button', fim).onclick = () => downloadBlob(blob, nome); UI.toast(`<b>${esc(nome)}</b> exportado!`, { kind: 'ok' });
      // PUBLICAR NO YOUTUBE (05/11/2026): só vídeo, só para quem pode exportar no Animador e publicar no Publicações; leva o vídeo para /publicacoes/ (lá escolhe canal, título, modo)
      const pode = k => window.EstudioPerm?.pode?.(k) ?? true, titulo = (cfg.nomeProj ? P.nome : cfg.nome) || P.nome;
      if (!pub && cfg.tipo === 'mp4' && pode('animador.exportar') && pode('animador.youtube') && pode('publicacoes.publicar')) {
        const yt = h(`<button class="btn sm primary">${ic('upload', 13)} Publicar no YouTube</button>`); fim.appendChild(yt);
        yt.onclick = async () => { yt.disabled = true; try { await this.youtube(); await EstudioYouTube.levar({ blob, nome, titulo, programa: 'animador' }); } catch (e) { UI.toast('Não deu para levar ao Publicações: ' + esc(e.message), { kind: 'err' }); } yt.disabled = false; };
      }
      // CONCLUÍDO (05/11/2026): o vídeo vai para "Não publicados" do Publicações (a equipe vê; publica agora ou depois)
      if (!pub && cfg.tipo === 'mp4' && pode('animador.exportar') && pode('publicacoes')) {
        const cc = h(`<button class="btn sm">${ic('check', 13)} Marcar como concluído</button>`); fim.appendChild(cc);
        cc.onclick = async () => { cc.disabled = true; try { await this.youtube(); await EstudioYouTube.levar({ blob, nome, titulo, programa: 'animador', concluir: true, abrir: P.id && typeof NuvemAnim !== 'undefined' && NuvemAnim.vai?.(P) ? '/animador/?nuvem=' + encodeURIComponent(P.id) : '/animador/' }); } catch (e) { UI.toast('Não deu para marcar como concluído: ' + esc(e.message), { kind: 'err' }); } cc.disabled = false; };
      }
    } catch (e) { solta(); if (cancelou || e.message === 'cancelado') { prog.hidden = true; UI.toast('Exportação cancelada.'); } else $('[data-pt]', body).textContent = 'Não deu: ' + e.message; }
    return false; // a janela fica aberta (mostra o resultado)
  },
  // só o som (WAV) do trecho
  async wav(P, de, ate, pr, nivelar = true) { pr?.(.1, 'Misturando o som…'); const mix = await Som.mistura(P, 48000), a = Math.round(de / P.fps * 48000), z = Math.min(mix.length, Math.round((ate + 1) / P.fps * 48000));
    pr?.(.5, nivelar ? 'Nivelando o volume…' : 'Segurando os picos…'); await Som.masteriza(mix, { nivelar, ini: a, fim: z }); // −14 LUFS (opcional) e pico em −1 dBTP
    const ac = new OfflineAudioContext(2, Math.max(1, z - a), 48000), b = ac.createBuffer(2, Math.max(1, z - a), 48000); for (let c = 0; c < 2; c++) b.getChannelData(c).set(mix.getChannelData(Math.min(c, mix.numberOfChannels - 1)).subarray(a, z)); pr?.(1, 'Pronto'); return Som.wav(b); },
  async png(nome) { const P = App.P, c = document.createElement('canvas'); c.width = P.w; c.height = P.h; const comVideo = CenarioVideo.tem(P);
    if (comVideo) await CenarioVideo.prepara(P, App.q); CenarioVideo.emExport = comVideo; try { Render.quadro(c.getContext('2d'), P, App.q, P.w, P.h); } finally { CenarioVideo.emExport = false; CenarioVideo.solta('exp'); } // cenário em vídeo: o quadro exato
    return new Promise(ok => c.toBlob(b => { downloadBlob(b, nome || `${safeName(P.nome)} - quadro ${App.q + 1}.png`); ok(); }, 'image/png')); },
  folga() { return new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); }); },
  async h264(w, h, fps, k = .12) {
    if (!window.VideoEncoder) return null; const px = w * h, lv = px <= 414720 ? ['1E', '1F', '28'] : px <= 921600 ? ['1F', '28', '2A'] : px <= 2228224 ? ['28', '2A', '32'] : ['33', '34'];
    // PROCESSADOR PRIMEIRO (09/11/2026): a placa de vídeo dava ao quadro principal o mesmo espaço de um quadro comum (29 KB contra 86 KB no teste, com o mesmo bitrate) e a imagem borrava de 2 em 2 s
    for (const hw of ['prefer-software', 'no-preference', 'prefer-hardware']) for (const L of lv) for (const pf of ['6400', '4D00', '42E0']) {
      const cfg = { codec: 'avc1.' + pf + L, width: w, height: h, bitrate: Math.round(px * fps * k), framerate: fps, hardwareAcceleration: hw, avc: { format: 'avc' } };
      try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch { } }
    return null;
  },
  async mp4({ q = 1, de = 0, ate, pr, qual = 'max', mbps = null, som = true, semLegenda = false, nivelar = true }) {
    const P = App.P; App.pausa(); ate = clamp(ate ?? P.duracao - 1, de, P.duracao - 1);
    const W = Math.max(2, Math.round(P.w * q / 2) * 2), H = Math.max(2, Math.round(P.h * q / 2) * 2), fps = P.fps;
    const vcfg = await this.h264(W, H, fps, this.bps({ qual, mbps }, W, H, fps) / (W * H * fps)); if (!vcfg) throw new Error('Este navegador não grava MP4. Use o Chrome ou o Edge atualizado.');
    const temSom = som && (P.audios || []).length > 0; let acfg = null;
    if (temSom && window.AudioEncoder) for (const c of [{ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 192000 }, { codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 192000 }]) { try { if ((await AudioEncoder.isConfigSupported(c)).supported) { acfg = c; break; } } catch { } }
    const mux = new Mp4Mux({ video: { width: W, height: H, fps }, audio: acfg ? { sampleRate: acfg.sampleRate, channels: 2 } : null });
    const bytes = d => d instanceof Uint8Array ? d : d.buffer ? new Uint8Array(d.buffer, d.byteOffset, d.byteLength).slice() : new Uint8Array(d);
    let erro = null;
    // imagens de todos os personagens prontas antes de começar
    await Arq.garantir([...Object.values(P.personagens).flatMap(d => Modelo.chavesImgs(d)), ...Modelo.todos(P).filter(n => n.tipo === 'imagem').map(n => n.arq)]);
    if (acfg) {
      pr?.(0, 'Misturando o áudio…'); const mix = await Som.mistura(P, acfg.sampleRate), ini = Math.round(de / fps * acfg.sampleRate), fim = Math.min(mix.length, Math.round((ate + 1) / fps * acfg.sampleRate));
      pr?.(0, nivelar ? 'Nivelando o volume…' : 'Segurando os picos…'); await Som.masteriza(mix, { nivelar, ini, fim }); // −14 LUFS (opcional) e pico em −1 dBTP (pedido da dona, 12/11/2026)
      const ae = new AudioEncoder({ output: (ch, meta) => { if (meta?.decoderConfig?.description) mux.setAudioConfig(bytes(meta.decoderConfig.description)); const d = new Uint8Array(ch.byteLength); ch.copyTo(d); mux.addAudio(d, Math.round((ch.duration || 0) * acfg.sampleRate / 1e6) || 1024); }, error: e => erro = e });
      ae.configure(acfg); const Lc = mix.getChannelData(0), Rc = mix.numberOfChannels > 1 ? mix.getChannelData(1) : Lc;
      for (let o = ini; o < fim; o += 4800) { const n = Math.min(4800, fim - o), dt = new Float32Array(n * 2); dt.set(Lc.subarray(o, o + n), 0); dt.set(Rc.subarray(o, o + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: acfg.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((o - ini) / acfg.sampleRate * 1e6), data: dt }); ae.encode(ad); ad.close(); if (ae.encodeQueueSize > 20) await this.folga(); }
      await ae.flush(); ae.close(); if (erro) throw erro;
    }
    const cv = new OffscreenCanvas(W, H), ctx = cv.getContext('2d'), n = ate - de + 1, gop = fps * 4; // um quadro principal a cada 4 s
    const ve = new VideoEncoder({ output: (ch, meta) => { if (meta?.decoderConfig?.description) mux.setVideoConfig(bytes(meta.decoderConfig.description)); const d = new Uint8Array(ch.byteLength); ch.copyTo(d); mux.addVideo(d, ch.type === 'key'); }, error: e => erro = e });
    ve.configure(vcfg); const comVideo = CenarioVideo.tem(P);
    try {
    for (let i = 0; i < n; i++) {
      if (erro) throw erro; if (comVideo) await CenarioVideo.prepara(P, de + i); // cenário em vídeo: espera o quadro EXATO (seek) antes de desenhar
      CenarioVideo.emExport = comVideo; try { Render.quadro(ctx, P, de + i, W, H, { semLegenda }); } finally { CenarioVideo.emExport = false; }
      const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) }); ve.encode(vf, { keyFrame: i % gop === 0 }); vf.close();
      while (ve.encodeQueueSize > 4) await this.folga();
      if (i % 4 === 0) { pr?.((i + 1) / n * .98, `Quadro ${i + 1} de ${n} · ${this.tc((de + i) / fps)} de ${this.tc((ate + 1) / fps)}`); await this.folga(); }
    }
    } finally { CenarioVideo.solta('exp'); } // os <video> do export saem da memória
    await ve.flush(); ve.close(); if (erro) throw erro;
    pr?.(.99, 'Montando o arquivo…'); const blob = mux.finish(); pr?.(1, 'Pronto'); return blob;
  },
};
