/* ===================== presetarq.js — arquivo .presetatelie (UM preset de uma sessão) =====================
   Botão direito num preset (aba Poses) › "Exportar como .presetatelie": vai a sessão (nome e partes), o preset inteiro (imagem,
   posição, giro, tamanho, espelho, aparece, profundidade, a posição de cada imagem só nele) e as imagens que ele usa.
   Soltar o arquivo no Ateliê com um personagem aberto: acha a sessão pelo nome (ou cria), as partes e imagens pelo nome
   (imagem que não existe na parte entra nela) e põe o preset; nome repetido vira "Nome (1)", "Nome (2)"… */
'use strict';
const PresetArq = {
  EXT: '.presetatelie',
  async ehPreset(f) { if (/\.presetatelie$/i.test(f.name)) return true; try { return !!Zip.read(await f.arrayBuffer()).get('preset.json'); } catch { return false; } },
  async exportar(s, pr) {
    const def = Atelie.def; if (!def) return;
    try {
      const enc = new TextEncoder(), partes = {}, chaves = new Set();
      for (const [pid, e] of Object.entries(pr.estado || {})) {
        const p = Atelie.parte(pid); if (!p) continue; const usadas = new Set([e.img, ...Object.keys(e.d || {})].filter(Boolean));
        partes[pid] = { nome: p.nome, imgs: p.imgs.filter(i => usadas.has(i.id)).map(i => { (i.camadas?.length ? [i.k] : [i.k]).forEach(k => chaves.add(k)); return { id: i.id, nome: i.nome, k: i.k, w: i.w, h: i.h, pivo: i.pivo, ajuste: i.ajuste }; }) };
      }
      const dados = { tipo: 'presetatelie', v: 1, em: Date.now(), por: await Autores.eu().catch(() => null), personagem: { id: def.id, nome: def.nome },
        sessao: { nome: s.nome, partes: (s.partes || []).map(id => Atelie.parte(id)?.nome).filter(Boolean) }, preset: { nome: pr.nome, estado: clone(pr.estado || {}) }, partes };
      const files = [{ name: 'preset.json', data: enc.encode(JSON.stringify(dados)) }];
      await Arq.garantir([...chaves]).catch(() => { });
      for (const k of chaves) { let b = await Arq.blobMelhor?.(k) || await Arq.pegaBlob(k).catch(() => null); if (!b && /^personagens\//.test(k)) b = await Nuvem.baixar(k).catch(() => null); if (b) files.push({ name: 'arq/' + encodeURIComponent(k), data: new Uint8Array(await b.arrayBuffer()) }); }
      downloadBlob(Zip.create(files), safeName(`${def.nome} - ${s.nome} - ${pr.nome}`) + this.EXT);
      UI.toast(`Preset <b>${esc(pr.nome)}</b> baixado (${esc(this.EXT)}). Solte o arquivo no Ateliê para pôr ele num personagem.`, { kind: 'ok', time: 5000 });
    } catch (e) { UI.toast('Não consegui exportar o preset: ' + esc(e.message), { kind: 'err' }); }
  },
  // soltar o arquivo: entra no personagem aberto
  async importar(f) {
    const def = Atelie.def; if (!def) return UI.toast('Abra um personagem no Ateliê para pôr o preset nele.', { kind: 'warn' });
    let m, d; try { m = Zip.read(await f.arrayBuffer()); d = JSON.parse(new TextDecoder().decode(m.get('preset.json'))); if (d?.tipo !== 'presetatelie') throw 0; } catch { return UI.toast('Esse arquivo não é um .presetatelie.', { kind: 'err' }); }
    const nrm = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const parteDe = nome => def.partes.find(p => nrm(p.nome) === nrm(nome));
    const estado = {}, faltam = [], novasImgs = []; let novaSess = false;
    for (const [pid0, info] of Object.entries(d.partes || {})) {
      const e0 = d.preset.estado?.[pid0]; if (!e0) continue; const p = parteDe(info.nome); if (!p) { faltam.push(info.nome); continue; }
      const mapa = {}; // id da imagem no arquivo → id aqui (pelo nome; se não tem, a imagem entra na parte)
      for (const im of info.imgs || []) {
        let aqui = p.imgs.find(i => nrm(i.nome) === nrm(im.nome));
        if (!aqui) { const bin = m.get('arq/' + encodeURIComponent(im.k)); if (!bin) continue; const iid = uid('im').toLowerCase().replace(/[^a-z0-9]/g, ''), ext = (im.k.match(/\.(png|webp|jpe?g|gif)$/i) || [, 'png'])[1], k = `personagens/${def.id}/img/${iid}.${ext}`;
          const blob = new Blob([bin], { type: ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/' + ext }); await Arq.guardar(blob, k); Arq.img.set(k, await createImageBitmap(blob).catch(() => null));
          aqui = { id: uid('i'), nome: im.nome, k, w: im.w, h: im.h, pivo: im.pivo || { x: im.w / 2, y: im.h / 2 }, ajuste: im.ajuste || { x: 0, y: 0 } }; p.imgs.push(aqui); novasImgs.push(`${p.nome} › ${im.nome}`); }
        mapa[im.id] = aqui.id;
      }
      const e = clone(e0); if (e.img) e.img = mapa[e.img] || (p.imgs.some(i => i.id === e.img) ? e.img : undefined); if (e.img === undefined) delete e.img;
      if (e.d) { const nd = {}; for (const [iid, v] of Object.entries(e.d)) if (mapa[iid]) nd[mapa[iid]] = v; e.d = nd; if (!Object.keys(nd).length) delete e.d; }
      estado[p.id] = e;
    }
    // a sessão: a de mesmo nome; sem ela, uma nova com as partes que existirem aqui
    let s = def.sessoes.find(x => nrm(x.nome) === nrm(d.sessao?.nome));
    if (!s) { s = { id: uid('s'), nome: d.sessao?.nome || 'Sessão', partes: (d.sessao?.partes || []).map(parteDe).filter(Boolean).map(p => p.id), presets: [] }; def.sessoes.push(s); novaSess = true; }
    let nome = d.preset?.nome || 'Preset', n = 0; const tem = x => s.presets.some(p => nrm(p.nome) === nrm(x)); if (tem(nome)) { while (tem(`${d.preset.nome} (${++n})`)); nome = `${d.preset.nome} (${n})`; }
    const pr = { id: uid('pr'), nome, estado }; s.presets.push(pr);
    Atelie.aba = 'sessoes'; Atelie.edit = { s: s.id, p: pr.id }; Atelie.commit();
    UI.toast(`Preset <b>${esc(nome)}</b> entrou em <b>${esc(s.nome)}</b>${novaSess ? ' (sessão nova)' : ''}.${novasImgs.length ? ` Imagens novas: ${esc(novasImgs.join(', '))}.` : ''}${faltam.length ? ` <b>Sem parte aqui:</b> ${esc(faltam.join(', '))} (essas ficaram de fora).` : ''} Ctrl+Z desfaz.`, { kind: faltam.length ? 'warn' : 'ok', time: 8000 });
  },
};

/* ---------- mandar um preset para OUTRA VISTA (botão direito no preset › Enviar para a vista…) ----------
   Sessão, partes e imagens são achadas pelo mesmo id (vistas alinhadas) ou pelo NOME; imagem que falta entra na parte de lá
   (a mesma imagem, sem copiar o arquivo); nome repetido avisa e vira "Nome (1)". */
PresetArq.alvoVista = id => { const def = Atelie.def; if (id === def.vistaAtual) return def; const v = def.vistas.find(x => x.id === id); if (v) { v.partes ||= []; v.sessoes ||= []; v.animacoes ||= []; } return v; };
PresetArq.nrm = x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
PresetArq.enviar = async function (s, pr, vid) {
  const def = Atelie.def, T = this.alvoVista(vid), vNome = def.vistas.find(v => v.id === vid)?.nome || 'vista'; if (!T) return;
  const n = this.nrm, estado = {}, faltam = [], novas = [];
  for (const [pid, e0] of Object.entries(pr.estado || {})) {
    const p = Atelie.parte(pid); if (!p) continue; const q = T.partes.find(x => x.id === pid) || T.partes.find(x => n(x.nome) === n(p.nome)); if (!q) { faltam.push(p.nome); continue; }
    const mapa = {}; for (const iid of [e0.img, ...Object.keys(e0.d || {})].filter(Boolean)) { const im = p.imgs.find(i => i.id === iid); if (!im) continue; let aqui = q.imgs.find(i => i.id === iid) || q.imgs.find(i => n(i.nome) === n(im.nome)); if (!aqui) { aqui = { ...clone(im), id: uid('i') }; q.imgs.push(aqui); novas.push(`${q.nome} › ${im.nome}`); } mapa[iid] = aqui.id; }
    const e = clone(e0); if (e.img) e.img = mapa[e.img] || e.img; if (e.d) { const nd = {}; for (const [k, v] of Object.entries(e.d)) if (mapa[k]) nd[mapa[k]] = v; e.d = nd; } estado[q.id] = e;
  }
  let t = T.sessoes.find(x => x.id === s.id) || T.sessoes.find(x => n(x.nome) === n(s.nome)), sessNova = false;
  if (!t) { t = { id: T.sessoes.some(x => x.id === s.id) ? uid('s') : s.id, nome: s.nome, partes: (s.partes || []).map(id => { const p = Atelie.parte(id); return (T.partes.find(x => x.id === id) || T.partes.find(x => n(x.nome) === n(p?.nome)))?.id; }).filter(Boolean), presets: [] }; T.sessoes.push(t); sessNova = true; }
  let nome = pr.nome; const tem = x => t.presets.some(p => n(p.nome) === n(x));
  if (tem(nome)) { let k = 0; while (tem(`${pr.nome} (${++k})`)); nome = `${pr.nome} (${k})`;
    if (!(await UI.confirm({ title: 'Já existe um preset com esse nome', msg: `A vista <b>${esc(vNome)}</b> já tem <b>${esc(pr.nome)}</b> em <b>${esc(t.nome)}</b>. Vai ser criada uma cópia chamada <b>${esc(nome)}</b> (o de lá fica como está).`, ok: 'Criar a cópia' }))) return; }
  t.presets.push({ id: t.presets.some(p => p.id === pr.id) ? uid('pr') : pr.id, nome, estado }); // mesmo id entre as vistas (alinhado) quando dá
  Atelie.commit();
  UI.toast(`<b>${esc(nome)}</b> foi para a vista <b>${esc(vNome)}</b> (${esc(t.nome)}${sessNova ? ', sessão nova' : ''}).${novas.length ? ` Imagens que entraram lá: ${esc(novas.join(', '))}.` : ''}${faltam.length ? ` <b>Sem essa parte lá:</b> ${esc(faltam.join(', '))}.` : ''}`, { kind: faltam.length ? 'warn' : 'ok', time: 7000 });
};

/* ---------- arquivo .vistasatelie (UMA vista inteira: partes, imagens, poses e animações de teste) ---------- */
const VistaArq = {
  EXT: '.vistasatelie',
  async exportar(vid) {
    const def = Atelie.def, v = def.vistas.find(x => x.id === vid), d = Modelo.naVista(def, vid); if (!v) return;
    const fim = Ocupado.inicio({ tipo: 'arquivo', icone: 'eye', titulo: `Salvando a vista ${v.nome}`, subtitulo: 'Juntando as imagens…', aviso: 'Aguarde um instante.' });
    try {
      const dados = { tipo: 'vistasatelie', v: 1, em: Date.now(), personagem: { id: def.id, nome: def.nome }, vista: { nome: v.nome, tipo: v.tipo, partes: clone(d.partes || []), sessoes: clone(d.sessoes || []), animacoes: clone(d.animacoes || []), raiz: d.raiz, vis: clone(d.vis || null) } };
      const so = { partes: dados.vista.partes, vis: dados.vista.vis, vistas: [] }, chaves = [...new Set([...Modelo.chavesImgs(so), ...Modelo.chavesAp(dados.vista)])];
      await Arq.garantir(chaves).catch(() => { }); const files = [{ name: 'vista.json', data: new TextEncoder().encode(JSON.stringify(dados)) }]; let i = 0;
      for (const k of chaves) { Ocupado.parte(++i, chaves.length); let b = await Arq.blobMelhor?.(k) || await Arq.pegaBlob(k).catch(() => null); if (!b && /^personagens\//.test(k)) b = await Nuvem.baixar(k).catch(() => null); if (b) files.push({ name: 'arq/' + encodeURIComponent(k), data: new Uint8Array(await b.arrayBuffer()) }); }
      fim(); downloadBlob(Zip.create(files), safeName(`${def.nome} - vista ${v.nome}`) + this.EXT);
      UI.toast(`Vista <b>${esc(v.nome)}</b> baixada (${this.EXT}). Solte o arquivo no Ateliê para pôr ela num personagem.`, { kind: 'ok', time: 5000 });
    } catch (e) { fim(); UI.toast('Não consegui salvar a vista: ' + esc(e.message), { kind: 'err' }); }
  },
  async importar(f) {
    const def = Atelie.def; if (!def) return UI.toast('Abra um personagem no Ateliê para pôr a vista nele.', { kind: 'warn' });
    let m, d; try { m = Zip.read(await f.arrayBuffer()); d = JSON.parse(new TextDecoder().decode(m.get('vista.json'))); if (d?.tipo !== 'vistasatelie') throw 0; } catch { return UI.toast('Esse arquivo não é um .vistasatelie.', { kind: 'err' }); }
    const fim = Ocupado.inicio({ tipo: 'arquivo', icone: 'eye', titulo: `Pondo a vista ${d.vista?.nome || ''}`, subtitulo: 'Copiando as imagens…', aviso: 'Aguarde um instante.' });
    try {
      Modelo.garanteVistas(def); let txt = JSON.stringify(d.vista); const ks = [...m.keys()].filter(x => x.startsWith('arq/')); let i = 0;
      for (const nomeZ of ks) { Ocupado.parte(++i, ks.length); const k = decodeURIComponent(nomeZ.slice(4)), ext = (k.match(/\.(png|webp|jpe?g|gif)$/i) || [, 'png'])[1], k2 = `personagens/${def.id}/img/${uid('im').toLowerCase().replace(/[^a-z0-9]/g, '')}.${ext}`;
        await Arq.guardar(new Blob([m.get(nomeZ)], { type: ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/' + ext }), k2); Arq.img.delete(k2); txt = txt.split(JSON.stringify(k).slice(1, -1)).join(k2); }
      const v = JSON.parse(txt), n = PresetArq.nrm; let nome = v.nome || 'Vista'; const tem = x => def.vistas.some(y => n(y.nome) === n(x)); if (tem(nome)) { let k = 0; while (tem(`${v.nome} (${++k})`)); nome = `${v.nome} (${k})`; }
      def.vistas.push({ id: uid('vi'), nome, tipo: v.tipo || 'outra', partes: v.partes || [], sessoes: v.sessoes || [], animacoes: v.animacoes || [], raiz: v.raiz, vis: v.vis || undefined });
      fim(); Atelie.commit(); UI.toast(`Vista <b>${esc(nome)}</b> entrou no personagem (clique nela em Vistas para abrir). Ctrl+Z desfaz.`, { kind: 'ok', time: 6000 });
    } catch (e) { fim(); UI.toast('Não consegui pôr a vista: ' + esc(e.message), { kind: 'err' }); }
  },
};
