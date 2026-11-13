/* ===================== vista3d.js — VISTA 3D DO PALCO (2.5, 13/11/2026, pedidos da dona) =====================
   Botão "3D" na barra do palco (ao lado de Palco/Câmera): o cenário 3D inteiro, de qualquer ângulo, como a tela do Blender.
   - Aparece: o cenário, uma GRADE no chão, a CÂMERA DO VÍDEO (pirâmide + bolinha) no quadro de agora, os personagens PRESOS como placas
     em pé (o próprio desenho daquele quadro), o CUBO DE EIXOS no canto (clique num eixo = vista daquele lado) e uma JANELINHA com o
     quadro do vídeo como ele sai (clique nela = volta para a vista Câmera).
   - VISTA (não muda o vídeo): arrastar no vazio gira; Shift+arrastar ou botão direito anda; rodinha aproxima; F enquadra o escolhido;
     0 olha pela câmera do vídeo; Esc solta o escolhido / volta ao palco. Botão "?" = o guia.
   - CENA: clique num personagem ou na bolinha da câmera = escolhe e aparecem as SETAS (gizmo de mover, como no Blender). Arrastar uma seta
     move só naquele eixo; arrastar o próprio personagem leva ele pelo chão. Personagem fica sempre com os pés no chão (n.ancora3d); a câmera
     anda com o alvo junto e grava a chave da câmera 3D no quadro de agora. Ctrl+Z desfaz.
   - MEMÓRIA: os objetos da vista são criados uma vez e reaproveitados (nada novo a cada quadro); uma geometria de placa só para todos;
     cada placa tem a sua textura, trocada só quando o desenho muda e liberada ao sair da vista ou quando o personagem deixa de estar preso.
   - 2.6 (pedido da dona): ATALHOS E MOVIMENTO DO BLENDER. Botão do meio gira, Shift+meio anda, Ctrl+meio aproxima; teclado numérico
     1/3/7 (Ctrl = lado oposto), 2/4/6/8 giram de 15°, 5 perspectiva/orto, 0 câmera, ponto = enquadra o escolhido, +/− aproximam.
     G move, R gira, S muda o tamanho (X/Y/Z trava o eixo, duas vezes = local; número = valor exato; Enter/clique confirma, Esc/botão
     direito cancela); Alt+G/R/S zera; Shift+D duplica; X/Delete apaga (Ctrl+Z desfaz); H esconde só na vista, Alt+H mostra tudo.
     Personagem continua 2D: R gira no plano dele e S muda o tamanho (n.ancora3d.r e .s, usados em Cena3D.ajuste). Na câmera, R vira para os
     lados e para cima/baixo e S muda a lente (zoom). As ações que já existiam continuam: arrastar com o botão esquerdo gira a vista,
     botão direito anda, F enquadra, 0 e Home olham pela câmera, Esc solta/fecha. Projetos LEGACY ficam com os atalhos de antes. */
'use strict';
const Vista3D = {
  ativo: false, el: null, cv: null, rend: null, cam: null, alvo: null, sp: null, aj: null, placas: new Map(), sel: null, _raf: 0,
  liga() {
    if (this._ok || typeof App === 'undefined' || typeof Cena3D === 'undefined') return;
    const grupo = document.querySelector('.palco-cab [data-vista]')?.parentElement; if (!grupo) return; this._ok = true;
    const b = h(`<button class="btn sm ghost" id="b-v3d" title="Vista 3D: o cenário inteiro, a câmera do vídeo e os personagens presos (botão ? = guia)">3D</button>`);
    b.onclick = () => this.ativo ? this.fechar() : this.abrir(); grupo.appendChild(b);
    $$('.palco-cab [data-vista]').forEach(x => x.addEventListener('click', () => this.fechar()));
    const pt = App.pinta; App.pinta = function (...x) { const r = pt.apply(this, x); if (Vista3D.ativo) Vista3D.pede(); return r; };
    // economia: com a vista 3D aberta, o palco 2D (escondido por baixo) não é desenhado; a janelinha mostra o quadro do vídeo
    const dp = App.desenhaPalco; if (dp) App.desenhaPalco = function (...x) { if (Vista3D.ativo) return; return dp.apply(this, x); };
    addEventListener('keydown', e => this.tecla(e), true);
    // a linha do tempo (TLP, também em captura e registrada antes) pegava R, S, Enter etc.: com a vista 3D aberta ela só fica com
    // espaço (tocar), setas (quadro a quadro) e Ctrl+algo
    if (typeof TLP !== 'undefined' && TLP.tecla) { const tt = TLP.tecla; TLP.tecla = function (e) { if (Vista3D.ativo && (Vista3D.modo || !(e.key === ' ' || e.key?.startsWith('Arrow') || e.ctrlKey || e.metaKey))) return; return tt.call(this, e); }; }
  },
  cena() { const P = App.P; return P ? Cena3D.cenaNoQuadro(P, App.q) : null; },
  async abrir() {
    const P = App.P, cena = this.cena(); if (!cena) return UI.toast(P && Modelo.todos(P).some(x => x.tipo === 'cena3d') ? 'Neste quadro o cenário é 2D. Vá para um trecho com cenário 3D (veja a barra dele na linha do tempo) e abra a vista 3D de novo.' : 'A vista 3D aparece quando a animação tem um cenário 3D (janela Cenários › Cenários 3D).', { kind: 'warn', time: 6000 });
    await Cena3D.garante(P); const T = Cena3D.T, c = Cena3D.cenas.get(cena.arq); if (!T || !c) return UI.toast('O cenário 3D ainda está carregando. Tente de novo em instantes.', { kind: 'warn' });
    if (!this.el) await this.monta(T);
    this.vistaDaCamera(1.6, .35); this.grade(c);
    this.ativo = true; this.el.hidden = false; $('#b-v3d')?.classList.add('on'); $('#palco').classList.add('com-v3d'); this.pede();
  },
  async monta(T) {
    this.el = h(`<div class="v3d"><canvas class="v3d-cv"></canvas>
      <button class="v3d-pip" title="Como sai no vídeo (câmera do quadro de agora). Clique para voltar à vista Câmera"><canvas></canvas><span>Câmera</span></button>
      <button class="ibtn v3d-ajuda-bt" title="Atalhos da vista 3D (como no Blender)">?</button><div class="v3d-modo" hidden></div>
      <div class="v3d-ajuda" hidden><b>Vista 3D · atalhos (como no Blender)</b>
        <div class="v3d-at"><i>Vista</i>
          <p><kbd>Botão do meio</kbd> ou <kbd>arrastar</kbd> girar</p><p><kbd>Shift + meio</kbd> ou <kbd>botão direito</kbd> andar</p><p><kbd>Rodinha</kbd> ou <kbd>Ctrl + meio</kbd> aproximar</p>
          <p><kbd>Num 1</kbd> frente · <kbd>Num 3</kbd> lado · <kbd>Num 7</kbd> de cima (<kbd>Ctrl</kbd> = oposto)</p><p><kbd>Num 2 4 6 8</kbd> girar 15° · <kbd>Num 5</kbd> perspectiva/orto · <kbd>Num + −</kbd> zoom</p>
          <p><kbd>0</kbd> <kbd>Num 0</kbd> <kbd>Home</kbd> olhar pela câmera · <kbd>F</kbd> <kbd>Num .</kbd> enquadrar o escolhido</p><p><kbd>Cubo de eixos</kbd> clique num eixo para ver daquele lado</p>
          <i>Objeto (clique num personagem ou na bolinha vermelha da câmera)</i>
          <p><kbd>G</kbd> mover · <kbd>R</kbd> girar · <kbd>S</kbd> tamanho</p><p>Depois: <kbd>X</kbd> <kbd>Y</kbd> <kbd>Z</kbd> trava o eixo (duas vezes = local) · digite um número para o valor exato</p>
          <p><kbd>Enter</kbd> ou <kbd>clique</kbd> confirma · <kbd>Esc</kbd> ou <kbd>botão direito</kbd> cancela</p><p><kbd>Alt + G R S</kbd> zerar · <kbd>Shift + D</kbd> duplicar · <kbd>X</kbd> <kbd>Delete</kbd> apagar</p>
          <p><kbd>H</kbd> esconder na vista · <kbd>Alt + H</kbd> mostrar tudo · <kbd>Esc</kbd> soltar / voltar ao palco · <kbd>Ctrl + Z</kbd> desfaz</p>
          <p class="v3d-obs">Personagem continua 2D: <b>R</b> gira no plano dele e <b>S</b> muda o tamanho dele (no vídeo também). Na câmera, <b>R</b> vira e <b>S</b> muda a lente. Eixos com os nomes do Blender (Z para cima). Arrastar uma seta move só naquele eixo.</p></div></div></div>`);
    $('#palco').appendChild(this.el); this.barra = $('.v3d-modo', this.el); this.cv = $('.v3d-cv', this.el); this.pip = $('.v3d-pip canvas', this.el);
    $('.v3d-pip', this.el).onclick = () => { this.fechar(); App.setVista('camera'); };
    $('.v3d-ajuda-bt', this.el).onclick = () => { const a = $('.v3d-ajuda', this.el); a.hidden = !a.hidden; };
    this.rend = new T.WebGLRenderer({ canvas: this.cv, antialias: true }); this.rend.outputColorSpace = T.SRGBColorSpace; this.rend.toneMapping = T.AgXToneMapping; this.rend.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.cam = new T.PerspectiveCamera(50, 1, .01, 1e6); this.camO = new T.OrthographicCamera(-1, 1, 1, -1, -1e5, 1e5); this.ocultos = new Set(); this.alvo = new T.Vector3(); this.sp = new T.Spherical(10, 1, 0);
    // objetos da vista, criados UMA vez
    this.aj = new T.Scene(); this.vcam = new T.PerspectiveCamera(40, 16 / 9, .1, 2);
    this.camHelper = new T.CameraHelper(this.vcam); this.camHelper.setColors?.(new T.Color('#ff453a'), new T.Color('#ff453a'), new T.Color('#5cc4ff'), new T.Color('#ffffff'), new T.Color('#5cc4ff')); this.aj.add(this.camHelper);
    this.bola = new T.Mesh(new T.SphereGeometry(1, 20, 14), new T.MeshBasicMaterial({ color: 0xff453a, toneMapped: false })); this.bola.userData.cam = true; this.aj.add(this.bola);
    this.geoPlaca = new T.PlaneGeometry(1, 1).translate(0, .5, 0); // origem nos pés
    const [{ TransformControls }, { ViewHelper }] = await Promise.all([import(Cena3D.BASE + 'TransformControls.js'), import(Cena3D.BASE + 'ViewHelper.js')]);
    this.tc = new TransformControls(this.cam, this.cv); this.tc.setSize(.9); this.aj.add(this.tc.getHelper());
    this.tc.addEventListener('change', () => this.pede());
    this.tc.addEventListener('objectChange', () => this.moveuGizmo());
    this.tc.addEventListener('dragging-changed', e => { if (!e.value && this._mexeu) { this._mexeu = false; App.commit(this.sel?.cam ? 'Mover a câmera 3D' : 'Mudar o lugar no cenário 3D'); } });
    this.vh = new ViewHelper(this.cam, this.cv); this.ligaMouse(); new ResizeObserver(() => this.pede()).observe(this.el);
  },
  // grade no chão (y mais baixo), do tamanho do cenário
  grade(c) {
    const T = Cena3D.T; if (this._grade) { this.aj.remove(this._grade); this._grade.geometry.dispose(); this._grade.material.dispose(); }
    const b = new T.Box3().setFromObject(c.sc), tam = Math.min(400, Math.max(10, Math.ceil(Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 10) * 10));
    this._grade = new T.GridHelper(tam, tam / (tam > 100 ? 10 : 1), 0x5cc4ff, 0x444450); this._grade.material.transparent = true; this._grade.material.opacity = .35; this._grade.material.depthWrite = false;
    this._grade.position.set((b.min.x + b.max.x) / 2, (b.min.y || 0) + .002, (b.min.z + b.max.z) / 2); this.aj.add(this._grade);
  },
  vistaDaCamera(afasta = 1, sobe = 0) { const T = Cena3D.T, cena = this.cena(), cm = Cena3D.camEm(cena, App.q); this.alvo.set(cm.tx, cm.ty, cm.tz); this.sp.setFromVector3(new T.Vector3(cm.px, cm.py, cm.pz).sub(this.alvo)); this.sp.radius *= afasta; this.sp.phi = Math.max(.15, this.sp.phi - sobe); },
  fechar() {
    if (!this.ativo) return; if (this.modo) this.fimModo(false); this.ativo = false; if (this.el) this.el.hidden = true; this.tc?.detach(); this.sel = null;
    for (const id of [...this.placas.keys()]) this.tiraPlaca(id); // libera texturas e materiais ao sair
    $('#b-v3d')?.classList.remove('on'); $('#palco')?.classList.remove('com-v3d'); App.pinta();
  },
  tiraPlaca(id) { const m = this.placas.get(id); if (!m) return; if (this.tc?.object === m) { this.tc.detach(); this.sel = null; } this.aj.remove(m); m.material.map?.dispose(); m.material.dispose(); this.placas.delete(id); },
  pede() { if (!this._raf) this._raf = requestAnimationFrame(t => { this._raf = 0; try { this.desenha(t); } catch (e) { console.warn('[vista 3D]', e); } }); },
  // placa do personagem preso: textura com o desenho do quadro (só refeita quando muda) e tamanho no mundo pela distância
  placa(P, n, q, cena) {
    const T = Cena3D.T, cx = Render.caixas(P, q).find(x => x.no === n); if (!cx?.cantos?.length) return null;
    const xs = cx.cantos.map(p => p.x), ys = cx.cantos.map(p => p.y), x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(1, Math.max(...xs) - x0), hh = Math.max(1, Math.max(...ys) - y0);
    let m = this.placas.get(n.id); const chave = `${q}|${Math.round(w)}x${Math.round(hh)}|${P.modificado || 0}`;
    if (!m) { m = new T.Mesh(this.geoPlaca, new T.MeshBasicMaterial({ transparent: true, alphaTest: .05, side: T.DoubleSide, toneMapped: false })); this.placas.set(n.id, m); this.aj.add(m); }
    m.userData.no = n;
    if (m.userData.ch !== chave) {
      const k = Math.min(1, 512 / Math.max(w, hh)), cv = m.material.map?.image?.tagName === 'CANVAS' ? m.material.map.image : document.createElement('canvas');
      cv.width = Math.ceil(w * k); cv.height = Math.ceil(hh * k); const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height); const base = new DOMMatrix().scale(k, k).translate(-x0, -y0);
      try { Render.umNo(ctx, P, q, base, n, new DOMMatrix(), 1, base, 0); } catch (e) { console.warn(e); }
      if (!m.material.map || m.material.map.image !== cv) { m.material.map?.dispose(); m.material.map = new T.CanvasTexture(cv); m.material.map.colorSpace = T.SRGBColorSpace; m.material.needsUpdate = true; } else m.material.map.needsUpdate = true;
      m.userData.ch = chave;
    }
    const pr = Cena3D.projeta(P, cena, q, Cena3D.camEm(cena, q), n.ancora3d); if (!pr) { m.visible = false; return m; }
    const Mc = Render.matNo(new DOMMatrix(), Modelo.transf(cena, q)), sc = Math.hypot(Mc.a, Mc.b) || 1, cm = Cena3D.camEm(cena, q);
    const alt = (hh / ((cena.h || P.h) * sc)) * 2 * pr.d * Math.tan(cm.fov * Math.PI / 360); m.scale.set(alt * w / hh, alt, 1); m.visible = true; // giro (R) e tamanho (S) já vêm no desenho do quadro (Cena3D.ajuste entra no Render)
    if (!(this.tc?.dragging && this.tc.object === m)) m.position.set(n.ancora3d.x, n.ancora3d.y, n.ancora3d.z);
    return m;
  },
  desenha(t) {
    if (!this.ativo) return; const P = App.P, q = App.q, cena = this.cena(), T = Cena3D.T, c = cena && Cena3D.cenas.get(cena.arq); if (!cena) { this.fechar(); return UI.toast('Este trecho tem cenário 2D: a vista 3D fechou. Ela volta nos trechos com cenário 3D.', { time: 5000 }); } if (!c) return;
    const W = Math.max(50, this.el.clientWidth), H = Math.max(50, this.el.clientHeight); this.rend.setSize(W, H, false); this.cam.aspect = W / H;
    if (this.vh.animating) { const dt = this._t ? Math.min(.05, (t - this._t) / 1000) : .016; this._t = t; this.vh.update(dt); this.sp.setFromVector3(this.cam.position.clone().sub(this.alvo)); if (this.vh.animating) this.pede(); else this._t = 0; }
    else { this.cam.position.copy(this.alvo).add(new T.Vector3().setFromSpherical(this.sp)); this.cam.lookAt(this.alvo); }
    this.cam.near = Math.max(.005, this.sp.radius / 2000); this.cam.updateProjectionMatrix(); this.cam.updateMatrixWorld(); this.vh.center.copy(this.alvo);
    if (this.orto) { const hh = this.sp.radius * Math.tan(this.cam.fov * Math.PI / 360), o = this.camO; o.top = hh; o.bottom = -hh; o.left = -hh * this.cam.aspect; o.right = hh * this.cam.aspect; o.position.copy(this.cam.position); o.quaternion.copy(this.cam.quaternion); o.updateProjectionMatrix(); o.updateMatrixWorld(); }
    c.sc.background = new T.Color(cena.ceu || '#c9d3df');
    // câmera do vídeo (objetos reaproveitados)
    const cm = Cena3D.camEm(cena, q);
    this.vcam.fov = cm.fov; this.vcam.aspect = (cena.w || P.w) / (cena.h || P.h); this.vcam.near = .001; this.vcam.far = this.tamCam(); /* desenho da câmera pequeno, como no Blender (antes ia até o alvo e ficava enorme) */ this.vcam.position.set(cm.px, cm.py, cm.pz); this.vcam.lookAt(cm.tx, cm.ty, cm.tz); this.vcam.updateProjectionMatrix(); this.vcam.updateMatrixWorld(true); this.camHelper.update();
    if (!(this.tc.dragging && this.tc.object === this.bola)) this.bola.position.copy(this.vcam.position);
    this.bola.scale.setScalar(this.tamCam() * .09);
    // personagens presos: cria/atualiza/remove placas (sem criar objetos novos a cada quadro)
    const vivos = new Set();
    for (const n of Modelo.todos(P)) if (n.ancora3d && Cena3D.cenaDe(P, n) === cena && Render.vivo?.(P, n, q) !== false) { const m = this.placa(P, n, q, cena); if (m) { vivos.add(n.id); m.lookAt(this.cam.position.x, m.position.y, this.cam.position.z); if (this.ocultos.has(n.id)) m.visible = false; } }
    for (const id of [...this.placas.keys()]) if (!vivos.has(id)) this.tiraPlaca(id);
    this.bola.visible = this.camHelper.visible = !this.ocultos.has('cam'); this._pegaveis = [this.bola, ...this.placas.values()].filter(o => o.visible);
    this.rend.autoClear = false; this.rend.setViewport(0, 0, W, H); this.rend.clear(); this.rend.render(c.sc, this.ativa()); this.rend.clearDepth(); this.rend.render(this.aj, this.ativa()); this.vh.render(this.rend);
    this.desenhaPip(P, q);
  },
  // tamanho do desenho da câmera do vídeo na vista: ~0,6 m como a câmera do Blender, um pouco maior de longe para não sumir (máx. 2,5 m)
  tamCam() { return Math.min(2.5, Math.max(.35, this.sp.radius * .05)); },
  // janelinha: o quadro do vídeo como sai (personagens e efeitos), pequena
  desenhaPip(P, q) {
    const w = 288, h = Math.round(w * P.h / P.w); if (this.pip.width !== w * 2) { this.pip.width = w * 2; this.pip.height = h * 2; this.pip.style.width = w + 'px'; this.pip.style.height = h + 'px'; }
    const ctx = this.pip.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.pip.width, this.pip.height); try { Render.quadro(ctx, P, q, this.pip.width, this.pip.height); } catch (e) { console.warn(e); }
  },
  // o gizmo mexeu: personagem com os pés no chão; câmera anda com o alvo junto
  moveuGizmo() {
    const s = this.sel, cena = this.cena(); if (!s || !cena) return; this._mexeu = true; if (s.no && !s.no.ancora3d.ini) s.no.ancora3d.ini = { x: s.no.ancora3d.x, y: s.no.ancora3d.y, z: s.no.ancora3d.z };
    if (s.no) { const m = this.placas.get(s.no.id); if (!m) return; const p = this.chaoEm(m.position.x, m.position.z, m.position.y) || m.position;
      s.no.ancora3d = { ...s.no.ancora3d, x: round(p.x, 3), y: round(p.y, 3), z: round(p.z, 3) }; m.position.set(p.x, p.y, p.z); }
    else if (s.cam) { const q = App.q, cm = Cena3D.camEm(cena, q), b = this.bola.position, d = { x: b.x - cm.px, y: b.y - cm.py, z: b.z - cm.pz };
      Cena3D.poeCam(cena, q, { px: b.x, py: b.y, pz: b.z, tx: cm.tx + d.x, ty: cm.ty + d.y, tz: cm.tz + d.z }); }
    App.pinta();
  },
  // chão logo abaixo (ou acima) de x,z: raio vertical, só superfície de pisar, a mais perto da altura de agora (calçada × telhado)
  chaoEm(x, z, yRef = 0) {
    const T = Cena3D.T, cena = this.cena(), c = Cena3D.cenas.get(cena.arq), rc = new T.Raycaster(new T.Vector3(x, yRef + 50, z), new T.Vector3(0, -1, 0));
    const hits = rc.intersectObject(c.sc, true).filter(i => i.object.isMesh && i.object.visible && Cena3D.piso(i)); if (!hits.length) return null;
    return hits.reduce((a, b) => Math.abs(b.point.y - yRef) < Math.abs(a.point.y - yRef) ? b : a).point;
  },
  escolhe(o) {
    if (!o) { this.tc.detach(); this.sel = null; this.pede(); return; }
    if (o.userData.cam) { this.sel = { cam: true }; this.tc.attach(this.bola); this.tc.showX = this.tc.showY = this.tc.showZ = true; }
    else { this.sel = { no: o.userData.no }; this.tc.attach(o); this.tc.showX = this.tc.showZ = true; this.tc.showY = false; App.sel = o.userData.no.id; try { Lado.pinta(); Arvore.pinta(); } catch { } }
    this.pede();
  },
  enquadra() { const o = this.sel?.cam ? this.bola : this.sel?.no && this.placas.get(this.sel.no.id); if (!o) { this.vistaDaCamera(1.6, .35); return this.pede(); }
    const T = Cena3D.T, b = new T.Box3().setFromObject(o), c = b.getCenter(new T.Vector3()); this.alvo.copy(c); this.sp.radius = Math.max(1.5, b.getSize(new T.Vector3()).length() * 2.5); this.pede(); },
  // ================= ATALHOS E MOVIMENTO DO BLENDER (2.6, 13/11/2026, pedido da dona) =================
  // Eixos com os nomes do Blender (Z para cima): X = x do three, Y = −z do three (para o fundo), Z = y do three. XX = eixo local.
  // Projetos LEGACY ficam com os atalhos de antes (só F, 0, Home, Esc e ?).
  legado() { const P = App.P; return !!P && (!!P.legacyDe || (typeof Legacy !== 'undefined' && !!Legacy.antiga?.(P))); },
  EIXO: { x: [1, 0, 0], y: [0, 0, -1], z: [0, 1, 0] },
  eixoVec(m) { const T = Cena3D.T, v = new T.Vector3(...(m.local ? { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] } : this.EIXO)[m.eixo]);
    if (m.local) v.applyQuaternion(m.alvo === 'cam' ? this.vcam.quaternion : (this.placas.get(m.no.id)?.quaternion || new T.Quaternion())); return v.normalize(); },
  ativa() { return this.orto ? this.camO : this.cam; }, // câmera da VISTA (perspectiva ou ortográfica, tecla 5)
  // ponto da tela (px do cliente) → raio
  raioEm(x, y) { const T = Cena3D.T, r = this.cv.getBoundingClientRect(), rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.ativa()); return rc; },
  naTela(p) { const v = p.clone().project(this.ativa()), r = this.cv.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
  // ---------- G / R / S: começa ----------
  comeca(tipo) {
    const s = this.sel; if (!s) return UI.toast('Escolha antes um personagem ou a câmera (clique nele).', { time: 3000 });
    const cena = this.cena(), q = App.q, cm = Cena3D.camEm(cena, q), T = Cena3D.T;
    const m = { tipo, alvo: s.cam ? 'cam' : 'no', no: s.no, eixo: null, local: false, num: '', m0: { ...(this._mouse || this.meio()) } };
    if (s.cam) { m.orig = JSON.stringify(cena.chaves || {}); m.cm = { ...cm }; m.pos0 = new T.Vector3(cm.px, cm.py, cm.pz); }
    else { const a = s.no.ancora3d; m.orig = JSON.stringify(a); m.a = { ...a }; m.pos0 = new T.Vector3(a.x, a.y, a.z); }
    this.modo = m; this.tc.enabled = false; this.tc.getHelper().visible = false; this.pinta3(); this.aplica();
    const mv = e => { this._mouse = { x: e.clientX, y: e.clientY }; if (this.modo) this.aplica(); }; this._mvModo = mv; addEventListener('pointermove', mv, true);
  },
  meio() { const r = this.cv.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; },
  // ---------- aplica o modo (a cada movimento do mouse ou número digitado) ----------
  aplica() {
    const m = this.modo; if (!m) return; const T = Cena3D.T, cena = this.cena(), q = App.q, mo = this._mouse || m.m0, num = m.num !== '' && m.num !== '-' ? parseFloat(m.num) : null;
    const plano = (normal, p) => new T.Plane().setFromNormalAndCoplanarPoint(normal, p);
    const corta = (pl, pt) => this.raioEm(pt.x, pt.y).ray.intersectPlane(pl, new T.Vector3());
    const vista = new T.Vector3(); this.ativa().getWorldDirection(vista);
    if (m.tipo === 'g') {
      let d = new T.Vector3();
      if (num != null) d = (m.eixo ? this.eixoVec(m) : new T.Vector3(1, 0, 0)).multiplyScalar(num);
      else if (m.eixo) { const a = this.eixoVec(m), n = new T.Vector3().crossVectors(a, new T.Vector3().crossVectors(vista, a)).normalize(); if (n.lengthSq() < 1e-6) return; const pl = plano(n, m.pos0), p = corta(pl, mo), p0 = corta(pl, m.m0); if (p && p0) d = a.multiplyScalar(p.sub(p0).dot(a)); }
      else { const pl = m.alvo === 'no' ? plano(new T.Vector3(0, 1, 0), m.pos0) : plano(vista.clone().negate(), m.pos0), p = corta(pl, mo), p0 = corta(pl, m.m0); if (p && p0) d = p.sub(p0); }
      const np = m.pos0.clone().add(d); if (m.alvo === 'no' && !m.a.ini) m.a.ini = { x: m.a.x, y: m.a.y, z: m.a.z };
      if (m.alvo === 'no') { if (m.eixo !== 'z' || m.local) { const ch = this.chaoEm(np.x, np.z, np.y); if (ch) np.y = ch.y; } m.no.ancora3d = { ...m.a, x: round(np.x, 3), y: round(np.y, 3), z: round(np.z, 3) }; }
      else Cena3D.poeCam(cena, q, { px: np.x, py: np.y, pz: np.z, tx: m.cm.tx + d.x, ty: m.cm.ty + d.y, tz: m.cm.tz + d.z });
      m.info = num != null || m.eixo ? `${round(d.length() * Math.sign(num ?? 1), 3)} m` : `${round(d.x, 2)}, ${round(-d.z, 2)}, ${round(d.y, 2)} m`;
    } else if (m.tipo === 'r') {
      const c = this.naTela(m.pos0); let ang = num != null ? num : (Math.atan2(mo.y - c.y, mo.x - c.x) - Math.atan2(m.m0.y - c.y, m.m0.x - c.x)) * 180 / Math.PI; ang = ((ang + 540) % 360) - 180;
      if (m.alvo === 'no') { m.no.ancora3d = { ...m.a, r: round(((m.a.r || 0) + ang + 540) % 360 - 180, 2) }; m.info = `${round(ang, 1)}° (no plano do personagem)`; }
      else { // câmera: vira para os lados (Z) e para cima/baixo (X); sem eixo, segue o mouse nos dois
        const dir = new T.Vector3(m.cm.tx - m.cm.px, m.cm.ty - m.cm.py, m.cm.tz - m.cm.pz), up = new T.Vector3(0, 1, 0);
        let yaw = 0, pit = 0; if (num != null) { if (m.eixo === 'x') pit = ang; else yaw = ang; } else { yaw = -(mo.x - m.m0.x) * .3; pit = -(mo.y - m.m0.y) * .3; if (m.eixo === 'x') yaw = 0; if (m.eixo === 'z' || m.eixo === 'y') pit = 0; }
        dir.applyAxisAngle(up, yaw * Math.PI / 180); const dir2 = dir.clone().applyAxisAngle(new T.Vector3().crossVectors(dir, up).normalize(), pit * Math.PI / 180);
        const ok = dir2.clone().normalize().dot(up); const fim = Math.abs(ok) < .985 ? dir2 : dir;
        Cena3D.poeCam(cena, q, { tx: m.cm.px + fim.x, ty: m.cm.py + fim.y, tz: m.cm.pz + fim.z }); m.info = `lados ${round(yaw, 1)}° · cima ${round(pit, 1)}°`; }
    } else if (m.tipo === 's') {
      const c = this.naTela(m.pos0), k = num != null ? num : Math.hypot(mo.x - c.x, mo.y - c.y) / Math.max(1, Math.hypot(m.m0.x - c.x, m.m0.y - c.y)), f = Math.max(.05, k);
      if (m.alvo === 'no') { m.no.ancora3d = { ...m.a, s: round(clamp((m.a.s || 1) * f, .05, 20), 4) }; m.info = `× ${round(f, 3)}`; }
      else { const fov = clamp(m.cm.fov / f, 5, 120); Cena3D.poeCam(cena, q, { fov }); m.info = `lente ${round(fov, 1)}° (S na câmera muda o zoom)`; }
    }
    this.pinta3(); App.pinta();
  },
  fimModo(ok) {
    const m = this.modo; if (!m) return; this.modo = null; removeEventListener('pointermove', this._mvModo, true); this.tc.enabled = true; this.tc.getHelper().visible = true;
    if (ok) App.commit({ g: 'Mover', r: 'Girar', s: 'Tamanho' }[m.tipo] + (m.alvo === 'cam' ? ' a câmera 3D' : ' no cenário 3D'));
    else { if (m.alvo === 'cam') this.cena().chaves = JSON.parse(m.orig); else m.no.ancora3d = JSON.parse(m.orig); App.pinta(); }
    this.pinta3();
  },
  // faixa de baixo: o que está acontecendo (como o cabeçalho do Blender durante o G/R/S)
  pinta3() { const b = this.barra; if (!b) return; const m = this.modo; b.hidden = !m; if (!m) return;
    const nome = { g: 'Mover', r: 'Girar', s: 'Tamanho' }[m.tipo], eixo = m.eixo ? ` · eixo ${m.eixo.toUpperCase()}${m.local ? ' (local)' : ''}` : '';
    b.innerHTML = `<b>${nome}</b>${eixo} · ${esc(m.num !== '' ? m.num : m.info || '')} <span>X Y Z trava o eixo · número = valor exato · Enter ou clique confirma · Esc ou botão direito cancela</span>`; },
  // ---------- teclas do modo G/R/S ----------
  teclaModo(e) {
    const m = this.modo, k = e.key.toLowerCase();
    if (k === 'escape') this.fimModo(false);
    else if (k === 'enter') this.fimModo(true);
    else if ('xyz'.includes(k) && k.length === 1) { if (m.eixo === k && !m.local) m.local = true; else if (m.eixo === k) { m.eixo = null; m.local = false; } else { m.eixo = k; m.local = false; } this.aplica(); }
    else if (/^[0-9.]$/.test(e.key)) { m.num += e.key; this.aplica(); }
    else if (k === '-') { m.num = m.num.startsWith('-') ? m.num.slice(1) : '-' + m.num; this.aplica(); }
    else if (k === 'backspace') { m.num = m.num.slice(0, -1); this.aplica(); }
    else if (k === 'g' || k === 'r' || k === 's') { const s = { ...m }; this.fimModo(false); this.comeca(k); if (this.modo) { this.modo.m0 = s.m0; this.aplica(); } }
    e.preventDefault(); e.stopPropagation();
  },
  // ---------- vistas do teclado numérico (como no Blender) ----------
  vistaNum(code, ctrl) {
    const S = this.sp, PI = Math.PI;
    const v = { Numpad1: [ctrl ? PI : 0, PI / 2], Numpad3: [ctrl ? -PI / 2 : PI / 2, PI / 2], Numpad7: [0, ctrl ? PI - .001 : .001] }[code];
    if (v) { S.theta = v[0]; S.phi = v[1]; return true; }
    if (code === 'Numpad4' || code === 'Numpad6') { S.theta += (code === 'Numpad4' ? -1 : 1) * PI / 12; return true; }
    if (code === 'Numpad8' || code === 'Numpad2') { S.phi = clamp(S.phi + (code === 'Numpad8' ? -1 : 1) * PI / 12, .001, PI - .001); return true; }
    if (code === 'NumpadAdd' || code === 'NumpadSubtract') { S.radius = clamp(S.radius * (code === 'NumpadAdd' ? .8 : 1.25), .1, 5000); return true; }
    if (code === 'Numpad5') { this.orto = !this.orto; this.tc.camera = this.ativa(); UI.toast(this.orto ? 'Vista ortográfica (sem perspectiva)' : 'Vista em perspectiva', { time: 1500 }); return true; }
    if (code === 'Numpad0') { this.vistaDaCamera(1, 0); return true; }
    if (code === 'NumpadDecimal') { this.enquadra(); return true; }
    return false;
  },
  // ---------- Alt+G / Alt+R / Alt+S: zera ----------
  zera(k) {
    const s = this.sel, cena = this.cena(), q = App.q; if (!s) return;
    if (s.cam) { const c0 = cena.cam0 || Cena3D.camEm(cena, 0), cm = Cena3D.camEm(cena, q);
      if (k === 'g') { const d = [c0.px - cm.px, c0.py - cm.py, c0.pz - cm.pz]; Cena3D.poeCam(cena, q, { px: c0.px, py: c0.py, pz: c0.pz, tx: cm.tx + d[0], ty: cm.ty + d[1], tz: cm.tz + d[2] }); }
      if (k === 'r') Cena3D.poeCam(cena, q, { tx: cm.px + (c0.tx - c0.px), ty: cm.py + (c0.ty - c0.py), tz: cm.pz + (c0.tz - c0.pz) });
      if (k === 's') Cena3D.poeCam(cena, q, { fov: c0.fov }); }
    else { const a = s.no.ancora3d; if (k === 'g') { if (!a.ini) return UI.toast('Este personagem ainda está no lugar em que foi preso.', { time: 2500 }); s.no.ancora3d = { ...a, ...a.ini }; }
      if (k === 'r') { const { r, ...b } = a; s.no.ancora3d = b; } if (k === 's') { const { s: _s, ...b } = a; s.no.ancora3d = b; } }
    App.commit({ g: 'Zerar o lugar', r: 'Zerar o giro', s: 'Zerar o tamanho' }[k]);
  },
  tecla(e) {
    if (!this.ativo || /input|textarea|select/i.test(e.target?.tagName || '') || e.metaKey) return;
    if (this.modo) return this.teclaModo(e);
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey, alt = e.altKey, leg = this.legado(); let feito = true;
    if (!ctrl && !alt && k === 'escape') { if (this.sel) this.escolhe(null); else this.fechar(); }
    else if (!ctrl && !alt && k === 'f') this.enquadra();
    else if (!ctrl && !alt && (e.code === 'Digit0' || k === 'home')) { this.vistaDaCamera(1, 0); }
    else if (!ctrl && !alt && k === '?') { const a = $('.v3d-ajuda', this.el); a.hidden = !a.hidden; }
    else if (leg) feito = false;
    else if (!alt && e.code.startsWith('Numpad') && this.vistaNum(e.code, ctrl)) { }
    else if (ctrl) feito = false; // Ctrl+Z, Ctrl+S etc. continuam com o Animador
    else if (alt && 'grs'.includes(k) && k.length === 1) this.zera(k);
    else if (alt && k === 'h') { this.ocultos.clear(); }
    else if (alt) feito = false;
    else if (e.shiftKey && k === 'd') this.duplica();
    else if ('grs'.includes(k) && k.length === 1) this.comeca(k);
    else if (k === 'x' || k === 'delete') this.apaga();
    else if (k === 'h') { const s = this.sel; if (!s) feito = false; else { this.ocultos.add(s.cam ? 'cam' : s.no.id); this.escolhe(null); } }
    else feito = false;
    if (feito) { e.preventDefault(); e.stopPropagation(); this.pede(); }
  },
  duplica() {
    const s = this.sel; if (!s?.no) return UI.toast(s?.cam ? 'A câmera do vídeo é uma só: não dá para duplicar.' : 'Escolha um personagem para duplicar.', { time: 3000 });
    App.sel = s.no.id; App.duplicar(); const novo = Modelo.achar(App.P, App.sel)?.no; if (!novo?.ancora3d) return;
    this.desenha(performance.now()); const m = this.placas.get(novo.id); if (m) { this.escolhe(m); this.comeca('g'); } // como no Blender: já sai movendo
  },
  apaga() {
    const s = this.sel; if (!s) return;
    if (s.cam) { const cena = this.cena(); if (Cena3D.tiraCam(cena, App.q)) { App.commit('Apagar a chave da câmera 3D'); UI.toast('Chave da câmera 3D deste quadro apagada. Ctrl+Z desfaz.', { time: 3000 }); } else UI.toast('A câmera não tem chave neste quadro (ela não se apaga).', { time: 3000 }); return; }
    const n = s.no; this.escolhe(null); App.sel = n.id; App.apagarSel(); UI.toast(`<b>${esc(n.nome)}</b> saiu da animação. Ctrl+Z desfaz.`, { time: 3500 });
  },
  ligaMouse() {
    const cv = this.cv, T = () => Cena3D.T; cv.addEventListener('contextmenu', e => e.preventDefault()); cv.addEventListener('auxclick', e => e.preventDefault()); cv.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); }); // botão do meio sem a rolagem do navegador
    const raio = e => this.raioEm(e.clientX, e.clientY);
    cv.addEventListener('pointermove', e => { this._mouse = { x: e.clientX, y: e.clientY }; });
    const chao = (e, ignorar) => { const cena = this.cena(), c = cena && Cena3D.cenas.get(cena.arq); if (!c) return null; const hit = raio(e).intersectObject(c.sc, true).find(i => i.object.isMesh && i.object.visible && i.object !== ignorar && Cena3D.piso(i)); return hit?.point || null; };
    cv.addEventListener('pointerdown', e => {
      if (this.modo) { e.preventDefault(); e.stopPropagation(); if (e.button === 0) this.fimModo(true); else if (e.button === 2) this.fimModo(false); return; } // G/R/S: clique confirma, direito cancela
      if (this.tc.dragging || this.tc.axis) return; // as setas do gizmo cuidam
      if (this.vh.handleClick(e)) { this._t = 0; this.pede(); return; } // cubo de eixos
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { }
      const x0 = e.clientX, y0 = e.clientY, sp0 = this.sp.clone(), a0 = this.alvo.clone();
      const pego = e.button === 0 && !e.shiftKey ? raio(e).intersectObjects(this._pegaveis || [], false)[0]?.object : null; let andou = false;
      const mv = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (Math.abs(dx) + Math.abs(dy) > 3) andou = true; if (!andou) return;
        if (pego?.userData.no) { const p = chao(ev, pego); if (p) { const n = pego.userData.no; if (!n.ancora3d.ini) n.ancora3d.ini = { x: n.ancora3d.x, y: n.ancora3d.y, z: n.ancora3d.z }; n.ancora3d = { ...n.ancora3d, x: round(p.x, 3), y: round(p.y, 3), z: round(p.z, 3) }; this._mexeu = true; App.pinta(); } return; }
        if (pego?.userData.cam) { const cena = this.cena(), q = App.q, cm = Cena3D.camEm(cena, q), p = raio(ev).ray.intersectPlane(new (T().Plane)(new (T().Vector3)(0, 1, 0), -cm.py), new (T().Vector3)()); if (!p) return;
          Cena3D.poeCam(cena, q, { px: p.x, pz: p.z, tx: cm.tx + p.x - cm.px, tz: cm.tz + p.z - cm.pz }); this._mexeu = true; App.pinta(); return; }
        if (e.button === 1 && e.ctrlKey) { this.sp.radius = Math.max(.1, Math.min(5000, sp0.radius * Math.exp(dy * .01))); }
        else if (e.button === 2 || e.shiftKey) { const fr = new (T().Vector3)().setFromSpherical(sp0).normalize().negate(), dir = new (T().Vector3)().crossVectors(fr, new (T().Vector3)(0, 1, 0)).normalize(), cima = new (T().Vector3)().crossVectors(dir, fr).normalize(), k = sp0.radius * .0018;
          this.alvo.copy(a0).add(dir.multiplyScalar(-dx * k)).add(cima.multiplyScalar(dy * k)); }
        else { this.sp.theta = sp0.theta - dx * .006; this.sp.phi = Math.max(.05, Math.min(Math.PI - .05, sp0.phi - dy * .006)); }
        this.pede(); };
      const up = () => { cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up);
        if (!andou && e.button === 0) this.escolhe(pego || null); // clique: escolhe (ou solta) e mostra as setas
        if (this._mexeu) { this._mexeu = false; App.commit(pego?.userData.cam ? 'Mover a câmera 3D' : 'Mudar o lugar no cenário 3D'); } };
      cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up);
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); this.sp.radius = Math.max(.1, Math.min(5000, this.sp.radius * Math.exp(e.deltaY * .0012))); this.pede(); }, { passive: false });
  },
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Vista3D.liga()); else Vista3D.liga();
