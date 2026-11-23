/* ===================== gestos.js — GESTOS AUTOMÁTICOS NA FALA (pedido da dona, 23/11/2026: "as animações estão muito duras e paradas") =====================
   Quem está falando troca de gesto de braço a cada 1–2 palavras; quem não fala fica em repouso (a vida automática, js/vida.js, respira por cima).
   Regras do Estúdio (medidas e aprovadas):
   - Só gestos que JÁ EXISTEM: presets das sessões de braço do personagem ("Braço direito", "Braço esquerdo", "Braços", "Gestos v2"…).
     Fala: gestic|apont|abert|explic|mostr|palma|pergunt. Repouso: parad|padr|relax|descans|normal ou a pose base.
     NUNCA: queixo, óculos, cintura, acenar, comemorar, soco, dança, pulo, corrida, herói, segurar (reprovados na Clara ou são ação, não fala).
   - Cada troca é uma chave de SESSÃO (preset) com dur = 10–12: o Rig.tween faz o movimento nesses quadros antes da chave, com easing de entrada
     e saída (sem curva contínua). Antes de escolher, MEDE a mão simulando o próprio Rig.tween (Gestos.pico): gesto em que a mão andaria
     60 px ou mais num quadro (pulo >70 px, 19/11) não entra; na volta ao repouso usa a duração que deixa a mão abaixo disso (até 12). Nunca escreve partes (a imagem da mão vem com o preset; trocar a imagem por fora prendia a mão, 19/11).
   - Mínimo de 14 quadros entre duas trocas do mesmo personagem; o MESMO braço só troca de novo depois de 24 quadros (a mão pulava >70 px/q,
     19/11); os braços se alternam: direito vai ao gesto, depois o esquerdo, depois o direito volta ao repouso… (sempre repouso ⇄ gesto).
   - No fim da fala (8 quadros depois) volta ao repouso. Chave de braço feita à mão perto da fala = aquele trecho fica sem gestos.
     Nunca grava num quadro que já tem chave (vista, posição, boca e chaves feitas à mão ficam intactas).
   - Personagem escondido na fala (opacidade 0: "voz de fora", js/prep.js) não gesticula.
   Tudo o que entra fica anotado em P.gestosAuto = { [noId]: [{ q, sessao, preset, nova }] }: Gestos.tira tira só isso (chave inteira se ficar
   vazia); a chave gerada que alguém mudou passa a ser dela e fica. Rodar de novo = tira e refaz (Ritmo.rodar faz os dois num passo do desfazer).
   Gestos.planeja(P, o) é PURO (sem DOM): { [noId]: [{ q, sessao, preset, braco: 'D'|'E'|'A', ancora? }] } (âncora = chave que segura o repouso antes do 1º gesto, não é troca). o = { durDe(a) } como no Ritmo. */
'use strict';
const Gestos = {
  MIN: 14,        // quadros mínimos entre duas trocas do mesmo personagem
  MIN_BRACO: 24,  // quadros mínimos entre duas trocas do MESMO braço
  DUR: 10,        // quadros de transição (chave.dur, Rig.tween); vai até DUR_MAX se a mão andaria rápido demais
  DUR_MAX: 12,
  PULO: 60,       // maior passo da mão por quadro aceito (px do vídeo; >70 = "a mão pula", medido 19/11; 60 dá folga para a respiração)
  ATRASO: 5,      // a chave fica 5 quadros depois do começo da palavra: o movimento começa ~5 antes e chega logo depois (o gesto "bate" na palavra)
  FIM: 8,         // volta ao repouso 8 quadros depois do fim da fala
  JUNTA: 12,      // falas do mesmo personagem com menos que isso entre elas viram um trecho só (não desce o braço no meio)
  BOM: /gestic|apont|abert|explic|mostr|palma|pergunt/,
  REPOUSO: /parad|padr|relax|descans|normal/,
  NUNCA: /queixo|oculos|cintura|acen|comemor|soco|dan|pul|corr|her|segur/,
  SESSAO: /braco|gest/,
  ROSTO: /boca|olho|sobrancel|pupila|express|rosto|mouth|eye|brow|face|blush/,

  sa: s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(),
  R() { return typeof Ritmo !== 'undefined' ? Ritmo : (typeof require === 'function' ? require('./ritmo.js') : null); },
  hash(s) { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; },

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
  // MAIOR PASSO DA MÃO por quadro (px do vídeo) numa troca de sessões de A para B em dur quadros, simulando o próprio Rig.tween (com o
  // atraso de cada nível, o easing e a trava das juntas). Sem Rig/DOMMatrix (node sem polyfill) devolve 0: não dá para medir.
  pico(P, n, dv, est, A, B, dur) {
    if (typeof Rig === 'undefined' || typeof DOMMatrix === 'undefined') return 0;
    const fins = Rig.cadeias(dv).filter(c => c.tipo === 'braco').map(c => c.fim); if (!fins.length) return 0;
    const vis = est.vista !== undefined && est.vista !== null ? { vista: est.vista } : {}, Q = 1000;
    const tmp = { id: n.id, tipo: 'personagem', ref: n.ref, vida: n.vida, suaveP: true, interp: true, chaves: { 0: { ...vis, sessoes: { ...A }, ...(est.partes && Object.keys(est.partes).length ? { partes: est.partes } : {}) }, [Q]: { sessoes: { ...B }, dur } } };
    const t = Modelo.transf(n, 0), esc = Math.abs((t.s || 1) * (t.sx || 1)) || 1; let ant = null, mx = 0;
    for (let q = Q - dur - 1; q <= Q; q++) { const e = Modelo.estadoPersonagem(tmp, q); let ep = Modelo.partesNoEstado(dv, e); ep = Rig.tween(P, tmp, q, dv, ep); if (P.rive) ep = Rig.trava(dv, ep, { vistas: true });
      const J = Rig.juntas(dv, ep); if (ant) for (const f of fins) if (J[f] && ant[f]) mx = Math.max(mx, Math.hypot(J[f].x - ant[f].x, J[f].y - ant[f].y) * esc); ant = J; }
    return mx;
  },
  // a menor duração (DUR…DUR_MAX) em que a mão não pula; null = nenhuma serve
  durOk(P, n, dv, est, A, B) { for (let d = this.DUR; d <= this.DUR_MAX; d++) { let p = 0; try { p = this.pico(P, n, dv, est, A, B, d); } catch (e) { p = 0; } if (p < this.PULO) return d; } return null; },
  escondido(P, n, q) { return n.vis === false || !Modelo.aparece(P, n, q) || (Modelo.transf(n, q).op ?? 1) < .05; },

  // ---------- o plano (PURO) ----------
  planeja(P, o = {}) {
    const plano = {}, R = this.R(); if (!P?.rive || !R) return plano;
    const falas = R.falas(P, o).filter(f => f.ate >= f.de), fim = Math.max(0, (P.duracao || 1) - 1), fps = P.fps || 24;
    // trechos de fala de cada personagem
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
      const out = []; let ult = -Infinity; const ultB = { D: -Infinity, E: -Infinity };
      // sem a vida automática, chave de boca é pose do corpo (Rig.chavesPose): uma no meio da transição encurtaria o movimento (a mão pularia)
      const semVida = !(typeof Vida !== 'undefined' ? Vida.ligada(P, n) : (n.vida !== false && (n.vida === true || P.vida))), todas = Object.keys(n.chaves || {}).map(Number);
      const janela = q => !semVida || !todas.some(k => k >= q - this.DUR_MAX && k < q);
      const livre = q => { for (let d = 0; d <= 3; d++) if (q + d <= fim && !ocupado.has(q + d) && janela(q + d)) return q + d; return null; };
      const quando = lado => lado === 'A' ? Math.max(ultB.D, ultB.E) : ultB[lado];
      const marca = (lado, q) => { if (lado === 'A') ultB.D = ultB.E = q; else ultB[lado] = q; };
      for (const s of seg) {
        // chave de braço feita à mão perto deste trecho: pula o trecho inteiro
        if (maoBraco.some(q => q >= s.de - this.MIN && q <= s.ate + this.FIM + this.MIN_BRACO + this.MIN)) continue;
        const est0 = Modelo.estadoPersonagem(n, s.de), dv = Modelo.naVista(def, est0.vista);
        // repouso de cada braço = o que ele já tem (pose base ou preset de repouso); braço numa pose feita à mão (segurando algo…) fica de fora
        const B = this.bracos(dv).filter(b => this.ehRepouso(b, est0.sessoes[b.id])).map(b => ({ ...b, rep: est0.sessoes[b.id] ?? null, agora: est0.sessoes[b.id] ?? null, ult: null }));
        if (!B.length) continue;
        const mesmaVista = q => (Modelo.estadoPersonagem(n, q).vista || null) === (est0.vista || null);
        const loc = [], base = { ult, D: ultB.D, E: ultB.E };
        const refaz = () => { ult = base.ult; ultB.D = base.D; ultB.E = base.E; for (const b of B) b.agora = b.rep;
          for (const x of loc) { ult = Math.max(ult, x.q); marca(x.braco, x.q); B.find(b => b.id === x.sessao).agora = x.preset; } };
        // momentos candidatos: começo de palavra, a cada 1 ou 2 palavras (sorteio fixo); sem palavras, a cada ~0,6 s
        const pal = s.pal.filter(p => p.q0 >= s.de && p.q0 <= s.ate).sort((a, b) => a.q0 - b.q0);
        const cands = []; if (pal.length) { let i = 0, k = this.hash(n.id + ':' + s.de); while (i < pal.length) { cands.push(pal[i].q0 + this.ATRASO); i += 1 + (k & 1); k = this.hash(k + ':' + i); } }
        else for (let q = s.de + this.ATRASO; q <= s.ate; q += Math.round(fps * .6)) cands.push(q);
        let vez = this.hash(n.id) & 1 ? 1 : 0; // por qual braço começar
        for (const c of cands) {
          if (c > s.ate - 4) break; // gesto que só começaria no fim da fala não entra
          let q = Math.max(c, ult + this.MIN, (n.de || 0) + this.DUR_MAX + 1); if (q > s.ate - 4) break; // + espaço para a âncora antes da 1ª transição
          // alterna os braços; o braço escolhido precisa de 24 quadros desde a última troca dele
          const ordem = B.length === 2 ? [B[vez % 2], B[(vez + 1) % 2]] : [B[0]];
          let b = null; for (const x of ordem) { const qq = Math.max(q, quando(x.lado) + this.MIN_BRACO); if (qq <= s.ate - 4) { b = x; q = qq; break; } }
          if (!b) continue; q = livre(q); if (q == null || q > s.ate || !mesmaVista(q)) continue;
          let alvo = null, dur = null; const agora = Object.fromEntries(B.map(x => [x.id, x.agora])), com = v => ({ ...est0.sessoes, ...agora, [b.id]: v });
          if (b.agora === b.rep) { // do repouso para um gesto (em rodízio, nunca o mesmo da última vez), o 1º em que a mão não pula
            const g = b.gestos.filter(x => x !== b.ult), L = g.length ? g : b.gestos, i0 = this.hash(n.id + ':' + q) % L.length;
            for (let i = 0; i < L.length && alvo == null; i++) { const x = L[(i0 + i) % L.length], d = this.durOk(P, n, dv, est0, com(b.agora), com(x)); if (d != null) { alvo = x; dur = d; } }
            if (alvo == null) continue; b.ult = alvo; }
          else { alvo = b.rep; dur = this.durOk(P, n, dv, est0, com(b.agora), com(alvo)) ?? this.DUR_MAX; } // de gesto volta ao repouso (não pula de gesto para gesto)
          loc.push({ q, sessao: b.id, preset: alvo, braco: b.lado, dur }); ocupado.add(q); b.agora = alvo; marca(b.lado, q); ult = q;
          if (B.length === 2) vez = B.indexOf(b) + 1;
        }
        // fim da fala: quem ficou no gesto volta ao repouso (uma chave só; respeita 14 q do personagem e 24 q de cada braço)
        for (let g = 0; g < 20; g++) {
          const fora = B.filter(b => b.agora !== b.rep); if (!fora.length) break;
          let q = Math.max(s.ate + this.FIM, ult + this.MIN, ...fora.map(b => quando(b.lado) + this.MIN_BRACO)); q = q <= fim ? livre(q) : null;
          if (q != null && mesmaVista(q)) { const agora = { ...est0.sessoes, ...Object.fromEntries(B.map(x => [x.id, x.agora])) }, A2 = { ...agora, ...Object.fromEntries(fora.map(b => [b.id, b.rep])) };
            const dur = this.durOk(P, n, dv, est0, agora, A2) ?? this.DUR_MAX;
            for (const b of fora) { loc.push({ q, sessao: b.id, preset: b.rep, braco: b.lado, dur }); b.agora = b.rep; marca(b.lado, q); } ocupado.add(q); ult = q; break; }
          // sem lugar para voltar (fim da animação, troca de vista): o último gesto sai e tenta de novo
          const u = loc.pop(); if (!u) break; ocupado.delete(u.q); refaz(); }
        out.push(...loc);
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
