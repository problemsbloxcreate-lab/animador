/* ===================== rig.js — RIG do personagem (como no Toon Boom / Adobe Animate) =====================
   O personagem já é uma hierarquia de partes (cada filha encaixa no pivô da mãe: corpo → braço → antebraço → mão).
   Aqui ficam as ferramentas que fazem dele um rig de verdade:
   • MEMBROS (cadeias de 3 partes: braço › antebraço › mão, perna › canela › pé), achados pela hierarquia e pelos nomes
     (`Rig.cadeias`), ou marcados à mão em `def.membros` [{ nome, raiz, meio, fim, dobra }];
   • IK de dois ossos (`Rig.ik`): leva a mão/pé até um ponto girando o braço e o antebraço (a dobra do cotovelo/joelho
     continua para o mesmo lado);
   • MOVIMENTO SUAVE DAS PARTES entre as chaves (`Rig.tween`, nó com `n.suaveP`): giro, posição e tamanho de cada parte
     vão mudando aos poucos até a pose da próxima chave (a troca de desenho acontece na chave, como a "substituição" do Toon Boom);
   • pontos do esqueleto em coordenadas do personagem (`Rig.ponto`/`juntas`), para a IA e para desenhar o esqueleto.
   Nada aqui muda o personagem guardado: tudo trabalha no estado de um quadro. */
'use strict';
const Rig = {
  FIM: /m[ãa]o|\bp[ée]\b|bota|sapato|t[êe]nis|chinelo|hand|foot|garra|pata/i,
  NAO: /por cima|tampa|contorno|remendo|sombra|manga|colete|fundo|refer/i,
  // membros do personagem (a vista que vier): [{ nome, raiz, meio, fim, tipo: 'braco'|'perna'|'outro', dobra }]
  cadeias(def) {
    if (!def?.partes?.length) return [];
    if (def._cad && def._cad.sig === def.partes.length + ':' + (def.membros ? JSON.stringify(def.membros) : '')) return def._cad.L;
    const porId = Object.fromEntries(def.partes.map(p => [p.id, p])), out = [], usados = new Set();
    for (const m of def.membros || []) if (porId[m.raiz] && porId[m.meio] && porId[m.fim]) { out.push({ ...m, nome: m.nome || porId[m.fim].nome }); usados.add(m.fim); }
    for (const p of def.partes) {
      if (usados.has(p.id) || !this.FIM.test(p.nome) || this.NAO.test(p.nome)) continue;
      const meio = porId[p.pai], raiz = meio && porId[meio.pai]; if (!meio || !raiz || raiz.id === def.raiz || !raiz.pai) continue;
      if (this.NAO.test(meio.nome) && !/antebra|canela|perna|bra[çc]o/i.test(meio.nome)) continue;
      const tipo = /p[ée]|bota|sapato|t[êe]nis|perna|canela|coxa|foot|leg/i.test(p.nome + ' ' + raiz.nome) ? 'perna' : /m[ãa]o|bra[çc]o|hand|arm/i.test(p.nome + ' ' + raiz.nome) ? 'braco' : 'outro';
      out.push({ nome: raiz.nome.replace(/\s*\(.*?\)\s*/g, ' ').trim(), raiz: raiz.id, meio: meio.id, fim: p.id, tipo }); usados.add(p.id);
    }
    try { Object.defineProperty(def, '_cad', { value: { sig: def.partes.length + ':' + (def.membros ? JSON.stringify(def.membros) : ''), L: out }, configurable: true, enumerable: false, writable: true }); } catch { }
    return out;
  },
  // matriz do pivô de cada parte (coordenadas do personagem) para o estado est
  mats(def, est) { const L = Modelo.montar(def, est), out = {}; for (const it of L) out[it.parte.id] = it.mp; for (const p of def.partes) if (!out[p.id]) { /* parte escondida: calcula mesmo assim */ const m = this._matSo(def, est, p.id); if (m) out[p.id] = m; } return out; },
  _matSo(def, est, pid) { const porId = Object.fromEntries(def.partes.map(p => [p.id, p])), vai = (id, g = 0) => { const p = porId[id]; if (!p || g > 40) return new DOMMatrix(); const e = est[id] || p.base, pai = p.pai ? vai(p.pai, g + 1) : new DOMMatrix(); return pai.translate(p.encaixe?.x || 0, p.encaixe?.y || 0).translate(e.x || 0, e.y || 0).rotate(e.r || 0).scale((e.s ?? 1) * (e.sx || 1), e.s ?? 1); }; return vai(pid); },
  ponto(m) { const p = m.transformPoint(new DOMPoint(0, 0)); return { x: p.x, y: p.y }; },
  juntas(def, est) { const M = this.mats(def, est), out = {}; for (const [id, m] of Object.entries(M)) out[id] = this.ponto(m); return out; },
  // giro (graus) que a parte precisa ganhar no PRÓPRIO r para o osso dela virar dw graus na tela (espelhada inverte)
  sinal(def, est, pid) { const p = def.partes.find(x => x.id === pid), pm = p?.pai ? this._matSo(def, est, p.pai) : new DOMMatrix(); return pm.a * pm.d - pm.b * pm.c < 0 ? -1 : 1; },
  ang(a, b) { return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI; },
  norm(d) { return ((d + 540) % 360) - 180; },
  // IK de dois ossos: devolve { [raiz]: r, [meio]: r } (giros novos) para a ponta (fim) chegar em alvo {x,y} (coordenadas do personagem)
  // o.dobra: 1/-1 força o lado da dobra; sem = continua para o mesmo lado de agora
  ik(def, est, cad, alvo, o = {}) {
    const e = Object.fromEntries(Object.entries(est).map(([k, v]) => [k, { ...v }])), r0 = id => e[id]?.r || 0, base = id => def.partes.find(p => p.id === id)?.base;
    for (const id of [cad.raiz, cad.meio, cad.fim]) if (!e[id]) e[id] = { ...(base(id) || {}) };
    let J = this.juntas(def, e); const S = J[cad.raiz], E = J[cad.meio], W = J[cad.fim]; if (!S || !E || !W) return null;
    const L1 = Math.hypot(E.x - S.x, E.y - S.y), L2 = Math.hypot(W.x - E.x, W.y - E.y); if (L1 < 1 || L2 < 1) return null;
    const cruz = (E.x - S.x) * (W.y - E.y) - (E.y - S.y) * (W.x - E.x), lado = o.dobra || (Math.abs(cruz) > 1e-3 ? Math.sign(cruz) : (cad.tipo === 'perna' ? -1 : 1));
    let dx = alvo.x - S.x, dy = alvo.y - S.y, d = Math.hypot(dx, dy); const dmin = Math.abs(L1 - L2) + .5, dmax = L1 + L2 - .5; d = clamp(d, dmin, dmax);
    const th = Math.atan2(dy, dx), a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)), phi1 = th - lado * a;
    const E2 = { x: S.x + Math.cos(phi1) * L1, y: S.y + Math.sin(phi1) * L1 }, T = { x: S.x + Math.cos(th) * d, y: S.y + Math.sin(th) * d };
    // 1º osso
    const d1 = this.norm(phi1 * 180 / Math.PI - this.ang(S, E)); e[cad.raiz].r = r0(cad.raiz) + d1 * this.sinal(def, e, cad.raiz);
    // 2º osso (com o 1º já girado)
    J = this.juntas(def, e); const d2 = this.norm(this.ang(E2, T) - this.ang(J[cad.meio], J[cad.fim])); e[cad.meio].r = r0(cad.meio) + d2 * this.sinal(def, e, cad.meio);
    const out = { [cad.raiz]: round(e[cad.raiz].r, 2), [cad.meio]: round(e[cad.meio].r, 2) };
    if (o.manterMao) { const J2 = this.juntas(def, e), giroMao = this.ang(J[cad.meio], J[cad.fim]) - this.ang(J2[cad.meio], J2[cad.fim]); if (Math.abs(giroMao) > .1) out[cad.fim] = round(r0(cad.fim) + giroMao * this.sinal(def, e, cad.fim), 2); }
    return out;
  },
  // PONTO DE PARTIDA DO IK: entre os presets das sessões que mexem neste membro, o que já deixa a ponta mais perto do alvo
  // (assim o braço erguido usa o desenho/camada do preset "Erguido/Acenando" — na frente do cabelo — e o IK só acerta o resto)
  melhorPose(def, est, cad, alvo) {
    const ids = new Set([cad.raiz, cad.meio, cad.fim]), semAj = { ...est, partes: Object.fromEntries(Object.entries(est.partes || {}).filter(([id]) => !ids.has(id))) };
    const dist = e => { const J = this.juntas(def, e)[cad.fim]; return J ? Math.hypot(J.x - alvo.x, J.y - alvo.y) : Infinity; };
    let m = { d: dist(Modelo.partesNoEstado(def, semAj)) * .9, s: null, p: null }; // a pose de agora ganha um empate
    for (const s of def.sessoes || []) { if (!s.presets?.some(pr => Object.keys(pr.estado || {}).some(id => id === cad.raiz || id === cad.meio))) continue;
      for (const pr of s.presets) { const d = dist(Modelo.partesNoEstado(def, { ...semAj, sessoes: { ...(semAj.sessoes || {}), [s.id]: pr.id } })); if (d < m.d) m = { d, s, p: pr }; } }
    return m.s ? { sessao: m.s.id, preset: m.p.id, nome: m.p.nome } : null;
  },
  // acha um membro pelo nome (mão direita, braço esquerdo, pé…)
  membro(def, nome) {
    const L = this.cadeias(def), n = String(nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), lim = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const por = id => lim(def.partes.find(p => p.id === id)?.nome || '');
    return L.find(c => [c.fim, c.meio, c.raiz].some(id => por(id) === n)) || L.find(c => lim(c.nome) === n)
      || L.find(c => { const lado = /esquer/.test(n) ? 'esquer' : /direit/.test(n) ? 'direit' : ''; const tipo = /mao|braco|antebraco|hand|arm/.test(n) ? 'braco' : /pe|perna|canela|bota|foot|leg/.test(n) ? 'perna' : ''; return (!lado || [c.fim, c.raiz].some(id => por(id).includes(lado))) && (!tipo || c.tipo === tipo); }) || null;
  },

  /* ---------- MOVIMENTO SUAVE das partes entre as chaves do nó (n.suaveP) ---------- */
  chavesPose(n) { return Modelo.quadrosChave(n).filter(k => { const c = n.chaves[k]; return c.sessoes || c.partes || c.vista !== undefined; }); },
  tween(P, n, q, dv, ep) {
    const ks = this.chavesPose(n); let qa = null, qb = null; for (const k of ks) { if (k <= q) qa = k; else { qb = k; break; } }
    if (qa == null || qb == null || q === qa) return ep;
    const def = P.personagens[n.ref], eb = Modelo.estadoPersonagem(n, qb), ea = Modelo.estadoPersonagem(n, qa); if ((eb.vista || null) !== (ea.vista || null)) return ep;
    const ch = n.chaves[qb]; if (ch?.ir === 'corte') return ep;
    // o movimento ocupa os últimos "dur" quadros antes da chave (chave.dur; padrão até 0,75 s) — antes disso a pose fica parada (hold)
    const dur = Math.max(1, Math.min(qb - qa, Math.round(+ch.dur > 0 ? +ch.dur : (P.fps || 24) * .75))), q0 = qb - dur; if (q <= q0) return ep;
    const epB = Modelo.partesNoEstado(Modelo.naVista(def, eb.vista), eb), t = Ease.daChave(ch)((q - q0) / dur), out = {};
    for (const [pid, a] of Object.entries(ep)) {
      const b = epB[pid]; if (!a || !b || (a.img || null) !== (b.img || null) || (a.vis === false) !== (b.vis === false)) { out[pid] = a; continue; } const x = { ...a }; // troca de desenho: fica para a chave (a atuação faz a mola)
      for (const c of ['x', 'y', 'r', 's']) { const va = a[c] ?? (c === 's' ? 1 : 0), vb = b[c] ?? (c === 's' ? 1 : 0); if (va === vb) continue; let d = vb - va; if (c === 'r') d = this.norm(d); x[c] = va + d * t; }
      out[pid] = x;
    }
    return out;
  },
  // matriz da camada do personagem no projeto (pastas de cima + a própria camada), quadro q
  matNo(P, n, q) { let m = new DOMMatrix(); for (const a of Modelo.ancestrais(P, n.id)) m = Render.matNo(m, Modelo.transf(a, q)); return Render.matNo(m, Modelo.transf(n, q)); },
  // pontos que dá para arrastar no esqueleto (coordenadas do personagem): ponta de membro = IK; junta de outra parte = gira a MÃE (FK)
  alcas(def, est) {
    const J = this.juntas(def, est), L = this.cadeias(def), porId = Object.fromEntries(def.partes.map(p => [p.id, p])), out = [], fins = new Set(L.map(c => c.fim));
    for (const c of L) if (J[c.fim]) out.push({ tipo: 'ik', cad: c, pid: c.fim, ...J[c.fim] });
    for (const p of def.partes) {
      if (fins.has(p.id) || !p.pai || !J[p.id] || this.NAO.test(p.nome)) continue; const mae = porId[p.pai]; if (!mae || mae.id === def.raiz || !mae.pai || !J[mae.id]) continue;
      if (Math.hypot(J[p.id].x - J[mae.id].x, J[p.id].y - J[mae.id].y) < 4) continue; // junta em cima da junta da mãe: girar não daria para ver
      if (out.some(o => o.pid === p.id)) continue; out.push({ tipo: 'fk', pid: p.id, mae: mae.id, ...J[p.id] });
    }
    return out;
  },
  // FK: giro novo da mãe para a junta da filha apontar para o ponto
  giraPara(def, est, al, alvo) { const J = this.juntas(def, est), O = J[al.mae], A = J[al.pid]; if (!O || !A) return null; const d = this.norm(this.ang(O, alvo) - this.ang(O, A)); return { [al.mae]: round((est[al.mae]?.r || 0) + d * this.sinal(def, est, al.mae), 2) }; },
  // desenha o esqueleto (ossos e juntas) por cima do personagem — editor com "Mostrar o esqueleto" ligado
  desenha(ctx, def, est, m, o = {}) {
    const J = this.juntas(def, est), cor = o.cor || "#5ee0ff"; ctx.save(); ctx.setTransform(m); const k = (devicePixelRatio || 1) / Math.hypot(m.a, m.b);
    ctx.lineWidth = 2.5 * k; ctx.strokeStyle = cor; ctx.globalAlpha = .9; ctx.setLineDash([]);
    for (const p of def.partes) { if (!p.pai || !J[p.id] || !J[p.pai] || this.NAO.test(p.nome)) continue; ctx.beginPath(); ctx.moveTo(J[p.pai].x, J[p.pai].y); ctx.lineTo(J[p.id].x, J[p.id].y); ctx.stroke(); }
    for (const a of this.alcas(def, est)) { const ativo = o.ativo === a.pid; ctx.beginPath(); ctx.arc(a.x, a.y, (a.tipo === 'ik' ? 8 : 5.5) * k * (ativo ? 1.3 : 1), 0, 7);
      ctx.fillStyle = a.tipo === 'ik' ? (ativo ? '#ffd166' : '#ff9f43') : cor; ctx.fill(); ctx.lineWidth = 1.5 * k; ctx.strokeStyle = '#0b1a22'; ctx.stroke(); }
    if (def.raiz && J[def.raiz]) { ctx.beginPath(); ctx.arc(J[def.raiz].x, J[def.raiz].y, 6 * k, 0, 7); ctx.strokeStyle = cor; ctx.lineWidth = 2 * k; ctx.stroke(); }
    ctx.restore();
  },

  /* ---------- desenhar o personagem fora do palco (folha, conferência) ---------- */
  desenhaDef(ctx, def, ep, m, so) {
    for (const it of Modelo.montar(def, ep, m)) { if (!it.img || so && !so.has(it.parte.id)) continue; const bm = Arq.comAp(Render.bm(it.img.k), it); if (!bm) continue;
      const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2; ctx.setTransform(it.m); ctx.drawImage(bm, -px + (it.img.ajuste?.x || 0), -py + (it.img.ajuste?.y || 0), it.img.w, it.img.h); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  },
  // onde tem TINTA na imagem (frações 0..1 da imagem): as peças costumam vir no tamanho da folha inteira, quase tudo transparente
  _tintas: new Map(),
  tinta(img) {
    if (!img?.k) return null; if (this._tintas.has(img.k)) return this._tintas.get(img.k); const bm = Arq.img.get(img.k); if (!bm) return null; let r = null;
    try { const N = 96, c = this._cvT || (this._cvT = document.createElement('canvas')); c.width = N; c.height = N; const x = c.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, N, N); x.drawImage(bm, 0, 0, N, N);
      const d = x.getImageData(0, 0, N, N).data; let a = N, b = N, e = -1, f = -1; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (d[(j * N + i) * 4 + 3] > 24) { if (i < a) a = i; if (i > e) e = i; if (j < b) b = j; if (j > f) f = j; }
      r = e < 0 ? { x0: .5, y0: .5, x1: .5, y1: .5 } : { x0: a / N, y0: b / N, x1: (e + 1) / N, y1: (f + 1) / N }; } catch { r = null; }
    if (this._tintas.size > 600) this._tintas.delete(this._tintas.keys().next().value); this._tintas.set(img.k, r); return r;
  },
  // cantos (no espaço da peça, já com pivô/ajuste) só da parte desenhada
  cantosImg(img) { const px = img.pivo?.x ?? img.w / 2, py = img.pivo?.y ?? img.h / 2, ax = (img.ajuste?.x || 0) - px, ay = (img.ajuste?.y || 0) - py, t = this.tinta(img) || { x0: 0, y0: 0, x1: 1, y1: 1 };
    return [[t.x0, t.y0], [t.x1, t.y0], [t.x0, t.y1], [t.x1, t.y1]].map(([u, v]) => [u * img.w + ax, v * img.h + ay]); },
  caixaDe(def, ep, ids) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const it of Modelo.montar(def, ep)) { if (!it.img || ids && !ids.has(it.parte.id)) continue;
      for (const [x, y] of this.cantosImg(it.img)) { const p = it.m.transformPoint(new DOMPoint(x, y)); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); } }
    return isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null; },
  descendentes(def, ids) { const out = new Set(ids); let mudou = true; while (mudou) { mudou = false; for (const p of def.partes) if (p.pai && out.has(p.pai) && !out.has(p.id)) { out.add(p.id); mudou = true; } } return out; },
  // FOLHA DO PERSONAGEM (model sheet) para a IA: cada sessão numa linha, cada preset desenhado (zoom nas partes que ele mexe), com o nome embaixo
  _folhas: new Map(),
  async folha(def0, vistaId, o = {}) {
    const dv = Modelo.naVista(def0, vistaId), chave = def0.id + '|' + (def0.modificado || '') + '|' + (vistaId || '') + '|' + (dv.partes || []).length; if (this._folhas.has(chave)) return this._folhas.get(chave);
    await Arq.garantir(dv.partes.flatMap(p => p.imgs.map(i => i.k))).catch(() => { });
    const C = o.cel || 106, LAB = 16, ESQ = 96, MAXP = o.maxPresets || 14, sess = (dv.sessoes || []).filter(s => s.presets?.length).slice(0, o.maxSessoes || 12);
    const linhas = [{ nome: 'Pose base', presets: [{ nome: 'base', estado: {} }], todo: true }, ...sess.map(s => ({ nome: s.nome, presets: s.presets.slice(0, MAXP), s }))];
    const W = ESQ + MAXP * C, H = linhas.length * (C + LAB) + 6, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.font = '600 12px sans-serif'; ctx.textBaseline = 'middle';
    linhas.forEach((L, li) => {
      const y0 = li * (C + LAB) + 3; ctx.fillStyle = li % 2 ? '#f3f5f8' : '#ffffff'; ctx.fillRect(0, y0 - 3, W, C + LAB); ctx.fillStyle = '#1b2430';
      this._texto(ctx, L.nome, 6, y0 + C / 2, ESQ - 10, 12);
      const mexe = new Set(L.s ? L.s.presets.flatMap(p => Object.keys(p.estado || {})) : []), area = L.todo || !mexe.size ? null : this.descendentes(dv, mexe);
      L.presets.forEach((pr, pi) => {
        const ep = Modelo.partesNoEstado(dv, L.s ? { sessoes: { [L.s.id]: pr.id } } : {}), b0 = this.caixaDe(dv, ep, area) || this.caixaDe(dv, ep); if (!b0) return;
        const lado = Math.max(b0.w, b0.h) * (area ? 1.35 : 1.06), cx = b0.x + b0.w / 2, cy = b0.y + b0.h / 2, k = (C - 6) / Math.max(lado, 1), x = ESQ + pi * C;
        ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y0, C - 4, C); ctx.clip(); ctx.strokeStyle = '#d5dbe3'; ctx.strokeRect(x + 2.5, y0 + .5, C - 5, C - 1);
        const m = new DOMMatrix().translate(x + C / 2, y0 + C / 2).scale(k).translate(-cx, -cy);
        if (area) { ctx.globalAlpha = .28; this.desenhaDef(ctx, dv, ep, m); ctx.globalAlpha = 1; this.desenhaDef(ctx, dv, ep, m, area); } else this.desenhaDef(ctx, dv, ep, m);
        ctx.restore(); ctx.fillStyle = '#1b2430'; ctx.font = '11px sans-serif'; this._texto(ctx, pr.nome, x + 4, y0 + C + LAB / 2 - 1, C - 8, 11); ctx.font = '600 12px sans-serif';
      });
    });
    const url = cv.toDataURL('image/jpeg', .82), r = { url, w: W, h: H, nome: def0.nome, vista: (def0.vistas || []).find(v => v.id === (vistaId || def0.vistas[0]?.id))?.nome || '' }; if (this._folhas.size > 12) this._folhas.delete(this._folhas.keys().next().value); this._folhas.set(chave, r); return r;
  },
  _texto(ctx, t, x, y, max, tam) { t = String(t || ''); while (t.length > 1 && ctx.measureText(t).width > max) t = t.slice(0, -2) + '…'; ctx.fillText(t, x, y); },
};
