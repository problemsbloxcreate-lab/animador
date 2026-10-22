/* ===================== pinceis.js — ateliê: pincel e borracha de verdade (tipo Photoshop) =====================
   - Mesa digitalizadora (Wacom, XP-Pen, Huion, caneta do tablet/Surface/iPad): a PRESSÃO da caneta muda o tamanho e/ou a opacidade;
     a ponta de trás da caneta (borracha) apaga sozinha. O mouse funciona como pressão cheia.
   - Opções: tamanho, opacidade, dureza (borda macia), fluxo, espaçamento, suavização (traço estável), forma (redonda, quadrada, lápis),
     pressão no tamanho (com mínimo) e/ou na opacidade. Presets prontos. Cada ferramenta lembra as suas opções (neste computador).
   - Borracha: normal, macia, ou "de fundo" (apaga só a cor parecida com a do primeiro toque, como a Borracha de Fundo do Photoshop).
   - Shift+clique: linha reta desde o último ponto. Com seleção, só pinta dentro dela.
   O traço vai numa camada à parte e só depois junta na imagem (a opacidade não mancha onde o traço cruza). */
'use strict';
const PINCEL_PADRAO = { tam: 14, opac: 1, dureza: .9, fluxo: 1, espac: .12, suav: .3, pTam: true, pMin: .2, pOpac: false, forma: 'redonda', preset: 'Caneta' };
const PRESETS_PINCEL = {
  pincel: [
    ['Caneta', { dureza: .95, fluxo: 1, espac: .1, suav: .35, pTam: true, pMin: .2, pOpac: false, forma: 'redonda' }],
    ['Lápis', { tam: 3, dureza: 1, fluxo: 1, espac: .2, suav: .15, pTam: false, pOpac: true, forma: 'lapis' }],
    ['Pincel macio', { dureza: .25, fluxo: .45, espac: .08, suav: .3, pTam: true, pMin: .35, pOpac: true, forma: 'redonda' }],
    ['Aerógrafo', { tam: 60, dureza: 0, fluxo: .08, espac: .05, suav: .2, pTam: false, pOpac: true, forma: 'redonda' }],
    ['Marcador', { dureza: .85, opac: .65, fluxo: 1, espac: .1, suav: .25, pTam: false, pOpac: false, forma: 'redonda' }],
    ['Contorno rabiscado', { tam: 6, dureza: .9, fluxo: .9, espac: .15, suav: .05, pTam: true, pMin: .45, pOpac: false, forma: 'redonda' }],
  ],
  borracha: [
    ['Dura', { dureza: .95, fluxo: 1, espac: .1, suav: .2, pTam: true, pMin: .3, pOpac: false, forma: 'redonda', modo: 'normal' }],
    ['Macia', { dureza: .2, fluxo: .5, espac: .08, suav: .2, pTam: true, pMin: .4, pOpac: true, forma: 'redonda', modo: 'normal' }],
    ['Bloco', { dureza: 1, fluxo: 1, espac: .2, suav: 0, pTam: false, pOpac: false, forma: 'quadrada', modo: 'normal' }],
    ['Borracha de fundo', { dureza: .8, fluxo: 1, espac: .1, suav: .2, pTam: true, pMin: .3, pOpac: false, forma: 'redonda', modo: 'fundo' }],
  ],
};
(() => {
  const P = Pintura; let salvo = {}; try { salvo = JSON.parse(localStorage.getItem('animador-pinceis') || '{}') || {}; } catch { }
  P.cfg = { pincel: { ...PINCEL_PADRAO, ...(salvo.pincel || {}) }, borracha: { ...PINCEL_PADRAO, preset: 'Dura', modo: 'normal', tam: 24, ...(salvo.borracha || {}) } };
  P.guardaCfg = () => { clearTimeout(P._gc); P._gc = setTimeout(() => { try { localStorage.setItem('animador-pinceis', JSON.stringify(P.cfg)); } catch { } }, 400); };
  P.cfgAtual = () => P.cfg[P.ferr === 'borracha' ? 'borracha' : 'pincel'];
  // tam e opac viram os da ferramenta atual (o resto do Ateliê continua usando Pintura.tam / Pintura.opac)
  delete P.tam; delete P.opac;
  Object.defineProperty(P, 'tam', { get: () => P.cfgAtual().tam, set: v => { P.cfgAtual().tam = v; P.guardaCfg(); }, configurable: true });
  Object.defineProperty(P, 'opac', { get: () => P.cfgAtual().opac, set: v => { P.cfgAtual().opac = v; P.guardaCfg(); }, configurable: true });
})();

Object.assign(Pintura, {
  mesa: false, // viu uma caneta com pressão
  // pressão 0..1 do evento (mouse = 1); a ponta de trás da caneta = borracha
  pressao(ev) { if (ev.pointerType === 'pen') { if (!this.mesa && ev.pressure > 0) { this.mesa = true; this.pintaBarra(); } return clamp(ev.pressure || 0, 0, 1) ** .85; } return ev.pointerType === 'touch' && ev.pressure > 0 && ev.pressure !== .5 ? ev.pressure : 1; },
  borrachaDaCaneta(ev) { return ev.pointerType === 'pen' && ((ev.buttons & 32) || ev.button === 5); },
  aplicaPreset(nome) { const t = this.ferr === 'borracha' ? 'borracha' : 'pincel', pr = PRESETS_PINCEL[t].find(x => x[0] === nome); if (!pr) return; Object.assign(this.cfg[t], pr[1], { preset: nome }); this.guardaCfg(); Atelie.pinta(); },
  // carimbo macio (borda com degradê) na cor certa, guardado para não refazer a cada ponto
  _carimbos: new Map(),
  carimbo(cor, dureza) {
    const k = cor + '|' + Math.round(dureza * 20); let c = this._carimbos.get(k); if (c) return c;
    const S = 128; c = new OffscreenCanvas(S, S); const x = c.getContext('2d'), g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2), [r, gg, b] = rgbDe(cor);
    g.addColorStop(0, `rgba(${r},${gg},${b},1)`); g.addColorStop(clamp(dureza, 0, .99), `rgba(${r},${gg},${b},1)`); g.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    x.fillStyle = g; x.fillRect(0, 0, S, S); if (this._carimbos.size > 40) this._carimbos.clear(); this._carimbos.set(k, c); return c;
  },
  // um carimbo do traço
  bate(lc, x, y, tam, alfa, cfg, cor) {
    if (tam < .3 || alfa <= 0) return; lc.globalAlpha = clamp(alfa, 0, 1); lc.fillStyle = cor;
    if (cfg.forma === 'lapis') { const s = Math.max(1, Math.round(tam)); lc.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); }
    else if (cfg.forma === 'quadrada') lc.fillRect(x - tam / 2, y - tam / 2, tam, tam);
    else if (cfg.dureza >= .97) { lc.beginPath(); lc.arc(x, y, tam / 2, 0, 7); lc.fill(); }
    else lc.drawImage(this.carimbo(cor, cfg.dureza), x - tam / 2, y - tam / 2, tam, tam);
  },
  // traço do pincel/borracha (chamado pelo Pintura.desce)
  async traco(e, a, pt, mask) {
    const apaga = this.ferr === 'borracha' || this.borrachaDaCaneta(e), cfg = this.cfg[apaga ? 'borracha' : 'pincel'], cor = apaga ? '#000000' : this.cor;
    const { cv, c } = this.tela(a.bm), orig = a.orig || a.bm, k0 = a.img.k, vivo = a.vivo || (x => Arq.img.set(k0, x)), base = this.tela(a.bm).cv, lay = new OffscreenCanvas(cv.width, cv.height), lc = lay.getContext('2d');
    // borracha de fundo: só onde a cor parece com a do primeiro toque
    let fundo = null; if (apaga && cfg.modo === 'fundo') fundo = this.areaParecida(c, cv.width, cv.height, Math.floor(pt.x), Math.floor(pt.y), this.tol, true);
    const junta = () => { let l2 = lay; for (const m of [mask, fundo]) if (m) { const t = new OffscreenCanvas(cv.width, cv.height), x = t.getContext('2d'); x.drawImage(l2, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(m, 0, 0); l2 = t; }
      c.globalCompositeOperation = 'copy'; c.globalAlpha = 1; c.drawImage(base, 0, 0); c.globalCompositeOperation = apaga ? 'destination-out' : 'source-over'; c.globalAlpha = cfg.opac; c.drawImage(l2, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; };
    const tamDe = p => cfg.tam * (cfg.pTam ? cfg.pMin + (1 - cfg.pMin) * p : 1), alfaDe = p => cfg.fluxo * (cfg.pOpac ? p : 1);
    // pontos: estabilizados (suavização) e com carimbos a cada "espaçamento"
    let liso = { ...pt }, ult = null, sobra = 0, pAnt = this.pressao(e);
    const ponto = (q, p) => {
      if (!ult) { this.bate(lc, q.x, q.y, tamDe(p), alfaDe(p), cfg, cor); ult = { ...q }; pAnt = p; return; }
      const dx = q.x - ult.x, dy = q.y - ult.y, L = Math.hypot(dx, dy); let t = -sobra;
      while (true) { const s = Math.max(.4, tamDe(pAnt + (p - pAnt) * Math.max(0, t / (L || 1))) * cfg.espac); t += s; if (t > L) { sobra = L - (t - s); break; }
        const f = t / (L || 1), pp = pAnt + (p - pAnt) * f; this.bate(lc, ult.x + dx * f, ult.y + dy * f, tamDe(pp), alfaDe(pp), cfg, cor); }
      ult = { ...q }; pAnt = p;
    };
    // Shift+clique: linha reta desde o último ponto desta imagem
    if (e.shiftKey && this._ultimo?.k === a.img.id) { ult = { ...this._ultimo.pt }; pAnt = this.pressao(e); ponto(pt, this.pressao(e)); junta(); this._ultimo = { k: a.img.id, pt }; await this.gravar(a.img, cv); Atelie.commit(); return; }
    ponto(pt, this.pressao(e)); junta(); vivo(cv); Atelie.desenha(); // com camadas: mostra a imagem final com o traço na camada ativa
    try { Atelie.cv.setPointerCapture(e.pointerId); } catch { } let pend = false, acabou = false;
    const mov = ev => {
      const lista = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
      for (const ce of (lista.length ? lista : [ev])) { const raw = a.para(Atelie.mundo(ce)), k = 1 - clamp(cfg.suav, 0, .95); liso = { x: liso.x + (raw.x - liso.x) * k, y: liso.y + (raw.y - liso.y) * k }; ponto(liso, this.pressao(ce)); }
      this.mouse = { x: ev.offsetX, y: ev.offsetY }; if (!pend) { pend = true; requestAnimationFrame(() => { pend = false; if (acabou) return; junta(); vivo(cv); Atelie.desenha(); }); } // depois de soltar, a prévia atrasada não pode voltar a pintar por cima da imagem de antes
    };
    // CTRL+Z: durante o traço a prévia aparece no lugar da imagem de antes (chave k0). Ao terminar, a imagem de antes TEM que voltar
    // a ser a original, senão o Ctrl+Z volta para k0 e mostra o traço/apagado. Por isso: só termina uma vez, a prévia atrasada não
    // repinta depois de soltar, e caneta que "some" (pointercancel, perder a captura, soltar fora) também termina o traço.
    const up = async ev => { if (acabou) return; acabou = true;
      for (const [t, f] of [['pointermove', mov], ['pointerup', up], ['pointercancel', up], ['lostpointercapture', up]]) Atelie.cv.removeEventListener(t, f);
      const raw = ev && ev.type === 'pointerup' ? a.para(Atelie.mundo(ev)) : null; if (raw) ponto(raw, pAnt); junta(); // fecha o traço onde a caneta saiu (a suavização não deixa ele curto)
      this._ultimo = { k: a.img.id, pt: raw || liso }; Arq.img.set(k0, orig); try { await this.gravar(a.img, cv); } finally { Arq.img.set(k0, orig); } Atelie.commit(); };
    Atelie.cv.addEventListener('pointermove', mov); Atelie.cv.addEventListener('pointerup', up); Atelie.cv.addEventListener('pointercancel', up); Atelie.cv.addEventListener('lostpointercapture', up);
  },

  /* ---------- controles do pincel/borracha (barra em cima do palco e aba Pintar) ---------- */
  controles(compacto) {
    const t = this.ferr === 'borracha' ? 'borracha' : 'pincel', cfg = this.cfg[t], mais = !compacto || this._mais;
    const faixa = (c, n, a, b, p, fmt) => `<label title="${n}">${n}<input type="range" min="${a}" max="${b}" step="${p}" value="${cfg[c]}" data-c="${c}"><output>${fmt(cfg[c])}</output></label>`;
    const pct = v => Math.round(v * 100) + '%', px = v => Math.round(v) + ' px';
    const el = h(`<div class="pc-ctl ${compacto ? 'compacto' : ''}">
      <select data-preset title="Presets">${PRESETS_PINCEL[t].map(([n]) => `<option ${cfg.preset === n ? 'selected' : ''}>${n}</option>`).join('')}${PRESETS_PINCEL[t].some(([n]) => n === cfg.preset) ? '' : '<option selected>Personalizado</option>'}</select>
      ${faixa('tam', 'Tamanho', 1, 400, 1, px)}${faixa('opac', 'Opacidade', .02, 1, .01, pct)}${faixa('dureza', 'Dureza', 0, 1, .01, pct)}${faixa('fluxo', 'Fluxo', .02, 1, .01, pct)}
      ${mais ? `${faixa('espac', 'Espaçamento', .02, 1, .01, pct)}${faixa('suav', 'Suavização', 0, .9, .01, pct)}
        <label title="Forma da ponta">Forma<select data-forma><option value="redonda">redonda</option><option value="quadrada">quadrada</option><option value="lapis">lápis (sem borda)</option></select></label>
        <label class="pc-chk" title="A pressão da caneta muda o tamanho"><input type="checkbox" data-b="pTam" ${cfg.pTam ? 'checked' : ''}> Pressão → tamanho</label>${cfg.pTam ? faixa('pMin', 'mínimo', 0, 1, .01, pct) : ''}
        <label class="pc-chk" title="A pressão da caneta muda a opacidade"><input type="checkbox" data-b="pOpac" ${cfg.pOpac ? 'checked' : ''}> Pressão → opacidade</label>
        ${t === 'borracha' ? `<label title="Borracha de fundo: apaga só a cor parecida com a do primeiro toque">Modo<select data-modo><option value="normal">normal</option><option value="fundo">de fundo (cor parecida)</option></select></label>${cfg.modo === 'fundo' ? `<label title="Tolerância">Tolerância<input type="range" min="0" max="160" step="1" value="${this.tol}" data-tol><output>${this.tol}</output></label>` : ''}` : ''}` : ''}
      ${compacto ? `<button class="btn sm" data-mais>${this._mais ? 'Menos' : 'Mais opções'}</button>` : ''}
      <span class="pc-mesa ${this.mesa ? 'on' : ''}" title="${this.mesa ? 'Caneta com pressão funcionando (Wacom e outras). A ponta de trás da caneta apaga.' : 'Use uma mesa digitalizadora (Wacom, XP-Pen, Huion…) ou caneta de tablet: a pressão é reconhecida sozinha.'}">${ic('pencil', 12)} ${this.mesa ? 'Mesa com pressão' : 'Sem mesa (mouse)'}</span></div>`);
    if ($('[data-forma]', el)) $('[data-forma]', el).value = cfg.forma || 'redonda'; if ($('[data-modo]', el)) $('[data-modo]', el).value = cfg.modo || 'normal';
    const muda = () => { cfg.preset = 'Personalizado'; this.guardaCfg(); };
    $$('input[type=range][data-c]', el).forEach(i => i.oninput = () => { const c = i.dataset.c; cfg[c] = c === 'tam' ? Math.round(+i.value) : +i.value; i.nextElementSibling.textContent = c === 'tam' ? px(cfg[c]) : pct(cfg[c]); if (c !== 'tam' && c !== 'opac') muda(); else this.guardaCfg(); Atelie.desenha(); });
    $$('[data-b]', el).forEach(i => i.onchange = () => { cfg[i.dataset.b] = i.checked; muda(); Atelie.pinta(); });
    if ($('[data-forma]', el)) $('[data-forma]', el).onchange = ev => { cfg.forma = ev.target.value; muda(); Atelie.desenha(); };
    if ($('[data-modo]', el)) $('[data-modo]', el).onchange = ev => { cfg.modo = ev.target.value; muda(); Atelie.pinta(); };
    if ($('[data-tol]', el)) $('[data-tol]', el).oninput = ev => { this.tol = Math.round(+ev.target.value); ev.target.nextElementSibling.textContent = this.tol; };
    $('[data-preset]', el).onchange = ev => this.aplicaPreset(ev.target.value);
    if ($('[data-mais]', el)) $('[data-mais]', el).onclick = () => { this._mais = !this._mais; this.pintaBarra(); };
    return el;
  },
});
// o cursor mostra o tamanho real (com a dureza) e a forma
Pintura.desenhaCursor = function (ctx) {
  this.desenhaSelecao(ctx);
  if (!this.mouse || !['pincel', 'borracha'].includes(this.ferr)) return; const a = this.alvo(), d = devicePixelRatio || 1, cfg = this.cfgAtual();
  const r = Math.max(1.5, cfg.tam / 2 / (a?.k || 1) * (a?.escala || 1) * Atelie.vista.z * d), x = this.mouse.x * d, y = this.mouse.y * d;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const forma = (rr) => { ctx.beginPath(); if (cfg.forma === 'redonda') ctx.arc(x, y, rr, 0, 7); else ctx.rect(x - rr, y - rr, rr * 2, rr * 2); };
  forma(r + 1.5 * d); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1 * d; ctx.stroke(); forma(r); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * d; ctx.stroke();
  if (cfg.forma === 'redonda' && cfg.dureza < .9 && r > 6 * d) { forma(r * Math.max(.05, cfg.dureza)); ctx.setLineDash([3 * d, 3 * d]); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1 * d; ctx.stroke(); }
  ctx.restore();
};
