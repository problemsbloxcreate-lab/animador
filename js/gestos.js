/* ===================== gestos.js — GESTOS AUTOMÁTICOS NA FALA (pedido da dona, 23/11/2026: "as animações estão muito duras e paradas") =====================
   Quem está falando faz gestos de braço nas palavras de ênfase; quem não fala fica em repouso (a vida automática, js/vida.js, respira por cima).
   Regras do Estúdio (medidas e aprovadas; 2ª versão com as medidas do walt-disney nos personagens reais, 23/11):
   - Só gestos que JÁ EXISTEM: presets das sessões de braço do personagem ("Braço direito", "Braço esquerdo", "Braços", "Gestos v2"…).
     Fala: gestic|apont|abert|explic|mostr|palma|pergunt. Repouso: parad|padr|relax|descans|normal ou a pose base.
     NUNCA: queixo, óculos, cintura, acenar, comemorar, soco, dança, pulo, corrida, herói, segurar (reprovados na Clara ou são ação, não fala).
   - Cada gesto é um EPISÓDIO de um braço só: repouso → gesto (na palavra de ênfase) → segura → volta ao repouso. Nunca os dois braços fora
     do repouso ao mesmo tempo; os braços se alternam de um episódio para o outro.
   - Gesto novo só em palavra de ÊNFASE (palavra longa, fim de frase, número, nome, MAIÚSCULA, depois de vírgula/ponto, palavra-chave),
     a 3 palavras ou mais do anterior; entre um episódio e o próximo, repouso de 6–30 q (sorteio fixo) e no mínimo metade do episódio
     (repouso em 40–50% da fala). Segura o gesto 8–30 q (o mesmo braço só troca de novo depois de 24 q; 14 q entre trocas do personagem).
   - Duração pelo TAMANHO do gesto (quanto a mão anda): 8–10 q pequeno … 14–16 q grande, com easing (chave.dur no Rig.tween); a mão
     nunca anda mais de 45 px num quadro (simulado com o próprio Rig.tween) — senão a duração cresce até 16 ou o gesto sai.
   - Nunca escreve partes (a imagem da mão vem com o preset; trocar a imagem por fora prendia a mão, 19/11). Chave de braço feita à mão perto
     da fala = aquele trecho fica sem gestos. Só grava em quadro vazio ou em chave só de rosto (boca pela voz).
   - Personagem escondido na fala (opacidade 0: "voz de fora", js/prep.js) não gesticula.
   - NO NAVEGADOR, cada episódio é simulado quadro a quadro com o desenho real (Render.estadoPartes, Rig.juntas, Modelo.camera) e sai se:
     a mão some em algum quadro da transição; o antebraço gira >35° do repouso (punho solto); a mão chega a <40 px de outro personagem
     ou vai para o lado dele; a mão fica a <36 px da borda do vídeo (com a câmera e o zoom daquele quadro); a mão anda >45 px num quadro.
     Gestos.planeja(P, { teste }) testa ao escolher (o.teste = Gestos.testador(P)) e tenta o próximo gesto; Gestos.valida(P, plano)
     confere o plano inteiro de novo e tira o episódio que falhar.
   Tudo o que entra fica anotado em P.gestosAuto = { [noId]: [{ q, sessao, preset, nova }] }: Gestos.tira tira só isso (chave inteira se ficar
   vazia); a chave gerada que alguém mudou passa a ser dela e fica. Rodar de novo = tira e refaz (Ritmo.rodar faz os dois num passo do desfazer).
   Gestos.planeja(P, o) sem o.teste não usa DOM: { [noId]: [{ q, sessao, preset, braco, dur, ep (nº do episódio), ancora? }] }. */
'use strict';
const Gestos = {
  MIN: 14,        // quadros mínimos entre duas trocas do mesmo personagem
  MIN_BRACO: 24,  // quadros mínimos entre duas trocas do MESMO braço (o gesto fica no ar pelo menos isso)
  DUR_MIN: 8, DUR_MAX: 16, DUR: 10, // duração da transição: 8–10 gesto pequeno, 14–16 grande (DUR: a da âncora)
  PULO: 45,       // maior passo da mão por quadro (px do vídeo)
  GIRO: 35,       // giro máximo do antebraço em relação ao repouso (graus)
  VIZINHO: 40,    // distância mínima da mão até outro personagem (px do vídeo)
  BORDA: 36,      // distância mínima da mão até a borda do vídeo (px)
  PAUSA: [6, 30], SEGURA: [8, 30], REPOUSO_MIN: .5, // repouso entre episódios: 6–30 q e ≥ 0,5 × o episódio anterior (repouso em 40–50% da fala)
  CADA: 3,        // palavras mínimas entre dois gestos
  ATRASO: 4,      // o gesto chega 4 quadros depois do começo da palavra de ênfase
  FIM: 8,         // fala acabou: o braço volta até 8 quadros depois (ou assim que puder)
  JUNTA: 12,      // falas do mesmo personagem com menos que isso entre elas viram um trecho só
  BOM: /gestic|apont|abert|explic|mostr|palma|pergunt/,
  REPOUSO: /parad|padr|relax|descans|normal/,
  NUNCA: /queixo|oculos|cintura|acen|comemor|soco|dan|pul|corr|her|segur/,
  SESSAO: /braco|gest/,
  ROSTO: /boca|olho|sobrancel|pupila|express|rosto|mouth|eye|brow|face|blush/,

  sa: s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(),
  R() { return typeof Ritmo !== 'undefined' ? Ritmo : (typeof require === 'function' ? require('./ritmo.js') : null); },
  hash(s) { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; },
  sorte(s, a, b) { return a + this.hash(s) % (b - a + 1); },

  // sessões de braço de uma vista: [{ id, lado: 'D'|'E'|'A', gestos:[presetId], repouso: presetId|null }]
  bracos(dv) {
    const porId = {}; for (const p of dv?.partes || []) porId[p.id] = p;
    const out = [];
    for (const s of dv?.sessoes || []) {
      const nm = this.sa(s.nome); if (!this.SESSAO.test(nm) || this.ROSTO.test(nm)) continue;
      const pres = s.presets || [], nomeDe = pr => this.sa(pr.nome);
      const gestos = pres.filter(pr => this.BOM.test(nomeDe(pr)) && !this.NUNCA.test(nomeDe(pr))).map(pr => pr.id); if (!gestos.length) continue;
      const rep = pres.find(pr => this.REPOUSO.test(nomeDe(pr)) && !this.NUNCA.test(nomeDe(pr)));
      let lado = /direit/.test(nm) ? 'D' : /esquer/.test(nm) ? 'E' : null;
      if (!lado) { const ps = new Set(); for (const pr of pres) for (const pid of Object.keys(pr.estado || {})) ps.add(this.sa(porId[pid]?.nome));
        const d = [...ps].some(x => /direit/.test(x)), e = [...ps].some(x => /esquer/.test(x)); lado = d && !e ? 'D' : e && !d ? 'E' : 'A'; }
      out.push({ id: s.id, nome: s.nome, lado, gestos, repouso: rep ? rep.id : null, nomes: Object.fromEntries(pres.map(pr => [pr.id, pr.nome])) });
    }
    // direito e esquerdo separados: só eles (a sessão dos dois braços mexe nas mesmas partes); senão a de dois braços; senão o lado que tiver
    const D = out.find(b => b.lado === 'D'), E = out.find(b => b.lado === 'E'), A = out.find(b => b.lado === 'A');
    return D && E ? [D, E] : A ? [A] : D ? [D] : E ? [E] : [];
  },
  ehRepouso(b, pid) { return pid == null || pid === b.repouso || this.REPOUSO.test(this.sa(b.nomes[pid])); },
  // ids de todas as sessões de braço do personagem (todas as vistas)
  idsBraco(def) { const S = new Set(); for (const v of [def, ...(def.vistas || [])]) for (const s of v.sessoes || []) { const nm = this.sa(s.nome); if (this.SESSAO.test(nm) && !this.ROSTO.test(nm)) S.add(s.id); } return S; },
  // chave que só mexe no rosto (boca pela voz, olhos), sem dur: dá para pôr o gesto nela junto
  soRosto(def, k) {
    if (!k || k.dur != null || Object.keys(k).some(c => c !== 'sessoes' && c !== 'partes')) return false;
    if (typeof Vida !== 'undefined' && Vida.soRosto) return Vida.soRosto(def, k);
    const S = new Set(); for (const v of [def, ...(def.vistas || [])]) for (const s of v.sessoes || []) if (this.ROSTO.test(this.sa(s.nome))) S.add(s.id);
    return !k.partes && !!k.sessoes && Object.keys(k.sessoes).every(id => S.has(id));
  },
  escondido(P, n, q) { return n.vis === false || !Modelo.aparece(P, n, q) || (Modelo.transf(n, q).op ?? 1) < .05; },
  // palavra de ÊNFASE: longa, fim de frase, número, nome próprio, MAIÚSCULA, depois de vírgula/ponto, ou palavra-chave do ritmo
  enfase(pal, i) {
    const R = this.R(), p = pal[i], t = String(p.t || ''), w = R ? R.limpaPal(t) : t, ant = i > 0 ? String(pal[i - 1].t || '') : '';
    return !!(p.chave || w.length >= 6 || /[.!?…]["')\]]*$/.test(t) || /\d/.test(w) || (R && w.length >= 2 && R.caps(w)) || (i > 0 && /^[A-ZÀ-Ý]/.test(w) && !/[.!?…:]["')\]]*$/.test(ant)) || (i > 0 && /[,;:.!?…]["')\]]*$/.test(ant)));
  },

  // ---------- medidas (precisam de Rig e DOMMatrix: navegador, ou node com polyfill) ----------
  pode() { return typeof Rig !== 'undefined' && typeof DOMMatrix !== 'undefined'; },
  // o membro (braço › antebraço › mão) que a sessão mexe
  cadeiaDe(dv, sid) {
    const s = (dv.sessoes || []).find(x => x.id === sid); if (!s) return null; const ps = new Set(s.partes || []); for (const pr of s.presets || []) for (const id of Object.keys(pr.estado || {})) ps.add(id);
    return Rig.cadeias(dv).filter(c => c.tipo === 'braco').find(c => ps.has(c.fim) || ps.has(c.meio) || ps.has(c.raiz)) || null;
  },
  // estado das partes como é DESENHADO no quadro q (Render.estadoPartes: tween, trava, atuação, vida, controles); sem Render, o mesmo caminho à mão
  estado(P, n, q) {
    if (typeof Render !== 'undefined' && Render.estadoPartes) { const r = Render.estadoPartes(P, n, q); return r && { dv: r.dv, ep: r.ep }; }
    const def = P.personagens[n.ref]; if (!def) return null; const est = Modelo.estadoPersonagem(n, q), dv = Modelo.naVista(def, est.vista); let ep = Modelo.partesNoEstado(dv, est);
    if (n.suaveP) ep = Rig.tween(P, n, q, dv, ep); if (P.rive) ep = Rig.trava(dv, ep, { vistas: true }); return { dv, ep };
  },
  matNo(P, n, q) {
    if (typeof Render !== 'undefined' && Render.matNo) return Rig.matNo(P, n, q);
    const t = Modelo.transf(n, q); return new DOMMatrix().translate(t.x || 0, t.y || 0).rotate(t.r || 0).scale((t.s ?? 1) * (t.sx || 1), t.s ?? 1);
  },
  // ponto do mundo → tela (px do vídeo) com a câmera do quadro q (zoom do ritmo incluído)
  tela(P, q, p) { const c = Modelo.camera(P, q), z = c.zoom || 1, a = -(c.r || 0) * Math.PI / 180, dx = p.x - c.x, dy = p.y - c.y; return { x: P.w / 2 + z * (dx * Math.cos(a) - dy * Math.sin(a)), y: P.h / 2 + z * (dx * Math.sin(a) + dy * Math.cos(a)), z }; },
  // a mão no quadro q: { vis, p (tela), r (giro do antebraço) }
  mao(P, n, q, sid) {
    const st = this.estado(P, n, q); if (!st) return null; const cad = this.cadeiaDe(st.dv, sid); if (!cad) return null;
    const vis = Rig.visivel(st.dv, st.ep, cad.fim), J = Rig.juntas(st.dv, st.ep); let c = null; if (vis) try { c = Rig.centroTinta(st.dv, st.ep, cad.fim); } catch { c = null; }
    const pt = c || J[cad.fim]; if (!pt) return null; const w = this.matNo(P, n, q).transformPoint(new DOMPoint(pt.x, pt.y));
    return { vis, p: this.tela(P, q, w), r: +(st.ep[cad.meio]?.r || 0) };
  },
  // caixa (tela) dos outros personagens visíveis no quadro q
  vizinhos(P, n, q) {
    const out = [];
    for (const o of Modelo.noQuadro(P, q)) { if (o.id === n.id || (Modelo.transf(o, q).op ?? 1) < .05) continue; const st = this.estado(P, o, q); if (!st) continue;
      let b = null; try { b = Modelo.caixaPersonagem(st.dv, st.ep); } catch { b = null; } if (!b) continue; const M = this.matNo(P, o, q);
      const L = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => this.tela(P, q, M.transformPoint(new DOMPoint(x, y))));
      out.push({ x0: Math.min(...L.map(p => p.x)), x1: Math.max(...L.map(p => p.x)), y0: Math.min(...L.map(p => p.y)), y1: Math.max(...L.map(p => p.y)) }); }
    return out;
  },
  dist(p, b) { const dx = Math.max(b.x0 - p.x, 0, p.x - b.x1), dy = Math.max(b.y0 - p.y, 0, p.y - b.y1); return Math.hypot(dx, dy); },
  // o nó com as chaves já aceitas + as do episódio (sem mexer no nó de verdade)
  comChaves(n, L) {
    const ch = {}; for (const [q, k] of Object.entries(n.chaves || {})) ch[q] = k;
    for (const e of L) { const k0 = ch[e.q] || {}; ch[e.q] = { ...k0, sessoes: { ...(k0.sessoes || {}), [e.sessao]: e.preset }, ...(k0.dur == null ? { dur: e.dur || 10 } : {}) }; }
    return { ...n, chaves: ch };
  },
  // SIMULA um episódio (subida, segura, descida) quadro a quadro com o desenho real: { ok, motivo, pulo }
  testaEpisodio(P, n, L, ep) {
    if (!this.pode()) return { ok: true, pulo: 0 };
    const tmp = this.comChaves(n, L), q0 = Math.max(0, ep.sobe - ep.durSobe - 1), q1 = Math.min((P.duracao || 1) - 1, ep.desce);
    // sem chave de pose antes, o planeja põe a ÂNCORA de repouso no fim: aqui ela entra já, para medir igual ao que vai ficar
    const def = P.personagens[n.ref], semVida = !(typeof Vida !== 'undefined' ? Vida.ligada(P, n) : P.vida);
    if (def && !Object.entries(tmp.chaves).some(([q, k]) => +q < ep.sobe && (k.sessoes || k.partes || k.vista !== undefined) && (semVida || !this.soRosto(def, k)))) {
      const k0 = tmp.chaves[q0] || {}; tmp.chaves[q0] = { ...k0, sessoes: { ...(k0.sessoes || {}), [ep.sessao]: Modelo.estadoPersonagem(tmp, q0).sessoes[ep.sessao] ?? null } }; }
    const M = []; for (let q = q0; q <= q1; q++) { const m = this.mao(P, tmp, q, ep.sessao); if (!m) return { ok: true, pulo: 0, motivo: 'sem braço para medir' }; M.push({ q, ...m }); }
    const a = M[0], g = M.find(m => m.q === ep.sobe) || M[M.length - 1]; let pulo = 0;
    // 1) a mão existe em TODO quadro (se existe no repouso ou no gesto)
    if (M.some(m => m.vis) && M.some(m => !m.vis)) return { ok: false, motivo: `a mão some no quadro ${M.find(m => !m.vis).q}` };
    // 2) punho solto: antebraço girando mais de 35° do repouso
    const giro = Math.abs(((g.r - a.r + 540) % 360) - 180); if (giro > this.GIRO) return { ok: false, motivo: `antebraço gira ${Math.round(giro)}°` };
    for (let i = 0; i < M.length; i++) { const m = M[i];
      // 3) borda do vídeo (com a câmera e o zoom deste quadro)
      if (m.p.x < this.BORDA || m.p.x > P.w - this.BORDA || m.p.y < this.BORDA || m.p.y > P.h - this.BORDA) return { ok: false, motivo: `mão a menos de ${this.BORDA} px da borda (q ${m.q})` };
      // 4) pulo da mão (num corte de câmera não mede: o pulo é da câmera, não da mão)
      if (i) { const b = M[i - 1], d = b.p.z === m.p.z ? Math.hypot(m.p.x - b.p.x, m.p.y - b.p.y) : 0; pulo = Math.max(pulo, d); if (d > this.PULO) return { ok: false, motivo: `mão anda ${Math.round(d)} px num quadro (q ${m.q})`, pulo: d }; } }
    // 5) vizinho: a mão não chega a menos de 40 px de outro personagem (mais perto que no repouso) nem vai para o lado dele
    for (const qv of [...new Set([a.q, g.q, M[M.length - 1].q])]) { const V = this.vizinhos(P, n, qv); if (!V.length) continue;
      for (const m of M) for (const b of V) { if (m === a) continue; const d = this.dist(m.p, b); if (d < this.VIZINHO && d < this.dist(a.p, b) - 1) return { ok: false, motivo: `mão a ${Math.round(d)} px de outro personagem (q ${m.q})` }; }
      const perto = V.reduce((x, b) => (!x || Math.abs((b.x0 + b.x1) / 2 - a.p.x) < Math.abs((x.x0 + x.x1) / 2 - a.p.x)) ? b : x, null), lado = Math.sign((perto.x0 + perto.x1) / 2 - a.p.x);
      if ((g.p.x - a.p.x) * lado > 15) return { ok: false, motivo: 'a mão vai para o lado do vizinho' }; }
    return { ok: true, pulo };
  },
  // a mão andando de A para B em dur quadros (só o personagem): maior passo por quadro e o tamanho do caminho (px do vídeo, sem câmera)
  passo(P, n, dv, est, A, B, dur, sid) {
    if (!this.pode()) return { pico: 0, tam: 0 };
    const cad = this.cadeiaDe(dv, sid); if (!cad) return { pico: 0, tam: 0 };
    const Q = 1000, vis = est.vista != null ? { vista: est.vista } : {};
    const tmp = { ...n, chaves: { 0: { ...vis, sessoes: { ...A }, ...(est.partes && Object.keys(est.partes).length ? { partes: est.partes } : {}) }, [Q]: { sessoes: { ...B }, dur } } };
    const t = Modelo.transf(n, 0), esc = Math.abs((t.s || 1) * (t.sx || 1)) || 1; let ant = null, pico = 0, ini = null, fim = null;
    for (let q = Q - dur - 1; q <= Q; q++) { const e = Modelo.estadoPersonagem(tmp, q); let ep = Modelo.partesNoEstado(dv, e); ep = Rig.tween(P, tmp, q, dv, ep); if (P.rive) ep = Rig.trava(dv, ep, { vistas: true });
      let J = null; if (Rig.visivel(dv, ep, cad.fim)) try { J = Rig.centroTinta(dv, ep, cad.fim); } catch { J = null; } // o mesmo ponto que o teste mede (meio da mão)
      J ||= Rig.juntas(dv, ep)[cad.fim]; if (!J) continue; if (ant) pico = Math.max(pico, Math.hypot(J.x - ant.x, J.y - ant.y) * esc); if (!ini) ini = J; fim = J; ant = J; }
    return { pico, tam: ini && fim ? Math.hypot(fim.x - ini.x, fim.y - ini.y) * esc : 0 };
  },
  // duração pelo tamanho: 8 q até ~60 px de caminho … 16 q a partir de ~300 px; cresce até a mão não passar de 45 px/q; null = nenhuma serve
  duracao(P, n, dv, est, A, B, sid) {
    if (!this.pode()) return 10; let m; try { m = this.passo(P, n, dv, est, A, B, this.DUR_MAX, sid); } catch { return 10; }
    let d = Math.max(this.DUR_MIN, Math.min(this.DUR_MAX, Math.round(this.DUR_MIN + (m.tam - 60) / 30)));
    for (; d <= this.DUR_MAX; d++) { let p = 0; try { p = this.passo(P, n, dv, est, A, B, d, sid).pico; } catch { p = 0; } if (p <= this.PULO) return d; }
    return null;
  },

  // ---------- o plano ----------
  planeja(P, o = {}) {
    const plano = {}, R = this.R(); if (!P?.rive || !R) return plano;
    const falas = R.falas(P, o).filter(f => f.ate >= f.de), fim = Math.max(0, (P.duracao || 1) - 1), fps = P.fps || 24;
    const tr = new Map();
    for (const f of falas) for (const quem of (f.quens.length ? f.quens : [f.quem])) {
      const n = R.noDe(P, quem); if (!n || !P.personagens?.[n.ref]) continue;
      if (this.escondido(P, n, Math.round((f.de + f.ate) / 2))) continue; // voz de fora: não está no palco
      (tr.get(n) || tr.set(n, []).get(n)).push({ de: f.de, ate: f.ate, pal: f.pal });
    }
    for (const [n, L] of tr) {
      const def = P.personagens[n.ref]; L.sort((a, b) => a.de - b.de);
      const seg = []; for (const f of L) { const u = seg[seg.length - 1]; if (u && f.de - u.ate <= this.JUNTA) { u.ate = Math.max(u.ate, f.ate); u.pal = [...u.pal, ...f.pal]; } else seg.push({ de: f.de, ate: f.ate, pal: [...f.pal] }); }
      const ids = this.idsBraco(def), ocupado = new Set(Object.entries(n.chaves || {}).filter(([, k]) => !this.soRosto(def, k)).map(([q]) => +q));
      const maoBraco = Object.entries(n.chaves || {}).filter(([, k]) => k.sessoes && Object.keys(k.sessoes).some(id => ids.has(id))).map(([q]) => +q);
      // sem a vida automática, chave de boca é pose do corpo (Rig.chavesPose): uma no meio da transição encurtaria o movimento (a mão pularia)
      const semVida = !(typeof Vida !== 'undefined' ? Vida.ligada(P, n) : (n.vida !== false && (n.vida === true || P.vida))), todas = Object.keys(n.chaves || {}).map(Number);
      const janela = (q, d) => !semVida || !todas.some(k => k >= q - d && k < q);
      const livre = (q, d) => { for (let x = 0; x <= 3; x++) if (q + x <= fim && !ocupado.has(q + x) && janela(q + x, d)) return q + x; return null; };
      const out = []; let ult = -Infinity, livreDesde = (n.de || 0) + 1, nEp = 0; const ultB = {}, ultG = {};
      for (const s of seg) {
        if (maoBraco.some(q => q >= s.de - this.MIN && q <= s.ate + this.FIM + 2 * this.MIN_BRACO)) continue; // chave de braço feita à mão: pula o trecho
        const est0 = Modelo.estadoPersonagem(n, s.de), dv = Modelo.naVista(def, est0.vista);
        // repouso de cada braço = o que ele já tem (pose base ou preset de repouso); braço numa pose feita à mão (segurando algo…) fica de fora
        const B = this.bracos(dv).filter(b => this.ehRepouso(b, est0.sessoes[b.id])).map(b => ({ ...b, rep: est0.sessoes[b.id] ?? null }));
        if (!B.length) continue;
        const mesmaVista = q => (Modelo.estadoPersonagem(n, q).vista || null) === (est0.vista || null), base = { ...est0.sessoes, ...Object.fromEntries(B.map(b => [b.id, b.rep])) };
        // momentos: palavras de ênfase a 3+ palavras da anterior; sem palavras, a cada ~1,5 s
        const pal = s.pal.filter(p => p.q0 >= s.de && p.q0 <= s.ate).sort((a, b) => a.q0 - b.q0);
        const momentos = []; if (pal.length) { let last = -Infinity; for (let i = 0; i < pal.length; i++) if (i - last >= this.CADA && this.enfase(pal, i)) { momentos.push({ q0: pal[i].q0, q1: pal[i].q1 }); last = i; } }
        else for (let q = s.de; q <= s.ate; q += Math.round(fps * 1.5)) momentos.push({ q0: q, q1: q + 6 });
        let vez = this.hash(n.id + ':' + s.de) & 1;
        for (const m of momentos) for (let bi = 0; bi < B.length; bi++) { // o braço da vez; se nenhum gesto dele serve, o outro
          const b = B[(vez + bi) % B.length], chave = n.id + ':' + m.q0;
          // gestos deste braço, em rodízio, nunca o mesmo da última vez
          const G0 = b.gestos.filter(x => x !== ultG[b.id]), Gs = G0.length ? G0 : b.gestos, i0 = this.hash(chave) % Gs.length;
          let feito = false;
          for (let gi = 0; gi < Gs.length && !feito; gi++) {
            const alvo = Gs[(i0 + gi) % Gs.length], Bv = { ...base, [b.id]: alvo };
            const durS = this.duracao(P, n, dv, est0, base, Bv, b.id); if (durS == null) { (o.rejeitados ||= []).push({ no: n.nome, q: m.q0, preset: b.nomes[alvo], motivo: 'a mão andaria >45 px num quadro mesmo em 16 q' }); continue; } // gesto grande demais
            let sobe = Math.max(m.q0 + this.ATRASO, livreDesde + durS, ult + this.MIN, (ultB[b.lado] ?? -Infinity) + this.MIN_BRACO, (n.de || 0) + durS + 1);
            if (sobe > Math.max(m.q1, m.q0 + 6) + 6 || sobe > s.ate - 4) break; // longe demais da palavra: este momento fica sem gesto
            sobe = livre(sobe, durS); if (sobe == null || !mesmaVista(sobe)) break;
            const durD = this.duracao(P, n, dv, est0, Bv, base, b.id) ?? this.DUR_MAX;
            let desce = Math.max(sobe + this.MIN_BRACO, sobe + this.sorte(chave + ':s', ...this.SEGURA) + durD); if (desce > s.ate + this.FIM) desce = Math.max(sobe + this.MIN_BRACO, s.ate + this.FIM);
            desce = desce <= fim ? livre(desce, durD) : null; if (desce == null || !mesmaVista(desce)) break;
            const E = [{ q: sobe, sessao: b.id, preset: alvo, braco: b.lado, dur: durS, ep: nEp }, { q: desce, sessao: b.id, preset: b.rep, braco: b.lado, dur: durD, ep: nEp }];
            if (o.teste) { const r = o.teste(n, [...out, ...E], { sessao: b.id, sobe, durSobe: durS, desce, durDesce: durD }); if (!r.ok) { (o.rejeitados ||= []).push({ no: n.nome, q: sobe, preset: b.nomes[alvo], motivo: r.motivo }); continue; } }
            out.push(...E); nEp++; ocupado.add(sobe); ocupado.add(desce); feito = true; ultG[b.id] = alvo;
            ult = desce; ultB[b.lado] = desce; if (b.lado === 'A') ultB.D = ultB.E = desce;
            // repouso até o próximo: pausa de 6–30 q, e pelo menos 0,8 do episódio (repouso em ~45% do tempo)
            livreDesde = desce + Math.max(this.sorte(chave + ':p', ...this.PAUSA), Math.round((desce - sobe + durS) * this.REPOUSO_MIN));
            vez = (vez + bi) + 1;
          }
          if (feito) break;
        }
      }
      if (!out.length) continue; out.sort((a, b) => a.q - b.q);
      // ÂNCORA: sem nenhuma chave de pose antes do 1º gesto, o Rig.tween não tem de onde sair e o braço pularia na hora. Uma chave com o
      // repouso (o mesmo de agora: nada muda na tela) antes da transição dá o ponto de partida.
      const q1 = out[0].q, poseAntes = Object.entries(n.chaves || {}).some(([q, k]) => +q < q1 && (k.sessoes || k.partes || k.vista !== undefined) && (semVida || !this.soRosto(def, k)));
      if (!poseAntes) { const e0 = Modelo.estadoPersonagem(n, q1); let qa = null;
        for (let q = q1 - (out[0].dur || this.DUR_MAX) - 1; q >= Math.max(n.de || 0, 0); q--) if (!ocupado.has(q)) { qa = q; break; }
        if (qa != null) out.unshift(...[...new Set(out.map(e => e.sessao))].map(sid => ({ q: qa, sessao: sid, preset: e0.sessoes[sid] ?? null, braco: out.find(e => e.sessao === sid).braco, ancora: true }))); }
      plano[n.id] = out;
    }
    return plano;
  },
  // o testador do navegador (desenho real), para planeja(P, { teste }); null sem Rig/DOMMatrix
  testador(P) { return this.pode() ? (n, L, ep) => { try { return this.testaEpisodio(P, n, L, ep); } catch (e) { console.warn('gestos: teste', e); return { ok: false, motivo: 'erro ao medir' }; } } : null; },
  // confere o plano inteiro de novo (todos os episódios juntos) e tira o episódio que falha: { plano, rejeitados }
  valida(P, plano) {
    const rej = []; if (!this.pode()) return { plano, rejeitados: rej };
    for (const [id, L] of Object.entries(plano)) {
      const n = Modelo.achar(P, id)?.no; if (!n) continue; const eps = [...new Set(L.filter(e => e.ep != null).map(e => e.ep))];
      for (const k of eps) { const [s, d] = L.filter(e => e.ep === k); let r;
        try { r = this.testaEpisodio(P, n, L, { sessao: s.sessao, sobe: s.q, durSobe: s.dur, desce: d.q, durDesce: d.dur }); } catch (e) { r = { ok: false, motivo: 'erro ao medir' }; }
        if (!r.ok) { rej.push({ no: n.nome, q: s.q, preset: this.nomePreset(P.personagens[n.ref], s.sessao, s.preset), motivo: r.motivo }); for (const e of [s, d]) L.splice(L.indexOf(e), 1); } }
      if (!L.some(e => !e.ancora)) delete plano[id];
    }
    return { plano, rejeitados: rej };
  },
  nomePreset(def, sid, pid) { for (const v of [def, ...(def?.vistas || [])]) { const s = (v.sessoes || []).find(x => x.id === sid), p = s?.presets?.find(x => x.id === pid); if (p) return p.nome; } return pid == null ? '(pose base)' : pid; },

  // ---------- pôr e tirar ----------
  // aplica: chave nova = { sessoes, dur }; num quadro que só tinha chave de ROSTO (boca pela voz), entra a sessão (e o dur, se não tinha)
  aplica(P, plano) {
    const G = P.gestosAuto ||= {}; let n0 = 0;
    for (const [id, L] of Object.entries(plano || {})) {
      const n = Modelo.achar(P, id)?.no; if (!n) continue; n.chaves ||= {}; const novas = new Set(), G2 = G[id] ||= [];
      for (const e of L) {
        let k = n.chaves[e.q], dur = false;
        if (!k) { k = n.chaves[e.q] = { sessoes: {}, dur: e.dur || this.DUR }; novas.add(e.q); }
        else if (!novas.has(e.q)) { if (k.sessoes && e.sessao in k.sessoes) continue; // já tem essa sessão feita por alguém: não sobrescreve
          if (k.dur == null) { k.dur = e.dur || this.DUR; dur = true; } }
        (k.sessoes ||= {})[e.sessao] = e.preset; G2.push({ q: e.q, sessao: e.sessao, preset: e.preset, ...(novas.has(e.q) ? { nova: true } : {}), ...(dur ? { dur: k.dur } : {}), ...(novas.has(e.q) ? { d: k.dur } : {}) }); n0++;
      }
      if (!G2.length) delete G[id];
    }
    if (!Object.keys(G).length) delete P.gestosAuto;
    return { gestos: n0 };
  },
  tira(P) {
    const G = P?.gestosAuto; if (!G) return 0; let n0 = 0;
    for (const [id, L] of Object.entries(G)) {
      const n = Modelo.achar(P, id)?.no; if (!n?.chaves) continue;
      const porQ = new Map(); for (const e of L) (porQ.get(e.q) || porQ.set(e.q, []).get(e.q)).push(e);
      for (const [q, es] of porQ) {
        const k = n.chaves[q]; if (!k) continue; const nova = es.some(e => e.nova), nossas = new Set(es.map(e => e.sessao)), igual = e => !!k.sessoes && e.sessao in k.sessoes && k.sessoes[e.sessao] === e.preset;
        if (nova) { // chave que nós criamos: só sai se ninguém mexeu nela (só as nossas sessões, iguais, e o nosso dur); senão virou da pessoa e fica
          const dN = es.find(e => e.d)?.d ?? this.DUR, intacta = Object.keys(k).every(c => c === 'sessoes' || (c === 'dur' && k.dur === dN)) && Object.keys(k.sessoes || {}).every(s => nossas.has(s)) && es.every(igual);
          if (intacta) { delete n.chaves[q]; n0 += es.length; } continue; }
        // chave que já existia (boca): tira só as nossas sessões que ainda estão como pusemos, e o dur que pusemos
        let tirou = false; for (const e of es) if (igual(e)) { delete k.sessoes[e.sessao]; n0++; tirou = true; }
        if (k.sessoes && !Object.keys(k.sessoes).length) delete k.sessoes;
        const dP = es.find(e => e.dur)?.dur; if (tirou && dP != null && k.dur === dP) delete k.dur;
      }
    }
    delete P.gestosAuto; return n0;
  },
  tem(P) { return !!P?.gestosAuto && Object.values(P.gestosAuto).some(L => L?.length); },
};
if (typeof module !== 'undefined') module.exports = Gestos;
