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
   n.vida = false desliga.
   MOVIMENTO VIVO (Fase 2 da reforma, decisões da dona de 26/11/2026; régua = o idle do "Ranqueando ships"):
   - PULSOS no lugar do seno perfeito: a cada 0,5 a 1,1 s (sorteado) um AJUSTE DE POSE de 0,3 a 0,5 s que fica (cabeça 2 a 4°, braço 0,8 a
     1,5°, troca de peso no corpo até 1,5°, sobrancelha que sobe e volta). Falando: só cabeça, braços e sobrancelha (o corpo não balança na
     fala). Respiração leve com ritmo irregular. Nunca mais de ~1 s parado de verdade.
   - OLHAR: quem ouve olha para quem fala; quem vai falar desvia 6 a 10 q antes e depois olha para quem ouve (sozinho = câmera); em silêncio
     olha às vezes para os lados. Olhos = presets "Olhando p/ direita|esquerda" da sessão dos olhos, só por cima de olho aberto/neutro (expressão
     posta à mão manda: aí só a cabeça vira); a cabeça inclina para o alvo e chega depois dos olhos. Sem esses presets na vista = só a cabeça.
   - PUNCHLINE (fala com palavra-chave antes da troca de quem fala, ou a última): de 18 q antes do corte até o corte, nada de pulso novo nem
     olhar novo (pose travada; só pisca e respira). Gestos (js/gestos.js) seguram o braço até o corte.
   - PENDURADOS (capa, saia, cordão/colar, rabo de cavalo, trança, mecha solta, laço, pingente) atrasam 1 a 3 q com mola leve em relação ao
     giro de quem os segura; cabelo principal, franja, capuz e cachecol NUNCA. Por personagem: def.vida.atrasa / def.vida.fixos (nomes das partes).
   def.vida.olhar = false desliga o olhar; def.vida.pulsos = false desliga os pulsos. */
'use strict';

const Vida = {
  ligada(P, n) { return !!(P && P.rive && n && n.vida !== false && (n.vida === true || P.vida)); },
  sem(id, k) { let h = 2166136261; for (const ch of String(id) + ':' + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 100000) / 100000; },
  semAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); },
  ROSTO_SESSAO: /boca|olho|sobrancel|pupila|express|fala|rosto|mouth|eye|brow|face|blush/,
  ACESSORIO_FIXO: /cachecol|capa\b|capuz|cabelo|franja|mecha|trança|tranca|rabo de cavalo|scarf|cape|hood|hair/,
  ehAcessorio(p) { return !!p && this.ACESSORIO_FIXO.test(this.semAcento(p.nome)); },
  // PENDURADO = atrasa com mola leve (decisão da dona, 26/11/2026); cabelo principal, franja, capuz e cachecol nunca
  PENDURADO: /capa\b|saia|cordao|colar|rabo de cavalo|tranca|mecha solta|laco|pingente|corrente/,
  NUNCA_ATRASA: /cabelo|franja|capuz|cachecol|scarf|hood|hair/,
  pendurado(def, p) { if (!p) return false; const nm = this.semAcento(p.nome), lista = L => Array.isArray(L) && L.some(x => this.semAcento(x) === nm);
    if (lista(def?.vida?.fixos)) return false; if (lista(def?.vida?.atrasa)) return true;
    if (/mecha solta|rabo de cavalo|tranca/.test(nm)) return true; return this.PENDURADO.test(nm) && !this.NUNCA_ATRASA.test(nm); },

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
    if (/meio/.test(nm)) return false; // meio fechado não pisca (regra do Livro, "Evitar": piscar a partir de olho meio fechado)
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

  /* ---------- QUEM FALA QUANDO (as falas do ritmo: legendas ou vozes), guardado por projeto ---------- */
  HOLD: 18, // punchline: quadros de pose travada antes do corte
  _fal: new WeakMap(),
  falas(P) {
    if (typeof Ritmo === 'undefined' || !P) return null;
    const sig = (P.legendas || []).map(l => l.de + ':' + l.ate + ':' + (l.quem || '') + ':' + String(l.texto || '').length + ':' + (l.chaves || []).length + ':' + (l.blocos || []).length).join('|') + '#' + (P.audios || []).length + '#' + (P.duracao || 0) + '#' + (P.modificado || 0); // cada mudança no projeto refaz (quem está onde)
    const c = this._fal.get(P); if (c && c.sig === sig) return c;
    let L = []; try { L = Ritmo.falas(P, { durDe: a => a.dur ?? (typeof Som !== 'undefined' ? Som.buf?.get?.(a.arq)?.duration : null) }).filter(f => f.ate >= f.de); } catch { L = []; }
    const fim = Math.max(0, (P.duracao || 1) - 1), out = { sig, L: [], hold: [], T: new Map() };
    for (const f of L) { const ids = new Set(); for (const quem of (f.quens.length ? f.quens : [f.quem])) { const no = Ritmo.noDe(P, quem); if (no?.ref) ids.add(no.ref); } // pelo PERSONAGEM (as cópias de mão do mesmo personagem contam como ele)
      out.L.push({ de: f.de, ate: f.ate, ids, chave: f.pal.some(p => p.chave) }); }
    const mesma = (a, b) => a.ids.size === b.ids.size && [...a.ids].every(i => b.ids.has(i));
    out.L.forEach((f, i) => { const nx = out.L[i + 1]; if (!f.chave || !f.ids.size || (nx && mesma(f, nx))) return; const corte = nx ? nx.de : Math.min(fim + 1, f.ate + this.HOLD); out.hold.push([corte - this.HOLD, corte]); });
    this._fal.set(P, out); return out;
  },
  falaEm(F, q) { if (!F) return null; for (const f of F.L) { if (f.de > q) break; if (q <= f.ate) return f; } return null; },
  emHold(F, q) { if (!F) return null; for (const h of F.hold) if (q >= h[0] && q < h[1]) return h; return null; },
  falando(F, n, q) { const f = this.falaEm(F, q); return !!f && f.ids.has(n.ref); },

  /* ---------- PULSOS: ajustes de pose pequenos que ficam (sorteio fixo por personagem; nada de seno perfeito) ---------- */
  _pul: new Map(),
  pulsos(id, fps, ate) { const ch = id + '|' + fps; let L = this._pul.get(ch); if (!L) this._pul.set(ch, L = { q: [], t: .2 + this.sem(id, 'u0') * .5 });
    while (L.t * fps <= ate + fps * 3) { const i = L.q.length;
      L.q.push({ q: Math.round(L.t * fps), d: Math.max(2, Math.round((.3 + this.sem(id, 'ud' + i) * .2) * fps)), a: this.sem(id, 'ua' + i), v: this.sem(id, 'uv' + i), s: this.sem(id, 'us' + i) });
      L.t += .5 + this.sem(id, 'ut' + i) * .6; } // começo a começo: 0,5 a 1,1 s (com 0,3–0,5 s de pulso, nunca mais de ~1 s parado)
    return L.q; },
  // { corpo, cab, bD, bE } em graus e sob (0..1: quanto a sobrancelha sobe) no quadro q
  pulsosEm(P, n, q, F) {
    const fps = P.fps || 24, L = this.pulsos(n.id, fps, q), ez = this._ezP ||= Ease.bez(.25, .1, .25, 1);
    const st = { corpo: { v: 0 }, cab: { v: 0 }, bD: { v: 0 }, bE: { v: 0 } }; let sob = 0;
    for (const p of L) { if (p.q > q) break;
      if (this.emHold(F, p.q)) continue; // punchline: pose travada, nenhum pulso novo
      const alvos = this.falando(F, n, p.q) ? ['cab', 'cab', 'bD', 'bE', 'sob'] : ['cab', 'cab', 'bD', 'bE', 'corpo', 'corpo', 'sob']; // falando, o corpo não troca de peso
      const al = alvos[Math.min(alvos.length - 1, Math.floor(p.a * alvos.length))];
      if (al === 'sob') { const t = (q - p.q) / p.d; if (t < 1) sob = Math.sin(Math.PI * t); continue; } // sobe e volta
      const ant = st[al].v, sg = ant > 0 ? -1 : ant < 0 ? 1 : (p.s < .5 ? -1 : 1); let nv;
      if (al === 'cab') nv = clamp(ant + (Math.abs(ant) > 2 ? -Math.sign(ant) : (p.s < .5 ? -1 : 1)) * (2 + p.v * 2), -4, 4); // cabeça 2 a 4°
      else if (al === 'corpo') nv = sg * (.6 + p.v * .9); // troca de peso até 1,5°
      else nv = sg * (.8 + p.v * .7); // braço 0,8 a 1,5°
      st[al] = { v: nv, de: ant, q0: p.q, d: p.d };
    }
    const out = { sob }; for (const [k, s] of Object.entries(st)) out[k] = s.q0 != null && q < s.q0 + s.d ? s.de + (s.v - s.de) * ez((q - s.q0) / s.d) : s.v;
    return out;
  },

  /* ---------- OLHAR: para quem fala / desvia antes de falar / varia em silêncio ---------- */
  xDe(P, o, q) { try { return Rig.matNo(P, o, q).e; } catch { return Modelo.transf(o, q).x || 0; } },
  espelho(P, n, q) { try { return Rig.matNo(P, n, q).a < 0 ? -1 : 1; } catch { return (Modelo.transf(n, q).sx || 1) < 0 ? -1 : 1; } },
  outros(P, n, q) { return Modelo.noQuadro(P, q).filter(o => o.ref !== n.ref && o.vida !== false && (Modelo.transf(o, q).op ?? 1) >= .05); }, // cópias do mesmo personagem e cópias só de mão (vida desligada) não contam
  // −1 = esquerda da tela, 0 = frente (câmera), 1 = direita da tela
  alvo(P, n, q, F) {
    if (!F) return 0; const h = this.emHold(F, q); if (h && q > h[0]) q = h[0]; // punchline: o olhar trava
    const ch = n.id + ':' + q; if (F.T.has(ch)) return F.T.get(ch);
    const fps = P.fps || 24, f = this.falaEm(F, q), x = this.xDe(P, n, q), O = this.outros(P, n, q), para = o => Math.sign(this.xDe(P, o, q) - x);
    const perto = L => L.reduce((a, o) => !a || Math.abs(this.xDe(P, o, q) - x) < Math.abs(this.xDe(P, a, q) - x) ? o : a, null);
    let r = 0;
    if (f && f.ids.has(n.ref)) { const ouv = perto(O.filter(o => !f.ids.has(o.ref))); r = ouv ? para(ouv) : 0; } // falando: para quem ouve (sozinho: câmera)
    else {
      const nx = F.L.find(g => g.de > q && g.ids.has(n.ref)), antes = nx ? 6 + Math.floor(this.sem(n.id, 'dv' + nx.de) * 5) : 0;
      if (nx && nx.de - q <= antes) { const ouv = perto(O); r = ouv ? -para(ouv) : (this.sem(n.id, 'dl' + nx.de) < .5 ? -1 : 1); r ||= 1; } // vai falar: desvia 6 a 10 q antes
      else if (f) { const s = perto(O.filter(o => f.ids.has(o.ref))); r = s ? para(s) : 0; } // ouvindo: para quem fala
      else { const tam = Math.round(fps * (.8 + this.sem(n.id, 'vt' + Math.floor(q / (fps * 2))) * 1.2)), v = this.sem(n.id, 'vr' + Math.floor(q / tam)); r = v < .6 ? 0 : v < .8 ? -1 : 1; } // silêncio
    }
    if (F.T.size > 60000) F.T.clear(); F.T.set(ch, r); return r;
  },
  // a cabeça chega depois dos olhos: média dos últimos 10 quadros do alvo (mais peso no mais novo)
  alvoCabeca(P, n, q, F) { let s = 0, w = 0; for (let k = 0; k < 10; k++) { const p = 10 - k; s += this.alvo(P, n, Math.max(0, q - k), F) * p; w += p; } return s / w; },
  // presets de olhar da vista: sessão própria "Olhar"/"Pupila" (troca as partes dela) ou "Olhando p/…" na sessão dos olhos (troca só o desenho do olho)
  olhosPara(dv, est, lado) {
    if (!lado) return null; const nm = p => this.semAcento(p?.nome), re = lado > 0 ? /direit|\bdir\b/ : /esquerd|\besq\b/; // "Olhando p/ direita", "Desviando (dir)" (Stick): direita da TELA (conferido na Lumi, 26/11)
    const so = (dv.sessoes || []).find(s => /^(olhar|pupila)/.test(nm(s)));
    if (so) { const ag = (so.presets || []).find(x => x.id === est.sessoes?.[so.id]); // olhar posto à mão (não o da frente/base) manda
      if (ag && !/frente|base|padrao|centro/.test(nm(ag))) return null;
      const pr = (so.presets || []).find(p => re.test(nm(p))); if (pr) return { s: so, preset: pr.id, tudo: true }; }
    const s = this.sessaoOlhos(dv); if (!s) return null;
    const agora = (s.presets || []).find(x => x.id === est.sessoes?.[s.id]), an = this.semAcento(agora?.nome || 'aberto');
    if (!/abert|normal|padrao|neutr|olhand|desvi/.test(an) || /meio|fech/.test(an)) return null; // expressão posta à mão manda
    const pr = (s.presets || []).find(p => /olh|desvi/.test(nm(p)) && re.test(nm(p))); return pr ? { s, preset: pr.id } : null;
  },

  /* ---------- giros da vida no quadro q (respiração + pulsos + cabeça para o alvo): { pid: graus }, sobe (peito), sob ---------- */
  _alt: new WeakMap(),
  altura(dv) { let a = this._alt.get(dv); if (a == null) { try { a = Modelo.caixaPersonagem(dv, Modelo.partesNoEstado(dv, {}))?.h || 1000; } catch { a = 1000; } this._alt.set(dv, a); } return a; },
  giros(P, n, q, dv, F) {
    const fps = P.fps || 24, t = q / fps, s0 = this.sem(n.id, 'r') * Math.PI * 2, s1 = this.sem(n.id, 'c') * Math.PI * 2, def = P.personagens[n.ref], R = {};
    const pul = def?.vida?.pulsos === false ? { corpo: 0, cab: 0, bD: 0, bE: 0, sob: 0 } : this.pulsosEm(P, n, q, F);
    const raiz = dv.partes.find(p => p.id === dv.raiz) || dv.partes.find(p => !p.pai);
    // respiração com ritmo irregular (o período anda entre ~2,6 e 3,5 s): 0,6° + o peito sobe 0,6%
    const onda = Math.sin(t * Math.PI * 2 / 3 + s0 + .8 * Math.sin(t * Math.PI * 2 / 10.7 + s1)), dr = onda * .6 + pul.corpo;
    if (raiz) { R[raiz.id] = dr; for (const p of dv.partes) if (p.pai === raiz.id && /perna|coxa|\bpe\b|leg/.test(this.semAcento(p.nome))) R[p.id] = -dr; } // pés no chão
    const cab = dv.partes.find(p => /^cabe[çc]a/i.test(p.nome || ''));
    if (cab) { const olhar = def?.vida?.olhar === false || !F ? 0 : this.alvoCabeca(P, n, q, F) * 2.5 * this.espelho(P, n, q);
      R[cab.id] = .9 * Math.sin(t * Math.PI * 2 / 4.3 + s1 + .7 * Math.sin(t * Math.PI * 2 / 9.1)) + pul.cab + olhar; }
    const B = dv.partes.filter(p => /^bra[cç]o\b/i.test(p.nome || '') && !/antebra/i.test(p.nome));
    B.forEach((p, i) => { const nm = this.semAcento(p.nome), lado = /direit/.test(nm) ? 'bD' : /esquer/.test(nm) ? 'bE' : (i % 2 ? 'bE' : 'bD'); R[p.id] = pul[lado] + .7 * Math.sin(t * Math.PI * 2 / (2.3 + i * .4) + this.sem(n.id, p.id) * 6.28 + .6 * Math.sin(t * Math.PI * 2 / 7.3)); }); // + balanço leve e irregular: nunca congela
    return { R, sobe: 1 + Math.max(0, onda) * .006, raiz, sob: pul.sob };
  },
  // estado das partes (chaves + movimento suave) em outro quadro, com os giros da vida: para o atraso dos pendurados
  _epVida(P, n, q, dv, F, vista) {
    const e = Modelo.estadoPersonagem(n, q); if ((e.vista ?? null) !== (vista ?? null)) return null;
    let ep = Modelo.partesNoEstado(dv, e); if (n.suaveP) ep = Rig.tween(P, n, q, dv, ep);
    const g = this.giros(P, n, q, dv, F), out = {}; for (const [k, v] of Object.entries(ep)) out[k] = v ? { ...v, r: (v.r || 0) + (g.R[k] || 0) } : v; return out;
  },
  norm(a) { return ((a + 180) % 360 + 360) % 360 - 180; },

  /* ---------- aplica no estado das partes do quadro q (devolve um estado novo; o de entrada não muda) ---------- */
  aplica(P, n, q, dv, ep, est) {
    const def = P.personagens[n.ref]; if (!def || !ep) return ep;
    const out = {}; for (const [k, v] of Object.entries(ep)) out[k] = v ? { ...v } : v;
    const F = this.falas(P), g = this.giros(P, n, q, dv, F);
    for (const [pid, dr] of Object.entries(g.R)) if (dr && out[pid] && out[pid].vis !== false) out[pid].r = (out[pid].r || 0) + dr;
    if (g.raiz && out[g.raiz.id] && out[g.raiz.id].vis !== false) { const e = out[g.raiz.id]; e.s = (e.s ?? 1) * g.sobe; e.sx = (e.sx || 1) / g.sobe; } // o peito sobe
    // sobrancelha que sobe e volta (pulso)
    if (g.sob) { const dy = -g.sob * this.altura(dv) * .006; for (const p of dv.partes) if (/sobrancel|brow/.test(this.semAcento(p.nome)) && out[p.id] && out[p.id].vis !== false) out[p.id].y = (out[p.id].y || 0) + dy; }
    const porId = this._porId(def);
    // PENDURADOS: atrasam 1 a 3 q com mola leve em relação ao giro de quem os segura (capa, saia, cordão…); cabelo, franja, capuz e cachecol nunca
    const pend = dv.partes.filter(p => this.pendurado(def, p) && out[p.id] && out[p.id].vis !== false);
    if (pend.length && q >= 4) {
      const cad = (E, pid) => { let s = 0, k = porId[pid]?.pai, i = 0; while (k && i++ < 12) { s += E[k]?.r || 0; k = porId[k]?.pai; } return s; };
      const e0 = this._epVida(P, n, q, dv, F, est.vista), e2 = this._epVida(P, n, q - 2, dv, F, est.vista), e4 = this._epVida(P, n, q - 4, dv, F, est.vista);
      if (e0 && e2 && e4) for (const p of pend) { const r0 = cad(e0, p.id), d2 = this.norm(cad(e2, p.id) - r0), d4 = this.norm(cad(e4, p.id) - r0);
        out[p.id].r = (out[p.id].r || 0) + clamp(1.2 * d2 - .2 * d4, -6, 6); } // 1,2×(2 q atrás) − 0,2×(4 q atrás): atrasa e passa um pouquinho na parada
    }
    // OLHAR: os olhos vão para o alvo (a cabeça já inclinou em giros)
    if (def.vida?.olhar !== false && F) { const lado = this.alvo(P, n, q, F) * this.espelho(P, n, q), ol = this.olhosPara(dv, est, lado);
      if (ol) { const e2 = Modelo.partesNoEstado(dv, { ...est, sessoes: { ...(est.sessoes || {}), [ol.s.id]: ol.preset } });
        const ids = new Set([...(ol.s.partes || []), ...Object.keys((ol.s.presets || []).find(p => p.id === ol.preset)?.estado || {})]);
        for (const pid of ids) { const b = e2[pid]; if (!b) continue; if (ol.tudo) { out[pid] = { ...(out[pid] || {}), img: b.img, vis: b.vis, x: b.x, y: b.y }; continue; }
          if (!this.ehOlho(porId[pid])) continue; out[pid] = { ...(out[pid] || {}), img: b.img, vis: b.vis };
          // PUPILA SOLTA (Fase 3, Problems Frente: "Pupila direita/esquerda" andam por x/y): o "Olhando p/…" só move as pupilas
          if (/pupila/.test(this.semAcento(porId[pid]?.nome))) { out[pid].x = b.x; out[pid].y = b.y; } } } }
    // piscar (por cima do olhar)
    const pi = this.piscarEm(P, n, q, def, dv, est);
    if (pi) { const e2 = Modelo.partesNoEstado(dv, { ...est, sessoes: { ...(est.sessoes || {}), [pi.s.id]: pi.preset } });
      const ids = new Set([...(pi.s.partes || []), ...Object.keys((pi.s.presets || []).find(p => p.id === pi.preset)?.estado || {})]);
      // só o desenho do OLHO troca; a sobrancelha (mesma sessão no Problems) fica a da expressão de agora. Só img/vis: o x/y das pupilas
      // soltas (Fase 3) fica o de agora — quem olha para o lado não tem a pupila pulando para o meio no piscar
      for (const pid of ids) { const b = e2[pid]; if (!b || !this.ehOlho(porId[pid])) continue; out[pid] = { ...(out[pid] || {}), img: b.img, vis: b.vis }; } }
    return out;
  },
};
