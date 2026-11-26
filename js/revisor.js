/* ===================== revisor.js — REVISOR (como o dos Shorts): confere a animação antes de exportar =====================
   Cada conferência é uma REGRA (Revisor.REGRAS: grupo, nome, nível, ligada ou não, e às vezes um número ajustável — ex.: letras por
   legenda). A pessoa liga/desliga e ajusta as regras na aba "Regras" (localStorage `animador-revisor`, vale para ela em todas as
   animações) e pode IGNORAR um aviso só nesta animação (P.revisorIgnora). A lista mostra por grupo (Som, Legendas, Camadas…),
   filtro por erro/aviso/dica, "Ir até lá" e o conserto em 1 clique; "Arrumar tudo o que dá" usa o 1º conserto de cada um.
   Abre pelo Exportar (que já mostra quantas coisas achou) e pelo botão direito na régua da timeline. Nada muda sem clicar. */
'use strict';
const Revisor = {
  K: 'animador-revisor',
  GRUPOS: { final: ['Vídeo pronto (quadros e som)', 'eye'], som: ['Som', 'music'], legenda: ['Legendas', 'text'], camada: ['Camadas e chaves', 'layers'], video: ['Vídeo', 'film'] },
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
    vozConfere: ['som', 'Fala marcada pela conferência da decupagem (Short)', 'aviso', true],
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
    // VÍDEO PRONTO: só depois de "Conferir o vídeo" (cada quadro desenhado pequeno + a mistura final do som; Revisor.conferirVideo)
    preto: ['final', 'Quadro preto no meio do vídeo', 'aviso', true, { nome: 'Escuro em', v: 97, min: 80, max: 100, passo: 1, un: '% da tela' }],
    pretoFim: ['final', 'Quadro preto no fim do vídeo', 'erro', true],
    fimFala: ['final', 'Short que continua depois da última fala (só 9:16)', 'aviso', true, { nome: 'Folga', v: .3, min: 0, max: 3, passo: .1, un: 's' }],
    congelado: ['final', 'Imagem congelada durante a fala', 'aviso', true, { nome: 'Mais que', v: 1, min: .3, max: 5, passo: .1, un: 's' }],
    semCorte: ['final', 'Muito tempo sem corte (só 9:16)', 'aviso', true, { nome: 'Mais que', v: 3, min: 1, max: 15, passo: .5, un: 's' }],
    vazio: ['final', 'Câmera mostrando o vazio (xadrez)', 'erro', true],
    xadrez: ['final', 'Xadrez cinza pintado dentro de uma imagem', 'erro', true],
    textoLeg: ['final', 'Texto ou letreiro em cima da legenda', 'aviso', true],
    areaSegura: ['final', 'Texto, letreiro ou legenda fora da área segura', 'aviso', true, [
      { nome: 'Em cima', v: 8, min: 0, max: 30, passo: 1, un: '%' }, { nome: 'Direita', v: 14, min: 0, max: 30, passo: 1, un: '%' },
      { nome: 'Embaixo', v: 22, min: 0, max: 40, passo: 1, un: '%' }, { nome: 'Esquerda', v: 5, min: 0, max: 30, passo: 1, un: '%' },
      { nome: 'Legenda embaixo', v: 15, min: 0, max: 40, passo: 1, un: '%' }]], // decisão da dona (26/11/2026): a legenda tem margem própria de baixo (a padrão fica a 80–82% da altura)
    silencio: ['final', 'Silêncio no meio do vídeo', 'aviso', true, { nome: 'Mais que', v: .7, min: .2, max: 5, passo: .1, un: 's' }],
    buraco: ['final', 'Buraco no som (silêncio digital curto entre sons)', 'aviso', true],
    volume: ['final', 'Volume final longe de −14 LUFS', 'aviso', true, { nome: 'Folga', v: 1, min: .5, max: 4, passo: .5, un: 'LU' }],
    pico: ['final', 'Pico acima de −1 dBTP', 'erro', true],
  },
  cfg() { let o = {}; try { o = JSON.parse(localStorage.getItem(this.K) || '{}') || {}; } catch { } return o; },
  poeCfg(o) { try { localStorage.setItem(this.K, JSON.stringify(o)); } catch { } },
  liga(id) { const c = this.cfg().on?.[id]; return c == null ? this.REGRAS[id][3] : !!c; },
  num(id) { const r = this.REGRAS[id][4], v = this.cfg().n?.[id]; if (Array.isArray(r)) return r.map((s, i) => Number.isFinite(+v?.[i]) ? +v[i] : s.v); return r ? (Number.isFinite(+v) ? +v : r.v) : null; },
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
    // conferência da decupagem (motor do Shorts): sem voz, silêncio na ponta, palavra cortada, voz de outro personagem
    (P.short?.avisos || []).forEach((a, i) => poe('vozConfere', 'vc' + a.q + ':' + i, `“${String(a.texto).slice(0, 40)}”: ${a.aviso}.`, a.q, [{ rotulo: 'Já conferi', fn: () => { P.short.avisos = P.short.avisos.filter(x => x !== a); } }]));
    const lg = (P.legendas || []).slice().sort((x, y) => x.de - y.de), maxL = this.num('legLonga'), cps = this.num('legRapida'), minS = this.num('legCurta');
    lg.forEach((g, i) => {
      const txt = String(g.texto || '').replace(/\*/g, '').trim(), k = 'l' + g.de + ':' + txt.slice(0, 12), seg = (g.ate - g.de + 1) / fps, tira = () => { P.legendas = P.legendas.filter(x => x !== g); };
      if (!txt) return poe('legVazia', k, `Legenda vazia no quadro ${g.de + 1}.`, g.de, [{ rotulo: 'Tirar', fn: tira }]);
      if (g.de > fim) poe('legVazia', k + 'f', `A legenda "${txt.slice(0, 30)}" fica depois do fim do vídeo.`, fim, [{ rotulo: 'Tirar', fn: tira }]);
      else if (g.ate > fim) poe('legVazia', k + 'p', `A legenda "${txt.slice(0, 30)}" passa do fim do vídeo.`, fim, [{ rotulo: 'Terminar no fim', fn: () => { g.ate = fim; } }]);
      if (!g.blocos?.length && txt.length > maxL) poe('legLonga', k, `Legenda com ${txt.length} letras (máximo ${maxL}): "${txt.slice(0, 40)}…".`, g.de, [{ rotulo: 'Dividir em duas', fn: () => this.divideLegenda(P, g) }]);
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
    // ---------- VÍDEO PRONTO: o que a última "Conferir o vídeo" achou (só vale enquanto o projeto não mudou) ----------
    const vc = this.videoConferido(P);
    if (vc) for (const it of vc.itens) poe(it.rg, it.chave, it.txt, it.q, (it.consertos || []).map(k => this.CONSERTOS[k]?.(P, vc)).filter(Boolean));
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
  /* ---------- CONFERÊNCIA DO VÍDEO PRONTO (Fase 4 da reforma, pedido da dona em 26/11/2026; ideias do qa_video/check_timeline e do
     "explainroo check", refeitas aqui sem instalar nada). Desenha CADA quadro pequeno (Render.quadro, igual ao exportar, sem legenda) e mede:
     preto (escuro em quase toda a tela; no fim = erro), congelado (nenhum pixel muda) durante a fala, tempo sem corte (média da diferença
     dos quadros alta ou chave de câmera em corte), vazio (o Render.fundo fica de fora: o que sobra transparente é o xadrez/cor do palco no
     vídeo), xadrez cinza pintado numa imagem (blocos de 8 px com só dois cinzas), legenda × texto/letreiro e área segura (caixas na tela).
     Som: a MESMA mistura e masterização do exportar (Som.mistura + Som.masteriza com o Nivelar escolhido) → LUFS, pico verdadeiro (4×),
     silêncio e buraco de silêncio digital. O resultado fica em Revisor._video com a assinatura do projeto: mudou o projeto = conferir de novo. */
  assina(P) { const s = JSON.stringify(P, (k, v) => ['thumb', 'modificado', 'nuvemEm', 'nuvemMod', 'revisorIgnora', 'exportar', 'salvoEm'].includes(k) ? undefined : v); let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36) + ':' + s.length + ':' + (P.exportar?.nivelar !== false); },
  videoConferido(P) { const v = this._video; return v && v.id === P.id && v.assina === this.assina(P) ? v : null; },
  CONSERTOS: {
    fim: (P, vc) => vc.ultFala >= 0 && vc.ultFala < P.duracao - 1 ? { rotulo: 'Terminar o vídeo na última fala', fn: () => { P.duracao = vc.ultFala + 1; } } : null,
    nivelar: P => P.exportar?.nivelar === false ? { rotulo: 'Ligar o Nivelar −14 no Exportar', fn: () => { P.exportar = { ...(P.exportar || {}), nivelar: true }; } } : null,
  },
  // quadros em que alguém fala: legendas + vozes que saem no vídeo
  falas(P) { const N = P.duracao, f = new Uint8Array(N), marca = (a, b) => { for (let q = Math.max(0, a); q <= Math.min(N - 1, b); q++) f[q] = 1; };
    (P.legendas || []).forEach(g => { if (String(g.texto || '').trim()) marca(g.de, g.ate); }); (P.audios || []).filter(a => Som.tipo(a) === 'voz' && Som.ouve(P, a)).forEach(a => marca(a.de || 0, Som.fimQ(P, a))); return f; },
  // trechos seguidos onde ok(q) vale: [[de, ate], …]
  trechos(N, ok) { const out = []; let a = -1; for (let q = 0; q <= N; q++) { const v = q < N && ok(q); if (v && a < 0) a = q; else if (!v && a >= 0) { out.push([a, q - 1]); a = -1; } } return out; },
  async conferirVideo(P, pr = () => { }, parar = () => false) {
    App.pausa?.(); const N = P.duracao, fps = P.fps, W = Math.min(P.w, P.h > P.w ? 360 : 640), H = Math.max(2, Math.round(W * P.h / P.w)), npx = W * H;
    const tc = q => Exportar.tc(q / fps), sg = s => s.toFixed(1).replace('.', ','), vert = P.h > P.w;
    for (const a of P.audios || []) await Som.decod(a.arq);
    pr(0, 'Abrindo as imagens…');
    await Arq.garantir([...Object.values(P.personagens || {}).flatMap(d => Modelo.chavesImgs(d)), ...Modelo.todos(P).filter(n => n.tipo === 'imagem' && n.arq).map(n => n.arq)]);
    if (typeof GifCache !== 'undefined') await GifCache.prepara(P);
    // letreiros = camadas de texto, e qualquer camada numa pasta "Letreiros" (ou com "letreiro" no nome)
    const letr = new Set();
    const marcaL = (L, dentro) => L.forEach(n => { const e = dentro || /letreiro/i.test(n.nome || ''); if (n.tipo === 'texto' || (e && n.tipo !== 'pasta' && n.tipo !== 'efeito')) letr.add(n.id); if (n.filhos) marcaL(n.filhos, e); }); marcaL(P.raiz, false);
    const [mT, mD, mB, mE, mL] = vert ? this.num('areaSegura').map(v => v / 100) : [.05, .05, .05, .05, .05], seg = { x0: mE * W, y0: mT * H, x1: W - mD * W, y1: H - mB * H }, segL = { ...seg, y1: H - mL * H };
    const fd = Render.fundoDe(P), fc = [1, 3, 5].map(i => parseInt(fd.cor.slice(i, i + 2), 16)), lumF = fc[0] * .299 + fc[1] * .587 + fc[2] * .114;
    const cv = new OffscreenCanvas(W, H), ctx = cv.getContext('2d', { willReadFrequently: true }), lc = new OffscreenCanvas(W, H), lx = lc.getContext('2d', { willReadFrequently: true });
    const Q = new Array(N), lum = new Float32Array(npx), ant = new Float32Array(npx), escuro = 10, limPreto = this.num('preto') / 100;
    const comVideo = typeof CenarioVideo !== 'undefined' && CenarioVideo.tem(P), fundoOrig = Render.fundo;
    Render.fundo = () => { }; // o vazio fica transparente: é ele que vira o xadrez (ou a cor do palco) no vídeo
    try {
      for (let q = 0; q < N; q++) {
        if (parar()) throw new Error('parado');
        if (comVideo) await CenarioVideo.prepara(P, q);
        if (comVideo) CenarioVideo.emExport = true;
        try { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); Render.quadro(ctx, P, q, W, H, { semLegenda: true }); } finally { if (comVideo) CenarioVideo.emExport = false; }
        const d = ctx.getImageData(0, 0, W, H).data; let esc0 = 0, vaz = 0, mud = 0, soma = 0, xad = 0;
        for (let i = 0, p = 0; p < npx; p++, i += 4) { const a = d[i + 3] / 255, l = a * (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) + (1 - a) * lumF; lum[p] = l;
          if (l < escuro) esc0++; if (d[i + 3] < 250) vaz++; if (q) { const df = Math.abs(l - ant[p]); soma += df; if (df > 6) mud++; } }
        // xadrez pintado: bloco de 8×8 opaco, sem cor, claro, com só dois cinzas (cada um com 12+ pixels)
        for (let by = 0; by + 8 <= H; by += 8) for (let bx = 0; bx + 8 <= W; bx += 8) {
          let mn = 255, mx = 0, ok = true; for (let y = by; y < by + 8 && ok; y++) for (let x = bx; x < bx + 8; x++) { const i = (y * W + x) * 4; if (d[i + 3] < 250 || Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) > 6) { ok = false; break; } const l = d[i + 1]; if (l < mn) mn = l; if (l > mx) mx = l; }
          if (!ok || mx - mn < 8 || mx - mn > 70 || mn < 140) continue; let a = 0, b = 0;
          for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) { const l = d[(y * W + x) * 4 + 1]; if (l - mn <= 4) a++; else if (mx - l <= 4) b++; }
          if (a >= 12 && b >= 12 && a + b >= 52) xad++; }
        ant.set(lum);
        // legenda (caixa da tinta) e letreiros (caixa na tela)
        const lg = (P.legendas || []).find(x => q >= x.de && q <= x.ate && String(x.texto || '').trim()); let cxL = null;
        if (lg) { lx.setTransform(1, 0, 0, 1, 0, 0); lx.clearRect(0, 0, W, H); Render.legenda(lx, P, q, W, H); const ld = lx.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ld[(y * W + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
          if (x1 >= 0) cxL = { x0, y0, x1, y1, nome: 'A legenda' }; }
        const cxs = []; if (letr.size) { const cam = Render.matCamera(P, q, W, H);
          for (const c of Render.caixas(P, q)) { if (!letr.has(c.no.id)) continue; const pts = c.cantos.map(p => cam.transformPoint(p)), b = { x0: Math.min(...pts.map(p => p.x)), y0: Math.min(...pts.map(p => p.y)), x1: Math.max(...pts.map(p => p.x)), y1: Math.max(...pts.map(p => p.y)), nome: `"${c.no.nome}"`, id: c.no.id };
            if (b.x1 > 0 && b.y1 > 0 && b.x0 < W && b.y0 < H) cxs.push(b); } }
        const cobre = [], fora = [], folga = 2;
        for (const b of cxs) if (cxL && b.x0 < cxL.x1 - folga && b.x1 > cxL.x0 + folga && b.y0 < cxL.y1 - folga && b.y1 > cxL.y0 + folga) cobre.push(b.nome);
        for (const b of cxL ? [cxL, ...cxs] : cxs) { const s = b === cxL ? segL : seg; if (b.x0 < s.x0 - folga || b.y0 < s.y0 - folga || b.x1 > s.x1 + folga || b.y1 > s.y1 + folga) fora.push(b.nome); }
        Q[q] = { preto: esc0 / npx >= limPreto, vazio: vaz / npx > .002, xad: xad >= 4, mud, md: q ? soma / npx : 0, cobre, fora };
        if (q % 4 === 0) { pr(q / N * .85, `Quadro ${q + 1} de ${N}`); await Exportar.folga(); }
      }
    } finally { Render.fundo = fundoOrig; if (comVideo) CenarioVideo.solta?.('exp'); }
    // ---------- o que achou nos quadros ----------
    const itens = [], poe = (rg, chave, txt, q, consertos) => itens.push({ rg, chave, txt, q, consertos }), fala = this.falas(P);
    let ultFala = -1; for (let q = N - 1; q >= 0; q--) if (fala[q]) { ultFala = q; break; }
    const lim = (a, b) => a === b ? `no quadro ${a + 1} (${tc(a)})` : `de ${tc(a)} a ${tc(b + 1)} (quadros ${a + 1} a ${b + 1})`;
    for (const [a, b] of this.trechos(N, q => Q[q].preto)) {
      if (b === N - 1) poe('pretoFim', 'f' + a, `O vídeo termina em preto ${lim(a, b)}${ultFala >= 0 && ultFala < a ? ': deve acabar na última fala' : ''}.`, a, ['fim']);
      else poe('preto', 'p' + a, `Tela preta ${lim(a, b)}.`, a); }
    if (vert && ultFala >= 0 && (N - 1 - ultFala) / fps > this.num('fimFala')) poe('fimFala', 'f', `O Short continua ${sg((N - 1 - ultFala) / fps)} s depois da última fala (quadro ${ultFala + 1}): o que termina em corte seco acaba na última fala.`, ultFala, ['fim']);
    const congMin = this.num('congelado') * fps;
    for (const [a, b] of this.trechos(N, q => q > 0 && Q[q].mud <= 2 && fala[q] && !Q[q].preto)) if (b - a + 2 > congMin) poe('congelado', 'c' + a, `Imagem parada ${sg((b - a + 2) / fps)} s enquanto alguém fala, ${lim(a - 1, b)}.`, a - 1);
    if (vert) { const cortes = [0]; const camCorte = new Set(Object.entries(P.camera?.chaves || {}).filter(([, k]) => k?.ir === 'corte').map(([q]) => +q));
      for (let q = 1; q < N; q++) if (Q[q].md > 18 || camCorte.has(q)) cortes.push(q); cortes.push(N); const mx = this.num('semCorte') * fps;
      for (let i = 0; i + 1 < cortes.length; i++) { const a = cortes[i], b = cortes[i + 1]; if (b - a > mx) poe('semCorte', 's' + a, `${sg((b - a) / fps)} s sem corte, ${lim(a, b - 1)}.`, a); } }
    for (const [a, b] of this.trechos(N, q => Q[q].vazio)) poe('vazio', 'v' + a, `A câmera mostra o vazio (fica xadrez ou a cor do palco no vídeo) ${lim(a, b)}.`, a);
    for (const [a, b] of this.trechos(N, q => Q[q].xad)) poe('xadrez', 'x' + a, `Tem xadrez cinza pintado dentro de uma imagem ${lim(a, b)}.`, a);
    const porNome = (campo, rg, txt) => { const nomes = new Set(); Q.forEach(x => x[campo].forEach(n => nomes.add(n)));
      for (const nm of nomes) for (const [a, b] of this.trechos(N, q => Q[q][campo].includes(nm))) poe(rg, nm + a, txt(nm, a, b), a); };
    porNome('cobre', 'textoLeg', (nm, a, b) => `${nm} fica em cima da legenda ${lim(a, b)}.`);
    porNome('fora', 'areaSegura', (nm, a, b) => `${nm} sai da área segura${vert ? ' do Short' : ''} ${lim(a, b)}.`);
    // ---------- o som final (a mesma conta do exportar) ----------
    let lufs = null, pico = null; const ouvidos = (P.audios || []).filter(a => Som.buf.get(a.arq) && Som.ouve(P, a));
    if (ouvidos.length) {
      pr(.88, 'Misturando o som como no exportar…'); const sr = 48000, mix = await Som.mistura(P, sr), fim = Math.min(mix.length, Math.round(N / fps * sr)), nivelar = P.exportar?.nivelar !== false;
      const r = await Som.masteriza(mix, { nivelar, ini: 0, fim }); lufs = r.lufs; pr(.94, 'Medindo o pico e os silêncios…');
      const chs = [...Array(mix.numberOfChannels)].map((_, c) => mix.getChannelData(c)); let pk = 0;
      for (const x of chs) for (let i = 1; i + 2 < fim; i++) { const p0 = x[i - 1], p1 = x[i], p2 = x[i + 1], p3 = x[i + 2]; let m = Math.abs(p1); // pico verdadeiro: 4× por Catmull-Rom
        if (m > pk) pk = m; for (const t of [.25, .5, .75]) { const v = Math.abs(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)); if (v > pk) pk = v; } }
      pico = 20 * Math.log10(pk || 1e-9);
      if (Number.isFinite(lufs) && Math.abs(lufs + 14) > this.num('volume')) poe('volume', 'v', `O volume final fica em ${sg(lufs)} LUFS (o Short vai em −14).${nivelar ? '' : ' O Nivelar −14 do Exportar está desligado.'}`, null, ['nivelar']);
      if (pico > -1) poe('pico', 'p', `O pico final chega a ${sg(pico)} dBTP (tem que ficar abaixo de −1).`, null, ['nivelar']);
      // silêncio: janelas de 10 ms abaixo de −50 dBFS; buraco: silêncio DIGITAL de 5 a 300 ms com som dos dois lados
      const jan = sr / 100, nj = Math.floor(fim / jan), quieto = new Uint8Array(nj), lim2 = Math.pow(10, -50 / 20);
      for (let j = 0; j < nj; j++) { let s = 0; for (const x of chs) for (let i = j * jan; i < (j + 1) * jan; i++) s += x[i] * x[i]; quieto[j] = Math.sqrt(s / (jan * chs.length)) < lim2 ? 1 : 0; }
      const silMin = this.num('silencio') * 100, qDe = j => Math.min(N - 1, Math.floor(j / 100 * fps));
      for (const [a, b] of this.trechos(nj, j => quieto[j])) { if (b - a + 1 < silMin) continue; const q0 = qDe(a), q1 = qDe(b);
        if (b >= nj - 1 && ultFala >= 0 && q0 >= ultFala) continue; // silêncio depois da última fala: o "fimFala"/"pretoFim" já avisam
        poe('silencio', 's' + a, `${sg((b - a + 1) / 100)} s de silêncio ${lim(q0, q1)}.`, q0); }
      const tem = j => j >= 0 && j < nj && !quieto[j]; let i0 = -1, nb = 0;
      for (let i = 0; i <= fim && nb < 20; i++) { const zero = i < fim && chs.every(x => Math.abs(x[i]) < 1e-6); if (zero && i0 < 0) i0 = i; else if (!zero && i0 >= 0) { const n = i - i0;
        if (n >= sr * .005 && n < sr * .3 && i0 > 0 && i < fim && tem(Math.floor(i0 / jan) - 1) && tem(Math.floor(i / jan) + 1)) { const q = Math.min(N - 1, Math.floor(i0 / sr * fps)); poe('buraco', 'b' + q, `Buraco de ${Math.round(n / sr * 1000)} ms no som no quadro ${q + 1} (${tc(q)}): pode estalar.`, q); nb++; }
        i0 = -1; } }
    }
    pr(1, 'Pronto'); this._video = { id: P.id, assina: this.assina(P), n: N, itens, ultFala, lufs, pico, em: Date.now() }; return this._video;
  },
  async conta(P) { const L = await this.achar(P); return { L, erro: L.filter(x => x.nivel === 'erro').length, aviso: L.filter(x => x.nivel === 'aviso').length, dica: L.filter(x => x.nivel === 'dica').length }; },
  // ---------- a janela: lista (por grupo, com filtro) e Regras ----------
  async abrir() {
    const P = App.P, st = { aba: 'lista', filtro: 'tudo', fech: new Set() };
    const body = h(`<div class="rv"><div class="rv-topo"><div class="rv-abas"><button data-aba="lista">${ic('check', 13)} Conferência</button><button data-aba="regras">${ic('sliders', 13)} Regras</button></div><span class="sp"></span><div class="rv-filtro" data-filtro></div></div><div class="rv-corpo"></div></div>`), corpo = $('.rv-corpo', body);
    const NIV = { erro: ['alert', 'Erros'], aviso: ['alert', 'Avisos'], dica: ['info', 'Dicas'] };
    // CONFERIR O VÍDEO: desenha cada quadro (pequeno) e mede o som final; o resultado fica guardado até o projeto mudar
    const barraVideo = () => {
      const vc = this.videoConferido(P), b = h(`<div class="rv-vid"></div>`);
      if (st.vid) { b.innerHTML = `${ic('eye', 15)}<div class="rv-vid-t"><b>Conferindo o vídeo…</b><small data-vt>${esc(st.vid.txt || '')}</small><div class="rv-vid-barra"><i style="width:${Math.round((st.vid.f || 0) * 100)}%"></i></div></div><button class="btn sm">Parar</button>`;
        $('button', b).onclick = () => { st.vid.parar = true; }; st.vid.el = b; return b; }
      b.innerHTML = vc ? `${ic('check', 15)}<div class="rv-vid-t"><b>Vídeo conferido</b><small>${vc.n} quadros desenhados e o som final medido${vc.lufs != null ? ` (${String(vc.lufs.toFixed(1)).replace('.', ',')} LUFS, pico ${String(vc.pico.toFixed(1)).replace('.', ',')} dBTP)` : ''}. O que achou está no grupo "Vídeo pronto".</small></div><button class="btn sm">Conferir de novo</button>`
        : `${ic('eye', 15)}<div class="rv-vid-t"><b>O vídeo ainda não foi conferido quadro a quadro</b><small>Acha quadro preto, imagem congelada na fala, muito tempo sem corte, xadrez de vazio, texto em cima da legenda ou fora da área segura, silêncio e o volume final.</small></div><button class="btn sm primary">Conferir o vídeo</button>`;
      if (!vc) b.classList.add('rv-vid-nao');
      $('button', b).onclick = async () => {
        st.vid = { f: 0, txt: 'Preparando…' }; await pintaLista();
        try { await this.conferirVideo(P, (f, txt) => { st.vid.f = f; st.vid.txt = txt; const e = st.vid.el; if (e?.isConnected) { $('.rv-vid-barra i', e).style.width = Math.round(f * 100) + '%'; $('[data-vt]', e).textContent = txt; } }, () => st.vid?.parar || !body.isConnected); }
        catch (e) { if (e.message !== 'parado') UI.toast('Não deu para conferir o vídeo: ' + esc(e.message), { kind: 'err' }); }
        st.vid = null; if (body.isConnected) await pintaLista(); };
      return b;
    };
    const pintaLista = async () => {
      corpo.innerHTML = '<div class="rv-vaz"><span class="spin-dot"></span> Conferindo…</div>'; const L = await this.achar(P), ign = (P.revisorIgnora || []).length;
      const n = k => L.filter(x => x.nivel === k).length, fl = $('[data-filtro]', body);
      fl.innerHTML = [['tudo', `Tudo ${L.length}`], ['erro', `Erros ${n('erro')}`], ['aviso', `Avisos ${n('aviso')}`], ['dica', `Dicas ${n('dica')}`]].map(([k, t]) => `<button data-f="${k}" class="${st.filtro === k ? 'on' : ''} rv-f-${k}">${t}</button>`).join('');
      $$('[data-f]', fl).forEach(b => b.onclick = () => { st.filtro = b.dataset.f; pintaLista(); });
      const V = L.filter(x => st.filtro === 'tudo' || x.nivel === st.filtro); corpo.innerHTML = ''; corpo.appendChild(barraVideo());
      if (!V.length) corpo.appendChild(h(`<div class="rv-ok">${ic('check', 18)} ${L.length ? 'Nada com esse filtro.' : 'Tudo certo: não achei nada para arrumar.'}</div>`));
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
          const nums = num ? (Array.isArray(num) ? num : [num]) : [], vals = Array.isArray(num) ? this.num(id) : [this.num(id)];
          const r = h(`<div class="rv-regra"><label class="chk"><input type="checkbox" ${this.liga(id) ? 'checked' : ''}><span class="rv-n rv-n-${niv}"></span>${esc(nome)}</label>${nums.map((s, i) => `<span class="rv-num"><small>${esc(s.nome)}</small><input type="number" data-i="${i}" min="${s.min}" max="${s.max}" step="${s.passo}" value="${vals[i]}"><small>${esc(s.un)}</small></span>`).join('')}</div>`);
          $('input[type=checkbox]', r).onchange = e => { const o = this.cfg(); (o.on ||= {})[id] = e.target.checked; this.poeCfg(o); };
          $$('input[type=number]', r).forEach(ni => ni.onchange = e => { const o = this.cfg(), i = +ni.dataset.i, s = nums[i], v = clamp(Number.isFinite(+e.target.value) && e.target.value !== '' ? +e.target.value : s.v, s.min, s.max);
            if (Array.isArray(num)) { const a = this.num(id); a[i] = v; (o.n ||= {})[id] = a; } else (o.n ||= {})[id] = v; this.poeCfg(o); e.target.value = v; });
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
