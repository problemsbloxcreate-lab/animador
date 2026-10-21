/* ===================== ia.js — IA do Estúdio Problems no Animador =====================
   Fala com o servidor do Estúdio Problems (Cloudflare, login do Google). A IA recebe os personagens com as sessões e presets
   que você configurou uma vez (olhos, boca, poses…), as legendas da fala e as camadas, e devolve AÇÕES que o Animador aplica
   (escolher pose por quadro, mover, câmera, efeitos). No Ateliê, cria presets/poses novos a partir das peças que já existem. */
'use strict';
const IA = {
  get srv() { return Nuvem.srv; },
  async chama(sistema, pedido, aoEscrever) {
    if (!this.srv) throw new Error('O servidor da IA não está configurado.');
    const corpo = { system: [{ type: 'text', text: sistema }], messages: [{ role: 'user', content: pedido }] };
    for (let tent = 0; tent < 3; tent++) {
      let r; try { r = await fetch(this.srv + '/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', ...(await Nuvem.hd()) }, body: JSON.stringify(corpo) }); }
      catch { if (tent < 2) { await sleep(2500 * (tent + 1)); continue; } throw new Error('Não consegui falar com o servidor da IA. Confira a internet.'); }
      if (r.ok && /event-stream/.test(r.headers.get('content-type') || '')) return this.leStream(r, aoEscrever);
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
  json(txt) { const m = String(txt).match(/\{[\s\S]*\}/); if (!m) throw new Error('A IA não devolveu as ações.'); return JSON.parse(m[0]); },
  acha(lista, nomeOuId, campo = 'nome') { const n = String(nomeOuId || '').trim().toLowerCase(); return lista.find(x => x.id === nomeOuId) || lista.find(x => String(x[campo]).toLowerCase() === n) || lista.find(x => String(x[campo]).toLowerCase().includes(n) && n.length > 2); },

  /* ---------- animar na cena ---------- */
  contexto(P) {
    const pers = Object.values(P.personagens).map(d => ({ personagem: d.nome, sessoes: d.sessoes.map(s => ({ sessao: s.nome, presets: s.presets.map(p => p.nome) })), partes: d.partes.map(p => p.nome) }));
    const camadas = Modelo.todos(P).map(n => ({ camada: n.nome, tipo: n.tipo, personagem: n.tipo === 'personagem' ? P.personagens[n.ref]?.nome : undefined, de: (n.de || 0) + 1, ate: Modelo.fimNo(P, n) + 1, posicao: (({ x, y, s }) => ({ x: Math.round(x), y: Math.round(y), s: round(s, 2) }))(Modelo.transf(n, App.q)) }));
    const fala = (P.legendas || []).map(g => `${g.de + 1}-${g.ate + 1}: ${g.texto}`).join('\n');
    return { quadros: P.duracao, fps: P.fps, tamanho: `${P.w}x${P.h}`, quadroAtual: App.q + 1, personagens: pers, camadas, efeitos: Efeitos.TELA.map(e => e.id), visuais: Efeitos.VISUAIS.map(v => v.id), fala };
  },
  SIS_CENA: `Você é o animador assistente do ANIMADOR do Estúdio Problems (canal Problems, animação 2D de personagens montados por partes).
Você recebe o projeto em JSON: quadros (numerados a partir de 1), fps, personagens com SESSÕES e PRESETS (ex.: sessão "Olhos" com "assustado", "fechado"; sessão "Pose" com "chutando"), camadas e a fala com os quadros de cada frase.
Responda SÓ um JSON: {"explica":"frase curta do que fez","acoes":[...]}.
Ações possíveis:
 {"tipo":"pose","camada":"nome da camada","quadro":N,"sessoes":{"Nome da sessão":"nome do preset"}}   (vale até a próxima pose daquela sessão)
 {"tipo":"mover","camada":"nome","quadro":N,"x":0,"y":0,"r":0,"s":1}   (só os campos que mudam; x/y em pixels do projeto)
 {"tipo":"camera","quadro":N,"x":0,"y":0,"zoom":1}
 {"tipo":"efeito","efeito":"vinheta|granulado|cinema|flash|tremor|desfoque|brilho|vhs|escurecer|clarear","de":N,"ate":N,"forca":0.5}
 {"tipo":"tremulo","camada":"nome","modo":"tremer|ondular|nenhum","forca":0.4}   (deixa uma imagem/camada parada "viva", tremendo ou ondulando)
 {"tipo":"visual","visual":"normal|vivo|quente|frio|noite|por-do-sol|vintage|pb|sonho|terror|desbotado|neon"}
 {"tipo":"cenario","descricao":"o lugar em português, sem personagens"}   (só se a pessoa pedir um cenário/fundo novo; sai no estilo da casa e fica só nesta animação)
Regras: use só nomes de sessões e presets que existem. Para atuação pela fala, mude expressões nas palavras fortes (piscar de vez em quando: olhos fechados por 2-3 quadros), sem trocar a cada quadro. Respeite o pedido.`,
  // faz o pedido na animação aberta (o mesmo do botão IA) e devolve o texto do que fez
  async executar(txt, foco, mostra) {
    const P = App.P, out = await this.chama(this.SIS_CENA, `PROJETO:\n${JSON.stringify(this.contexto(P))}\n\nPEDIDO: ${txt}${foco ? `\n(Camada em foco: "${foco.nome}")` : ''}`, t => mostra?.(t.slice(-600)));
    const j = this.json(out); let n = this.aplicar(j.acoes || []);
    for (const c of this.cenariosPedidos) { mostra?.('Montando o cenário: ' + c.descricao + '…'); const r = await Cenarios.pedirIA(c.descricao, null, t => mostra?.('Montando o cenário… (' + t.length + ' letras)')); Cenarios.guardaUltimo(r.cena); await Cenarios.porNaCena(await Cenarios.desenhar(r.cena), r.cena); const nn = App.noSel(); if (nn) nn.ia = true; n++; }
    return (j.explica || 'Pronto.') + `\n\n${n} ação(ões) aplicada(s). Dá para desfazer com Ctrl+Z.` + (this.cenariosPedidos.length ? '\nO cenário fica só nesta animação: para guardar na equipe, botão direito nele › Salvar na nuvem.' : '');
  },
  async abrir(foco) {
    const P = App.P;
    const body = h(`<div><p>Peça em português. A IA usa os personagens, as sessões e presets deles${P.legendas.length ? ', e a <b>fala</b> (legendas)' : ''}.</p>
      <label class="field">O que fazer?<textarea rows="4" placeholder="Ex.: anima o ${esc(foco?.nome || 'Problems')} pela fala: olhos assustados quando ele grita, pisca de vez em quando, e um tremor de tela no fim"></textarea></label>
      <div class="ia-res" hidden></div></div>`);
    const res = $('.ia-res', body);
    await UI.modal({ title: 'Animar com a IA', icon: 'sparkles', kind: 'ia', width: 620, body, buttons: [{ label: 'Fechar', value: null }, { label: 'Pedir', icon: 'sparkles', kind: 'primary ia', onClick: async api => {
      const txt = $('textarea', body).value.trim(); if (!txt) return false;
      const bt = api.foot.querySelector('.btn.primary'); bt.disabled = true; res.hidden = false; res.textContent = 'Pensando…';
      try { res.textContent = await this.executar(txt, foco, t => { res.textContent = t; });
      } catch (e) { res.textContent = 'Não deu: ' + e.message; }
      bt.disabled = false; return false;
    } }] });
  },
  cenariosPedidos: [],
  aplicar(acoes) {
    const P = App.P, todos = Modelo.todos(P); let n = 0; this.cenariosPedidos = [];
    const q = v => clamp(Math.round(+v || 1) - 1, 0, P.duracao - 1);
    for (const a of acoes) {
      try {
        if (a.tipo === 'pose' || a.tipo === 'mover') {
          const no = this.acha(todos, a.camada); if (!no) continue;
          if (a.tipo === 'pose' && no.tipo === 'personagem') { const def = P.personagens[no.ref], k = Modelo.chave(no, q(a.quadro)); k.sessoes = k.sessoes || {};
            for (const [sn, pn] of Object.entries(a.sessoes || {})) { const s = this.acha(def.sessoes, sn); const p = s && (pn ? this.acha(s.presets, pn) : null); if (s) { k.sessoes[s.id] = p ? p.id : null; } } n++; }
          if (a.tipo === 'mover') { const v = {}; for (const c of ['x', 'y', 'r', 's', 'op']) if (a[c] != null && isFinite(+a[c])) v[c] = +a[c]; Modelo.poeTransf(no, q(a.quadro), v); n++; }
        } else if (a.tipo === 'camera') { const k = q(a.quadro); P.camera.chaves[k] = { ...Modelo.camera(P, k), ...Object.fromEntries(['x', 'y', 'zoom', 'r'].filter(c => a[c] != null).map(c => [c, +a[c]])) }; n++; }
        else if (a.tipo === 'efeito' && Efeitos.TELA.some(e => e.id === a.efeito)) { const t = App.efeitoTopo(); t.efeitos.push({ id: uid('ef'), tipo: a.efeito, de: q(a.de), ate: Math.max(q(a.de), q(a.ate)), forca: clamp(+a.forca || .5, 0, 1) }); App.nomeEfeito(t); n++; }
        else if (a.tipo === 'tremulo') { const no = this.acha(todos, a.camada); if (no) { if (a.modo === 'nenhum') delete no.tremulo; else no.tremulo = { modo: a.modo === 'ondular' ? 'ondular' : 'tremer', forca: clamp(+a.forca || .4, .05, 1), ritmo: 2 }; n++; } }
        else if (a.tipo === 'visual' && Efeitos.VISUAIS.some(v => v.id === a.visual)) { const t = App.efeitoTopo(); t.efeitos = t.efeitos.filter(e => e.tipo !== 'cor'); if (a.visual !== 'normal') t.efeitos.push({ id: uid('ef'), tipo: 'cor', visual: a.visual }); App.nomeEfeito(t); n++; }
        else if (a.tipo === 'cenario' && a.descricao) this.cenariosPedidos.push(a);
      } catch (e) { console.warn('ação da IA', a, e); }
    }
    if (n) App.commit('IA: ' + n + ' ações');
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
 "animacoes":[{"nome":"Piscar","vel":250,"trilhas":[[{"Olhos":"abertos"},{"Olhos":"meio"},{"Olhos":{"img":"fechados","r":0}}]]}]
}
Estrutura modelo (é como a Lumi foi montada e funciona bem): a raiz é o Corpo/tronco; braços, pernas e cabeça encaixam no corpo; olhos, boca, sobrancelhas, cabelo e chapéu encaixam na cabeça (ou no corpo, se a cabeça faz parte dele);
cada peça que tem várias versões vira UMA parte com várias imagens (ex.: Olhos: abertos, meio fechados, fechados, felizes, surpresos; Boca: A, E, O, U, M/B/P, F/V, sorriso; Braço: caído, acenando, apontando, na cintura);
braço e perna de trás ficam atrás do corpo; braço da frente, rosto e cabelo da frente na frente. As partes chegam já no lugar certo (camadas do mesmo desenho): NÃO precisa mover, só organizar.
Regras: use SÓ partes e imagens que existem (nomes exatos, ou os novos nomes que você mesmo deu). Sessões por grupo de peça (Olhos, Boca, Braço direito, Pernas, Pose…),
um preset por imagem útil + poses combinadas que façam sentido. Animações de teste curtas e úteis: piscar, falar (bocas A/E/O/U/M…), andar (pernas alternando), acenar, gesticular.
Em "trilhas", cada passo é {"Parte":"imagem"} ou {"Parte":{"img":"imagem","r":graus}}; trilhas diferentes andam juntas (ex.: pernas + boca + olhos). vel em ms (120 a 700).
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
  async organizar(def, modo, pedido, aoEscrever) {
    const est = Modelo.partesNoEstado(def, {}), cx = Modelo.montar(def, est); // onde cada parte está no desenho (para a IA entender quem fica perto de quem)
    const partes = def.partes.map(p => { const it = cx.find(i => i.parte.id === p.id), c = it?.img ? it.m.transformPoint(new DOMPoint((it.img.ajuste?.x || 0) - (it.img.pivo?.x ?? it.img.w / 2) + it.img.w / 2, (it.img.ajuste?.y || 0) - (it.img.pivo?.y ?? it.img.h / 2) + it.img.h / 2)) : null;
      return { parte: p.nome, pai: def.partes.find(x => x.id === p.pai)?.nome || null, raiz: p.id === def.raiz || undefined, z: p.z || 0, centro_no_desenho: c ? [Math.round(c.x), Math.round(c.y)] : null, imagens: p.imgs.map(i => `${i.nome} (${Math.round(i.w)}x${Math.round(i.h)})`) }; });
    const sess = def.sessoes.map(s => ({ sessao: s.nome, presets: s.presets.map(pr => pr.nome) })), anims = (def.animacoes || []).map(a => a.nome);
    const foco = modo === 'animacoes' ? 'Crie SÓ "animacoes" (de teste) com as peças que existem; não mexa no resto.' : 'Organize TUDO (juntar, nomes, raiz, pais, camadas, sessões, presets e animações de teste).';
    const content = [{ type: 'text', text: `PERSONAGEM: ${def.nome}\nPARTES: ${JSON.stringify(partes)}\nSESSÕES QUE JÁ EXISTEM: ${JSON.stringify(sess)}\nANIMAÇÕES QUE JÁ EXISTEM: ${JSON.stringify(anims)}\n\n${foco}${pedido ? '\nPEDIDO DA PESSOA: ' + pedido : ''}\n\nMINIATURAS:` }, ...(await this.miniaturas(def))];
    return this.json(await this.chama(this.SIS_ORGANIZAR, content, aoEscrever));
  },
};
