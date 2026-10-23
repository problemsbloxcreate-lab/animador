/* ===================== vetored.js — ateliê: telas do VETOR (SVG) =====================
   • Converter PNG/JPG → SVG (imagem, parte ou personagem inteiro), com antes/depois e zoom; e SVG → PNG.
   • Painel "Camadas do vetor" (no lugar das camadas de pixels): Linha e Cor são camadas separadas — a borracha apaga
     só a camada escolhida (apagar a linha deixa a cor), o balde pinta na camada de cor a área fechada pelas linhas.
   • Ferramenta PONTOS (A): mexer nos pontos e alças das curvas, Alt+clique / Delete tira o ponto, dois cliques na borda põe um ponto.
   As ferramentas ficam roxas quando a imagem escolhida é SVG (a mesma cor do selo SVG). */
'use strict';
const VetorUI = {
  /* ---------- converter ---------- */
  // lista = [{ p, img }]; converte as que não são SVG
  async converter(lista) {
    lista = lista.filter(x => x.img && !Vetor.eh(x.img.k)); if (!lista.length) return UI.toast('Já está tudo em SVG.', { kind: 'ok' });
    const um = lista[0], body = h(`<div class="vt-conv"><div class="vt-cmp"><figure><figcaption>Antes · ${esc(Vetor.tipo(um.img.k) || 'PNG')}</figcaption><canvas data-a width="300" height="300"></canvas></figure><figure><figcaption>Depois · <span class="selo-tipo svg">SVG</span></figcaption><canvas data-d width="300" height="300"></canvas></figure></div>
      <div class="vt-ctl"><label class="aj-l"><span>Zoom</span><input type="range" min="1" max="8" step=".5" value="1" data-z><output>1×</output></label><span class="vt-dica">clique na imagem para escolher o ponto do zoom</span></div>
      <label class="chk"><input type="checkbox" data-limpa checked> Limpar o recorte (frestas brancas entre as partes e fiapos soltos do traço)</label>
      <div class="vt-info"><span class="spin-dot"></span> Convertendo "${esc(um.img.nome)}" para mostrar…</div></div>`);
    const ca = $('[data-a]', body), cd = $('[data-d]', body); let orig = null, svgIm = null, z = 1, cx = .5, cy = .5;
    const pinta = () => { for (const [cv, im] of [[ca, orig], [cd, svgIm]]) { const x = cv.getContext('2d'); x.fillStyle = '#2a2a2a'; x.fillRect(0, 0, 300, 300); if (!im) continue; const W = im.width, H = im.height, k = Math.min(300 / W, 300 / H) * z;
      x.save(); x.imageSmoothingQuality = 'high'; x.drawImage(im, 150 - cx * W * k, 150 - cy * H * k, W * k, H * k); x.restore(); } };
    $('[data-z]', body).oninput = ev => { z = +ev.target.value; ev.target.nextElementSibling.textContent = z + '×'; pinta(); };
    for (const cv of [ca, cd]) cv.onclick = ev => { if (!orig) return; const r = cv.getBoundingClientRect(), W = orig.width, H = orig.height, k = Math.min(300 / W, 300 / H) * z; cx = clamp(cx + ((ev.clientX - r.left) / r.width * 300 - 150) / (W * k), 0, 1); cy = clamp(cy + ((ev.clientY - r.top) / r.height * 300 - 150) / (H * k), 0, 1); if (z < 2) { z = 3; $('[data-z]', body).value = 3; $('[data-z]', body).nextElementSibling.textContent = '3×'; } pinta(); };
    const prev = async () => { try { const b = await Arq.pegaBlob(um.img.k) || await Nuvem.baixar(um.img.k); orig = await createImageBitmap(b); pinta(); await cede();
        const { D, W, H } = await Vetor.pixelsDe(um.img.k), t0 = performance.now(), m = Vetor.dePixels(D, W, H, { limpa: $('[data-limpa]', body).checked }); delete m.cores; const txt = Vetor.svg(m);
        svgIm = await Vetor.imagem(new Blob([txt], { type: 'image/svg+xml' })); pinta();
        $('.vt-info', body).innerHTML = `${lista.length > 1 ? `Esta é a 1ª de <b>${lista.length}</b> imagens. ` : ''}Duas camadas separadas: <b>Linha</b> e <b>Cor</b> (${m.cam[0].f.length} cores). ${Arquivos.fmt(b.size)} → ${Arquivos.fmt(txt.length)}. O ${esc(Vetor.tipo(um.img.k) || 'PNG')} de antes fica guardado: dá para voltar (botão direito na imagem › Converter para PNG).`;
      } catch (e) { $('.vt-info', body).textContent = 'Não consegui converter: ' + e.message; } };
    $('[data-limpa]', body).onchange = () => { $('.vt-info', body).innerHTML = '<span class="spin-dot"></span> Convertendo de novo…'; prev(); };
    setTimeout(prev, 30);
    const ok = await UI.modal({ title: 'Converter para SVG (vetor)', icon: 'nodes', width: 680, body, buttons: [{ label: 'Cancelar', value: false }, { label: lista.length > 1 ? `Converter ${lista.length} imagens` : 'Converter', kind: 'primary', value: true }] });
    if (!ok) return; const limpa = $('[data-limpa]', body).checked, fim = Ocupado.inicio({ tipo: 'arquivo', icone: 'nodes', titulo: 'Convertendo para SVG', subtitulo: 'Desenhando as curvas de cada imagem…' }); let n = 0, erros = 0;
    try { for (const [i, x] of lista.entries()) { Ocupado.parte(i, lista.length); Ocupado.passo?.(`"${x.img.nome}" (${i + 1} de ${lista.length})`); await cede(); try { await Vetor.converteImg(x.img, { limpa }); x.img.vConv = x.img.k; n++; } catch (e) { console.warn(e); erros++; } } }
    finally { fim?.(); }
    if (n) Atelie.commit(); UI.toast(n ? `${n} imagem(ns) agora em SVG${erros ? ` (${erros} não deram)` : ''}. Ctrl+Z desfaz.` : 'Nenhuma imagem foi convertida.', { kind: n ? 'ok' : 'warn' });
  },
  async paraPng(img) {
    const volta = img.dePng && img.vConv === img.k && await Arq.pegaBlob(img.dePng);
    if (volta) { Arq.img.delete(img.dePng); await Arq.garantir([img.dePng]); img.k = img.dePng; } else await Vetor.paraPng(img);
    delete img.vConv; Atelie.commit(); UI.toast(volta ? 'Voltou para o PNG original (sem nenhuma perda).' : 'Virou PNG (as mudanças feitas no vetor foram junto). Ctrl+Z desfaz.', { kind: 'ok' });
  },
  // itens de menu (imagem e parte)
  itemImg(p, img) { return Vetor.eh(img.k) ? { label: 'Converter para PNG', icon: 'image', action: () => this.paraPng(img) } : { label: 'Converter para SVG (vetor)…', icon: 'nodes', action: () => this.converter([{ p, img }]) }; },
  itemPartes(lista) { const it = lista.flatMap(p => p.imgs.map(img => ({ p, img }))), falta = it.filter(x => !Vetor.eh(x.img.k)).length; return falta ? { label: `Converter ${lista.length > 1 ? 'as partes' : 'a parte'} para SVG (${falta} imagem${falta > 1 ? 'ns' : ''})…`, icon: 'nodes', action: () => this.converter(it) } : null; },
  tudo() { const d = Atelie.def; if (!d) return; this.converter(d.partes.filter(p => !Referencia.ehRef(p)).flatMap(p => p.imgs.map(img => ({ p, img })))); },

  /* ---------- painel das camadas do vetor ---------- */
  async painel(el, a) {
    const img = a.img, box = h(`<div class="sessao cam-sec vt-cam"><h4>${ic('layers', 13)} Camadas <span class="selo-tipo svg" title="Imagem em vetor">SVG</span></h4><div class="cam-lista"><div class="vazio"><span class="spin-dot"></span></div></div></div>`); el.appendChild(box);
    let m; try { m = await Vetor.modelo(img.k); } catch (e) { $('.cam-lista', box).innerHTML = `<div class="vazio">${esc(e.message)}</div>`; return; }
    const at = Vetor.ativa(m, img), lista = $('.cam-lista', box); lista.innerHTML = '';
    const grava = async muda => { const mm = await Vetor.modelo(img.k); if (muda(mm) === false) return; await Vetor.gravar(img, mm); Atelie.commit(); };
    [...m.cam].reverse().forEach(c => {
      const r = h(`<div class="cam-l ${c === at ? 'on' : ''}" title="Clique: pincel e borracha mexem nesta camada · duplo clique: renomear · botão direito: mais"><button class="ibtn" data-v title="Mostrar/esconder">${ic(c.vis === false ? 'eyeOff' : 'eye', 13)}</button><span class="vt-papel ${c.papel}" title="${c.papel === 'linha' ? 'Camada de LINHA (o balde não pinta aqui; ela separa as áreas)' : 'Camada de COR (o balde pinta aqui)'}">${ic(c.papel === 'linha' ? 'pencil' : 'bucket', 13)}</span><span class="nm">${esc(c.nome)}</span><small>${c.f.length}${c.m.length ? ` · ${c.m.length} apag.` : ''}</small></div>`);
      r.onclick = ev => { if (ev.target.closest('[data-v]')) return grava(mm => { const k = mm.cam.find(x => x.id === c.id); k.vis = k.vis === false ? undefined : false; }); img.vCam = c.id; Atelie.commit(); };
      r.ondblclick = async () => { const n = (await UI.prompt({ title: 'Nome da camada', value: c.nome }))?.trim(); if (n) grava(mm => { mm.cam.find(x => x.id === c.id).nome = n.slice(0, 40); }); };
      r.oncontextmenu = ev => { ev.preventDefault(); const i = m.cam.indexOf(c); UI.ctx(ev.clientX, ev.clientY, [{ head: c.nome },
        { label: 'É camada de linha', icon: 'pencil', checked: c.papel === 'linha', action: () => grava(mm => { mm.cam.find(x => x.id === c.id).papel = 'linha'; }) },
        { label: 'É camada de cor (balde)', icon: 'bucket', checked: c.papel !== 'linha', action: () => grava(mm => { mm.cam.find(x => x.id === c.id).papel = 'cor'; }) }, '-',
        { label: 'Subir', icon: 'up', disabled: i >= m.cam.length - 1, action: () => grava(mm => { const j = mm.cam.findIndex(x => x.id === c.id); mm.cam.splice(j + 1, 0, ...mm.cam.splice(j, 1)); }) },
        { label: 'Descer', icon: 'down', disabled: i < 1, action: () => grava(mm => { const j = mm.cam.findIndex(x => x.id === c.id); mm.cam.splice(j - 1, 0, ...mm.cam.splice(j, 1)); }) },
        { label: 'Duplicar', icon: 'dup', action: () => grava(mm => { const k = clone(mm.cam.find(x => x.id === c.id)); k.id = uid('c'); k.nome += ' (cópia)'; mm.cam.splice(mm.cam.findIndex(x => x.id === c.id) + 1, 0, k); }) },
        { label: 'Desfazer o que a borracha apagou', icon: 'undo', disabled: !c.m.length, action: () => grava(mm => { mm.cam.find(x => x.id === c.id).m = []; }) },
        { label: 'Transformar (tamanho, giro, espelhar)…', icon: 'move', action: () => { img.vCam = c.id; Ajustes.transformar(); } }, { label: 'Ajustes de cor…', icon: 'palette', action: () => { img.vCam = c.id; Ajustes.abrir(); } },
        '-', { label: 'Apagar camada', icon: 'trash', danger: true, disabled: m.cam.length < 2, action: () => grava(mm => { mm.cam = mm.cam.filter(x => x.id !== c.id); }) }]); };
      lista.appendChild(r); });
    const op = h(`<div class="cam-op"><span style="color:var(--tx3);font-size:11.5px">Opacidade</span><input type="range" min="0" max="100" value="${Math.round((at.op ?? 1) * 100)}" data-o><output>${Math.round((at.op ?? 1) * 100)}%</output></div>`);
    $('[data-o]', op).oninput = ev => { $('output', op).textContent = ev.target.value + '%'; }; $('[data-o]', op).onchange = ev => grava(mm => { const k = mm.cam.find(x => x.id === at.id); k.op = +ev.target.value / 100; if (k.op >= 1) delete k.op; });
    box.appendChild(op);
    const bar = h(`<div class="cam-bar"><button class="btn sm" data-n title="Camada vazia por cima da escolhida">${ic('plus', 12)} Camada</button><button class="btn sm" data-png title="Volta a ser imagem de pixels">${ic('image', 12)} Converter para PNG</button></div>`);
    $('[data-n]', bar).onclick = () => grava(mm => { const id = uid('c'); mm.cam.splice(mm.cam.findIndex(x => x.id === at.id) + 1, 0, { id, nome: 'Camada ' + (mm.cam.length + 1), papel: 'linha', f: [], m: [] }); img.vCam = id; });
    $('[data-png]', bar).onclick = () => this.paraPng(img);
    box.appendChild(bar);
    box.appendChild(h(`<div class="vt-dica">Pincel e borracha mexem só na camada escolhida: apagar a <b>Linha</b> deixa a <b>Cor</b> por baixo. O balde pinta a área fechada pelas linhas. <b>A</b> = mexer nos pontos.</div>`));
  },

  /* ---------- ferramentas no palco quando a imagem é SVG ---------- */
  // devolve true quando cuidou do clique
  desce(e, a, pt) {
    const f = Pintura.ferr;
    if (f === 'pontos') { this.nosDesce(e, a); return true; }
    if (f === 'balde' || f === 'magica') { (async () => { const ok = f === 'balde' ? await Vetor.balde(a, pt, Pintura.cor, Pintura.mascara(a)) : await Vetor.magica(a, pt, Pintura.mascara(a)); if (ok) Atelie.commit(); })(); return true; }
    if (f === 'camada') { this.moverCamada(e, a, pt); return true; }
    return false;
  },
  async moverCamada(e, a, pt) {
    const cv0 = Atelie.cv; try { cv0.setPointerCapture(e.pointerId); } catch { } const sp = Vetor.separadas(a.img), k0 = a.img.k, orig = a.orig; let d = { x: 0, y: 0 }, acabou = false;
    const mostra = () => { const s = sp.v; if (!s) return; const W = s.ativa.width, H = s.ativa.height, cv = new OffscreenCanvas(W, H), x = cv.getContext('2d'); x.drawImage(s.abaixo, 0, 0); x.drawImage(s.ativa, d.x, d.y); x.drawImage(s.acima, 0, 0); Arq.img.set(k0, cv); Atelie.desenha(); };
    const mov = ev => { if (acabou) return; const q = a.para(Atelie.mundo(ev)); d = { x: q.x - pt.x, y: q.y - pt.y }; if (ev.shiftKey) { if (Math.abs(d.x) > Math.abs(d.y)) d.y = 0; else d.x = 0; } mostra(); };
    const up = async () => { if (acabou) return; acabou = true; for (const [t, fn] of [['pointermove', mov], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) cv0.removeEventListener(t, fn);
      if (Math.abs(d.x) + Math.abs(d.y) < .5) { Arq.img.set(k0, orig); return Atelie.desenha(); } try { await Vetor.moverCamada(a, d.x, d.y); } finally { Arq.img.set(k0, orig); } Atelie.commit(); };
    for (const [t, fn] of [['pointermove', mov], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) cv0.addEventListener(t, fn);
  },

  /* ---------- PONTOS: editar as curvas ---------- */
  nos: null, // { k, cam, i (forma), sub, pt (ponto escolhido), d (subcaminhos editados) }
  // "M x y C … Z" → [{ fechado, p: [{ x, y, hi, ho }] }] (hi = alça que chega, ho = alça que sai)
  parse(d) {
    const tk = d.match(/[MCLZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) || [], S = []; let i = 0, cur = null, cmd = '';
    const n = () => +tk[i++]; while (i < tk.length) { if (/[MCLZ]/i.test(tk[i])) cmd = tk[i++].toUpperCase();
      if (cmd === 'M') { cur = { fechado: false, p: [{ x: n(), y: n() }] }; S.push(cur); cmd = 'L'; }
      else if (cmd === 'C') { const a = { x: n(), y: n() }, b = { x: n(), y: n() }, c = { x: n(), y: n() }; const u = cur.p[cur.p.length - 1]; u.ho = a; cur.p.push({ x: c.x, y: c.y, hi: b }); }
      else if (cmd === 'L') { const c = { x: n(), y: n() }, u = cur.p[cur.p.length - 1]; u.ho = { x: u.x, y: u.y }; cur.p.push({ x: c.x, y: c.y, hi: { ...c } }); }
      else if (cmd === 'Z') { cur.fechado = true; const f = cur.p[0], l = cur.p[cur.p.length - 1]; if (cur.p.length > 1 && Math.hypot(f.x - l.x, f.y - l.y) < 1e-3) { f.hi = l.hi; cur.p.pop(); } else { l.ho = l.ho || { x: l.x, y: l.y }; f.hi = f.hi || { x: f.x, y: f.y }; } }
      else i++; }
    for (const s of S) for (const p of s.p) { p.hi = p.hi || { x: p.x, y: p.y }; p.ho = p.ho || { x: p.x, y: p.y }; } return S;
  },
  junta(S) { const f = v => String(Math.round(v * 100) / 100); return S.map(s => { const P = s.p, n = P.length; if (!n) return ''; let d = `M${f(P[0].x)} ${f(P[0].y)}`; const lim = s.fechado ? n : n - 1;
    for (let i = 0; i < lim; i++) { const a = P[i], b = P[(i + 1) % n]; d += `C${f(a.ho.x)} ${f(a.ho.y)} ${f(b.hi.x)} ${f(b.hi.y)} ${f(b.x)} ${f(b.y)}`; } return d + (s.fechado ? 'Z' : ''); }).join(''); },
  // matriz espaço-da-camada → tela (px do canvas)
  matriz(a, m, c) { const o = m.off || { x: 0, y: 0 }; let T = Atelie.V().multiply(a.mImg).translate(-o.x, -o.y); if (c.tr) T = T.multiply(new DOMMatrix(c.tr)); return T; },
  async nosDesce(e, a) {
    const img = a.img, m = await Vetor.modelo(img.k), d = devicePixelRatio || 1, r = Atelie.cv.getBoundingClientRect(), sx = (e.clientX - r.left) * d, sy = (e.clientY - r.top) * d;
    let N = this.nos && this.nos.k === img.k ? this.nos : null;
    // 1) clicou num ponto/alça da forma escolhida?
    if (N) { const c = m.cam.find(x => x.id === N.cam), T = this.matriz(a, m, c), tela = q => T.transformPoint(new DOMPoint(q.x, q.y)), perto = q => { const s = tela(q); return Math.hypot(s.x - sx, s.y - sy) < 8 * d; };
      let hit = null; const sp = N.sel; if (sp) { const P = N.S[sp.s].p[sp.i]; if (perto(P.hi) && Math.hypot(P.hi.x - P.x, P.hi.y - P.y) > .01) hit = { ...sp, h: 'hi' }; else if (perto(P.ho) && Math.hypot(P.ho.x - P.x, P.ho.y - P.y) > .01) hit = { ...sp, h: 'ho' }; }
      if (!hit) N.S.forEach((s, si) => s.p.forEach((p, i) => { if (!hit && perto(p)) hit = { s: si, i }; }));
      if (hit) { if (e.altKey && !hit.h) { this.tiraPonto(a, hit); return; } N.sel = { s: hit.s, i: hit.i }; Atelie.desenha(); return this.arrasta(e, a, m, c, T, hit); } }
    // 2) escolhe a forma clicada (da camada escolhida primeiro; depois as outras, de cima para baixo)
    const ctx = new OffscreenCanvas(1, 1).getContext('2d'), at = Vetor.ativa(m, img), ordem = [at, ...[...m.cam].reverse().filter(c => c !== at)].filter(c => c && c.vis !== false);
    for (const c of ordem) { const inv = this.matriz(a, m, c).inverse(), q = inv.transformPoint(new DOMPoint(sx, sy));
      for (let i = c.f.length - 1; i >= 0; i--) { const f = c.f[i], P2 = new Path2D(f.d); if (f.s) { ctx.lineWidth = Math.max(f.s, 6 / Math.hypot(this.matriz(a, m, c).a, this.matriz(a, m, c).b)); ctx.lineCap = ctx.lineJoin = 'round'; } if (f.s ? ctx.isPointInStroke(P2, q.x, q.y) : ctx.isPointInPath(P2, q.x, q.y, f.r ? 'evenodd' : 'nonzero')) {
        if (c !== at) img.vCam = c.id; this.nos = { k: img.k, cam: c.id, i, S: this.parse(f.d), cor: f.c || '#000000', s: f.s, sel: null }; Atelie.pinta(); return; } } }
    this.nos = null; Atelie.desenha(); if (m.cam.some(c => c.raw)) UI.toast('Os desenhos que vieram de um arquivo .svg (camada Arte) ainda não mexem ponto a ponto: a borracha, o pincel, o balde e os ajustes funcionam neles.', { kind: 'warn', time: 6000 });
  },
  arrasta(e, a, m, c, T, hit) {
    const N = this.nos, inv = T.inverse(), d = devicePixelRatio || 1, cv0 = Atelie.cv; try { cv0.setPointerCapture(e.pointerId); } catch { } const r = cv0.getBoundingClientRect(), loc = ev => inv.transformPoint(new DOMPoint((ev.clientX - r.left) * d, (ev.clientY - r.top) * d));
    const q0 = loc(e), P = N.S[hit.s].p[hit.i], ini = clone(P); let mexeu = false, acabou = false;
    const mov = ev => { if (acabou) return; const q = loc(ev), dx = q.x - q0.x, dy = q.y - q0.y; mexeu = true;
      if (hit.h) { P[hit.h] = { x: ini[hit.h].x + dx, y: ini[hit.h].y + dy }; if (!ev.altKey) { const o = hit.h === 'hi' ? 'ho' : 'hi', L = Math.hypot(ini[o].x - ini.x, ini[o].y - ini.y), vx = P.x - P[hit.h].x, vy = P.y - P[hit.h].y, l = Math.hypot(vx, vy) || 1; if (L > .01) P[o] = { x: P.x + vx / l * L, y: P.y + vy / l * L }; } } // Alt: quebra a alça (canto)
      else { P.x = ini.x + dx; P.y = ini.y + dy; P.hi = { x: ini.hi.x + dx, y: ini.hi.y + dy }; P.ho = { x: ini.ho.x + dx, y: ini.ho.y + dy }; }
      Atelie.desenha(); };
    const up = async () => { if (acabou) return; acabou = true; for (const [t, fn] of [['pointermove', mov], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) cv0.removeEventListener(t, fn); if (mexeu) await this.gravaNos(a); };
    for (const [t, fn] of [['pointermove', mov], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) cv0.addEventListener(t, fn);
  },
  async gravaNos(a) {
    const N = this.nos; if (!N) return; const img = a.img, m = await Vetor.modelo(img.k), c = m.cam.find(x => x.id === N.cam), f = c?.f[N.i]; if (!f) return;
    f.d = this.junta(N.S); await Vetor.gravar(img, m); N.k = img.k; Atelie.commit();
  },
  tiraPonto(a, hit) { const N = this.nos, s = N.S[hit.s]; if (s.p.length <= 2) { N.S.splice(hit.s, 1); if (!N.S.length) return UI.toast('A forma ficaria vazia: para tirar a forma inteira use a borracha.', { kind: 'warn' }); } else s.p.splice(hit.i, 1); N.sel = null; this.gravaNos(a); },
  // dois cliques na borda da forma: põe um ponto ali (divide a curva no lugar mais perto)
  async nosDuplo(e) {
    const a = Pintura.alvo(), N = this.nos; if (!a || !N || N.k !== a.img.k) return; const m = await Vetor.modelo(a.img.k), c = m.cam.find(x => x.id === N.cam), T = this.matriz(a, m, c), d = devicePixelRatio || 1, r = Atelie.cv.getBoundingClientRect(), q = T.inverse().transformPoint(new DOMPoint((e.clientX - r.left) * d, (e.clientY - r.top) * d));
    const bz = (p0, p1, p2, p3, t) => { const u = 1 - t; return { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y }; };
    let best = null; N.S.forEach((s, si) => { const n = s.p.length, lim = s.fechado ? n : n - 1; for (let i = 0; i < lim; i++) { const A = s.p[i], B = s.p[(i + 1) % n]; for (let k = 1; k < 40; k++) { const t = k / 40, P = bz(A, A.ho, B.hi, B, t), dd = Math.hypot(P.x - q.x, P.y - q.y); if (!best || dd < best.dd) best = { dd, si, i, t }; } } });
    if (!best) return; const tela = Math.hypot(T.a, T.b); if (best.dd * tela > 10 * d) return;
    const s = N.S[best.si], n = s.p.length, A = s.p[best.i], B = s.p[(best.i + 1) % n], t = best.t, L = (p, q2) => ({ x: p.x + (q2.x - p.x) * t, y: p.y + (q2.y - p.y) * t });
    const a1 = L(A, A.ho), b1 = L(A.ho, B.hi), c1 = L(B.hi, B), a2 = L(a1, b1), b2 = L(b1, c1), M = L(a2, b2); A.ho = a1; B.hi = c1; s.p.splice(best.i + 1, 0, { x: M.x, y: M.y, hi: a2, ho: b2 }); N.sel = { s: best.si, i: best.i + 1 };
    await this.gravaNos(a);
  },
  teclaNos(e) {
    if (Pintura.ferr !== 'pontos' || !this.nos) return false; const k = e.key;
    if (k === 'Escape') { e.preventDefault(); if (this.nos.sel) this.nos.sel = null; else this.nos = null; Atelie.desenha(); return true; }
    if ((k === 'Delete' || k === 'Backspace') && this.nos.sel) { e.preventDefault(); const a = Pintura.alvo(); if (a) this.tiraPonto(a, this.nos.sel); return true; }
    return false;
  },
  // desenha a forma escolhida com os pontos (e as alças do ponto escolhido) — por cima do palco
  desenha(ctx) {
    const N = this.nos; if (Pintura.ferr !== 'pontos' || !N) return; const a = Pintura.alvo(); if (!a || a.img.k !== N.k) return; const m = Vetor._mod.get(a.img.k); if (!m) return; const c = m.cam.find(x => x.id === N.cam); if (!c) return;
    const T = this.matriz(a, m, c), d = devicePixelRatio || 1, P = new Path2D(this.junta(N.S)), tela = q => T.transformPoint(new DOMPoint(q.x, q.y));
    ctx.save(); ctx.setTransform(T); ctx.globalAlpha = .55; if (N.s) { ctx.strokeStyle = N.cor; ctx.lineWidth = N.s; ctx.lineCap = ctx.lineJoin = 'round'; ctx.stroke(P); } else { ctx.fillStyle = N.cor; ctx.fill(P, 'evenodd'); } ctx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.lineWidth = 1.2 * d; ctx.strokeStyle = '#a77bff';
    ctx.beginPath(); for (const s of N.S) { const n = s.p.length; s.p.forEach((p, i) => { const q = tela(p); if (!i) ctx.moveTo(q.x, q.y); const b = s.p[(i + 1) % n]; if (i < n - 1 || s.fechado) { const h1 = tela(p.ho), h2 = tela(b.hi), e2 = tela(b); ctx.bezierCurveTo(h1.x, h1.y, h2.x, h2.y, e2.x, e2.y); } }); } ctx.stroke();
    const sel = N.sel && N.S[N.sel.s]?.p[N.sel.i];
    if (sel) { const q = tela(sel); for (const hh of ['hi', 'ho']) { const t = tela(sel[hh]); if (Math.hypot(t.x - q.x, t.y - q.y) < 1) continue; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(t.x, t.y); ctx.strokeStyle = 'rgba(167,123,255,.9)'; ctx.stroke(); ctx.beginPath(); ctx.arc(t.x, t.y, 3.5 * d, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); } }
    for (const s of N.S) for (const p of s.p) { const q = tela(p), on = p === sel, r = (on ? 4 : 2.6) * d; ctx.fillStyle = on ? '#a77bff' : '#fff'; ctx.strokeStyle = '#5b2fd0'; ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2); ctx.strokeRect(q.x - r, q.y - r, r * 2, r * 2); }
    ctx.restore();
  },
};

/* ---------- ligações com o resto do Ateliê ---------- */
(() => {
  const t0 = Pintura.tecla; Pintura.tecla = function (e) { if (e.type === 'keydown' && VetorUI.teclaNos(e)) return true; return t0.call(this, e); };
  const c0 = Pintura.desenhaCursor; Pintura.desenhaCursor = function (ctx) { c0.call(this, ctx); try { VetorUI.desenha(ctx); } catch (e) { console.warn(e); } };
  const p0 = Camadas.painel; Camadas.painel = function (el) { const a = Pintura.alvo(); if (a && Vetor.eh(a.img.k)) { VetorUI.painel(el, a); return; } return p0.call(this, el); };
  document.addEventListener('dblclick', e => { if (Pintura.ferr === 'pontos' && e.target === Atelie.cv) VetorUI.nosDuplo(e); });
})();
