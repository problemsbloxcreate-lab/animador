/* ===================== cena3d.js — CENÁRIO 3D (.glb do Blender) no fundo do Animador (2.3, 13/11/2026, pedido urgente da dona) =====================
   Decisões da dona: formato .glb/.gltf (Blender › Arquivo › Exportar › glTF; o navegador não lê .blend) e CÂMERA 3D ANIMÁVEL: o cenário fica
   3D no fundo, a câmera (posição, alvo e zoom/FOV) ganha chaves na timeline com o mesmo easing do Animador, e os personagens 2D ficam na frente.
   - Camada nova `tipo: 'cena3d'` (n.arq = o .glb guardado como os outros arquivos; vai para a nuvem junto da animação, por Toon.ids).
     Fica atrás de tudo, do tamanho da câmera (n.w × n.h = o vídeo). Chaves da câmera 3D: n.chaves[q].cam = { px, py, pz, tx, ty, tz, fov };
     sem nenhuma chave vale n.cam0 (a câmera que veio no .glb, ou uma padrão olhando o cenário inteiro).
   - three.js r169 LOCAL (js/vendor/three, licença MIT), carregado só quando há cenário 3D (import dinâmico). Projeto sem cenário 3D não muda nada.
   - Uma tela WebGL só, fora da vista: cada desenho põe a câmera do quadro, renderiza e copia para o canvas 2D (Render). Mesmo código na prévia
     e na exportação, quadro a quadro, sem relógio: o MP4 sai igual à prévia. A exportação espera o .glb carregar antes (garante).
   - Luz: a do .glb (KHR_lights_punctual do Blender); sem luz no arquivo, entra uma luz padrão (céu + sol). Céu = n.ceu (cor), nunca vazio.
   - Limite: 30 MB por .glb (aviso claro). .blend solto: "Exporte do Blender como .glb". */
'use strict';
const Cena3D = {
  LIMITE: 30 * 1024 * 1024,
  BASE: (() => { try { return new URL('vendor/three/', document.currentScript.src).href; } catch { return 'js/vendor/three/'; } })(),
  T: null, _carregaT: null, cenas: new Map(), _carregando: new Map(), rend: null,
  async three() {
    if (this.T) return this.T;
    if (!this._carregaT) this._carregaT = (async () => { const [T, G] = await Promise.all([import(this.BASE + 'three.module.min.js'), import(this.BASE + 'GLTFLoader.js')]); this.T = T; this.GLTFLoader = G.GLTFLoader; return T; })();
    return this._carregaT;
  },
  // ---------- carregar o .glb (uma vez por arquivo) ----------
  cena(k) { if (!k) return null; if (this.cenas.has(k)) return this.cenas.get(k); if (!this._carregando.has(k)) this._carregando.set(k, this.carrega(k).then(c => { this._carregando.delete(k); if (c) { this.cenas.set(k, c); try { Render.aoChegarImagem?.(); } catch { } } return c; }, e => { this._carregando.delete(k); console.warn('[cena 3D]', e); return null; })); return null; },
  async carrega(k) {
    const b = await Arq.pegaBlob(k); if (!b) return null; const T = await this.three(), buf = await b.arrayBuffer();
    const g = await new Promise((ok, no) => new this.GLTFLoader().parse(buf, '', ok, no));
    // LUZ DO BLENDER: o exportador grava em unidades físicas (sol em lux = W/m² × 683). Aqui volta para a escala do three (×2/683, as
    // proporções entre as luzes ficam iguais) e sempre entra um céu suave de preenchimento, porque o glTF não leva luz de área nem o World.
    const sc = g.scene; let luzes = 0; sc.traverse(o => { if (o.isLight) { o.intensity = o.intensity * 2 / 683; o.userData.i0 = o.intensity; } });
    { const ceu = new T.HemisphereLight(0xffffff, 0x5a5a66, .9); ceu.userData.i0 = .9; ceu.userData.preench = true; sc.add(ceu); }
    sc.traverse(o => { if (o.isLight && !o.userData.preench) { luzes++; o.castShadow = !!o.isDirectionalLight; if (o.shadow) { o.shadow.mapSize.set(2048, 2048); o.shadow.bias = -0.0005; } } if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    if (!luzes) { const s = new T.DirectionalLight(0xffffff, 2.4); s.userData.i0 = 2.4; s.position.set(5, 10, 7); s.castShadow = true; s.shadow.mapSize.set(2048, 2048); sc.add(s); }
    sc.updateMatrixWorld(true);
    // câmera que veio no arquivo (a do Blender) → câmera inicial; sem câmera: olha o cenário inteiro de frente e um pouco de cima
    let cam0 = null; const cg = g.cameras?.[0];
    if (cg) { cg.updateMatrixWorld(true); const p = new T.Vector3(), d = new T.Vector3(); cg.getWorldPosition(p); cg.getWorldDirection(d); const alvo = p.clone().add(d.multiplyScalar(10)); cam0 = { px: p.x, py: p.y, pz: p.z, tx: alvo.x, ty: alvo.y, tz: alvo.z, fov: cg.isPerspectiveCamera ? cg.fov : 50 }; }
    else { const bx = new T.Box3().setFromObject(sc), c = bx.getCenter(new T.Vector3()), r = Math.max(1, bx.getSize(new T.Vector3()).length() / 2); cam0 = { px: c.x, py: c.y + r * .45, pz: c.z + r * 1.9, tx: c.x, ty: c.y, tz: c.z, fov: 40 }; }
    for (const c of ['px', 'py', 'pz', 'tx', 'ty', 'tz', 'fov']) cam0[c] = round(cam0[c], 3);
    return { sc, cam0, temLuz: luzes > 0, cam: new T.PerspectiveCamera(cam0.fov, 16 / 9, .05, 5000) };
  },
  async garante(P) { const ks = this.arqs(P); if (!ks.length) return; await this.three(); await Promise.all(ks.map(k => this.cenas.get(k) || this._carregando.get(k) || (this.cena(k), this._carregando.get(k)))); },
  arqs(P) { return P ? [...new Set(Modelo.todos(P).filter(n => n.tipo === 'cena3d' && n.arq).map(n => n.arq))] : []; },
  // ---------- câmera do quadro q: entre as chaves com .cam, com o easing da chave de chegada (o mesmo do Animador) ----------
  CAMPOS: ['px', 'py', 'pz', 'tx', 'ty', 'tz', 'fov'],
  chavesCam(n) { return Object.keys(n.chaves || {}).map(Number).filter(k => n.chaves[k]?.cam).sort((a, b) => a - b); },
  camEm(n, q) {
    const ks = this.chavesCam(n), base = n.cam0 || { px: 0, py: 2, pz: 8, tx: 0, ty: 0, tz: 0, fov: 40 }; if (!ks.length) return { ...base };
    let a = null, b = null; for (const k of ks) { if (k <= q) a = k; else { b = k; break; } }
    if (a == null) return { ...base, ...n.chaves[b].cam }; if (b == null || a === q) return { ...base, ...n.chaves[a].cam };
    const A = { ...base, ...n.chaves[a].cam }, B = { ...base, ...n.chaves[b].cam }, t = Ease.daChave(n.chaves[b])((q - a) / (b - a)), o = {};
    for (const c of this.CAMPOS) o[c] = A[c] + (B[c] - A[c]) * t; return o;
  },
  // ---------- desenhar: devolve uma tela com o quadro q (ou null enquanto carrega) ----------
  quadro(P, n, q, wPx, hPx) {
    const c = this.cena(n.arq); if (!c || !this.T) return null; const T = this.T;
    if (!this.rend) { this.rend = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false }); this.rend.outputColorSpace = T.SRGBColorSpace; this.rend.toneMapping = T.AgXToneMapping; this.rend.shadowMap.enabled = true; this.rend.shadowMap.type = T.PCFSoftShadowMap; this.rend.setPixelRatio(1); }
    const w = Math.max(16, Math.min(4096, Math.round(wPx))), h = Math.max(16, Math.min(4096, Math.round(hPx))), k = `${n.arq}|${w}x${h}|${JSON.stringify(this.camEm(n, q))}|${n.ceu || ''}|${n.luz ?? 1}`;
    if (this._ult === k) return this.rend.domElement;
    const cm = this.camEm(n, q), cam = c.cam; cam.aspect = (n.w || P.w) / (n.h || P.h); cam.fov = Math.max(5, Math.min(120, cm.fov)); cam.position.set(cm.px, cm.py, cm.pz); cam.lookAt(cm.tx, cm.ty, cm.tz); cam.updateProjectionMatrix();
    c.sc.background = new T.Color(n.ceu || '#c9d3df'); const luz = n.luz ?? 1; if (c._luz !== luz) { c._luz = luz; c.sc.traverse(o => { if (o.isLight && o.userData.i0 != null) o.intensity = o.userData.i0 * luz; }); } if (this.rend.domElement.width !== w || this.rend.domElement.height !== h) this.rend.setSize(w, h, false);
    this.rend.render(c.sc, cam); this._ult = k; return this.rend.domElement;
  },
  // ---------- pôr um cenário 3D na animação ----------
  async importar(f) {
    const P = App.P; if (!P) return UI.toast('Abra uma animação para pôr o cenário 3D.', { kind: 'warn' });
    if (/\.blend\d?$/i.test(f.name)) return UI.toast('O navegador não abre arquivos .blend. <b>Exporte do Blender como .glb</b>: Arquivo › Exportar › glTF 2.0 (.glb), e solte o .glb aqui.', { kind: 'warn', time: 9000 });
    if (/\.gltf$/i.test(f.name)) { const t = await f.text().catch(() => ''); if (/"uri"\s*:\s*"(?!data:)/.test(t)) return UI.toast('Esse .gltf usa arquivos separados (.bin e texturas). <b>Exporte do Blender como .glb</b> (um arquivo só) e solte de novo.', { kind: 'warn', time: 9000 }); }
    if (f.size > this.LIMITE) return UI.toast(`Esse cenário tem ${(f.size / 1048576).toFixed(1)} MB. O limite é ${this.LIMITE / 1048576} MB: no Blender, diminua as texturas ou use Exportar › glTF com compressão e tente de novo.`, { kind: 'warn', time: 9000 });
    const t = UI.toast('<span class="spin-dot"></span> Abrindo o cenário 3D…', { time: 60000 });
    try {
      const id = await Arq.guardar(new Blob([await f.arrayBuffer()], { type: 'model/gltf-binary' }), 'c3d' + uid('').replace(/[^a-z0-9]/gi, '').toLowerCase() + '.glb');
      const c = await this.carrega(id); if (!c) throw new Error('o arquivo não abriu como glTF'); this.cenas.set(id, c);
      const q = App.q, cam = Modelo.camera(P, q), z = cam.zoom || 1;
      const n = Modelo.novoNo('forma', { nome: ('Cenário 3D · ' + f.name.replace(/\.[^.]+$/, '')).slice(0, 48) }); n.tipo = 'cena3d'; delete n.forma; n.arq = id; n.w = P.w; n.h = P.h; n.cam0 = c.cam0; n.ceu = '#c9d3df';
      n.de = q; n.chaves = { [q]: { x: Math.round(cam.x), y: Math.round(cam.y), r: 0, s: round(1 / z * 1.01, 3), sx: 1, op: 1 } }; n.cenario = true;
      const i = P.raiz.findIndex(x => x.cenario || x.fundoPadrao); if (i >= 0) P.raiz.splice(i, 0, n); else P.raiz.push(n);
      App.sel = n.id; App.commit('Cenário 3D'); t.remove();
      UI.toast(`Cenário 3D <b>${esc(n.nome)}</b> no fundo${c.temLuz ? ', com a luz do arquivo' : ', com uma luz padrão (o arquivo não tinha luz)'}. A câmera 3D fica em Propriedades.`, { kind: 'ok', time: 7000 });
    } catch (e) { t.remove(); UI.toast('Não abri o cenário 3D: ' + esc(e.message || String(e)) + '. <b>Exporte do Blender como .glb</b> e tente de novo.', { kind: 'err', time: 9000 }); }
  },
  async escolher() { const [f] = await pickFiles('.glb,.gltf,.blend', false); if (f) this.importar(f); },
  // ---------- câmera 3D: chave no quadro de agora ----------
  poeCam(n, q, mud) { const atual = this.camEm(n, q); Modelo.poeTransf(n, q, {}); const k = Modelo.chave(n, q); k.cam = { ...atual, ...(k.cam || {}), ...mud }; for (const c of this.CAMPOS) k.cam[c] = round(k.cam[c], 3); },
  tiraCam(n, q) { const k = n.chaves?.[q]; if (!k?.cam) return false; delete k.cam; return true; },
  // painel (Propriedades) da camada de cenário 3D, no visual do Celeste
  painel(el, n) {
    const P = App.P, q = App.q, cm = this.camEm(n, q), temK = !!n.chaves?.[q]?.cam, nk = this.chavesCam(n).length, st = r => App.commit(r || 'Câmera 3D', { semArvore: true });
    el.appendChild(Lado.secao('p-c3d', 'Câmera 3D', `${nk} chave${nk === 1 ? '' : 's'}`, c => {
      c.appendChild(h(`<div class="pr-info">${temK ? `<b>Chave da câmera</b> no quadro ${q + 1}.` : `Quadro ${q + 1}: a câmera está ${nk ? 'indo de uma chave para a outra' : 'parada na câmera do arquivo'}. Mudar um número cria a chave aqui.`}</div>`));
      const muda = (campo, v) => { this.poeCam(n, q, { [campo]: v }); App.pinta(); };
      const g1 = h('<div class="pr-num-grade c3d-grade"></div>'), g2 = h('<div class="pr-num-grade c3d-grade"></div>');
      for (const [c0, nm] of [['px', 'X'], ['py', 'Y'], ['pz', 'Z']]) g1.appendChild(Lado.num(nm, cm[c0], { passo: .05, dec: 2 }, v => muda(c0, v), () => st()));
      for (const [c0, nm] of [['tx', 'X'], ['ty', 'Y'], ['tz', 'Z']]) g2.appendChild(Lado.num(nm, cm[c0], { passo: .05, dec: 2 }, v => muda(c0, v), () => st()));
      c.append(h('<div class="c3d-t">Posição da câmera</div>'), g1, h('<div class="c3d-t">Para onde olha (alvo)</div>'), g2);
      const g3 = h('<div class="pr-num-grade"></div>'); g3.appendChild(Lado.num('Zoom (FOV)', cm.fov, { passo: .5, min: 5, max: 120, dec: 1, unid: '°' }, v => muda('fov', v), () => st())); c.appendChild(g3);
      const a = h(`<div class="pr-acoes"><button class="btn sm ${temK ? 'on' : ''}" data-k>${ic('diamond', 12)} ${temK ? 'Chave aqui' : 'Pôr chave aqui'}</button>${temK ? `<button class="btn sm" data-t>${ic('x', 12)} Tirar a chave</button>` : ''}<button class="btn sm" data-o title="Gira a câmera em volta do alvo">${ic('redo', 12)} Girar 15°</button><button class="btn sm" data-z title="Volta para a câmera que veio no arquivo do Blender">${ic('undo', 12)} Câmera do arquivo</button></div>`);
      $('[data-k]', a).onclick = () => { this.poeCam(n, q, {}); st('Chave da câmera 3D'); };
      $('[data-t]', a)?.addEventListener('click', () => { if (this.tiraCam(n, q)) st('Tirar a chave da câmera 3D'); });
      $('[data-o]', a).onclick = () => { const r = Math.hypot(cm.px - cm.tx, cm.pz - cm.tz), ang = Math.atan2(cm.px - cm.tx, cm.pz - cm.tz) + Math.PI / 12; this.poeCam(n, q, { px: cm.tx + Math.sin(ang) * r, pz: cm.tz + Math.cos(ang) * r }); st('Girar a câmera 3D'); };
      $('[data-z]', a).onclick = () => { this.poeCam(n, q, { ...n.cam0 }); st('Câmera do arquivo'); };
      c.appendChild(a);
      { const g4 = h('<div class="pr-num-grade"></div>'); g4.appendChild(Lado.num('Luz', Math.round((n.luz ?? 1) * 100), { passo: 5, min: 0, max: 400, dec: 0, unid: '%' }, v => { n.luz = v / 100; App.pinta(); }, () => st('Luz do cenário 3D'))); c.appendChild(g4); }
      const cor = Lado.cor ? Lado.cor('Céu', n.ceu || '#c9d3df', v => { n.ceu = v; App.pinta(); }, () => st('Céu do cenário 3D')) : null; if (cor) c.appendChild(cor);
      c.appendChild(h(`<div class="pr-info c3d-dica">As chaves da câmera usam o mesmo jeito de chegar das outras chaves (botão direito na chave, na timeline).</div>`));
    }, true));
  },
  liga() {
    if (this._ok || typeof App === 'undefined') return; this._ok = true;
    try { TIPO_IC.cena3d = 'paisagem'; } catch { }
    // os arquivos da animação (nuvem, .animador, tamanho) também levam o .glb
    if (typeof Toon !== 'undefined') { const ti = Toon.ids; Toon.ids = function (P) { return [...new Set([...ti.call(this, P), ...Cena3D.arqs(P)])]; }; }
    // abrir: já carrega o 3D; exportar: espera o 3D antes do primeiro quadro (o MP4 igual à prévia)
    const ab = App.abrir; App.abrir = async function (...x) { const r = await ab.apply(this, x); if (Cena3D.arqs(App.P).length) await Cena3D.garante(App.P).catch(e => console.warn(e)); return r; };
    if (typeof Exportar !== 'undefined') for (const f of ['mp4', 'png', 'quadros']) if (typeof Exportar[f] === 'function') { const o = Exportar[f]; Exportar[f] = async function (...x) { await Cena3D.garante(App.P).catch(() => { }); return o.apply(this, x); }; }
    // Propriedades: a seção da câmera 3D
    if (typeof Lado !== 'undefined') { const pp = Lado.props; Lado.props = function (el, ...x) { const r = pp.call(this, el, ...x); try { const n = App.noSel?.(); if (n?.tipo === 'cena3d') Cena3D.painel(el, n); } catch (e) { console.warn('[cena 3D painel]', e); } return r; }; }
    // menu "Pôr um cenário": item novo
    const mc = App.menuCenario; App.menuCenario = function (x, y) { const ctx0 = UI.ctx; UI.ctx = (a, b, itens) => { UI.ctx = ctx0; return ctx0(a, b, [...itens, '-', { label: 'Cenário 3D do Blender (.glb)…', icon: 'paisagem', action: () => Cena3D.escolher() }]); }; try { return mc.call(this, x, y); } finally { UI.ctx = ctx0; } };
    // soltar .glb / .gltf / .blend no Animador
    document.addEventListener('drop', e => { const f = [...(e.dataTransfer?.files || [])].find(x => /\.(glb|gltf|blend\d?)$/i.test(x.name)); if (!f) return; if ($('#editor')?.classList.contains('hidden')) return; e.preventDefault(); e.stopPropagation(); this.importar(f); }, true);
  },
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Cena3D.liga()); else Cena3D.liga();
