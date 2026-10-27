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
