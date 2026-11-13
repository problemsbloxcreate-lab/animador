/* ===================== cenvideo.js — CENÁRIO EM VÍDEO PRESO À CÂMERA (12/11/2026) =====================
   Nó { tipo: 'video', arq, vfps, vquadros, vw, vh, de, ate, presoCamera: true } na hierarquia (P.raiz). O mp4 fica no armazenamento
   de arquivos (Arq, DB 'arquivos', igual às imagens); o projeto só guarda a chave (n.arq). Entra no Toon.ids, então vai junto no
   .animador, na nuvem da animação (js/nuvemanim.js) e no ao vivo como qualquer imagem/áudio.
   No quadro q da timeline desenha o quadro do vídeo do tempo (q - de) / P.fps cobrindo o QUADRO DA CÂMERA inteiro (Render.umNo passa
   `fr` = px do vídeo final → tela): não sofre pan/zoom/giro da câmera. Fora de [de, de + duração) não desenha nada.
   - Parado / scrub: busca o quadro (seek no <video>, espera 'seeked') e copia num canvas; enquanto não chega, mostra o último que chegou.
   - Tocando: o <video> toca de verdade (play(), mudo; sem seek a cada quadro) e só é corrigido (seek) quando escorrega mais de 1 quadro
     do relógio da timeline (e nunca no meio de outra busca).
   - Exportar (js/exportar.js): `await CenarioVideo.prepara(P, q)` antes de cada quadro = quadro EXATO (outro <video>, só do export,
     para o palco não brigar com ele), e o Render.quadro do export roda com `CenarioVideo.emExport = true`.
   Por script: `await CenarioVideo.adicionar(blobOuFile, { nome, inicio: 0, posicao: 'fundo' | 'topo' })`.
   TRANSPARÊNCIA (12/11/2026): aceita WebM VP9 com canal alfa (yuva420p): o Chrome decodifica o alfa e o drawImage do <video> o mantém;
   o canvas de cada quadro é limpo antes de copiar (senão o quadro de antes aparecia nos buracos). posicao 'topo' = na FRENTE dos
   personagens (topo da hierarquia, logo abaixo das camadas de efeito que valem a animação toda, para o visual valer nele também).
   O export espera o quadro exato de TODOS os vídeos visíveis no quadro (um <video> de export para cada nó). */
'use strict';
const CenarioVideo = {
  els: new Map(), // 'ed:<id do nó>' (palco) / 'exp:<id do nó>' (export) → { arq, v, url, cv, f, alvo, ocupado, laco, pronto }
  emExport: false,

  // tempo da timeline → índice do quadro no vídeo (ou -1 fora do vídeo)
  quadroDe(P, n, q) {
    if (n.tipo !== 'video' || !n.arq) return -1; const fpsV = n.vfps || P.fps || 24, t = (q - (n.de || 0)) / (P.fps || 24); if (t < 0) return -1;
    const f = Math.floor(t * fpsV + 1e-6); return n.vquadros && f >= n.vquadros ? -1 : f;
  },
  // quantos quadros da timeline o vídeo ocupa
  duracaoQ(P, n) { return Math.max(1, Math.ceil((n.vquadros || 1) * (P.fps || 24) / (n.vfps || P.fps || 24) - 1e-6)); },

  /* ---------- o <video> de cada nó ---------- */
  _caixa() { let d = document.getElementById('cenvideo-els'); if (!d) { d = document.createElement('div'); d.id = 'cenvideo-els'; d.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;z-index:-1'; document.body.appendChild(d); } return d; }, // no DOM (invisível): o navegador decodifica sem pausar o vídeo
  el(n, canal = 'ed', arq = n.arq) { // canal 'px' = a cópia leve (PROXY, arq = n.proxy) que o palco usa tocando
    const ch = canal + ':' + n.id; let e = this.els.get(ch); if (e && e.arq === arq) return e; if (e) this.solta1(ch);
    e = { arq, v: null, url: null, cv: null, f: -1, alvo: null, ocupado: false, laco: null, falhou: 0 }; this.els.set(ch, e);
    e.pronto = (async () => {
      let b = await Arq.pegaBlob(arq).catch(() => null); if (!b) { e.falhou = Date.now(); return false; } // ainda não chegou (nuvem/ao vivo): tenta de novo depois
      if (!b.type || b.type === 'application/octet-stream') b = new Blob([b], { type: await this.tipo(b) }); // veio de um .animador (zip): sem o tipo
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; e.url = URL.createObjectURL(b); v.src = e.url; this._caixa().appendChild(v);
      await new Promise(ok => { if (v.readyState >= 2) return ok(); const fim = () => { v.removeEventListener('loadeddata', fim); v.removeEventListener('error', fim); ok(); }; v.addEventListener('loadeddata', fim); v.addEventListener('error', fim); });
      if (v.error || !v.videoWidth) { e.falhou = Date.now(); console.warn('[cenário em vídeo] não abriu', arq, v.error); v.remove(); return false; }
      e.cv = document.createElement('canvas'); e.cv.width = v.videoWidth; e.cv.height = v.videoHeight; if (canal === 'px') v._px = e.cv._px = true; e.v = v; return true; // e.v só depois de abrir: sem ele ninguém busca nem desenha
    })();
    return e;
  },
  solta1(ch) { const e = this.els.get(ch); if (!e) return; this.els.delete(ch); try { e.v?.pause(); e.v?.removeAttribute('src'); e.v?.load(); e.v?.remove(); } catch { } if (e.url) URL.revokeObjectURL(e.url); },
  solta(canal) { for (const ch of [...this.els.keys()]) if (!canal || ch.startsWith(canal + ':')) this.solta1(ch); },

  /* ---------- buscar um quadro (seek) e copiar no canvas ---------- */
  async busca(e, f, fpsV) {
    const v = e.v; if (!v) return; if (!v.paused) v.pause();
    const t = (f + .5) / fpsV; // meio do quadro: o navegador mostra exatamente o quadro f
    await new Promise(ok => { let to = 0; const fim = () => { clearTimeout(to); v.removeEventListener('seeked', fim); ok(); }; to = setTimeout(fim, 5000); v.addEventListener('seeked', fim); v.currentTime = t; });
    const g = e.cv.getContext('2d'); g.clearRect(0, 0, e.cv.width, e.cv.height); g.drawImage(v, 0, 0, e.cv.width, e.cv.height); e.f = f; // limpa antes: vídeo com transparência
  },
  // vai buscando até chegar no quadro pedido (o último pedido vale: no scrub os do meio são pulados)
  pede(e, f, fpsV, aoChegar) {
    e.alvo = f; if (e.ocupado) return e.laco; e.ocupado = true;
    return (e.laco = (async () => {
      await null; // espera o desenho de agora terminar (casca de cebola etc. pedem outros quadros antes do de agora)
      try { if (!await e.pronto) return; while (e.alvo != null && e.alvo !== e.f) { await this.busca(e, e.alvo, fpsV); aoChegar?.(); } }
      catch (err) { console.warn('[cenário em vídeo]', err); } finally { e.ocupado = false; }
    })());
  },

  /* ---------- o que o Render desenha (sem esperar) ---------- */
  desenhavel(P, n, q) {
    const f = this.quadroDe(P, n, q); if (f < 0) return null; const fpsV = n.vfps || P.fps || 24;
    if (this.emExport) { const e = this.els.get('exp:' + n.id); return e && e.f === f ? e.cv : null; } // o export já esperou o quadro (prepara)
    if (!this.temProxy(n)) this.pedeProxy(P, n); // sem a cópia leve (projeto antigo, veio da nuvem/ao vivo, Ctrl+Z…): prepara em segundo plano
    else if (typeof PreviaLeve !== 'undefined' && PreviaLeve.ativa && typeof App !== 'undefined' && App.tocando && App.P === P) { // PROXY: tocando no palco com a Prévia leve = a cópia leve
      const ep = this.el(n, 'px', n.proxy); if (ep.v) return this.tocaEl(ep, f, fpsV, P);
      if (ep.falhou && Date.now() - ep.falhou > 5000) this.solta1('px:' + n.id); // não abriu (ainda): o original abaixo, e tenta de novo depois
    }
    const e = this.el(n); if (!e.v) { if (e.falhou && Date.now() - e.falhou > 5000) this.solta1('ed:' + n.id); e.pronto?.then(ok => ok && Render.aoChegarImagem?.()); return null; }
    const tocando = typeof App !== 'undefined' && App.tocando && App.P === P;
    if (tocando) return this.tocaEl(e, f, fpsV, P); // TOCANDO: o <video> anda sozinho e é corrigido se escorregar do relógio da timeline
    if (!e.v.paused) e.v.pause();
    if (e.f !== f) this.pede(e, f, fpsV, () => Render.aoChegarImagem?.());
    return e.f >= 0 ? e.cv : null; // enquanto o quadro certo não chega, o último que chegou (o scrub não pisca)
  },
  // TOCANDO (palco): play() de verdade; corrige só se escorregar mais de 1 quadro do relógio da timeline
  tocaEl(e, f, fpsV, P) {
    if (e.f === f) return e.cv; e.alvo = null; const t = (f + .5) / fpsV, v = e.v;
    if (v.paused) { if (!e.ocupado) { v.currentTime = t; v.play().catch(() => { }); } }
    else if (!v.seeking && Math.abs(v.currentTime - t) > 1.5 / fpsV) v.currentTime = t; // tolerância de ±1 quadro (o meio do quadro ± 1,5 = até 1 quadro de diferença); só busca de novo se escorregar mais, e nunca no meio de outra busca
    e.usado = performance.now(); const vigia = () => { if (!(App.tocando && App.P === P) || performance.now() - e.usado > 900) v.pause(); else e.to = setTimeout(vigia, 300); };
    clearTimeout(e.to); e.to = setTimeout(vigia, 300); // parou de tocar, ou ninguém desenhou este <video> por ~1 s (saiu do trecho, trocou entre proxy e original): pausa
    return v.readyState >= 2 ? v : (e.f >= 0 ? e.cv : null);
  },
  // desenha cobrindo o quadro da câmera (fr = px do vídeo final → tela), sem distorcer (cobre e corta o que sobrar)
  desenha(ctx, P, n, q, fr) {
    const im = this.desenhavel(P, n, q); if (!im) return false; let iw = im.videoWidth || im.width, ih = im.videoHeight || im.height; if (!iw || !ih) return false;
    if (im._px && n.vw && n.vh) { iw = n.vw; ih = n.vh; } // PROXY: esticado no mesmo retângulo do original
    const k = Math.max(P.w / iw, P.h / ih), w = iw * k, h = ih * k; ctx.setTransform(fr || new DOMMatrix()); ctx.drawImage(im, (P.w - w) / 2, (P.h - h) / 2, w, h); return true;
  },

  /* ---------- export: quadro EXATO ---------- */
  nos(P) { return Modelo.todos(P).filter(n => n.tipo === 'video' && n.arq); },
  tem(P) { return this.nos(P).length > 0; },
  async prepara(P, q) {
    const vivos = []; Render.cadaVisivel(P, q, n => { if (n.tipo === 'video') vivos.push(n); }); // só os visíveis neste quadro (pasta escondida/fora do tempo não)
    await Promise.all(vivos.map(async n => { const f = this.quadroDe(P, n, q); if (f < 0) return; const e = this.el(n, 'exp'); if (!await e.pronto) return;
      while (e.f !== f) await this.pede(e, f, n.vfps || P.fps || 24); }));
  },

  /* ---------- criar ---------- */
  // tipo pelo começo do arquivo: WebM/Matroska começa com 1A 45 DF A3 (o resto vai como mp4)
  async tipo(b) { try { const u = new Uint8Array(await b.slice(0, 4).arrayBuffer()); if (u[0] === 0x1a && u[1] === 0x45 && u[2] === 0xdf && u[3] === 0xa3) return 'video/webm'; } catch { } return 'video/mp4'; },
  // lê duração e tamanho do vídeo
  async info(blob) {
    const u = URL.createObjectURL(blob), v = document.createElement('video'); v.muted = true; v.preload = 'metadata'; v.src = u;
    try { await new Promise((ok, no) => { v.onloadedmetadata = ok; v.onerror = () => no(new Error('Não consegui abrir esse vídeo (use mp4 H.264, ou WebM VP9 para transparência).')); });
      let d = v.duration; if (!isFinite(d)) { v.currentTime = 1e7; await new Promise(ok => { v.onseeked = ok; setTimeout(ok, 3000); }); d = v.duration; } // mp4 sem a duração no começo
      return { dur: isFinite(d) ? d : 0, w: v.videoWidth, h: v.videoHeight }; }
    finally { v.removeAttribute('src'); v.load(); URL.revokeObjectURL(u); }
  },
  /* API por script: await CenarioVideo.adicionar(blobOuFile, { nome, inicio = 0, fps = 24, posicao = 'fundo', P = App.P, salvar = true, proxy = true })
     Guarda o vídeo nos arquivos e salva o projeto. Devolve o nó. posicao 'fundo' = camada MAIS DE BAIXO (logo acima do "Fundo padrão",
     que é uma folha branca do tamanho da câmera e o esconderia); 'topo' = na frente de tudo (WebM com alfa por cima dos personagens),
     logo abaixo das camadas de efeito que estão no topo (o visual/efeitos do vídeo todo continuam valendo nele). */
  async adicionar(arquivo, o = {}) {
    const P = o.P || (typeof App !== 'undefined' ? App.P : null); if (!P) throw new Error('Abra uma animação antes.'); if (!(arquivo instanceof Blob)) throw new Error('Mande um Blob ou File de vídeo (mp4).');
    let blob = arquivo; if (!blob.type || blob.type === 'application/octet-stream') blob = new Blob([blob], { type: await this.tipo(blob) });
    const topo = o.posicao === 'topo'; if (o.posicao && !topo && o.posicao !== 'fundo') throw new Error("posicao: 'fundo' ou 'topo'.");
    const inf = await this.info(blob), vfps = +o.fps || 24, vquadros = Math.max(1, Math.round(inf.dur * vfps));
    const arq = await Arq.guardar(blob, uid('vid'));
    const nome = String(o.nome || arquivo.name?.replace(/\.[^.]+$/, '') || 'Cenário em vídeo').slice(0, 60), de = Math.max(0, Math.round(+o.inicio || 0));
    const n = Modelo.novoNo('video', { nome, de }); Object.assign(n, { arq, vfps, vquadros, vw: inf.w, vh: inf.h, presoCamera: true }); if (topo) n.frente = true; else n.cenario = true;
    n.ate = de + this.duracaoQ(P, n) - 1;
    if (topo) { let i = 0; while (P.raiz[i]?.tipo === 'efeito') i++; P.raiz.splice(i, 0, n); } // na frente: depois só das camadas de efeito do topo
    else { const i = P.raiz.findIndex(x => x.fundoPadrao); if (i >= 0) P.raiz.splice(i, 0, n); else P.raiz.push(n); } // o 1º da lista fica na frente: o fim é o fundo
    if (inf.w !== P.w || inf.h !== P.h) UI?.toast?.(`O vídeo é ${inf.w}×${inf.h} e a animação ${P.w}×${P.h}: ele cobre o quadro da câmera e corta o que sobrar.`, { kind: 'warn', time: 6000 });
    if (o.salvar !== false) {
      if (typeof App !== 'undefined' && App.P === P) { App.sel = n.id; App.commit('Vídeo de cenário'); await App.salvarJa(); }
      else { P.modificado = Date.now(); await DB.put('projetos', JSON.parse(JSON.stringify(P))); }
    }
    if (o.proxy !== false && this.PROXY_AUTO && this.precisaProxy(n)) this.agendaProxies(P); // PROXY: a cópia leve para o play, em segundo plano (salva o projeto no fim)
    return n;
  },
  // botão/menu: escolhe o arquivo de vídeo e põe no quadro de agora
  async escolher(o = {}) {
    if (!App.P) return; const [f] = await pickFiles('video/mp4,video/webm,video/*', false); if (!f) return;
    const t = UI.toast('<span class="spin-dot"></span> Guardando o vídeo…', { time: 120000 });
    try { const n = await this.adicionar(f, { nome: f.name.replace(/\.[^.]+$/, ''), inicio: App.q, posicao: o.posicao }); UI.toast(`<b>${esc(n.nome)}</b> entrou como ${n.frente ? 'vídeo NA FRENTE' : 'cenário em vídeo'} (preso à câmera), do quadro ${n.de + 1} ao ${n.ate + 1}.`, { kind: 'ok' }); }
    catch (e) { UI.toast(esc(e.message || String(e)), { kind: 'err' }); } finally { t.remove(); }
  },
};

/* ===================== PROXY — CÓPIA LEVE PARA O PLAY (13/11/2026) =====================
   Sem placa de vídeo (Chrome no "Microsoft Basic Render Driver") dois vídeos 1920×1080 + efeitos travam o play. Cada nó de vídeo ganha
   uma cópia de PROXY_W px de largura (960×540 por padrão), com os MESMOS quadros e fps, guardada no Arq/DB 'arquivos' na chave
   `proxy:<n.arq>:<largura>` (n.proxy; a chave sai do original, então Ctrl+Z/nuvem/ao vivo que percam o n.proxy só reencontram a cópia).
   - Formato: WebM VP8 (VP9 se o VP8 faltar) feito AQUI pelo WebCodecs (VideoEncoder) e empacotado por `WebmMux` (abaixo). Com
     transparência (WebM com AlphaMode, ou n.frente) o alfa vai do jeito do próprio WebM: um 2º VideoEncoder codifica o alfa como
     imagem cinza (Y = alfa) e cada quadro leva esse pedaço em BlockAdditions (BlockAddID 1) + AlphaMode = 1 na trilha — igual ao
     WebM VP9 com alfa que o ffmpeg faz, e o <video> do Chrome decodifica o alfa sozinho. (O VideoEncoder do Chrome não entrega o
     alfa junto, por isso os dois encoders.) Sem sequência de imagens: o play usa o mesmo caminho de <video> de antes (play() +
     correção se escorregar), só que com 4× menos pixels para decodificar e desenhar.
   - Quadros de onde: o <video> do original TOCANDO (requestVideoFrameCallback: cada quadro apresentado é desenhado reduzido e vai
     para o encoder); o quadro que o navegador pular (ou aba escondida / play da timeline) é buscado com seek exato (+ .5 quadro, como
     o export). Cada índice f do proxy = o quadro do original que aparece em (f + .5) / vfps, o mesmo que o palco/export mostram.
   - Segundo plano: um vídeo por vez (fila), aviso com a % no canto, pausa enquanto a timeline toca; no fim grava e salva o projeto.
     Automático ao ADICIONAR (CenarioVideo.adicionar), ao ABRIR um projeto (App.abrir → aoAbrir) e quando o palco acha um vídeo sem
     cópia. Por script: `await CenarioVideo.gerarProxies(P, { largura })`.
   - Uso: SÓ no palco tocando com a "Prévia leve" ligada (PreviaLeve.ativa); parado/scrub = original; EXPORT/PNG = sempre o original.
   - O proxy NÃO entra no Toon.ids (não vai no .animador, na nuvem nem no ao vivo): cada computador faz o seu. */
Object.assign(CenarioVideo, {
  PROXY_W: 960, PROXY_AUTO: true, _gerando: new Map(), _fila: Promise.resolve(), _agendado: new Set(), _tentou: new Map(),
  chaveProxy(n, w = this.PROXY_W) { return 'proxy:' + n.arq + ':' + w; },
  precisaProxy(n, w = this.PROXY_W) { return n.tipo === 'video' && !!n.arq && !(n.vw && n.vw <= w); }, // já pequeno: o original basta
  temProxy(n) { return !this.precisaProxy(n) || (!!n.proxy && n.proxy.startsWith('proxy:' + n.arq + ':')); },
  _atual(P) { return typeof App !== 'undefined' && App.P && App.P.id === P.id ? App.P : P; },
  aoAbrir(P) { if (this.PROXY_AUTO && this.nos(P).some(n => !this.temProxy(n))) this.agendaProxies(P, 1500); },
  // o palco achou um vídeo sem cópia: agenda (no máximo uma tentativa por minuto por vídeo)
  pedeProxy(P, n) {
    if (!this.PROXY_AUTO || this.emExport) return; const t = this._tentou.get(n.arq) || 0; if (Date.now() - t < 60000) return;
    this._tentou.set(n.arq, Date.now()); this.agendaProxies(P, 500);
  },
  agendaProxies(P, espera = 0) {
    if (this._agendado.has(P.id)) return; this._agendado.add(P.id); for (const n of this.nos(P)) this._tentou.set(n.arq, Date.now());
    this._fila = this._fila.then(() => new Promise(r => setTimeout(r, espera))).then(() => this.gerarProxies(this._atual(P), { aviso: true }))
      .catch(e => console.warn('[proxy]', e)).finally(() => this._agendado.delete(P.id));
  },
  /* API: await CenarioVideo.gerarProxies(P = App.P, { largura = PROXY_W, refazer = false, aviso = true, salvar = true, erro = false })
     → [{ id, nome, proxy, bytes, ms }] dos que ganharam cópia agora (os que já tinham ficam de fora). */
  async gerarProxies(P = App.P, o = {}) {
    if (!P) throw new Error('Abra uma animação antes.'); const W = o.largura || this.PROXY_W, out = [];
    for (const n0 of this.nos(P)) {
      const n = Modelo.achar(this._atual(P), n0.id)?.no || n0; if (!this.precisaProxy(n, W)) continue;
      const r = await this.gerarProxy(P, n, { ...o, largura: W }).catch(e => {
        console.warn('[proxy]', n.nome, e); if (o.erro) throw e;
        if (o.aviso !== false && typeof UI !== 'undefined') UI.toast(`Não consegui fazer a cópia leve de <b>${esc(n.nome)}</b>: ${esc(e.message || String(e))}. O play usa o original.`, { kind: 'warn', time: 6000 });
        return null; });
      if (r?.novo) out.push(r);
    }
    return out;
  },
  async gerarProxy(P, n, o = {}) {
    const W = o.largura || this.PROXY_W, k = this.chaveProxy(n, W), poe = async (bytes, ms, novo) => { // grava n.proxy no nó do projeto aberto (e no P dado) e salva
      const alvo = Modelo.achar(this._atual(P), n.id)?.no, muda = [...new Set([n, alvo])].filter(x => x && x.arq === n.arq && x.proxy !== k); muda.forEach(x => x.proxy = k);
      if (muda.length && o.salvar !== false) { if (typeof App !== 'undefined' && App.P?.id === P.id && App.salvarJa) await App.salvarJa(); else { P.modificado = Date.now(); await DB.put('projetos', JSON.parse(JSON.stringify(P))); } }
      return { id: n.id, nome: n.nome, proxy: k, bytes, ms, novo };
    };
    if (!o.refazer) { const ja = await Arq.pegaBlob(k).catch(() => null); if (ja) return poe(ja.size, 0, false); }
    if (this._gerando.has(k)) { await this._gerando.get(k); return poe((await Arq.pegaBlob(k))?.size || 0, 0, false); }
    const pr = (async () => {
      const b = await Arq.pegaBlob(n.arq); if (!b) throw new Error('o vídeo ainda não chegou neste computador');
      const t0 = performance.now(), mostra = o.aviso !== false && typeof UI !== 'undefined'; let av = null, ult = 0;
      const prog = (feito, tot) => { if (!mostra) return; const agora = performance.now(); if (agora - ult < 300 && feito < tot) return; ult = agora;
        const txt = `<span class="spin-dot"></span> Preparando a cópia leve de <b>${esc(n.nome)}</b> para o play… ${Math.floor(100 * feito / tot)}%${typeof App !== 'undefined' && App.tocando ? ' (esperando o play parar)' : ''}`;
        if (!av || !av.isConnected) av = UI.toast(txt, { time: 3600000 }); else { const m = av.querySelector('.toast-msg'); if (m) m.innerHTML = txt; } };
      try {
        const blob = await this.fazProxy(b, n, W, prog);
        await Arq.guardar(blob, k); const ms = Math.round(performance.now() - t0);
        if (mostra) UI.toast(`Cópia leve de <b>${esc(n.nome)}</b> pronta (${(blob.size / 1048576).toFixed(1)} MB): o play usa ela com a Prévia leve ligada.`, { kind: 'ok' });
        return { bytes: blob.size, ms };
      } finally { av?.remove(); }
    })();
    this._gerando.set(k, pr); try { const r = await pr; return poe(r.bytes, r.ms, true); } finally { this._gerando.delete(k); }
  },
  // WebM com canal alfa? (AlphaMode = 1 no cabeçalho: 53 C0 81 01)
  async temAlfa(b) {
    try { const u = new Uint8Array(await b.slice(0, 65536).arrayBuffer()); if (!(u[0] === 0x1a && u[1] === 0x45)) return false; for (let i = 0; i < u.length - 3; i++) if (u[i] === 0x53 && u[i + 1] === 0xc0 && u[i + 2] === 0x81 && u[i + 3] === 1) return true; } catch { }
    return false;
  },
  async codecProxy(W, H, fps) {
    if (typeof VideoEncoder === 'undefined') throw new Error('este navegador não tem WebCodecs (VideoEncoder)');
    for (const [codec, id] of [['vp8', 'V_VP8'], ['vp09.00.10.08', 'V_VP9']]) {
      const cfg = { codec, width: W, height: H, bitrate: Math.round(W * H * fps * .2), framerate: fps, latencyMode: 'quality' };
      try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return { cfg, id }; } catch { }
    }
    throw new Error('o navegador não codifica VP8/VP9');
  },
  /* faz a cópia leve (Blob WebM) de um vídeo: quadros do original (rVFC tocando + seek no que faltar) → canvas reduzido → VideoEncoder → WebmMux */
  async fazProxy(b, n, W0, prog) {
    if (!b.type || b.type === 'application/octet-stream') b = new Blob([b], { type: await this.tipo(b) });
    const fps = n.vfps || 24, alfa = !!n.frente || await this.temAlfa(b), url = URL.createObjectURL(b), v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url; this._caixa().appendChild(v);
    const encs = [], fila = new Map(), est = this.ultimaProxy = { tocando: 0, seek: 0 }; let pend = null, ultCb = 0, tCb = 0, semRvfc = 0, ativo = false, acorda = null, erro = null;
    const fecha = c => { c?.c?.close(); c?.a?.close(); }, copia = c => ({ c: c.c.clone(), a: c.a?.clone() });
    try {
      await new Promise((ok, no) => { if (v.readyState >= 2) return ok(); v.addEventListener('loadeddata', ok, { once: true }); v.addEventListener('error', () => no(new Error('não abriu o vídeo')), { once: true }); });
      const W = Math.min(W0, v.videoWidth) & ~1, H = Math.max(2, Math.round(W * v.videoHeight / v.videoWidth / 2) * 2), dur = isFinite(v.duration) ? v.duration : 0;
      const total = Math.max(1, Math.min(n.vquadros || Infinity, Math.round(dur * fps) || n.vquadros || 1)), G = Math.max(1, Math.round(fps)); // um quadro-chave por segundo (seek rápido no proxy)
      const { cfg, id } = await this.codecProxy(W, H, fps), cor = new Array(total), alf = alfa ? new Array(total) : null;
      const mkEnc = dest => { const e = new VideoEncoder({ output: ch => { const i = Math.round(ch.timestamp * fps / 1e6), d = new Uint8Array(ch.byteLength); ch.copyTo(d); if (i >= 0 && i < total) dest[i] = { d, k: ch.type === 'key' }; }, error: err => { erro = err; acorda?.(); } }); e.configure(cfg); encs.push(e); return e; };
      const eC = mkEnc(cor), eA = alfa ? mkEnc(alf) : null;
      const cv = new OffscreenCanvas(W, H), g = cv.getContext('2d', { willReadFrequently: alfa }); g.imageSmoothingQuality = 'high';
      const captura = () => { // o quadro que o <video> mostra agora → { c, a } (VideoFrames sem tempo; o tempo entra ao codificar)
        g.clearRect(0, 0, W, H); g.drawImage(v, 0, 0, W, H);
        if (!alfa) return { c: new VideoFrame(cv, { timestamp: 0 }) };
        const px = g.getImageData(0, 0, W, H).data, y = new Uint8Array(W * H * 3 / 2); for (let i = 0, j = 3; i < W * H; i++, j += 4) y[i] = px[j]; y.fill(128, W * H);
        return { c: new VideoFrame(px, { format: 'RGBX', codedWidth: W, codedHeight: H, timestamp: 0 }), a: new VideoFrame(y, { format: 'I420', codedWidth: W, codedHeight: H, timestamp: 0 }) }; // RGBX: a cor sem o alfa (o getImageData já tira a pré-multiplicação)
      };
      let next = 0;
      const codifica = async (i, c) => {
        while (eC.encodeQueueSize > 6 || (eA && eA.encodeQueueSize > 6)) await new Promise(r => setTimeout(r, 4));
        const ts = Math.round(i * 1e6 / fps), du = Math.round(1e6 / fps), key = i % G === 0;
        const fc = new VideoFrame(c.c, { timestamp: ts, duration: du }); eC.encode(fc, { keyFrame: key }); fc.close();
        if (eA) { const fa = new VideoFrame(c.a, { timestamp: ts, duration: du }); eA.encode(fa, { keyFrame: key }); fa.close(); }
        fecha(c);
      };
      // o quadro pend (mostrado a partir de pend.t) vale para todo índice i com pend.t <= (i + .5)/fps < t (t = tempo do quadro seguinte)
      const reparte = t => { if (!pend) return; for (let i = Math.max(next, Math.ceil(pend.t * fps - .5 - 1e-6)); i < total && (i + .5) / fps < t - 1e-6; i++) if (!fila.has(i)) fila.set(i, copia(pend.c)); fecha(pend.c); pend = null; };
      const cb = (agora, meta) => {
        if (!ativo) return; ultCb = performance.now(); tCb = v.currentTime;
        try { const t = meta.mediaTime, c = captura(); reparte(t); pend = { t, c }; est.tocando++; } catch (e) { erro = e; }
        acorda?.(); if (ativo) v.requestVideoFrameCallback(cb);
      };
      const temRvfc = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
      const para = () => { ativo = false; v.pause(); if (pend) { fecha(pend.c); pend = null; } };
      const tocaDe = () => { if (!temRvfc || document.hidden || performance.now() - semRvfc < 8000) return; ativo = true; ultCb = performance.now(); tCb = v.currentTime; v.requestVideoFrameCallback(cb); v.play().catch(() => { ativo = false; }); };
      const busca = f => new Promise(ok => { let to = 0; const fim = () => { clearTimeout(to); v.removeEventListener('seeked', fim); ok(); }; to = setTimeout(fim, 8000); v.addEventListener('seeked', fim); v.currentTime = (f + .5) / fps; });
      while (next < total) {
        if (erro) throw erro; prog?.(next, total);
        if (fila.has(next)) { const c = fila.get(next); fila.delete(next); await codifica(next++, c); continue; }
        if (typeof App !== 'undefined' && App.tocando) { if (ativo || !v.paused) para(); await new Promise(r => setTimeout(r, 250)); continue; } // não disputa com o play da timeline
        if (ativo && v.ended && pend) { reparte(Infinity); continue; } // fim do vídeo: o último quadro vale até o fim
        if (ativo && !v.paused && v.currentTime - tCb > .5) semRvfc = performance.now(); // o vídeo anda e o requestVideoFrameCallback não vem (página sem desenhar): só seek por uns segundos
        else if (ativo && !v.paused && performance.now() - ultCb < 1500 && !(pend && pend.t > (next + .5) / fps + 1e-6)) { await new Promise(r => { acorda = r; setTimeout(r, 100); }); acorda = null; continue; }
        // pulou este quadro / parou / travou / aba escondida: busca exata e volta a tocar dali
        para(); await busca(next); await codifica(next++, captura()); est.seek++;
        if (next < total) tocaDe();
      }
      para(); prog?.(total, total);
      await Promise.all(encs.map(e => e.flush())); if (erro) throw erro;
      for (let i = 0; i < total; i++) if (!cor[i] || (alf && !alf[i])) throw new Error('faltou o quadro ' + (i + 1) + ' na codificação');
      return WebmMux.faz({ codec: id, w: W, h: H, fps, quadros: cor, alfa: alf });
    } finally {
      ativo = false; for (const [, c] of fila) fecha(c); if (pend) fecha(pend.c); for (const e of encs) try { if (e.state !== 'closed') e.close(); } catch { }
      try { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } catch { } URL.revokeObjectURL(url);
    }
  },
});

/* WebmMux — empacota quadros VP8/VP9 já codificados num WebM (um Cluster por quadro-chave, Cues no começo para o seek). Com `alfa`
   (os quadros do alfa codificados à parte, Y = alfa) cada quadro vira BlockGroup + BlockAdditions/BlockMore (BlockAddID 1) e a trilha
   leva AlphaMode = 1 + MaxBlockAdditionID = 1: o formato do WebM com transparência que o Chrome toca. */
const WebmMux = {
  _id(id) { const b = []; while (id > 0) { b.unshift(id & 255); id = Math.floor(id / 256); } return new Uint8Array(b); },
  _tam(n) { for (let l = 1; l <= 8; l++) if (n < 2 ** (7 * l) - 1) { const b = new Uint8Array(l); let x = n; for (let i = l - 1; i >= 0; i--) { b[i] = x % 256; x = Math.floor(x / 256); } b[0] |= 0x80 >> (l - 1); return b; } throw new Error('grande demais'); },
  _uint(x, l = 0) { const b = []; do { b.unshift(x % 256); x = Math.floor(x / 256); } while (x > 0); while (b.length < l) b.unshift(0); return new Uint8Array(b); },
  _float(f) { const d = new DataView(new ArrayBuffer(8)); d.setFloat64(0, f); return new Uint8Array(d.buffer); },
  _len(p) { let s = 0; for (const x of p) s += x.byteLength; return s; },
  // elemento EBML → lista plana de Uint8Array
  el(id, ...filhos) { const p = filhos.flat(Infinity).map(x => typeof x === 'string' ? new TextEncoder().encode(x) : x); return [this._id(id), this._tam(this._len(p)), ...p]; },
  u(id, x, l) { return this.el(id, this._uint(x, l)); },
  faz({ codec, w, h, fps, quadros, alfa }) {
    const N = quadros.length, ms = i => Math.round(i * 1000 / fps), dQ = Math.round(1000 / fps);
    const cab = this.el(0x1A45DFA3, this.u(0x4286, 1), this.u(0x42F7, 1), this.u(0x42F2, 4), this.u(0x42F3, 8), this.el(0x4282, 'webm'), this.u(0x4287, 4), this.u(0x4285, 2));
    const info = this.el(0x1549A966, this.u(0x2AD7B1, 1000000), this.el(0x4D80, 'Animador'), this.el(0x5741, 'Animador proxy'), this.el(0x4489, this._float(N * 1000 / fps)));
    const video = this.el(0xE0, this.u(0xB0, w), this.u(0xBA, h), alfa ? this.u(0x53C0, 1) : []);
    const trilhas = this.el(0x1654AE6B, this.el(0xAE, this.u(0xD7, 1), this.u(0x73C5, 1), this.u(0x83, 1), this.u(0x9C, 0), this.el(0x86, codec), this.u(0x23E383, Math.round(1e9 / fps)), alfa ? this.u(0x55EE, 1) : [], video));
    const clusters = [], inicios = [];
    for (let i0 = 0; i0 < N;) {
      let i1 = i0 + 1; while (i1 < N && !quadros[i1].k) i1++;
      const t0 = ms(i0), blocos = [];
      for (let i = i0; i < i1; i++) {
        const q = quadros[i], rel = ms(i) - t0, cabB = new Uint8Array([0x81, (rel >> 8) & 255, rel & 255, 0]);
        if (!alfa) { cabB[3] = q.k ? 0x80 : 0; blocos.push(this.el(0xA3, cabB, q.d)); continue; }
        blocos.push(this.el(0xA0, this.el(0xA1, cabB, q.d), this.el(0x75A1, this.el(0xA6, this.u(0xEE, 1), this.el(0xA5, alfa[i].d))), q.k ? [] : this.el(0xFB, new Uint8Array([(-dQ >> 8) & 255, -dQ & 255]))));
      }
      inicios.push(t0); clusters.push(this.el(0x1F43B675, this.u(0xE7, t0), blocos)); i0 = i1;
    }
    const cues = pos => this.el(0x1C53BB6B, inicios.map((t, j) => this.el(0xBB, this.u(0xB3, t, 4), this.el(0xB7, this.u(0xF7, 1), this.u(0xF1, pos[j], 8)))));
    const pos = []; let p = this._len(info) + this._len(trilhas) + this._len(cues(inicios.map(() => 0))); // posição de cada Cluster a partir do começo dos dados do Segment
    for (const c of clusters) { pos.push(p); p += this._len(c); }
    return new Blob([...cab, ...this.el(0x18538067, info, trilhas, cues(pos), clusters)], { type: 'video/webm' });
  },
};
