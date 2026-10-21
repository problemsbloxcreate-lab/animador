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
 {"tipo":"visual","visual":"normal|vivo|quente|frio|noite|por-do-sol|vintage|pb|sonho|terror|desbotado|neon"}
 {"tipo":"cenario","descricao":"o lugar em português, sem personagens"}   (só se a pessoa pedir um cenário/fundo novo; sai no estilo da casa e fica só nesta animação)
Regras: use só nomes de sessões e presets que existem. Para atuação pela fala, mude expressões nas palavras fortes (piscar de vez em quando: olhos fechados por 2-3 quadros), sem trocar a cada quadro. Respeite o pedido.`,
  async abrir(foco) {
    const P = App.P;
    const body = h(`<div><p>Peça em português. A IA usa os personagens, as sessões e presets deles${P.legendas.length ? ', e a <b>fala</b> (legendas)' : ''}.</p>
      <label class="field">O que fazer?<textarea rows="4" placeholder="Ex.: anima o ${esc(foco?.nome || 'Problems')} pela fala: olhos assustados quando ele grita, pisca de vez em quando, e um tremor de tela no fim"></textarea></label>
      <div class="ia-res" hidden></div></div>`);
    const res = $('.ia-res', body);
    await UI.modal({ title: 'Animar com a IA', icon: 'sparkles', kind: 'ia', width: 620, body, buttons: [{ label: 'Fechar', value: null }, { label: 'Pedir', kind: 'primary ia', onClick: async api => {
      const txt = $('textarea', body).value.trim(); if (!txt) return false;
      const bt = api.foot.querySelector('.btn.primary'); bt.disabled = true; res.hidden = false; res.textContent = 'Pensando…';
      try {
        const out = await this.chama(this.SIS_CENA, `PROJETO:\n${JSON.stringify(this.contexto(P))}\n\nPEDIDO: ${txt}${foco ? `\n(Camada em foco: "${foco.nome}")` : ''}`, t => { res.textContent = t.slice(-600); });
        const j = this.json(out); let n = this.aplicar(j.acoes || []);
        for (const c of this.cenariosPedidos) { res.textContent = 'Montando o cenário: ' + c.descricao + '…'; const r = await Cenarios.pedirIA(c.descricao, null, t => { res.textContent = 'Montando o cenário… (' + t.length + ' letras)'; }); Cenarios.guardaUltimo(r.cena); await Cenarios.porNaCena(await Cenarios.desenhar(r.cena), r.cena); const nn = App.noSel(); if (nn) nn.ia = true; n++; }
        res.textContent = (j.explica || 'Pronto.') + `\n\n${n} ação(ões) aplicada(s). Dá para desfazer com Ctrl+Z.` + (this.cenariosPedidos.length ? '\nO cenário fica só nesta animação: para guardar na equipe, botão direito nele › Salvar na nuvem.' : '');
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
        else if (a.tipo === 'efeito' && Efeitos.TELA.some(e => e.id === a.efeito)) { P.efeitos.tela.push({ id: uid('ef'), tipo: a.efeito, de: q(a.de), ate: Math.max(q(a.de), q(a.ate)), forca: clamp(+a.forca || .5, 0, 1) }); n++; }
        else if (a.tipo === 'visual' && Efeitos.VISUAIS.some(v => v.id === a.visual)) { P.efeitos.visual = a.visual; n++; }
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
};
