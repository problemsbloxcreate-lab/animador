/* ===================== ajustes.js — ajustes e transformação estilo Photoshop (Ateliê › Pintar e cores) =====================
   Valem para a CAMADA ATIVA (ou a imagem, se ela não tem camadas) e, se houver seleção, só dentro dela. Prévia ao vivo no palco.
   Ajustes: brilho, contraste, saturação, matiz, desfoque, nitidez, inverter, preto e branco, sépia (canvas filter).
   Transformar: tamanho, giro e espelhar em volta do meio do desenho. Atalhos: Ctrl+U ajustes, Ctrl+I inverter, Ctrl+Shift+U preto e branco, Shift+T transformar. */
'use strict';
const Ajustes = {
  // a fonte (bitmap) que vai ser mexida e como gravar/mostrar
  alvo() { const a = Pintura.alvo(); if (!a) { UI.toast('Escolha uma parte com imagem (aba Pintar e cores).', { kind: 'warn' }); return null; } return { ...a, mask: Pintura.mascara?.(a) || null }; },
  mostra(a, cv) { if (a.vivo) a.vivo(cv); else Arq.img.set(a.img.k, cv); Atelie.desenha(); },
  volta(a) { Arq.img.set(a.img.k, a.orig || a.bm); Atelie.desenha(); },
  async grava(a, cv) { Arq.img.set(a.img.k, a.orig || a.bm); await Pintura.gravar(a.img, cv); Atelie.commit(); },
  // aplica o desenho novo só dentro da seleção (fora fica o de antes)
  naSelecao(a, novo) { if (!a.mask) return novo; const W = a.bm.width, H = a.bm.height, cv = new OffscreenCanvas(W, H), x = cv.getContext('2d'), t = new OffscreenCanvas(W, H), tx = t.getContext('2d');
    tx.drawImage(novo, 0, 0); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(a.mask, 0, 0); x.drawImage(a.bm, 0, 0); x.globalCompositeOperation = 'destination-out'; x.drawImage(a.mask, 0, 0); x.globalCompositeOperation = 'source-over'; x.drawImage(t, 0, 0); return cv; },
  filtrado(a, v) {
    const W = a.bm.width, H = a.bm.height, cv = new OffscreenCanvas(W, H), x = cv.getContext('2d'), f = [];
    if (v.brilho) f.push(`brightness(${100 + v.brilho}%)`); if (v.contraste) f.push(`contrast(${100 + v.contraste}%)`); if (v.sat) f.push(`saturate(${100 + v.sat}%)`); if (v.matiz) f.push(`hue-rotate(${v.matiz}deg)`);
    if (v.desfoque) f.push(`blur(${v.desfoque}px)`); if (v.pb) f.push('grayscale(100%)'); if (v.sepia) f.push('sepia(100%)'); if (v.inverter) f.push('invert(100%)');
    x.filter = f.join(' ') || 'none'; x.drawImage(a.bm, 0, 0); x.filter = 'none';
    if (v.nitidez) { const d = x.getImageData(0, 0, W, H), s = new Uint8ClampedArray(d.data), D = d.data, k = v.nitidez / 100; // máscara de nitidez simples (4 vizinhos)
      for (let y = 1; y < H - 1; y++) for (let xx = 1; xx < W - 1; xx++) { const i = (y * W + xx) * 4; for (let c = 0; c < 3; c++) { const m = (s[i - 4 + c] + s[i + 4 + c] + s[i - W * 4 + c] + s[i + W * 4 + c]) / 4; D[i + c] = s[i + c] + (s[i + c] - m) * k * 2; } }
      x.putImageData(d, 0, 0); }
    if (v.desfoque) { x.globalCompositeOperation = 'destination-in'; x.drawImage(a.bm, 0, 0); x.globalCompositeOperation = 'source-over'; } // o desfoque não espalha tinta para fora do desenho
    return this.naSelecao(a, cv);
  },
  // janela de ajustes (prévia ao vivo)
  async abrir() {
    const a = this.alvo(); if (!a) return; const v = { brilho: 0, contraste: 0, sat: 0, matiz: 0, desfoque: 0, nitidez: 0, pb: false, sepia: false, inverter: false };
    const lin = (k, n, mn, mx, u = '') => `<label class="aj-l"><span>${n}</span><input type="range" min="${mn}" max="${mx}" value="0" data-k="${k}"><output>0${u}</output></label>`;
    const body = h(`<div class="aj">${lin('brilho', 'Brilho', -100, 100)}${lin('contraste', 'Contraste', -100, 100)}${lin('sat', 'Saturação', -100, 100)}${lin('matiz', 'Matiz', -180, 180, '°')}${lin('desfoque', 'Desfoque', 0, 20, ' px')}${lin('nitidez', 'Nitidez', 0, 100)}
      <div class="campo2"><label class="chk"><input type="checkbox" data-c="pb"> Preto e branco</label><label class="chk"><input type="checkbox" data-c="sepia"> Sépia</label><label class="chk"><input type="checkbox" data-c="inverter"> Inverter</label></div>
      <div style="color:var(--tx3);font-size:11.5px;margin-top:6px">Vale para ${a.cam ? `a camada <b>${esc(a.cam.nome)}</b>` : `a imagem <b>${esc(a.img.nome)}</b>`}${a.mask ? ' (só dentro da seleção)' : ''}. A prévia já aparece no palco.</div></div>`);
    let raf = 0; const prev = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => this.mostra(a, this.filtrado(a, v))); };
    $$('[data-k]', body).forEach(i => i.oninput = () => { v[i.dataset.k] = +i.value; i.nextElementSibling.textContent = i.value + (i.dataset.k === 'matiz' ? '°' : i.dataset.k === 'desfoque' ? ' px' : ''); prev(); });
    $$('[data-c]', body).forEach(i => i.onchange = () => { v[i.dataset.c] = i.checked; prev(); });
    const ok = await UI.modal({ title: 'Ajustes de cor', icon: 'palette', width: 420, body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Aplicar', kind: 'primary', value: true }] });
    cancelAnimationFrame(raf); if (!ok) return this.volta(a); await this.grava(a, this.filtrado(a, v));
  },
  async rapido(v, nome) { const a = this.alvo(); if (!a) return; await this.grava(a, this.filtrado(a, v)); UI.toast(`${nome} (Ctrl+Z desfaz).`, { kind: 'ok' }); },
  // transformar: tamanho, giro e espelhar em volta do meio do desenho (ou da seleção)
  transformado(a, t) {
    const W = a.bm.width, H = a.bm.height, bb = this.caixa(a.mask ? this.recortado(a) : a.bm) || { x: 0, y: 0, w: W, h: H };
    const cx = bb.x + bb.w / 2 + (t.dx || 0), cy = bb.y + bb.h / 2 + (t.dy || 0), cv = new OffscreenCanvas(W, H), x = cv.getContext('2d');
    const base = a.mask ? (() => { const b = new OffscreenCanvas(W, H), bx = b.getContext('2d'); bx.drawImage(a.bm, 0, 0); bx.globalCompositeOperation = 'destination-out'; bx.drawImage(a.mask, 0, 0); return b; })() : null;
    if (base) x.drawImage(base, 0, 0);
    x.save(); x.translate(cx, cy); x.rotate(t.r * Math.PI / 180); x.scale(t.s / 100 * (t.fx ? -1 : 1), t.s / 100 * (t.fy ? -1 : 1)); x.translate(-(bb.x + bb.w / 2), -(bb.y + bb.h / 2)); x.imageSmoothingQuality = 'high';
    x.drawImage(a.mask ? this.recortado(a) : a.bm, 0, 0); x.restore(); return cv;
  },
  recortado(a) { const W = a.bm.width, H = a.bm.height, c = new OffscreenCanvas(W, H), x = c.getContext('2d'); x.drawImage(a.bm, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(a.mask, 0, 0); return c; },
  caixa(cv) { const W = cv.width, H = cv.height, c = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true }); c.drawImage(cv, 0, 0); const D = c.getImageData(0, 0, W, H).data; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (D[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }; },
  async transformar() {
    const a = this.alvo(); if (!a) return; const t = { s: 100, r: 0, fx: false, fy: false, dx: 0, dy: 0 };
    const body = h(`<div class="aj"><label class="aj-l"><span>Tamanho</span><input type="range" min="10" max="300" value="100" data-k="s"><output>100%</output></label><label class="aj-l"><span>Giro</span><input type="range" min="-180" max="180" value="0" data-k="r"><output>0°</output></label>
      <label class="aj-l"><span>Mover X</span><input type="range" min="-${a.bm.width}" max="${a.bm.width}" value="0" data-k="dx"><output>0</output></label><label class="aj-l"><span>Mover Y</span><input type="range" min="-${a.bm.height}" max="${a.bm.height}" value="0" data-k="dy"><output>0</output></label>
      <div class="campo2"><label class="chk"><input type="checkbox" data-c="fx"> Espelhar ↔</label><label class="chk"><input type="checkbox" data-c="fy"> Espelhar ↕</label><button class="btn sm" data-g="-90">-90°</button><button class="btn sm" data-g="90">+90°</button></div>
      <div style="color:var(--tx3);font-size:11.5px;margin-top:6px">Vale para ${a.cam ? `a camada <b>${esc(a.cam.nome)}</b>` : `a imagem <b>${esc(a.img.nome)}</b>`}${a.mask ? ' (só o que está selecionado)' : ''}, em volta do meio do desenho.</div></div>`);
    let raf = 0; const prev = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => this.mostra(a, this.transformado(a, t))); };
    $$('[data-k]', body).forEach(i => i.oninput = () => { t[i.dataset.k] = +i.value; i.nextElementSibling.textContent = i.value + (i.dataset.k === 's' ? '%' : i.dataset.k === 'r' ? '°' : ''); prev(); });
    $$('[data-c]', body).forEach(i => i.onchange = () => { t[i.dataset.c] = i.checked; prev(); });
    $$('[data-g]', body).forEach(b => b.onclick = () => { t.r = ((t.r + +b.dataset.g + 540) % 360) - 180; const i = $('[data-k=r]', body); i.value = t.r; i.nextElementSibling.textContent = t.r + '°'; prev(); });
    const ok = await UI.modal({ title: 'Transformar', icon: 'move', width: 420, body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Aplicar', kind: 'primary', value: true }] });
    cancelAnimationFrame(raf); if (!ok) return this.volta(a); await this.grava(a, this.transformado(a, t));
  },
  // botões na aba Pintar e cores
  botoes(el) {
    const box = h(`<div class="sessao"><h4>${ic('palette', 13)} Ajustes e transformar</h4><div class="pt-acoes">
      <button class="btn sm" data-a="abrir" title="Ctrl+U">Ajustes de cor…</button><button class="btn sm" data-a="transformar" title="Shift+T">Transformar…</button>
      <button class="btn sm" data-a="fx">Espelhar ↔</button><button class="btn sm" data-a="fy">Espelhar ↕</button><button class="btn sm" data-a="g90">Girar 90°</button>
      <button class="btn sm" data-a="inv" title="Ctrl+I">Inverter cores</button><button class="btn sm" data-a="pb" title="Ctrl+Shift+U">Preto e branco</button></div>
      <div style="color:var(--tx3);font-size:11.5px;margin-top:4px">Valem para a camada ativa (ou a imagem) e, com seleção, só dentro dela.</div></div>`);
    const tr = (t, n) => async () => { const a = this.alvo(); if (!a) return; await this.grava(a, this.transformado(a, { s: 100, r: 0, ...t })); UI.toast(n + ' (Ctrl+Z desfaz).', { kind: 'ok' }); };
    const acao = { abrir: () => this.abrir(), transformar: () => this.transformar(), fx: tr({ fx: true }, 'Espelhado'), fy: tr({ fy: true }, 'Espelhado'), g90: tr({ r: 90 }, 'Girado'), inv: () => this.rapido({ inverter: true }, 'Cores invertidas'), pb: () => this.rapido({ pb: true }, 'Preto e branco') };
    $$('[data-a]', box).forEach(b => b.onclick = () => acao[b.dataset.a]()); el.appendChild(box);
  },
  // atalhos (chamados pela Pintura.teclaCtrl e Atelie.teclas)
  tecla(e) { const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'u' && !e.shiftKey) { e.preventDefault(); this.abrir(); return true; }
    if ((e.ctrlKey || e.metaKey) && k === 'u' && e.shiftKey) { e.preventDefault(); this.rapido({ pb: true }, 'Preto e branco'); return true; }
    if ((e.ctrlKey || e.metaKey) && k === 'i' && !e.shiftKey) { e.preventDefault(); this.rapido({ inverter: true }, 'Cores invertidas'); return true; }
    if (!(e.ctrlKey || e.metaKey) && e.shiftKey && k === 't') { e.preventDefault(); this.transformar(); return true; }
    return false; },
};
