/* ===================== vida.js — VIDA AUTOMÁTICA do personagem (pedido da dona, 23/11/2026) =====================
   "As animações estão muito duras e paradas": o personagem precisa respirar e piscar sozinho, sem ninguém gravar chave.
   Tudo é calculado na hora, pelo número do quadro (prévia e vídeo exportado dão o mesmo resultado); nada muda nas chaves.
   - RESPIRAÇÃO: corpo ±0,6° + peito subindo 0,6% em 3 s e cabeça ±1,5° em 4 s (walt-disney, 14/11 e medido em 23/11), fase diferente
     para cada personagem; as pernas presas no corpo compensam o giro (os pés não patinam).
   - PISCAR: a cada 3 a 4,2 s (sorteio fixo por personagem): meio fechado → fechado → meio fechado (~170 ms). Pisca de qualquer
     expressão aberta (Sério, Inocente, Olhando p/…), nunca das que já fecham (Fechado, Feliz ^^, Rindo…); troca só o desenho do
     olho (a sobrancelha fica a da expressão); nunca no primeiro segundo nem a 3 quadros de uma chave que troca os olhos.
     Clara nunca fecha o olho por completo (regra da dona): ela só semicerra. Outro personagem: def.vida = { piscar: 'meio' | false }.
   - Junto (js/rig.js): chave só de rosto (boca, olhos) NÃO conta como pose do corpo (o corpo não freia a cada sílaba), e cachecol,
     capa, capuz e cabelo preso não atrasam sozinhos (regra de 19/11: o cachecol segue o tronco).
   Vale por padrão nas animações criadas a partir de 23/11/2026 (P.vida); nas outras, liga no personagem (n.vida = true).
   n.vida = false desliga. */
'use strict';

const Vida = {
  ligada(P, n) { return !!(P && P.rive && n && n.vida !== false && (n.vida === true || P.vida)); },
  sem(id, k) { let h = 2166136261; for (const ch of String(id) + ':' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000; },
  semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); },
  ROSTO_SESSAO: /boca|olho|sobrancel|pupila|express|fala|rosto|mouth|eye|brow|face|blush/,
  ACESSORIO_FIXO: /cachecol|capa\b|capuz|cabelo|franja|mecha|trança|tranca|rabo de cavalo|scarf|cape|hood|hair/,
  ehAcessorio(p) { return !!p && this.ACESSORIO_FIXO.test(this.semAcento(p.nome)); },

  // ids das sessões de rosto do personagem (todas as vistas)
  _ros: new WeakMap(),
  sessoesRosto(def) { let S = this._ros.get(def); if (S) return S; S = new Set();
    const olha = L => { for (const s of L || []) if (this.ROSTO_SESSAO.test(this.semAcento(s.nome))) S.add(s.id); };
    olha(def.sessoes); for (const v of def.vistas || []) olha(v.sessoes); this._ros.set(def, S); return S; },
  // chave que só mexe no rosto (boca/olhos): não é pose do corpo
  soRosto(def, c) {
    if (!def || !c || c.vista !== undefined) return false; if (!c.sessoes && !c.partes) return false;
    const S = this.sessoesRosto(def); if (c.sessoes && Object.keys(c.sessoes).some(id => !S.has(id))) return false;
    if (c.partes) { const porId = this._porId(def); for (const pid of Object.keys(c.partes)) { const p = porId[pid]; if (!p || !Rig.ROSTO.test(p.nome || '')) return false; } }
    return true; },
  _pid: new WeakMap(),
  _porId(def) { let m = this._pid.get(def); if (!m || m.n !== def.partes.length) { m = { n: def.partes.length, m: {} }; for (const p of def.partes) m.m[p.id] = p; for (const v of def.vistas || []) for (const p of v.partes || []) m.m[p.id] = p; this._pid.set(def, m); } return m.m; },

  /* ---------- PISCAR ---------- */
  // momentos (em quadros) em que o personagem começa a piscar, sorteio fixo por personagem (3 a 4,2 s entre um e outro)
  _pisc: new Map(),
  piscadas(id, fps, ate) { const ch = id + '|' + fps; let L = this._pisc.get(ch); if (!L) this._pisc.set(ch, L = { q: [], t: 1 + this.sem(id, 'p0') * 2 });
    while (L.t * fps <= ate + fps * 5) { L.q.push(Math.round(L.t * fps)); L.t += 3 + this.sem(id, 'p' + L.q.length) * 1.2; } return L.q; },
  sessaoOlhos(dv) { return (dv.sessoes || []).find(s => /olho|eye/.test(this.semAcento(s.nome))) || null; },
  presetPor(s, re) { return (s.presets || []).find(p => re.test(this.semAcento(p.nome))) || null; },
  // pode piscar a partir desta expressão? (Sério, Inocente, Olhando p/…, Bravo, Surpreso… sim; as que já fecham o olho, não)
  // teste no Short "A sala INTEIRA" (23/11): os olhos quase nunca ficam em "Aberto" — ficam em Sério/Inocente/Olhando p/…
  // walt-disney (23/11, medido): olho REDONDO (susto, inocente) piscando vira cara de bravo no meio do susto → não pisca;
  // quem só semicerra (Clara) só pisca a partir de olho aberto/normal — na base de pálpebra baixa o "meio fechado" ABRIA o olho (+23%)
  podePiscar(s, id, modo) { const p = id ? (s.presets || []).find(x => x.id === id) : null; const nm = this.semAcento(p?.nome || 'aberto');
    if (/surpres|assust|espant|inocent|arregal|medo|choc/.test(nm)) return false;
    if (modo === 'meio') return /abert|normal|padrao|neutr|preocup|trist|brav/.test(nm) && !/meio/.test(nm);
    if (/meio/.test(nm)) return true; // meio fechado: fecha de vez no piscar
    return !/fech|feliz|rind|piscad|revir|estrel|^\^|marejad|choran|dormi/.test(nm); },
  ehOlho(p) { const nm = this.semAcento(p?.nome); return /olho|eye|palpebra|cilio|pupila/.test(nm) && !/sobrancel|brow/.test(nm); },
  modoPiscar(def) { if (def.vida && 'piscar' in def.vida) return def.vida.piscar; return /clara/.test(this.semAcento(def.nome)) ? 'meio' : 'fecha'; },
  piscarEm(P, n, q, def, dv, est) {
    const modo = this.modoPiscar(def); if (modo === false) return null;
    const s = this.sessaoOlhos(dv); if (!s) return null;
    const agora = est.sessoes?.[s.id]; if (!this.podePiscar(s, agora, modo)) return null;
    const fps = P.fps || 24, u = Math.max(1, Math.round(fps / 24)), tot = 4 * u, L = this.piscadas(n.id, fps, q);
    // chave que TROCA o olho (outra expressão) perto da piscada: a pose pedida manda. Chave que repete a mesma expressão não conta.
    // Caiu numa troca? a piscada anda 8 quadros (antes ela sumia: no teste de 23/11 o Problems ficou 16 s sem piscar)
    const ks = Modelo.quadrosChave(n), troca = t => { for (const k of ks) { if (k < t - 3 * u) continue; if (k > t + tot + 3 * u) break;
      const v = n.chaves[k]?.sessoes?.[s.id]; if (v !== undefined && v !== Modelo.estadoPersonagem(n, k - 1).sessoes?.[s.id]) return true; } return false; };
    let t0 = null; for (const b of L) { if (b > q) break; if (q - b < tot + 8 * u) t0 = b; } if (t0 == null) return null;
    if (troca(t0)) { t0 += 8 * u; if (troca(t0)) return null; }
    const d = q - t0; if (d < 0 || d >= tot) return null;
    if (!this.podePiscar(s, Modelo.estadoPersonagem(n, t0).sessoes?.[s.id], modo)) return null;
    const meio = this.presetPor(s, /meio/), fech = this.presetPor(s, /^(olhos? )?fechad/); // "Meio fechado" também tem "fechado": só o que COMEÇA com fechado
    const fase = d < u ? 'meio' : d < 3 * u ? 'fechado' : 'meio';
    const alvo = fase === 'meio' || modo === 'meio' ? (meio || null) : (fech || meio);
    return alvo ? { s, preset: alvo.id } : null;
  },

  /* ---------- aplica no estado das partes do quadro q (devolve um estado novo; o de entrada não muda) ---------- */
  aplica(P, n, q, dv, ep, est) {
    const def = P.personagens[n.ref]; if (!def || !ep) return ep;
    const out = {}; for (const [k, v] of Object.entries(ep)) out[k] = v ? { ...v } : v;
    const fps = P.fps || 24, t = q / fps, s0 = this.sem(n.id, 'r') * Math.PI * 2, s1 = this.sem(n.id, 'c') * Math.PI * 2;
    // respiração: corpo e cabeça
    const raiz = dv.partes.find(p => p.id === dv.raiz) || dv.partes.find(p => !p.pai);
    // walt-disney (23/11, medido): ±1° só de lado lia como "cadeira de balanço" (14 px pico a pico, 0,2 px em y) → 0,6° + o peito sobe 0,6% no mesmo ciclo
    const onda = Math.sin(t * Math.PI * 2 / 3 + s0), dr = onda * 0.6, sobe = 1 + Math.max(0, onda) * 0.006;
    if (raiz && out[raiz.id] && out[raiz.id].vis !== false) {
      const e = out[raiz.id]; e.r = (e.r || 0) + dr; e.s = (e.s ?? 1) * sobe; e.sx = (e.sx || 1) / sobe;
      for (const p of dv.partes) if (p.pai === raiz.id && out[p.id] && /perna|coxa|\bpe\b|leg/.test(this.semAcento(p.nome))) out[p.id].r = (out[p.id].r || 0) - dr; // pés no chão
    }
    const cab = dv.partes.find(p => /^cabe[çc]a/i.test(p.nome || ''));
    if (cab && out[cab.id] && out[cab.id].vis !== false) out[cab.id].r = (out[cab.id].r || 0) + Math.sin(t * Math.PI * 2 / 4 + s1) * 1.5;
    // piscar
    const pi = this.piscarEm(P, n, q, def, dv, est);
    if (pi) { const e2 = Modelo.partesNoEstado(dv, { ...est, sessoes: { ...(est.sessoes || {}), [pi.s.id]: pi.preset } });
      const ids = new Set([...(pi.s.partes || []), ...Object.keys((pi.s.presets || []).find(p => p.id === pi.preset)?.estado || {})]);
      // só o desenho do OLHO troca; a sobrancelha (mesma sessão no Problems) fica a da expressão de agora
      const porId = this._porId(def);
      for (const pid of ids) { const b = e2[pid]; if (!b || !this.ehOlho(porId[pid])) continue; out[pid] = { ...(out[pid] || {}), img: b.img, vis: b.vis }; } }
    return out;
  },
};
