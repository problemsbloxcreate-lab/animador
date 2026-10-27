/* ===================== pontosed.js — PONTOS DO SVG direto no Animador (sem abrir o Ateliê) =====================
   Camada de imagem SVG ou personagem com peças SVG › tecla A, botão direito › "Editar os pontos do SVG" ou Propriedades.
   Clicar numa forma escolhe (de cima para baixo); arrastar ponto/alça (Alt quebra a alça = canto); Alt+clique ou Delete tira o ponto;
   dois cliques na borda põe um ponto; Shift+clique em outra forma continua escolhendo na mesma peça; Esc solta / sai; Enter sai.
   Grava como imagem NOVA (chave nova) e faz App.commit: o Ctrl+Z volta. Imagem = só esta camada. Peça de personagem = a CÓPIA do
   personagem desta animação (todos os quadros); o personagem da equipe não muda.
   SVG que veio de fora (camada "Arte" sem pontos) é convertido antes, perguntando (`Vetor.desembrulha`). Mesmas contas do Ateliê (VetorUI.parse/junta). */
'use strict';
const PontosEd = {
  ativo: null, // { id: nó, sel: { k, alvo, cam, i, S, cor, s, pt } | null }
  mods: new Map(), // chave → modelo (cópia de trabalho)
  pode(n) { if (!n) return false; if (n.tipo === 'imagem') return !!(n.vetor || Vetor.eh(n.arq)); if (n.tipo !== 'personagem') return false; const def = App.P?.personagens[n.ref]; return !!def && Modelo.todasPartes(def).some(p => p.imgs.some(i => Vetor.eh(i.k))); },
  alterna(n) { if (this.ativo) return this.sair(); return this.entrar(n); },
  async entrar(n) {
    n = n || App.noSel(); if (!this.pode(n)) return UI.toast('Escolha uma imagem SVG ou um personagem com peças SVG para editar os pontos.', { kind: 'warn' });
    if (Deformar.ativo) Deformar.sair(); if (App.tocando) App.pausa?.();
    // SVG de fora: converte antes (as formas dele não têm pontos)
    for (const a of this.alvos(n)) { let m; try { m = await this.modelo(a.k); } catch (e) { continue; } if (!Vetor.temRaw(m)) continue;
      const r = Vetor.desembrulha(m), nomes = { text: 'textos', image: 'imagens', use: 'cópias (use)', foreignObject: 'objetos de fora' }, some = r.faltou.map(x => nomes[x] || x);
      const ok = await UI.confirm({ title: 'Converter o desenho em pontos?', msg: 'Este SVG veio de outro programa e o desenho dele está "fechado". Para mexer nos pontos, cada forma vira uma curva editável e a aparência fica a mesma (degradês viram uma cor só).' + (some.length ? ` <b>Atenção: ${esc(some.join(', '))} não viram pontos e vão sumir desta imagem.</b>` : '') + ' Dá para desfazer com Ctrl+Z.', ok: 'Converter' });
      if (!ok) return; await this.grava(n, a, r.m, 'Converter o SVG em pontos'); }
    this.ativo = { id: n.id, sel: null }; if (App.sel !== n.id) App.selecionar(n.id); this.barra(); App.pinta();
  },
  sair() { this.ativo = null; $('#pe-barra')?.remove(); App.palco.cv && (App.palco.cv.style.cursor = ''); App.pinta(); },
  no() { const n = this.ativo && App.P && Modelo.achar(App.P, this.ativo.id)?.no; if (this.ativo && !n) { this.sair(); return null; } return n; },
  async modelo(k) { if (!this.mods.has(k)) this.mods.set(k, await Vetor.modelo(k)); return this.mods.get(k); },
  // as imagens SVG que dá para editar nesta camada, de CIMA para baixo, com a matriz espaço-do-SVG → tela (px do canvas)
  alvos(n, V = App.palco.vista()) {
    const P = App.P, q = App.q, M = Rig.matNo(P, n, q), out = [], esc = (img, m) => m ? new DOMMatrix().scale(img.w / (m.W || img.w), img.h / (m.H || img.h)) : new DOMMatrix();
    if (n.tipo === 'imagem') { const bm = Render.bm(n.arq), w = bm?.width || 0, h = bm?.height || 0, m = this.mods.get(n.arq);
      out.push({ k: n.arq, tipo: 'imagem', base: V.multiply(M).translate(-w / 2, -h / 2).multiply(m ? new DOMMatrix().scale(w / (m.W || w || 1), h / (m.H || h || 1)) : new DOMMatrix()) }); return out; }
    for (const it of Render.pecasPersonagem(P, n, q, M).reverse()) { if (!it.img || !Vetor.eh(it.img.k)) continue; const im = it.img, px = im.pivo?.x ?? im.w / 2, py = im.pivo?.y ?? im.h / 2;
      out.push({ k: im.k, tipo: 'peca', pid: it.parte.id, iid: im.id, nome: it.parte.nome, base: V.multiply(it.m).translate(-px + (im.ajuste?.x || 0), -py + (im.ajuste?.y || 0)).multiply(esc(im, this.mods.get(im.k))) }); }
    return out;
  },
  T(a, m, c) { const o = m.off || { x: 0, y: 0 }; let T = a.base.translate(-o.x, -o.y); if (c?.tr) T = T.multiply(new DOMMatrix(c.tr)); return T; },
  telaDe(e) { const d = App.palco.dpr; return { x: e.offsetX * d, y: e.offsetY * d }; },
  // ---------- mouse ----------
  desce(e) {
    if (!this.ativo || e.button !== 0) return false; const n = this.no(); if (!n) return false; this._desce(e, n); return true;
  },
  async _desce(e, n) {
    const t = this.telaDe(e), d = App.palco.dpr, A = this.ativo, S = A.sel;
    // 1) ponto/alça da forma escolhida
    if (S) { const a = this.alvos(n).find(x => x.k === S.k && (S.alvo.tipo === 'imagem' || x.pid === S.alvo.pid)), m = a && this.mods.get(S.k), c = m?.cam.find(x => x.id === S.cam);
      if (a && c) { const T = this.T(a, m, c), perto = p => { const s = T.transformPoint(new DOMPoint(p.x, p.y)); return Math.hypot(s.x - t.x, s.y - t.y) < 9 * d; }; let hit = null;
        if (S.pt) { const P = S.S[S.pt.s].p[S.pt.i]; for (const h of ['hi', 'ho']) if (!hit && Math.hypot(P[h].x - P.x, P[h].y - P.y) > .01 && perto(P[h])) hit = { ...S.pt, h }; }
        if (!hit) S.S.forEach((s, si) => s.p.forEach((p, i) => { if (!hit && perto(p)) hit = { s: si, i }; }));
        if (hit) { if (e.altKey && !hit.h) return this.tiraPonto(hit); S.pt = { s: hit.s, i: hit.i }; App.pinta(); return this.arrasta(e, n, a, m, c, T, hit); } } }
    // 2) escolhe a forma clicada (peças de cima primeiro; dentro da peça, as camadas de cima)
    const ctx = (this._ctx ||= new OffscreenCanvas(1, 1).getContext('2d')), alvos = this.alvos(n);
    for (const a of alvos) { let m; try { m = await this.modelo(a.k); } catch { continue; } const a2 = this.alvos(n).find(x => x.k === a.k && x.pid === a.pid) || a;
      for (const c of [...m.cam].reverse()) { if (c.vis === false) continue; const T = this.T(a2, m, c), inv = T.inverse(), q = inv.transformPoint(new DOMPoint(t.x, t.y)), z = Math.hypot(T.a, T.b) || 1;
        for (let i = c.f.length - 1; i >= 0; i--) { const f = c.f[i], P2 = new Path2D(f.d); let dentro;
          if (f.s) { ctx.lineWidth = Math.max(f.s, 8 * d / z); ctx.lineCap = ctx.lineJoin = 'round'; dentro = ctx.isPointInStroke(P2, q.x, q.y); } else dentro = ctx.isPointInPath(P2, q.x, q.y, f.r ? 'evenodd' : 'nonzero');
          if (dentro) { A.sel = { k: a.k, alvo: { tipo: a.tipo, pid: a.pid, iid: a.iid, nome: a.nome }, cam: c.id, i, S: VetorUI.parse(f.d), cor: f.c || '#000000', s: f.s, pt: null }; this.barra(); App.pinta(); return; } } } }
    A.sel = null; this.barra(); App.pinta(); // clicou fora: solta a forma (continua editando)
  },
  arrasta(e, n, a, m, c, T, hit) {
    const cv = App.palco.cv, S = this.ativo.sel, inv = T.inverse(), loc = ev => { const t = this.telaDe(ev); return inv.transformPoint(new DOMPoint(t.x, t.y)); };
    const q0 = loc(e), P = S.S[hit.s].p[hit.i], ini = clone(P); let mexeu = false;
    App.palco.fim(e, ev => { const q = loc(ev), dx = q.x - q0.x, dy = q.y - q0.y; mexeu = true;
      if (hit.h) { P[hit.h] = { x: ini[hit.h].x + dx, y: ini[hit.h].y + dy }; if (!ev.altKey) { const o = hit.h === 'hi' ? 'ho' : 'hi', L = Math.hypot(ini[o].x - ini.x, ini[o].y - ini.y), vx = P.x - P[hit.h].x, vy = P.y - P[hit.h].y, l = Math.hypot(vx, vy) || 1; if (L > .01) P[o] = { x: P.x + vx / l * L, y: P.y + vy / l * L }; } }
      else { P.x = ini.x + dx; P.y = ini.y + dy; P.hi = { x: ini.hi.x + dx, y: ini.hi.y + dy }; P.ho = { x: ini.ho.x + dx, y: ini.ho.y + dy }; }
      App.pinta(); }, () => { if (mexeu) this.gravaSel('Mover ponto do SVG'); });
  },
  tiraPonto(hit) { const S = this.ativo.sel, s = S.S[hit.s]; if (s.p.length <= 2) { if (S.S.length <= 1) return UI.toast('A forma ficaria vazia.', { kind: 'warn' }); S.S.splice(hit.s, 1); } else s.p.splice(hit.i, 1); S.pt = null; this.gravaSel('Tirar ponto do SVG'); },
  // dois cliques na borda da forma escolhida: um ponto novo ali
  duplo(e) {
    const A = this.ativo, S = A?.sel; if (!S) return false; const n = this.no(), a = n && this.alvos(n).find(x => x.k === S.k && (S.alvo.tipo === 'imagem' || x.pid === S.alvo.pid)), m = a && this.mods.get(S.k), c = m?.cam.find(x => x.id === S.cam); if (!c) return true;
    const T = this.T(a, m, c), t = this.telaDe(e), q = T.inverse().transformPoint(new DOMPoint(t.x, t.y));
    const bz = (p0, p1, p2, p3, u) => { const v = 1 - u; return { x: v * v * v * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u * u * u * p3.x, y: v * v * v * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u * u * u * p3.y }; };
    let best = null; S.S.forEach((s, si) => { const N = s.p.length, lim = s.fechado ? N : N - 1; for (let i = 0; i < lim; i++) { const A2 = s.p[i], B = s.p[(i + 1) % N]; for (let k = 1; k < 40; k++) { const u = k / 40, P = bz(A2, A2.ho, B.hi, B, u), dd = Math.hypot(P.x - q.x, P.y - q.y); if (!best || dd < best.dd) best = { dd, si, i, u }; } } });
    if (!best || best.dd * Math.hypot(T.a, T.b) > 12 * App.palco.dpr) return true;
    const s = S.S[best.si], N = s.p.length, A2 = s.p[best.i], B = s.p[(best.i + 1) % N], u = best.u, L = (p, p2) => ({ x: p.x + (p2.x - p.x) * u, y: p.y + (p2.y - p.y) * u });
    const a1 = L(A2, A2.ho), b1 = L(A2.ho, B.hi), c1 = L(B.hi, B), a2 = L(a1, b1), b2 = L(b1, c1), M = L(a2, b2); A2.ho = a1; B.hi = c1; s.p.splice(best.i + 1, 0, { x: M.x, y: M.y, hi: a2, ho: b2 }); S.pt = { s: best.si, i: best.i + 1 };
    this.gravaSel('Pôr ponto no SVG'); return true;
  },
  // ---------- gravar ----------
  async gravaSel(rotulo) {
    const S = this.ativo?.sel, n = this.no(); if (!S || !n) return; const m = clone(await this.modelo(S.k)), c = m.cam.find(x => x.id === S.cam), f = c?.f[S.i]; if (!f) return;
    f.d = VetorUI.junta(S.S); const k2 = await this.grava(n, { k: S.k, tipo: S.alvo.tipo, pid: S.alvo.pid, iid: S.alvo.iid }, m, rotulo); if (k2 && this.ativo?.sel === S) S.k = k2;
  },
  // grava o modelo como imagem NOVA e põe a chave nova na camada (imagem) ou na peça do personagem desta animação
  async grava(n, a, m, rotulo) {
    const P = App.P, t = Vetor.svg(m), b = new Blob([t], { type: 'image/svg+xml' });
    const k2 = a.tipo === 'peca' ? `personagens/${n.ref}/img/${uid('pe').toLowerCase().replace(/[^a-z0-9]/g, '')}.svg` : uid('a') + '.svg';
    await Arq.guardar(b, k2); Vetor._txt.set(k2, t); Vetor._mod.set(k2, clone(m)); this.mods.set(k2, clone(m)); const im = await Vetor.imagem(b); if (!im) { UI.toast('O SVG novo não abriu.', { kind: 'err' }); return null; } Arq.img.set(k2, im);
    if (a.tipo === 'imagem') { n.arq = k2; n.vetor = true; }
    else { const def = P.personagens[n.ref]; let feitos = 0; for (const p of Modelo.todasPartes(def)) if (p.id === a.pid) for (const i of p.imgs) if (i.id === a.iid && i.k === a.k) { i.k = k2; feitos++; } if (!feitos) return null; def.editadoNaAnim = Date.now(); }
    App.commit(rotulo || 'Pontos do SVG', { semArvore: true }); return k2;
  },
  // ---------- teclas ----------
  tecla(e) {
    if (!this.ativo) return false; const k = e.key, S = this.ativo.sel;
    if (k === 'Escape') { e.preventDefault(); if (S?.pt) S.pt = null; else if (S) this.ativo.sel = null; else return this.sair(), true; this.barra(); App.pinta(); return true; }
    if (k === 'Enter') { e.preventDefault(); this.sair(); return true; }
    if ((k === 'Delete' || k === 'Backspace') && S?.pt) { e.preventDefault(); this.tiraPonto(S.pt); return true; }
    if ((k === 'Delete' || k === 'Backspace')) { e.preventDefault(); return true; } // não apaga a camada sem querer
    if (k.toLowerCase() === 'a' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); this.sair(); return true; }
    return false;
  },
  // ---------- desenho (por cima do palco) ----------
  desenha(ctx) {
    const n = this.no(); if (!n) return false; const d = App.palco.dpr, S = this.ativo.sel;
    ctx.save();
    // todas as formas das peças SVG, bem fininhas (para ver onde clicar)
    for (const a of this.alvos(n)) { const m = this.mods.get(a.k); if (!m) { this.modelo(a.k).then(() => App.pinta()).catch(() => { }); continue; }
      for (const c of m.cam) { if (c.vis === false) continue; ctx.setTransform(this.T(a, m, c)); const z = Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1; ctx.lineWidth = .8 * d / z; ctx.strokeStyle = 'rgba(167,123,255,.45)'; for (const f of c.f) ctx.stroke(this.p2(f.d)); } }
    if (S) { const a = this.alvos(n).find(x => x.k === S.k && (S.alvo.tipo === 'imagem' || x.pid === S.alvo.pid)), m = a && this.mods.get(S.k), c = m?.cam.find(x => x.id === S.cam);
      if (a && c) { const T = this.T(a, m, c), P2 = new Path2D(VetorUI.junta(S.S)), tela = q => T.transformPoint(new DOMPoint(q.x, q.y)); ctx.setTransform(T); ctx.globalAlpha = .5;
        if (S.s) { ctx.strokeStyle = S.cor; ctx.lineWidth = S.s; ctx.lineCap = ctx.lineJoin = 'round'; ctx.stroke(P2); } else { ctx.fillStyle = S.cor; ctx.fill(P2, 'evenodd'); }
        ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.lineWidth = 1.4 * d; ctx.strokeStyle = '#a77bff'; ctx.beginPath();
        for (const s of S.S) { const N = s.p.length; s.p.forEach((p, i) => { const q = tela(p); if (!i) ctx.moveTo(q.x, q.y); const b = s.p[(i + 1) % N]; if (i < N - 1 || s.fechado) { const h1 = tela(p.ho), h2 = tela(b.hi), e2 = tela(b); ctx.bezierCurveTo(h1.x, h1.y, h2.x, h2.y, e2.x, e2.y); } }); } ctx.stroke();
        const sel = S.pt && S.S[S.pt.s]?.p[S.pt.i];
        if (sel) { const q = tela(sel); for (const hh of ['hi', 'ho']) { const t = tela(sel[hh]); if (Math.hypot(t.x - q.x, t.y - q.y) < 1) continue; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(t.x, t.y); ctx.strokeStyle = 'rgba(167,123,255,.9)'; ctx.stroke(); ctx.beginPath(); ctx.arc(t.x, t.y, 4 * d, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); } }
        for (const s of S.S) for (const p of s.p) { const q = tela(p), on = p === sel, r = (on ? 4.5 : 3) * d; ctx.fillStyle = on ? '#a77bff' : '#fff'; ctx.strokeStyle = '#5b2fd0'; ctx.fillRect(q.x - r, q.y - r, r * 2, r * 2); ctx.strokeRect(q.x - r, q.y - r, r * 2, r * 2); } } }
    ctx.restore(); return true;
  },
  _p2: new Map(), p2(d) { let p = this._p2.get(d); if (!p) { p = new Path2D(d); if (this._p2.size > 3000) this._p2.clear(); this._p2.set(d, p); } return p; },
  // barra em cima do palco: o que está editando e como sair
  barra() {
    const n = this.no(); if (!n) return; let b = $('#pe-barra'); const pal = $('#palco');
    if (!b) { b = h(`<div id="pe-barra" class="pe-barra" role="status"><span class="pe-ic">${ic('edit', 14)}</span><span data-t></span><button class="btn sm pe-ok">${ic('check', 13)} Concluir</button></div>`); pal.appendChild(b); $('.pe-ok', b).onclick = () => this.sair(); }
    const S = this.ativo.sel, onde = S ? (S.alvo.tipo === 'peca' ? `<b>${esc(S.alvo.nome || 'peça')}</b> · ` : '') + 'forma escolhida: arraste os pontos (Alt = canto), dois cliques na borda põe ponto, Alt+clique ou Delete tira' : 'clique numa forma para ver os pontos';
    $('[data-t]', b).innerHTML = `<b>Pontos do SVG</b> · ${esc(n.nome)} · ${onde}${n.tipo === 'personagem' ? ' <small>(muda o desenho nesta animação; o personagem da equipe fica igual)</small>' : ''}`;
  },
};
