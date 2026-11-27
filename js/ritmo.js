/* ===================== ritmo.js — RITMO AUTOMÁTICO dos Shorts (pedido da dona, 23/11/2026) =====================
   Numa animação já montada pelo Preparativos (vozes, legendas e personagens na linha do tempo), um botão põe sozinho:
   1. CÂMERA: plano médio (o enquadramento que já está) ⇄ close em CORTE SECO, sempre a MESMA câmera (só a chave de zoom; x, y e giro
      não mudam). Troca SÓ na mudança de QUEM fala e, dentro da fala, um close seco na palavra-chave que fica até o fim dela
      (decisão da dona, 26/11/2026; antes alternava a cada 1,5–2 s). Nunca dois cortes a menos de
      24 quadros. Close = zoom 1,35–1,6, o maior em que a cabeça de quem fala fica no quadro e a BOCA fica acima da legenda
      (com 1,8 a legenda cobriu a boca). Nenhum zoom serve = aquela fala fica no médio.
   2. LETREIRO + SOM: cada palavra-chave (marca 'd' dos blocos, l.chaves, *palavra* no texto, ou palavra em MAIÚSCULAS com 3+ letras)
      vira um texto grande no terço de cima (fonte da legenda, cor de quem fala, contorno escuro), entrada pop de 4 quadros no quadro em
      que a palavra é dita, até o fim da fala (máx. 2 s); no MESMO quadro, um som curto da biblioteca (SonsBib) ~3 dB abaixo da voz.
      No máximo 1 letreiro a cada 3 s (as outras palavras-chave ficam sem, e o plano diz quais).
   3. FINAL: na última fala a câmera fecha em passos secos a cada palavra (até zoom ~1,4), com 12 quadros ou mais entre os passos (referência: ~0,6 s).
   4. GESTOS NA FALA (js/gestos.js, 23/11): quem fala troca de gesto de braço a cada 1–2 palavras; entram e saem junto com o ritmo.
   Tudo criado leva a marca auto:'ritmo' (chave da câmera, camada de texto, áudio; os gestos ficam anotados em P.gestosAuto). Ritmo.tira tira só isso; rodar de novo = tira e refaz.
   Chaves feitas à mão e a pose dos personagens nunca mudam: só entra corte onde o zoom feito à mão está parado (entre chaves de zoom
   iguais ou depois da última) e nunca num quadro que já tem chave da câmera. Só animação nova (P.rive) e com legendas/vozes.
   Ritmo.planeja(P, o) é PURO (sem DOM): devolve { camera:[{q,zoom,corte,tipo}], letreiros:[{de,ate,texto,cor,quem}], sons:[{q,arq,vol}], pulados, motivo }.
   o = { somArq (chave do arquivo do som já guardado), durDe(a) (segundos de um áudio sem legenda) }. */
'use strict';
const Ritmo = {
  MIN: 24,               // quadros mínimos entre dois cortes
  MIN_FINAL: 12,         // no fechamento da última fala, entre um passo e o outro (referência da dona, 23/11: a câmera fecha a cada palavra, ~0,6 s)
  CLOSE: [1.6, 1.35],    // zoom do close: do maior para o menor
  FINAL: 1.4,            // zoom no fim da última fala
  TERCO: .2,             // altura do letreiro (meio dele) na tela
  DB: Math.pow(10, -3 / 20), // −3 dB
  SONS: ['pop', 'impacto', 'impact', 'swish', 'whoosh'],

  // ---------- leitura do projeto ----------
  ehAuto: x => x && x.auto === 'ritmo',
  limpaPal: w => String(w || '').replace(/^[^0-9A-Za-zÀ-ÿ]+|[^0-9A-Za-zÀ-ÿ]+$/g, ''),
  caps(w) { const l = String(w).replace(/[^A-Za-zÀ-ÿ]/g, ''); return l.length >= 2 && /* 2+ letras: "MENOS EU" (23/11) */ l === l.toLocaleUpperCase('pt-BR') && l !== l.toLocaleLowerCase('pt-BR'); },
  // palavras de uma legenda com o quadro em que começam: [{ t, q0, q1, chave, bloco (1ª do bloco) }]
  palavras(P, l) {
    const fps = P.fps || 24, out = [], marcadas = new Set((l.chaves || []).flatMap(c => String(c).split(/\s+/)).map(w => this.limpaPal(w).toLocaleLowerCase('pt-BR')).filter(Boolean));
    const ehChave = (w, d) => d || marcadas.has(this.limpaPal(w).toLocaleLowerCase('pt-BR')) || this.caps(this.limpaPal(w));
    if (l.blocos?.length) {
      for (const b of l.blocos) (b || []).forEach((p, i) => { if (!this.limpaPal(p[0])) return; out.push({ t: String(p[0]), q0: Math.round(l.de + (+p[1] || 0) * fps), q1: Math.round(l.de + (+p[2] || 0) * fps), chave: ehChave(p[0], p[3] === 'd'), bloco: i === 0 }); });
      return out;
    }
    if (l.pal?.length) { for (const w of l.pal) if (this.limpaPal(w[0])) out.push({ t: String(w[0]), q0: Math.round(+w[1]), q1: Math.round(+w[2]), chave: ehChave(w[0]), bloco: false }); return out; }
    // só o texto: tira "Nome: " do começo, *palavra* = palavra-chave, tempo dividido pelas letras
    let txt = String(l.texto || ''); if (l.quem && txt.startsWith(l.quem + ':')) txt = txt.slice(l.quem.length + 1);
    const toks = []; let dentro = false;
    for (const pedaco of txt.split(/(\*)/)) { if (pedaco === '*') { dentro = !dentro; continue; } for (const w of pedaco.split(/\s+/)) if (this.limpaPal(w)) toks.push({ t: w, d: dentro }); }
    const tot = toks.reduce((s, x) => s + x.t.length + 1, 0) || 1, n = (l.ate - l.de + 1); let acc = 0;
    for (const x of toks) { const q0 = Math.round(l.de + n * acc / tot); acc += x.t.length + 1; out.push({ t: x.t, q0, q1: Math.round(l.de + n * acc / tot) - 1, chave: ehChave(x.t, x.d), bloco: false }); }
    return out;
  },
  // as falas na ordem: pelas legendas; sem legenda, pelos áudios de voz
  falas(P, o = {}) {
    const fps = P.fps || 24, vozes = (P.audios || []).filter(a => !this.ehAuto(a) && (a.tipo === 'voz' || a.prep));
    const volDe = (de, ate) => { const a = vozes.find(v => v.de >= de - 2 && v.de <= ate); return a ? (a.vol ?? 1) : 1; };
    if ((P.legendas || []).length) return [...P.legendas].sort((a, b) => a.de - b.de).map(l => ({ de: l.de, ate: l.ate, quem: l.quem || null, quens: l.quem ? [l.quem] : [], cor: l.cor || '#ffffff', pal: this.palavras(P, l), vol: volDe(l.de, l.ate) }));
    const g = new Map(); for (const a of vozes) { const k = a.prep?.fala || a.id, d = a.dur ?? o.durDe?.(a); if (!d) continue; const ate = a.de + Math.ceil(d * fps) - 1, x = g.get(k);
      if (x) { x.de = Math.min(x.de, a.de); x.ate = Math.max(x.ate, ate); if (a._quem) x.quens.push(a._quem); } else g.set(k, { de: a.de, ate, quem: a._quem || null, quens: a._quens || (a._quem ? [a._quem] : []), cor: '#ffffff', pal: [], vol: a.vol ?? 1 }); }
    return [...g.values()].sort((a, b) => a.de - b.de);
  },
  // camadas do nível de cima, abrindo as pastas de papel (js/arvore.js, Organizar.topo: posição 0, escala 1, não mexem em nada)
  topo(P) { return typeof Organizar !== 'undefined' ? Organizar.topo(P) : (P?.raiz || []).flatMap(n => n.pastaPapel && n.filhos ? n.filhos : [n]); },
  // o personagem de quem fala (montagem do Preparativos: n._prepQuem; senão pelo nome da camada ou do personagem)
  noDe(P, quem) {
    if (!quem) return null; const k = s => String(s || '').normalize('NFC').trim().toLocaleLowerCase('pt-BR'), alvo = k(quem);
    const L = this.topo(P); // soltos no nível de cima ou dentro das pastas de papel (Personagens…), que não mexem em nada
    return L.find(n => n.tipo === 'personagem' && k(n._prepQuem) === alvo) || L.find(n => n.tipo === 'personagem' && (k(n.nome) === alvo || k(P.personagens?.[n.ref]?.nome) === alvo)) || null;
  },
  // cabeça do personagem no mundo: o terço de cima da caixa dele; a boca a 22% da altura (decisão: sem marcar a cabeça no personagem)
  cabeca(P, n, q) {
    const def = P.personagens?.[n.ref]; if (!def) return null; let b = null;
    try { const est = Modelo.estadoPersonagem(n, q), dv = Modelo.naVista ? Modelo.naVista(def, est.vista) : def; b = Modelo.caixaPersonagem(dv, Modelo.partesNoEstado(dv, est)); }
    catch { try { b = Modelo.caixaPersonagem(def, Modelo.partesNoEstado(def, {})); } catch { b = null; } }
    if (!b || !(b.h > 0)) return null;
    const t = Modelo.transf(n, q), s = t.s || 1, sx = (t.sx || 1) * s, X = x => t.x + x * sx, Y = y => t.y + y * s;
    const xa = X(b.x + b.w * .15), xb = X(b.x + b.w * .85);
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: Y(b.y), y1: Y(b.y + b.h * .3), boca: Y(b.y + b.h * .22), bx: X(b.x + b.w / 2) };
  },
  // ponto do mundo → ponto da tela (em px do vídeo) com a câmera c e o zoom z
  naTela(P, c, z, x, y) { const a = -(c.r || 0) * Math.PI / 180, dx = x - c.x, dy = y - c.y; return { x: P.w / 2 + z * (dx * Math.cos(a) - dy * Math.sin(a)), y: P.h / 2 + z * (dx * Math.sin(a) + dy * Math.cos(a)) }; },
  // topo da área da legenda (px do vídeo)
  topoLeg(P) { const e = P.legEstilo?.prep; if (e) return ((e.y ?? .82) - 1.2 * (+e.tamanho || .045)) * P.h; return P.h * .72; },
  // o zoom z deixa a cabeça de todos que falam no quadro e a boca acima da legenda, em todo o trecho [de, ate]?
  serve(P, Pb, f, z, de, ate) {
    const nos = (f.quens.length ? f.quens : [f.quem]).map(q => this.noDe(P, q)); if (!nos.length || nos.some(n => !n || !this.topo(P).includes(n))) return false;
    const m = P.w * .03, topo = this.topoLeg(P) - P.h * .01;
    for (const q of [...new Set([de, Math.round((de + ate) / 2), ate])]) {
      const c = Modelo.camera(Pb, q);
      for (const n of nos) { if (!Modelo.aparece(P, n, q) || n.vis === false || (Modelo.transf(n, q).op ?? 1) < .05 /* voz de fora (js/prep.js): escondido */) return false; const h = this.cabeca(P, n, q); if (!h) return false;
        const a = this.naTela(P, c, z, h.x0, h.y0), b = this.naTela(P, c, z, h.x1, h.y1), bo = this.naTela(P, c, z, h.bx, h.boca);
        if (Math.min(a.x, b.x) < m || Math.max(a.x, b.x) > P.w - m || Math.min(a.y, b.y) < m || bo.y > topo || Math.max(a.y, b.y) > topo) return false; } // do PESCOÇO para cima nunca na legenda (dona, 27/11): a base da cabeça fica acima dela
    }
    return true;
  },
  zoomClose(P, Pb, f, de, ate, medio) {
    for (let z = this.CLOSE[0]; z >= this.CLOSE[1] - 1e-9; z = Math.round((z - .05) * 100) / 100) if (z >= medio + .15 && this.serve(P, Pb, f, z, de, ate)) return z;
    return null;
  },

  // ---------- o plano (PURO) ----------
  planeja(P, o = {}) {
    const vazio = motivo => ({ camera: [], letreiros: [], sons: [], pulados: [], motivo });
    if (!P?.rive) return vazio('Só funciona em animação nova.');
    const fps = P.fps || 24, falas = this.falas(P, o).filter(f => f.ate >= f.de);
    if (!falas.length) return vazio('A animação não tem legendas nem vozes.');
    // a câmera só com as chaves feitas à mão
    const maos = Object.fromEntries(Object.entries(P.camera?.chaves || {}).filter(([, k]) => !this.ehAuto(k))), Pb = { ...P, camera: { ...(P.camera || {}), chaves: maos } };
    const kMao = new Set(Object.keys(maos).map(Number)), kZoom = Object.keys(maos).map(Number).filter(k => maos[k].zoom != null).sort((a, b) => a - b);
    // zoom feito à mão parado em q (e até onde fica parado)
    const parado = q => { let a = null, b = null; for (const k of kZoom) { if (k <= q) a = k; else { b = k; break; } } return { ok: a == null || b == null || maos[a].zoom === maos[b].zoom, ate: b == null ? Infinity : b }; };
    const medio = q => Modelo.camera(Pb, q).zoom || 1, fim = Math.max(0, (P.duracao || 1) - 1);
    const cam = []; let ult = -Infinity, estado = 'medio';
    const pode = q => q >= 0 && q <= fim && q - ult >= this.MIN && !kMao.has(q) && parado(q).ok;
    const corta = (q, zoom, tipo) => { cam.push({ q, zoom: Math.round(zoom * 1000) / 1000, corte: true, tipo }); ult = q; estado = tipo === 'medio' ? 'medio' : 'close'; };
    // close que não consegue voltar ao médio antes da próxima chave de zoom feita à mão não entra
    const volta = q => { const p = parado(q); return p.ate === Infinity || p.ate - q - 1 >= this.MIN; };
    const ultima = falas[falas.length - 1]; // a última fala fica para o fechamento
    for (let i = 0; i < falas.length - 1; i++) {
      const f = falas[i], prox = falas[i + 1], limite = prox ? prox.de - this.MIN : fim; // corte dentro da fala não pode segurar o corte da próxima
      const md = medio(f.de), zc = this.zoomClose(P, Pb, f, f.de, f.ate, md);
      const bordas = [f.de, ...f.pal.map(p => p.q0).filter(q => q > f.de && q < f.ate)];
      // 1) só na TROCA DE QUEM FALA (decisão da dona, 26/11/2026): alterna médio ⇄ close (sem close possível = médio); a 1ª fala abre no
      //    médio (o plano que já está); a mesma pessoa continuando = o plano fica
      const quem = x => x.quens.length ? x.quens.join('|') : (x.quem || ''), mudou = i === 0 || quem(f) !== quem(falas[i - 1]);
      if (mudou) { const quer = i > 0 && zc && estado === 'medio' ? 'close' : 'medio';
        if (quer !== estado) { const q = bordas.find(b => pode(b) && b <= f.ate - 6 && (quer === 'medio' || volta(b))); if (q != null) corta(q, quer === 'close' ? zc : medio(q), quer); } }
      // 2) dentro da fala, só UM close seco na palavra-chave, que fica até o fim da fala (já em close = não fecha mais; nada de alternar a cada 1,5–2 s)
      if (zc && estado === 'medio') { const pk = f.pal.find(p => p.chave && p.q0 >= f.de && p.q0 <= Math.min(f.ate - 6, limite) && pode(p.q0) && volta(p.q0)); if (pk) corta(pk.q0, zc, 'close'); }
    }
    // chave de zoom feita à mão logo depois de um close: volta ao médio antes dela (ou o close sai)
    for (const k of kZoom) {
      for (let g = 0; g < 50; g++) { const antes = cam.filter(c => c.q < k), u = antes[antes.length - 1]; if (!u || u.tipo === 'medio') break;
        const q = k - 1; if (q - u.q >= this.MIN && !kMao.has(q)) { cam.splice(cam.indexOf(u) + 1, 0, { q, zoom: Math.round(medio(q) * 1000) / 1000, corte: true, tipo: 'medio' }); break; }
        cam.splice(cam.indexOf(u), 1); } // sem espaço para voltar: o close sai (médios seguidos são limpos abaixo)
    }
    for (let i = 1; i < cam.length; i++) if (cam[i].q - cam[i - 1].q < this.MIN) cam.splice(i--, 1); // segurança: nunca dois cortes a menos de 24 quadros
    for (let i = cam.length - 1; i > 0; i--) if (cam[i].tipo === 'medio' && cam[i - 1].tipo === 'medio') cam.splice(i, 1);
    if (cam[0]?.tipo === 'medio') cam.shift();
    ult = cam.length ? cam[cam.length - 1].q : -Infinity; estado = cam.length && cam[cam.length - 1].tipo !== 'medio' ? 'close' : 'medio';
    // 3) FINAL: a última fala volta ao médio e fecha a cada palavra (passos secos) até ~1,4
    if (ultima) {
      const f = ultima, md = medio(f.de);
      if (estado !== 'medio') { const q = [f.de, ...f.pal.map(p => p.q0)].find(b => b >= f.de && pode(b)); if (q != null) corta(q, medio(q), 'medio'); }
      let alvo = null; for (let z = this.FINAL; z >= md + .1 - 1e-9; z = Math.round((z - .05) * 100) / 100) if (this.serve(P, Pb, f, z, f.de, Math.max(f.de, f.ate))) { alvo = z; break; }
      if (alvo != null && estado === 'medio') {
        const qs = []; let u = ult; for (const p of f.pal) { const q = p.q0; if (q > f.de - 1 && q <= Math.min(f.ate, fim) && q - u >= (qs.length ? this.MIN_FINAL : this.MIN) && !kMao.has(q) && parado(q).ok && parado(q).ate === Infinity) { qs.push(q); u = q; } }
        if (!f.pal.length) for (let q = Math.max(f.de, ult + this.MIN); q <= f.ate; q += this.MIN_FINAL) if (!kMao.has(q) && parado(q).ok && parado(q).ate === Infinity) qs.push(q);
        // o 1º passo não pode ser no próprio começo se a fala começou com um corte para o médio
        const z0 = medio(qs[0] ?? f.de); qs.forEach((q, i) => corta(q, z0 + (alvo - z0) * (i + 1) / qs.length, 'final'));
      }
    }
    // 4) LETREIROS + SOM: palavra-chave, no máximo 1 a cada 3 s
    const letreiros = [], sons = [], pulados = [], gap = Math.round(3 * fps); let ul = -Infinity;
    for (const f of falas) for (let j = 0; j < f.pal.length; j++) { const p = f.pal[j];
      if (!p.chave) continue;
      // palavras-chave SEGUIDAS viram um letreiro só ("Menos eu" → MENOS EU, teste de 23/11)
      let k = j; while (k + 1 < f.pal.length && f.pal[k + 1].chave) k++;
      const txt = f.pal.slice(j, k + 1).map(x => this.limpaPal(x.t)).filter(Boolean).join(' ').toLocaleUpperCase('pt-BR'); j = k; if (!txt) continue;
      if (p.q0 - ul < gap || p.q0 > fim) { pulados.push({ q: p.q0, texto: txt }); continue; }
      const ate = Math.min(f.ate, p.q0 + Math.round(2 * fps) - 1, fim);
      letreiros.push({ de: p.q0, ate: Math.max(p.q0 + 4, ate), texto: txt, cor: f.cor || '#ffffff', quem: f.quem });
      sons.push({ q: p.q0, arq: o.somArq || null, vol: Math.round((f.vol ?? 1) * this.DB * 1000) / 1000 }); ul = p.q0;
    }
    return { camera: cam, letreiros, sons, pulados, motivo: null };
  },

  // ---------- pôr e tirar ----------
  aplica(P, plano) {
    P.camera ||= { chaves: {} }; P.camera.chaves ||= {};
    for (const c of plano.camera || []) { if (P.camera.chaves[c.q]) continue; P.camera.chaves[c.q] = { zoom: c.zoom, ir: 'corte', auto: 'ritmo' }; }
    const fonte = /^[A-Za-z0-9 ]{1,40}$/.test(P.legEstilo?.prep?.fonte || '') ? P.legEstilo.prep.fonte : 'Rubik';
    let i0 = 0; while (P.raiz[i0]?.tipo === 'efeito') i0++; // na frente, depois só das camadas de efeito do topo
    const novos = [];
    for (const l of plano.letreiros || []) {
      const tam = Math.round(Math.min(P.h * .085, P.w * .86 / Math.max(1, l.texto.length * .62)));
      const n = Modelo.novoNo('texto', { nome: 'Letreiro: ' + l.texto, de: l.de });
      Object.assign(n, { texto: l.texto, cor: l.cor, tam, fonte, borda: '#111111', bordaL: Math.max(4, Math.round(tam * .14)), negrito: true, ate: l.ate, entra: { tipo: 'pop', q: 4 }, interp: true, auto: 'ritmo' });
      // preso na tela: a cada mudança da câmera no trecho, uma chave seca que segura o letreiro no mesmo lugar e tamanho da tela
      n.chaves = {}; let ant = null;
      for (let q = l.de; q <= l.ate; q++) { const c = Modelo.camera(P, q), z = c.zoom || 1, sig = [c.x, c.y, z, c.r].map(v => Math.round((v || 0) * 1000)).join(',');
        if (sig === ant) continue; ant = sig; const a = (c.r || 0) * Math.PI / 180, dx = 0, dy = (P.h * this.TERCO - P.h / 2) / z;
        n.chaves[q] = { x: Math.round((c.x + dx * Math.cos(a) - dy * Math.sin(a)) * 10) / 10, y: Math.round((c.y + dx * Math.sin(a) + dy * Math.cos(a)) * 10) / 10, r: Math.round((c.r || 0) * 100) / 100, s: Math.round(1000 / z) / 1000, sx: 1, op: 1, ...(q > l.de ? { ir: 'corte' } : {}) }; }
      novos.push(n);
    }
    P.raiz.splice(i0, 0, ...novos);
    for (const s of plano.sons || []) { if (!s.arq) continue; const l = (plano.letreiros || []).find(x => x.de === s.q);
      P.audios.push({ id: uid('au'), nome: 'Ritmo: ' + (l?.texto || 'som'), arq: s.arq, de: s.q, vol: s.vol, tipo: 'efeito', auto: 'ritmo' }); }
    return { cortes: (plano.camera || []).length, letreiros: novos.length, sons: (plano.sons || []).filter(s => s.arq).length };
  },
  tira(P) {
    let n = 0; const ch = P.camera?.chaves || {};
    for (const [q, k] of Object.entries(ch)) { if (!this.ehAuto(k)) continue; n++;
      // a pessoa mexeu nesta chave (tem x, y…): ela virou feita à mão, só sai a marca
      if (Object.keys(k).some(c => !['zoom', 'ir', 'auto'].includes(c))) delete k.auto; else delete ch[q]; }
    const limpa = L => { for (let i = L.length - 1; i >= 0; i--) { if (this.ehAuto(L[i])) { L.splice(i, 1); n++; } else if (L[i].filhos) limpa(L[i].filhos); } };
    limpa(P.raiz || []);
    if (P.audios) { const a = P.audios.length; P.audios = P.audios.filter(x => !this.ehAuto(x)); n += a - P.audios.length; }
    if (this.G()) n += Gestos.tira(P); // os gestos na fala saem junto (js/gestos.js)
    return n;
  },
  G: () => typeof Gestos !== 'undefined', // gestos.js veio? (o index.html do site fica até 10 min em cache: pode não ter vindo)
  tem(P) { return !!P && (Object.values(P.camera?.chaves || {}).some(k => this.ehAuto(k)) || Modelo.todos(P).some(n => this.ehAuto(n)) || (P.audios || []).some(a => this.ehAuto(a)) || (this.G() && Gestos.tem(P))); },

  // ---------- no navegador ----------
  // o som curto da biblioteca: 1º efeito (não música) com "pop", senão "impacto"…; guardado no projeto uma vez só
  async som() {
    if (typeof SonsBib === 'undefined') return null; const ix = await SonsBib.indice();
    for (const w of this.SONS) { const it = ix.find(i => !i.mus && i.busca.split(/[^a-z0-9]+/).includes(w)) || ix.find(i => !i.mus && i.busca.includes(w)); if (!it) continue;
      const arq = await Arq.guardar(await SonsBib.blob(it)); try { await Som.decod(arq); } catch { } return arq; }
    return null;
  },
  async rodar() {
    const P = App.P; if (!P) return;
    if (!P.rive) return UI.toast('O ritmo automático só funciona em animação nova.', { kind: 'warn' });
    if (!(P.legendas || []).length && !(P.audios || []).some(a => a.tipo === 'voz')) return UI.toast('Ponha as vozes e as legendas primeiro (Preparativos › Montar animação).', { kind: 'warn' });
    let somArq = null; try { somArq = await this.som(); } catch (e) { console.warn('ritmo: som', e); }
    const tinha = this.tem(P); this.tira(P);
    const o = { somArq, durDe: a => a.dur ?? Som.buf?.get(a.arq)?.duration };
    const plano = this.planeja(P, o);
    if (plano.motivo) { App.commit('Ritmo automático'); return UI.toast(plano.motivo, { kind: 'warn' }); }
    const r = this.aplica(P, plano);
    // GESTOS NA FALA (js/gestos.js) entram junto, no mesmo passo do desfazer, DEPOIS da câmera (a borda do vídeo é medida com o zoom do ritmo).
    // Cada episódio é simulado com o desenho real (Gestos.testador ao escolher, Gestos.valida no fim). Sem o arquivo (cache do site), segue sem eles.
    let g = null; if (this.G()) try { const og = { ...o, teste: Gestos.testador(P), rejeitados: [] }, v = Gestos.valida(P, Gestos.planeja(P, og)); g = Gestos.aplica(P, v.plano);
      const rej = [...og.rejeitados, ...v.rejeitados]; if (rej.length) console.info('[gestos] gestos que não entraram:', rej); } catch (e) { console.warn('gestos', e); }
    // ORGANIZAR EM PASTAS (js/arvore.js): os letreiros novos entram na pasta Letreiros (sem mudar nada na tela), no mesmo passo do desfazer
    try { if (typeof Organizar !== 'undefined') Organizar.pastas(P); } catch (e) { console.warn('organizar', e); }
    const gtxt = g?.gestos ? ` · gestos de braço na fala` : '';
    App.commit('Ritmo automático');
    UI.toast(`Ritmo automático${tinha ? ' refeito' : ''}: ${r.cortes} corte${r.cortes === 1 ? '' : 's'} de câmera, ${r.letreiros} letreiro${r.letreiros === 1 ? '' : 's'}${r.sons ? ` com som` : somArq ? '' : ' (sem som: a biblioteca não respondeu)'}${gtxt}${plano.pulados.length ? ` · ${plano.pulados.length} palavra${plano.pulados.length === 1 ? '' : 's'}-chave sem letreiro (menos de 3 s da anterior)` : ''}.`, { kind: 'ok', time: 7000 });
  },
  tirar() { const P = App.P; if (!P || !this.tem(P)) return; this.tira(P); if (typeof Organizar !== 'undefined') Organizar.limpaVazias(P); App.commit('Tirar o ritmo automático'); UI.toast('Ritmo automático tirado (cortes, letreiros, sons e gestos). O resto da animação ficou como estava.', { kind: 'ok' }); },
};
if (typeof module !== 'undefined') module.exports = Ritmo;
