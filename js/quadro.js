/* ===================== quadro.js — ateliê: mudanças SÓ NUM KEYFRAME =====================
   Keyframe = o passo de uma animação de teste (pausada, ou mostrada pelo "Mostrar este passo") ou a pose de um quadro da
   timeline do Animador (aberta com "Editar no Ateliê"). Fora disso, nada muda: apagar e mudar a profundidade valem para tudo.
   • APAGAR (borracha, borracha mágica, apagar a seleção): em vez de mudar a imagem, guarda uma MÁSCARA recortada só da área apagada
     (PNG pequeno, do tamanho do que foi apagado) em `ap: { idDaImagem: { k, x, y } }` do passo, ou na chave do quadro no editor.
     Apagar de novo no mesmo keyframe junta com a máscara que já existe. Arq.comAp desenha a imagem com a máscara.
   • PROFUNDIDADE (camadas, [ e ]): pergunta "Só neste keyframe" (z no passo/chave) ou "Em todos" (o jeito de sempre).
   No editor, o quadro recebe pela mensagem 'quadro-partes' (BroadcastChannel 'animador'); a próxima chave volta como era. */
'use strict';
const Quadro = {
  // em que keyframe estamos (null = fora de keyframe: muda o personagem todo, como sempre)
  ctx(pid) {
    const A = Animacoes;
    if (A.poseFixa) return A.poseFixa.no && A.poseFixa.projeto ? { tipo: 'editor', sig: 'ed' + A.poseFixa.quadro } : null;
    if (A.tocando && A.pausado) { const a = A.achar(A.tocando); if (!a) return null; const L = A.passosAgora(a, A.i); if (!L.length) return null;
      const x = (pid && L.filter(y => y.p.p?.[pid]).pop()) || L[L.length - 1]; return { tipo: 'passo', p: x.p, sig: `${a.id}:${x.ti}:${x.pi}`, nome: `frame ${x.pi + 1} de "${a.nome}"` }; }
    if (A.passo && A.sel && Atelie.teste && !A.tocando) { const a = A.achar(A.sel), p = a?.trilhas?.[A.passo.t]?.[A.passo.i]; if (p) return { tipo: 'passo', p, sig: `${a.id}:${A.passo.t}:${A.passo.i}`, nome: `frame ${A.passo.i + 1} de "${a.nome}"` }; }
    return null;
  },
  nome(c) { return c?.tipo === 'editor' ? `quadro ${Animacoes.poseFixa.quadro + 1} da animação` : c?.nome || 'este keyframe'; },
  // grava valores de uma parte NESTE keyframe (passo ou pose do editor) e devolve o que mandar ao editor
  poe(c, pid, vals) {
    const junta = (e = {}) => { const n = { ...e }; if (vals.ap) n.ap = { ...(e.ap || {}), ...vals.ap }; if ('z' in vals) n.z = vals.z; return n; };
    if (c.tipo === 'passo') { c.p.p = c.p.p || {}; c.p.p[pid] = junta(c.p.p[pid]); }
    else { const F = Animacoes.poseFixa; F.partes = F.partes || {}; F.partes[pid] = junta(F.partes[pid]); }
    if (Atelie.teste) { Atelie.teste.partes = Atelie.teste.partes || {}; Atelie.teste.partes[pid] = junta(Atelie.teste.partes[pid]); }
  },
  avisaEditor(partes, apKey) {
    const F = Animacoes.poseFixa; if (!F?.projeto) return;
    if (apKey) { const d = Atelie.def; d.apKeys = [...new Set([...(d.apKeys || []), apKey])]; } // a máscara vai junto com o personagem (nuvem, backup)
    try { (Atelie._canal ||= new BroadcastChannel('animador')).postMessage({ tipo: 'quadro-partes', projeto: F.projeto, no: F.no, quadro: F.quadro, personagem: Atelie.def.id, partes, apKey }); } catch { }
  },

  /* ---------- APAGAR só neste keyframe ---------- */
  // a imagem como aparece neste keyframe (com o que já foi apagado aqui) — é dela que a borracha parte
  base(a) { return a.ap ? Arq.comAp(a.orig, { img: a.img, ap: a.ap }) : a.orig; },
  // antes = como estava na tela; depois = depois de apagar. A máscara é o quanto sumiu de cada pixel (só a área que mudou)
  // APAGAR NUM FRAME: pergunta "na imagem toda" ou "só neste frame" (com "não perguntar de novo" — vale só para esta pessoa, neste personagem;
  // fica no localStorage `animador-apagar-frame` { idDoPersonagem: 'tudo'|'frame' } e muda nas opções da borracha)
  prefApagar(v) { let m = {}; try { m = JSON.parse(localStorage.getItem('animador-apagar-frame') || '{}') || {}; } catch { } const id = Atelie.def?.id; if (v === undefined) return m[id] || null; if (v) m[id] = v; else delete m[id]; try { localStorage.setItem('animador-apagar-frame', JSON.stringify(m)); } catch { } return v; },
  async escolheApagar(a) {
    const p = this.prefApagar(); if (p) return p;
    const body = h(`<div>Você apagou com um <b>frame parado</b> (${esc(this.nome(a.quadro))}).<label class="pc-chk" style="margin-top:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" data-nao> Não perguntar de novo (só para você, neste personagem)</label><small style="display:block;color:var(--tx3);margin-top:4px">Dá para mudar depois nas opções da borracha.</small></div>`);
    const r = await UI.modal({ title: 'Apagar onde?', icon: 'eraser', width: 460, body, cancelValue: null, buttons: [{ label: 'Cancelar', value: null }, { label: 'Só neste frame', collect: x => ({ v: 'frame', nao: $('[data-nao]', x.body).checked }) }, { label: 'Na imagem toda', kind: 'primary', collect: x => ({ v: 'tudo', nao: $('[data-nao]', x.body).checked }) }] });
    if (!r) return null; if (r.nao) this.prefApagar(r.v); return r.v;
  },
  // "na imagem toda": o que sumiu na tela (antes − depois) sai da imagem de verdade (ou da camada ativa) — aparece em todo frame e preset
  async apagaNoTodo(a, antes, depois) {
    const W = antes.width, H = antes.height, m = document.createElement('canvas'); m.width = W; m.height = H; const mx = m.getContext('2d'); mx.drawImage(antes, 0, 0); mx.globalCompositeOperation = 'destination-out'; mx.drawImage(depois, 0, 0); // = só o que foi apagado
    const g = new OffscreenCanvas(a.bm.width, a.bm.height), gx = g.getContext('2d'); gx.drawImage(a.bm, 0, 0); gx.globalCompositeOperation = 'destination-out'; gx.drawImage(m, 0, 0, a.bm.width, a.bm.height);
    await Pintura.gravar(a.img, g); return true;
  },
  async gravaApagado(a, antes, depois) {
    const onde = await this.escolheApagar(a); if (!onde) return false; if (onde === 'tudo') return this.apagaNoTodo(a, antes, depois);
    const W = antes.width, H = antes.height, ca = document.createElement('canvas'); ca.width = W; ca.height = H; const xa = ca.getContext('2d', { willReadFrequently: true }); xa.drawImage(antes, 0, 0);
    const A = xa.getImageData(0, 0, W, H).data, cd = document.createElement('canvas'); cd.width = W; cd.height = H; const xd = cd.getContext('2d', { willReadFrequently: true }); xd.drawImage(depois, 0, 0); const D = xd.getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1; const m = new Uint8ClampedArray(W * H);
    for (let i = 0; i < W * H; i++) { const aa = A[i * 4 + 3]; if (!aa) continue; const v = Math.round(255 * Math.max(0, 1 - D[i * 4 + 3] / aa)); if (v < 3) continue; m[i] = v; const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return false;
    // junta com o que já estava apagado aqui (as duas máscaras somam: a = a1 + a2·(1 − a1))
    const velho = a.ap && Arq.img.get(a.ap.k); if (velho) { x0 = Math.min(x0, a.ap.x || 0); y0 = Math.min(y0, a.ap.y || 0); x1 = Math.max(x1, (a.ap.x || 0) + velho.width - 1); y1 = Math.max(y1, (a.ap.y || 0) + velho.height - 1); }
    x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W - 1, x1); y1 = Math.min(H - 1, y1); const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const mc = document.createElement('canvas'); mc.width = w; mc.height = h; const mx = mc.getContext('2d'), im = mx.createImageData(w, h), O = im.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = m[(y + y0) * W + x + x0]; if (!v) continue; const o = (y * w + x) * 4; O[o] = O[o + 1] = O[o + 2] = 255; O[o + 3] = v; }
    mx.putImageData(im, 0, 0); if (velho) { mx.globalCompositeOperation = 'destination-over'; mx.drawImage(velho, (a.ap.x || 0) - x0, (a.ap.y || 0) - y0); }
    const blob = await new Promise(r => mc.toBlob(r, 'image/png')), k = `personagens/${Atelie.def.id}/img/ap${uid('m').toLowerCase().replace(/[^a-z0-9]/g, '')}.png`;
    await Arq.guardar(blob, k); Arq.img.set(k, await createImageBitmap(blob));
    const ap = { [a.img.id]: { k, x: x0, y: y0 } }; this.poe(a.quadro, a.p.id, { ap }); if (a.quadro.tipo === 'editor') this.avisaEditor({ [a.p.id]: { ap } }, k);
    if (!this._avisou) { this._avisou = true; UI.toast(`Apagado só no <b>${esc(this.nome(a.quadro))}</b>. Fora de um keyframe, a borracha apaga a peça em tudo.`, { kind: 'ok', time: 6000 }); }
    return true;
  },
  // borracha/apagar num keyframe: troca o alvo para a imagem como aparece aqui (a original fica intacta)
  alvoApagar(a) { if (!a?.quadro) return a; const b = this.base(a); return { ...a, bm: b, cam: null, vivo: null, orig: a.orig, base: b }; },

  /* ---------- PROFUNDIDADE só neste keyframe ou em todos ---------- */
  async escolheZ(c) {
    if (this._z && this._z.sig === c.sig) return this._z.v;
    const r = await UI.modal({ title: 'Mudar a profundidade', icon: 'layers', width: 440, cancelValue: null,
      body: `<p style="margin:0 0 10px">Você está num keyframe (<b>${esc(this.nome(c))}</b>). A ordem das camadas muda só nele ou no personagem todo?</p><label class="chk"><input type="checkbox" data-lembra checked> Não perguntar de novo neste keyframe</label>`,
      buttons: [{ label: 'Cancelar', value: null, left: true }, { label: 'Em todos', collect: x => ({ v: 'todos', l: $('[data-lembra]', x.body).checked }) }, { label: 'Só neste keyframe', kind: 'primary', collect: x => ({ v: 'quadro', l: $('[data-lembra]', x.body).checked }) }] });
    if (!r) return null; if (r.l) this._z = { sig: c.sig, v: r.v }; return r.v;
  },
  // frenteParaTras: a ordem nova (sem a referência). Grava só o z de quem mudou, neste keyframe
  reordenar(c, frenteParaTras) {
    const est = Atelie.estado(), n = frenteParaTras.length, mand = {};
    frenteParaTras.forEach((p, i) => { const alvo = n - 1 - i, atual = (p.z || 0) + (est[p.id]?.z || 0); if (alvo !== atual) { const z = alvo - (p.z || 0); this.poe(c, p.id, { z }); mand[p.id] = { z }; } });
    if (c.tipo === 'editor' && Object.keys(mand).length) this.avisaEditor(mand);
    Atelie.commit();
  },
};
