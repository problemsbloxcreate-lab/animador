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
   - Limite: 24 MB por .glb (a nuvem das animações aceita 25 MB por arquivo). Geometria Draco e imagens WebP abrem (decodificador local).
     .blend solto: "Exporte do Blender como .glb". */
'use strict';
const Cena3D = {
  LIMITE: 24 * 1024 * 1024, // abaixo dos 25 MB por arquivo da nuvem das animações (turma-ia /animacoes)
  BASE: (() => { try { return new URL('vendor/three/', document.currentScript.src).href; } catch { return 'js/vendor/three/'; } })(),
  T: null, _carregaT: null, cenas: new Map(), _carregando: new Map(), rend: null,
  async three() {
    if (this.T) return this.T;
    if (!this._carregaT) this._carregaT = (async () => { const [T, G, D] = await Promise.all([import(this.BASE + 'three.module.min.js'), import(this.BASE + 'GLTFLoader.js'), import(this.BASE + 'DRACOLoader.js')]); this.T = T; this.GLTFLoader = G.GLTFLoader; this.DRACOLoader = D.DRACOLoader; return T; })();
    return this._carregaT;
  },
  // ---------- carregar o .glb (uma vez por arquivo) ----------
  cena(k) { if (!k) return null; if (this.cenas.has(k)) return this.cenas.get(k); if (!this._carregando.has(k)) this._carregando.set(k, this.carrega(k).then(c => { this._carregando.delete(k); if (c) { this.cenas.set(k, c); try { Render.aoChegarImagem?.(); } catch { } } return c; }, e => { this._carregando.delete(k); console.warn('[cena 3D]', e); return null; })); return null; },
  async carrega(k) {
    const b = this.ehCasa(k) ? await this.blobCasa(k) : await Arq.pegaBlob(k); if (!b) return null; const T = await this.three(), buf = await b.arrayBuffer();
    // GEOMETRIA COMPRIMIDA (Draco, Blender › Exportar › glTF › Compressão): o decodificador também é local (js/vendor/three/draco, só baixa se o arquivo usar)
    if (!this._draco) { this._draco = new this.DRACOLoader(); this._draco.setDecoderPath(this.BASE + 'draco/'); this._draco.setDecoderConfig({ type: 'wasm' }); }
    const L = new this.GLTFLoader(); L.setDRACOLoader(this._draco); const g = await new Promise((ok, no) => L.parse(buf, '', ok, no));
    // LUZ DO BLENDER: o exportador grava em unidades físicas (sol em lux = W/m² × 683). Aqui volta para a escala do three (×2/683, as
    // proporções entre as luzes ficam iguais) e sempre entra um céu suave de preenchimento, porque o glTF não leva luz de área nem o World.
    // o glTF entrega um GRUPO: a cor do céu (scene.background) só vale numa cena de verdade, então o grupo vai dentro de uma
    const sc = new T.Scene(); sc.add(g.scene); let luzes = 0; sc.traverse(o => { if (o.isLight) { o.intensity = o.intensity * 2 / 683; o.userData.i0 = o.intensity; } });
    { const ceu = new T.HemisphereLight(0xffffff, 0x5a5a66, .9); ceu.userData.i0 = .9; ceu.userData.preench = true; sc.add(ceu); }
    sc.traverse(o => { if (o.isLight && !o.userData.preench) { luzes++; o.castShadow = !!o.isDirectionalLight; if (o.shadow) { o.shadow.mapSize.set(2048, 2048); o.shadow.bias = -0.0005; } } if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // MATERIAL SÓ DE EMISSÃO (cor preta + emissão, o jeito "sem luz" do Blender): vira material sem luz, e a transparência da imagem vale
    // (chão, morros e nuvens em PNG com fundo transparente vinham opacos e pretos; o exportador não marca a transparência nesses casos)
    sc.traverse(o => { if (!o.isMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
      const nv = ms.map(m => { if (!m?.isMeshStandardMaterial || m.map || (m.color && m.color.getHex() !== 0) || !(m.emissiveMap || m.emissive?.getHex())) return m;
        const b = new T.MeshBasicMaterial({ color: m.emissive.clone().multiplyScalar(m.emissiveIntensity ?? 1), map: m.emissiveMap || null, vertexColors: !!(m.userData?.cor_assada && o.geometry?.attributes?.color), /* cor assada nos vértices pelo converter_cenario.py (sombra pintada e ruído do Blender) */ side: m.side, transparent: !!m.emissiveMap, alphaTest: m.emissiveMap ? .5 : 0, toneMapped: false }); b.name = m.name; m.dispose(); return b; });
      o.material = Array.isArray(o.material) ? nv : nv[0]; });
    // LUZ DE EFEITO (raio de luar, halo, marcada 'aditivo' pelos scripts do Blender): a cor SOMA no que está atrás, como no Blender
    sc.traverse(o => { if (!o.isMesh || !(o.userData?.aditivo || o.parent?.userData?.aditivo)) return; for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { m.transparent = true; m.blending = T.AdditiveBlending; m.depthWrite = false; m.alphaTest = 0; m.toneMapped = false; m.needsUpdate = true; } });
    if (!luzes) { const s = new T.DirectionalLight(0xffffff, 2.4); s.userData.i0 = 2.4; s.position.set(5, 10, 7); s.castShadow = true; s.shadow.mapSize.set(2048, 2048); sc.add(s); }
    sc.updateMatrixWorld(true);
    // câmera que veio no arquivo (a do Blender) → câmera inicial; sem câmera: olha o cenário inteiro de frente e um pouco de cima
    let cam0 = null; const cg = g.cameras?.[0];
    if (cg) { cg.updateMatrixWorld(true); const p = new T.Vector3(), d = new T.Vector3(); cg.getWorldPosition(p); cg.getWorldDirection(d); const alvo = p.clone().add(d.multiplyScalar(10)); cam0 = { px: p.x, py: p.y, pz: p.z, tx: alvo.x, ty: alvo.y, tz: alvo.z, fov: cg.isPerspectiveCamera ? cg.fov : 50 }; }
    else { // sem câmera no arquivo: enquadra o MIOLO do cenário (planos gigantes de céu/chão/fundo não contam), de frente, um pouco de cima
      const tudo = new T.Box3().setFromObject(sc), maxT = Math.max(...tudo.getSize(new T.Vector3()).toArray()), miolo = new T.Box3();
      sc.traverse(o => { if (!o.isMesh) return; const b = new T.Box3().setFromObject(o); if (Math.max(...b.getSize(new T.Vector3()).toArray()) < maxT * .2) miolo.union(b); });
      const bx = miolo.isEmpty() ? tudo : miolo, c = bx.getCenter(new T.Vector3()), r = Math.max(1, bx.getSize(new T.Vector3()).length() / 2);
      cam0 = { px: c.x, py: c.y + r * .35, pz: c.z + r * 1.6, tx: c.x, ty: c.y, tz: c.z, fov: 40 }; }
    for (const c of ['px', 'py', 'pz', 'tx', 'ty', 'tz', 'fov']) cam0[c] = round(cam0[c], 3);
    const diag = Math.max(10, new T.Box3().setFromObject(sc).getSize(new T.Vector3()).length()); // a visão alcança o cenário inteiro, qualquer escala
    return { sc, cam0, temLuz: luzes > 0, cam: new T.PerspectiveCamera(cam0.fov, 16 / 9, Math.max(.01, diag / 20000), diag * 3) };
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
    if (/\.blend\d?$/i.test(f.name)) return this.converterNaPonte(f); // .blend: a ponte do Blender converte (sem ponte: explica como ligar)
    if (/\.gltf$/i.test(f.name)) { const t = await f.text().catch(() => ''); if (/"uri"\s*:\s*"(?!data:)/.test(t)) return UI.toast('Esse .gltf usa arquivos separados (.bin e texturas). <b>Exporte do Blender como .glb</b> (um arquivo só) e solte de novo.', { kind: 'warn', time: 9000 }); }
    if (f.size > this.LIMITE) return UI.toast(`Esse cenário tem ${(f.size / 1048576).toFixed(1)} MB. O limite é ${this.LIMITE / 1048576} MB. No Blender, em Arquivo › Exportar › glTF, ligue <b>Compressão</b> (Draco) e escolha imagens em <b>WebP</b>: costuma cair para menos de um quarto.`, { kind: 'warn', time: 9000 });
    const t = UI.toast('<span class="spin-dot"></span> Abrindo o cenário 3D…', { time: 60000 });
    try {
      const id = await Arq.guardar(new Blob([await f.arrayBuffer()], { type: 'model/gltf-binary' }), 'c3d' + uid('').replace(/[^a-z0-9]/gi, '').toLowerCase() + '.glb');
      const c = await this.carrega(id); if (!c) throw new Error('o arquivo não abriu como glTF'); this.cenas.set(id, c);
      const q = App.q, cam = Modelo.camera(P, q), z = cam.zoom || 1;
      const n = Modelo.novoNo('forma', { nome: ('Cenário 3D · ' + f.name.replace(/\.[^.]+$/, '')).slice(0, 48) }); n.tipo = 'cena3d'; delete n.forma; n.arq = id; n.w = P.w; n.h = P.h; n.cam0 = c.cam0; n.ceu = '#c9d3df';
      n.de = q; n.chaves = { [q]: { x: Math.round(cam.x), y: Math.round(cam.y), r: 0, s: round(1 / z * 1.01, 3), sx: 1, op: 1 } }; n.cenario = true;
      const i = P.raiz.findIndex(x => x.cenario || x.fundoPadrao); if (i >= 0) P.raiz.splice(i, 0, n); else P.raiz.push(n);
      // ANIMAÇÃO NA NUVEM: o .glb vai para a nuvem da animação ANTES do commit. Assim o ao vivo (sala em tempo real) vê que o arquivo
      // já está na nuvem e não tenta mandá-lo pela sala, que não aguenta arquivos de MB e perdia a camada nova (teste da rua, 5,8 MB, 13/11).
      if (typeof NuvemAnim !== 'undefined' && NuvemAnim.vai?.(P)) { t.remove();
        const ok = await (typeof Ocupado !== 'undefined' && Ocupado.nuvem ? Ocupado.nuvem('Mandando o cenário 3D para a nuvem', () => NuvemAnim.salvar(P, x => Ocupado.anda?.(x))) : NuvemAnim.salvar(P)).catch(() => false);
        if (!ok) { P.raiz.splice(P.raiz.indexOf(n), 1); return UI.toast('O cenário 3D não foi para a nuvem agora, então não entrou na animação. Tente de novo em instantes.', { kind: 'err', time: 8000 }); } }
      const troca = typeof CenLib !== 'undefined' && CenLib.trocaAqui ? CenLib.trocaAqui(P, n, q) : ''; // depois da nuvem: se falhar lá, nada foi cortado
      App.sel = n.id; App.commit('Cenário 3D'); t.remove();
      UI.toast(troca || `Cenário 3D <b>${esc(n.nome)}</b> no fundo${c.temLuz ? ', com a luz do arquivo' : ', com uma luz padrão (o arquivo não tinha luz)'}. A câmera 3D fica em Propriedades.`, { kind: 'ok', time: troca ? 9000 : 7000 });
    } catch (e) { t.remove(); UI.toast('Não abri o cenário 3D: ' + esc(e.message || String(e)) + '. <b>Exporte do Blender como .glb</b> e tente de novo.', { kind: 'err', time: 9000 }); }
  },
  async escolher() { const [f] = await pickFiles('.glb,.gltf,.blend', false); if (f) this.importar(f); }, // .blend passa pela ponte
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
      c.appendChild(h(`<div class="pr-info c3d-dica">No palco: <b>Alt + arrastar</b> gira, <b>Alt + Shift + arrastar</b> anda, <b>Alt + rodinha</b> aproxima. Cada mudança vira chave neste quadro, com o mesmo jeito de chegar das outras chaves.</div>`));
    }, true));
  },
  // ---------- PERSONAGEM PRESO NO CENÁRIO 3D (n.ancora3d = { cena, x, y, z, cam }) ----------
  // O personagem continua 2D, mas fica plantado num ponto do chão do 3D: a cada quadro o ponto é projetado pela câmera daquele quadro
  // e o personagem anda e muda de tamanho junto com o cenário (paralaxe). Com a câmera de quando foi preso, ele fica exatamente onde estava.
  cenaDe(P, n) { const id = n.ancora3d?.cena; return id ? Modelo.achar(P, id)?.no : null; },
  cenaNoQuadro(P, q) { const L = Modelo.todos(P).filter(x => x.tipo === 'cena3d'); return L.find(x => x.vis !== false && (x.de || 0) <= q && Modelo.fimNo(P, x) >= q) || null; }, // só o que aparece agora (num trecho 2D não há cenário 3D)
  projeta(P, cena, q, cm, pt) {
    const T = this.T; if (!T) return null; const cam = this._pcam || (this._pcam = new T.PerspectiveCamera());
    cam.fov = Math.max(5, Math.min(120, cm.fov)); cam.aspect = (cena.w || P.w) / (cena.h || P.h); cam.near = .001; cam.far = 1e7;
    cam.position.set(cm.px, cm.py, cm.pz); cam.lookAt(cm.tx, cm.ty, cm.tz); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const v = new T.Vector3(pt.x, pt.y, pt.z), d = -v.clone().applyMatrix4(cam.matrixWorldInverse).z; if (!(d > 1e-4)) return null; v.project(cam);
    const w = cena.w || P.w, h = cena.h || P.h, M = Render.matNo(new DOMMatrix(), Modelo.transf(cena, q)), r = M.transformPoint(new DOMPoint(v.x * w / 2, -v.y * h / 2));
    return { x: r.x, y: r.y, d };
  },
  // matriz que leva o personagem da câmera de quando foi preso para a câmera do quadro q (null = não mexe)
  ajuste(P, n, q) {
    const a = n.ancora3d, cena = a && this.cenaDe(P, n); if (!cena || !this.T || !this.cenas.get(cena.arq) || !Modelo.aparece(P, cena, q)) return null; // trecho sem esse 3D: o personagem fica como está
    const pq = this.projeta(P, cena, q, this.camEm(cena, q), a), pr = this.projeta(P, cena, q, a.cam, a.ini || a); if (!pq || !pr) return null; // pr = onde estavam os pés quando foi preso (a.ini guarda esse ponto quando ele é movido no 3D): assim mover no 3D move também no vídeo
    const k = Math.max(.02, Math.min(50, pr.d / pq.d * (a.s || 1))), M = new DOMMatrix().translate(pq.x, pq.y); if (a.r) M.rotateSelf(a.r); return M.scale(k, k).translate(-pr.x, -pr.y); // r e s: G/R/S da vista 3D (giro no plano e tamanho)
  },
  // prende no chão do 3D: raio da câmera até os pés (meio de baixo da caixa) → primeiro ponto do cenário; sem nada, o plano do chão (y mais baixo)
  prender(n) {
    const P = App.P, q = App.q, cena = this.cenaNoQuadro(P, q), c = cena && this.cenas.get(cena.arq); if (!cena || !c || !this.T) return UI.toast('Ponha um cenário 3D na animação antes.', { kind: 'warn' });
    if (n.ancora3d) { delete n.ancora3d; } // prender de novo: parte da posição de agora, sem o ajuste antigo
    const cx = Render.caixas(P, q).find(x => x.no === n); if (!cx) return UI.toast('Escolha um personagem que aparece neste quadro.', { kind: 'warn' });
    const b = cx.local, pe = cx.m.transformPoint(new DOMPoint(b.x + b.w / 2, b.y + b.h)), l = Render.matNo(new DOMMatrix(), Modelo.transf(cena, q)).inverse().transformPoint(pe);
    const T = this.T, w = cena.w || P.w, h = cena.h || P.h, cm = this.camEm(cena, q), cam = new T.PerspectiveCamera(cm.fov, w / h, .001, 1e7);
    cam.position.set(cm.px, cm.py, cm.pz); cam.lookAt(cm.tx, cm.ty, cm.tz); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(l.x / (w / 2), -l.y / (h / 2)), cam);
    let pt = rc.intersectObject(c.sc, true).find(i => i.object.isMesh && i.object.visible && this.piso(i))?.point; // só onde dá para pisar (face virada para cima)
    if (!pt) { const y0 = new T.Box3().setFromObject(c.sc).min.y, pl = new T.Plane(new T.Vector3(0, 1, 0), -y0), o = new T.Vector3(); pt = rc.ray.intersectPlane(pl, o) ? o : null; }
    if (!pt) return UI.toast('Não achei o chão do cenário nesse ponto. Ponha os pés do personagem em cima do chão e tente de novo.', { kind: 'warn', time: 7000 });
    n.ancora3d = { cena: cena.id, x: round(pt.x, 3), y: round(pt.y, 3), z: round(pt.z, 3), cam: { ...cm } }; App.commit('Prender no cenário 3D');
    UI.toast(`<b>${esc(n.nome)}</b> está preso no cenário 3D: anda e muda de tamanho junto com a câmera.`, { kind: 'ok' });
  },
  // superfície de PISAR: a face que o raio acertou está virada para cima (chão, calçada, gramado); cerca, parede e telhado não contam
  piso(hit) { const T = this.T; if (!hit?.face) return true; const nm = hit.face.normal.clone().transformDirection(hit.object.matrixWorld); return Math.abs(nm.y) > .7; }, // abs: plano de dois lados pode vir com a normal para baixo
  // MEMÓRIA: solta os cenários 3D que a animação aberta não usa (cada um pode ocupar centenas de MB na placa de vídeo)
  limpa(P) { const usa = new Set(this.arqs(P)); for (const [k, c] of [...this.cenas]) { if (usa.has(k)) continue; c.sc.traverse(o => { o.geometry?.dispose?.(); for (const m of [].concat(o.material || [])) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose?.(); } }); this.cenas.delete(k); } this._ult = null; },
  soltar(n) { if (!n.ancora3d) return; delete n.ancora3d; App.commit('Soltar do cenário 3D'); },
  painelAncora(el, n) {
    const P = App.P; if (!Modelo.todos(P).some(x => x.tipo === 'cena3d') || n.cenario || n.tipo === 'cena3d' || n.fundoPadrao || Modelo.ancestrais(P, n.id).some(x => x.cenario)) return; // cenário não se prende em cenário const preso = !!n.ancora3d;
    el.appendChild(Lado.secao('p-anc3d', 'Cenário 3D', preso ? 'preso' : '', c => {
      c.appendChild(h(`<div class="pr-info">${preso ? 'Preso num ponto do chão do cenário 3D: quando a câmera 3D anda, ele anda junto e muda de tamanho.' : 'Solto: fica parado na tela quando a câmera 3D anda. Prenda para ele ficar no lugar dentro do cenário (pés no chão).'}</div>`));
      const a = h(`<div class="pr-acoes"><button class="btn sm ${preso ? '' : 'on'}" data-p>${ic('paisagem', 12)} ${preso ? 'Prender de novo aqui' : 'Prender no cenário 3D'}</button>${preso ? `<button class="btn sm" data-s>${ic('x', 12)} Soltar</button>` : ''}</div>`);
      $('[data-p]', a).onclick = () => this.prender(n); $('[data-s]', a)?.addEventListener('click', () => this.soltar(n)); c.appendChild(a);
    }, true));
  },
  // ---------- CÂMERA 3D COM O MOUSE NO PALCO (cenário 3D escolhido): Alt+arrastar gira, Alt+Shift+arrastar anda, Alt+rodinha aproxima ----------
  ligaMouse() {
    const cv = $('#palco-cv'); if (!cv || this._mouse) return; this._mouse = true;
    const alvoNo = e => { const n = App.noSel?.(); return e.altKey && n?.tipo === 'cena3d' && this.T && this.cenas.get(n.arq) ? n : null; };
    cv.addEventListener('pointerdown', e => {
      const n = alvoNo(e); if (!n) return; e.preventDefault(); e.stopImmediatePropagation(); try { cv.setPointerCapture(e.pointerId); } catch { }
      const q = App.q, c0 = this.camEm(n, q), x0 = e.clientX, y0 = e.clientY, anda = e.shiftKey, T = this.T;
      const P0 = new T.Vector3(c0.px, c0.py, c0.pz), A0 = new T.Vector3(c0.tx, c0.ty, c0.tz), dist = P0.distanceTo(A0);
      const mv = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0;
        if (anda) { const fr = A0.clone().sub(P0).normalize(), dir = new T.Vector3().crossVectors(fr, new T.Vector3(0, 1, 0)).normalize(), cima = new T.Vector3().crossVectors(dir, fr).normalize(), k = dist * .0015;
          const d = dir.multiplyScalar(-dx * k).add(cima.multiplyScalar(dy * k)); this.poeCam(n, q, { px: P0.x + d.x, py: P0.y + d.y, pz: P0.z + d.z, tx: A0.x + d.x, ty: A0.y + d.y, tz: A0.z + d.z }); }
        else { const off = P0.clone().sub(A0), sp = new T.Spherical().setFromVector3(off); sp.theta -= dx * .006; sp.phi = Math.max(.05, Math.min(Math.PI - .05, sp.phi - dy * .006)); off.setFromSpherical(sp);
          this.poeCam(n, q, { px: A0.x + off.x, py: A0.y + off.y, pz: A0.z + off.z }); }
        App.pinta(); };
      const up = () => { cv.removeEventListener('pointermove', mv, true); cv.removeEventListener('pointerup', up, true); App.commit(anda ? 'Andar com a câmera 3D' : 'Girar a câmera 3D', { semArvore: true }); };
      cv.addEventListener('pointermove', mv, true); cv.addEventListener('pointerup', up, true);
    }, true);
    cv.addEventListener('wheel', e => { const n = alvoNo(e); if (!n) return; e.preventDefault(); e.stopImmediatePropagation(); const q = App.q, c = this.camEm(n, q), f = Math.exp(e.deltaY * .0012);
      this.poeCam(n, q, { px: c.tx + (c.px - c.tx) * f, py: c.ty + (c.py - c.ty) * f, pz: c.tz + (c.pz - c.tz) * f }); App.pinta(); clearTimeout(this._rodaT); this._rodaT = setTimeout(() => App.commit('Aproximar a câmera 3D', { semArvore: true }), 400); }, { capture: true, passive: false });
  },
  // ---------- CENÁRIOS 3D DA CASA (cenarios/3d/lista.json no próprio site): prontos para a equipe toda, sem Blender ----------
  // O arquivo fica no site (chave 'cenarios/3d/<arquivo>'): não sobe para a nuvem de cada animação (NuvemAnim pula 'cenarios/') nem passa
  // pela sala do ao vivo; quem abre a animação baixa do site uma vez e guarda no navegador.
  CASA: 'cenarios/3d/',
  async listaCasa() { if (this._lista) return this._lista; try { const r = await fetch(this.CASA + 'lista.json', { cache: 'no-store' }); this._lista = (await r.json()).cenarios || []; } catch { this._lista = []; } return this._lista; },
  ehCasa(k) { return typeof k === 'string' && k.startsWith(this.CASA); },
  // VERSÃO do arquivo da casa (lista.json "v"): o navegador guarda o .glb; quando a versão muda (cenário refeito no Blender), baixa de novo
  async blobCasa(k) { const it = (await this.listaCasa()).find(x => this.CASA + x.arquivo === k), v = String(it?.v || 1), ch = 'c3d-versao:' + k; let tem = '1'; try { tem = localStorage.getItem(ch) || '1'; } catch { }
    let b = tem === v ? await Arq.pegaBlob(k).catch(() => null) : null; if (b) return b;
    const r = await fetch(k, { cache: tem === v ? 'default' : 'reload' }); if (!r.ok) return null; b = await r.blob();
    try { await DB.put('arquivos', b, k); Arq.blob.set(k, b); localStorage.setItem(ch, v); } catch { } this.cenas.delete(k); return b; },
  async daCasa(it) {
    const P = App.P; if (!P) return; const t = UI.toast('<span class="spin-dot"></span> Abrindo o cenário 3D…', { time: 60000 });
    try { const k = this.CASA + it.arquivo; if (!(await this.blobCasa(k))) throw new Error('não achei o arquivo no site');
      const c = this.cenas.get(k) || await this.carrega(k); if (!c) throw new Error('o arquivo não abriu'); this.cenas.set(k, c);
      const n = this.poeNo(P, k, it.nome, c); if (it.cam) n.cam0 = { ...c.cam0, ...it.cam }; App.sel = n.id; App.commit('Cenário 3D'); t.remove();
      UI.toast(this._troca || `Cenário 3D <b>${esc(it.nome)}</b> no fundo. A câmera 3D fica em Propriedades; para o personagem andar junto, use "Prender no cenário 3D".`, { kind: 'ok', time: this._troca ? 9000 : 7000 }); this._troca = '';
    } catch (e) { t.remove(); UI.toast('Não abri o cenário 3D: ' + esc(e.message || String(e)), { kind: 'err' }); }
  },
  async menuCasa(x, y) { const L = await this.listaCasa(); if (!L.length) return UI.toast('Ainda não há cenários 3D da casa.', { kind: 'warn' });
    UI.ctx(x, y, [{ head: 'Cenários 3D da casa' }, ...L.map(it => ({ label: it.nome, icon: 'paisagem', action: () => this.daCasa(it) }))]); },
  // a camada nova (vale para o .glb solto e para os da casa)
  poeNo(P, id, nome, c) {
    const q = App.q, cam = Modelo.camera(P, q), z = cam.zoom || 1;
    const n = Modelo.novoNo('forma', { nome: ('Cenário 3D · ' + nome).slice(0, 48) }); n.tipo = 'cena3d'; delete n.forma; n.arq = id; n.w = P.w; n.h = P.h; n.cam0 = c.cam0; n.ceu = '#c9d3df';
    n.de = q; n.chaves = { [q]: { x: Math.round(cam.x), y: Math.round(cam.y), r: 0, s: round(1 / z * 1.01, 3), sx: 1, op: 1 } }; n.cenario = true;
    const i = P.raiz.findIndex(x => x.cenario || x.fundoPadrao); if (i >= 0) P.raiz.splice(i, 0, n); else P.raiz.push(n); this._troca = typeof CenLib !== 'undefined' && CenLib.trocaAqui ? CenLib.trocaAqui(P, n, q) : ''; return n;
  },
  // ---------- .blend SOLTO → a PONTE DO BLENDER (neste computador) converte em .glb e o cenário entra no fundo ----------
  // A ponte (Documentos/Problems/cenarios-problems/LIGAR-PONTE.bat, http://127.0.0.1:8810, versão 2+) recebe o .blend, escolhe o conversor
  // (ruas grandes: cor calculada; cenários pequenos: cor assada em imagem) e devolve o .glb. Sem a ponte ligada: explica como ligar.
  PONTE: 'http://127.0.0.1:8810',
  async pontePronta() { try { const r = await fetch(this.PONTE + '/estado', { cache: 'no-store' }); if (!r.ok) return null; const j = await r.json(); return j.versao >= 2 ? j : { velha: true }; } catch { return null; } },
  async converterNaPonte(f) {
    const est = typeof Ajudante !== 'undefined' ? await Ajudante.garante('converter o cenário .blend') : await this.pontePronta(); if (!est) return; // AJUDANTE DO BLENDER (js/ajudante.js): liga sozinho ou ensina a instalar
    const nome = f.name.replace(/\.blend\d?$/i, '');
    const fim = typeof NuvemTela !== 'undefined' && !NuvemTela.el ? (NuvemTela.inicio(nome, 'an', { titulo: 'Convertendo o cenário no Blender', vidro: true, indef: true }), true) : false;
    const passo = t => { try { NuvemTela.passo?.(.5, t); } catch { } };
    try {
      passo('Mandando o .blend para o Blender…');
      const r = await fetch(this.PONTE + '/converter?nome=' + encodeURIComponent(nome), { method: 'POST', body: f, headers: { 'Content-Type': 'application/octet-stream' } }); const j = await r.json();
      if (!r.ok || !j.id) throw new Error(j.erro || 'a ponte não aceitou o arquivo');
      let p = {}; const t0 = Date.now();
      while (Date.now() - t0 < 20 * 60 * 1000) { await new Promise(ok => setTimeout(ok, 1500)); p = await fetch(this.PONTE + '/trabalho/' + j.id, { cache: 'no-store' }).then(x => x.json()).catch(() => ({}));
        if (p.estado === 'pronto' || p.estado === 'erro') break;
        passo(p.estado === 'fila' ? 'Esperando o Blender terminar outro pedido…' : `Convertendo no Blender${p.modo === 'assar' ? ' (assando as cores, ~1 min)' : ''}… ${Math.round((Date.now() - t0) / 1000)} s`); }
      if (p.estado !== 'pronto') throw new Error(p.erro || 'demorou demais');
      passo('Trazendo o cenário…'); const b = await fetch(`${this.PONTE}/arquivo/${j.id}/saida.glb`).then(x => { if (!x.ok) throw new Error('o .glb não voltou'); return x.blob(); });
      if (fim) { NuvemTela.fim(true); }
      await this.importar(new File([b], nome + '.glb', { type: 'model/gltf-binary' }));
    } catch (e) { if (fim) NuvemTela.fim(false); UI.toast('Não converti o .blend: ' + esc(e.message || String(e)), { kind: 'err', time: 9000 }); }
  },
  liga() {
    if (this._ok || typeof App === 'undefined') return; this._ok = true;
    try { TIPO_IC.cena3d = 'paisagem'; } catch { }
    // os arquivos da animação (nuvem, .animador, tamanho) também levam o .glb
    if (typeof Toon !== 'undefined') { const ti = Toon.ids; Toon.ids = function (P) { return [...new Set([...ti.call(this, P), ...Cena3D.arqs(P)])]; }; }
    this.ligaMouse(); setTimeout(() => this.ligaMouse(), 2000);
    // abrir: já carrega o 3D; exportar: espera o 3D antes do primeiro quadro (o MP4 igual à prévia)
    const ab = App.abrir; App.abrir = async function (...x) { const r = await ab.apply(this, x); try { Cena3D.limpa(App.P); } catch (e) { console.warn(e); } if (Cena3D.arqs(App.P).length) await Cena3D.garante(App.P).catch(e => console.warn(e)); return r; };
    if (typeof Exportar !== 'undefined') for (const f of ['mp4', 'png', 'quadros']) if (typeof Exportar[f] === 'function') { const o = Exportar[f]; Exportar[f] = async function (...x) { await Cena3D.garante(App.P).catch(() => { }); return o.apply(this, x); }; }
    if (typeof AoVivo !== 'undefined' && AoVivo.naNuvem) { const nn = AoVivo.naNuvem; AoVivo.naNuvem = function (k) { return Cena3D.ehCasa(k) || nn.call(this, k); }; }
    // Propriedades: a seção da câmera 3D
    if (typeof Lado !== 'undefined') { const pp = Lado.props; Lado.props = function (el, ...x) { const r = pp.call(this, el, ...x); try { const n = App.noSel?.(); if (n?.tipo === 'cena3d') Cena3D.painel(el, n); else if (n && ['personagem', 'imagem', 'pasta'].includes(n.tipo)) Cena3D.painelAncora(el, n); } catch (e) { console.warn('[cena 3D painel]', e); } return r; }; }
    // menu "Pôr um cenário": item novo
    const mc = App.menuCenario; App.menuCenario = function (x, y) { const ctx0 = UI.ctx; UI.ctx = (a, b, itens) => { UI.ctx = ctx0; return ctx0(a, b, [...itens, '-', { label: 'Cenários 3D da casa…', icon: 'paisagem', action: () => Cena3D.menuCasa(a + 8, b + 8) }, { label: 'Cenário 3D do Blender (.blend ou .glb)…', icon: 'paisagem', action: () => Cena3D.escolher() }]); }; try { return mc.call(this, x, y); } finally { UI.ctx = ctx0; } };
    // soltar .glb / .gltf / .blend no Animador
    document.addEventListener('drop', e => { const f = [...(e.dataTransfer?.files || [])].find(x => /\.(glb|gltf|blend\d?)$/i.test(x.name)); if (!f) return; if ($('#editor')?.classList.contains('hidden')) return; e.preventDefault(); e.stopPropagation(); this.importar(f); }, true);
  },
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Cena3D.liga()); else Cena3D.liga();
