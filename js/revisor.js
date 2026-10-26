/* ===================== revisor.js — REVISOR (como o dos Shorts): confere a animação antes de exportar =====================
   Acha o que costuma passar batido (som depois do fim, voz cortando palavra, solo esquecido, duas músicas juntas, legenda longa demais ou
   uma em cima da outra, chave fora do vídeo, camada que nunca aparece, imagem que falta…) e oferece "Ir até lá" e o conserto em 1 clique.
   Abre pelo Exportar (que já mostra quantas coisas achou) e pelo botão direito na régua da timeline. Nada muda sem clicar. */
'use strict';
const Revisor = {
  async achar(P) {
    const out = [], fim = P.duracao - 1, fps = P.fps, poe = (nivel, txt, q, consertos = [], sel) => out.push({ nivel, txt, q, consertos, sel });
    for (const a of P.audios || []) await Som.decod(a.arq);
    const auds = (P.audios || []).filter(a => Som.buf.get(a.arq)), ouvidos = auds.filter(a => Som.ouve(P, a));
    // ÁUDIO
    for (const a of auds) {
      const de = a.de || 0, fq = Som.fimQ(P, a), nome = `"${a.nome}"`;
      if (de > fim) poe('erro', `O áudio ${nome} começa depois do fim do vídeo (não vai tocar).`, fim, [{ rotulo: 'Trazer para o começo', fn: () => { a.de = 0; } }, { rotulo: 'Aumentar o vídeo', fn: () => { P.duracao = fq + 1; } }], a.id);
      else if (fq > fim) poe('aviso', `O áudio ${nome} passa ${((fq - fim) / fps).toFixed(1).replace('.', ',')} s do fim do vídeo (vai ser cortado).`, fim, [{ rotulo: 'Aumentar o vídeo', fn: () => { P.duracao = fq + 1; } }, { rotulo: 'Cortar no fim', fn: () => { a.dur = round((fim - de + 1) / fps, 3); a.fo = a.fo || (Som.tipo(a) === 'musica' ? 1 : .15); } }], a.id);
      if (Som.tipo(a) === 'musica' && !a.fo && Som.ouve(P, a)) poe('dica', `A música ${nome} termina seca. Um fade no fim fica mais bonito.`, Math.min(fim, fq), [{ rotulo: 'Fade de 1 s', fn: () => { a.fo = 1; } }], a.id);
      if (Som.tipo(a) === 'voz' && !a.loop && Som.ouve(P, a)) {
        const ini = Som.ini(a), t1 = ini + Som.compr(a), b = Som.buf.get(a.arq), ruimIni = ini > .01 && CorteVoz.cortaPalavra(a.arq, ini), ruimFim = t1 < b.duration - .01 && CorteVoz.cortaPalavra(a.arq, t1);
        if (ruimIni || ruimFim) poe('aviso', `A voz ${nome} ${ruimIni && ruimFim ? 'começa e termina' : ruimIni ? 'começa' : 'termina'} no meio de uma palavra.`, ruimIni ? de : fq,
          [{ rotulo: 'Acertar as pontas', fn: () => { const n0 = ruimIni ? CorteVoz.quieto(a.arq, ini, .15) : ini, n1 = ruimFim ? CorteVoz.quieto(a.arq, t1, .15) : t1; a.de = Math.max(0, de + Math.round((n0 - ini) * fps)); if (n0 > .001) a.ini = round(n0, 3); else delete a.ini; if (Math.abs(n1 - b.duration) < .01) delete a.dur; else a.dur = round(n1 - n0, 3); } },
           { rotulo: 'Abrir o corte', fn: () => CorteVoz.abrir(a), abre: true }], a.id);
      }
    }
    if (auds.some(a => a.solo)) poe('aviso', `O SOLO está ligado em ${auds.filter(a => a.solo).map(a => `"${a.nome}"`).join(', ')}: os outros áudios não vão sair no vídeo.`, null, [{ rotulo: 'Tirar o solo', fn: () => auds.forEach(a => delete a.solo) }]);
    if (auds.length && !ouvidos.length) poe('erro', 'Todos os áudios estão mudos: o vídeo vai sair sem som.', null, [{ rotulo: 'Tirar o mudo de todos', fn: () => auds.forEach(a => { delete a.mudo; delete a.solo; }) }]);
    else for (const a of auds.filter(x => x.mudo)) poe('dica', `O áudio "${a.nome}" está mudo (não vai sair no vídeo).`, a.de || 0, [{ rotulo: 'Tirar o mudo', fn: () => { delete a.mudo; } }], a.id);
    const mus = ouvidos.filter(a => Som.tipo(a) === 'musica').sort((x, y) => (x.de || 0) - (y.de || 0));
    for (let i = 0; i + 1 < mus.length; i++) { const A = mus[i], B = mus[i + 1], fa = Som.fimQ(P, A); if ((B.de || 0) <= fa) poe('aviso', `Duas músicas tocam juntas ("${A.nome}" e "${B.nome}").`, B.de || 0, [{ rotulo: 'Cortar a 1ª onde a 2ª começa', fn: () => { A.dur = round(Math.max(1 / fps, ((B.de || 0) - (A.de || 0)) / fps), 3); A.fo = Math.min(1, A.dur / 2); B.fi = B.fi || .5; } }], A.id); }
    // muitos efeitos sonoros juntos
    const efs = ouvidos.filter(a => Som.tipo(a) === 'efeito'); if (efs.length >= 5) for (let q = 0; q <= fim; q += Math.max(1, Math.round(fps / 4))) { const n = efs.filter(a => q >= (a.de || 0) && q <= Som.fimQ(P, a)).length; if (n >= 5) { poe('dica', `${n} efeitos sonoros tocam ao mesmo tempo no quadro ${q + 1}: pode ficar embolado.`, q); break; } }
    // LEGENDAS
    const lg = (P.legendas || []).slice().sort((x, y) => x.de - y.de);
    for (const g of lg) {
      const txt = String(g.texto || '').replace(/\*/g, '').trim();
      if (!txt) { poe('aviso', `Legenda vazia no quadro ${g.de + 1}.`, g.de, [{ rotulo: 'Tirar', fn: () => { P.legendas = P.legendas.filter(x => x !== g); } }]); continue; }
      if (g.de > fim) poe('erro', `A legenda "${txt.slice(0, 30)}" fica depois do fim do vídeo.`, fim, [{ rotulo: 'Tirar', fn: () => { P.legendas = P.legendas.filter(x => x !== g); } }]);
      else if (g.ate > fim) poe('dica', `A legenda "${txt.slice(0, 30)}" passa do fim do vídeo.`, fim, [{ rotulo: 'Terminar no fim', fn: () => { g.ate = fim; } }]);
      if (txt.length > 52) poe('aviso', `Legenda comprida demais (${txt.length} letras): "${txt.slice(0, 40)}…". Fica difícil de ler.`, g.de, [{ rotulo: 'Dividir em duas', fn: () => this.divideLegenda(P, g) }]);
    }
    for (let i = 0; i + 1 < lg.length; i++) if (lg[i + 1].de <= lg[i].ate) { const A = lg[i], B = lg[i + 1]; poe('aviso', `Duas legendas uma em cima da outra no quadro ${B.de + 1}.`, B.de, [{ rotulo: 'Acertar', fn: () => { A.ate = Math.max(A.de, B.de - 1); } }]); }
    // CAMADAS E CHAVES
    for (const n of Modelo.todos(P)) {
      const ks = Object.keys(n.chaves || {}).map(Number), fora = ks.filter(k => k > fim);
      if (fora.length) poe('dica', `"${n.nome}" tem ${fora.length} chave${fora.length > 1 ? 's' : ''} depois do fim do vídeo.`, fim, [{ rotulo: 'Tirar as de fora', fn: () => fora.forEach(k => delete n.chaves[k]) }], n.id);
      if ((n.de || 0) > fim) poe('aviso', `"${n.nome}" começa depois do fim do vídeo (nunca aparece).`, fim, [{ rotulo: 'Aparecer desde o começo', fn: () => { n.de = 0; } }], n.id);
      if (n.ate != null && n.ate < (n.de || 0)) poe('aviso', `"${n.nome}" termina antes de começar (nunca aparece).`, n.de || 0, [{ rotulo: 'Ir até o fim do vídeo', fn: () => { n.ate = null; } }], n.id);
      if (n.tipo === 'personagem' && !P.personagens?.[n.ref]) poe('erro', `O personagem da camada "${n.nome}" não está nesta animação (some do vídeo).`, n.de || 0, [], n.id);
      if (n.tipo === 'imagem' && n.arq && !(await Arq.pegaBlob(n.arq))) poe('erro', `A imagem da camada "${n.nome}" não está neste computador.`, n.de || 0, [], n.id);
      if (n.sai?.tipo && n.ate == null) poe('dica', `"${n.nome}" tem saída (${Modelo.ANIMS[n.sai.tipo] || n.sai.tipo}), mas não tem fim: a saída não acontece.`, n.de || 0, [{ rotulo: 'Tirar a saída', fn: () => { delete n.sai; } }], n.id);
    }
    const kc = Object.keys(P.camera.chaves || {}).map(Number).filter(k => k > fim); if (kc.length) poe('dica', `A câmera tem ${kc.length} chave${kc.length > 1 ? 's' : ''} depois do fim do vídeo.`, fim, [{ rotulo: 'Tirar as de fora', fn: () => kc.forEach(k => delete P.camera.chaves[k]) }], 'camera');
    const ordem = { erro: 0, aviso: 1, dica: 2 }; return out.sort((x, y) => ordem[x.nivel] - ordem[y.nivel]);
  },
  divideLegenda(P, g) {
    const ws = String(g.texto).split(/\s+/), meio = Math.ceil(ws.length / 2), t1 = ws.slice(0, meio).join(' '), t2 = ws.slice(meio).join(' '), corte = g.de + Math.round((g.ate - g.de + 1) * t1.length / Math.max(1, t1.length + t2.length));
    const B = { ...g, texto: t2, de: Math.min(g.ate, corte), pal: (g.pal || []).slice(meio) }; g.texto = t1; g.ate = Math.max(g.de, corte - 1); g.pal = (g.pal || []).slice(0, meio); if (!g.pal.length) delete g.pal; if (!B.pal.length) delete B.pal;
    P.legendas.splice(P.legendas.indexOf(g) + 1, 0, B);
  },
  // resumo para o Exportar: { erro, aviso, dica }
  async conta(P) { const L = await this.achar(P); return { L, erro: L.filter(x => x.nivel === 'erro').length, aviso: L.filter(x => x.nivel === 'aviso').length, dica: L.filter(x => x.nivel === 'dica').length }; },
  async abrir() {
    const P = App.P, body = h('<div class="rv"><div class="rv-l"><span class="spin-dot"></span> Conferindo…</div></div>'), lista = $('.rv-l', body);
    const ICO = { erro: ['alert', 'Erro'], aviso: ['alert', 'Atenção'], dica: ['info', 'Dica'] };
    const pinta = async () => {
      const L = await this.achar(P); lista.innerHTML = '';
      if (!L.length) { lista.innerHTML = `<div class="rv-ok">${ic('check', 18)} Tudo certo: não achei nada para arrumar.</div>`; return L; }
      for (const it of L) {
        const r = h(`<div class="rv-it rv-${it.nivel}"><span class="rv-ic" title="${ICO[it.nivel][1]}">${ic(ICO[it.nivel][0], 15)}</span><span class="rv-txt">${esc(it.txt)}</span><span class="rv-bts"></span></div>`), bts = $('.rv-bts', r);
        if (it.q != null) { const b = h(`<button class="btn sm">${ic('jump', 12)} Ir até lá</button>`); b.onclick = () => { App.setQ(it.q); if (it.sel) App.selecionar(it.sel); }; bts.appendChild(b); }
        for (const c of it.consertos) { const b = h(`<button class="btn sm primary">${esc(c.rotulo)}</button>`); b.onclick = async () => { if (c.abre) { $('#modal-root .modal-back [data-x]')?.click(); return c.fn(); } c.fn(); App.commit('Revisor: ' + c.rotulo); await pinta(); }; bts.appendChild(b); }
        lista.appendChild(r);
      }
      return L;
    };
    pinta();
    await UI.modal({ title: 'Revisar a animação', icon: 'check', width: 640, body, buttons: [
      { label: 'Arrumar tudo o que dá', left: true, onClick: async () => { const L = await this.achar(P); let n = 0; for (const it of L) { const c = it.consertos.find(x => !x.abre); if (c) { c.fn(); n++; } } if (n) App.commit(`Revisor: ${n} consertos`); await pinta(); UI.toast(n ? `${n} coisa${n > 1 ? 's' : ''} arrumada${n > 1 ? 's' : ''}.` : 'Nada para arrumar sozinho.', { kind: 'ok' }); return false; } },
      { label: 'Conferir de novo', left: true, onClick: () => { pinta(); return false; } },
      { label: 'Fechar', kind: 'primary', value: true }] });
  },
};
