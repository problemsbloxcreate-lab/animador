/* ===================== short.js — etapas de edição do SHORT (decisão do dono, 26/10/2026) =====================
   O motor é o MESMO do programa Shorts: /estudio-edicao.js (EstudioEdicao, servido pelo porteiro na raiz do endereço único).
   Aqui fica só a ligação com o Animador: a tela, os dados do projeto e o gosto aprendido do 2D.

   VOZ (aba Ideias › Vozes e etapa Voz): os áudios (um com tudo, ou um por personagem) são limpos, ouvidos pelo Whisper no navegador e
     casados com o roteiro; sem Whisper, divididos pelas pausas e pelo tom de cada voz. Cada fala vira o seu corte, com as folgas do
     PROTOCOLO (0,03 s antes, 0,08 s depois) e a conferência (sem voz, silêncio na ponta, palavra cortada, voz de outro personagem).
     R.vozes[falaId] = { k, dur, pal: [[palavra, ini, fim]] (s desde o começo do corte), aviso: [...], auto: true }
   LEGENDAS: blocos de 1 linha (22 letras / 4 palavras), marcas de número, palavra-chave e nome, tempo de cada palavra pelo Whisper.
     P.legendas[i] = { de, ate, texto, cor, quem, blocos: [[[palavra, ini, fim, marca]]], chaves, qcor: {Nome: cor}, auto: {texto, chaves}, dono? }
   GOSTO (separado do Minecraft): turma-ia /gosto?de=animador = { trocas, destacar, naoDestacar }. Só muda quando o dono APROVA a etapa.
   ETAPAS: barra no modo Vídeo da timeline (projeto vertical): Voz · Cenas · Legendas · Sons · Revisar. Nada prende: o editor
     continua livre por baixo (modo livre). P.short = { v: 1, etapas: { voz, legendas }, avisos: [{ q, texto, aviso }] } */
const Short = {
  EE() { const E = window.EstudioEdicao; if (!E) throw new Error('o motor de edição do estúdio não carregou (recarregue a página)'); return E; },
  ETAPAS: [['voz', 'Voz', 'mic'], ['cenas', 'Cenas', 'film', true], ['legendas', 'Legendas', 'text'], ['sons', 'Sons', 'music', true], ['revisar', 'Revisar', 'check']],

  // ---------- GOSTO APRENDIDO (2D) ----------
  gosto: null,
  async carregaGosto() {
    if (this.gosto) return this.gosto;
    let g = null; try { const r = await fetch(Nuvem.srv + '/gosto?de=animador', { headers: await Nuvem.hd() }); if (r.ok) g = (await r.json()).gosto; } catch { }
    if (!g) g = await DB.get('arquivos', 'gosto:animador').catch(() => null);
    return (this.gosto = Object.assign({ trocas: {}, destacar: [], naoDestacar: [] }, g || {}));
  },
  async salvaGosto() {
    const g = this.gosto; if (!g) return; await DB.put('arquivos', clone(g), 'gosto:animador').catch(() => { });
    try { const r = await fetch(Nuvem.srv + '/gosto?de=animador', { method: 'PUT', headers: { 'content-type': 'application/json', ...(await Nuvem.hd()) }, body: JSON.stringify({ gosto: g }) }); if (!r.ok) throw 0; return true; }
    catch { UI.toast('O gosto aprendido ficou só neste computador (a nuvem não respondeu). Ele vai para a nuvem na próxima aprovação.', { kind: 'warn' }); return false; }
  },

  // ---------- VOZ: decupagem pelo motor do Shorts ----------
  /* blobs = áudios (um com tudo ou um por personagem); F = falas do roteiro na ordem ({id, personagem, texto, acao}).
     Grava em R.vozes o corte de cada fala achada. Devolve { achadas, total, avisos, modo } */
  async decupar(R, blobs, F) {
    const E = this.EE(), fim = Ocupado.inicio({ tipo: 'voz', titulo: 'Decupando as vozes', subtitulo: 'Abrindo os áudios…' });
    try {
      const bufs = [];
      for (const b of blobs) { const k = await Arq.guardar(b), x = await Som.decod(k).catch(() => null); if (!x) throw new Error(`o áudio “${b.name || 'sem nome'}” não abriu`); bufs.push(x); }
      Ocupado.passo('Limpando o áudio (ruído, volume igual, limite de pico)…');
      const limpos = []; for (const b of bufs) { limpos.push((await E.voz.limpar(b)).buf); await cede(); }
      const buf = limpos.length > 1 ? E.voz.junta(limpos).buf : limpos[0];
      const falas = F.map(f => ({ quem: f.personagem, texto: f.texto, nota: f.acao || '' }));
      Ocupado.passo('Procurando as falas e as pausas…'); await cede();
      const mp = E.voz.mapa(buf), dec = E.voz.decupar(buf, falas);
      if (!mp.blobs.length) throw new Error('não achei voz nesses áudios');
      let al = null, modo = 'pausas';
      try { const ouv = await E.whisper.transcrever(buf, pg => { const t = E.whisper.frase(pg); if (t) Ocupado.passo(t); if (pg.st === 'dl') Ocupado.parte(pg.d, pg.total); else if (pg.st === 'asr') Ocupado.parte(pg.i, pg.n); });
        if (ouv.length) { al = E.voz.alinhar(ouv, mp.blobs, falas); modo = 'whisper'; } }
      catch (e) { UI.toast(`O reconhecedor de fala não rodou (${esc(e.message || e)}). Cortei pelas pausas e pelo tamanho do texto: confira cada fala.`, { kind: 'warn', time: 9000 }); }
      // cada fala: o corte do Whisper; se ele não achou a fala, o das pausas
      let cortes = F.map((f, i) => (al?.cortes[i]) || (dec?.cortes[i]) || null);
      cortes = E.voz.apara(cortes, buf);
      const conf = E.voz.confere(buf, cortes, F.map(f => f.texto), dec?.aviso), av = {}; conf.forEach(x => (av[x.i] ||= []).push(x.aviso));
      F.forEach((f, i) => { if (al && !al.cortes[i] && cortes[i]) (av[i] ||= []).push('o reconhecedor não ouviu esta fala (cortei pelas pausas)'); });
      Ocupado.passo('Cortando uma fala de cada vez…'); let achadas = 0;
      for (let i = 0; i < F.length; i++) { const c = cortes[i], f = F[i]; if (!c) { (av[i] ||= []); continue; }
        const k = await Arq.guardar(Som.wav(E.voz.corta(buf, c[0], c[1])));
        const pal = al?.palavras[i]?.length ? al.palavras[i].map(([w, a, b]) => [w, +Math.max(0, a - c[0]).toFixed(3), +Math.max(0, b - c[0]).toFixed(3)]) : null;
        R.vozes[f.id] = { k, dur: +(c[1] - c[0]).toFixed(3), auto: true, ...(pal ? { pal } : {}), ...(av[i]?.length ? { aviso: [...new Set(av[i])] } : {}) }; achadas++; }
      R.decup = { em: Date.now(), modo, achadas, total: F.length, tons: dec?.tons || {} }; await Ideias.guarda(R);
      return { achadas, total: F.length, avisos: Object.values(av).filter(x => x.length).length, modo };
    } finally { fim(); }
  },

  // ---------- tempo das falas no vídeo: uma depois da outra com a pausa do protocolo ----------
  pausa(a, b) { try { return this.EE().protocolo.pausaEntre({ quem: a.personagem, texto: a.texto, nota: a.acao }, { quem: b.personagem, texto: b.texto }); } catch { return .15; } },

  // ---------- LEGENDAS ----------
  /* item de legenda pelo motor: fala {texto, personagem}, de/ate em quadros, tempos ouvidos (s desde o começo da fala) */
  legenda(P, { texto, de, ate, cor, quem, tempos, chaves, nomes, qcor }) {
    const E = this.EE(), g = this.gosto || {}, fps = P.fps, t = E.legendas.boa(texto, g), ch = chaves || E.legendas.chavesDe(t, g);
    const r = E.legendas.gera({ texto: t, d: (ate - de + 1) / fps, nomes, chaves: ch, tempos });
    return { de, ate, texto: r.blocos.map(b => b.map(p => p[0]).join(' ')).join(' '), cor, quem, blocos: r.blocos, chaves: ch, qcor, auto: { texto: r.texto, chaves: ch } };
  },
  nomesCores(P) { const o = {}; for (const d of Object.values(P.personagens || {})) if (d?.nome) o[d.nome] = d.cor || '#fff'; return o; },
  /* texto para editar: blocos separados por " / ", palavras-chave entre *asteriscos* */
  textoEditavel(l) { if (!l.blocos?.length) return l.texto || ''; return l.blocos.map(b => { let s = '', dentro = false; b.forEach((p, i) => { const d = p[3] === 'd'; if (d && !dentro) { s += (i ? ' ' : '') + '*'; dentro = true; } else if (!d && dentro) { s += '*'; dentro = false; s += ' '; } else if (i) s += ' '; s += p[0]; }); return s + (dentro ? '*' : ''); }).join(' / '); },
  /* o dono mudou o texto: refaz os blocos (mantém os tempos ouvidos das palavras que continuam iguais) */
  editaLegenda(P, l, txt) {
    const E = this.EE(), chaves = [], limpo = String(txt).replace(/\*([^*]+)\*/g, (m, w) => { chaves.push(w.trim()); return w; }).trim();
    const tempos = (l.blocos || []).flat().map(p => [p[0], p[1], p[2]]), qc = l.qcor || this.nomesCores(P);
    const r = E.legendas.gera({ texto: limpo, d: (l.ate - l.de + 1) / P.fps, nomes: Object.keys(qc), chaves, tempos });
    Object.assign(l, { blocos: r.blocos, chaves, texto: r.blocos.map(b => b.map(p => p[0]).join(' ')).join(' '), dono: 1 });
  },
  /* converte as legendas comuns do projeto (Transcrever ou à mão) em blocos pelo motor; as que o dono já mudou ficam */
  async refazerLegendas(P, { todas } = {}) {
    await this.carregaGosto(); const qc = this.nomesCores(P), nomes = Object.keys(qc); let n = 0;
    for (const l of P.legendas || []) { if (l.dono && !todas) continue;
      const base = l.auto?.texto ? l.auto.texto.replace(/\s*\/\s*/g, ' ') : String(l.texto || '').replace(/\*/g, '');
      const tempos = l.blocos?.length ? l.blocos.flat().map(p => [p[0], p[1], p[2]]) : l.pal?.length ? l.pal.map(w => [w[0], (w[1] - l.de) / P.fps, (w[2] - l.de + 1) / P.fps]) : null;
      Object.assign(l, this.legenda(P, { texto: base, de: l.de, ate: l.ate, cor: l.cor, quem: l.quem, tempos, nomes, qcor: qc })); delete l.dono; delete l.pal; n++; }
    P.legEstilo = { ...(P.legEstilo || {}), blocos: true, karaoke: false, pop: false };
    return n;
  },
  /* aprovar: o que o dono mudou vira gosto (nomes certos, palavras-chave) */
  async aprovarLegendas(P) {
    const E = this.EE(), g = await this.carregaGosto(), fixos = Object.keys(this.nomesCores(P)), tudo = { destacar: [], naoDestacar: [], trocas: {} };
    for (const l of P.legendas || []) { if (!l.dono || !l.auto) continue;
      const ap = E.legendas.aprende(g, l.auto, { texto: this.textoEditavel(l).replace(/\*/g, ''), chaves: l.chaves || [] }, fixos);
      tudo.destacar.push(...ap.destacar); tudo.naoDestacar.push(...ap.naoDestacar); Object.assign(tudo.trocas, ap.trocas); }
    const mudou = tudo.destacar.length + tudo.naoDestacar.length + Object.keys(tudo.trocas).length; if (mudou) await this.salvaGosto();
    this.etapa(P).legendas = 'aprovado'; App.commit('Aprovar as legendas'); return tudo;
  },

  // ---------- RECORTE DA PASTA (Render.recorte) ----------
  RECORTES: [['', 'Sem recorte'], ['cima', 'Metade de cima'], ['baixo', 'Metade de baixo'], ['esq', 'Metade da esquerda'], ['dir', 'Metade da direita'], ['livre', 'Personalizado']],
  retDe(P, id) { const W = P.w, H = P.h, mh = Math.round(H / 2), mw = Math.round(W / 2);
    return { cima: { x: 0, y: 0, w: W, h: mh }, baixo: { x: 0, y: mh, w: W, h: H - mh }, esq: { x: 0, y: 0, w: mw, h: H }, dir: { x: mw, y: 0, w: W - mw, h: H } }[id] || null; },
  qualRecorte(P, r) { if (!r) return ''; for (const [id] of this.RECORTES) { const x = this.retDe(P, id); if (x && x.x === r.x && x.y === r.y && x.w === r.w && x.h === r.h) return id; } return 'livre'; },
  nomeRecorte(P, r) { return (this.RECORTES.find(x => x[0] === this.qualRecorte(P, r)) || [])[1] || ''; },
  painelRecorte(P, n) {
    const cur = this.qualRecorte(P, n.recorte), el = h(`<div><div class="campo2"><span style="color:var(--tx2)">Mostrar só</span><select data-r>${this.RECORTES.map(([id, nm]) => `<option value="${id}" ${cur === id ? 'selected' : ''}>${nm}</option>`).join('')}</select></div><div class="pr-num-grade" data-livre></div><small style="color:var(--tx3)">Só aparece o que está dentro do retângulo (px do vídeo, preso na tela: a câmera não move o recorte).</small></div>`);
    $('[data-r]', el).onchange = ev => { const id = ev.target.value; if (!id) delete n.recorte; else n.recorte = id === 'livre' ? { ...(n.recorte || this.retDe(P, 'cima')) } : this.retDe(P, id); App.commit('Recorte da pasta'); };
    if (n.recorte) { const g = $('[data-livre]', el), r = n.recorte, ok = () => App.commit('Recorte da pasta');
      [['X', 'x'], ['Y', 'y'], ['Largura', 'w'], ['Altura', 'h']].forEach(([nm, k]) => g.appendChild(Lado.num(nm, r[k], { passo: 1, dec: 0, unid: 'px', min: k === 'w' || k === 'h' ? 1 : -99999 }, v => { r[k] = Math.round(v); App.pinta(); }, ok))); }
    return el;
  },

  // ---------- DIREÇÃO DO VÍDEO (Gerar o vídeo): tela inteira ou DIVIDIDA NO MEIO (uma metade a história, a outra quem narra) ----------
  // R.opcoes: layout 'cheia'|'dividida', cima 'historia'|'narracao', narrador (id do personagem), direcao (texto livre que vai para a IA em cada cena)
  painelDirecao(R, guarda) {
    const o = R.opcoes ||= {}, lay = o.layout || 'cheia', fala = {}; for (const f of Ideias.falas(R)) { const p = Ideias.persDe(R, f.personagem); if (p) fala[p.id] = (fala[p.id] || 0) + 1; }
    const narr = o.narrador || Object.keys(fala).sort((a, b) => fala[b] - fala[a])[0] || R.pers[0]?.id;
    const el = h(`<div class="sh-dir"><div class="ide-sec">${ic('film', 13)} <b>Direção do vídeo</b><small>como a história aparece na tela</small></div>
      <div class="sh-lay">${[['cheia', 'Tela inteira', '<rect x="5" y="2" width="14" height="20" rx="2"/>'], ['dividida', 'Dividida no meio', '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 12h14"/>']].map(([id, nm, sv]) => `<button data-lay="${id}" class="${lay === id ? 'on' : ''}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${sv}</svg><span>${nm}</span></button>`).join('')}</div>
      ${lay === 'dividida' ? `<div class="campo2 sh-div"><span>Em cima</span><select data-cima><option value="historia">a história (quem vive)</option><option value="narracao" ${o.cima === 'narracao' ? 'selected' : ''}>quem narra</option></select>
        <span>Quem narra</span><select data-narr>${R.pers.map(p => `<option value="${esc(p.id)}" ${p.id === narr ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
        <div class="campo2 sh-div"><span>Cenário de quem narra</span><b>${esc(o.cenNarr?.nome || 'Planetário do Problems')}</b><button class="btn sm" data-cnarr>${ic('paisagem', 13)} Trocar…</button><span>Zoom</span><select data-zoom>${[1.5, 2, 2.5, 3].map(z => `<option value="${z}" ${(o.zoomNarr || 2) === z ? 'selected' : ''}>${String(z).replace('.', ',')}×</option>`).join('')}</select></div>
        <small class="sh-dica">Cada metade tem 1080×960, com a linha exatamente no meio. Quem narra fala para a câmera com a boca pela voz, de perto, atrás da mesa do cenário dela; na outra metade o mesmo personagem VIVE a história, no cenário de cada lugar (passo Cenários). A legenda fica na linha do meio.</small>` : ''}
      <textarea rows="2" data-txt placeholder="Direção para a IA (opcional). Ex.: em cima a Lumi vive a história, embaixo ela conta para a câmera; mostre as flores, o tapão e o pônei quando ela falar deles.">${esc(o.direcao || '')}</textarea></div>`);
    $$('[data-lay]', el).forEach(b => b.onclick = () => { o.layout = b.dataset.lay; if (o.layout === 'dividida') { o.cima ||= 'historia'; o.narrador ||= narr; } guarda(true); });
    if ($('[data-cima]', el)) $('[data-cima]', el).onchange = ev => { o.cima = ev.target.value; guarda(); };
    if ($('[data-cnarr]', el)) $('[data-cnarr]', el).onclick = async () => { const e = await CenLib.abrir({ escolher: { roteiro: R.id, lugar: 'narração', visual: 'onde quem narra conta a história para a câmera', atual: o.cenNarr || null } }); if (e) { o.cenNarr = e; guarda(true); } };
    if ($('[data-zoom]', el)) $('[data-zoom]', el).onchange = ev => { o.zoomNarr = +ev.target.value; guarda(); };
    if ($('[data-narr]', el)) $('[data-narr]', el).onchange = ev => { o.narrador = ev.target.value; guarda(); };
    $('[data-txt]', el).onchange = ev => { o.direcao = ev.target.value.trim(); guarda(); };
    return el;
  },
  // monta a tela dividida depois que os personagens de cada cena foram criados (nos[ci][persId] = nó). Muda o projeto P (ainda não aberto).
  aplicaLayout(P, R, cenas, defs, nos) {
    const o = R.opcoes || {}; if (o.layout !== 'dividida') return null;
    const W = P.w, rH = this.retDe(P, o.cima === 'narracao' ? 'baixo' : 'cima'), rN = this.retDe(P, o.cima === 'narracao' ? 'cima' : 'baixo');
    const narr = R.pers.find(p => p.id === o.narrador) || R.pers[0]; if (!narr) return null;
    const caixa = def => { const b = Modelo.caixaPersonagem(def, Modelo.partesNoEstado(def, {})); return b.h > 0 ? b : { x: -150, y: -500, w: 300, h: 500 }; }, altura = def => caixa(def).h;
    const pH = Modelo.novoNo('pasta', { nome: 'História' }), pN = Modelo.novoNo('pasta', { nome: 'Narração' }); pH.recorte = rH; pN.recorte = rN; pH.aberto = pN.aberto = false;
    // quem VIVE a história: os nós das cenas vão para a metade da história, no tamanho dela
    const movidos = new Set();
    cenas.forEach((cn, ci) => { const ids = Object.keys(nos[ci] || {}); ids.forEach((pid, i) => { const n = nos[ci][pid], def = defs[pid], s = round(clamp(rH.h * .62 / altura(def), .05, 4), 3), k = n.chaves[cn.de];
      const bx = caixa(def); Object.assign(k, { x: Math.round(W * (i + 1) / (ids.length + 1)), y: Math.round(rH.y + rH.h * .93 - (bx.y + bx.h) * s), s }); /* os pés a 93% da metade */ n.nome = `${R.pers.find(p => p.id === pid)?.nome || 'Personagem'} · história${cenas.length > 1 ? ' · cena ' + (ci + 1) : ''}`; movidos.add(n); }); });
    P.raiz = P.raiz.filter(n => !movidos.has(n)); pH.filhos.push(...movidos);
    // quem NARRA: um nó só, o vídeo inteiro, de frente para a câmera, com um fundo liso na metade dele
    const dN = defs[narr.id], bN = caixa(dN), sN = round(clamp(rN.h * .86 / bN.h, .05, 4), 3), nN = Modelo.novoNo('personagem', { ref: dN.id, nome: narr.nome + ' · narra', s: sN });
    nN.atuacao = { ...Atuacao.PADRAO }; nN.interp = true; nN.suaveP = true; nN.de = 0; nN.ate = null; nN.chaves = { 0: { x: Math.round(W / 2), y: Math.round(rN.y + rN.h * .98 - (bN.y + bN.h) * sN), r: 0, s: sN, sx: 1, op: 1 } };
    const fundo = Modelo.novoNo('forma', { nome: 'Fundo da narração', forma: 'ret', w: rN.w, h: rN.h, cor: '#26304f', x: Math.round(rN.x + rN.w / 2), y: Math.round(rN.y + rN.h / 2) });
    pN.filhos.push(nN, fundo);
    P.raiz.unshift(pH, pN);
    // a boca pela voz vai em quem narra (quem vive a história não dubla a narração)
    cenas.forEach((cn, ci) => { if (nos[ci]?.[narr.id]) nos[ci][narr.id] = nN; });
    P.short = Object.assign(P.short || { v: 1, etapas: {}, avisos: [] }, { layout: { tipo: 'dividida', historia: pH.id, narracao: pN.id, narrador: narr.id } });
    if (P.legEstilo) P.legEstilo.pos = 'meio';
    return { pH, pN, nN };
  },
  // CENÁRIO DE QUEM NARRA (tela dividida): o cenário escolhido (padrão: Planetário do Problems) entra só na metade da narração, com ZOOM,
  // e quem narra fica ATRÁS da mesa do cenário (a perna some atrás dela, como alguém falando para a câmera sentado/apoiado na mesa).
  // Precisa da animação aberta (CenLib.porNaCena). R.opcoes.cenNarr = escolha da biblioteca; R.opcoes.zoomNarr (padrão 2).
  async montaNarracao(R) {
    const P = App.P, L = P?.short?.layout; if (L?.tipo !== 'dividida') return;
    const o = R.opcoes || {}, pN = Modelo.achar(P, L.narracao)?.no, nN = pN?.filhos.find(n => n.tipo === 'personagem'); if (!pN || !nN) return;
    const def = await CenLib.resolve(o.cenNarr || { origem: 'casa', id: 'planetario', nome: 'Planetário do Problems' }).catch(() => null); if (!def) return UI.toast('O cenário de quem narra não abriu; ficou o fundo liso.', { kind: 'warn' });
    App.q = 0; const pasta = await CenLib.porNaCena(def); const i = P.raiz.indexOf(pasta); if (i >= 0) P.raiz.splice(i, 1);
    pasta.de = 0; pasta.ate = null; pasta.nome = 'Cenário da narração: ' + String(def.nome || '').slice(0, 24);
    const r = pN.recorte, CW = CenLib.W || 1920, CH = CenLib.H || 1080, cam = def.camadas || [];
    const mesa = cam.find(c => /mesa|balc|bancada/i.test(c.id + ' ' + c.nome)), foco = cam.find(c => /lumi|narr/i.test(c.id + ' ' + c.nome)) || mesa;
    // zoom: o cenário cobre a metade com folga; com mesa, a borda de cima dela fica a 88% da metade (close do cinto para cima) e o foco (onde o narrador fica) no meio
    let s = Math.max(r.w / CW, r.h / CH) * (o.zoomNarr || 2);
    const fx = foco ? foco.cx : CW / 2; let x = r.x + r.w / 2 - fx * s, y = mesa ? r.y + r.h * .88 - (mesa.cy - mesa.h / 2) * s : r.y + r.h / 2 - CH / 2 * s;
    x = clamp(x, r.x + r.w - CW * s, r.x); y = clamp(y, r.y + r.h - CH * s, r.y); // sem mostrar a borda do cenário
    for (const k of Object.values(pasta.chaves)) Object.assign(k, { s: round(s, 4), x: Math.round(x), y: Math.round(y) });
    for (const n of pasta.filhos) if (/^lumi$/i.test(n.camCen || '')) n.vis = false; // a Lumi desenhada no cenário sai: quem narra é a personagem de verdade
    // quem narra: CLOSE do cinto para cima (decisão do dono): dentro do cenário, atrás da mesa; o topo da mesa corta na cintura
    const k0 = nN.chaves[0], dN = App.P.personagens[nN.ref], b0 = Modelo.caixaPersonagem(dN, Modelo.partesNoEstado(dN, {})), b = b0.h > 0 ? b0 : { x: -150, y: -500, w: 300, h: 500 };
    const mesaTop = mesa ? y + (mesa.cy - mesa.h / 2) * s : r.y + r.h, topo = r.y + r.h * .15, hw = (mesaTop - topo) / .44, wx = r.x + r.w / 2, sc = hw / b.h; // sc = escala na tela
    // a origem do personagem pode ser o meio do corpo ou os pés: o topo da cabeça (b.y) vai para "topo" e o meio da largura para o centro
    Object.assign(k0, { x: round((wx - (b.x + b.w / 2) * sc - x) / s, 1), y: round((topo - b.y * sc - y) / s, 1), s: round(sc / s, 4) });
    pN.filhos = pN.filhos.filter(n => n !== nN && !/^Fundo da narração$/.test(n.nome));
    const im = pasta.filhos.findIndex(n => mesa && n.camCen === mesa.id); pasta.filhos.splice(im >= 0 ? im + 1 : 0, 0, nN);
    pN.filhos.push(pasta); App.commit('Cenário de quem narra');
  },
  // cenário que entrou na cena: na tela dividida vai para a metade da história, cobrindo só ela
  cenarioNoLayout(P, pasta) {
    const L = P.short?.layout; if (L?.tipo !== 'dividida' || !pasta) return;
    const pH = Modelo.achar(P, L.historia)?.no || P.raiz.find(n => n.id === L.historia); if (!pH) return;
    const r = pH.recorte, CW = 1920, CH = 1080, s = round(Math.max(r.w / CW, r.h / CH) * 1.02, 3);
    for (const k of Object.values(pasta.chaves || {})) Object.assign(k, { s, x: Math.round(r.x + r.w / 2 - CW / 2 * s), y: Math.round(r.y + r.h / 2 - CH / 2 * s) });
    const i = P.raiz.indexOf(pasta); if (i >= 0) P.raiz.splice(i, 1); pH.filhos.push(pasta); // atrás de quem vive a história
  },
  // o que a IA precisa saber em cada cena
  direcaoIA(R) {
    const o = R.opcoes || {}; let t = '';
    if (o.layout === 'dividida') { const narr = R.pers.find(p => p.id === o.narrador)?.nome || 'o narrador', cima = o.cima === 'narracao' ? 'narração' : 'história';
      t += `DIREÇÃO DO VÍDEO: TELA DIVIDIDA EXATAMENTE NO MEIO (pastas "História" e "Narração", cada uma com recorte; NÃO mexa nas pastas, no recorte nem no fundo da narração). Em cima: ${cima}; embaixo: ${cima === 'história' ? 'narração' : 'história'}.\n`
        + `- Na NARRAÇÃO, "${narr} · narra" conta para a câmera, de perto, atrás da mesa do cenário dela: só cabeça, expressões, olhos e gestos de braço de quem conta uma história; não sai do lugar nem sobe na mesa. A boca já está feita pela voz.\n`
        + `- Na HISTÓRIA, as camadas "· história" VIVEM o que está sendo contado naquele momento (toda coisa concreta citada vira imagem/ação; mostre a consequência). Sem dublar: a boca delas fica fechada ou reagindo.\n`
        + `- Câmera parada (cada metade é um quadro fixo).\n`; }
    if (o.direcao) t += `PEDIDO DO DONO PARA O VÍDEO TODO: ${o.direcao}\n`;
    return t ? t + '\n' : '';
  },
  // ---------- ETAPAS (barra no modo Vídeo) ----------
  etapa(P) { P.short ||= { v: 1, etapas: {}, avisos: [] }; P.short.etapas ||= {}; return P.short.etapas; },
  vertical(P) { return P && P.h > P.w; },
  liga() {
    if ($('#tl-short')) return; const ref = $('#tl-modo'); if (!ref) return;
    const bar = h('<div class="sh-etapas" id="tl-short" title="Etapas do Short (o editor continua livre)"></div>'); ref.after(bar); this.pinta();
  },
  pinta() {
    const bar = $('#tl-short'); if (!bar) return; const P = App.P, ver = this.vertical(P) && typeof Folha !== 'undefined' && Folha.modo === 'video';
    bar.hidden = !ver; if (!ver) return; const E = (P.short?.etapas) || {}, sig = JSON.stringify(E); if (bar._sig === sig) return; bar._sig = sig;
    bar.innerHTML = this.ETAPAS.map(([id, nm, icn, breve]) => `<button data-e="${id}" class="${E[id] === 'aprovado' ? 'ok' : ''} ${breve ? 'breve' : ''}" ${breve ? 'title="Em breve"' : ''}>${E[id] === 'aprovado' ? ic('check', 11) : ic(icn, 11)}<span>${nm}</span></button>`).join('');
    $$('[data-e]', bar).forEach(b => b.onclick = () => this.abre(b.dataset.e));
  },
  abre(id) {
    if (id === 'cenas' || id === 'sons') return UI.toast(id === 'cenas' ? 'As ideias de cena entram na próxima fase.' : 'A sonorização automática entra numa fase depois.', { kind: 'info' });
    if (id === 'revisar') return Revisor.abrir();
    if (id === 'voz') return this.abreVoz();
    if (id === 'legendas') return this.abreLegendas();
  },
  async abreVoz() {
    const P = App.P, av = P.short?.avisos || [];
    const lista = av.length ? `<div class="sh-lista">${av.map((a, i) => `<div class="sh-av"><span>${ic('alert', 12)}</span><div><b>${esc(a.aviso)}</b><small>“${esc(String(a.texto).slice(0, 70))}” · quadro ${a.q + 1}</small></div><button class="ibtn" data-ir="${i}" title="Ir até ela">${ic('jump', 13)}</button></div>`).join('')}</div>` : `<div class="pr-info">A conferência não achou nada nas falas.</div>`;
    const R = P.roteiro?.id ? await DB.get('arquivos', 'roteiro:' + P.roteiro.id).catch(() => null) : null;
    const corpo = h(`<div><p class="sh-dica">Cada fala foi cortada pelo protocolo da decupagem (0,03 s antes, 0,08 s depois, pausa de 0,10 s com a mesma pessoa e 0,15 s na troca).${R?.decup ? ` Feita ${R.decup.modo === 'whisper' ? 'ouvindo as falas com o reconhecedor' : 'pelas pausas e pelo tom das vozes'}: ${R.decup.achadas} de ${R.decup.total} falas achadas.` : ''}</p>${lista}<p class="sh-dica">Para acertar um corte, dê dois cliques no áudio na timeline. Para decupar de novo, abra o roteiro na aba Ideias › Vozes.</p></div>`);
    $$('[data-ir]', corpo).forEach(b => b.onclick = () => App.setQ(av[+b.dataset.ir].q));
    const r = await UI.modal({ title: 'Voz', icon: 'mic', width: 520, body: corpo, buttons: [{ label: 'Fechar', value: null }, { label: 'Aprovar a voz', kind: 'primary', value: 'ok' }] });
    if (r === 'ok') { this.etapa(P).voz = 'aprovado'; App.commit('Aprovar a voz'); this.pinta(); }
  },
  async abreLegendas() {
    const P = App.P, L = P.legendas || [], dono = L.filter(l => l.dono).length, semBlocos = L.filter(l => !l.blocos?.length).length;
    const corpo = h(`<div><p class="sh-dica">${L.length ? `${L.length} legenda(s)${dono ? `, ${dono} mudada(s) por você` : ''}.` : 'Sem legendas ainda.'} Cada fala vira blocos de uma linha (até 22 letras e 4 palavras), na cor de quem fala, sem piscar, com o tempo de cada palavra pela voz.</p>
      <p class="sh-dica">Para mudar, edite na aba Voz › Legendas: escreva <b>/</b> para quebrar e <b>*palavra*</b> para marcar uma palavra-chave. Ao aprovar, os nomes corrigidos e as palavras-chave viram regra para os próximos vídeos (só do Animador).</p></div>`);
    const r = await UI.modal({ title: 'Legendas', icon: 'text', width: 520, body: corpo, buttons: [{ label: 'Fechar', value: null }, ...(L.length ? [{ label: semBlocos ? 'Fazer pelo motor' : 'Refazer as automáticas', value: 'refaz', left: true }] : []), { label: 'Aprovar as legendas', kind: 'primary', value: 'ok' }] });
    if (r === 'refaz') { const n = await this.refazerLegendas(P); App.commit('Legendas pelo motor'); UI.toast(`${n} legenda(s) refeitas em blocos.${dono ? ' As que você mudou ficaram.' : ''}`, { kind: 'ok' }); }
    if (r === 'ok') { const a = await this.aprovarLegendas(P); this.pinta(); const t = Object.entries(a.trocas).map(([x, y]) => `${x} → ${y}`);
      UI.toast(`Legendas aprovadas.${t.length ? ` Nomes aprendidos: ${esc(t.join(', '))}.` : ''}${a.destacar.length ? ` Palavras-chave: ${esc(a.destacar.join(', '))}.` : ''}`, { kind: 'ok', time: 7000 }); }
  },
};
