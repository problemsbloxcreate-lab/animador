/* ===================== revisor.js — REVISOR (como o dos Shorts): confere a animação antes de exportar =====================
   Cada conferência é uma REGRA (Revisor.REGRAS: grupo, nome, nível, ligada ou não, e às vezes um número ajustável — ex.: letras por
   legenda). A pessoa liga/desliga e ajusta as regras na aba "Regras" (localStorage `animador-revisor`, vale para ela em todas as
   animações) e pode IGNORAR um aviso só nesta animação (P.revisorIgnora). A lista mostra por grupo (Som, Legendas, Camadas…),
   filtro por erro/aviso/dica, "Ir até lá" e o conserto em 1 clique; "Arrumar tudo o que dá" usa o 1º conserto de cada um.
   Abre pelo Exportar (que já mostra quantas coisas achou) e pelo botão direito na régua da timeline. Nada muda sem clicar. */
'use strict';
const Revisor = {
  K: 'animador-revisor',
  GRUPOS: { som: ['Som', 'music'], legenda: ['Legendas', 'text'], camada: ['Camadas e chaves', 'layers'], video: ['Vídeo', 'film'] },
  // id: [grupo, nome, nível, ligada por padrão, { número ajustável }]
  REGRAS: {
    somFora: ['som', 'Som que começa ou passa do fim do vídeo', 'aviso', true],
    vozCorta: ['som', 'Voz começando ou terminando no meio de uma palavra', 'aviso', true],
    solo: ['som', 'Solo ligado (os outros áudios somem do vídeo)', 'aviso', true],
    mudo: ['som', 'Áudio mudo ou com volume zero', 'dica', true],
    estoura: ['som', 'Som alto demais (vai estourar/chiar)', 'aviso', true, { nome: 'Pico máximo', v: 1, min: .5, max: 1.5, passo: .05, un: '×' }],
    duasMusicas: ['som', 'Duas músicas tocando juntas', 'aviso', true],
    musicaSeca: ['som', 'Música terminando seca (sem fade no fim)', 'dica', true, { nome: 'Fade sugerido', v: 1, min: .2, max: 4, passo: .1, un: 's' }],
    musicaEntra: ['som', 'Música começando seca (sem fade no começo)', 'dica', false, { nome: 'Fade sugerido', v: .5, min: .1, max: 3, passo: .1, un: 's' }],
    efeitosJuntos: ['som', 'Muitos efeitos sonoros ao mesmo tempo', 'dica', true, { nome: 'A partir de', v: 5, min: 2, max: 12, passo: 1, un: 'efeitos' }],
    legVazia: ['legenda', 'Legenda vazia ou fora do vídeo', 'aviso', true],
    legLonga: ['legenda', 'Legenda comprida demais', 'aviso', true, { nome: 'Máximo de letras', v: 52, min: 20, max: 120, passo: 1, un: 'letras' }],
    legRapida: ['legenda', 'Legenda rápida demais para ler', 'aviso', true, { nome: 'Letras por segundo', v: 20, min: 8, max: 40, passo: 1, un: 'letras/s' }],
    legCurta: ['legenda', 'Legenda que some rápido demais', 'dica', true, { nome: 'Tempo mínimo', v: .6, min: .2, max: 3, passo: .1, un: 's' }],
    legJunta: ['legenda', 'Duas legendas uma em cima da outra', 'aviso', true],
    chaveFora: ['camada', 'Chaves depois do fim do vídeo', 'dica', true],
    camadaNunca: ['camada', 'Camada que nunca aparece', 'aviso', true],
    falta: ['camada', 'Personagem ou imagem que falta', 'erro', true],
    textoVazio: ['camada', 'Texto vazio', 'dica', true],
    saidaSemFim: ['camada', 'Saída de camada sem fim', 'dica', true],
    parado: ['video', 'Trecho grande sem nada mexendo', 'dica', false, { nome: 'Mais que', v: 6, min: 2, max: 30, passo: 1, un: 's' }],
    semSom: ['video', 'Vídeo sem som nenhum', 'dica', false],
  },
  cfg() { let o = {}; try { o = JSON.parse(localStorage.getItem(this.K) || '{}') || {}; } catch { } return o; },
  poeCfg(o) { try { localStorage.setItem(this.K, JSON.stringify(o)); } catch { } },
  liga(id) { const c = this.cfg().on?.[id]; return c == null ? this.REGRAS[id][3] : !!c; },
  num(id) { const r = this.REGRAS[id][4], v = this.cfg().n?.[id]; return r ? (Number.isFinite(+v) ? +v : r.v) : null; },
  async achar(P, o = {}) {
    const out = [], fim = P.duracao - 1, fps = P.fps, ign = new Set(o.comIgnorados ? [] : P.revisorIgnora || []);
    const poe = (rg, chave, txt, q, consertos = [], sel) => { if (!this.liga(rg)) return; const id = rg + ':' + chave; if (ign.has(id)) return; out.push({ id, alvo: chave, rg, grupo: this.REGRAS[rg][0], nivel: this.REGRAS[rg][2], txt, q, consertos, sel }); };
    for (const a of P.audios || []) await Som.decod(a.arq);
    const auds = (P.audios || []).filter(a => Som.buf.get(a.arq)), ouvidos = auds.filter(a => Som.ouve(P, a)), sg = s => s.toFixed(1).replace('.', ',');
    // ---------- SOM ----------
    for (const a of auds) {
      const de = a.de || 0, fq = Som.fimQ(P, a), nome = `"${a.nome}"`;
      if (de > fim) poe('somFora', a.id, `${nome} começa depois do fim do vídeo (não vai tocar).`, fim, [{ rotulo: 'Trazer para o começo', fn: () => { a.de = 0; } }, { rotulo: 'Aumentar o vídeo', fn: () => { P.duracao = fq + 1; } }], a.id);
      else if (fq > fim) poe('somFora', a.id, `${nome} passa ${sg((fq - fim) / fps)} s do fim do vídeo (vai ser cortado).`, fim, [{ rotulo: 'Cortar no fim', fn: () => { a.dur = round((fim - de + 1) / fps, 3); a.fo = a.fo || (Som.tipo(a) === 'musica' ? 1 : .15); } }, { rotulo: 'Aumentar o vídeo', fn: () => { P.duracao = fq + 1; } }], a.id);
      if (Som.ouve(P, a)) {
        if (Som.tipo(a) === 'musica' && !a.fo) { const f = this.num('musicaSeca'); poe('musicaSeca', a.id, `A música ${nome} termina seca.`, Math.min(fim, fq), [{ rotulo: `Fade de ${sg(f)} s no fim`, fn: () => { a.fo = f; } }], a.id); }
        if (Som.tipo(a) === 'musica' && !a.fi) { const f = this.num('musicaEntra'); poe('musicaEntra', a.id, `A música ${nome} começa seca.`, de, [{ rotulo: `Fade de ${sg(f)} s no começo`, fn: () => { a.fi = f; } }], a.id); }
        if (!(a.vol ?? 1)) poe('mudo', a.id + 'v', `${nome} está com o volume em 0.`, de, [{ rotulo: 'Voltar a 100%', fn: () => { a.vol = 1; } }], a.id);
        const f = Som.finos(a.arq), pico = f ? f.top * (a.vol ?? 1) * Math.max(1, ...(a.volTrechos || []).map(t => t.vol)) : 0, lim = this.num('estoura');
        if (pico > lim) poe('estoura', a.id, `${nome} chega a ${sg(pico)}× do máximo: vai estourar (chiar) no vídeo.`, de, [{ rotulo: 'Abaixar até caber', fn: () => { a.vol = round((a.vol ?? 1) * lim / pico * .97, 2); } }, { rotulo: 'Limpar e nivelar', fn: () => Som.limpar(a), abre: true }], a.id);
      }
      if (Som.tipo(a) === 'voz' && !a.loop && Som.ouve(P, a)) {
        const ini = Som.ini(a), t1 = ini + Som.compr(a), b = Som.buf.get(a.arq), rIni = ini > .01 && CorteVoz.cortaPalavra(a.arq, ini), rFim = t1 < b.duration - .01 && CorteVoz.cortaPalavra(a.arq, t1);
        if (rIni || rFim) poe('vozCorta', a.id, `A voz ${nome} ${rIni && rFim ? 'começa e termina' : rIni ? 'começa' : 'termina'} no meio de uma palavra.`, rIni ? de : fq,
          [{ rotulo: 'Acertar as pontas', fn: () => { const n0 = rIni ? CorteVoz.quieto(a.arq, ini, .15) : ini, n1 = rFim ? CorteVoz.quieto(a.arq, t1, .15) : t1; a.de = Math.max(0, de + Math.round((n0 - ini) * fps)); if (n0 > .001) a.ini = round(n0, 3); else delete a.ini; if (Math.abs(n1 - b.duration) < .01) delete a.dur; else a.dur = round(n1 - n0, 3); } },
           { rotulo: 'Abrir o corte', fn: () => CorteVoz.abrir(a), abre: true }], a.id);
      }
      if (a.mudo) poe('mudo', a.id, `${nome} está mudo (não vai sair no vídeo).`, a.de || 0, [{ rotulo: 'Tirar o mudo', fn: () => { delete a.mudo; } }], a.id);
    }
    if (auds.some(a => a.solo)) poe('solo', 'solo', `O SOLO está ligado em ${auds.filter(a => a.solo).map(a => `"${a.nome}"`).join(', ')}: os outros áudios não vão sair no vídeo.`, null, [{ rotulo: 'Tirar o solo', fn: () => auds.forEach(a => delete a.solo) }]);
    const mus = ouvidos.filter(a => Som.tipo(a) === 'musica').sort((x, y) => (x.de || 0) - (y.de || 0));
    for (let i = 0; i + 1 < mus.length; i++) { const A = mus[i], B = mus[i + 1]; if ((B.de || 0) <= Math.min(fim, Som.fimQ(P, A)) && (B.de || 0) <= fim) poe('duasMusicas', A.id + B.id, `Duas músicas tocam juntas ("${A.nome}" e "${B.nome}").`, B.de || 0, [{ rotulo: 'Cortar a 1ª onde a 2ª começa', fn: () => { A.dur = round(Math.max(1 / fps, ((B.de || 0) - (A.de || 0)) / fps), 3); A.fo = Math.min(1, A.dur / 2); B.fi = B.fi || .5; } }], A.id); }
    const efs = ouvidos.filter(a => Som.tipo(a) === 'efeito'), maxEf = this.num('efeitosJuntos');
    if (efs.length >= maxEf) for (let q = 0; q <= fim; q += Math.max(1, Math.round(fps / 4))) { const n = efs.filter(a => q >= (a.de || 0) && q <= Som.fimQ(P, a)).length; if (n >= maxEf) { poe('efeitosJuntos', 'q' + q, `${n} efeitos sonoros tocam juntos no quadro ${q + 1}: pode ficar embolado.`, q); break; } }
    if (!ouvidos.length) poe('semSom', 'x', auds.length ? 'Todos os áudios estão mudos: o vídeo vai sair sem som.' : 'O vídeo não tem som nenhum.', null, auds.length ? [{ rotulo: 'Tirar o mudo de todos', fn: () => auds.forEach(a => { delete a.mudo; delete a.solo; }) }] : []);
    // ---------- LEGENDAS ----------
    const lg = (P.legendas || []).slice().sort((x, y) => x.de - y.de), maxL = this.num('legLonga'), cps = this.num('legRapida'), minS = this.num('legCurta');
    lg.forEach((g, i) => {
      const txt = String(g.texto || '').replace(/\*/g, '').trim(), k = 'l' + g.de + ':' + txt.slice(0, 12), seg = (g.ate - g.de + 1) / fps, tira = () => { P.legendas = P.legendas.filter(x => x !== g); };
      if (!txt) return poe('legVazia', k, `Legenda vazia no quadro ${g.de + 1}.`, g.de, [{ rotulo: 'Tirar', fn: tira }]);
      if (g.de > fim) poe('legVazia', k + 'f', `A legenda "${txt.slice(0, 30)}" fica depois do fim do vídeo.`, fim, [{ rotulo: 'Tirar', fn: tira }]);
      else if (g.ate > fim) poe('legVazia', k + 'p', `A legenda "${txt.slice(0, 30)}" passa do fim do vídeo.`, fim, [{ rotulo: 'Terminar no fim', fn: () => { g.ate = fim; } }]);
      if (txt.length > maxL) poe('legLonga', k, `Legenda com ${txt.length} letras (máximo ${maxL}): "${txt.slice(0, 40)}…".`, g.de, [{ rotulo: 'Dividir em duas', fn: () => this.divideLegenda(P, g) }]);
      const prox = lg[i + 1], espaco = prox ? prox.de - 1 : fim;
      if (txt.length / seg > cps) { const precisa = Math.ceil(txt.length / cps * fps), novoFim = Math.min(espaco, g.de + precisa - 1);
        poe('legRapida', k, `"${txt.slice(0, 30)}" fica só ${sg(seg)} s (${Math.round(txt.length / seg)} letras/s): rápido demais para ler.`, g.de, novoFim > g.ate ? [{ rotulo: `Esticar até ${sg((novoFim - g.de + 1) / fps)} s`, fn: () => { g.ate = novoFim; } }] : []); }
      else if (seg < minS) { const nf = Math.min(espaco, g.de + Math.ceil(minS * fps) - 1); poe('legCurta', k, `"${txt.slice(0, 30)}" some em ${sg(seg)} s.`, g.de, nf > g.ate ? [{ rotulo: `Esticar até ${sg(minS)} s`, fn: () => { g.ate = nf; } }] : []); }
      if (prox && prox.de <= g.ate) poe('legJunta', k, `Duas legendas uma em cima da outra no quadro ${prox.de + 1}.`, prox.de, [{ rotulo: 'Acertar', fn: () => { if (prox.de > g.de) g.ate = prox.de - 1; else if (prox.ate > g.ate) prox.de = g.ate + 1; else P.legendas = P.legendas.filter(x => x !== prox); } }]);
    });
    // ---------- CAMADAS E CHAVES ----------
    for (const n of Modelo.todos(P)) {
      const fora = Object.keys(n.chaves || {}).map(Number).filter(k => k > fim), nm = `"${n.nome}"`;
      if (fora.length) poe('chaveFora', n.id, `${nm} tem ${fora.length} chave${fora.length > 1 ? 's' : ''} depois do fim do vídeo.`, fim, [{ rotulo: 'Tirar as de fora', fn: () => fora.forEach(k => delete n.chaves[k]) }], n.id);
      if ((n.de || 0) > fim) poe('camadaNunca', n.id, `${nm} começa depois do fim do vídeo (nunca aparece).`, fim, [{ rotulo: 'Aparecer desde o começo', fn: () => { n.de = 0; } }], n.id);
      if (n.ate != null && n.ate < (n.de || 0)) poe('camadaNunca', n.id + 'a', `${nm} termina antes de começar (nunca aparece).`, n.de || 0, [{ rotulo: 'Ir até o fim do vídeo', fn: () => { n.ate = null; } }], n.id);
      if (n.tipo === 'personagem' && !P.personagens?.[n.ref]) poe('falta', n.id, `O personagem da camada ${nm} não está nesta animação (some do vídeo).`, n.de || 0, [], n.id);
      if (n.tipo === 'imagem' && n.arq && !(await Arq.pegaBlob(n.arq))) poe('falta', n.id, `A imagem da camada ${nm} não está neste computador.`, n.de || 0, [], n.id);
      if (n.tipo === 'texto' && !String(n.texto || '').trim()) poe('textoVazio', n.id, `O texto ${nm} está vazio.`, n.de || 0, [{ rotulo: 'Tirar a camada', fn: () => { const r = Modelo.achar(P, n.id); if (r) r.lista.splice(r.lista.indexOf(n), 1); } }], n.id);
      if (n.sai?.tipo && n.ate == null) poe('saidaSemFim', n.id, `${nm} tem saída (${Modelo.ANIMS[n.sai.tipo] || n.sai.tipo}), mas não tem fim: a saída não acontece.`, n.de || 0, [{ rotulo: 'Tirar a saída', fn: () => { delete n.sai; } }], n.id);
    }
    const kc = Object.keys(P.camera.chaves || {}).map(Number).filter(k => k > fim); if (kc.length) poe('chaveFora', 'cam', `A câmera tem ${kc.length} chave${kc.length > 1 ? 's' : ''} depois do fim do vídeo.`, fim, [{ rotulo: 'Tirar as de fora', fn: () => kc.forEach(k => delete P.camera.chaves[k]) }], 'camera');
    // ---------- VÍDEO: trecho grande sem nada mexendo ----------
    if (this.liga('parado')) { const ks = new Set([0, fim]); Modelo.todos(P).forEach(n => { Object.keys(n.chaves || {}).forEach(k => ks.add(+k)); ks.add(n.de || 0); if (n.ate != null) ks.add(n.ate); }); Object.keys(P.camera.chaves).forEach(k => ks.add(+k)); lg.forEach(g => { ks.add(g.de); ks.add(g.ate); });
      const L = [...ks].filter(k => k >= 0 && k <= fim).sort((a, b) => a - b), mx = this.num('parado') * fps;
      for (let i = 0; i + 1 < L.length; i++) if (L[i + 1] - L[i] > mx) poe('parado', 'p' + L[i], `Nada muda entre ${Exportar.tc(L[i] / fps)} e ${Exportar.tc(L[i + 1] / fps)} (${sg((L[i + 1] - L[i]) / fps)} s).`, L[i]); }
    const ordem = { erro: 0, aviso: 1, dica: 2 }; return out.sort((x, y) => ordem[x.nivel] - ordem[y.nivel]);
  },
  // um conserto por coisa de cada vez e confere de novo (senão dois avisos da mesma legenda a dividiam duas vezes)
  async arrumaTudo(P) {
    let n = 0; const feitos = new Set();
    for (let volta = 0; volta < 4; volta++) { const L = await this.achar(P), usados = new Set(); let mudou = false;
      for (const it of L) { const c = it.consertos.find(x => !x.abre); if (!c || usados.has(it.alvo) || feitos.has(it.id)) continue; usados.add(it.alvo); feitos.add(it.id); c.fn(); n++; mudou = true; }
      if (!mudou) break; }
    return n;
  },
  divideLegenda(P, g) {
    const ws = String(g.texto).split(/\s+/), meio = Math.ceil(ws.length / 2), t1 = ws.slice(0, meio).join(' '), t2 = ws.slice(meio).join(' '), corte = g.de + Math.round((g.ate - g.de + 1) * t1.length / Math.max(1, t1.length + t2.length));
    const B = { ...g, texto: t2, de: Math.min(g.ate, corte), pal: (g.pal || []).slice(meio) }; g.texto = t1; g.ate = Math.max(g.de, corte - 1); g.pal = (g.pal || []).slice(0, meio); if (!g.pal.length) delete g.pal; if (!B.pal.length) delete B.pal;
    P.legendas.splice(P.legendas.indexOf(g) + 1, 0, B);
  },
  async conta(P) { const L = await this.achar(P); return { L, erro: L.filter(x => x.nivel === 'erro').length, aviso: L.filter(x => x.nivel === 'aviso').length, dica: L.filter(x => x.nivel === 'dica').length }; },
  // ---------- a janela: lista (por grupo, com filtro) e Regras ----------
  async abrir() {
    const P = App.P, st = { aba: 'lista', filtro: 'tudo', fech: new Set() };
    const body = h(`<div class="rv"><div class="rv-topo"><div class="rv-abas"><button data-aba="lista">${ic('check', 13)} Conferência</button><button data-aba="regras">${ic('sliders', 13)} Regras</button></div><span class="sp"></span><div class="rv-filtro" data-filtro></div></div><div class="rv-corpo"></div></div>`), corpo = $('.rv-corpo', body);
    const NIV = { erro: ['alert', 'Erros'], aviso: ['alert', 'Avisos'], dica: ['info', 'Dicas'] };
    const pintaLista = async () => {
      corpo.innerHTML = '<div class="rv-vaz"><span class="spin-dot"></span> Conferindo…</div>'; const L = await this.achar(P), ign = (P.revisorIgnora || []).length;
      const n = k => L.filter(x => x.nivel === k).length, fl = $('[data-filtro]', body);
      fl.innerHTML = [['tudo', `Tudo ${L.length}`], ['erro', `Erros ${n('erro')}`], ['aviso', `Avisos ${n('aviso')}`], ['dica', `Dicas ${n('dica')}`]].map(([k, t]) => `<button data-f="${k}" class="${st.filtro === k ? 'on' : ''} rv-f-${k}">${t}</button>`).join('');
      $$('[data-f]', fl).forEach(b => b.onclick = () => { st.filtro = b.dataset.f; pintaLista(); });
      const V = L.filter(x => st.filtro === 'tudo' || x.nivel === st.filtro); corpo.innerHTML = '';
      if (!V.length) corpo.innerHTML = `<div class="rv-ok">${ic('check', 18)} ${L.length ? 'Nada com esse filtro.' : 'Tudo certo: não achei nada para arrumar.'}</div>`;
      for (const [g, [nomeG, icG]] of Object.entries(this.GRUPOS)) {
        const its = V.filter(x => x.grupo === g); if (!its.length) continue; const fechado = st.fech.has(g);
        const cab = h(`<div class="rv-g">${ic(fechado ? 'right' : 'down', 12)}${ic(icG, 14)}<b>${nomeG}</b><small>${its.length}</small></div>`); cab.onclick = () => { fechado ? st.fech.delete(g) : st.fech.add(g); pintaLista(); }; corpo.appendChild(cab);
        if (fechado) continue;
        for (const it of its) {
          const r = h(`<div class="rv-it rv-${it.nivel}"><span class="rv-ic" title="${NIV[it.nivel][1]}">${ic(NIV[it.nivel][0], 14)}</span><span class="rv-txt">${esc(it.txt)}</span><span class="rv-bts"></span></div>`), bts = $('.rv-bts', r);
          for (const c of it.consertos) { const b = h(`<button class="btn sm primary">${esc(c.rotulo)}</button>`); b.onclick = async () => { if (c.abre) { $('#modal-root .modal-back:last-child [data-x]')?.click(); return c.fn(); } c.fn(); App.commit('Revisor: ' + c.rotulo); await pintaLista(); }; bts.appendChild(b); }
          if (it.q != null) { const b = h(`<button class="ibtn" title="Ir até lá (quadro ${it.q + 1})">${ic('jump', 13)}</button>`); b.onclick = () => { App.setQ(it.q); if (it.sel) App.selecionar(it.sel); }; bts.appendChild(b); }
          const ig = h(`<button class="ibtn" title="Ignorar este aviso nesta animação">${ic('eyeOff', 13)}</button>`); ig.onclick = async () => { P.revisorIgnora = [...new Set([...(P.revisorIgnora || []), it.id])]; App.commit('Revisor: ignorar'); await pintaLista(); }; bts.appendChild(ig);
          corpo.appendChild(r);
        }
      }
      if (ign) { const b = h(`<button class="rv-ign">${ic('eye', 13)} ${ign} aviso${ign > 1 ? 's' : ''} ignorado${ign > 1 ? 's' : ''} nesta animação · mostrar de novo</button>`); b.onclick = async () => { delete P.revisorIgnora; App.commit('Revisor: mostrar ignorados'); await pintaLista(); }; corpo.appendChild(b); }
    };
    const pintaRegras = () => {
      $('[data-filtro]', body).innerHTML = ''; const c = this.cfg(); corpo.innerHTML = '<div class="rv-dica-r">Liga ou desliga o que o revisor confere e ajusta os números. Vale para você em todas as animações.</div>';
      for (const [g, [nomeG, icG]] of Object.entries(this.GRUPOS)) {
        corpo.appendChild(h(`<div class="rv-g rv-g-r">${ic(icG, 14)}<b>${nomeG}</b></div>`));
        for (const [id, [gr, nome, niv, , num]] of Object.entries(this.REGRAS)) { if (gr !== g) continue;
          const r = h(`<div class="rv-regra"><label class="chk"><input type="checkbox" ${this.liga(id) ? 'checked' : ''}><span class="rv-n rv-n-${niv}"></span>${esc(nome)}</label>${num ? `<span class="rv-num"><small>${esc(num.nome)}</small><input type="number" min="${num.min}" max="${num.max}" step="${num.passo}" value="${this.num(id)}"><small>${esc(num.un)}</small></span>` : ''}</div>`);
          $('input[type=checkbox]', r).onchange = e => { const o = this.cfg(); (o.on ||= {})[id] = e.target.checked; this.poeCfg(o); };
          const ni = $('input[type=number]', r); if (ni) ni.onchange = e => { const o = this.cfg(); (o.n ||= {})[id] = clamp(+e.target.value || num.v, num.min, num.max); this.poeCfg(o); e.target.value = o.n[id]; };
          corpo.appendChild(r); } }
      const pd = h(`<button class="btn sm">${ic('undo', 13)} Voltar às regras de sempre</button>`); pd.onclick = () => { this.poeCfg({}); pintaRegras(); }; corpo.appendChild(pd);
    };
    const aba = a => { st.aba = a; $$('[data-aba]', body).forEach(b => b.classList.toggle('on', b.dataset.aba === a)); a === 'lista' ? pintaLista() : pintaRegras(); };
    $$('[data-aba]', body).forEach(b => b.onclick = () => aba(b.dataset.aba)); aba('lista');
    await UI.modal({ title: 'Revisar a animação', icon: 'check', width: 720, body, buttons: [
      { label: 'Arrumar tudo o que dá', left: true, onClick: async () => { const n = await this.arrumaTudo(P); if (n) App.commit(`Revisor: ${n} consertos`); aba('lista'); UI.toast(n ? `${n} coisa${n > 1 ? 's' : ''} arrumada${n > 1 ? 's' : ''}.` : 'Nada para arrumar sozinho.', { kind: 'ok' }); return false; } },
      { label: 'Conferir de novo', onClick: () => { aba('lista'); return false; } },
      { label: 'Fechar', kind: 'primary', value: true }] });
  },
};
