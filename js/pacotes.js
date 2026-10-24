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
      const d = clone(def); await Autores.limpa(d); await Icone.prepara(d); const eu = await Autores.eu(), enc = new TextEncoder();
      const files = [{ name: 'personagem.json', data: enc.encode(JSON.stringify(d)) }, { name: 'info.json', data: enc.encode(JSON.stringify({ tipo: 'atelieanimador', v: 1, por: eu, em: Date.now() })) }];
      for (const k of [...new Set([...Modelo.chavesImgs(d), ...(d.audios || []).map(x => x.k)].filter(Boolean))]) { // imagens, fantasma e áudios de teste
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
  // SUBSTITUIR o personagem aberto pelo arquivo: tudo (partes, imagens, poses/presets, animações, vistas) vem do arquivo; o personagem continua o
  // mesmo (id, nome, pasta, autor), então se está na nuvem a nuvem é atualizada sozinha. Antes, a versão de agora vira uma cópia só neste computador.
  async substituir(f) {
    const atual = Atelie.def; if (!atual) return this.abrir(f);
    const tela = o => Ocupado.inicio({ tipo: 'arquivo', icone: 'layers', aviso: 'Aguarde: não dá para mexer enquanto isso. Não feche esta aba.', ...o });
    let r, fim = tela({ titulo: 'Abrindo o arquivo', subtitulo: `Lendo ${f.name}…` }); try { r = await this.ler(f); } catch (e) { fim(); return UI.toast('Não abriu: ' + esc(e.message), { kind: 'err' }); } fim();
    const novo = r.def, np = Modelo.todasPartes ? Modelo.todasPartes(novo).length : novo.partes.length, nps = (novo.sessoes || []).reduce((n, s) => n + (s.presets?.length || 0), 0) + (novo.vistas || []).reduce((n, v) => n + (v.sessoes || []).reduce((m, s) => m + (s.presets?.length || 0), 0), 0);
    AoVivo.avisaTroca?.({ estado: 'pergunta', arquivo: f.name, resumo: `${np} parte${np === 1 ? '' : 's'}, ${nps} preset${nps === 1 ? '' : 's'}` }); // trabalhando junto: os outros veem que está sendo decidido
    // COMO guardar a versão de agora: (a) as vistas antigas ficam NO MESMO personagem com "(antigo)" no nome; ou (b) uma cópia "(anterior)"
    // vai para "Só neste computador" de TODOS que estão junto e o personagem fica só com o que veio do arquivo
    const corpo = h(`<div>Trocar tudo de <b>${esc(atual.nome)}</b> — partes, imagens, poses e presets, animações de teste e vistas — pelo que está no arquivo <b>${esc(f.name)}</b> (${esc(novo.nome || '')}: ${np} parte${np === 1 ? '' : 's'}, ${nps} preset${nps === 1 ? '' : 's'}).${Atelie.naNuvem ? ' Ele está na nuvem: a nuvem da equipe também passa a ter a versão do arquivo.' : ''}
      <label class="field sub-fps" title="Quadros por segundo das animações do personagem">FPS do personagem<select data-fps>${Linha.opcoesFps(Modelo.fpsDe(novo)).replace('<option value="outro">Outro…</option>', '')}</select><small>No arquivo: ${Modelo.fpsDe(novo)} fps${(+atual.fps || 24) !== Modelo.fpsDe(novo) ? ` · agora: ${Modelo.fpsDe(atual)} fps` : ''}. Mudar mantém o tempo de cada frame.</small></label>
      <div class="sub-esc"><b>E a versão de agora?</b>
        <label class="sub-op"><input type="radio" name="guarda" value="antigo" checked><span><b>Guardar as vistas de agora no mesmo personagem</b><small>Elas continuam nele com <b>(antigo)</b> no nome (ex.: "${esc((atual.vistas?.[0]?.nome) || 'Frente')} (antigo)"), para passar presets de uma para a outra ou apagar depois.</small></span></label>
        <label class="sub-op"><input type="radio" name="guarda" value="rascunho"><span><b>Guardar uma cópia como rascunho e trocar tudo</b><small>A versão de agora vira "${esc(atual.nome)} (anterior)" em <b>Só neste computador</b>${AoVivo.ativo ? ' de <b>todos que estão junto</b>' : ''}, e o personagem fica só com o que veio do arquivo.</small></span></label></div></div>`);
    const op = await UI.modal({ title: 'Substituir este personagem?', icon: 'layers', width: 520, body: corpo,
      buttons: [{ label: 'Cancelar', value: null }, { label: 'Abrir como outro personagem', value: 'abrir' }, { label: 'Substituir', kind: 'primary', value: 'sub' }] });
    const guarda = $('input[name=guarda]:checked', corpo)?.value || 'antigo'; const fpsNovo = +$('[data-fps]', corpo)?.value || Modelo.fpsDe(novo);
    if (op !== 'sub') AoVivo.avisaTroca?.({ estado: 'cancelado', arquivo: f.name });
    if (op === 'abrir') return this.abrir(f); if (op !== 'sub') return;
    AoVivo.avisaTroca?.({ estado: 'trocando', arquivo: f.name, backup: guarda === 'rascunho' });
    fim = tela({ titulo: `Substituindo ${atual.nome}`, subtitulo: guarda === 'rascunho' ? 'Guardando a cópia de antes neste computador…' : 'Trocando pelo arquivo…' }); const t = { remove: () => fim() };
    try {
      if (guarda === 'rascunho') await Arquivos.duplicarPersonagem(JSON.parse(JSON.stringify(atual)), atual.thumb, `${atual.nome} (anterior)`);
      // as imagens do arquivo passam a morar no personagem aberto (mesmo id = mesma pasta na nuvem)
      Ocupado.passo('Trocando pelo arquivo…'); const velho = novo.id, id = atual.id, troca = k => k.split(`personagens/${velho}/`).join(`personagens/${id}/`);
      const ks = velho !== id ? Modelo.chavesImgs(novo) : []; let n = 0; for (const k of ks) { Ocupado.parte(++n, ks.length); const b = await Arq.pegaBlob(k).catch(() => null); if (!b) continue; const k2 = troca(k); await Arq.guardar(b, k2); Arq.img.delete(k2); }
      const d = velho === id ? novo : JSON.parse(troca(JSON.stringify(novo)));
      Object.assign(d, { id, nome: atual.nome, pasta: atual.pasta, autor: atual.autor, edicoes: atual.edicoes, modificado: Date.now() }); for (const c of ['autor', 'edicoes']) if (d[c] === undefined) delete d[c];
      // as vistas de antes ficam no personagem como "(antigo)": dá para mandar presets de uma para a outra e apagar quando quiser
      const velhas = (atual.vistas?.length ? atual.vistas : [{ id: null, nome: 'Vista', tipo: 'frente' }]).map(v => { const dv = v.id ? Modelo.naVista(atual, v.id) : atual; return { id: uid('vi'), nome: `${v.nome} (antigo)`.slice(0, 40), tipo: v.tipo || 'outra', partes: clone(dv.partes || []), sessoes: clone(dv.sessoes || []), animacoes: clone(dv.animacoes || []), raiz: dv.raiz, ...(dv.vis ? { vis: clone(dv.vis) } : {}) }; });
      Modelo.sincAnims(d); if (fpsNovo !== Modelo.fpsDe(d)) Modelo.trocaFps(d, fpsNovo); // fps escolhido na janela (o tempo de cada frame fica)
      Modelo.garanteVistas?.(d); if (guarda === 'antigo') d.vistas.push(...velhas); await Arq.garantir(Modelo.chavesImgs(d)).catch(() => { });
      Atelie.def = d; Atelie.sel = d.raiz || d.partes[0]?.id || null; Atelie.edit = null; Atelie.editPasso = null; Atelie.teste = null; if (Atelie.edImg) Atelie.fecharEditor(); Atelie.multi?.clear();
      Atelie.commit(); Atelie.enquadrar?.();
      if (AoVivo.ativo) { Ocupado.passo('Mandando para quem está junto…'); try { await AoVivo._fila; } catch { } const snap = await AoVivo.fixaSala?.(); AoVivo.avisaTroca({ estado: 'feito', arquivo: f.name, snap: !!snap }); }
      t.remove();
      UI.toast(`<b>${esc(atual.nome)}</b> agora é a versão do arquivo.${Atelie.naNuvem ? ' A nuvem está sendo atualizada.' : ''} ${guarda === 'rascunho' ? `A de antes ficou em <b>${esc(atual.nome)} (anterior)</b>, só neste computador` : 'As vistas de antes ficaram nele com <b>(antigo)</b> no nome'} (Ctrl+Z também volta).`, { kind: 'ok', time: 8000 });
    } catch (e) { t.remove(); AoVivo.avisaTroca?.({ estado: 'cancelado', arquivo: f.name }); UI.toast('Não consegui substituir: ' + esc(e.message), { kind: 'err', time: 7000 }); }
  },
  // errado = soltou/abriu no lugar de animação: abre no Ateliê do mesmo jeito, mas avisa que projeto do Animador é .animador
  async abrir(f, o = {}) {
    if (!$('#atelie').classList.contains('hidden') && Atelie.sujo && !(await UI.confirm({ title: 'Trocar de personagem?', msg: `"<b>${esc(Atelie.def?.nome || '')}</b>" tem mudanças que ainda não foram para a nuvem.`, ok: 'Abrir o arquivo', danger: true }))) return;
    let r; try { r = await this.ler(f); } catch (e) { return UI.toast('Não abriu: ' + esc(e.message), { kind: 'err' }); }
    const assumiu = await Autores.assumir(r.def); // sem criador conhecido (IA): quem abre primeiro vira o dono
    r.def.nome = await Arquivos.nomePersonagem(r.def.nome, r.def.id); // outro personagem (outro id) com o mesmo nome: este ganha (1), (2)…
    const naNuv = await Nuvem.estaNaNuvem(r.def.id); if (naNuv === false) Autores.semNuvem(r.def); // a equipe não tem mais este personagem: ficha de arquivo normal (sem o histórico da nuvem)
    await Atelie.abrir(null, { def: r.def, volta: !!App.P && !Atelie.emAba });
    const n = r.def.partes.length, ns = r.def.sessoes?.length || 0;
    const body = Autores.ficha(await Autores.prepara({ tipo: 'Personagem do Ateliê · .atelieanimador', nome: r.def.nome, thumb: r.def.thumb, ico: 'layers', resumo: `${n} parte${n === 1 ? '' : 's'} · ${ns} sess${ns === 1 ? 'ão' : 'ões'}`, autor: r.def.autor, verboAutor: naNuv === false ? 'criou' : 'subiu para a nuvem', edicoes: r.def.edicoes, pacote: r.info,
      aviso: [o.errado ? 'Este arquivo é um <b>personagem do Ateliê</b> (.atelieanimador), não um projeto do Animador. Projetos de animação são só <b>.animador</b>. Abri ele aqui no Ateliê para você.' : '', assumiu ? Autores.AVISO_DONO : ''].filter(Boolean).join('<br><br>') || null }));
    body.appendChild(h('<div class="ficha-nota">Ele está aberto no Ateliê. Para ir para a biblioteca da equipe, clique em <b>Salvar na nuvem</b> (se a equipe já tiver este personagem, a versão do arquivo fica no lugar).</div>'));
    UI.modal({ title: o.errado ? 'Isto é um personagem do Ateliê' : 'Personagem aberto do arquivo', icon: o.errado ? 'alert' : 'layers', width: 440, body, buttons: [{ label: 'Entendi', kind: 'primary', value: true }] });
  },
  async escolher() { const [f] = await pickFiles('.atelieanimador', false); if (f) this.abrir(f); },
};

/* ---------- ficha do .animador ao abrir: quem criou, quem editou e quem baixou o arquivo ---------- */
async function fichaAnimacao(P, info) {
  const assumiu = await Autores.assumir(P); if (assumiu) { await DB.put('projetos', P); if (App.P?.id === P.id) App.P.autor = P.autor; } // sem criador conhecido (IA): quem abre primeiro vira o dono
  const body = Autores.ficha(await Autores.prepara({ tipo: 'Animação · .animador', nome: P.nome, ico: 'film', resumo: `${P.duracao} quadros · ${P.w}×${P.h} · ${P.fps} fps`, autor: P.autor, verboAutor: 'criou a animação', edicoes: P.edicoes, pacote: info, aviso: assumiu ? Autores.AVISO_DONO : null }));
  UI.modal({ title: 'Animação aberta do arquivo', icon: 'film', width: 440, body, buttons: [{ label: 'Entendi', kind: 'primary', value: true }] });
}

/* ---------- soltar arquivos em qualquer lugar do Animador ---------- */
(() => {
  const pega = e => [...(e.dataTransfer?.files || [])].find(f => /\.(atelieanimador|animador|toon|presetatelie|vistasatelie)$/i.test(f.name));
  document.addEventListener('dragover', e => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }); // o navegador não abre o arquivo por cima do Animador
  document.addEventListener('drop', async e => {
    const f = pega(e); if (!f) { if (e.dataTransfer?.files?.length && !e.defaultPrevented) e.preventDefault(); return; }
    e.preventDefault(); e.stopPropagation(); // os arquivos do Animador não viram imagem
    if (!TurmaAuth.passed) return;
    if (/\.vistasatelie$/i.test(f.name)) return VistaArq.importar(f); // uma vista: entra no personagem aberto
    if (/\.presetatelie$/i.test(f.name)) return PresetArq.importar(f); // um preset: entra no personagem aberto no Ateliê
    const tipo = await AtelieArq.tipo(f), noAtelie = !$('#atelie').classList.contains('hidden');
    if (tipo === 'atelie') return noAtelie && Atelie.def ? AtelieArq.substituir(f) : AtelieArq.abrir(f, { errado: !noAtelie }); // com um personagem aberto: pergunta se é para trocar ele pelo arquivo
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
    if ($('#modal-root')?.children.length) { clearTimeout(this._t); return this.some(true); } // uma janela aberta (ex.: personagem novo) cuida do que for solto nela
    clearTimeout(this._t); this._t = setTimeout(() => this.some(), 400); // o arrasto parou de passar por aqui
    if (outros && noAtelie) return this.mostra('imagens', 'Pastas viram partes (com o nome da pasta)', 'imagens entram como sempre · .atelieanimador abre o personagem aqui'); // pasta não tem tipo: pode ser pasta ou arquivo do Animador
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
    const vi = o.vista || (o.sel || o.anim ? def.vistaAtual : null), vNome = vi && def.vistas?.length > 1 ? Modelo.vistaDe(def, vi)?.nome : null, dv = vi ? Modelo.naVista(def, vi) : def;
    const parte = dv.partes?.find(p => p.id === o.sel), anim = (dv.animacoes || []).find(a => a.id === o.anim);
    const sub = (anim ? 'Animação de teste: ' + anim.nome + (o.passo != null ? ` · frame ${o.passo + 1}${(anim.trilhas?.length || 0) > 1 ? ` (trilha ${(o.trilha || 0) + 1})` : ''}` : '') : parte ? 'Parte: ' + parte.nome : o.vista ? 'Vista inteira' : `Personagem inteiro · ${def.partes?.length || 0} partes${def.vistas?.length > 1 ? ` · ${def.vistas.length} vistas` : ''}`) + (vNome ? ` · vista ${vNome}` : '');
    const base = { prog: 'Animador · Ateliê', titulo: def.nome, sub, mini: def.thumb || o.thumb, parte: { tipo: 'personagem', sel: anim ? null : o.sel || null, anim: anim?.id || null, vista: vi || null } };
    if (o.nuvem) return EstudioConta.citar({ ...base, url: '/animador/?atelie=' + encodeURIComponent(def.id) });
    EstudioConta.citar({ ...base, abrir: '/animador/', nomeArquivo: safeName(def.nome) + AtelieArq.EXT,
      arquivo: async () => ({ blob: await AtelieArq.montar(def, { erro: true }), nome: safeName(def.nome) + AtelieArq.EXT }) });
  },
  // uma peça (ou uma área) do editor de cenário: vai o arquivo .cenario e quem recebe abre o editor já nela
  async cenario(est, peca, area) {
    if (!est || !this.pode()) return;
    const cv = Cenarios.compoe(est, 480), g = cv.getContext('2d'), k = cv.width / Cenarios.W, b = peca || area;
    if (b) { g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.rect(0, 0, cv.width, cv.height); g.rect(b.x * k, b.y * k, b.w * k, b.h * k); g.fill('evenodd'); g.strokeStyle = '#19d3f0'; g.lineWidth = 3; g.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k); }
    const nome = safeName(est.nome || 'Cenário') + '.cenario';
    EstudioConta.citar({ prog: 'Animador · Cenário', titulo: est.nome || 'Cenário', sub: peca ? 'Peça: ' + peca.nome : area ? `Área ${Math.round(area.w)}×${Math.round(area.h)}` : `Cenário inteiro · ${est.pecas.length} peças`, mini: cv.toDataURL('image/jpeg', .8), abrir: '/animador/',
      parte: { tipo: 'cenario', peca: peca?.id || null, area: !peca && area ? { x: Math.round(area.x), y: Math.round(area.y), w: Math.round(area.w), h: Math.round(area.h) } : null }, nomeArquivo: nome,
      arquivo: async () => ({ blob: await Cenarios.arquivo(est), nome }) });
  },
  // no Ateliê: o = { sel } (uma parte), { anim } (uma animação de teste) ou {} (o personagem inteiro); sem nada = a parte escolhida
  atelie(o) { const def = Atelie.def; if (def) this.personagem(def, { nuvem: !!Atelie.naNuvem && !Atelie.sujo, ...(o || { sel: Atelie.sel }) }); },
  // abrir no ponto citado dentro do Ateliê (parte ou animação)
  async irAtelie(parte) {
    if (!parte || !Atelie.def) return;
    if (parte.vista && parte.vista !== Atelie.def.vistaAtual && Atelie.def.vistas?.some(v => v.id === parte.vista)) await Atelie.trocaVista(parte.vista);
    if (parte.anim) { const a = (Atelie.def.animacoes || []).find(x => x.id === parte.anim); if (a) { Atelie.aba = 'animacoes'; Animacoes.sel = a.id; Atelie.pinta(); Animacoes.tocar(a); return; } }
    if (parte.sel && Atelie.def.partes.some(p => p.id === parte.sel)) { Atelie.escolhe(parte.sel); Atelie.pinta(); }
  },
  // aberto por uma citação (?anexo=… e/ou ?parte=…): devolve true se abriu alguma coisa
  async receber() {
    const rc = window.EstudioConta?.citacaoRecebida?.(); if (!rc) return null;
    if (!rc.anexo) return rc; // item da nuvem: quem chamou abre (ex.: ?atelie=) e usa rc.parte
    const t = UI.toast('<span class="spin-dot"></span> Baixando o arquivo da mensagem…', { time: 300000 });
    try {
      const ja = await DB.get('arquivos', 'cita:' + rc.anexo).catch(() => null), P0 = ja?.projeto ? await DB.get('projetos', ja.projeto).catch(() => null) : null;
      if (P0) { t.remove(); await App.abrir(P0); this.irPara(rc.parte); UI.toast('Esta animação já tinha vindo desta mensagem: abri a que está neste computador.', { kind: 'ok' }); return rc; }
      const f = await rc.baixar(); t.remove();
      if (rc.parte?.tipo === 'cenario' || /\.cenario$/i.test(f.name)) { await Cenarios.abrirArquivo(f, rc.parte); return rc; }
      if ((await AtelieArq.tipo(f)) === 'atelie') { await AtelieArq.abrir(f); this.irAtelie(rc.parte); return rc; }
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
