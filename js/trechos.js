/* ===================== trechos.js — pedir para a IA mudar SÓ um trecho da animação (ex.: 0:15 a 1:12) =====================
   Trecho = { de, ate (quadros, contando do 0), nota }. Dá para marcar na janela da IA (+ Trecho, tempos escritos no pedido viram
   trecho sozinhos) ou na timeline (Shift + arrastar na régua → botão direito › "Pedir para a IA mudar este trecho").
   A IA recebe os tempos, as chaves que já existem ali e quadros desenhados do trecho; depois de aplicar, `protege` devolve
   tudo o que ficou FORA dos trechos como estava (chaves, câmera, efeitos e camadas novas cortados para dentro). */
'use strict';
const Trechos = {
  // "1:12" · "1:12,5" · "72" · "72s" · "1:02:03" → segundos
  seg(s) { s = String(s || '').trim().replace(',', '.').replace(/\s*s(eg)?$/i, ''); if (!s || !/^[\d:.]+$/.test(s)) return NaN; const p = s.split(':').map(Number); if (p.some(x => !isFinite(x))) return NaN; return p.reduce((a, v) => a * 60 + v, 0); },
  txt(q, fps) { const d = Math.round(q / fps * 10), m = Math.floor(d / 600), s = Math.floor((d % 600) / 10), dz = d % 10; return `${m}:${String(s).padStart(2, '0')}${dz ? ',' + dz : ''}`; },
  rotulo(t, P) { return `${this.txt(t.de, P.fps)} a ${this.txt(t.ate + 1, P.fps)}`; },
  novo(P, s0, s1, nota = '') { const ult = Modelo.ultimoQuadro(P), de = clamp(Math.floor(s0 * P.fps), 0, ult), ate = clamp(Math.ceil(s1 * P.fps) - 1, de, ult); return { de, ate, nota }; },
  // tempos escritos no pedido: "do 0:15 ao 1:12", "0:15-1:12", "de 15s a 20s", "no 0:42" (sozinho = 1 s para cada lado)
  RE: /(\d{1,2}:\d{2}(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*s\b)(?:\s*(?:a|à|até|ate|ao|-|–|—)\s*(\d{1,2}:\d{2}(?:[.,]\d+)?|\d+(?:[.,]\d+)?\s*s\b))?/gi,
  doTexto(txt, P) {
    const out = [];
    for (const m of String(txt || '').matchAll(this.RE)) {
      const a = this.seg(m[1]), b = m[2] ? this.seg(m[2]) : NaN;
      if (!isFinite(a)) continue;
      if (isFinite(b) && b > a) out.push(this.novo(P, a, b));
      else if (!m[2] && /:/.test(m[1])) out.push(this.novo(P, Math.max(0, a - 1), a + 1));
    }
    return out.filter(t => t.de < P.duracao);
  },
  dentro(trechos, q) { return trechos.some(t => q >= t.de && q <= t.ate); },

  /* ---------- o que vai para a IA ---------- */
  // chaves que já existem dentro dos trechos (com nomes, não ids)
  chavesNoTrecho(P, trechos) {
    const nomeSess = (d, sid, pid) => { const s = (d?.sessoes || []).find(x => x.id === sid); return s ? [s.nome, pid ? s.presets.find(p => p.id === pid)?.nome || null : null] : null; };
    const out = [];
    for (const n of Modelo.todos(P)) {
      const ks = Modelo.quadrosChave(n).filter(k => this.dentro(trechos, k)); if (!ks.length) continue;
      const d0 = n.tipo === 'personagem' ? P.personagens[n.ref] : null;
      out.push({ camada: n.nome, chaves: ks.slice(0, 50).map(k => { const c = n.chaves[k], o = { quadro: k + 1 };
        for (const f of ['x', 'y', 'r', 's', 'op']) if (c[f] != null) o[f] = round(c[f], 2);
        if (c.sessoes && d0) { const dv = Modelo.naVista(d0, Modelo.estadoPersonagem(n, k).vista); o.sessoes = Object.fromEntries(Object.entries(c.sessoes).map(([s, p]) => nomeSess(dv, s, p)).filter(Boolean)); }
        if (c.vista !== undefined && d0) o.vista = (d0.vistas || []).find(v => v.id === c.vista)?.nome || null;
        if (c.partes) o.mexe_partes = Object.keys(c.partes).length;
        return o; }) });
    }
    const cam = Object.keys(P.camera.chaves).map(Number).filter(k => this.dentro(trechos, k)).sort((a, b) => a - b);
    if (cam.length) out.push({ camada: 'camera', chaves: cam.slice(0, 50).map(k => ({ quadro: k + 1, ...Object.fromEntries(Object.entries(P.camera.chaves[k]).filter(([, v]) => typeof v === 'number').map(([c, v]) => [c, round(v, 2)])) })) });
    return out;
  },
  // quadros desenhados de cada trecho (a IA vê como está agora)
  async quadros(P, trechos) {
    const out = [];
    for (const [i, t] of trechos.slice(0, 4).entries()) {
      const n = clamp(t.ate - t.de + 1, 1, 8), larg = P.h > P.w ? 160 : 240, H = Math.round(larg * P.h / P.w), ims = [], rot = [];
      for (let j = 0; j < n; j++) { const q = Math.round(t.de + (t.ate - t.de) * (n === 1 ? 0 : j / (n - 1))); const c = document.createElement('canvas'); c.width = larg; c.height = H; try { Render.quadro(c.getContext('2d'), P, q, larg, H); } catch { } ims.push(c); rot.push(`q${q + 1} · ${this.txt(q, P.fps)}`); }
      const blob = await RefsAnim.folha(ims, Math.min(4, n), larg, rot), b = RefsAnim.bloco(await RefsAnim.b64(blob)); if (!b) continue;
      out.push(b, { type: 'text', text: `↑ COMO ESTÁ AGORA o trecho ${i + 1} (${this.rotulo(t, P)}, quadros ${t.de + 1} a ${t.ate + 1}).` });
    }
    return out;
  },
  texto(P, trechos) {
    return `SÓ ESTES TRECHOS (mude apenas dentro deles; o resto da animação tem que ficar exatamente igual — o que você puser fora deles é jogado fora):\n` +
      trechos.map((t, i) => `- Trecho ${i + 1}: ${this.rotulo(t, P)} = quadros ${t.de + 1} a ${t.ate + 1}${t.nota ? ` — o que está ruim: ${t.nota}` : ''}`).join('\n') +
      `\nCHAVES QUE JÁ EXISTEM NOS TRECHOS: ${JSON.stringify(this.chavesNoTrecho(P, trechos))}\n` +
      `Para refazer uma parte que ficou ruim, primeiro "apagar_chaves" da camada no trecho e depois ponha as novas. Áudio alto/baixo num trecho: ação "volume". Ciclos ("animacao"): calcule as repetições para caber no trecho.`;
  },

  /* ---------- depois de aplicar: o que ficou fora dos trechos volta a ser como era ---------- */
  // antes de aplicar: guarda como estava
  foto(P) {
    const nos = new Map(Modelo.todos(P).map(n => [n.id, { tipo: n.tipo, interp: n.interp, ref: n.ref, chaves: clone(n.chaves || {}) }]));
    const efs = new Set([...(P.efeitos?.tela || []), ...Modelo.todos(P).flatMap(n => n.efeitos || [])].map(e => e.id || e));
    return { nos, cam: clone(P.camera.chaves), efs };
  },
  // depois de pôr as chaves das bordas: cada pedaço de fora dos trechos segue a MESMA curva de antes (curva[c] na chave do começo do pedaço)
  curvas(ch, velhas, campos, dentro) {
    for (const c of campos) {
      const ks = Object.keys(ch).map(Number).filter(k => ch[k][c] != null).sort((a, b) => a - b), os = Object.keys(velhas).map(Number).filter(k => velhas[k][c] != null).sort((a, b) => a - b);
      for (let i = 0; i + 1 < ks.length; i++) {
        const k1 = ks[i], k2 = ks[i + 1]; let fora = false; for (let q = k1 + 1; q < k2; q++) if (!dentro(q)) { fora = true; break; } if (!fora) continue;
        const oa = os.filter(k => k <= k1).pop(), ob = os.find(k => k >= k2); if (oa == null || ob == null || os.some(k => k > k1 && k < k2) || oa === ob) continue;
        const cv = velhas[oa].curva?.[c] || [0, 1], F = k => cv[0] + (cv[1] - cv[0]) * (k - oa) / (ob - oa), novo = [F(k1), F(k2)];
        if (k1 === oa && k2 === ob) { if (velhas[oa].curva?.[c]) (ch[k1].curva ||= {})[c] = [...velhas[oa].curva[c]]; else if (ch[k1].curva) delete ch[k1].curva[c]; }
        else (ch[k1].curva = { ...(ch[k1].curva || {}) })[c] = novo;
        if (ch[k1].curva && !Object.keys(ch[k1].curva).length) delete ch[k1].curva;
      }
    }
  },
  protege(P, trechos, foto) {
    const T = trechos, dentro = q => this.dentro(T, q), ult = Modelo.ultimoQuadro(P), bordas = [...new Set(T.flatMap(t => [t.de - 1, t.ate + 1]))].filter(b => b >= 0 && b <= ult && !dentro(b));
    const ini = Math.min(...T.map(t => t.de)), fim = Math.max(...T.map(t => t.ate));
    // 1) chaves fora dos trechos: devolve as antigas, tira as novas
    const volta = (agora, antes) => { for (const k of new Set([...Object.keys(agora), ...Object.keys(antes)])) { if (dentro(+k)) continue; if (k in antes) agora[k] = clone(antes[k]); else delete agora[k]; } };
    for (const n of Modelo.todos(P)) {
      const v = foto.nos.get(n.id);
      if (!v) { // camada nova (ex.: cenário): só aparece dentro dos trechos
        n.de = Math.max(n.de || 0, ini); n.ate = Math.min(n.ate ?? ult, fim);
        continue;
      }
      n.chaves ||= {}; const ksD = ch => JSON.stringify(Object.keys(ch).filter(k => dentro(+k)).sort().map(k => [k, ch[k]]));
      if (ksD(n.chaves) === ksD(v.chaves)) { volta(n.chaves, v.chaves); continue; } // não mudou nada dentro: só garante o de fora
      volta(n.chaves, v.chaves);
      // 2) nas bordas dos trechos, o estado de antes segura (o que mudou dentro não "vaza" para fora)
      const velho = { tipo: v.tipo, interp: v.interp, chaves: v.chaves };
      for (const b of bordas) {
        const tA = Modelo.transf(velho, b), tN = Modelo.transf(n, b), pers = n.tipo === 'personagem';
        const eA = pers ? Modelo.estadoPersonagem(velho, b) : null, eN = pers ? Modelo.estadoPersonagem(n, b) : null;
        if (JSON.stringify(tA) === JSON.stringify(tN) && JSON.stringify(eA) === JSON.stringify(eN)) continue;
        const k = { ...(n.chaves[b] || {}) }; Object.assign(k, tA);
        if (pers) {
          k.sessoes = { ...eA.sessoes }; for (const s of Object.keys(eN.sessoes)) if (!(s in eA.sessoes)) k.sessoes[s] = null;
          k.partes = { ...eA.partes }; for (const p of Object.keys(eN.partes)) if (eA.partes[p] === undefined) k.partes[p] = null;
          for (const p of Object.keys(k.partes)) if (k.partes[p] === undefined) k.partes[p] = null;
          if (eA.vista !== eN.vista) k.vista = eA.vista ?? null;
        }
        n.chaves[b] = k;
      }
      if (n.interp) this.curvas(n.chaves, v.chaves, Modelo.TRANSF.filter(c => c !== 'sx'), dentro);
    }
    // câmera
    volta(P.camera.chaves, foto.cam);
    const camVelha = { ...P, camera: { ...P.camera, chaves: foto.cam } };
    for (const b of bordas) { const a = Modelo.camera(camVelha, b), nv = Modelo.camera(P, b); if (JSON.stringify(a) !== JSON.stringify(nv)) P.camera.chaves[b] = { ...(P.camera.chaves[b] || {}), ...a }; }
    this.curvas(P.camera.chaves, foto.cam, ['x', 'y', 'zoom', 'r'], dentro);
    // 3) efeitos novos: cortados para dentro do trecho em que caem (fora de todos = some)
    const corta = lista => { for (let i = lista.length - 1; i >= 0; i--) { const e = lista[i]; if (foto.efs.has(e.id || e)) continue;
      const de = e.de ?? 0, ate = e.ate ?? ult, t = T.map(t => [t, Math.min(ate, t.ate) - Math.max(de, t.de)]).sort((a, b) => b[1] - a[1])[0];
      if (!t || t[1] < 0) { lista.splice(i, 1); continue; } e.de = Math.max(de, t[0].de); e.ate = Math.min(ate, t[0].ate); } };
    corta(P.efeitos?.tela || []); for (const n of Modelo.todos(P)) if (n.efeitos) corta(n.efeitos);
  },

  /* ---------- campo na janela da IA ---------- */
  // o = { lista: [] (os trechos, mudam no lugar), texto: textarea (tempos escritos viram trechos) }
  campo(P, o) {
    const L = o.lista, el = h(`<div class="refs-anim trechos"><div class="refs-cab">${ic('cut', 14)} <b>Mudar só um trecho</b><small>a IA mexe só dentro destes tempos (ex.: 0:15 a 1:12); o resto fica igual. Tempos escritos no pedido entram aqui sozinhos.</small></div>
      <div class="tr-l"></div><div class="campo2"><button class="btn sm" data-add>${ic('plus', 13)} Trecho</button>${Folha.trecho ? `<button class="btn sm" data-sel>Usar o marcado na timeline (${esc(this.rotulo(Folha.trecho, P))})</button>` : '<small class="tr-dica">ou marque na timeline: Shift + arrastar na régua</small>'}</div></div>`);
    const pinta = () => {
      const l = $('.tr-l', el); l.innerHTML = '';
      L.forEach((t, i) => {
        const r = h(`<div class="tr-row"><span class="tr-n">${i + 1}</span><input class="tr-t" value="${this.txt(t.de, P.fps)}" title="Começa (minutos:segundos)"><span>a</span><input class="tr-t" value="${this.txt(t.ate + 1, P.fps)}" title="Termina (minutos:segundos)"><input class="tr-nota" placeholder="o que está ruim (opcional): a animação, o áudio alto…" value="${esc(t.nota || '')}"><button class="ibtn" data-ir title="Ver o começo do trecho">${ic('play', 12)}</button><button class="ibtn" data-x title="Tirar">${ic('x', 12)}</button></div>`);
        const [a, b, nt] = $$('input', r);
        const muda = () => { const s0 = this.seg(a.value), s1 = this.seg(b.value); if (isFinite(s0) && isFinite(s1) && s1 > s0) { Object.assign(t, this.novo(P, s0, s1, t.nota)); t.auto = false; a.classList.remove('err'); b.classList.remove('err'); } else { a.classList.toggle('err', !isFinite(s0)); b.classList.toggle('err', !(isFinite(s1) && s1 > s0)); } };
        a.onchange = b.onchange = muda; nt.oninput = () => { t.nota = nt.value; t.auto = false; };
        for (const x of [a, b, nt]) x.addEventListener('keydown', e => e.stopPropagation());
        $('[data-ir]', r).onclick = () => { App.pausa?.(); App.setQ(t.de); };
        $('[data-x]', r).onclick = () => { L.splice(i, 1); pinta(); };
        l.appendChild(r);
      });
    };
    $('[data-add]', el).onclick = () => { const s = App.q / P.fps; L.push(this.novo(P, s, s + 2)); pinta(); };
    if ($('[data-sel]', el)) $('[data-sel]', el).onclick = () => { const f = Folha.trecho; if (f && !L.some(t => t.de === f.de && t.ate === f.ate)) L.push({ de: f.de, ate: f.ate, nota: '' }); pinta(); };
    // tempos escritos no pedido: entram sozinhos (marcados "auto"; somem se saírem do texto; mexer à mão tira o "auto")
    this._sinc = () => { if (!o.texto) return; const achados = this.doTexto(o.texto.value, P); let mudou = false;
      for (let i = L.length - 1; i >= 0; i--) if (L[i].auto && !achados.some(t => t.de === L[i].de && t.ate === L[i].ate)) { L.splice(i, 1); mudou = true; }
      for (const t of achados) if (!L.some(x => x.de === t.de && x.ate === t.ate)) { L.push({ ...t, auto: true }); mudou = true; }
      if (mudou) pinta(); };
    let tm; if (o.texto) o.texto.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(this._sinc, 900); });
    pinta(); el.pinta = pinta; return el;
  },
};
