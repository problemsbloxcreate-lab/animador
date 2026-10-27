/* ===================== ideias.js — aba IDEIAS da tela inicial do Animador =====================
   1) ANÁLISE: a Action "Analisar canais" (repo estudio-problems) lê os canais do YouTube (padrão @Torajo e @TurmaDaBatatinha)
      e grava ideias/analise.json na nuvem da equipe; o botão Atualizar pede uma análise nova (turma-ia /ideias → Worker sons →
      Action) e a página espera ela chegar. Mostra os VÍDEOS e os SHORTS que estão indo bem (views ÷ mediana do canal) e o que
      é mais visto de sempre.
   2) IDEIAS: a IA lê a análise + as miniaturas dos que estão indo bem + o guia ideias/GUIA.md e escreve ideias (short ou longo)
      no estilo do canal; ficam para a equipe toda (ideias/ideias.json). Gerar tudo de novo, mais, ou refazer só as marcadas.
   3) ROTEIRO (cada um guardado só neste computador, arquivos["roteiro:<id>"]): ideias escolhidas → PERSONAGENS (nuvem, deste
      computador ou uma imagem PNG/SVG; nome no roteiro, cor e jeito — a cor/jeito de um personagem da nuvem ficam salvos nele) →
      SITUAÇÕES (gerar de novo até gostar; tudo ou só as marcadas) → ROTEIRO (cenas e falas editáveis; refazer tudo ou só as
      falas marcadas) → VOZES (gravar/pôr um áudio por fala, ou um áudio por personagem que é cortado nas pausas) → GERAR O VÍDEO
      (monta a animação: personagens por cena, vozes, legendas, boca pela voz, cenários da IA e a animação pela IA, copiando o
      estilo dos vídeos analisados). Nada disso usa a nuvem além da análise, das ideias e da cor/jeito dos personagens. */
'use strict';
const Ideias = {
  S: null, aba: 'ideias', filtro: 'todas', sel: new Set(), _carregando: null, roteiro: null,
  CANAIS: ['@Torajo', '@TurmaDaBatatinha'],
  EMOCOES: ['neutro', 'feliz', 'bravo', 'triste', 'assustado', 'surpreso', 'sarcástico', 'apaixonado', 'pensativo', 'envergonhado'],
  CAMERAS: ['geral', 'médio', 'close', 'zoom rápido', 'tremor', 'seguindo'],
  // ---------- servidor ----------
  async pede(c, o = {}) { const r = await fetch(Nuvem.srv + c, { ...o, headers: { 'content-type': 'application/json', ...(await Nuvem.hd()), ...(o.headers || {}) } }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.error?.message || 'o servidor respondeu ' + r.status); return j; },
  async carrega(novo) { if (!novo && this.S) return this.S; if (!this._carregando || novo) this._carregando = this.pede('/ideias').then(j => (this.S = j)).finally(() => { this._carregando = null; }); return this._carregando; },
  async guia() { if (!this._guia) this._guia = fetch('ideias/GUIA.md', { cache: 'no-cache' }).then(r => r.ok ? r.text() : '').catch(() => ''); return this._guia; },
  canais() { return this.S?.canais?.length ? this.S.canais : this.CANAIS; },
  quando(iso) { if (!iso) return 'nunca'; const t = Date.parse(iso), m = Math.round((Date.now() - t) / 60000), d = new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    return `${d} (${m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} dia${m >= 2880 ? 's' : ''}`})`; },
  num(v) { v = +v || 0; return v >= 1e6 ? String(round(v / 1e6, v >= 1e7 ? 0 : 1)).replace('.', ',') + ' mi' : v >= 1e3 ? Math.round(v / 1e3) + ' mil' : String(v); },
  thumb(id, short) { return short ? `https://i.ytimg.com/vi/${id}/oar2.jpg` : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`; },

  // ---------- a aba ----------
  async pinta(c) {
    this.el = c; if (this.roteiro) return this.pintaRoteiro();
    c.innerHTML = `<div class="ide"><div class="ide-topo"><div class="ide-canais"></div><div class="ide-at"><button class="btn sm" data-at>${ic('undo', 13)} Atualizar a análise</button><small data-em>carregando…</small></div></div>
      <div class="ide-rots" hidden></div>
      <div class="ide-abas"><button data-s="ideias">${ic('bulb', 14)} Ideias</button><button data-s="longos">${ic('film', 14)} Vídeos que estão indo bem</button><button data-s="shorts">${ic('play', 14)} Shorts que estão indo bem</button></div>
      <div class="ide-corpo"><div class="vazio"><span class="spin-dot"></span> Carregando a análise…</div></div><div class="ide-barra" hidden></div></div>`;
    $$('[data-s]', c).forEach(b => { b.classList.toggle('on', b.dataset.s === this.aba); b.onclick = () => { this.aba = b.dataset.s; this.pinta(c); }; });
    $('[data-at]', c).onclick = () => this.atualizar();
    this.pintaRoteiros();
    try { await this.carrega(); } catch (e) { $('.ide-corpo', c).innerHTML = `<div class="vazio">Não consegui ler a análise: ${esc(e.message)}</div>`; return; }
    if (!c.isConnected || this.el !== c) return;
    this.pintaTopo(); this.pintaCorpo();
  },
  pintaTopo() {
    const c = this.el, A = this.S?.analise, box = $('.ide-canais', c); box.innerHTML = '';
    for (const h0 of this.canais()) { const ca = A?.canais?.find(x => x.h.toLowerCase() === h0.toLowerCase());
      const b = h(`<span class="ide-canal">${ca?.avatar ? `<img src="${esc(ca.avatar)}" alt="">` : `<span class="ide-av">${ic('tv', 13)}</span>`}<span><b>${esc(ca?.nome || h0)}</b><small>${esc(ca ? ca.inscritos || h0 : 'ainda não analisado')}</small></span><button class="ibtn" title="Tirar este canal">${ic('x', 11)}</button></span>`);
      $('button', b).onclick = () => this.mudaCanais(this.canais().filter(x => x !== h0)); box.appendChild(b); }
    const add = h(`<button class="ide-canal ide-add" title="Analisar mais um canal (@nome)">${ic('plus', 13)} Canal</button>`); add.onclick = async () => { const v = await UI.prompt({ title: 'Analisar mais um canal', label: 'Nome do canal no YouTube (com @)', value: '@', ok: 'Adicionar' }); if (v && v.trim().length > 2) this.mudaCanais([...this.canais(), v.trim()]); };
    box.appendChild(add);
    const em = $('[data-em]', c), espera = this._espera;
    em.innerHTML = espera ? `<span class="spin-dot"></span> O robô está lendo os canais (1–3 min)…` : `Última análise: <b>${esc(this.quando(A?.em))}</b>${A?.erros?.length ? ` · <span class="ide-err" title="${esc(A.erros.map(e => e.h + ': ' + e.erro).join('\n'))}">${A.erros.length} canal(is) com erro</span>` : ''}`;
    $('[data-at]', c).disabled = !!espera;
  },
  async mudaCanais(L) { if (!L.length) return UI.toast('Deixe pelo menos um canal.', { kind: 'warn' }); this.S = { ...(this.S || {}), canais: L }; this.pintaTopo();
    if (await UI.confirm({ title: 'Analisar os canais agora?', msg: 'A análise nova lê os canais marcados (1–3 min).', ok: 'Analisar agora' })) this.atualizar(); },
  // pede a análise nova e espera ela chegar; quem pediu já ganha as ideias novas
  async atualizar() {
    const antes = this.S?.analise?.em || null;
    try { const r = await this.pede('/ideias', { method: 'POST', body: JSON.stringify({ acao: 'atualizar', canais: this.canais() }) }); if (r.ja) UI.toast('A análise já foi pedida há pouco; esperando ela chegar.', { kind: 'info' }); }
    catch (e) { return UI.toast('Não deu para pedir a análise: ' + esc(e.message), { kind: 'err' }); }
    this._espera = Date.now(); this.pintaTopo();
    while (Date.now() - this._espera < 8 * 60e3) {
      await sleep(12000); let S; try { S = await this.carrega(true); } catch { continue; }
      if (S?.analise?.em && S.analise.em !== antes) { this._espera = null; if (this.el?.isConnected && !this.roteiro) { this.pintaTopo(); this.pintaCorpo(); } UI.toast('Análise nova chegou! Agora a IA vai pensar em ideias com ela.', { kind: 'ok' }); return this.gerarIdeias({ tudo: true }); }
    }
    this._espera = null; if (this.el?.isConnected) this.pintaTopo(); UI.toast('A análise demorou demais. Tente de novo daqui a pouco.', { kind: 'warn' });
  },
  pintaCorpo() {
    const c = $('.ide-corpo', this.el); if (!c) return; c.innerHTML = '';
    const A = this.S?.analise; if (!A?.canais?.length) { c.innerHTML = `<div class="vazio">Ainda não tem análise. Aperte <b>Atualizar a análise</b> (o robô lê os canais em 1–3 min).</div>`; return; }
    if (this.aba === 'ideias') return this.pintaIdeias(c);
    const tipo = this.aba, modo = this._modo?.[tipo] || 'bem', short = tipo === 'shorts';
    const sw = h(`<div class="ide-modo"><button data-m="bem">${ic('bolt', 12)} Indo bem agora</button><button data-m="populares">${ic('star', 12)} Mais vistos de sempre</button><button data-m="recentes">${ic('clock', 12)} Mais novos</button><span class="sp"></span><small>nota = visualizações ÷ a mediana do canal (${short ? 'shorts' : 'vídeos longos'})</small></div>`);
    $$('[data-m]', sw).forEach(b => { b.classList.toggle('on', b.dataset.m === modo); b.onclick = () => { (this._modo ||= {})[tipo] = b.dataset.m; this.pintaCorpo(); }; }); c.appendChild(sw);
    for (const ca of A.canais) {
      const L = ca[tipo]?.[modo] || []; if (!L.length) continue;
      c.appendChild(h(`<div class="ide-sec">${ca.avatar ? `<img src="${esc(ca.avatar)}" alt="">` : ''}<b>${esc(ca.nome)}</b><small>${esc(ca.inscritos || '')} · mediana ${this.num(ca.mediana?.[short ? 'short' : 'longo'])} views</small></div>`));
      const g = h(`<div class="ide-vids ${short ? 'sh' : ''}"></div>`);
      for (const v of L) { const quente = v.nota >= 1.5, c2 = h(`<a class="ide-vid" href="https://youtu.be/${esc(v.id)}" target="_blank" rel="noopener"><span class="ide-th"><img loading="lazy" src="${this.thumb(v.id, short)}" alt="">${v.dur ? `<i>${esc(v.dur)}</i>` : ''}</span>
        <span class="ide-vi"><b>${esc(v.titulo || '(sem título)')}</b><small>${this.num(v.views)} views${v.dias != null ? ` · ${v.dias === 0 ? 'hoje' : `há ${v.dias} d`}` : ''}</small>${v.nota ? `<em class="${quente ? 'q' : ''}" title="visualizações ÷ mediana do canal">×${String(v.nota).replace('.', ',')}</em>` : ''}</span></a>`);
        const im = $('img', c2); im.onerror = () => { if (short && !im.dataset.f) { im.dataset.f = 1; im.src = this.thumb(v.id); } }; g.appendChild(c2); }
      c.appendChild(g);
    }
  },
  // ---------- IDEIAS ----------
  pintaIdeias(c) {
    const I = this.S?.ideias, L = (I?.lista || []).filter(x => this.filtro === 'todas' || x.formato === this.filtro), A = this.S.analise, velha = I && I.base !== A?.em;
    const top = h(`<div class="ide-itopo"><div class="ide-modo"><button data-f="todas">Todas <small>${I?.lista?.length || 0}</small></button><button data-f="short">${ic('play', 12)} Shorts <small>${(I?.lista || []).filter(x => x.formato === 'short').length}</small></button><button data-f="longo">${ic('film', 12)} Vídeos longos <small>${(I?.lista || []).filter(x => x.formato === 'longo').length}</small></button></div>
      <div class="ide-ger"><span class="ide-gic">${ic('sparkles', 18)}</span><div class="ide-gin"><b>Ideias com a IA</b><small>Ela lê a análise dos canais e escreve ideias no nosso estilo.</small><textarea rows="2" placeholder="Quer algo específico? Ex.: só com a Lumi, terror leve, um clipe musical… (opcional)">${esc(this._dir || '')}</textarea></div><div class="ide-gbts"><button class="btn sm ia" data-g>${ic('sparkles', 13)} ${I?.lista?.length ? 'Gerar de novo' : 'Gerar ideias'}</button>${I?.lista?.length ? `<button class="btn sm" data-mais>${ic('plus', 13)} Mais 6</button>` : ''}</div></div></div>`);
    $$('[data-f]', top).forEach(b => { b.classList.toggle('on', b.dataset.f === this.filtro); b.onclick = () => { this.filtro = b.dataset.f; this.pintaCorpo(); }; });
    const dir = $('textarea', top); dir.oninput = () => { this._dir = dir.value; };
    $('[data-g]', top).onclick = () => this.gerarIdeias({ tudo: true }); if ($('[data-mais]', top)) $('[data-mais]', top).onclick = () => this.gerarIdeias({ mais: 6 });
    c.appendChild(top);
    if (velha) c.appendChild(h(`<div class="ide-aviso">${ic('info', 13)} Tem análise nova (${esc(this.quando(A.em))}) depois destas ideias. <b>Gerar de novo</b> usa os números de agora.</div>`));
    if (I?.padroes?.length) { const p = h(`<details class="ide-pad" open><summary>${ic('bolt', 13)} O que está dando certo agora <small>${esc(this.quando(I.em))}</small></summary><ul>${I.padroes.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>`); c.appendChild(p); }
    if (!L.length) { c.appendChild(h(`<div class="vazio">${I?.lista?.length ? 'Nenhuma ideia com esse filtro.' : 'Ainda não tem ideias. Aperte <b>Gerar ideias</b>: a IA lê a análise e as miniaturas do que está indo bem.'}</div>`)); this.pintaBarra(); return; }
    const g = h('<div class="ide-ideias"></div>');
    for (const x of L) {
      const on = this.sel.has(x.id), card = h(`<div class="ide-ideia ${on ? 'on' : ''} ${x.formato}"><label class="ide-ck"><input type="checkbox" ${on ? 'checked' : ''}></label>
        <div class="ide-ib"><div class="ide-it"><span class="ide-fmt">${ic(x.formato === 'short' ? 'play' : 'film', 11)} ${x.formato === 'short' ? 'Short' : 'Vídeo longo'}</span>${x.esforco ? `<span class="ide-esf e-${esc(x.esforco)}">esforço ${esc(x.esforco)}</span>` : ''}${x.aposta ? '<span class="ide-esf e-aposta">aposta</span>' : ''}</div>
        <b>${esc(x.titulo)}</b>${x.gancho ? `<p class="ide-gancho">“${esc(x.gancho)}”</p>` : ''}<p>${esc(x.resumo || '')}</p>
        ${x.porque ? `<p class="ide-pq">${ic('star', 11)} ${esc(x.porque)}</p>` : ''}${x.personagens?.length ? `<p class="ide-ps">${ic('users', 11)} ${x.personagens.map(esc).join(', ')}</p>` : ''}</div></div>`);
      const ck = $('input', card); ck.onchange = () => { ck.checked ? this.sel.add(x.id) : this.sel.delete(x.id); card.classList.toggle('on', ck.checked); this.pintaBarra(); };
      card.onclick = e => { if (e.target.closest('.ide-ck')) return; ck.checked = !ck.checked; ck.onchange(); };
      g.appendChild(card);
    }
    c.appendChild(g); this.pintaBarra();
  },
  escolhidas() { return (this.S?.ideias?.lista || []).filter(x => this.sel.has(x.id)); },
  pintaBarra() {
    const b = $('.ide-barra', this.el); if (!b) return; const E = this.escolhidas(); b.hidden = !E.length || this.aba !== 'ideias'; if (b.hidden) return;
    const sh = E.filter(x => x.formato === 'short').length, lo = E.length - sh;
    b.innerHTML = `<b>${E.length} ideia${E.length > 1 ? 's' : ''}</b><small>${sh ? `${sh} short${sh > 1 ? 's' : ''}` : ''}${sh && lo ? ' · ' : ''}${lo ? `${lo} longo${lo > 1 ? 's' : ''}` : ''}</small><span class="sp"></span>
      <button class="btn sm" data-limpa>Limpar</button><button class="btn sm" data-ref title="A IA escreve de novo só as marcadas">${ic('sparkles', 13)} Refazer as marcadas</button><button class="btn sm primary" data-seg>${ic('right', 13)} Seguir com o roteiro</button>`;
    $('[data-limpa]', b).onclick = () => { this.sel.clear(); this.pintaCorpo(); };
    $('[data-ref]', b).onclick = () => this.gerarIdeias({ refazer: E.map(x => x.id) });
    $('[data-seg]', b).onclick = () => this.novoRoteiro(E);
  },
  // o resumo da análise que vai para a IA (números de verdade)
  resumoAnalise() {
    const A = this.S?.analise; if (!A) return 'sem análise';
    const lin = (v, sh) => `- "${v.titulo || '(sem título)'}" · ${this.num(v.views)} views${v.nota ? ` · ×${v.nota} da mediana` : ''}${v.dias != null ? ` · há ${v.dias} d` : ''}${!sh && v.dur ? ` · ${v.dur}` : ''}${v.desc ? ` · descrição: ${v.desc.slice(0, 140)}` : ''}`;
    return A.canais.map(c => [`CANAL ${c.nome} (${c.h}) · ${c.inscritos} · ${c.nVideos} · mediana: ${this.num(c.mediana?.longo)} (longos) / ${this.num(c.mediana?.short)} (shorts)`, c.desc ? `Descrição: ${c.desc}` : '',
      'VÍDEOS LONGOS indo bem agora:', ...(c.longos?.bem || []).slice(0, 10).map(v => lin(v)), 'VÍDEOS LONGOS mais vistos de sempre:', ...(c.longos?.populares || []).slice(0, 12).map(v => lin(v)),
      'VÍDEOS LONGOS mais novos:', ...(c.longos?.recentes || []).slice(0, 8).map(v => lin(v)),
      'SHORTS indo bem agora:', ...(c.shorts?.bem || []).slice(0, 12).map(v => lin(v, 1)), 'SHORTS mais vistos de sempre:', ...(c.shorts?.populares || []).slice(0, 16).map(v => lin(v, 1)),
      'SHORTS mais novos:', ...(c.shorts?.recentes || []).slice(0, 12).map(v => lin(v, 1))].filter(Boolean).join('\n')).join('\n\n');
  },
  // miniaturas do que está indo bem (a IA vê o estilo das capas e das cenas)
  async miniaturas(n = 8) {
    const A = this.S?.analise; if (!A) return []; const L = [];
    for (const c of A.canais) { L.push(...(c.longos?.bem || []).slice(0, 2).map(v => ({ v, c, sh: 0 })), ...(c.shorts?.bem || []).slice(0, 2).map(v => ({ v, c, sh: 1 }))); }
    const out = [];
    await Promise.all(L.slice(0, n).map(async ({ v, c, sh }, i) => { try { const r = await fetch(`${Nuvem.srv}/yt/img?id=${v.id}&f=mqdefault`, { headers: await Nuvem.hd() }); if (!r.ok) return; const b = RefsAnim.bloco(await RefsAnim.b64(await r.blob())); if (b) out[i] = [b, { type: 'text', text: `↑ ${sh ? 'Short' : 'Vídeo'} de ${c.nome} indo bem: "${v.titulo}" (${this.num(v.views)} views, ×${v.nota})` }]; } catch { } }));
    return out.filter(Boolean).flat();
  },
  async elenco() { try { return (await Nuvem.lista()).map(x => x.nome).slice(0, 40); } catch { return []; } },
  SIS_IDEIAS: g => `Você é o roteirista-chefe e estrategista de conteúdo do canal Problems (animação 2D brasileira, Estúdio Problems).
Leia o GUIA, a ANÁLISE DE HOJE dos canais de referência (números reais) e as miniaturas. Proponha ideias de vídeos para o NOSSO canal, com o NOSSO elenco, copiando o FORMATO e o motivo de dar certo (nunca os personagens, nomes ou histórias dos outros).
Responda SÓ um JSON: {"padroes":["frase curta com um padrão que está funcionando, citando número"...4 a 7],"ideias":[{"formato":"short|longo","titulo":"título no estilo do canal","gancho":"a primeira fala ou imagem (2 s)","resumo":"2-3 frases","porque":"por que deve funcionar, citando o vídeo/padrão da análise e o número","inspirado":["id do vídeo do YouTube que inspirou"],"personagens":["nomes"],"esforco":"baixo|médio|alto","aposta":false}]}
Regras: metade shorts e metade longos (a não ser que a direção peça outra coisa); variedade de formatos (mistério/lore, conversa com o público, enquete, curiosidades, "e se…", desafio/vlog, clipe musical, episódio); 1 em cada 4 pode ser "aposta":true (algo novo); títulos em português do Brasil falado; nada de violência pesada, palavrão ou tema adulto.

GUIA:
${g}`,
  async gerarIdeias(o = {}) {
    if (!this.S?.analise) return UI.toast('Primeiro atualize a análise.', { kind: 'warn' });
    const I0 = this.S.ideias || { lista: [] }, refazer = o.refazer?.length ? I0.lista.filter(x => o.refazer.includes(x.id)) : null;
    const n = refazer ? refazer.length : o.mais || 12, elenco = await this.elenco();
    const pedido = `ANÁLISE DE HOJE (${this.quando(this.S.analise.em)}):\n${this.resumoAnalise()}\n\nNOSSOS PERSONAGENS NA NUVEM DA EQUIPE: ${elenco.join(', ') || '(nenhum ainda)'}\n\n`
      + (refazer ? `REFAÇA estas ${n} ideias (mesmo formato de cada uma, mas diferentes e melhores):\n${JSON.stringify(refazer.map(({ id, ...x }) => x))}\n\n` : '')
      + (I0.lista.length && !o.tudo ? `IDEIAS QUE JÁ EXISTEM (não repita):\n${I0.lista.map(x => `- [${x.formato}] ${x.titulo}`).join('\n')}\n\n` : '')
      + (I0.escolhidas?.length ? `O GOSTO DA EQUIPE — ideias que ela já escolheu para virar roteiro (aprenda com elas, sem repetir):\n${I0.escolhidas.slice(-20).map(x => `- [${x.formato}] ${x.titulo}`).join('\n')}\n\n` : '')
      + `${this._dir ? `DIREÇÃO DA EQUIPE: ${this._dir}\n` : ''}Escreva ${n} ideias${refazer ? ' (na mesma ordem das que vão ser trocadas)' : ''}.`;
    let j; try { const imgs = await this.miniaturas(); j = IA.json(await IA.chama(this.SIS_IDEIAS(await this.guia()), imgs.length ? [...imgs, { type: 'text', text: pedido }] : pedido, null, { titulo: 'Pensando em ideias' })); }
    catch (e) { return UI.toast('A IA não conseguiu: ' + esc(e.message), { kind: 'err' }); }
    const novas = (j.ideias || []).filter(x => x?.titulo).map(x => ({ id: uid('ide'), formato: x.formato === 'longo' ? 'longo' : 'short', titulo: String(x.titulo).slice(0, 140), gancho: String(x.gancho || '').slice(0, 240), resumo: String(x.resumo || '').slice(0, 700), porque: String(x.porque || '').slice(0, 400), inspirado: (x.inspirado || []).filter(i => /^[\w-]{11}$/.test(i)).slice(0, 4), personagens: (x.personagens || []).map(String).slice(0, 8), esforco: ['baixo', 'médio', 'alto'].includes(x.esforco) ? x.esforco : '', aposta: !!x.aposta }));
    if (!novas.length) return UI.toast('A IA não devolveu ideias. Tente de novo.', { kind: 'warn' });
    let lista;
    if (refazer) { lista = I0.lista.slice(); refazer.forEach((x, i) => { const k = lista.findIndex(y => y.id === x.id); if (k >= 0 && novas[i]) { lista[k] = novas[i]; this.sel.delete(x.id); this.sel.add(novas[i].id); } }); }
    else lista = o.tudo ? novas : [...I0.lista, ...novas];
    const I = { em: new Date().toISOString(), base: this.S.analise.em, padroes: (j.padroes || I0.padroes || []).map(String).slice(0, 8), lista, escolhidas: I0.escolhidas || [] };
    this.S.ideias = I; if (o.tudo) this.sel.clear();
    try { await this.pede('/ideias', { method: 'PUT', body: JSON.stringify({ ideias: I }) }); } catch (e) { UI.toast('As ideias ficaram só aqui (a nuvem não aceitou: ' + esc(e.message) + ')', { kind: 'warn' }); }
    this.aba = 'ideias'; if (this.el?.isConnected && !this.roteiro) this.pinta(this.el); UI.toast(`${novas.length} ideia${novas.length > 1 ? 's' : ''} nova${novas.length > 1 ? 's' : ''}.`, { kind: 'ok' });
  },

  // ---------- ROTEIROS (só neste computador) ----------
  async listaRoteiros() { try { const ks = (await DB.keys('arquivos')).filter(k => String(k).startsWith('roteiro:')); return (await Promise.all(ks.map(k => DB.get('arquivos', k)))).filter(r => r?.id).sort((a, b) => b.em - a.em); } catch { return []; } },
  async guarda(R) { R.em = Date.now(); await DB.put('arquivos', JSON.parse(JSON.stringify(R)), 'roteiro:' + R.id); },
  async pintaRoteiros() {
    const box = $('.ide-rots', this.el); if (!box) return; const L = await this.listaRoteiros(); box.hidden = false;
    box.innerHTML = `<div class="ide-sec">${ic('edit', 13)} <b>Seus roteiros</b><small>só neste computador</small><span class="sp"></span><button class="btn sm" data-pronto title="Cole ou envie um roteiro que você já tem: a IA separa em cenas e falas">${ic('paste', 13)} Usar um roteiro pronto</button></div><div class="ide-rl"></div>`;
    $('[data-pronto]', box).onclick = () => this.roteiroPronto();
    if (!L.length) $('.ide-rl', box).appendChild(h('<small class="ide-dica">Nenhum roteiro ainda: marque ideias e siga, ou use um roteiro pronto.</small>'));
    for (const R of L.slice(0, 12)) { const c = h(`<div class="ide-rc"><span class="ide-fmt">${ic(R.formato === 'short' ? 'play' : 'film', 11)} ${R.formato === 'short' ? 'Short' : 'Longo'}</span><b>${esc(R.nome)}</b><small>${esc(this.PASSOS[this.migra(R).passo - 1]?.[1] || '')} · ${new Date(R.em).toLocaleDateString('pt-BR')}</small><button class="ibtn" title="Apagar este roteiro">${ic('trash', 12)}</button></div>`);
      c.onclick = e => { if (e.target.closest('button')) return; this.abreRoteiro(R); };
      $('button', c).onclick = async () => { if (!await UI.confirm({ title: `Apagar o roteiro "${R.nome}"?`, msg: 'As vozes gravadas dele também saem deste computador. A animação gerada continua.', ok: 'Apagar', danger: true })) return; await DB.del('arquivos', 'roteiro:' + R.id); this.pintaRoteiros(); };
      $('.ide-rl', box).appendChild(c); }
  },
  async novoRoteiro(E) {
    let formato = E[0].formato; if (E.some(x => x.formato !== formato)) { formato = await UI.modal({ title: 'Short ou vídeo longo?', icon: 'film', body: 'As ideias marcadas misturam shorts e vídeos longos. O roteiro vai ser de qual?', buttons: [{ label: 'Cancelar', value: null }, { label: 'Vídeo longo', value: 'longo' }, { label: 'Short', kind: 'primary', value: 'short' }] }); if (!formato) return; }
    // o que a equipe escolhe vira exemplo do gosto dela nas próximas ideias
    const I = this.S?.ideias; if (I) { I.escolhidas = [...(I.escolhidas || []), ...E.map(x => ({ titulo: x.titulo, formato: x.formato, em: Date.now() }))].slice(-30); this.pede('/ideias', { method: 'PUT', body: JSON.stringify({ ideias: I }) }).catch(() => { }); }
    const R = { id: uid('rt'), nome: E.length === 1 ? E[0].titulo : E.map(x => x.titulo).join(' + ').slice(0, 80), criado: Date.now(), formato, ideias: clone(E), padroes: (this.S?.ideias?.padroes || []).slice(0, 8), pers: [], defs: {}, situacoes: [], roteiro: null, vozes: {}, cenarios: {}, passo: 2, pv: 2, opcoes: { cenarios: true, boca: true, legendas: true, animar: true, refs: [...new Set(E.flatMap(x => x.inspirado || []))].slice(0, 2) } };
    await this.guarda(R); this.abreRoteiro(R);
  },
  abreRoteiro(R) { this.roteiro = R; this.pinta(this.el); },
  PASSOS: [['ideias', 'Ideias'], ['pers', 'Personagens'], ['sit', 'Situações'], ['rot', 'Roteiro'], ['cen', 'Cenários'], ['voz', 'Vozes'], ['gerar', 'Gerar o vídeo']],
  // roteiros de antes do passo Cenários (pv 2, 26/10/2026): Vozes e Gerar andaram uma casa
  migra(R) { if (R && R.pv !== 2) { if (R.passo >= 5) R.passo++; R.pv = 2; } return R; },
  pintaRoteiro() {
    const R = this.migra(this.roteiro), c = this.el; R.passo ||= 2;
    c.innerHTML = `<div class="ide ide-r"><div class="ide-rtopo"><button class="btn sm" data-volta>${ic('left', 13)} Ideias</button><input class="ide-rnome" value="${esc(R.nome)}" title="Nome do roteiro"><span class="ide-fmt">${ic(R.formato === 'short' ? 'play' : 'film', 11)} ${R.formato === 'short' ? 'Short (9:16)' : 'Vídeo longo (16:9)'}</span></div>
      <div class="ide-passos">${this.PASSOS.map(([id, nm], i) => `<button data-p="${i + 1}" class="${R.passo === i + 1 ? 'on' : ''} ${this.feito(R, i + 1) ? 'ok' : ''} ${i && (this.feito(R, i) || R.passo === i) && (this.feito(R, i + 1) || R.passo === i + 1) ? 'liga' : ''}"><i>${this.feito(R, i + 1) && R.passo !== i + 1 ? ic('check', 13) : i + 1}</i><span>${nm}</span></button>`).join('')}</div><div class="ide-pc"></div></div>`;
    $('[data-volta]', c).onclick = () => { this.roteiro = null; this.pinta(c); };
    const nm = $('.ide-rnome', c); nm.onchange = () => { R.nome = nm.value.trim() || R.nome; this.guarda(R); };
    $$('[data-p]', c).forEach(b => b.onclick = () => { R.passo = +b.dataset.p; this.guarda(R); this.pintaRoteiro(); });
    const pc = $('.ide-pc', c);
    [null, this.passoIdeias, this.passoPers, this.passoSit, this.passoRot, this.passoCen, this.passoVoz, this.passoGerar][R.passo].call(this, pc, R);
  },
  feito(R, p) { return p === 1 ? R.ideias.length > 0 : p === 2 ? R.pers.length > 0 : p === 3 ? R.situacoes.some(s => s.usar) : p === 4 ? !!R.roteiro?.cenas?.length : p === 5 ? this.lugares(R).length > 0 && this.lugares(R).every(L => R.cenarios?.[L.key]) : p === 6 ? this.falas(R).length > 0 && this.falas(R).every(f => R.vozes[f.id]) : p === 7 ? !!R.gerado : false; },
  vai(R, p) { R.passo = p; this.guarda(R); this.pintaRoteiro(); window.scrollTo?.({ top: 0 }); },
  rodape(pc, R, prox, rotulo, ok = true) { const f = h(`<div class="ide-rod"><span class="sp"></span><button class="btn primary" ${ok ? '' : 'disabled'}>${esc(rotulo)} ${ic('right', 13)}</button></div>`); $('button', f).onclick = () => this.vai(R, prox); pc.appendChild(f); },
  passoIdeias(pc, R) {
    pc.appendChild(h(`<div class="ide-dica">Estas são as ideias deste roteiro. Para trocar, volte para a aba Ideias e marque outras.</div>`));
    for (const x of R.ideias) pc.appendChild(h(`<div class="ide-ideia on ${x.formato}"><div class="ide-ib"><b>${esc(x.titulo)}</b>${x.gancho ? `<p class="ide-gancho">“${esc(x.gancho)}”</p>` : ''}<p>${esc(x.resumo || '')}</p>${x.porque ? `<p class="ide-pq">${ic('star', 11)} ${esc(x.porque)}</p>` : ''}</div></div>`));
    this.rodape(pc, R, 2, 'Escolher os personagens');
  },

  // ---------- PERSONAGENS ----------
  PERS_K: 'animador-ideias-pers', // jeito/cor que a pessoa escreveu para cada personagem (para reaproveitar)
  memo() { try { return JSON.parse(localStorage.getItem(this.PERS_K) || '{}'); } catch { return {}; } },
  poeMemo(id, v) { const m = this.memo(); m[id] = { ...(m[id] || {}), ...v }; try { localStorage.setItem(this.PERS_K, JSON.stringify(m)); } catch { } },
  passoPers(pc, R) {
    pc.appendChild(h(`<div class="ide-dica">Quem entra neste ${R.formato === 'short' ? 'short' : 'vídeo'}: personagens da nuvem da equipe, deste computador ou uma imagem (PNG/SVG). Dê o nome que vai no roteiro, a cor (legendas e destaque) e o jeito de cada um — a IA usa isso para escrever as falas. Num personagem da nuvem, a cor e o jeito ficam salvos nele para a próxima vez.</div>`));
    const falta = R.roteiro ? [...new Set(this.falas(R).map(f => f.personagem).filter(n => n && !this.persDe(R, n)))] : [];
    if (falta.length) pc.appendChild(h(`<div class="ide-aviso ide-av-b">${ic('alert', 13)} Papéis do roteiro sem personagem: <b>${falta.map(esc).join(', ')}</b>. Escolha os personagens e dê a eles esses nomes.</div>`));
    const L = h('<div class="ide-pl"></div>'); pc.appendChild(L);
    for (const p of R.pers) {
      const c = h(`<div class="ide-p" style="--pc:${esc(p.cor)}"><span class="ide-pth">${p.thumb ? `<img src="${esc(p.thumb)}" alt="">` : ic('users', 18)}</span>
        <div class="ide-pf"><div class="ide-pl1"><input class="ide-pn" value="${esc(p.nome)}" title="Nome no roteiro"><label class="ide-pcor" title="Cor do personagem"><input type="color" value="${esc(p.cor)}"></label><span class="ide-or">${p.origem === 'nuvem' ? ic('cloud', 11) + ' nuvem' : p.origem === 'local' ? ic('save', 11) + ' este computador' : ic('image', 11) + ' imagem'}</span><button class="ibtn" data-x title="Tirar do roteiro">${ic('x', 12)}</button></div>
        <textarea rows="2" placeholder="Jeito do personagem: personalidade, como fala, o que quer, bordão…">${esc(p.desc || '')}</textarea></div></div>`);
      const nm = $('.ide-pn', c), cor = $('input[type=color]', c), ds = $('textarea', c);
      nm.onchange = () => { p.nome = nm.value.trim() || p.nome; this.guarda(R); };
      cor.oninput = () => c.style.setProperty('--pc', cor.value); cor.onchange = () => { p.cor = cor.value; this.guarda(R); this.salvaNoPersonagem(p); };
      ds.onchange = () => { p.desc = ds.value.trim(); this.guarda(R); this.salvaNoPersonagem(p); };
      $('[data-x]', c).onclick = () => { R.pers = R.pers.filter(x => x !== p); delete R.defs[p.id]; this.guarda(R); this.pintaRoteiro(); };
      L.appendChild(c);
    }
    const add = h(`<div class="ide-padd"><button class="btn" data-n>${ic('users', 14)} Escolher personagens</button><button class="btn" data-i>${ic('image', 14)} Personagem de uma imagem (PNG/SVG)</button></div>`);
    $('[data-n]', add).onclick = () => this.escolhePers(R); $('[data-i]', add).onclick = () => this.persDeImagem(R);
    pc.appendChild(add);
    if (R.pronto && R.roteiro) this.rodape(pc, R, 5, 'Escolher os cenários', R.pers.length > 0); else this.rodape(pc, R, 3, 'Gerar situações', R.pers.length > 0);
  },
  async escolhePers(R) {
    const body = h('<div class="ide-esc"><div class="vazio"><span class="spin-dot"></span> Carregando os personagens…</div></div>'), marc = new Map(R.pers.filter(p => p.origem !== 'img').map(p => [p.id, p]));
    const p = UI.modal({ title: 'Quem entra no roteiro?', icon: 'users', width: 720, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Usar os marcados', kind: 'primary', value: true }] });
    try {
      const [nuvem, locais] = await Promise.all([Nuvem.lista().catch(() => []), Atelie.rascunhos().then(rs => rs.filter(r => !r.nuvem))]); body.innerHTML = '';
      const grade = (titulo, itens) => { if (!itens.length) return; body.appendChild(h(`<div class="ide-sec">${titulo}</div>`)); const g = h('<div class="ide-eg"></div>');
        for (const it of itens) { const c = h(`<div class="ide-ec ${marc.has(it.id) ? 'on' : ''}"><span class="ide-eth" style="${it.thumb ? `background-image:url('${it.thumb}')` : ''}"></span><b>${esc(it.nome)}</b><i>${ic('check', 12)}</i></div>`);
          c.onclick = () => { if (marc.has(it.id)) marc.delete(it.id); else marc.set(it.id, it); c.classList.toggle('on', marc.has(it.id)); }; g.appendChild(c); }
        body.appendChild(g); };
      grade(`${ic('cloud', 13)} Na nuvem da equipe`, nuvem.map(x => ({ id: x.id, nome: x.nome, thumb: x.thumb, origem: 'nuvem' })));
      grade(`${ic('save', 13)} Só neste computador`, locais.map(r => ({ id: r.def.id, nome: r.def.nome, thumb: r.thumb, origem: 'local', def: r.def })));
      if (!nuvem.length && !locais.length) body.innerHTML = '<div class="vazio">Nenhum personagem ainda. Use "Personagem de uma imagem" ou crie no Ateliê.</div>';
    } catch (e) { body.innerHTML = `<div class="vazio">Não consegui ler os personagens: ${esc(e.message)}</div>`; }
    if (!await p) return;
    const ja = new Map(R.pers.map(x => [x.id, x])), memo = this.memo(), novos = [];
    for (const [id, it] of marc) { if (ja.has(id)) { novos.push(ja.get(id)); continue; }
      let def = it.def || null; if (it.origem === 'nuvem') { try { def = await Nuvem.abrir(id); } catch { } }
      const m = memo[id] || {}; novos.push({ id, origem: it.origem, nome: m.nome || def?.nome || it.nome, cor: m.cor || (def?.corModo === 'propria' && def.cor) || def?.cor || this.corPadrao(novos.length + R.pers.length), desc: m.desc || def?.personalidade || '', thumb: def?.icone || it.thumb || null }); }
    R.pers = [...novos, ...R.pers.filter(x => x.origem === 'img')]; await this.guarda(R); this.pintaRoteiro();
  },
  corPadrao(i) { return ['#5ee0ff', '#ffd84a', '#8fe0b4', '#ff9bd2', '#ffb86b', '#b9a2ff', '#ff7a7a', '#9fb7ff'][i % 8]; },
  // um personagem que é uma imagem só (PNG/SVG): vira um personagem de uma parte, só deste roteiro/animação
  async persDeImagem(R) {
    const fs = await pickFiles('image/png,image/webp,image/jpeg,image/gif,image/svg+xml,.svg', true); if (!fs?.length) return;
    for (const f0 of fs) {
      const nome = f0.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 40) || 'Personagem', def = Modelo.novoPersonagem(nome); def.id = 'img-' + uid('').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14); Modelo.garanteVistas?.(def);
      const { blob, svg } = await Vetor.blobDeArquivo(f0), k = `personagens/${def.id}/img/${uid('im').toLowerCase().replace(/[^a-z0-9]/g, '')}.${svg ? 'svg' : (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`;
      await Arq.guardar(blob, k); const bm = await Arq.deBlob(blob, k).catch(() => null); if (bm) Arq.img.set(k, bm);
      const w = bm?.width || 512, hh = bm?.height || 512, pt = Modelo.novaParte('Corpo', null), img = { id: uid('i'), nome, k, w, h: hh, pivo: { x: w / 2, y: hh }, ajuste: { x: 0, y: 0 } };
      pt.imgs.push(img); pt.base.img = img.id; def.partes.push(pt); def.raiz = pt.id; def._local = { todo: true };
      let thumb = null; if (bm) { const c = document.createElement('canvas'), s = 96 / Math.max(w, hh); c.width = c.height = 96; c.getContext('2d').drawImage(bm, (96 - w * s) / 2, (96 - hh * s) / 2, w * s, hh * s); thumb = c.toDataURL('image/png'); def.thumb = thumb; }
      R.defs[def.id] = def; R.pers.push({ id: def.id, origem: 'img', nome, cor: this.corPadrao(R.pers.length), desc: '', thumb });
    }
    await this.guarda(R); this.pintaRoteiro();
  },
  // cor e jeito de um personagem da NUVEM ficam salvos nele (uma gravação, um pouco depois da última mudança)
  salvaNoPersonagem(p) {
    this.poeMemo(p.id, { cor: p.cor, desc: p.desc }); if (p.origem !== 'nuvem') return;
    clearTimeout(this._tSalva?.[p.id]); (this._tSalva ||= {})[p.id] = setTimeout(async () => {
      try { const def = await Nuvem.abrir(p.id, false, null, true); if (def.cor === p.cor && def.corModo === 'propria' && (def.personalidade || '') === (p.desc || '')) return;
        def.cor = p.cor; def.corModo = 'propria'; if (p.desc) def.personalidade = p.desc; else delete def.personalidade; await Nuvem.salvar(def, null, { limpar: false }); UI.toast(`Cor e jeito salvos em <b>${esc(def.nome)}</b> na nuvem.`, { kind: 'ok' }); }
      catch (e) { UI.toast('Não deu para salvar no personagem da nuvem (ficou neste computador): ' + esc(e.message), { kind: 'warn' }); }
    }, 1500);
  },
  persTexto(R) { return R.pers.map(p => `- ${p.nome}${p.desc ? `: ${p.desc}` : ''}`).join('\n'); },
  ideiasTexto(R) { return R.ideias.map(x => `- [${x.formato}] ${x.titulo}\n  gancho: ${x.gancho}\n  ${x.resumo}\n  por que funciona: ${x.porque}`).join('\n') + (R.padroes?.length ? `\n\nO QUE ESTÁ DANDO CERTO NOS CANAIS AGORA:\n${R.padroes.map(x => '- ' + x).join('\n')}` : ''); },

  // ---------- SITUAÇÕES ----------
  SIS_SIT: g => `Você é o roteirista do canal Problems (animação 2D brasileira por encaixe). A partir das IDEIAS escolhidas e dos PERSONAGENS (com o jeito de cada um), invente SITUAÇÕES: premissas concretas, diferentes entre si, que dão um ótimo vídeo no formato pedido.
Responda SÓ um JSON: {"situacoes":[{"titulo":"curto","resumo":"2 frases: quem, onde, o que quer, o conflito","batidas":["4 a 7 batidas curtas, do gancho ao final com virada"],"lugares":["cenário de cada parte (1 num short)"],"personagens":["nomes que aparecem"],"final":"como termina / gancho"}]}
Use só os personagens dados. Respeite o jeito de cada um.

GUIA:
${g}`,
  passoSit(pc, R) {
    const top = h(`<div class="ide-ger"><span class="ide-gic">${ic('sparkles', 18)}</span><div class="ide-gin"><b>Situações com a IA</b><small>Cada vez sai diferente: gere até gostar de uma.</small><textarea rows="2" placeholder="Quer algo específico? Ex.: mais engraçado, termina com mistério, na escola… (opcional)">${esc(R.dirSit || '')}</textarea></div><div class="ide-gbts"><button class="btn sm ia" data-g>${ic('sparkles', 13)} ${R.situacoes.length ? 'Gerar todas de novo' : 'Gerar situações'}</button>${R.situacoes.length ? `<button class="btn sm" data-mais>${ic('plus', 13)} Mais 3</button><button class="btn sm" data-ref>${ic('sparkles', 13)} Refazer as marcadas</button>` : ''}</div></div>`);
    const dir = $('textarea', top); dir.onchange = () => { R.dirSit = dir.value; this.guarda(R); };
    $('[data-g]', top).onclick = () => this.gerarSit(R, { tudo: true }); if ($('[data-mais]', top)) { $('[data-mais]', top).onclick = () => this.gerarSit(R, { mais: 3 }); $('[data-ref]', top).onclick = () => { const L = R.situacoes.filter(s => s.marca); if (!L.length) return UI.toast('Marque as situações que quer refazer (o quadradinho).', { kind: 'warn' }); this.gerarSit(R, { refazer: L.map(s => s.id) }); }; }
    pc.appendChild(top);
    pc.appendChild(h(`<div class="ide-dica">Gere de novo quantas vezes quiser. Marque o quadradinho para refazer só aquelas e clique em <b>Usar esta</b> na que vai virar o roteiro (pode usar mais de uma para juntar).</div>`));
    if (!R.situacoes.length) pc.appendChild(h('<div class="vazio">Nenhuma situação ainda.</div>'));
    for (const s of R.situacoes) {
      const c = h(`<div class="ide-sit ${s.usar ? 'usar' : ''}"><label class="ide-ck" title="Marcar para refazer"><input type="checkbox" ${s.marca ? 'checked' : ''}></label><div class="ide-ib"><b>${esc(s.titulo)}</b><p>${esc(s.resumo)}</p>
        <ol>${(s.batidas || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="ide-ps">${ic('image', 11)} ${esc((s.lugares || []).join(' · '))}${s.personagens?.length ? ` · ${ic('users', 11)} ${esc(s.personagens.join(', '))}` : ''}</p>${s.final ? `<p class="ide-pq">${ic('star', 11)} ${esc(s.final)}</p>` : ''}</div>
        <button class="btn sm ${s.usar ? 'primary' : ''}" data-u>${s.usar ? ic('check', 13) + ' Usando' : 'Usar esta'}</button></div>`);
      $('input', c).onchange = e => { s.marca = e.target.checked; this.guarda(R); };
      $('[data-u]', c).onclick = () => { s.usar = !s.usar; this.guarda(R); this.pintaRoteiro(); };
      pc.appendChild(c);
    }
    this.rodape(pc, R, 4, 'Escrever o roteiro', R.situacoes.some(s => s.usar));
  },
  async gerarSit(R, o = {}) {
    const ref = o.refazer ? R.situacoes.filter(s => o.refazer.includes(s.id)) : null, n = ref ? ref.length : o.mais || 4;
    const pedido = `FORMATO: ${R.formato === 'short' ? 'SHORT vertical (25–55 s)' : 'VÍDEO LONGO horizontal (4–12 min)'}\n\nIDEIAS ESCOLHIDAS:\n${this.ideiasTexto(R)}\n\nPERSONAGENS:\n${this.persTexto(R)}\n\n`
      + (ref ? `REFAÇA estas situações (diferentes e melhores):\n${JSON.stringify(ref.map(({ id, usar, marca, ...x }) => x))}\n\n` : R.situacoes.length && !o.tudo ? `JÁ EXISTEM (não repita):\n${R.situacoes.map(s => '- ' + s.titulo).join('\n')}\n\n` : '')
      + `${R.dirSit ? `DIREÇÃO: ${R.dirSit}\n` : ''}Escreva ${n} situações.`;
    let j; try { j = IA.json(await IA.chama(this.SIS_SIT(await this.guia()), pedido, null, { titulo: 'Inventando situações' })); } catch (e) { return UI.toast('A IA não conseguiu: ' + esc(e.message), { kind: 'err' }); }
    const novas = (j.situacoes || []).filter(x => x?.titulo).map(x => ({ id: uid('st'), titulo: String(x.titulo).slice(0, 120), resumo: String(x.resumo || '').slice(0, 600), batidas: (x.batidas || []).map(String).slice(0, 10), lugares: (x.lugares || []).map(String).slice(0, 8), personagens: (x.personagens || []).map(String).slice(0, 8), final: String(x.final || '').slice(0, 300) }));
    if (ref) ref.forEach((s, i) => { const k = R.situacoes.indexOf(s); if (k >= 0 && novas[i]) R.situacoes[k] = novas[i]; });
    else R.situacoes = o.tudo ? novas : [...R.situacoes, ...novas];
    await this.guarda(R); this.pintaRoteiro();
  },

  // ---------- ROTEIRO ----------
  falas(R) { return (R.roteiro?.cenas || []).flatMap(c => c.falas.map(f => ({ ...f, cena: c }))); },
  persDe(R, nome) { const n = String(nome || '').trim().toLowerCase(); return R.pers.find(p => p.nome.toLowerCase() === n) || R.pers.find(p => n && (p.nome.toLowerCase().includes(n) || n.includes(p.nome.toLowerCase()))) || null; },
  SIS_ROT: g => `Você é o roteirista do canal Problems (animação 2D brasileira por encaixe, vozes gravadas pela equipe depois).
Escreva o ROTEIRO completo a partir das SITUAÇÕES escolhidas, das IDEIAS e dos PERSONAGENS (com o jeito de cada um).
Responda SÓ um JSON: {"titulo":"título do vídeo no estilo do canal","descricao":"descrição curta para o YouTube","thumb":"ideia da miniatura","cenas":[{"lugar":"nome curto do lugar","visual":"descrição do cenário para desenhar (sem personagens)","personagens":["quem está na cena"],"falas":[{"personagem":"nome exato","texto":"fala natural","emocao":"neutro|feliz|bravo|triste|assustado|surpreso|sarcástico|apaixonado|pensativo|envergonhado","acao":"ação curta (ou vazio)","camera":"geral|médio|close|zoom rápido|tremor|seguindo"}]}]}
Regras: gancho na primeira fala; falas curtas (até ~20 palavras) e alternadas; respeite o tamanho do formato; use só os personagens dados, com o nome exato; termine com virada/gancho.

GUIA:
${g}`,
  passoRot(pc, R) {
    const top = h(`<div class="ide-ger"><span class="ide-gic">${ic('sparkles', 18)}</span><div class="ide-gin"><b>Roteiro com a IA</b><small>Escreve as cenas e as falas a partir da situação escolhida.</small><textarea rows="2" placeholder="Quer algo específico? Ex.: mais rápido, mais piadas, final de mistério… (opcional)">${esc(R.dirRot || '')}</textarea></div><div class="ide-gbts"><button class="btn sm ia" data-g>${ic('sparkles', 13)} ${R.roteiro ? 'Escrever tudo de novo' : 'Escrever o roteiro'}</button>${R.roteiro ? `<button class="btn sm" data-ref title="A IA reescreve só as falas marcadas (pode virar mais de uma fala)">${ic('sparkles', 13)} Refazer as marcadas</button>` : ''}</div></div>`);
    const dir = $('textarea', top); dir.onchange = () => { R.dirRot = dir.value; this.guarda(R); };
    $('[data-g]', top).onclick = async () => { if (R.roteiro && !await UI.confirm({ title: 'Escrever o roteiro todo de novo?', msg: 'As mudanças feitas à mão e as vozes já gravadas deixam de bater com as falas.', ok: 'Escrever de novo' })) return; this.gerarRot(R); };
    if ($('[data-ref]', top)) $('[data-ref]', top).onclick = () => { const ids = this.falas(R).filter(f => f.marca).map(f => f.id); if (!ids.length) return UI.toast('Marque as falas que quer refazer (o quadradinho de cada uma).', { kind: 'warn' }); this.gerarRot(R, { refazer: ids }); };
    const pr = h(`<button class="btn sm" data-colar title="Cole ou envie um roteiro que você já tem: a IA separa em cenas e falas">${ic('paste', 13)} Colar / enviar um roteiro</button>`); pr.onclick = () => this.colarRoteiro(R); $('.ide-gbts', top).appendChild(pr);
    pc.appendChild(top);
    if (!R.roteiro) { pc.appendChild(h('<div class="vazio">Aperte <b>Escrever o roteiro</b>: a IA usa as situações marcadas com "Usar esta".</div>')); return; }
    const T = R.roteiro, cab = h(`<div class="ide-rcab"><label>Título<input value="${esc(T.titulo || '')}" data-k="titulo"></label><label>Descrição<textarea rows="2" data-k="descricao">${esc(T.descricao || '')}</textarea></label>${T.thumb ? `<p class="ide-ps">${ic('image', 11)} Miniatura: ${esc(T.thumb)}</p>` : ''}</div>`);
    $$('[data-k]', cab).forEach(i => i.onchange = () => { T[i.dataset.k] = i.value; this.guarda(R); }); pc.appendChild(cab);
    const tot = this.falas(R).reduce((s, f) => s + this.durFala(R, f), 0); pc.appendChild(h(`<div class="ide-dica">${this.falas(R).length} falas · ${T.cenas.length} cena${T.cenas.length > 1 ? 's' : ''} · cerca de <b>${Exportar.tc(tot)}</b>. Clique no texto para mudar; o quadradinho marca para refazer com a IA.</div>`));
    const opP = () => R.pers.map(p => `<option value="${esc(p.nome)}">${esc(p.nome)}</option>`).join('');
    T.cenas.forEach((ce, ci) => {
      const box = h(`<div class="ide-cena"><div class="ide-ccab"><b>Cena ${ci + 1}</b><input value="${esc(ce.lugar || '')}" placeholder="Lugar" data-c="lugar"><span class="sp"></span><button class="ibtn" data-cx title="Tirar a cena">${ic('trash', 12)}</button></div>
        <textarea rows="1" class="ide-cvis" data-c="visual" placeholder="Como é o cenário (para desenhar)">${esc(ce.visual || '')}</textarea><div class="ide-fl"></div><button class="btn sm" data-fn>${ic('plus', 12)} Fala</button></div>`);
      $$('[data-c]', box).forEach(i => i.onchange = () => { ce[i.dataset.c] = i.value; this.guarda(R); });
      $('[data-cx]', box).onclick = async () => { if (!await UI.confirm({ title: `Tirar a cena ${ci + 1}?`, ok: 'Tirar', danger: true })) return; T.cenas.splice(ci, 1); this.guarda(R); this.pintaRoteiro(); };
      $('[data-fn]', box).onclick = () => { ce.falas.push({ id: uid('f'), personagem: R.pers[0]?.nome || '', texto: '', emocao: 'neutro', acao: '', camera: 'médio' }); this.guarda(R); this.pintaRoteiro(); };
      const fl = $('.ide-fl', box);
      ce.falas.forEach((f, fi) => {
        const p = this.persDe(R, f.personagem), r = h(`<div class="ide-f" style="--pc:${esc(p?.cor || '#888')}"><label class="ide-ck"><input type="checkbox" ${f.marca ? 'checked' : ''}></label>
          <select data-p>${opP()}</select><textarea rows="1" data-t>${esc(f.texto)}</textarea>
          <select data-e title="Emoção">${this.EMOCOES.map(e => `<option ${e === f.emocao ? 'selected' : ''}>${e}</option>`).join('')}</select>
          <input data-a value="${esc(f.acao || '')}" placeholder="ação" title="O que o personagem faz"><select data-cam title="Câmera">${this.CAMERAS.map(e => `<option ${e === f.camera ? 'selected' : ''}>${e}</option>`).join('')}</select>
          <span class="ide-fb"><button class="ibtn" data-up title="Subir">${ic('up', 11)}</button><button class="ibtn" data-x title="Tirar">${ic('x', 11)}</button></span></div>`);
        $('[data-p]', r).value = p?.nome || ''; const ta = $('[data-t]', r), aj = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; }; setTimeout(aj); ta.oninput = aj;
        $('[data-p]', r).onchange = e => { f.personagem = e.target.value; this.guarda(R); r.style.setProperty('--pc', this.persDe(R, f.personagem)?.cor || '#888'); };
        ta.onchange = () => { if (f.texto !== ta.value) { f.texto = ta.value; this.guarda(R); } };
        $('[data-e]', r).onchange = e => { f.emocao = e.target.value; this.guarda(R); }; $('[data-a]', r).onchange = e => { f.acao = e.target.value; this.guarda(R); }; $('[data-cam]', r).onchange = e => { f.camera = e.target.value; this.guarda(R); };
        $('input[type=checkbox]', r).onchange = e => { f.marca = e.target.checked; this.guarda(R); };
        $('[data-up]', r).onclick = () => { if (fi > 0) { [ce.falas[fi - 1], ce.falas[fi]] = [ce.falas[fi], ce.falas[fi - 1]]; this.guarda(R); this.pintaRoteiro(); } };
        $('[data-x]', r).onclick = () => { ce.falas.splice(fi, 1); delete R.vozes[f.id]; this.guarda(R); this.pintaRoteiro(); };
        fl.appendChild(r);
      });
      pc.appendChild(box);
    });
    const nc = h(`<button class="btn sm">${ic('plus', 12)} Cena</button>`); nc.onclick = () => { T.cenas.push({ id: uid('c'), lugar: 'Lugar novo', visual: '', personagens: [], falas: [] }); this.guarda(R); this.pintaRoteiro(); }; pc.appendChild(nc);
    this.rodape(pc, R, 5, 'Escolher os cenários', this.falas(R).length > 0);
  },
  normRot(j, R) { return { titulo: String(j.titulo || R.nome).slice(0, 140), descricao: String(j.descricao || '').slice(0, 1200), thumb: String(j.thumb || '').slice(0, 300), cenas: (j.cenas || []).map(c => ({ id: uid('c'), lugar: String(c.lugar || '').slice(0, 80), visual: String(c.visual || '').slice(0, 400), personagens: (c.personagens || []).map(String), falas: (c.falas || []).filter(f => f?.texto).map(f => this.normFala(f, R)) })).filter(c => c.falas.length) }; },
  normFala(f, R) { return { id: uid('f'), personagem: this.persDe(R, f.personagem)?.nome || String(f.personagem || '').trim().slice(0, 40) || R.pers[0]?.nome || '', texto: String(f.texto).slice(0, 400), emocao: this.EMOCOES.includes(f.emocao) ? f.emocao : 'neutro', acao: String(f.acao || '').slice(0, 120), camera: this.CAMERAS.includes(f.camera) ? f.camera : 'médio' }; },
  async gerarRot(R, o = {}) {
    const sits = R.situacoes.filter(s => s.usar), base = `FORMATO: ${R.formato === 'short' ? 'SHORT vertical (25–55 s, 8–18 falas, um lugar)' : 'VÍDEO LONGO horizontal (4–12 min, 3–6 cenas)'}\n\nIDEIAS:\n${this.ideiasTexto(R)}\n\nPERSONAGENS:\n${this.persTexto(R)}\n\nSITUAÇÕES ESCOLHIDAS:\n${sits.map(s => `- ${s.titulo}: ${s.resumo}\n  batidas: ${(s.batidas || []).join(' / ')}\n  lugares: ${(s.lugares || []).join(', ')}\n  final: ${s.final}`).join('\n')}\n\n${R.dirRot ? `DIREÇÃO: ${R.dirRot}\n\n` : ''}`;
    if (o.refazer) {
      const pedido = base + `ROTEIRO ATUAL (JSON; cada fala tem id):\n${JSON.stringify(R.roteiro.cenas.map(c => ({ lugar: c.lugar, falas: c.falas.map(f => ({ id: f.id, personagem: f.personagem, texto: f.texto, emocao: f.emocao, acao: f.acao, camera: f.camera })) })))}\n\nREESCREVA SÓ as falas com estes ids: ${o.refazer.join(', ')} (melhores, combinando com o que vem antes e depois). Cada uma pode virar 1 a 3 falas.\nResponda SÓ um JSON: {"trocas":[{"id":"id da fala","falas":[{"personagem":"","texto":"","emocao":"","acao":"","camera":""}]}]}`;
      let j; try { j = IA.json(await IA.chama(this.SIS_ROT(await this.guia()), pedido, null, { titulo: 'Reescrevendo as falas' })); } catch (e) { return UI.toast('A IA não conseguiu: ' + esc(e.message), { kind: 'err' }); }
      let n = 0; for (const t of j.trocas || []) for (const c of R.roteiro.cenas) { const i = c.falas.findIndex(f => f.id === t.id); if (i < 0) continue; const novas = (t.falas || []).filter(f => f?.texto).map(f => this.normFala(f, R)); if (!novas.length) continue; delete R.vozes[t.id]; c.falas.splice(i, 1, ...novas); n++; }
      UI.toast(`${n} fala${n === 1 ? '' : 's'} reescrita${n === 1 ? '' : 's'}.`, { kind: n ? 'ok' : 'warn' });
    } else {
      let j; try { j = IA.json(await IA.chama(this.SIS_ROT(await this.guia()), base + 'Escreva o roteiro completo.', null, { titulo: 'Escrevendo o roteiro' })); } catch (e) { return UI.toast('A IA não conseguiu: ' + esc(e.message), { kind: 'err' }); }
      const T = this.normRot(j, R); if (!T.cenas.length) return UI.toast('A IA não devolveu falas. Tente de novo.', { kind: 'warn' });
      R.roteiro = T; R.vozes = {}; if (T.titulo) R.nome = T.titulo;
    }
    await this.guarda(R); this.pintaRoteiro();
  },
  // ROTEIRO PRONTO: começa um roteiro sem ideias, já pedindo o texto
  async roteiroPronto() {
    const formato = await UI.modal({ title: 'Usar um roteiro pronto', icon: 'paste', body: 'Ele vai virar um short ou um vídeo longo?', buttons: [{ label: 'Cancelar', value: null }, { label: 'Vídeo longo', value: 'longo' }, { label: 'Short', kind: 'primary', value: 'short' }] }); if (!formato) return;
    const R = { id: uid('rt'), nome: 'Roteiro pronto', criado: Date.now(), formato, ideias: [], padroes: (this.S?.ideias?.padroes || []).slice(0, 8), pers: [], defs: {}, situacoes: [], roteiro: null, vozes: {}, cenarios: {}, passo: 4, pv: 2, opcoes: { cenarios: true, boca: true, legendas: true, animar: true, refs: [] } };
    if (!await this.colarRoteiro(R, true)) return; R.passo = 2; await this.guarda(R); this.abreRoteiro(R);
    UI.toast('Roteiro organizado! Agora escolha quem faz cada papel (os nomes do texto viraram os nomes do roteiro).', { kind: 'ok', time: 7000 });
  },
  SIS_ORG: `Você organiza roteiros do canal Problems (animação 2D brasileira) que a equipe já escreveu.
Recebe um texto solto (pode ter "NOME: fala", cenas, rubricas entre parênteses, listas, legendas de vídeo) e devolve SÓ um JSON:
{"titulo":"","descricao":"","thumb":"","cenas":[{"lugar":"","visual":"cenário sem personagens","personagens":["nomes"],"falas":[{"personagem":"nome","texto":"fala","emocao":"neutro|feliz|bravo|triste|assustado|surpreso|sarcástico|apaixonado|pensativo|envergonhado","acao":"","camera":"geral|médio|close|zoom rápido|tremor|seguindo"}]}]}
Regras: cada fala é uma linha de diálogo; rubricas/descrições viram "acao", "visual" ou "lugar" (não viram fala); troca de lugar ou de tempo = cena nova; o nome do personagem é o que está no texto (se bater com um personagem da lista, use o nome da lista); deduza emoção e câmera pelo contexto; narrador conta como personagem "Narrador".`,
  async colarRoteiro(R, novo) {
    const body = h(`<div class="ide-colar"><p class="ide-dica">Cole o roteiro do jeito que ele estiver (ex.: <b>LUMI: Alguém viu meu chapéu?!</b>), ou abra um arquivo. A IA separa em cenas e falas, com o personagem, a emoção, a ação e a câmera de cada uma.</p>
      <textarea rows="14" placeholder="Cole o roteiro aqui…"></textarea><div class="ide-colar-b"><button class="btn sm" data-arq>${ic('upload', 13)} Abrir arquivo (.txt, .md, .srt, .json)</button><span class="sp"></span>
      <label class="chk"><input type="checkbox" data-igual checked> Manter as falas exatamente como estão</label></div></div>`), ta = $('textarea', body);
    $('[data-arq]', body).onclick = async () => { const [f] = await pickFiles('.txt,.md,.srt,.vtt,.json,.fountain,text/*', false); if (f) ta.value = await f.text(); };
    const ok = await UI.modal({ title: novo ? 'Usar um roteiro pronto' : 'Colar ou enviar um roteiro', icon: 'paste', width: 720, body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Organizar com a IA', kind: 'primary', value: true }] });
    const txt = ta.value.trim(); if (!ok || !txt) return false;
    if (R.roteiro && !novo && !await UI.confirm({ title: 'Trocar o roteiro de agora?', msg: 'O roteiro atual sai e as vozes já gravadas deixam de bater com as falas.', ok: 'Trocar' })) return false;
    const pedido = `FORMATO: ${R.formato === 'short' ? 'SHORT vertical' : 'VÍDEO LONGO horizontal'}\nPERSONAGENS JÁ ESCOLHIDOS: ${R.pers.map(p => p.nome).join(', ') || '(nenhum ainda)'}\n${$('[data-igual]', body).checked ? 'NÃO mude o texto das falas: só separe e organize.' : 'Pode melhorar o texto das falas (mais natural e no estilo do canal), sem mudar a história.'}\n\nROTEIRO:\n${txt.slice(0, 60000)}`;
    let j; try { j = IA.json(await IA.chama(this.SIS_ORG, pedido, null, { titulo: 'Organizando o roteiro' })); } catch (e) { UI.toast('A IA não conseguiu organizar: ' + esc(e.message), { kind: 'err' }); return false; }
    const T = this.normRot(j, R); if (!T.cenas.length) { UI.toast('Não achei falas nesse texto.', { kind: 'warn' }); return false; }
    R.roteiro = T; R.vozes = {}; if (T.titulo) R.nome = T.titulo; R.pronto = true; await this.guarda(R);
    const falta = [...new Set(this.falas(R).map(f => f.personagem).filter(n => n && !this.persDe(R, n)))];
    if (!novo) { this.pintaRoteiro(); if (falta.length) UI.toast(`Personagens do texto que ainda não estão no roteiro: <b>${falta.map(esc).join(', ')}</b>. Escolha quem faz esses papéis em Personagens (dê o mesmo nome).`, { kind: 'warn', time: 9000 }); }
    return true;
  },
  // tempo de uma fala: o da voz, ou o estimado pelas palavras (2,6 palavras/s + respiro)
  durFala(R, f) { const v = R.vozes[f.id]; return v?.dur ? v.dur : Math.max(1.2, String(f.texto || '').split(/\s+/).filter(Boolean).length / 2.6 + .4); },

  // ---------- CENÁRIOS (um por LUGAR do roteiro; cenas no mesmo lugar usam o mesmo) ----------
  // R.cenarios = { chaveDoLugar: { origem: 'casa'|'meu'|'rabiscado', id, nome, mini, cat: 'oficial'|'rep', aprovar } }
  chaveLugar(t) { return slugCen(String(t || 'lugar').trim()) || 'lugar'; },
  lugares(R) {
    const M = new Map();
    (R.roteiro?.cenas || []).forEach((ce, i) => { const k = this.chaveLugar(ce.lugar); if (!M.has(k)) M.set(k, { key: k, lugar: ce.lugar || 'Lugar', visual: ce.visual || '', cenas: [] }); const L = M.get(k); L.cenas.push(i + 1); if (!L.visual && ce.visual) L.visual = ce.visual; });
    return [...M.values()];
  },
  ctxShort(R) { const T = R.roteiro || {}; return [T.titulo, T.descricao].filter(Boolean).join(' — ') || R.nome; },
  passoCen(pc, R) {
    if (!R.roteiro) { pc.appendChild(h('<div class="vazio">Escreva o roteiro primeiro.</div>')); return; }
    R.cenarios ||= {}; const LS = this.lugares(R), com = LS.filter(L => R.cenarios[L.key]).length;
    pc.appendChild(h(`<div class="ide-dica"><b>${com} de ${LS.length}</b> lugares com cenário. Para cada lugar: escolha um salvo na biblioteca, ou gere um. <b>Oficial</b> = estilo do Planetário (pintado azul com profundidade), para onde a história acontece de verdade — sai como rascunho para você aprovar. <b>De representação</b> = rabiscado, rápido e barato, para lugar de passagem. Tudo fica salvo na biblioteca de Cenários, na prateleira <b>Deste Short</b>.</div>`));
    for (const L of LS) {
      const e = R.cenarios[L.key], box = h(`<div class="ide-cn ${e ? 'ok' : ''} ${e?.cat || ''}"><div class="ide-cn-mini">${e?.mini ? `<img src="${esc(e.mini)}" alt="">` : ic('paisagem', 22)}</div>
        <div class="ide-cn-info"><b>${esc(L.lugar)}</b><small>cena${L.cenas.length > 1 ? 's' : ''} ${L.cenas.join(', ')}</small>${L.visual ? `<p>${esc(L.visual)}</p>` : ''}
          ${e ? `<span class="ide-cn-esc"><i class="ide-cn-cat ${e.aprovar ? 'aprovar' : e.cat}">${e.aprovar ? 'oficial · para aprovar' : e.cat === 'oficial' ? 'oficial' : 'de representação'}</i> ${esc(e.nome)}</span>` : '<span class="ide-cn-sem">Sem cenário (ao gerar o vídeo, a IA desenha um rabiscado na hora, se a opção estiver ligada)</span>'}</div>
        <div class="ide-cn-bts"><button class="btn sm" data-bib>${ic('paisagem', 13)} ${e ? 'Ver / trocar…' : 'Escolher na biblioteca…'}</button><button class="btn sm ia" data-of title="Gera no estilo do Planetário (pintado azul), com a descrição do lugar">${ic('sparkles', 13)} Gerar oficial</button><button class="btn sm ia" data-rp title="Gera rabiscado, rápido">${ic('sparkles', 13)} Gerar rabiscado</button>${e ? `<button class="ibtn" data-x title="Tirar o cenário deste lugar">${ic('x', 13)}</button>` : ''}</div></div>`);
      const poe = async esc0 => { if (!esc0) return; R.cenarios[L.key] = esc0; await this.guarda(R); this.pintaRoteiro(); };
      $('[data-bib]', box).onclick = async () => poe(await CenLib.abrir({ escolher: { roteiro: R.id, lugar: L.lugar, visual: L.visual, contexto: this.ctxShort(R), atual: e || null } }));
      const gera = async tipo => { try { const d = await CenLib.gerarESalvar(tipo, L.visual || L.lugar, { roteiro: R.id, lugar: L.lugar, nome: L.lugar, contexto: this.ctxShort(R) });
          const it = (await CenLib.meus()).find(x => x.id === d.id); await poe({ origem: 'meu', id: d.id, nome: d.nome, mini: it?.mini, cat: tipo, aprovar: !!d.aprovar });
          UI.toast(tipo === 'oficial' ? `Cenário oficial de <b>${esc(L.lugar)}</b> pronto (rascunho para aprovar). <b>Ver / trocar</b> abre para mexer, ajustar com a IA ou aprovar.` : `Rabiscado de <b>${esc(L.lugar)}</b> pronto.`, { kind: 'ok', time: 7000 }); }
        catch (er) { UI.toast('O cenário não saiu: ' + esc(er.message), { kind: 'err', time: 7000 }); } };
      $('[data-of]', box).onclick = () => gera('oficial'); $('[data-rp]', box).onclick = () => gera('rep');
      if ($('[data-x]', box)) $('[data-x]', box).onclick = async () => { delete R.cenarios[L.key]; await this.guarda(R); this.pintaRoteiro(); };
      pc.appendChild(box);
    }
    this.rodape(pc, R, 6, 'Pôr as vozes', true);
  },

  // ---------- VOZES ----------
  passoVoz(pc, R) {
    if (!R.roteiro) { pc.appendChild(h('<div class="vazio">Escreva o roteiro primeiro.</div>')); return; }
    const F = this.falas(R), com = F.filter(f => R.vozes[f.id]).length;
    pc.appendChild(h(`<div class="ide-dica"><b>${com} de ${F.length}</b> falas com voz. Grave ou ponha um áudio em cada fala — ou ponha UM áudio com todas as falas de um personagem (na ordem do roteiro, com uma pausinha entre elas): ele é cortado nas pausas. Fala sem voz entra só com a legenda, no tempo estimado.</div>`));
    for (const p of R.pers) {
      const FP = F.filter(f => this.persDe(R, f.personagem) === p); if (!FP.length) continue;
      const box = h(`<div class="ide-vp" style="--pc:${esc(p.cor)}"><div class="ide-vcab"><span class="ide-pth">${p.thumb ? `<img src="${esc(p.thumb)}" alt="">` : ic('users', 16)}</span><b>${esc(p.nome)}</b><small>${FP.filter(f => R.vozes[f.id]).length} de ${FP.length} falas</small><span class="sp"></span><button class="btn sm" data-um title="Um áudio com todas as falas deste personagem: é cortado nas pausas, na ordem do roteiro">${ic('upload', 13)} Um áudio com todas</button></div><div class="ide-vl"></div></div>`);
      $('[data-um]', box).onclick = () => this.vozDoPersonagem(R, p, FP);
      for (const f of FP) {
        const v = R.vozes[f.id], r = h(`<div class="ide-v ${v ? 'ok' : ''}"><span class="ide-vt">${esc(f.texto)}</span><small>${v ? `${String(round(v.dur, 1)).replace('.', ',')} s` : 'sem voz'}</small>
          ${v ? `<button class="ibtn" data-ouv title="Ouvir">${ic('play', 12)}</button>` : ''}<button class="ibtn ${this._grav?.id === f.id ? 'rec' : ''}" data-rec title="${this._grav?.id === f.id ? 'Parar de gravar' : 'Gravar esta fala'}">${ic(this._grav?.id === f.id ? 'stop' : 'rec', 12)}</button><button class="ibtn" data-up title="Pôr um áudio">${ic('upload', 12)}</button>${v ? `<button class="ibtn" data-x title="Tirar a voz">${ic('x', 12)}</button>` : ''}</div>`);
        if (v) { $('[data-ouv]', r).onclick = () => this.ouve(v.k); $('[data-x]', r).onclick = () => { delete R.vozes[f.id]; this.guarda(R); this.pintaRoteiro(); }; }
        $('[data-rec]', r).onclick = () => this.grava(R, f);
        $('[data-up]', r).onclick = async () => { const [a] = await pickFiles('audio/*', false); if (a) { await this.poeVoz(R, f, a); this.pintaRoteiro(); } };
        $('.ide-vl', box).appendChild(r);
      }
      pc.appendChild(box);
    }
    this.rodape(pc, R, 7, 'Gerar o vídeo', true);
  },
  async poeVoz(R, f, blob) {
    const k = await Arq.guardar(blob), b = await Som.decod(k).catch(() => null); if (!b) return UI.toast('Esse áudio não abriu.', { kind: 'err' });
    R.vozes[f.id] = { k, dur: round(b.duration, 3) }; await this.guarda(R);
  },
  ouve(k) { try { this._toca?.stop(); } catch { } const b = Som.buf.get(k); if (!b) return Som.decod(k).then(() => this.ouve(k)); const ac = Som.ac(); ac.resume(); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(); this._toca = s; },
  async grava(R, f) {
    if (this._grav) { const g = this._grav; this._grav = null; g.rec.stop(); return; }
    let st; try { st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { return UI.toast('Não deu para usar o microfone (permita no navegador).', { kind: 'err' }); }
    const rec = new MediaRecorder(st), pedacos = []; rec.ondataavailable = e => e.data.size && pedacos.push(e.data);
    rec.onstop = async () => { st.getTracks().forEach(t => t.stop()); await this.poeVoz(R, f, new Blob(pedacos, { type: rec.mimeType || 'audio/webm' })); this.pintaRoteiro(); };
    this._grav = { id: f.id, rec }; rec.start(); this.pintaRoteiro(); UI.toast(`Gravando: “${esc(f.texto.slice(0, 60))}”. Clique no quadrado para parar.`, { kind: 'info' });
  },
  // UM áudio com todas as falas do personagem: acha os trechos com voz (pausas de 0,18 s+), junta até dar o nº de falas e corta
  async vozDoPersonagem(R, p, FP) {
    const [a] = await pickFiles('audio/*', false); if (!a) return;
    const k0 = await Arq.guardar(a), b = await Som.decod(k0).catch(() => null); if (!b) return UI.toast('Esse áudio não abriu.', { kind: 'err' });
    const T = this.trechosDeVoz(b, FP.length); if (!T.length) return UI.toast('Não achei voz nesse áudio.', { kind: 'warn' });
    for (let i = 0; i < FP.length && i < T.length; i++) { const [s, e] = T[i]; await this.poeVoz(R, FP[i], Som.wav(this.corta(b, s, e))); }
    UI.toast(T.length === FP.length ? `Cortei em ${T.length} falas de ${esc(p.nome)}. Ouça cada uma para conferir.` : `Achei ${T.length} trechos para ${FP.length} falas de ${esc(p.nome)}: confira e grave as que faltaram.`, { kind: T.length === FP.length ? 'ok' : 'warn', time: 7000 });
    this.pintaRoteiro();
  },
  trechosDeVoz(b, n) {
    const d = b.getChannelData(0), sr = b.sampleRate, J = Math.round(sr * .02), E = []; for (let i = 0; i < d.length; i += J) { let s = 0; for (let j = i; j < Math.min(d.length, i + J); j++) s += d[j] * d[j]; E.push(Math.sqrt(s / J)); }
    const ord = [...E].sort((x, y) => x - y), chao = ord[Math.floor(ord.length * .15)] || 0, topo = ord[Math.floor(ord.length * .95)] || 1, lim = chao + (topo - chao) * .12;
    let T = [], ini = null; E.forEach((v, i) => { if (v > lim && ini == null) ini = i; else if (v <= lim && ini != null) { T.push([ini, i]); ini = null; } }); if (ini != null) T.push([ini, E.length]);
    const pausa = Math.round(.18 / .02); const J2 = []; for (const t of T) { const u = J2[J2.length - 1]; if (u && t[0] - u[1] < pausa) u[1] = t[1]; else J2.push([...t]); } T = J2.filter(t => t[1] - t[0] >= 6); // tira estalos (< 0,12 s)
    while (T.length > n) { let m = 1, g = Infinity; for (let i = 1; i < T.length; i++) { const x = T[i][0] - T[i - 1][1]; if (x < g) { g = x; m = i; } } T[m - 1][1] = T[m][1]; T.splice(m, 1); } // junta as pausas menores
    return T.map(([s, e]) => [Math.max(0, s * .02 - .08), Math.min(b.duration, e * .02 + .12)]);
  },
  corta(b, s, e) { const sr = b.sampleRate, i0 = Math.floor(s * sr), i1 = Math.min(b.length, Math.ceil(e * sr)), o = new AudioBuffer({ length: Math.max(1, i1 - i0), numberOfChannels: b.numberOfChannels, sampleRate: sr }); for (let c = 0; c < b.numberOfChannels; c++) o.getChannelData(c).set(b.getChannelData(c).subarray(i0, i1)); return o; },

  // ---------- GERAR O VÍDEO ----------
  passoGerar(pc, R) {
    if (!R.roteiro) { pc.appendChild(h('<div class="vazio">Escreva o roteiro primeiro.</div>')); return; }
    const o = R.opcoes ||= {}, F = this.falas(R), semVoz = F.filter(f => !R.vozes[f.id]).length, tot = F.reduce((s, f) => s + this.durFala(R, f) + .25, 0) + R.roteiro.cenas.length * .6 + 1;
    const vids = [...new Map((this.S?.analise?.canais || []).flatMap(c => [...(c.longos?.bem || []), ...(c.shorts?.bem || [])].map(v => [v.id, { ...v, canal: c.nome }]))).values()];
    const box = h(`<div class="ide-gerar"><div class="ide-resumo"><div><b>${esc(R.roteiro.titulo || R.nome)}</b><small>${R.formato === 'short' ? 'Short 1080×1920' : 'Vídeo 1920×1080'} · 24 fps · ${R.roteiro.cenas.length} cena(s) · ${F.length} falas · cerca de ${Exportar.tc(tot)}</small></div>${semVoz ? `<span class="ide-aviso">${ic('alert', 12)} ${semVoz} fala(s) sem voz (entram só com a legenda)</span>` : ''}</div>
      <div class="ide-dica">${ic('paisagem', 12)} Cenários escolhidos: <b>${this.lugares(R).filter(L => R.cenarios?.[L.key]).length} de ${this.lugares(R).length}</b> lugares <small>(passo Cenários)</small></div>
      <label class="chk"><input type="checkbox" data-o="cenarios" ${o.cenarios ? 'checked' : ''}> Lugar sem cenário escolhido: a IA desenha um rabiscado na hora <small>(em peças)</small></label>
      <label class="chk"><input type="checkbox" data-o="boca" ${o.boca ? 'checked' : ''}> Boca pela voz <small>(personagem com a sessão "Boca")</small></label>
      <label class="chk"><input type="checkbox" data-o="legendas" ${o.legendas ? 'checked' : ''}> Legendas com a palavra falada acesa</label>
      <label class="chk"><input type="checkbox" data-o="animar" ${o.animar ? 'checked' : ''}> Animar com a IA <small>(poses pelas emoções, ações, câmera e cortes, cena por cena)</small></label>
      <div class="ide-sec">${ic('film', 13)} <b>Copiar o estilo destes vídeos</b><small>a IA vê cenas deles ao animar</small></div><div class="ide-refs"></div>
      <div class="ide-rod">${R.gerado ? `<button class="btn" data-abrir>${ic('folder', 13)} Abrir a animação gerada</button>` : ''}<span class="sp"></span><button class="btn primary" data-g>${ic('sparkles', 14)} ${R.gerado ? 'Gerar de novo (animação nova)' : 'Gerar o vídeo'}</button></div></div>`);
    $$('[data-o]', box).forEach(i => i.onchange = () => { o[i.dataset.o] = i.checked; this.guarda(R); });
    const rf = $('.ide-refs', box);
    for (const v of vids.slice(0, 16)) { const on = (o.refs || []).includes(v.id), c = h(`<label class="ide-ref ${on ? 'on' : ''}"><input type="checkbox" ${on ? 'checked' : ''}><img src="${this.thumb(v.id)}" alt=""><span>${esc(v.titulo)}<small>${esc(v.canal)} · ${this.num(v.views)}</small></span></label>`);
      $('input', c).onchange = e => { o.refs = (o.refs || []).filter(x => x !== v.id); if (e.target.checked) { if (o.refs.length >= 3) { e.target.checked = false; return UI.toast('No máximo 3 vídeos (cada um vira imagens no pedido da IA).', { kind: 'warn' }); } o.refs.push(v.id); } c.classList.toggle('on', e.target.checked); this.guarda(R); }; rf.appendChild(c); }
    if (!vids.length) rf.appendChild(h('<div class="vazio">Sem análise de canais.</div>'));
    $('[data-g]', box).onclick = () => this.gerarVideo(R);
    if ($('[data-abrir]', box)) $('[data-abrir]', box).onclick = async () => { const P = await DB.get('projetos', R.gerado); if (!P) return UI.toast('Essa animação não está mais neste computador.', { kind: 'warn' }); App.abrir(P); };
    pc.appendChild(box);
  },
  async defDe(R, p) {
    let def = null;
    if (p.origem === 'nuvem') def = await Nuvem.abrir(p.id); else if (p.origem === 'local') def = (await DB.get('arquivos', 'rascunho:' + p.id))?.def || await DB.get('personagens', p.id); else def = R.defs[p.id];
    if (!def) throw new Error(`não achei o personagem ${p.nome}`);
    def = clone(def); def.cor = p.cor; def.corModo = 'propria'; if (p.origem !== 'nuvem') def._local = def._local || { todo: true }; return def;
  },
  async gerarVideo(R) {
    const o = R.opcoes, F0 = this.falas(R); if (!F0.length) return;
    const fim = Ocupado.inicio({ tipo: 'ia', titulo: 'Gerando o vídeo', subtitulo: 'Montando a animação…' });
    try {
      const fmt = FORMATOS.find(f => f.id === (R.formato === 'short' ? 'shorts' : 'yt')), fps = fmt.fps, P = Modelo.novoProjeto({ w: fmt.w, h: fmt.h, fps, nome: R.roteiro.titulo || R.nome });
      P.nome = await Arquivos.nomeAnimacao(P.nome, P.id); P.temFundoPadrao = true; try { P.autor = { ...(await Autores.eu()), em: Date.now() }; } catch { }
      P.roteiro = { id: R.id, titulo: R.roteiro.titulo, descricao: R.roteiro.descricao };
      // personagens
      Ocupado.passo('Trazendo os personagens…'); const defs = {};
      for (const p of R.pers) { const d = await this.defDe(R, p); defs[p.id] = d; P.personagens[d.id] = d; await Arq.garantir(Modelo.chavesImgs(d)).catch(() => { }); }
      // tempo de cada fala e de cada cena
      let q = Math.round(fps * .3); const cenas = [];
      for (const ce of R.roteiro.cenas) { const c0 = q, falas = [];
        for (const f of ce.falas) { const d = this.durFala(R, f), nq = Math.max(1, Math.round(d * fps)); falas.push({ f, de: q, ate: q + nq - 1, p: this.persDe(R, f.personagem) }); q += nq + Math.round(fps * .25); }
        cenas.push({ ce, de: c0, ate: q - 1, falas }); q += Math.round(fps * .4); }
      P.duracao = q + fps;
      // camadas: cada personagem que aparece na cena entra nela (do começo ao fim da cena), espalhados na largura
      const W = P.w, H = P.h, nos = {};
      cenas.forEach((cn, ci) => {
        const quem = [...new Set([...cn.falas.map(x => x.p).filter(Boolean), ...(cn.ce.personagens || []).map(nm => this.persDe(R, nm)).filter(Boolean)])];
        quem.forEach((p, i) => { const def = defs[p.id]; const b = Modelo.caixaPersonagem(def, Modelo.partesNoEstado(def, {})), s = b.h > 0 ? clamp(H * (R.formato === 'short' ? .42 : .6) / b.h, .05, 4) : 1;
          const n = Modelo.novoNo('personagem', { ref: def.id, nome: cenas.length > 1 ? `${p.nome} · cena ${ci + 1}` : p.nome, s: round(s, 3) }); n.atuacao = { ...Atuacao.PADRAO }; n.interp = true; n.suaveP = true;
          n.de = cn.de; n.ate = cn.ate; n.chaves = { [cn.de]: { x: Math.round(W * (i + 1) / (quem.length + 1)), y: Math.round(H * (R.formato === 'short' ? .62 : .58)), r: 0, s: round(s, 3), sx: i >= quem.length / 2 && quem.length > 1 ? -1 : 1, op: 1 } };
          P.raiz.unshift(n); (nos[ci] ||= {})[p.id] = n; });
      });
      // vozes e legendas
      P.legendas = []; P.audios = [];
      // UMA faixa de voz por personagem (as falas dele no lugar certo, com silêncio entre elas): a timeline fica com poucas linhas
      Ocupado.passo('Juntando as vozes de cada personagem…');
      for (const p of R.pers) { const X = cenas.flatMap(cn => cn.falas).filter(x => x.p === p && R.vozes[x.f.id]); if (!X.length) continue;
        const bufs = await Promise.all(X.map(x => Som.decod(R.vozes[x.f.id].k).catch(() => null))), q0 = X[0].de, SR = 24000;
        const fimS = Math.max(...X.map((x, i) => (x.de - q0) / fps + (bufs[i]?.duration || 0))) + .2, off = new OfflineAudioContext(1, Math.ceil(fimS * SR), SR);
        X.forEach((x, i) => { if (!bufs[i]) return; const s = off.createBufferSource(); s.buffer = bufs[i]; s.connect(off.destination); s.start((x.de - q0) / fps); });
        const k = await Arq.guardar(Som.wav(await off.startRendering())); P.audios.push({ id: uid('au'), nome: 'Voz · ' + p.nome, arq: k, de: q0, vol: 1, tipo: 'voz', _pers: p.id }); }
      if (o.legendas) for (const cn of cenas) for (const x of cn.falas) P.legendas.push({ de: x.de, ate: x.ate, texto: x.f.texto, cor: x.p?.cor });
      if (o.legendas) P.legEstilo = { karaoke: true, pop: true, pos: 'baixo' };
      // referências de estilo (cenas dos vídeos analisados)
      P.refsAnim = [];
      for (const id of (o.refs || []).slice(0, 3)) { try { Ocupado.passo('Pegando as cenas do vídeo de referência…'); const r = await RefsAnim.doYoutube(id); const k = uid('a'); await Arq.guardar(r.blob, k); P.refsAnim.push({ id: uid('rf'), k, tipo: 'youtube', vid: id, url: 'https://youtu.be/' + id, nome: r.nome }); } catch { } }
      await DB.put('projetos', JSON.parse(JSON.stringify(P))); await App.abrir(P); R.gerado = P.id; await this.guarda(R);
      // boca pela voz
      if (o.boca) { Ocupado.passo('Mexendo a boca pela voz…'); let nb = 0;
        cenas.forEach((cn, ci) => { for (const [pid, n] of Object.entries(nos[ci] || {})) { const a = App.P.audios.find(y => y._pers === pid); if (a && Som.bocaAuto(App.P, n, a)) nb++; } });
        if (nb) App.commit('Boca pela voz (' + nb + ')'); }
      const escDe = cn => R.cenarios?.[this.chaveLugar(cn.ce.lugar)], comCen = cenas.filter(cn => escDe(cn) || o.cenarios).length;
      const passos = comCen + (o.animar ? cenas.length : 0); let feito = 0;
      // cenários: o escolhido no passo Cenários (biblioteca); sem escolha, a IA desenha um rabiscado na hora (se ligado)
      for (const [ci, cn] of cenas.entries()) { const ec = escDe(cn); if (!ec && !o.cenarios) continue; Ocupado.parte(feito, passos); Ocupado.passo(`${ec ? 'Pondo' : 'Desenhando'} o cenário da cena ${ci + 1}: ${cn.ce.lugar}…`);
        if (ec) { try { const def = await CenLib.resolve(ec); if (!def) throw new Error(`"${ec.nome}" não está mais na biblioteca`); App.q = cn.de; const pasta = await CenLib.porNaCena(def); pasta.de = cn.de; pasta.ate = cn.ate; pasta.nome = `Cenário ${ci + 1}: ${cn.ce.lugar}`.slice(0, 40); App.commit('Cenário da cena ' + (ci + 1)); }
          catch (e) { UI.toast(`O cenário da cena ${ci + 1} não entrou: ${esc(e.message)}`, { kind: 'warn' }); } feito++; continue; }
        try { const r = await Cenarios.pedirIA(cn.ce.visual || cn.ce.lugar, null); Cenarios.guardaUltimo?.(r.cena); const est = await Cenarios.estadoDe({ ...r.cena, ia: true }); est.ia = true; App.q = cn.de;
          const pasta = await Cenarios.porEmCamadas(est, { semAviso: true }); pasta.de = cn.de; pasta.ate = cn.ate; pasta.nome = `Cenário ${ci + 1}: ${cn.ce.lugar}`.slice(0, 40); App.commit('Cenário da cena ' + (ci + 1)); }
        catch (e) { UI.toast(`O cenário da cena ${ci + 1} não saiu: ${esc(e.message)}`, { kind: 'warn' }); } feito++; }
      // animação pela IA, cena por cena (só mexe dentro da cena)
      if (o.animar) for (const [ci, cn] of cenas.entries()) { Ocupado.parte(feito, passos); Ocupado.passo(`Animando a cena ${ci + 1} de ${cenas.length}…`);
        const txt = `Anime esta CENA do roteiro (${R.formato === 'short' ? 'short vertical' : 'vídeo longo'}), como nos canais de referência: poses fortes pelas emoções, a ação de cada fala, câmera e cortes pelo pedido de cada fala, reação de quem escuta, piscar de vez em quando. As bocas já estão feitas pela voz: NÃO mude a sessão da boca.\nCENA ${ci + 1} — ${cn.ce.lugar}\n` + cn.falas.map(x => `quadros ${x.de + 1}-${x.ate + 1} · ${x.p?.nome || '?'} (camada "${nos[ci]?.[x.p?.id]?.nome || x.p?.nome}") · emoção: ${x.f.emocao} · ação: ${x.f.acao || '—'} · câmera: ${x.f.camera} · fala: "${x.f.texto}"`).join('\n');
        try { await IA.executar(txt, null, t => Ocupado.passo(`Animando a cena ${ci + 1}… ${String(t).slice(-60)}`), { trechos: [{ de: cn.de, ate: cn.ate }] }); } catch (e) { UI.toast(`A IA não animou a cena ${ci + 1}: ${esc(e.message)}`, { kind: 'warn' }); } feito++; }
      Ocupado.parte(passos, passos);
    } catch (e) { UI.toast('Não deu para gerar: ' + esc(e.message), { kind: 'err', time: 8000 }); return; }
    finally { fim(); }
    UI.toast('Pronto! A animação foi montada. Confira, ajuste e exporte. O roteiro fica guardado na aba Ideias.', { kind: 'ok', time: 8000 });
  },
};
