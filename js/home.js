/* ===================== home.js — tela inicial: animações deste computador e a biblioteca de personagens da equipe ===================== */
'use strict';
const FORMATOS = [
  { id: 'yt', nome: 'YouTube', w: 1920, h: 1080, fps: 24 }, { id: 'shorts', nome: 'Shorts / TikTok', w: 1080, h: 1920, fps: 24 },
  { id: 'quad', nome: 'Quadrado', w: 1080, h: 1080, fps: 24 }, { id: 'yt12', nome: 'Animação em 12 fps', w: 1920, h: 1080, fps: 12 },
];
const Home = {
  atual: 'animacoes', q: '',
  aba(a) { this.atual = a; this.pinta(); },
  async pinta() {
    const el = $('#home-in'); if (!el) return;
    el.innerHTML = `<div class="home-abas"><button data-a="animacoes" class="${this.atual === 'animacoes' ? 'on' : ''}">Animações</button><button data-a="personagens" class="${this.atual === 'personagens' ? 'on' : ''}">Personagens da equipe</button></div><div data-corpo></div>`;
    $$('[data-a]', el).forEach(b => b.onclick = () => this.aba(b.dataset.a));
    const c = $('[data-corpo]', el); this.atual === 'animacoes' ? this.animacoes(c) : this.personagens(c);
  },
  async animacoes(c) {
    c.innerHTML = `<div class="novos">${FORMATOS.map(f => { const k = 34 / Math.max(f.w, f.h); return `<button class="novo" data-f="${f.id}"><span class="fm"><i style="width:${f.w * k}px;height:${f.h * k}px"></i></span><span><b>${f.nome}</b><small>${f.w}×${f.h} · ${f.fps} fps</small></span></button>`; }).join('')}
      <button class="novo" data-pers><span class="fm">${ic('gear', 24)}</span><span><b>Personalizado</b><small>do seu jeito ou com a IA</small></span></button>
      <button class="novo" data-abrir><span class="fm">${ic('folder', 24)}</span><span><b>Abrir .animador</b><small>arquivo de animação</small></span></button></div>
      <div class="sec">Animações <span class="sp"></span><input type="search" placeholder="Buscar" value="${esc(this.q)}"></div><div class="grade" data-g></div>`;
    $$('[data-f]', c).forEach(b => b.onclick = () => this.nova(FORMATOS.find(f => f.id === b.dataset.f)));
    $('[data-pers]', c).onclick = () => this.personalizada();
    $('[data-abrir]', c).onclick = async () => { const [f] = await pickFiles('.animador,.toon', false); if (f) this.importar(f); };
    const busca = $('input[type=search]', c); busca.oninput = () => { this.q = busca.value; this.grade(c); };
    this.grade(c);
  },
  async grade(c) {
    const g = $('[data-g]', c), todos = (await DB.all('projetos')).sort((a, b) => b.modificado - a.modificado), q = this.q.trim().toLowerCase(), L = todos.filter(p => !q || p.nome.toLowerCase().includes(q));
    g.innerHTML = L.length ? '' : `<div class="vazio" style="grid-column:1/-1">${todos.length ? 'Nada com esse nome.' : 'Nenhuma animação ainda: escolha um formato aí em cima.'}</div>`;
    for (const p of L) {
      const card = h(`<div class="pc"><div class="th" style="${p.thumb ? `background-image:url('${p.thumb}')` : ''}">${p.thumb ? '' : ic('film', 26)}</div><div class="in"><b>${esc(p.nome)}</b><small>${fmtDate(p.modificado)} · ${p.duracao} quadros · ${p.w}×${p.h}</small></div><button class="ibtn mn" title="Opções">${ic('dots', 15)}</button></div>`);
      card.onclick = e => { if (!e.target.closest('.mn')) App.abrir(p); };
      $('.mn', card).onclick = e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); UI.ctx(r.right - 200, r.bottom + 4, [
        { label: 'Renomear', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome da animação', value: p.nome }); if (n) { p.nome = n; await DB.put('projetos', p); this.pinta(); } } },
        { label: 'Duplicar', icon: 'dup', action: async () => { const c2 = clone(p); c2.id = uid('p'); c2.nome += ' (cópia)'; c2.modificado = Date.now(); await DB.put('projetos', c2); this.pinta(); } },
        { label: 'Baixar .animador', icon: 'download', action: () => Toon.baixar(p) },
        '-', { label: 'Apagar', icon: 'trash', danger: true, action: () => this.apagar(p) },
      ]); };
      g.appendChild(card);
    }
  },
  /* ---------- tela personalizada: tamanho, quadros por segundo, duração e fundo (à mão ou pedindo à IA) ---------- */
  TAMANHOS: [['1920×1080 (YouTube)', 1920, 1080], ['1080×1920 (Shorts/TikTok)', 1080, 1920], ['1080×1080 (quadrado)', 1080, 1080], ['1080×1350 (Instagram 4:5)', 1080, 1350], ['2560×1440 (2K)', 2560, 1440], ['3840×2160 (4K)', 3840, 2160], ['1280×720 (HD)', 1280, 720], ['2048×858 (cinema 2.39)', 2048, 858]],
  SIS_TELA: `Você configura uma animação 2D nova a partir do pedido em português. Responda SÓ um JSON:
{"nome":"nome curto","w":1920,"h":1080,"fps":24,"segundos":4,"fundo":{"modo":"quadriculado|cor","cor":"#rrggbb","forca":0.35},"folha":"#rrggbb","semFolha":false,"explica":"uma frase"}
Regras: w e h entre 64 e 4096 (pares); fps entre 1 e 60 (desenho animado costuma usar 12 ou 24); segundos entre 1 e 600. "folha" é a cor da folha do tamanho da câmera (Fundo padrão); semFolha=true se a pessoa não quiser folha. Se o pedido não falar de algo, use o comum (1920×1080, 24 fps, 4 s, fundo quadriculado #cfcfcf, folha #ffffff).`,
  async personalizada() {
    const o = { nome: 'Animação ' + new Date().toLocaleDateString('pt-BR'), w: 1920, h: 1080, fps: 24, segundos: 4, palco: { modo: 'quadriculado', cor: '#cfcfcf', forca: .35 }, folha: '#ffffff', semFolha: false };
    const body = h(`<div class="tela-p"><div data-pag="ajustes"></div>
      <div class="tela-ia"><label class="field">${ic('sparkles', 13)} Mais com a IA <small style="color:var(--tx3)">(opcional · vale junto com os ajustes ao criar)</small><textarea rows="3" placeholder="Ex.: deixa em 12 fps com cara de desenho antigo, fundo escuro, uma vinheta leve e um título &quot;Episódio 1&quot; no começo"></textarea></label><div class="ia-res" hidden></div></div></div>`);
    const pag = $('[data-pag=ajustes]', body), prev = () => { const k = 120 / Math.max(o.w, o.h); return `<i style="width:${Math.round(o.w * k)}px;height:${Math.round(o.h * k)}px;background:${o.semFolha ? 'transparent' : o.folha}"></i>`; };
    // a prévia mostra o fundo escolhido (quadriculado na cor/intensidade, ou cor lisa), igual ao palco
    const fundoPrev = () => { const pc = o.palco, c = pc.cor; if (pc.modo === 'cor') return `background:${c}`;
      const [r, g, b] = rgbDe(c), claro = r * .3 + g * .59 + b * .11 > 140, a = claro ? pc.forca * .22 : pc.forca * .16, x = claro ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
      return `background:repeating-conic-gradient(${x} 0 25%,transparent 0 50%) 0 0/16px 16px,${c}`; };
    const pinta = () => {
      pag.innerHTML = `<div class="tela-prev" data-prev style="${fundoPrev()}">${prev()}</div>
        <label class="field">Nome<input type="text" data-k="nome" value="${esc(o.nome)}"></label>
        <label class="field">Tamanho pronto<select data-tam><option value="">Escolher…</option>${this.TAMANHOS.map(([n, w, hh], i) => `<option value="${i}" ${w === o.w && hh === o.h ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <div class="campo2"><span style="color:var(--tx2)">Largura</span><input type="number" data-k="w" value="${o.w}" min="64" max="4096" style="width:80px"><span style="color:var(--tx2)">Altura</span><input type="number" data-k="h" value="${o.h}" min="64" max="4096" style="width:80px"><button class="btn sm" data-girar title="Trocar largura e altura">${ic('redo', 13)} Girar</button></div>
        <div class="campo2"><span style="color:var(--tx2)">Quadros por segundo</span><select data-k="fps">${[8, 10, 12, 15, 24, 25, 30, 48, 50, 60].map(f => `<option ${f === o.fps ? 'selected' : ''}>${f}</option>`).join('')}</select><span style="color:var(--tx2)">Duração</span><input type="number" data-k="segundos" value="${o.segundos}" min="1" max="600" style="width:64px"><span style="color:var(--tx3)">s = ${Math.round(o.segundos * o.fps)} quadros</span></div>
        <div class="campo2"><span style="color:var(--tx2)">Fundo</span><div class="presets" style="display:inline-flex"><button data-m="quadriculado" class="${o.palco.modo === 'quadriculado' ? 'on' : ''}">Quadriculado</button><button data-m="cor" class="${o.palco.modo === 'cor' ? 'on' : ''}">Cor lisa</button></div><input type="color" data-pc value="${o.palco.cor}"></div>
        <div class="campo2"><label class="chk"><input type="checkbox" data-folha ${o.semFolha ? '' : 'checked'}> Folha do tamanho da câmera</label><input type="color" data-fc value="${o.folha}" ${o.semFolha ? 'disabled' : ''}></div>`;
      $$('[data-k]', pag).forEach(i => i.onchange = () => { const k = i.dataset.k; o[k] = k === 'nome' ? i.value.trim() || o.nome : clamp(+i.value || 1, k === 'fps' ? 1 : k === 'segundos' ? 1 : 64, k === 'fps' ? 60 : k === 'segundos' ? 600 : 4096); if (k === 'w' || k === 'h') o[k] = Math.round(o[k] / 2) * 2; pinta(); });
      $('[data-tam]', pag).onchange = ev => { const t = this.TAMANHOS[+ev.target.value]; if (t) { o.w = t[1]; o.h = t[2]; pinta(); } };
      $('[data-girar]', pag).onclick = () => { [o.w, o.h] = [o.h, o.w]; pinta(); };
      $$('[data-m]', pag).forEach(b => b.onclick = () => { o.palco.modo = b.dataset.m; pinta(); });
      $('[data-pc]', pag).oninput = ev => { o.palco.cor = ev.target.value; $('[data-prev]', pag).style.cssText = fundoPrev(); }; $('[data-fc]', pag).oninput = ev => { o.folha = ev.target.value; $('[data-prev]', pag).innerHTML = prev(); };
      $('[data-folha]', pag).onchange = ev => { o.semFolha = !ev.target.checked; pinta(); };
    };
    pinta();
    let pedido = '';
    const ok = await UI.modal({ title: 'Tela personalizada', icon: 'gear', width: 580, body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Criar', kind: 'primary', onClick: async api => {
      pedido = $('textarea', body).value.trim(); if (!pedido) return true;
      // 1) a IA ajusta a tela em cima do que a pessoa escolheu (só muda o que o pedido falar)
      const res = $('.ia-res', body), bt = api.foot.querySelector('.btn.primary'); bt.disabled = true; res.hidden = false; res.textContent = 'A IA está ajustando a tela…';
      try {
        const j = IA.json(await IA.chama(this.SIS_TELA + '\nVocê recebe o que a pessoa já escolheu (ATUAL): mantenha tudo igual e só mude o que o PEDIDO falar.', `ATUAL: ${JSON.stringify(o)}\nPEDIDO: ${pedido}`)), par = v => Math.round(clamp(+v || 0, 64, 4096) / 2) * 2;
        if (j.nome) o.nome = String(j.nome).slice(0, 60); if (j.w) o.w = par(j.w); if (j.h) o.h = par(j.h); if (j.fps) o.fps = clamp(Math.round(+j.fps), 1, 60); if (j.segundos) o.segundos = clamp(+j.segundos, 1, 600);
        if (j.fundo) o.palco = { modo: j.fundo.modo === 'cor' ? 'cor' : 'quadriculado', cor: /^#[0-9a-f]{6}$/i.test(j.fundo.cor || '') ? j.fundo.cor : o.palco.cor, forca: Number.isFinite(+j.fundo.forca) ? clamp(+j.fundo.forca, 0, 1) : o.palco.forca };
        if (/^#[0-9a-f]{6}$/i.test(j.folha || '')) o.folha = j.folha; if (typeof j.semFolha === 'boolean') o.semFolha = j.semFolha;
      } catch (e) { res.textContent = 'A IA não respondeu (' + e.message + '). Crio com os ajustes, e o resto você pede depois no botão IA.'; await new Promise(r => setTimeout(r, 1800)); pedido = ''; }
      return true;
    } }] });
    if (!ok) return;
    await this.nova({ w: o.w, h: o.h, fps: o.fps }, { nome: o.nome, duracao: Math.max(1, Math.round(o.segundos * o.fps)), palco: o.palco, folha: o.folha, semFolha: o.semFolha });
    // 2) o resto do pedido (efeitos, cenário, textos…) a IA faz já dentro da animação nova
    if (pedido && App.P) { const t = UI.toast('<span class="spin-dot"></span> <span data-p>A IA está personalizando a animação…</span>', { time: 600000 });
      try { const r = await IA.executar(pedido, null, txt => { const e = t.querySelector('[data-p]'); if (e) e.textContent = 'A IA está personalizando… ' + txt.slice(-80); }); t.remove(); UI.toast(esc(r).replace(/\n+/g, '<br>'), { kind: 'ok', time: 8000 }); }
      catch (e) { t.remove(); UI.toast('A IA não terminou: ' + esc(e.message), { kind: 'err' }); } }
  },
  async apagar(p) { if (!(await UI.confirm({ title: 'Apagar a animação?', msg: `"<b>${esc(p.nome)}</b>" sai deste computador. Baixe o .animador antes se quiser guardar.`, ok: 'Apagar', danger: true }))) return; await DB.del('projetos', p.id); this.pinta(); EstudioConta?.espaco?.atualizar?.(); },
  async nova(f, o = {}) { const P = Modelo.novoProjeto({ w: f.w, h: f.h, fps: f.fps, duracao: o.duracao || f.fps * 4, nome: o.nome || 'Animação ' + new Date().toLocaleDateString('pt-BR'), fundo: o.folha });
    if (o.palco) P.palco = o.palco; if (o.semFolha) P.raiz = P.raiz.filter(n => !n.fundoPadrao); P.temFundoPadrao = true; try { P.autor = { ...(await Autores.eu()), em: Date.now() }; } catch { } await DB.put('projetos', P); App.abrir(P); },
  // abrir um .animador; se for um personagem do Ateliê (.atelieanimador), abre no Ateliê e avisa
  async importar(f) {
    if ((await AtelieArq.tipo(f)) === 'atelie') return AtelieArq.abrir(f, { errado: true });
    try { const { P, info } = await Toon.ler(f); await DB.put('projetos', P); await App.abrir(P); fichaAnimacao(P, info); } catch (e) { UI.toast('Não abriu: ' + esc(e.message), { kind: 'err' }); }
  },
  // título de pasta da biblioteca: botão direito muda a cor (guardada neste navegador)
  tituloPasta(pa) {
    const cor = CoresPasta.get('bib:' + pa), t = h(`<div class="pasta-t ${cor ? 'com-cor' : ''}" style="${cor ? `--pc:${cor}` : ''}" title="Botão direito: cor da pasta">${ic('folder', 13)} ${esc(pa)}</div>`);
    t.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [menuCor(cor, c => { CoresPasta.set('bib:' + pa, c); t.classList.toggle('com-cor', !!c); t.style.setProperty('--pc', c || ''); })]); };
    return t;
  },
  async personagens(c) {
    c.innerHTML = `<div class="novos"><button class="novo" data-novo><span class="fm">${ic('plus', 24)}</span><span><b>Personagem novo</b><small>montar pelas partes</small></span></button>
      <button class="novo" data-backup><span class="fm">${ic('folder', 24)}</span><span><b>Abrir .atelieanimador</b><small>backup de um personagem</small></span></button></div>
      <div class="sec">Biblioteca da equipe <span class="sp"></span><button class="btn sm" data-atu>${ic('redo', 13)} Atualizar</button></div><div data-l><div class="vazio"><span class="spin-dot"></span> Carregando…</div></div>`;
    $('[data-novo]', c).onclick = () => Atelie.abrirAba(null); $('[data-backup]', c).onclick = () => AtelieArq.escolher(); $('[data-atu]', c).onclick = () => this.pinta();
    const l = $('[data-l]', c);
    // rascunhos: mudanças guardadas só neste computador (ainda não foram para a nuvem)
    Atelie.rascunhos().then(rs => { if (!rs.length) return; const sec = h(`<div><div class="sec">${ic('save', 14)} Só neste computador <small style="color:var(--tx3);font-weight:400;margin-left:6px">mudanças que ainda não foram para a nuvem</small></div><div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))"></div></div>`), g = $('.grade', sec);
      for (const r of rs) { const card = h(`<div class="pc rasc"><div class="th" style="aspect-ratio:1;${r.thumb ? `background-image:url('${r.thumb}')` : ''}">${r.thumb ? '' : ic('layers', 26)}</div><div class="in"><b>${esc(r.def.nome)}</b><small>guardado ${fmtDate(r.em)}</small></div><span class="tag-local">${ic('save', 11)} só aqui</span><button class="ibtn mn">${ic('dots', 15)}</button></div>`);
        card.onclick = e => { if (!e.target.closest('.mn')) Atelie.abrirAba(r.def.id); };
        $('.mn', card).onclick = e => { e.stopPropagation(); const b = e.currentTarget.getBoundingClientRect(); UI.ctx(b.right - 200, b.bottom + 4, [
          { label: 'Continuar no Ateliê', icon: 'edit', action: () => Atelie.abrirAba(r.def.id) }, { label: 'Baixar .atelieanimador', icon: 'download', action: () => AtelieArq.baixar(r.def) },
          '-', { label: 'Descartar o rascunho', icon: 'trash', danger: true, action: async () => { if (await UI.confirm({ title: `Descartar o rascunho de "${esc(r.def.nome)}"?`, msg: 'As mudanças que não foram para a nuvem somem deste computador.', ok: 'Descartar', danger: true })) { await Atelie.apagarRascunho(r.def.id); this.pinta(); } } }]); };
        g.appendChild(card); }
      l.before(sec); });
    try {
      const lista = await Nuvem.lista(); if (!lista.length) { l.innerHTML = '<div class="vazio">Ninguém criou personagens ainda. Clique em <b>Personagem novo</b>.</div>'; return; }
      l.innerHTML = ''; for (const pa of [...new Set(lista.map(x => x.pasta))]) {
        l.appendChild(this.tituloPasta(pa)); const g = h('<div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))"></div>');
        for (const it of lista.filter(x => x.pasta === pa)) {
          const card = h(`<div class="pc"><div class="th" style="aspect-ratio:1;${it.thumb ? `background-image:url('${it.thumb}')` : ''}">${it.thumb ? '' : ic('layers', 26)}</div><div class="in"><b>${esc(it.nome)}</b><small>${it.modificado ? fmtDate(it.modificado) : ''}</small></div><button class="ibtn mn">${ic('dots', 15)}</button></div>`);
          card.onclick = e => { if (!e.target.closest('.mn')) Atelie.abrirAba(it.id); };
          const selo = Autores.selo(it); if (selo) card.appendChild(selo);
          $('.mn', card).onclick = e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); UI.ctx(r.right - 200, r.bottom + 4, [
            { label: 'Abrir no Ateliê', icon: 'edit', action: () => Atelie.abrirAba(it.id) },
            { label: 'Baixar .atelieanimador (backup)', icon: 'download', action: async () => { try { AtelieArq.baixar(await Nuvem.abrir(it.id)); } catch (er) { UI.toast(esc(er.message), { kind: 'err' }); } } },
            '-', { label: 'Apagar da nuvem', icon: 'trash', danger: true, action: async () => { if (await UI.confirm({ title: `Apagar "${esc(it.nome)}" da nuvem da equipe?`, msg: 'Some para todo mundo. Animações que já usam ele continuam com a cópia delas.', ok: 'Apagar', danger: true })) { await Nuvem.apagar(it.id).catch(er => UI.toast(esc(er.message), { kind: 'err' })); this.pinta(); } } },
          ]); };
          g.appendChild(card);
        }
        l.appendChild(g);
      }
    } catch (e) { l.innerHTML = `<div class="vazio">Não consegui abrir a biblioteca: ${esc(e.message)}</div>`; }
  },
};

/* ---------- arquivo .animador (antes se chamava .toon; os dois abrem): a animação com tudo dentro (personagens, imagens e áudios) ---------- */
const Toon = {
  ids(P) { return [...new Set([...Modelo.todos(P).filter(n => n.tipo === 'imagem').map(n => n.arq), ...(P.audios || []).map(a => a.arq), ...Object.values(P.personagens || {}).flatMap(d => d.partes.flatMap(p => p.imgs.map(i => i.k)))].filter(Boolean))]; },
  async baixar(P) {
    // quem criou / editou vai junto (foto e nome, nunca o e-mail)
    try { await Autores.marca(P); if (App.P === P) App.salvarJa?.(); else await DB.put('projetos', JSON.parse(JSON.stringify(P))); } catch { }
    const eu = await Autores.eu().catch(() => null);
    const t = UI.toast('<span class="spin-dot"></span> Montando o .animador…', { time: 120000 }), enc = new TextEncoder(), files = [{ name: 'projeto.json', data: enc.encode(JSON.stringify({ ...P, thumb: undefined })) }, { name: 'info.json', data: enc.encode(JSON.stringify({ tipo: 'animador', v: 1, por: eu, em: Date.now() })) }];
    for (const id of this.ids(P)) { let b = await Arq.pegaBlob(id); if (!b && /^personagens\//.test(id)) b = await Nuvem.baixar(id).catch(() => null); if (b) files.push({ name: 'arq/' + encodeURIComponent(id), data: new Uint8Array(await b.arrayBuffer()) }); }
    t.remove(); downloadBlob(Zip.create(files), safeName(P.nome) + '.animador');
  },
  async ler(f) {
    const m = Zip.read(await f.arrayBuffer()), pj = m.get('projeto.json'); if (!pj) throw new Error(m.get('personagem.json') ? 'Isto é um personagem do Ateliê (.atelieanimador), não uma animação.' : 'Não é um arquivo .animador.');
    const P = JSON.parse(new TextDecoder().decode(pj)); if (P.v !== 2) throw new Error('Este arquivo é do Animador antigo.');
    for (const [nome, d] of m) if (nome.startsWith('arq/')) await Arq.guardar(new Blob([d]), decodeURIComponent(nome.slice(4)));
    let info = null; try { info = JSON.parse(new TextDecoder().decode(m.get('info.json'))); } catch { }
    P.id = uid('p'); P.modificado = Date.now(); await Autores.limpa(P); return { P, info };
  },
};

/* ---------- começar (só depois do login do Google conferido no servidor) ---------- */
addEventListener('DOMContentLoaded', async () => {
  const email = await TurmaAuth.gate(); if (!email || !TurmaAuth.passed) return;
  // "Sair da conta" (botão da conta): salva a animação aberta antes de sair
  (window.ESTUDIO_AO_SAIR ||= []).push(() => App.salvarJa());
  $('#home-brand').onclick = () => App.P ? App.fechar() : Home.pinta();
  // aba do Ateliê (aberta pelo botão Ateliê): abre direto o personagem; Voltar fecha a aba
  const at = new URLSearchParams(location.search).get('atelie');
  if (at) { Atelie.emAba = true; await Atelie.abrir(at === 'novo' ? null : at); if (!Atelie.def) { if (at === 'novo') window.close(); history.replaceState(null, '', location.pathname); Atelie.emAba = false; Home.pinta(); } }
  else Home.pinta();
  // personagem salvo em outra aba (o Ateliê): a animação aberta aqui pega a versão nova
  try { new BroadcastChannel('animador').onmessage = async ev => {
    const d = ev.data; if (d?.tipo !== 'personagem' || !d.def) return;
    if (App.P?.personagens?.[d.def.id]) { App.P.personagens[d.def.id] = d.def; await Arq.garantir(d.def.partes.flatMap(p => p.imgs.map(i => i.k))); App.commit('Personagem atualizado'); UI.toast(`<b>${esc(d.def.nome)}</b> atualizado nesta animação.`, { kind: 'ok' }); }
    else if (!App.P && Home.atual === 'personagens' && !Atelie.emAba) Home.pinta();
  }; } catch { }
  // círculo de espaço (padrão de todos os projetos): as animações deste computador, com "Baixar .animador"
  window.EstudioConta?.espaco.registrar({ programa: 'Animador', async listar() {
    if (App.P) await App.salvarJa();
    const ps = await DB.all('projetos');
    return ps.sort((a, b) => b.modificado - a.modificado).map(p => ({ nome: p.nome, bytes: JSON.stringify(p).length, data: p.modificado, thumb: p.thumb, info: `${p.duracao} quadros`, rotuloBaixar: 'Baixar .animador', baixar: () => Toon.baixar(p), apagar: async () => { await DB.del('projetos', p.id); Home.pinta(); }, })).concat((await Atelie.rascunhos()).map(r => ({ nome: r.def.nome + ' (rascunho do Ateliê)', bytes: JSON.stringify(r.def).length, data: r.em, thumb: r.thumb, info: 'só neste computador', rotuloBaixar: 'Baixar .atelieanimador', baixar: () => AtelieArq.baixar(r.def), apagar: async () => { await Atelie.apagarRascunho(r.def.id); Home.pinta(); } })));
  } });
});
