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
