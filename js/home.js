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
      <button class="novo" data-abrir><span class="fm">${ic('folder', 24)}</span><span><b>Abrir .animador</b><small>arquivo de animação</small></span></button></div>
      <div class="sec">Animações <span class="sp"></span><input type="search" placeholder="Buscar" value="${esc(this.q)}"></div><div class="grade" data-g></div>`;
    $$('[data-f]', c).forEach(b => b.onclick = () => this.nova(FORMATOS.find(f => f.id === b.dataset.f)));
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
  async apagar(p) { if (!(await UI.confirm({ title: 'Apagar a animação?', msg: `"<b>${esc(p.nome)}</b>" sai deste computador. Baixe o .animador antes se quiser guardar.`, ok: 'Apagar', danger: true }))) return; await DB.del('projetos', p.id); this.pinta(); EstudioConta?.espaco?.atualizar?.(); },
  async nova(f) { const P = Modelo.novoProjeto({ w: f.w, h: f.h, fps: f.fps, duracao: f.fps * 4, nome: 'Animação ' + new Date().toLocaleDateString('pt-BR') }); await DB.put('projetos', P); App.abrir(P); },
  async importar(f) { try { const P = await Toon.ler(f); await DB.put('projetos', P); App.abrir(P); } catch (e) { UI.toast('Não abriu: ' + esc(e.message), { kind: 'err' }); } },
  // título de pasta da biblioteca: botão direito muda a cor (guardada neste navegador)
  tituloPasta(pa) {
    const cor = CoresPasta.get('bib:' + pa), t = h(`<div class="pasta-t ${cor ? 'com-cor' : ''}" style="${cor ? `--pc:${cor}` : ''}" title="Botão direito: cor da pasta">${ic('folder', 13)} ${esc(pa)}</div>`);
    t.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [menuCor(cor, c => { CoresPasta.set('bib:' + pa, c); t.classList.toggle('com-cor', !!c); t.style.setProperty('--pc', c || ''); })]); };
    return t;
  },
  async personagens(c) {
    c.innerHTML = `<div class="novos"><button class="novo" data-novo><span class="fm">${ic('plus', 24)}</span><span><b>Personagem novo</b><small>montar pelas partes</small></span></button></div>
      <div class="sec">Biblioteca da equipe <span class="sp"></span><button class="btn sm" data-atu>${ic('redo', 13)} Atualizar</button></div><div data-l><div class="vazio"><span class="spin-dot"></span> Carregando…</div></div>`;
    $('[data-novo]', c).onclick = () => Atelie.abrir(null); $('[data-atu]', c).onclick = () => this.pinta();
    const l = $('[data-l]', c);
    try {
      const lista = await Nuvem.lista(); if (!lista.length) { l.innerHTML = '<div class="vazio">Ninguém criou personagens ainda. Clique em <b>Personagem novo</b>.</div>'; return; }
      l.innerHTML = ''; for (const pa of [...new Set(lista.map(x => x.pasta))]) {
        l.appendChild(this.tituloPasta(pa)); const g = h('<div class="grade" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))"></div>');
        for (const it of lista.filter(x => x.pasta === pa)) {
          const card = h(`<div class="pc"><div class="th" style="aspect-ratio:1;${it.thumb ? `background-image:url('${it.thumb}')` : ''}">${it.thumb ? '' : ic('layers', 26)}</div><div class="in"><b>${esc(it.nome)}</b><small>${it.modificado ? fmtDate(it.modificado) : ''}</small></div><button class="ibtn mn">${ic('dots', 15)}</button></div>`);
          card.onclick = e => { if (!e.target.closest('.mn')) Atelie.abrir(it.id); };
          $('.mn', card).onclick = e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); UI.ctx(r.right - 200, r.bottom + 4, [
            { label: 'Abrir no Ateliê', icon: 'edit', action: () => Atelie.abrir(it.id) },
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
    const t = UI.toast('<span class="spin-dot"></span> Montando o .animador…', { time: 120000 }), enc = new TextEncoder(), files = [{ name: 'projeto.json', data: enc.encode(JSON.stringify({ ...P, thumb: undefined })) }];
    for (const id of this.ids(P)) { let b = await Arq.pegaBlob(id); if (!b && /^personagens\//.test(id)) b = await Nuvem.baixar(id).catch(() => null); if (b) files.push({ name: 'arq/' + encodeURIComponent(id), data: new Uint8Array(await b.arrayBuffer()) }); }
    t.remove(); downloadBlob(Zip.create(files), safeName(P.nome) + '.animador');
  },
  async ler(f) {
    const m = Zip.read(await f.arrayBuffer()), pj = m.get('projeto.json'); if (!pj) throw new Error('Não é um arquivo .animador.');
    const P = JSON.parse(new TextDecoder().decode(pj)); if (P.v !== 2) throw new Error('Este arquivo é do Animador antigo.');
    for (const [nome, d] of m) if (nome.startsWith('arq/')) await Arq.guardar(new Blob([d]), decodeURIComponent(nome.slice(4)));
    P.id = uid('p'); P.modificado = Date.now(); return P;
  },
};

/* ---------- começar (só depois do login do Google conferido no servidor) ---------- */
addEventListener('DOMContentLoaded', async () => {
  const email = await TurmaAuth.gate(); if (!email || !TurmaAuth.passed) return;
  // "Sair da conta" (botão da conta): salva a animação aberta antes de sair
  (window.ESTUDIO_AO_SAIR ||= []).push(() => App.salvarJa());
  $('#home-brand').onclick = () => App.P ? App.fechar() : Home.pinta();
  Home.pinta();
  // círculo de espaço (padrão de todos os projetos): as animações deste computador, com "Baixar .animador"
  window.EstudioConta?.espaco.registrar({ programa: 'Animador', async listar() {
    if (App.P) await App.salvarJa();
    const ps = await DB.all('projetos');
    return ps.sort((a, b) => b.modificado - a.modificado).map(p => ({ nome: p.nome, bytes: JSON.stringify(p).length, data: p.modificado, thumb: p.thumb, info: `${p.duracao} quadros`, rotuloBaixar: 'Baixar .animador', baixar: () => Toon.baixar(p), apagar: async () => { await DB.del('projetos', p.id); Home.pinta(); }, }));
  } });
});
