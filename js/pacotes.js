/* ===================== pacotes.js — arquivos .atelieanimador (backup de um personagem do Ateliê) e quem fez cada arquivo =====================
   .atelieanimador = zip com personagem.json + info.json + arq/<imagem>. É o personagem com todas as peças, para guardar ou passar adiante.
   .animador       = a animação (projeto). São coisas diferentes: soltar um .atelieanimador no Animador abre o Ateliê e avisa disso.
   Ao abrir qualquer um dos dois aparece uma ficha com a foto e o nome de quem criou/editou/baixou (nunca o e-mail). */
'use strict';
const AtelieArq = {
  EXT: '.atelieanimador',
  // o que tem dentro do arquivo: 'atelie', 'animador' ou null
  async tipo(f) {
    if (/\.atelieanimador$/i.test(f.name)) return 'atelie';
    try { const m = Zip.read(await f.arrayBuffer()); if (m.get('personagem.json')) return 'atelie'; if (m.get('projeto.json')) return 'animador'; } catch { }
    return /\.(animador|toon)$/i.test(f.name) ? 'animador' : null;
  },
  async baixar(def) { const b = await this.montar(def); if (b) downloadBlob(b, safeName(def.nome) + this.EXT); },
  // o personagem inteiro como Blob (para baixar ou mandar por mensagem)
  async montar(def, o = {}) {
    const t = UI.toast('<span class="spin-dot"></span> Montando o .atelieanimador…', { time: 300000 });
    try {
      const d = clone(def); await Autores.limpa(d); const eu = await Autores.eu(), enc = new TextEncoder();
      const files = [{ name: 'personagem.json', data: enc.encode(JSON.stringify(d)) }, { name: 'info.json', data: enc.encode(JSON.stringify({ tipo: 'atelieanimador', v: 1, por: eu, em: Date.now() })) }];
      for (const k of [...new Set(d.partes.flatMap(p => p.imgs.map(i => i.k)).filter(Boolean))]) {
        let b = await Arq.blobMelhor(k); if (!b && /^personagens\//.test(k)) b = await Nuvem.baixar(k).catch(() => null);
        if (b) files.push({ name: 'arq/' + encodeURIComponent(k), data: new Uint8Array(await b.arrayBuffer()) });
      }
      t.remove(); return Zip.create(files);
    } catch (e) { t.remove(); if (o.erro) throw e; UI.toast('Não consegui montar o arquivo: ' + esc(e.message), { kind: 'err' }); return null; }
  },
  async ler(f) {
    const m = Zip.read(await f.arrayBuffer()), pj = m.get('personagem.json'); if (!pj) throw new Error('Não é um arquivo .atelieanimador.');
    const def = JSON.parse(new TextDecoder().decode(pj)); if (!def?.partes) throw new Error('O arquivo do personagem está estragado.');
    let info = null; try { info = JSON.parse(new TextDecoder().decode(m.get('info.json'))); } catch { }
    for (const [nome, d] of m) if (nome.startsWith('arq/')) { const k = decodeURIComponent(nome.slice(4)); await Arq.guardar(new Blob([d]), k); Arq.img.delete(k); }
    return { def, info };
  },
  // errado = soltou/abriu no lugar de animação: abre no Ateliê do mesmo jeito, mas avisa que projeto do Animador é .animador
  async abrir(f, o = {}) {
    if (!$('#atelie').classList.contains('hidden') && Atelie.sujo && !(await UI.confirm({ title: 'Trocar de personagem?', msg: `"<b>${esc(Atelie.def?.nome || '')}</b>" tem mudanças que ainda não foram para a nuvem.`, ok: 'Abrir o arquivo', danger: true }))) return;
    let r; try { r = await this.ler(f); } catch (e) { return UI.toast('Não abriu: ' + esc(e.message), { kind: 'err' }); }
    await Atelie.abrir(null, { def: r.def, volta: !!App.P && !Atelie.emAba });
    const n = r.def.partes.length, ns = r.def.sessoes?.length || 0;
    const body = Autores.ficha(await Autores.prepara({ tipo: 'Personagem do Ateliê · .atelieanimador', nome: r.def.nome, thumb: r.def.thumb, ico: 'layers', resumo: `${n} parte${n === 1 ? '' : 's'} · ${ns} sess${ns === 1 ? 'ão' : 'ões'}`, autor: r.def.autor, verboAutor: 'subiu para a nuvem', edicoes: r.def.edicoes, pacote: r.info,
      aviso: o.errado ? 'Este arquivo é um <b>personagem do Ateliê</b> (.atelieanimador), não um projeto do Animador. Projetos de animação são só <b>.animador</b>. Abri ele aqui no Ateliê para você.' : null }));
    body.appendChild(h('<div class="ficha-nota">Ele está aberto no Ateliê. Para ir para a biblioteca da equipe, clique em <b>Salvar na nuvem</b> (se a equipe já tiver este personagem, a versão do arquivo fica no lugar).</div>'));
    UI.modal({ title: o.errado ? 'Isto é um personagem do Ateliê' : 'Personagem aberto do arquivo', icon: o.errado ? 'alert' : 'layers', width: 440, body, buttons: [{ label: 'Entendi', kind: 'primary', value: true }] });
  },
  async escolher() { const [f] = await pickFiles('.atelieanimador', false); if (f) this.abrir(f); },
};

/* ---------- ficha do .animador ao abrir: quem criou, quem editou e quem baixou o arquivo ---------- */
async function fichaAnimacao(P, info) {
  const body = Autores.ficha(await Autores.prepara({ tipo: 'Animação · .animador', nome: P.nome, ico: 'film', resumo: `${P.duracao} quadros · ${P.w}×${P.h} · ${P.fps} fps`, autor: P.autor, verboAutor: 'criou a animação', edicoes: P.edicoes, pacote: info }));
  UI.modal({ title: 'Animação aberta do arquivo', icon: 'film', width: 440, body, buttons: [{ label: 'Entendi', kind: 'primary', value: true }] });
}

/* ---------- soltar arquivos em qualquer lugar do Animador ---------- */
(() => {
  const pega = e => [...(e.dataTransfer?.files || [])].find(f => /\.(atelieanimador|animador|toon)$/i.test(f.name));
  document.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }); // o navegador não abre o arquivo por cima do Animador
  document.addEventListener('drop', async e => {
    const f = pega(e); if (!f) { if (e.dataTransfer?.files?.length && !e.defaultPrevented) e.preventDefault(); return; }
    e.preventDefault(); e.stopPropagation(); // os arquivos do Animador não viram imagem
    if (!TurmaAuth.passed) return;
    const tipo = await AtelieArq.tipo(f), noAtelie = !$('#atelie').classList.contains('hidden');
    if (tipo === 'atelie') return AtelieArq.abrir(f, { errado: !noAtelie });
    if (tipo === 'animador') {
      if (noAtelie && Atelie.sujo && !(await UI.confirm({ title: 'Sair do Ateliê para abrir a animação?', msg: `"<b>${esc(Atelie.def?.nome || '')}</b>" tem mudanças que ainda não foram para a nuvem.`, ok: 'Abrir a animação', danger: true }))) return;
      if (noAtelie) { Atelie.sujo = false; if (Atelie.emAba) { Atelie.emAba = false; history.replaceState(null, '', location.pathname); } }
      return Home.importar(f);
    }
    UI.toast('Esse arquivo não é do Animador.', { kind: 'warn' });
  }, true);
})();

/* ---------- arrastando arquivos por cima do Animador: animação mostrando o que vai acontecer ao soltar ----------
   Durante o arrasto o navegador só conta o TIPO (imagem ou outro arquivo), não o nome: imagem → onde ela vai entrar (no Ateliê);
   outro arquivo → "solte para abrir" (.animador abre a animação, .atelieanimador abre no Ateliê). Imagens fora do Ateliê não são aceitas. */
const Soltar = {
  el: null, pill: null, _t: null, modo: null,
  liga() {
    const svg = `<svg class="sv-borda" preserveAspectRatio="none"><rect x="3" y="3" rx="22" ry="22" width="calc(100% - 6px)" height="calc(100% - 6px)"/></svg>`;
    this.el = h(`<div class="soltar-ov" hidden>${svg}<div class="sv-card"><div class="sv-ic"><span class="sv-doc">${ic('file', 34)}</span><span class="sv-seta">${ic('down', 22)}</span></div><b data-t></b><small data-s></small><div class="sv-tags"><span>.animador</span><span>.atelieanimador</span></div></div></div>`);
    this.pill = h(`<div class="soltar-pill" hidden><span class="sv-pilha"><i></i><i></i><i></i></span><span><b data-t></b><small data-s></small></span></div>`);
    document.body.append(this.el, this.pill);
    addEventListener('dragover', e => this.passa(e), true); addEventListener('dragenter', e => this.passa(e), true);
    addEventListener('dragleave', e => { if (!e.relatedTarget || e.clientX <= 0 || e.clientY <= 0 || e.clientX >= innerWidth || e.clientY >= innerHeight) this.some(); }, true);
    addEventListener('drop', () => this.some(true), true); addEventListener('dragend', () => this.some(true), true);
  },
  passa(e) {
    const dt = e.dataTransfer; if (!dt || !dt.types?.includes('Files') || !TurmaAuth.passed) return;
    const itens = [...(dt.items || [])].filter(i => i.kind === 'file'), imgs = itens.filter(i => /^image\//.test(i.type)), outros = itens.length - imgs.length;
    const noAtelie = !$('#atelie').classList.contains('hidden');
    clearTimeout(this._t); this._t = setTimeout(() => this.some(), 400); // o arrasto parou de passar por aqui
    if (outros) return this.mostra('arquivo', noAtelie ? 'Solte para abrir o personagem' : 'Solte para abrir', noAtelie ? '.atelieanimador abre aqui no Ateliê · .animador abre a animação' : '.animador abre a animação · .atelieanimador abre o personagem no Ateliê');
    if (!imgs.length && itens.length) return this.mostra('arquivo', 'Solte para abrir', 'Arquivos do Animador: .animador e .atelieanimador');
    if (!noAtelie) return this.some();
    // imagens no Ateliê: o texto muda conforme o lugar embaixo do mouse
    const n = imgs.length || 1, t = e.target instanceof Element ? e.target : null, P = id => Atelie.parte(id)?.nome || '';
    const pasta = t?.closest('#at-imgs .pasta-img[data-pasta]'), linha = t?.closest('#at-partes .no[data-pid]'), naLista = t?.closest('#at-partes'), noPainel = t?.closest('#at-imgs'), noPalco = t?.closest('.at-palco');
    $('.at-palco')?.classList.toggle('solta-aqui', !!noPalco);
    let tt, ss;
    if (pasta && Atelie.parte()) { tt = `${n > 1 ? n + ' imagens entram' : 'A imagem entra'} na pasta "${pasta.dataset.pasta}"`; ss = `da parte "${P(Atelie.sel)}"`; }
    else if (noPainel && Atelie.parte()) { tt = `${n > 1 ? n + ' imagens viram' : 'Vira'} imagem de "${P(Atelie.sel)}"`; ss = 'para trocar no Testar e no editor'; }
    else if (linha) { tt = `${n > 1 ? n + ' imagens viram' : 'Vira'} imagem de "${P(linha.dataset.pid)}"`; ss = 'solte em cima desta parte'; }
    else if (naLista || (noPalco && !Atelie.parte())) { tt = n > 1 ? `Cada imagem vira uma parte nova (${n})` : 'A imagem vira uma parte nova'; ss = 'depois encaixe na hierarquia'; }
    else if (noPalco) { tt = `${n > 1 ? n + ' imagens viram' : 'Vira'} imagem de "${P(Atelie.sel)}"`; ss = 'na lista de partes: cada uma vira uma parte'; }
    else { tt = n > 1 ? `${n} imagens` : '1 imagem'; ss = 'solte no palco, na lista de partes ou em "Imagens de…"'; }
    this.mostra('imagens', tt, ss);
  },
  mostra(modo, t, s) {
    const alvo = modo === 'arquivo' ? this.el : this.pill, outro = modo === 'arquivo' ? this.pill : this.el;
    outro.hidden = true; outro.classList.remove('on'); $('[data-t]', alvo).textContent = t; $('[data-s]', alvo).textContent = s;
    if (alvo.hidden) { alvo.hidden = false; requestAnimationFrame(() => alvo.classList.add('on')); } else alvo.classList.add('on'); this.modo = modo;
  },
  some(ja) {
    clearTimeout(this._t); $('.at-palco')?.classList.remove('solta-aqui');
    for (const el of [this.el, this.pill]) { if (!el || el.hidden) continue; el.classList.remove('on'); if (ja) el.hidden = true; else setTimeout(() => { if (!el.classList.contains('on')) el.hidden = true; }, 180); }
    this.modo = null;
  },
};
Soltar.liga();

/* ---------- Citar em mensagens (Mensagens do Estúdio Problems, no botão da conta) ----------
   Na nuvem (personagem da equipe): vai o endereço e quem recebe abre direto nele.
   Só neste computador (animação, personagem local): vai o arquivo (.animador / .atelieanimador) junto; quem recebe clica,
   o Animador abre numa aba nova, baixa o arquivo e abre já no ponto citado (quadro e camada, ou a parte do personagem). */
const Citacao = {
  pode() { if (window.EstudioConta?.citar) return true; UI.toast('As mensagens ainda não carregaram. Tente de novo em instantes.', { kind: 'err' }); return false; },
  async animacao(P, q = 0, sel = null) {
    if (!P || !this.pode()) return;
    if (App.P === P) await App.salvarJa();
    const no = sel && sel !== 'camera' ? Modelo.achar(P, sel) : null;
    let mini = P.thumb; try { mini = Render.miniatura(P, q, 240) || mini; } catch { }
    EstudioConta.citar({ prog: 'Animador', titulo: P.nome, sub: `Quadro ${q + 1} de ${P.duracao}${no?.nome ? ' · ' + no.nome : sel === 'camera' ? ' · Câmera' : ''}`, mini, abrir: '/animador/',
      parte: { tipo: 'animacao', q, sel: sel || null }, nomeArquivo: safeName(P.nome) + '.animador',
      arquivo: async () => ({ blob: await Toon.montar(App.P?.id === P.id ? App.P : P), nome: safeName(P.nome) + '.animador' }) });
  },
  personagem(def, o = {}) {
    if (!def || !this.pode()) return;
    const parte = def.partes?.find(p => p.id === o.sel), sub = parte ? 'Parte: ' + parte.nome : `${def.partes?.length || 0} partes`;
    const base = { prog: 'Animador · Ateliê', titulo: def.nome, sub, mini: def.thumb || o.thumb, parte: { tipo: 'personagem', sel: o.sel || null } };
    if (o.nuvem) return EstudioConta.citar({ ...base, url: '/animador/?atelie=' + encodeURIComponent(def.id) });
    EstudioConta.citar({ ...base, abrir: '/animador/', nomeArquivo: safeName(def.nome) + AtelieArq.EXT,
      arquivo: async () => ({ blob: await AtelieArq.montar(def, { erro: true }), nome: safeName(def.nome) + AtelieArq.EXT }) });
  },
  atelie() { const def = Atelie.def; if (def) this.personagem(def, { nuvem: !!Atelie.naNuvem && !Atelie.sujo, sel: Atelie.sel }); },
  // aberto por uma citação (?anexo=… e/ou ?parte=…): devolve true se abriu alguma coisa
  async receber() {
    const rc = window.EstudioConta?.citacaoRecebida?.(); if (!rc) return null;
    if (!rc.anexo) return rc; // item da nuvem: quem chamou abre (ex.: ?atelie=) e usa rc.parte
    const t = UI.toast('<span class="spin-dot"></span> Baixando o arquivo da mensagem…', { time: 300000 });
    try {
      const ja = await DB.get('arquivos', 'cita:' + rc.anexo).catch(() => null), P0 = ja?.projeto ? await DB.get('projetos', ja.projeto).catch(() => null) : null;
      if (P0) { t.remove(); await App.abrir(P0); this.irPara(rc.parte); UI.toast('Esta animação já tinha vindo desta mensagem: abri a que está neste computador.', { kind: 'ok' }); return rc; }
      const f = await rc.baixar(); t.remove();
      if ((await AtelieArq.tipo(f)) === 'atelie') { await AtelieArq.abrir(f); if (rc.parte?.sel && Atelie.def?.partes.some(p => p.id === rc.parte.sel)) { Atelie.escolhe(rc.parte.sel); Atelie.pinta(); } return rc; }
      const { P, info } = await Toon.ler(f); await DB.put('projetos', P); await DB.put('arquivos', { tipo: 'cita', projeto: P.id, em: Date.now() }, 'cita:' + rc.anexo).catch(() => { });
      await App.abrir(P); this.irPara(rc.parte); fichaAnimacao(P, info);
    } catch (e) { t.remove(); UI.toast('Não abriu o arquivo da mensagem: ' + esc(e.message), { kind: 'err' }); }
    return rc;
  },
  irPara(parte) {
    if (!parte || !App.P) return;
    if (Number.isFinite(+parte.q)) App.setQ(+parte.q, { forca: true });
    if (parte.sel && (parte.sel === 'camera' || Modelo.achar(App.P, parte.sel))) App.selecionar(parte.sel);
  },
};
