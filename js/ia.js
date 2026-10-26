/* ===================== ia.js — IA do Estúdio Problems no Animador =====================
   Fala com o servidor do Estúdio Problems (Cloudflare, login do Google). A IA recebe os personagens com as sessões e presets
   que você configurou uma vez (olhos, boca, poses…), as legendas da fala e as camadas, e devolve AÇÕES que o Animador aplica
   (escolher pose por quadro, mover, câmera, efeitos). No Ateliê, cria presets/poses novos a partir das peças que já existem. */
'use strict';
const IA = {
  get srv() { return Nuvem.srv; },
  // todo pedido à IA mostra a tela "A IA está trabalhando" (bloqueia a tela, tempo passado/aproximado e %)
  async chama(sistema, pedido, aoEscrever) {
    const qual = sistema === this.SIS_ORGANIZAR ? ['organizar', 'Organizando o personagem', 60] : sistema === this.SIS_REF ? ['referencia', 'A IA está olhando a referência', 30] : sistema === this.SIS_PRESET ? ['preset', 'Criando o preset', 20] : sistema === this.SIS_CENA ? ['cena', 'Animando a cena', 40]
      : /CORES/.test(sistema) ? ['cores', 'Ajustando as cores', 20] : /cen[aá]rio/i.test(sistema) ? ['cenario', 'Desenhando o cenário', 60] : ['ia', 'A IA está trabalhando', 30];
    const fim = Ocupado.inicio({ tipo: qual[0], titulo: qual[1], est: qual[2], subtitulo: 'A IA está pensando…' });
    try { return await this._chama(sistema, pedido, txt => { Ocupado.texto(txt.length); Ocupado.passo(`A IA está escrevendo… (${txt.length} letras)`); aoEscrever?.(txt); }); } finally { fim(); }
  },
  async _chama(sistema, pedido, aoEscrever) {
    if (!this.srv) throw new Error('O servidor da IA não está configurado.');
    const corpo = { system: [{ type: 'text', text: sistema }], messages: [{ role: 'user', content: pedido }] };
    for (let tent = 0; tent < 3; tent++) {
      let r; try { r = await fetch(this.srv + '/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', ...(await Nuvem.hd()) }, body: JSON.stringify(corpo) }); }
      catch { if (tent < 2) { await sleep(2500 * (tent + 1)); continue; } throw new Error('Não consegui falar com o servidor da IA. Confira a internet.'); }
      if (r.ok && /event-stream/.test(r.headers.get('content-type') || '')) { try { return await this.leStream(r, aoEscrever); } // a conexão caiu no meio da resposta (ex.: aba escondida e a rede piscou): pede de novo
        catch (e) { if (tent < 2 && !/limite|login/i.test(e.message || '')) { Ocupado.passo('A conexão caiu, pedindo de novo…'); await sleep(2500 * (tent + 1)); continue; } throw e; } }
      const j = await r.json().catch(() => ({}));
      if (r.ok) return (j.content || []).map(c => c.text || '').join('');
      if ([429, 500, 502, 503, 529].includes(r.status) && tent < 2) { await sleep(4000 * (tent + 1)); continue; }
      if (j?.error?.type === 'login') throw new Error('Entre com a conta Google pelo menu para usar a IA.');
      if (j?.error?.type === 'limite') throw new Error('A equipe já usou todo o limite de gasto da IA.');
      throw new Error(j?.error?.message || 'A IA respondeu com erro ' + r.status);
    }
  },
  async leStream(r, aoEscrever) {
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', txt = '';
    for (;;) { const { done, value } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i;
      while ((i = buf.search(/\r?\n\r?\n/)) >= 0) { const ev = buf.slice(0, i); buf = buf.slice(i).replace(/^\r?\n\r?\n/, '');
        const d = ev.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join(''); if (!d) continue;
        try { const o = JSON.parse(d); if (o.type === 'content_block_delta' && o.delta?.text) { txt += o.delta.text; aoEscrever?.(txt); } if (o.type === 'error') throw new Error(o.error?.message || 'erro da IA'); } catch (e) { if (e.message !== 'Unexpected end of JSON input' && !(e instanceof SyntaxError)) throw e; } } }
    return txt;
  },
  // trilhas com nomes (da IA) → trilhas com ids
  trilhasDe(def, trilhas0) {
    return (trilhas0 || []).map(t => (t || []).map(p0 => { const p = { s: {}, p: {} };
      for (const [pn, v0] of Object.entries(p0 || {})) { const pt = this.acha(def.partes, pn); if (!pt) continue; const v = typeof v0 === 'string' ? { img: v0 } : v0 || {}, im = v.img ? this.acha(pt.imgs, v.img) : null; const num = c => v[c] != null && isFinite(+v[c]); if (!im && !num('r') && !num('x') && !num('y')) continue;
        p.p[pt.id] = { ...(im ? { img: im.id } : {}), ...(num('r') ? { r: +v.r } : {}), ...(num('x') ? { x: +v.x } : {}), ...(num('y') ? { y: +v.y } : {}) }; }
      return p; }).filter(p => Object.keys(p.p).length)).filter(t => t.length);
  },
  json(txt) { const m = String(txt).match(/\{[\s\S]*\}/); if (!m) throw new Error('A IA não devolveu as ações.'); return JSON.parse(m[0]); },
  acha(lista, nomeOuId, campo = 'nome') { const n = String(nomeOuId || '').trim().toLowerCase(); return lista.find(x => x.id === nomeOuId) || lista.find(x => String(x[campo]).toLowerCase() === n) || lista.find(x => String(x[campo]).toLowerCase().includes(n) && n.length > 2); },

  /* ---------- animar na cena ---------- */
  contexto(P) {
    const pers = Object.values(P.personagens).map(d => ({ personagem: d.nome, sessoes: d.sessoes.map(s => ({ sessao: s.nome, presets: s.presets.map(p => p.nome) })),
      partes: d.partes.map(p => ({ parte: p.nome, imagens: p.imgs.slice(0, 14).map(i => i.nome) })), raiz: d.partes.find(p => p.id === d.raiz)?.nome,
      animacoes: (d.animacoes || []).map(a => ({ animacao: a.nome, passos: Math.max(0, ...a.trilhas.map(t => t.length)), ms_por_passo: +a.vel || 250, quadros_por_passo_aqui: Math.max(1, Math.round((+a.q || Math.max(1, Math.round((+a.vel || 250) / 1000 * Modelo.fpsDe(d)))) * P.fps / Modelo.fpsDe(d))) })), fps_personagem: Modelo.fpsDe(d),
      vistas: d.vistas?.length > 1 ? d.vistas.map(v => { const dv = Modelo.naVista(d, v.id); return { vista: v.nome, tipo: Modelo.nomeTipo(v.tipo), sessoes: (dv.sessoes || []).map(s => s.nome), animacoes: (dv.animacoes || []).map(a => a.nome) }; }) : undefined }));
    const camadas = Modelo.todos(P).map(n => ({ camada: n.nome, tipo: n.tipo, personagem: n.tipo === 'personagem' ? P.personagens[n.ref]?.nome : undefined, de: (n.de || 0) + 1, ate: Modelo.fimNo(P, n) + 1, posicao: (({ x, y, s }) => ({ x: Math.round(x), y: Math.round(y), s: round(s, 2) }))(Modelo.transf(n, App.q)) }));
    const fala = (P.legendas || []).map(g => `${g.de + 1}-${g.ate + 1}: ${g.texto}`).join('\n');
    const audios = (P.audios || []).map(a => ({ audio: a.nome, de: (a.de || 0) + 1, ate: (a.de || 0) + Math.round((Som.dur(a.arq) || 0) * P.fps), volume: round(a.vol ?? 1, 2), volume_em_trechos: (a.volTrechos || []).map(t => ({ de: t.de + 1, ate: t.ate + 1, volume: t.vol })) }));
    return { quadros: P.duracao, fps: P.fps, tamanho: `${P.w}x${P.h}`, quadroAtual: App.q + 1, personagens: pers, camadas, audios, efeitos: Efeitos.TELA.map(e => e.id), visuais: Efeitos.VISUAIS.map(v => v.id), fala };
  },
  SIS_CENA: `Você é o animador assistente do ANIMADOR do Estúdio Problems (canal Problems, animação 2D de personagens montados por partes).
Você recebe o projeto em JSON: quadros (numerados a partir de 1), fps, personagens com SESSÕES e PRESETS (ex.: sessão "Olhos" com "assustado", "fechado"; sessão "Pose" com "chutando"), camadas e a fala com os quadros de cada frase.
Responda SÓ um JSON: {"explica":"frase curta do que fez","acoes":[...]}.
Ações possíveis:
 {"tipo":"pose","camada":"nome da camada","quadro":N,"sessoes":{"Nome da sessão":"nome do preset"}}   (vale até a próxima pose daquela sessão)
 {"tipo":"mover","camada":"nome","quadro":N,"x":0,"y":0,"r":0,"s":1,"curva":"suave"}   (só os campos que mudam; x/y em pixels do projeto; "curva" = como o movimento CHEGA nesta chave: suave|linear|saida (freando)|entrada (acelerando)|sobra (passa do ponto e volta)|quicar|elastico|corte (pula seco))
 {"tipo":"camera","quadro":N,"x":0,"y":0,"zoom":1,"tremor":0,"curva":"suave"}   (tremor 0-1 = câmera tremendo nesse trecho, vai mudando até a próxima chave; "curva" igual ao mover; "corte" = corte seco de plano)
 {"tipo":"entrada","camada":"nome","entra":"pop|carimbo|aparecer|subir|descer|girar|esticar|nenhuma","sai":"…","quadros":6}   (como a camada aparece no começo dela e some no fim; ótimo para textos e objetos)
 {"tipo":"efeito","efeito":"vinheta|granulado|cinema|flash|tremor|desfoque|brilho|vhs|escurecer|clarear|chicote|zoomcorte","de":N,"ate":N,"forca":0.5}   (chicote e zoomcorte são TRANSIÇÕES: ~0,4 s com o corte no meio)
 {"tipo":"tremulo","camada":"nome","modo":"tremer|ondular|nenhum","forca":0.4}   (deixa uma imagem/camada parada "viva", tremendo ou ondulando)
 {"tipo":"visual","visual":"normal|vivo|quente|frio|noite|por-do-sol|vintage|pb|sonho|terror|desbotado|neon"}
 {"tipo":"cenario","descricao":"o lugar em português, sem personagens"}   (só se a pessoa pedir um cenário/fundo novo; sai no estilo da casa e fica só nesta animação)
 {"tipo":"vista","camada":"nome","quadro":N,"vista":"Lado"}   (troca o ÂNGULO do personagem a partir do quadro N: frente, três-quartos, lado, costas… — para virar, andar de lado, dar as costas)
 {"tipo":"animacao","camada":"nome","animacao":"Andar","quadro":N,"repeticoes":2,"quadros_por_passo":3}   (põe um CICLO pronto do personagem — andar, falar, piscar, respirar… — como chaves a partir do quadro N)
 {"tipo":"apagar_chaves","camada":"nome ou camera","de":N,"ate":N}   (tira as chaves da camada nesse trecho, para refazer o que ficou ruim)
 {"tipo":"volume","audio":"nome do áudio","de":N,"ate":N,"volume":0.5}   (muda o volume SÓ nesse trecho: 1 = como está, 0.5 = metade, 0 = mudo, até 2)
 {"tipo":"criar_animacao","personagem":"nome","nome":"Pular","vel":200,"trilhas":[[{"Parte":"imagem"},{"Parte":{"img":"imagem","r":graus,"x":px,"y":px}}]]}   (cria um preset de animação novo no personagem desta animação, quando não existe um que sirva; depois use com "animacao")
CICLOS: para andar/correr/falar/piscar/respirar, use as "animacoes" do personagem (ação "animacao") em vez de trocar peça por peça; para andar até um lugar, junte "animacao" (Andar, várias repetições) com "mover" do começo ao fim no mesmo trecho; quadros_por_passo ≈ ms_por_passo × fps / 1000 (2-4 é o normal); calcule as repetições para cobrir o trecho.
Se não existir a animação que precisa, crie com "criar_animacao" seguindo: ciclo emendado (o último passo liga no primeiro), andar com pernas alternando e braços opostos e o corpo subindo/descendo poucos px, piscar com olhos abertos muito tempo e fechando rápido, falar variando as bocas.
VÍDEOS DE REFERÊNCIA: se vierem folhas de quadros de vídeos, copie o estilo de animação e de edição deles (timing, poses, câmera, cortes, zooms, efeitos nos impactos).
TRECHOS: se o pedido disser "SÓ ESTES TRECHOS", todas as ações têm que cair dentro deles (quadros, de/ate); não mexa em mais nada.
Regras: use só nomes de sessões, presets, partes, imagens e animações que existem (ou que você criou nesta resposta). Para atuação pela fala, mude expressões nas palavras fortes (piscar de vez em quando: olhos fechados por 2-3 quadros), sem trocar a cada quadro. Respeite o pedido.`,
  // faz o pedido na animação aberta (o mesmo do botão IA) e devolve o texto do que fez
  async executar(txt, foco, mostra, o = {}) {
    const P = App.P, tr = (o.trechos || []).filter(t => t && t.ate >= t.de);
    const texto = `${o.antes || ''}PROJETO:\n${JSON.stringify(this.contexto(P))}\n\n${tr.length ? Trechos.texto(P, tr) + '\n\n' : ''}PEDIDO: ${txt}${foco ? `\n(Camada em foco: "${foco.nome}")` : ''}`;
    // no ANIMADOR os vídeos de referência (test drive da equipe + os desta animação) vão em todo pedido: a IA copia o estilo de animação e de edição
    const refC = await RefsAnim.conteudo(P.refsAnim, { modo: 'editor' }).catch(() => []);
    const trC = tr.length ? await Trechos.quadros(P, tr).catch(() => []) : [];
    const imgs = o.imgs || [], content = refC.length || trC.length || imgs.length ? [...refC, ...trC, ...imgs, { type: 'text', text: texto }] : texto;
    const foto = tr.length ? Trechos.foto(P) : null;
    const out = await this.chama(this.SIS_CENA, content, t => mostra?.(t.slice(-600)));
    this.trechos = tr.length ? tr : null;
    const j = this.json(out); let n; try { n = this.aplicar(j.acoes || [], foto); } finally { this.trechos = null; }
    for (const c of this.cenariosPedidos) { mostra?.('Montando o cenário: ' + c.descricao + '…'); const r = await Cenarios.pedirIA(c.descricao, null, t => mostra?.('Montando o cenário… (' + t.length + ' letras)')); Cenarios.guardaUltimo(r.cena); const est = await Cenarios.estadoDe({ ...r.cena, ia: true }); est.ia = true; await Cenarios.porEmCamadas(est, { semAviso: true }); App.commit('Cenário da IA'); const nn = App.noSel(); if (nn) { nn.ia = true; if (tr.length) { nn.de = Math.min(...tr.map(t => t.de)); nn.ate = Math.max(...tr.map(t => t.ate)); App.commit('Cenário no trecho'); } } n++; }
    const cr = this.criadas || 0; this.criadas = 0;
    return (j.explica || 'Pronto.') + (tr.length ? `\n\nSó mexi ${tr.length > 1 ? 'nos trechos' : 'no trecho'} ${tr.map(t => Trechos.rotulo(t, P)).join(', ')}; o resto ficou igual.` : '') + `\n\n${n} ação(ões) aplicada(s). Dá para desfazer com Ctrl+Z.` + (cr ? `\n${cr} animação(ões) nova(s) no personagem desta animação: para guardar no personagem da equipe, botão direito nele › Editar no Ateliê e salve lá.` : '') + (this.cenariosPedidos.length ? '\nO cenário entrou como uma pasta com uma camada por peça (só nesta animação). Para mudar: botão direito › Editar cenário; para guardar na equipe: Salvar na nuvem.' : '');
  },
  // a janela do Assistente (js/assistente.js): fica aberta, guarda a conversa e aceita citações
  abrir(foco, o = {}) { return Assistente.abrir({ ...o, foco: foco || null }); },
  cenariosPedidos: [],
  aplicar(acoes, foto) {
    const P = App.P, todos = Modelo.todos(P), tr = this.trechos; let n = 0; this.cenariosPedidos = [];
    acoes = [...acoes.filter(a => a.tipo === 'apagar_chaves'), ...acoes.filter(a => a.tipo === 'criar_animacao'), ...acoes.filter(a => a.tipo === 'vista'), ...acoes.filter(a => !['apagar_chaves', 'criar_animacao', 'vista'].includes(a.tipo))]; // apaga primeiro, cria as animações e troca as vistas antes de usar // cria as animações e troca as vistas antes de usar // cria os presets de animação antes de usar
    const q = v => clamp(Math.round(+v || 1) - 1, 0, P.duracao - 1);
    for (const a of acoes) {
      try {
        if (a.tipo === 'pose' || a.tipo === 'mover') {
          const no = this.acha(todos, a.camada); if (!no) continue;
          if (a.tipo === 'pose' && no.tipo === 'personagem') { const def = Modelo.naVista(P.personagens[no.ref], Modelo.estadoPersonagem(no, q(a.quadro)).vista), k = Modelo.chave(no, q(a.quadro)); k.sessoes = k.sessoes || {};
            for (const [sn, pn] of Object.entries(a.sessoes || {})) { const s = this.acha(def.sessoes, sn); const p = s && (pn ? this.acha(s.presets, pn) : null); if (s) { k.sessoes[s.id] = p ? p.id : null; } } n++; }
          if (a.tipo === 'mover') { const v = {}; for (const c of ['x', 'y', 'r', 's', 'op']) if (a[c] != null && isFinite(+a[c])) v[c] = +a[c]; Modelo.poeTransf(no, q(a.quadro), v); const ck = no.chaves[q(a.quadro)];
            if (a.curva && Ease.IR[a.curva] && a.curva !== 'livre') { if (a.curva === 'suave') delete ck.ir; else ck.ir = a.curva; if (a.curva !== 'corte') no.interp = true; } n++; }
        } else if (a.tipo === 'camera') { const k = q(a.quadro); P.camera.chaves[k] = { ...Modelo.camera(P, k), ...Object.fromEntries(['x', 'y', 'zoom', 'r'].filter(c => a[c] != null).map(c => [c, +a[c]])) };
          if (a.tremor != null && isFinite(+a.tremor)) P.camera.chaves[k].tremor = clamp(+a.tremor, 0, 1); if (a.curva && Ease.IR[a.curva] && a.curva !== 'livre' && a.curva !== 'suave') P.camera.chaves[k].ir = a.curva; n++; }
        else if (a.tipo === 'entrada') { const no = this.acha(todos, a.camada); if (!no) continue; const qq = clamp(Math.round(+a.quadros || P.fps * .25), 1, 120);
          for (const [k, v] of [['entra', a.entra], ['sai', a.sai]]) { if (v == null) continue; if (!Modelo.ANIMS[v]) delete no[k]; else no[k] = { tipo: v, q: qq }; } n++; }
        else if (a.tipo === 'efeito' && Efeitos.TELA.some(e => e.id === a.efeito)) { const t = App.efeitoTopo(); t.efeitos.push({ id: uid('ef'), tipo: a.efeito, de: q(a.de), ate: Math.max(q(a.de), q(a.ate)), forca: clamp(+a.forca || .5, 0, 1) }); App.nomeEfeito(t); n++; }
        else if (a.tipo === 'apagar_chaves') { const de = q(a.de), ate = Math.max(de, q(a.ate)), ch = /^c[aâ]mera$/i.test(String(a.camada || '').trim()) ? P.camera.chaves : this.acha(todos, a.camada)?.chaves; if (!ch) continue;
          for (const k of Object.keys(ch)) if (+k >= de && +k <= ate && (!tr || Trechos.dentro(tr, +k)) && !(ch === P.camera.chaves && +k === 0)) delete ch[k]; n++; }
        else if (a.tipo === 'volume') { const au = this.acha(P.audios || [], a.audio) || (P.audios || [])[0]; if (!au) continue; let de = q(a.de), ate = Math.max(de, q(a.ate)); const v = clamp(+a.volume, 0, 2); if (!isFinite(v)) continue;
          const pedacos = tr ? tr.map(t => [Math.max(de, t.de), Math.min(ate, t.ate)]).filter(([x, y]) => y >= x) : [[de, ate]];
          for (const [x, y] of pedacos) { au.volTrechos = (au.volTrechos || []).filter(t => !(t.de >= x && t.ate <= y)); au.volTrechos.push({ de: x, ate: y, vol: v }); } if (pedacos.length) n++; }
        else if (a.tipo === 'tremulo' && tr) continue; // vale para a camada inteira: fora do modo trecho
        else if (a.tipo === 'visual' && tr && Efeitos.VISUAIS.some(v => v.id === a.visual)) { if (a.visual === 'normal') continue; const t = App.efeitoTopo(); for (const x of tr) t.efeitos.push({ id: uid('ef'), tipo: 'cor', visual: a.visual, de: x.de, ate: x.ate }); App.nomeEfeito(t); n++; }
        else if (a.tipo === 'tremulo') { const no = this.acha(todos, a.camada); if (no) { if (a.modo === 'nenhum') delete no.tremulo; else no.tremulo = { modo: a.modo === 'ondular' ? 'ondular' : 'tremer', forca: clamp(+a.forca || .4, .05, 1), ritmo: 2 }; n++; } }
        else if (a.tipo === 'visual' && Efeitos.VISUAIS.some(v => v.id === a.visual)) { const t = App.efeitoTopo(); t.efeitos = t.efeitos.filter(e => e.tipo !== 'cor'); if (a.visual !== 'normal') t.efeitos.push({ id: uid('ef'), tipo: 'cor', visual: a.visual }); App.nomeEfeito(t); n++; }
        else if (a.tipo === 'cenario' && a.descricao) this.cenariosPedidos.push(a);
        else if (a.tipo === 'criar_animacao') { const def = this.acha(Object.values(P.personagens), a.personagem) || Object.values(P.personagens)[0]; if (!def) continue; const trilhas = this.trilhasDe(def, a.trilhas); if (!trilhas.length) continue;
          const L = def.animacoes ||= [], velha = L.find(x => x.nome.toLowerCase() === String(a.nome || '').toLowerCase()), an = { id: velha?.id || uid('an'), nome: String(a.nome || 'Animação').slice(0, 40), vel: clamp(+a.vel || 250, 60, 2000), trilhas };
          if (velha) L[L.indexOf(velha)] = an; else L.push(an); this.criadas = (this.criadas || 0) + 1; n++; }
        else if (a.tipo === 'vista') { const no = this.acha(todos, a.camada); const def = no?.tipo === 'personagem' && P.personagens[no.ref]; const v = def?.vistas && (this.acha(def.vistas, a.vista) || def.vistas.find(x => Modelo.nomeTipo(x.tipo).toLowerCase() === String(a.vista || '').toLowerCase())); if (!v) continue; Modelo.chave(no, q(a.quadro)).vista = v.id; n++; }
        else if (a.tipo === 'animacao') { const no = this.acha(todos, a.camada); const def0 = no?.tipo === 'personagem' && P.personagens[no.ref]; if (!def0) continue; const vq = Modelo.estadoPersonagem(no, q(a.quadro)).vista, def = Modelo.naVista(def0, vq);
          let an = this.acha(def.animacoes || [], a.animacao); if (!an) for (const v of def0.vistas || []) { an = this.acha(Modelo.naVista(def0, v.id).animacoes || [], a.animacao); if (an) { Modelo.chave(no, q(a.quadro)).vista = v.id; break; } } if (!an) continue;
          Animacoes.escreve(no, an, q(a.quadro), clamp(Math.round(+a.quadros_por_passo || Math.max(1, Math.round((+an.q || Math.max(1, Math.round((+an.vel || 250) / 1000 * Modelo.fpsDe(def0)))) * P.fps / Modelo.fpsDe(def0)))), 1, 48), clamp(Math.round(+a.repeticoes || 1), 1, 60)); n++; }
      } catch (e) { console.warn('ação da IA', a, e); }
    }
    if (tr && foto) Trechos.protege(P, tr, foto); // o que caiu fora dos trechos volta a ser como era
    if (n) App.commit('IA: ' + n + ' ações' + (tr ? ' no trecho' : ''));
    return n;
  },

  /* ---------- ateliê: criar um preset/pose novo a partir das peças ---------- */
  SIS_PRESET: `Você monta poses de um personagem 2D feito de PARTES (cada parte tem imagens trocáveis e encaixa no pivô da parte-pai).
Você recebe as partes (nome, pai, imagens disponíveis, estado base) e exemplos de presets da sessão. Crie um preset novo pedido pela pessoa.
Responda SÓ um JSON: {"nome":"nome curto do preset","estado":{"Nome da parte":{"img":"nome da imagem","x":0,"y":0,"r":0,"s":1}}}.
Use só partes e imagens que existem; r em graus (rotação no encaixe); x/y são pequenos deslocamentos em pixels (normalmente 0); inclua só as partes que mudam.`,
  async criarPreset(def, sessao, pedido) {
    const partes = def.partes.filter(p => !sessao.partes?.length || sessao.partes.includes(p.id)).map(p => ({ parte: p.nome, pai: def.partes.find(x => x.id === p.pai)?.nome || null, imagens: p.imgs.map(i => i.nome), base: { img: p.imgs.find(i => i.id === p.base.img)?.nome, r: p.base.r, x: p.base.x, y: p.base.y, s: p.base.s } }));
    const exemplos = sessao.presets.slice(0, 8).map(pr => ({ nome: pr.nome, estado: Object.fromEntries(Object.entries(pr.estado).map(([pid, e]) => { const p = def.partes.find(x => x.id === pid); return [p?.nome, { ...e, img: p?.imgs.find(i => i.id === e.img)?.nome }]; })) }));
    const out = await this.chama(this.SIS_PRESET, `PERSONAGEM: ${def.nome}\nSESSÃO: ${sessao.nome}\nPARTES: ${JSON.stringify(partes)}\nEXEMPLOS: ${JSON.stringify(exemplos)}\n\nPEDIDO: ${pedido}`);
    const j = this.json(out), estado = {};
    for (const [pn, e] of Object.entries(j.estado || {})) {
      const p = this.acha(def.partes, pn); if (!p) continue; const img = e.img ? this.acha(p.imgs, e.img) : null, v = {};
      if (img) v.img = img.id; for (const c of ['x', 'y', 'r', 's']) if (e[c] != null && isFinite(+e[c])) v[c] = +e[c]; estado[p.id] = v;
    }
    return { id: uid('pr'), nome: String(j.nome || pedido).slice(0, 40), estado };
  },

  /* ---------- ateliê: ORGANIZAR TUDO (ou só criar animações de teste) ----------
     A IA vê miniaturas das peças (não só os nomes) e devolve um plano; o Ateliê aplica o plano de uma vez (um Ctrl+Z desfaz). */
  SIS_ORGANIZAR: `Você organiza um personagem 2D de animação por ENCAIXE (partes trocáveis montadas quadro a quadro, estilo cartoon).
Você recebe a lista de PARTES (nome, pai, camada z, imagens com nome e tamanho) e MINIATURAS de cada imagem (rotuladas "Parte › imagem").
Monte um plano para deixar o personagem pronto para animar. Responda SÓ um JSON, com só as chaves que precisar:
{
 "juntar":[{"em":"Parte que fica","partes":["parte que virou parte sem querer", ...]}],   // partes que na verdade são outra imagem da mesma peça (ex.: olho fechado separado de Olhos)
 "renomear_partes":{"nome atual":"nome bom"},
 "renomear_imagens":[{"parte":"Olhos","de":"img 3","para":"fechados"}],
 "raiz":"Corpo",                                   // a parte principal (normalmente corpo/tronco)
 "pais":{"Olhos":"Cabeça","Mão direita":"Braço direito"},   // quem encaixa em quem (filho:pai). Não mude se já estiver certo.
 "pivos":{"Braço direito":{"x":0.2,"y":0.05}},     // ponto de GIRO/encaixe de cada parte, em fração da imagem que aparece (0..1): ombro no braço, quadril na perna, pescoço na cabeça, centro nos olhos/boca
 "camadas":["mais atrás", "...", "mais na frente"],  // ordem de todas as partes, só se a atual estiver errada
 "sessoes":[{"nome":"Olhos","partes":["Olhos"],"presets":[{"nome":"fechados","estado":{"Olhos":{"img":"fechados"}}}]}],
 "animacoes":[{"nome":"Piscar","vel":250,"trilhas":[[{"Olhos":"abertos"},{"Olhos":"meio"},{"Olhos":{"img":"fechados","r":0}}]]}],
 "avisos":["frase curta sobre algo que a pessoa precisa resolver"]
}
Cada personagem é diferente (humano, bicho, criatura, objeto com cara; de frente, de lado ou três-quartos; com capuz, máscara, óculos, chapéu, cauda, asas…).
Olhe as miniaturas e monte a estrutura que faz sentido PARA ESTE personagem. Um ponto de partida que costuma funcionar em personagens com corpo:
a raiz é o corpo/tronco (ou a peça maior que segura as outras); membros e cabeça encaixam nela; o que fica no rosto (olhos, boca, sobrancelhas, máscara, óculos) encaixa na cabeça (ou no corpo, se a cabeça faz parte dele);
acessórios (chapéu, capuz, cabelo, cauda, asas) encaixam onde ficam presos. Se o personagem não tem alguma parte (sem boca, sem pernas, uma peça só), não invente: organize o que existe.
Cada peça que tem várias versões vira UMA parte com várias imagens (ex.: olhos abertos/fechados/felizes; bocas A/E/O/U/M; braço caído/acenando/apontando).
O que fica do lado de trás (braço/perna de trás, cauda, cabelo de trás) vai atrás do corpo; rosto e o lado da frente, na frente. Você não move as peças: depois do seu plano, o Ateliê põe cada peça no lugar onde ela está na parte "Referência" (o personagem inteiro), se existir. A "Referência" é só para conferir: não encaixe nada nela, não ponha em sessões/animações, não junte com outras e não a escolha como raiz.
Se algo atrapalhar a animação (ex.: uma imagem só com o personagem inteiro, peças de ângulos diferentes misturadas, falta de bocas para falar), explique em "avisos" (frases curtas em português) — a pessoa pode recortar as peças no Ateliê.
Regras: use SÓ partes e imagens que existem (nomes exatos, ou os novos nomes que você mesmo deu). Sessões por grupo de peça (Olhos, Boca, Braço direito, Pernas, Pose…),
um preset por imagem útil + poses combinadas que façam sentido. Animações de teste curtas e úteis com o que ESTE personagem tem: piscar, falar (bocas A/E/O/U/M…), andar (pernas alternando), acenar, gesticular, mexer a cauda… só as que as peças permitem.
COMO FAZER ANIMAÇÕES DE TESTE BOAS (ciclos que repetem sem pulo):
- CICLO: o último passo tem que emendar no primeiro (o player volta ao começo). Não repita o primeiro passo no fim.
- ANDAR (6 a 8 passos se tiver imagens, senão 4): contato (perna da frente esticada à frente, a de trás atrás) → descida/apoio → passagem (pernas cruzando) → subida → contato do outro lado → apoio → passagem → subida.
  Braços OPOSTOS às pernas (perna direita à frente = braço esquerdo à frente). Corpo/cabeça sobem e descem 2-6 px (use "y" no corpo/raiz: mais baixo no contato/apoio, mais alto na passagem) e giram ±1-3° ("r").
- CORRER: igual andar, mais rápido (vel 80-140), corpo inclinado para a frente (r 5-10° na raiz), sobe/desce mais (6-12 px), braços com mais giro.
- PARADO / RESPIRAR (idle): 4-6 passos lentos (vel 300-500): corpo sobe 1-3 px e volta, cabeça gira ±1-2°, braços acompanham pouco. Bem sutil.
- PISCAR: olhos abertos por 8-14 passos, depois meio fechados, fechados, meio fechados (vel 80-120) — numa trilha própria para juntar com outras.
- FALAR: bocas variadas (A, E, O, U, M/B/P, F/V…) sem repetir a mesma 2 vezes seguidas, voltando à fechada/sorriso de vez em quando; 8-14 passos, vel 100-150.
- ACENAR / GESTICULAR: 2-4 passos alternando imagens ou giro (r ±8-20°) do braço, com uma trilha de rosto (olhos/boca) junto.
- Trilhas separadas para coisas que andam em ritmos diferentes (pernas, boca, olhos). Cada passo só diz o que MUDA naquela trilha.
Em "trilhas", cada passo é {"Parte":"imagem"} ou {"Parte":{"img":"imagem","r":graus,"x":px,"y":px}} (x/y = deslocamento pequeno, em pixels do desenho; r = giro no encaixe). vel em ms (60 a 700) = tempo de cada passo.
"juntar" só quando tiver certeza (a peça é claramente outra versão da mesma parte). Não invente coisas que as imagens não mostram.`,
  async miniaturas(def, max = 70) {
    const out = []; const todas = def.partes.flatMap(p => p.imgs.map(i => ({ p, i }))), pega = todas.length > max ? def.partes.flatMap(p => p.imgs.slice(0, Math.max(1, Math.floor(max / def.partes.length))).map(i => ({ p, i }))).slice(0, max) : todas;
    for (const { p, i } of pega) {
      const bm = Arq.img.get(i.k) || await new Promise(ok => { const b = Arq.bitmap(i.k, ok); if (b) ok(b); }); if (!bm) continue;
      const S = 112, k = Math.min(S / bm.width, S / bm.height, 1), c = new OffscreenCanvas(Math.max(1, Math.round(bm.width * k)), Math.max(1, Math.round(bm.height * k))), x = c.getContext('2d');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bm, 0, 0, c.width, c.height);
      const b = await c.convertToBlob({ type: 'image/jpeg', quality: .8 }), u8 = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let j = 0; j < u8.length; j += 8192) bin += String.fromCharCode(...u8.subarray(j, j + 8192));
      out.push({ type: 'text', text: `${p.nome} › ${i.nome}` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: btoa(bin) } });
    }
    return out;
  },
  /* ---------- APRENDER COM A EQUIPE: personagens salvos na nuvem viram exemplos para a IA ----------
     Não é treinar o modelo: a cada vez que organiza, a IA lê como a equipe montou outros personagens (e o que a equipe
     corrigiu depois que a IA organizou — def.iaCorrecoes) e segue o mesmo jeito. Quanto mais personagens salvos, melhor. */
  resumo(def) { // a estrutura por id (para comparar o que a IA fez com o que a equipe salvou)
    const est = Modelo.partesNoEstado(def, {}), out = { raiz: def.raiz || null, partes: {}, sessoes: {}, animacoes: (def.animacoes || []).map(a => a.nome) };
    for (const p of def.partes) { const im = p.imgs.find(i => i.id === est[p.id]?.img) || p.imgs[0], pv = im?.pivo;
      out.partes[p.id] = { nome: p.nome, pai: p.pai || null, z: p.z || 0, imgs: Object.fromEntries(p.imgs.map(i => [i.id, i.nome])), pivo: im && pv ? [round(pv.x / im.w, 2), round(pv.y / im.h, 2)] : null }; }
    for (const s of def.sessoes) out.sessoes[s.id] = { nome: s.nome, presets: s.presets.map(p => p.nome) };
    return out;
  },
  // o que a equipe mudou depois da IA (frases curtas)
  correcoes(antes, depois) {
    const L = [], nm = (R, id) => R.partes[id]?.nome || '(nenhuma)', ondeImg = (R, iid) => Object.keys(R.partes).find(pid => R.partes[pid].imgs[iid]);
    for (const [id, a] of Object.entries(antes.partes)) { const d = depois.partes[id];
      if (!d) { L.push(`apagou a parte "${a.nome}"`); continue; }
      if (d.nome !== a.nome) L.push(`renomeou a parte "${a.nome}" para "${d.nome}"`);
      if ((d.pai || null) !== (a.pai || null)) L.push(`"${d.nome}": a IA encaixou em "${nm(antes, a.pai)}", a equipe mudou para "${nm(depois, d.pai)}"`);
      if (a.pivo && d.pivo && Math.hypot(a.pivo[0] - d.pivo[0], a.pivo[1] - d.pivo[1]) > .12) L.push(`"${d.nome}": ponto de giro mudado de [${a.pivo}] para [${d.pivo}] (fração da imagem)`);
      for (const [iid, n] of Object.entries(a.imgs)) { const pd = ondeImg(depois, iid); if (pd && pd !== id) L.push(`a imagem "${n}" saiu de "${a.nome}" e foi para "${nm(depois, pd)}"`); else if (pd && depois.partes[pd].imgs[iid] !== n) L.push(`renomeou a imagem "${n}" para "${depois.partes[pd].imgs[iid]}"`); } }
    for (const [id, d] of Object.entries(depois.partes)) if (!antes.partes[id]) L.push(`criou a parte "${d.nome}"${d.pai ? ` encaixada em "${nm(depois, d.pai)}"` : ''}`);
    if ((antes.raiz || null) !== (depois.raiz || null)) L.push(`a raiz era "${nm(antes, antes.raiz)}", a equipe mudou para "${nm(depois, depois.raiz)}"`);
    for (const [id, a] of Object.entries(antes.sessoes)) { const d = depois.sessoes[id]; if (!d) { L.push(`apagou a sessão "${a.nome}"`); continue; }
      const tirou = a.presets.filter(x => !d.presets.includes(x)), pos = d.presets.filter(x => !a.presets.includes(x));
      if (tirou.length) L.push(`sessão "${d.nome}": tirou ${tirou.map(x => `"${x}"`).join(', ')}`); if (pos.length) L.push(`sessão "${d.nome}": criou ${pos.map(x => `"${x}"`).join(', ')}`); }
    for (const [id, d] of Object.entries(depois.sessoes)) if (!antes.sessoes[id]) L.push(`criou a sessão "${d.nome}" (${d.presets.slice(0, 6).join(', ')})`);
    const ta = antes.animacoes.filter(x => !depois.animacoes.includes(x)), pa = depois.animacoes.filter(x => !antes.animacoes.includes(x));
    if (ta.length) L.push(`apagou as animações ${ta.map(x => `"${x}"`).join(', ')}`); if (pa.length) L.push(`criou as animações ${pa.map(x => `"${x}"`).join(', ')}`);
    return L.slice(0, 25);
  },
  // os personagens da equipe (menos este), resumidos para servir de exemplo
  async exemplos(def, max = 4) {
    let lista = []; try { lista = await Nuvem.lista(); } catch { return []; }
    lista = lista.filter(x => x.id !== def.id).sort((a, b) => (b.modificado || 0) - (a.modificado || 0)).slice(0, 12);
    const defs = (await Promise.all(lista.map(x => Nuvem.abrir(x.id, true).catch(() => null)))).filter(d => d?.partes?.length >= 2);
    defs.sort((a, b) => (b.iaCorrecoes?.length ? 1 : 0) - (a.iaCorrecoes?.length ? 1 : 0) || (b.modificado || 0) - (a.modificado || 0)); // primeiro os que a equipe corrigiu
    const tipo = Modelo.vistaDe(def)?.tipo;
    return defs.slice(0, max).map(d0 => { const vt = tipo && (d0.vistas || []).find(v => v.tipo === tipo), d = vt ? Modelo.naVista(d0, vt.id) : d0, r = this.resumo(d), N = id => r.partes[id]?.nome; // o exemplo na mesma vista (ângulo), se tiver
      return { thumb: d.thumb, txt: JSON.stringify({ personagem: d.nome, raiz: N(r.raiz) || null,
        partes: Object.values(r.partes).map(p => ({ parte: p.nome, pai: N(p.pai) || null, z: p.z, pivo: p.pivo, imagens: Object.values(p.imgs).slice(0, 12) })),
        sessoes: Object.values(r.sessoes).map(s => ({ sessao: s.nome, presets: s.presets.slice(0, 12) })), animacoes: r.animacoes.slice(0, 10),
        correcoes_da_equipe_depois_da_IA: (d.iaCorrecoes || []).slice(0, 15) }).slice(0, 4000) }; });
  },
  /* ---------- ONDE CADA PEÇA FICA NA REFERÊNCIA (para o js/referencia.js acertar o lugar) ----------
     A IA olha a arte inteira e as peças e diz a região de cada uma (olhos e boca no rosto, a mão na ponta do braço…)
     e o ponto onde ela encaixa no corpo (ombro, quadril, pescoço). Depois a comparação de cores acha o lugar exato DENTRO dessa região. */
  SIS_REF: `Você ajuda a montar um personagem 2D de animação por partes. Recebe a REFERÊNCIA (o personagem inteiro, já montado) e as PEÇAS separadas (cada uma com o nome da parte).
Para CADA peça, diga onde ela fica NA REFERÊNCIA, em pixels da imagem da referência (o tamanho dela vem no texto; x para a direita, y para baixo):
- "caixa": [x0, y0, x1, y1] — a região onde essa peça aparece na referência (justa, sem folga grande).
- "encaixe": [x, y] — o ponto onde ela PRENDE no corpo: ombro no braço, punho na mão, quadril na perna, pescoço na cabeça, meio do rosto nos olhos/boca, topo da cabeça no chapéu/cabelo.
- "pose_diferente": true se a imagem da peça está numa pose que NÃO aparece na referência (ex.: braço acenando, mas na referência o braço está abaixado; perna dando passo, mas na referência está parada). Aí a "caixa" é onde aquela parte do corpo fica na referência, e o "encaixe" é o mais importante.
Olhe com cuidado: olhos, boca, sobrancelhas, nariz e bochechas ficam no ROSTO; mãos na ponta dos braços; sapatos/pés embaixo das pernas. Lados: "esquerdo/direito" é do personagem (o direito dele costuma ficar à ESQUERDA de quem olha, se ele está de frente); "de trás/da frente" é profundidade.
Se uma peça não existe na referência (acessório que não aparece), mande "caixa": null e diga onde ela ficaria em "encaixe", se der.
Responda SÓ um JSON: {"pecas":{"Nome exato da parte":{"caixa":[x0,y0,x1,y1],"encaixe":[x,y],"pose_diferente":false}, ...}}`,
  async ondeNaRef(def, ref) {
    const bm = Arq.img.get(ref.k); if (!bm) return null;
    const k = Math.min(1, 1000 / Math.max(bm.width, bm.height)), W = Math.round(bm.width * k), H = Math.round(bm.height * k), c = new OffscreenCanvas(W, H), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(bm, 0, 0, W, H);
    const b64 = async cv => { const b = await cv.convertToBlob({ type: 'image/jpeg', quality: .85 }), u8 = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let j = 0; j < u8.length; j += 8192) bin += String.fromCharCode(...u8.subarray(j, j + 8192)); return btoa(bin); };
    const content = [{ type: 'text', text: `REFERÊNCIA (${W} x ${H} pixels):` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await b64(c) } }, { type: 'text', text: 'PEÇAS (cada uma é uma parte; mostro a imagem que ela usa agora):' }];
    const est = Modelo.partesNoEstado(def, {}), nomes = [];
    for (const p of def.partes) { if (p === ref.parte || Referencia.ehRef(p)) continue; const im = p.imgs.find(i => i.id === est[p.id]?.img) || p.imgs[0], b = im && Arq.img.get(im.k); if (!b) continue;
      const S = 140, q = Math.min(S / b.width, S / b.height, 1), m = new OffscreenCanvas(Math.max(1, Math.round(b.width * q)), Math.max(1, Math.round(b.height * q))), y = m.getContext('2d'); y.fillStyle = '#fff'; y.fillRect(0, 0, m.width, m.height); y.drawImage(b, 0, 0, m.width, m.height);
      content.push({ type: 'text', text: `Parte "${p.nome}" (imagem "${im.nome}")` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await b64(m) } }); nomes.push(p.nome); }
    if (!nomes.length) return null;
    content.push({ type: 'text', text: `Responda para estas partes: ${JSON.stringify(nomes)}` });
    const j = this.json(await this.chama(this.SIS_REF, content)), out = {};
    for (const [nome, v] of Object.entries(j?.pecas || {})) { const p = this.acha(def.partes, nome); if (!p || !v) continue; const cx = v.caixa, en = v.encaixe;
      out[p.id] = { caixa: Array.isArray(cx) && cx.length === 4 && cx.every(n => isFinite(+n)) ? { x0: Math.min(cx[0], cx[2]) / W, y0: Math.min(cx[1], cx[3]) / H, x1: Math.max(cx[0], cx[2]) / W, y1: Math.max(cx[1], cx[3]) / H } : null,
        encaixe: Array.isArray(en) && en.length === 2 && en.every(n => isFinite(+n)) ? { x: en[0] / W, y: en[1] / H } : null, poseDif: !!v.pose_diferente }; }
    return out;
  },
  async organizar(def, modo, pedido, aoEscrever) {
    const est = Modelo.partesNoEstado(def, {}), cx = Modelo.montar(def, est); // onde cada parte está no desenho (para a IA entender quem fica perto de quem)
    const partes = def.partes.map(p => { const it = cx.find(i => i.parte.id === p.id), c = it?.img ? it.m.transformPoint(new DOMPoint((it.img.ajuste?.x || 0) - (it.img.pivo?.x ?? it.img.w / 2) + it.img.w / 2, (it.img.ajuste?.y || 0) - (it.img.pivo?.y ?? it.img.h / 2) + it.img.h / 2)) : null;
      return { parte: p.nome, pai: def.partes.find(x => x.id === p.pai)?.nome || null, raiz: p.id === def.raiz || undefined, z: p.z || 0, centro_no_desenho: c ? [Math.round(c.x), Math.round(c.y)] : null, imagens: p.imgs.map(i => `${i.nome} (${Math.round(i.w)}x${Math.round(i.h)})`) }; });
    const sess = def.sessoes.map(s => ({ sessao: s.nome, presets: s.presets.map(pr => pr.nome) })), anims = (def.animacoes || []).map(a => a.nome);
    // vistas: esta é uma das vistas (ângulos) do personagem; as outras já têm nomes — usar os mesmos ajuda o editor a trocar de vista sem perder as poses
    const vAt = Modelo.vistaDe(def), outras = (def.vistas || []).filter(v => v.id !== def.vistaAtual && v.partes?.length);
    const txtVista = vAt ? `\nVISTA DESTE CONJUNTO: ${vAt.nome} (${Modelo.nomeTipo(vAt.tipo)}) — o personagem visto ${{ frente: 'de frente', 'tres-quartos': 'em três-quartos', lado: 'de lado (perfil)', costas: 'de costas', 'tres-quartos-costas': 'em três-quartos de costas', cima: 'de cima' }[vAt.tipo] || 'deste ângulo'}.` +
      (outras.length ? `\nOUTRAS VISTAS JÁ PRONTAS (use EXATAMENTE os mesmos nomes de partes, sessões, presets e animações quando for a mesma coisa; o que não aparecer nesta vista, deixe de fora): ${JSON.stringify(outras.map(v => ({ vista: v.nome, partes: v.partes.map(p => p.nome), sessoes: (v.sessoes || []).map(x => ({ sessao: x.nome, presets: x.presets.map(p => p.nome) })), animacoes: (v.animacoes || []).map(a => a.nome) })))}` : '') : '';
    const foco = modo === 'animacoes' ? 'Crie SÓ "animacoes" (de teste) com as peças que existem; não mexa no resto.' : 'Organize TUDO (juntar, nomes, raiz, pais, camadas, sessões, presets e animações de teste).';
    const exs = await this.exemplos(def).catch(() => []), exC = [];
    if (exs.length) { exC.push({ type: 'text', text: `COMO A EQUIPE JÁ MONTOU OUTROS PERSONAGENS (siga o mesmo jeito de organizar e NÃO repita os erros que a equipe corrigiu; cada personagem é diferente, então adapte):` });
      for (const e of exs) { if (/^data:image\/(png|jpeg);base64,/.test(e.thumb || '')) exC.push({ type: 'image', source: { type: 'base64', media_type: e.thumb.slice(5, e.thumb.indexOf(';')), data: e.thumb.split(',')[1] } }); exC.push({ type: 'text', text: e.txt }); } }
    const refC = await RefsAnim.conteudo(def.refsAnim).catch(() => []); // vídeos de referência (test drive da equipe + os deste personagem)
    const content = [...exC, ...refC, { type: 'text', text: `${exs.length ? 'AGORA O PERSONAGEM NOVO.\n' : ''}PERSONAGEM: ${def.nome}${txtVista}\nPARTES: ${JSON.stringify(partes)}\nSESSÕES QUE JÁ EXISTEM: ${JSON.stringify(sess)}\nANIMAÇÕES QUE JÁ EXISTEM: ${JSON.stringify(anims)}\n\n${foco}${pedido ? '\nPEDIDO DA PESSOA: ' + pedido : ''}\n\nMINIATURAS:` }, ...(await this.miniaturas(def))];
    return this.json(await this.chama(this.SIS_ORGANIZAR, content, aoEscrever));
  },
};
