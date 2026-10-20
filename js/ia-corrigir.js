/* ===================== ia-corrigir.js — IA para corrigir erros do personagem + prévia ANTES / DEPOIS =====================
   Acha peças soltas (fora do corpo), pivôs fora da peça, cortes mal feitos (sujeira/bordas soltas na imagem) e giros
   fora do limite. Com a IA ligada, ela também olha um quadro e sugere ajustes. NADA é aplicado sem você ver os dois
   lados tocando e confirmar. */
'use strict';
const Compare = {
  // mostra dois projetos lado a lado (antes / depois) com play em cada um; resolve true se confirmar
  show({ title = 'Antes e depois', before, after, t0 = 0, t1 = 3, note = '', changes = [] }) {
    return new Promise(resolve => {
      const S = { t: t0, play: { a: false, b: false }, ta: t0, tb: t0 };
      const body = h(`<div class="cmp"><p class="cmp-n">${note}</p><div class="cmp-row">
        <div class="cmp-col"><b>Antes</b><canvas data-c="a"></canvas><div class="cmp-ctl"><button class="btn sm" data-p="a">▶ Tocar</button><input type="range" min="${t0}" max="${t1}" step="0.01" value="${t0}" data-s="a"></div></div>
        <div class="cmp-col"><b>Depois</b><canvas data-c="b"></canvas><div class="cmp-ctl"><button class="btn sm" data-p="b">▶ Tocar</button><input type="range" min="${t0}" max="${t1}" step="0.01" value="${t0}" data-s="b"></div></div></div>
        <div class="cmp-both"><button class="btn sm" data-p="ab">▶ Tocar os dois juntos</button></div>
        ${changes.length ? `<ul class="cmp-ch">${changes.slice(0, 14).map(c => `<li>${esc(c)}</li>`).join('')}${changes.length > 14 ? `<li>… e mais ${changes.length - 14}</li>` : ''}</ul>` : ''}</div>`);
      const P = { a: before, b: after }, cv = { a: $('[data-c=a]', body), b: $('[data-c=b]', body) }, sw = Math.min(300, innerHeight * .42 * before.settings.w / before.settings.h);
      const draw = async k => { const p = P[k], t = k === 'a' ? S.ta : S.tb, c = cv[k], q = sw / p.settings.w; try { await Renderer.prepare(p, t); Renderer.render(c, p, t, { q }); c.style.width = sw + 'px'; } catch (e) { console.warn(e); } };
      let raf = 0, last = 0;
      const loop = ts => { const dt = last ? (ts - last) / 1000 : 0; last = ts; let any = false; for (const k of ['a', 'b']) if (S.play[k]) { any = true; const key = k === 'a' ? 'ta' : 'tb'; S[key] += dt; if (S[key] > t1) S[key] = t0; $(`[data-s=${k}]`, body).value = S[key]; draw(k); } if (any) raf = requestAnimationFrame(loop); else { raf = 0; last = 0; } };
      const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
      const lbl = () => { for (const k of ['a', 'b']) $(`[data-p=${k}]`, body).textContent = S.play[k] ? '⏸ Pausar' : '▶ Tocar'; };
      $$('[data-p]', body).forEach(b => b.onclick = () => { const k = b.dataset.p; if (k === 'ab') { const on = !(S.play.a && S.play.b); S.play.a = S.play.b = on; S.ta = S.tb = Math.min(S.ta, S.tb); } else S.play[k] = !S.play[k]; lbl(); kick(); });
      $$('[data-s]', body).forEach(i => i.oninput = () => { const k = i.dataset.s; S[k === 'a' ? 'ta' : 'tb'] = +i.value; draw(k); });
      UI.modal({ title, icon: 'sparkles', width: 720, body, buttons: [{ label: 'Não aplicar', value: false }, { label: '✔ Aplicar o depois', kind: 'primary', value: true }], cancelValue: false, onOpen: () => { draw('a'); draw('b'); } })
        .then(v => { S.play.a = S.play.b = false; if (raf) cancelAnimationFrame(raf); resolve(!!v); });
    });
  },
};

const IAFix = {
  // projeto mínimo só com um clipe (para a prévia)
  mini(c, A) { const p = JSON.parse(JSON.stringify(App.project)); const cc = p.clips.find(x => x.id === c.id); cc.anim = { ...cc.anim, P: A, lib: undefined, rev: (cc.anim.rev || 0) + Math.random() }; delete p.animLib; return p; },
  bbox(dr) { return dr && dr.asset ? { x0: dr.ox, y0: dr.oy, x1: dr.ox + dr.w, y1: dr.oy + dr.h } : null; },
  // checagens locais (sem internet)
  local(A, O = { soltas: 1, pivos: 1 }) {
    const out = [], rig = A.rigs[0]; if (!rig) return out;
    for (const n of rig.nodes) {
      const dr = n.drawings.find(d => d.asset); if (!dr) continue; const b = this.bbox(dr);
      // pivô fora da própria peça → coloca na borda mais perto do pai
      const pm = Math.max(b.x1 - b.x0, b.y1 - b.y0) * .3;
      if (O.pivos && n.parent && (b.x0 > pm || b.x1 < -pm || b.y0 > pm || b.y1 < -pm)) {
        const nx = clamp(0, b.x0, b.x1), ny = clamp(0, b.y0, b.y1), dx = nx, dy = ny;
        n.px += dx; n.py += dy; for (const d of n.drawings) { d.ox -= dx; d.oy -= dy; } out.push(`Pivô de "${n.name}" estava fora da peça → foi para a borda dela`);
      }
      // peça solta: longe do pai (fora da peça mãe)
      const p = rig.nodes.find(x => x.id === n.parent), pd = p?.drawings.find(d => d.asset);
      if (O.soltas && p && pd) { // peça solta: a caixa dela não encosta na caixa do pai (com folga)
        const pb = { x0: p.px + pd.ox, y0: p.py + pd.oy, x1: p.px + pd.ox + pd.w, y1: p.py + pd.oy + pd.h }, nb = { x0: n.px + dr.ox, y0: n.py + dr.oy, x1: n.px + dr.ox + dr.w, y1: n.py + dr.oy + dr.h };
        const gx = Math.max(pb.x0 - nb.x1, nb.x0 - pb.x1, 0), gy = Math.max(pb.y0 - nb.y1, nb.y0 - pb.y1, 0), lim = Math.max(8, Math.min(Math.max(pd.w, pd.h), Math.max(dr.w, dr.h)) * .25);
        const boxOf = x => { const q = x.drawings.find(d => d.asset); return q && { x0: x.px + q.ox, y0: x.py + q.oy, x1: x.px + q.ox + q.w, y1: x.py + q.oy + q.h }; };
        const near = Math.min(...rig.nodes.filter(x => x !== n && x.parent !== n.id).map(boxOf).filter(Boolean).map(o => Math.hypot(Math.max(o.x0 - nb.x1, nb.x0 - o.x1, 0), Math.max(o.y0 - nb.y1, nb.y0 - o.y1, 0))));
        if (near > 0.5 && near <= lim && Math.hypot(gx, gy) <= lim * 2) { // espaço pequeno entre peças: estica um pouco para cobrir
          const k = 1 + Math.min(.25, (near + 4) / Math.max(dr.w, dr.h)); (rig.keys[n.id] ||= {}).sy ||= [{ f: 0, v: k, e: 'ease' }]; out.push(`Espaço entre "${n.name}" e a peça vizinha coberto (esticou ${Math.round((k - 1) * 100)}%)`);
        }
        if (near > lim && Math.hypot(gx, gy) > lim) { const dx = nb.x0 > pb.x1 ? pb.x1 - nb.x0 : nb.x1 < pb.x0 ? pb.x0 - nb.x1 : 0, dy = nb.y0 > pb.y1 ? pb.y1 - nb.y0 : nb.y1 < pb.y0 ? pb.y0 - nb.y1 : 0; const mv = x => { x.px += dx; x.py += dy; rig.nodes.filter(k => k.parent === x.id).forEach(mv); }; mv(n); out.push(`"${n.name}" estava solta, longe de "${p.name}" → encostada de volta`); }
      }
      // giros além do limite
      const rk = rig.keys[n.id]?.r; if (O.pivos && n.limit && rk) for (const k of rk) { const v = clamp(k.v, n.limit[0], n.limit[1]); if (v !== k.v) { k.v = v; out.push(`Giro de "${n.name}" passou do limite no quadro ${k.f + 1}`); } }
    }
    return out;
  },
  // corte mal feito: tira pontinhos soltos e a franja quase transparente da imagem da peça
  async cleanCut(dr) {
    const rt = Assets.get(dr.asset); if (!rt?.img) return false; const W = rt.img.naturalWidth, H = rt.img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(rt.img, 0, 0);
    const im = g.getImageData(0, 0, W, H), d = im.data, m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    const lab = new Int32Array(W * H), sizes = [0]; let n = 0; const st = [];
    for (let i = 0; i < W * H; i++) { if (!m[i] || lab[i]) continue; n++; let a = 0; st.push(i); lab[i] = n; while (st.length) { const q = st.pop(), x = q % W; a++; for (const r of [x > 0 ? q - 1 : -1, x < W - 1 ? q + 1 : -1, q - W, q + W]) if (r >= 0 && r < W * H && m[r] && !lab[r]) { lab[r] = n; st.push(r); } } sizes.push(a); }
    const big = Math.max(...sizes), min = big * .004; let changed = 0;
    for (let i = 0; i < W * H; i++) { const a = d[i * 4 + 3]; if ((lab[i] && sizes[lab[i]] < min) || (a > 0 && a <= 40)) { d[i * 4 + 3] = 0; changed++; } }
    if (changed < Math.max(40, W * H * .004)) return false; g.putImageData(im, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png')), nr = await Assets.addBlob(blob, (rt.meta.name || 'peça').replace(/\.png$/i, '') + ' (limpa).png', App.project.id, 'image'); App.project.bin.push(nr.meta.id); dr.asset = nr.meta.id; return true;
  },
  async ai(c, A, baseId, texto) {
    if (!(typeof AIClient !== 'undefined' && AIClient.ready)) return [];
    const rig = A.rigs[0], f = RigEdit.frame(c), cv = document.createElement('canvas'); cv.width = 600; cv.height = Math.round(600 * A.settings.h / A.settings.w); const g = cv.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, cv.width, cv.height); g.scale(600 / A.settings.w, 600 / A.settings.w); AnimRender.frame(g, A, f, { transparent: true });
    const list = rig.nodes.map(n => `${n.name} (pai: ${rig.nodes.find(x => x.id === n.parent)?.name || '-'})`).join('; ');
    const content = [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: cv.toDataURL('image/jpeg', .85).split(',')[1] } }];
    const brt = baseId && Assets.get(baseId); if (brt?.img) { const bc = document.createElement('canvas'), kk = 600 / brt.img.naturalWidth; bc.width = 600; bc.height = brt.img.naturalHeight * kk; const bg = bc.getContext('2d'); bg.fillStyle = '#888'; bg.fillRect(0, 0, bc.width, bc.height); bg.drawImage(brt.img, 0, 0, bc.width, bc.height); content.push({ type: 'text', text: 'Esta é a IMAGEM DE BASE (como o personagem deve ficar):' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: bc.toDataURL('image/jpeg', .85).split(',')[1] } }); }
    const j = await AIClient.call([{ role: 'user', content: [...content, { type: 'text', text: `A primeira imagem é o personagem montado em peças com ossos. Partes: ${list}. Procure ERROS: peça fora do lugar/solta, buraco entre peças, peça na frente errada. Responda SÓ JSON: {"correcoes":[{"parte":"nome","acao":"mover|frente|tras|esticar","dx":px,"dy":px,"escala":1.0,"motivo":"curto"}]} (px no tamanho original do personagem ${A.settings.w}x${A.settings.h}). Compare com a base quando houver.${texto ? ' PEDIDO DA PESSOA (prioridade): ' + texto : ''} Lista vazia se estiver tudo certo.` }] }], 'Você revisa rigs de personagens 2D. Só JSON.');
    const t = (j.content || []).map(x => x.text || '').join(''), o = JSON.parse(t.match(/\{[\s\S]*\}/)?.[0] || '{"correcoes":[]}'), out = [];
    for (const k of o.correcoes || []) { const n = rig.nodes.find(x => x.name.toLowerCase() === String(k.parte || '').toLowerCase()) || rig.nodes.find(x => x.name.toLowerCase().includes(String(k.parte || '').toLowerCase())); if (!n) continue;
      if (k.acao === 'mover') { n.px += +k.dx || 0; n.py += +k.dy || 0; } else if (k.acao === 'frente') n.z = Math.max(...rig.nodes.map(x => x.z)) + 1; else if (k.acao === 'tras') n.z = Math.min(...rig.nodes.map(x => x.z)) - 1; else if (k.acao === 'esticar') for (const ks of [rig.keys[n.id] ||= {}]) ks.sy = [{ f: 0, v: +k.escala || 1.05, e: 'ease' }];
      out.push(`🤖 ${n.name}: ${k.motivo || k.acao}`); }
    return out;
  },
  // o que corrigir + imagem de base (o desenho inteiro original ajuda muito)
  async options(c) {
    const imgs = (App.project.bin || []).map(id => Assets.meta(id)).filter(m => m?.kind === 'image').slice(-60).reverse();
    const guess = c.png?.assetId || this._base || '';
    const body = h(`<div class="fx-op">
      ${[['soltas', 'Peças soltas e espaços entre as peças (encosta e cobre o buraco)', 1], ['cortes', 'Cortes mal feitos: apagar sobras, pontinhos e bordas soltas', 1], ['buracos', 'Fechar partes abertas (buraquinhos dentro das peças)', 1], ['cores', 'Corrigir as cores para ficarem iguais (usa a imagem de base)', 1], ['pivos', 'Pivôs fora do lugar e giros além do limite', 1], ['ia', 'Pedir também para a IA olhar (compara com a base)', typeof AIClient !== 'undefined' && AIClient.ready ? 1 : 0]].map(([k, l, on]) => `<label class="switch"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''} ${k === 'ia' && !(typeof AIClient !== 'undefined' && AIClient.ready) ? 'disabled' : ''}><i></i>${l}</label>`).join('')}
      <label class="fx-txt"><b>✍️ O que corrigir (escreva com suas palavras)</b><textarea rows="2" placeholder="Ex.: o braço esquerdo está separado do ombro; a boca está torta; deixa o cabelo na frente da orelha"></textarea><small>Vai para a IA junto com as imagens.</small></label>
      <div class="fx-base"><b>🖼️ Imagem de base</b> <small>(o personagem inteiro, como deve ficar)</small><select data-b><option value="">— sem base —</option>${imgs.map(m => `<option value="${m.id}" ${m.id === guess ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select><button class="btn sm" data-f>Escolher arquivo…</button></div></div>`);
    $('[data-f]', body).onclick = async () => { const f = await pickFiles('image/*', false); if (!f[0]) return; const rt = await Assets.addBlob(f[0], f[0].name, App.project.id, 'image'); App.project.bin.push(rt.meta.id); await new Promise(r => setTimeout(r, 300)); const sel = $('[data-b]', body); sel.add(new Option(f[0].name, rt.meta.id)); sel.value = rt.meta.id; };
    const ok = await UI.modal({ title: '🩺 Corrigir o personagem', icon: 'sparkles', width: 560, body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Procurar erros', kind: 'primary', value: true }] }); if (!ok) return null;
    const o = { base: $('[data-b]', body).value || null, texto: $('textarea', body).value.trim() }; if (o.texto) o.ia = true; $$('[data-k]', body).forEach(i => o[i.dataset.k] = i.checked); this._base = o.base; return o;
  },
  // fecha buraquinhos dentro da peça (transparência cercada) com a cor de volta
  async fillHoles(dr) {
    const rt = Assets.get(dr.asset); if (!rt?.img) return false; const W = rt.img.naturalWidth, H = rt.img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(rt.img, 0, 0);
    const im = g.getImageData(0, 0, W, H), d = im.data, out = new Uint8Array(W * H), st = []; for (let x = 0; x < W; x++) st.push(x, (H - 1) * W + x); for (let y = 0; y < H; y++) st.push(y * W, y * W + W - 1);
    while (st.length) { const i = st.pop(); if (out[i] || d[i * 4 + 3] > 60) continue; out[i] = 1; const x = i % W; if (x) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (i >= W) st.push(i - W); if (i < W * H - W) st.push(i + W); }
    let hole = []; for (let i = 0; i < W * H; i++) if (!out[i] && d[i * 4 + 3] <= 60) hole.push(i);
    if (!hole.length || hole.length > W * H * .03) return false;
    for (let pass = 0; pass < 60 && hole.length; pass++) { const left = []; for (const i of hole) { const x = i % W; let r = 0, gg = 0, b = 0, n = 0; for (const j of [x ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < W * H && d[j * 4 + 3] > 60) { r += d[j * 4]; gg += d[j * 4 + 1]; b += d[j * 4 + 2]; n++; } if (n) { d[i * 4] = r / n; d[i * 4 + 1] = gg / n; d[i * 4 + 2] = b / n; d[i * 4 + 3] = 255; } else left.push(i); } hole = left; }
    g.putImageData(im, 0, 0); return this.store(c, dr, 'fechada');
  },
  palette(id) { const rt = Assets.get(id); if (!rt?.img) return null; const k = Math.min(1, 500 / Math.max(rt.img.naturalWidth, rt.img.naturalHeight)), c = document.createElement('canvas'); c.width = rt.img.naturalWidth * k; c.height = rt.img.naturalHeight * k; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(rt.img, 0, 0, c.width, c.height); const d = g.getImageData(0, 0, c.width, c.height).data, cnt = new Map();
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 220) continue; const key = (d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | d[i + 2] >> 3; cnt.set(key, (cnt.get(key) || 0) + 1); }
    return [...cnt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([q]) => [((q >> 10) & 31) * 8 + 4, ((q >> 5) & 31) * 8 + 4, (q & 31) * 8 + 4]); },
  // cores "quase iguais" viram exatamente as cores da base
  async matchColors(dr, pal) {
    const rt = Assets.get(dr.asset); if (!rt?.img || !pal?.length) return false; const W = rt.img.naturalWidth, H = rt.img.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(rt.img, 0, 0);
    const im = g.getImageData(0, 0, W, H), d = im.data, cache = new Map(); let ch = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; const key = d[i] << 16 | d[i + 1] << 8 | d[i + 2]; let best = cache.get(key); if (best === undefined) { let bd = 1e9; best = null; for (const p of pal) { const dd = Math.abs(p[0] - d[i]) + Math.abs(p[1] - d[i + 1]) + Math.abs(p[2] - d[i + 2]); if (dd < bd) { bd = dd; best = p; } } if (bd > 70 || bd < 6) best = null; cache.set(key, best); } if (best) { d[i] = best[0]; d[i + 1] = best[1]; d[i + 2] = best[2]; ch++; } }
    if (ch < W * H * .01) return false; g.putImageData(im, 0, 0); return this.store(c, dr, 'cores');
  },
  async store(c, dr, tag) { const rt = Assets.get(dr.asset), blob = await new Promise(r => c.toBlob(r, 'image/png')), nr = await Assets.addBlob(blob, (rt?.meta?.name || 'peça').replace(/\.png$/i, '') + ` (${tag}).png`, App.project.id, 'image'); App.project.bin.push(nr.meta.id); dr.asset = nr.meta.id; return true; },
  async run(c) {
    const A0 = RigEdit.A(c); if (!A0) return UI.toast('Selecione um personagem', { kind: 'warn' });
    const O = await this.options(c); if (!O) return; this.O = O;
    const A = JSON.parse(JSON.stringify(A0)); A.rev = (A.rev || 0) + 1;
    const b = UI.busy('🩺 Procurando erros…', '<div class="spinner"></div><p style="text-align:center">Peças soltas, pivôs, cortes mal feitos e giros</p>');
    let ch = [];
    try {
      ch.push(...this.local(A, O));
      const pal = O.cores && O.base ? this.palette(O.base) : null;
      for (const n of A.rigs[0].nodes) for (const d of n.drawings) { if (!d.asset) continue;
        if (O.cortes && await this.cleanCut(d)) ch.push(`Corte de "${n.name}" limpo (sobras e bordas soltas)`);
        if (O.buracos && await this.fillHoles(d)) ch.push(`Buracos fechados em "${n.name}"`);
        if (pal && await this.matchColors(d, pal)) ch.push(`Cores de "${n.name}" iguais às da base`); }
      if (O.cores && !O.base) ch.push('(Cores: escolha uma imagem de base para corrigir as cores)');
      if (O.ia) try { if (!(typeof AIClient !== 'undefined' && AIClient.ready)) ch.push('(A IA não está ligada: o pedido escrito não foi feito)'); else ch.push(...await this.ai(c, A, O.base, O.texto)); } catch (e) { console.warn(e); }
      if (ch.length === 1 && ch[0].startsWith('(')) ch = [];
    } finally { b.close(); }
    if (!ch.length) return UI.toast('Não achei erros neste personagem 👍', { kind: 'ok', time: 2500 });
    const ok = await Compare.show({ title: '🩺 Correções do personagem', before: this.mini(c, A0), after: this.mini(c, A), t0: c.start, t1: c.start + Math.min(c.dur, 6), note: 'Toque os dois e veja se ficou melhor antes de aplicar.', changes: ch });
    if (!ok) return;
    if (c.anim.P) c.anim.P = A; else App.project.animLib[c.anim.lib] = A; RigEdit.touch(c); App.commit(`Correções: ${ch.length}`, { toast: true }); Props.render();
  },
};
