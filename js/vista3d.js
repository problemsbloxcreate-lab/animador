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
     cada placa tem a sua textura, trocada só quando o desenho muda e liberada ao sair da vista ou quando o personagem deixa de estar preso. */
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
      <button class="ibtn v3d-ajuda-bt" title="Guia da vista 3D">?</button>
      <div class="v3d-ajuda" hidden><b>Vista 3D</b>
        <p><kbd>Arrastar</kbd> girar a vista</p><p><kbd>Shift + arrastar</kbd> ou <kbd>botão direito</kbd> andar com a vista</p><p><kbd>Rodinha</kbd> aproximar e afastar</p>
        <p><kbd>Clique</kbd> num personagem ou na bolinha vermelha (câmera do vídeo): escolher e mostrar as setas</p>
        <p><kbd>Arrastar uma seta</kbd> mover só naquele eixo · <kbd>arrastar o personagem</kbd> levar pelo chão</p>
        <p><kbd>F</kbd> enquadrar o escolhido · <kbd>0</kbd> olhar pela câmera do vídeo · <kbd>Esc</kbd> soltar / voltar ao palco</p>
        <p><kbd>Cubo de eixos</kbd> (canto de baixo): clique em X, Y ou Z para ver daquele lado</p>
        <p>Só os personagens <b>presos no cenário 3D</b> aparecem aqui (Propriedades › Prender no cenário 3D). A vista não muda o vídeo; mover a câmera grava a chave no quadro de agora. <kbd>Ctrl+Z</kbd> desfaz.</p></div></div>`);
    $('#palco').appendChild(this.el); this.cv = $('.v3d-cv', this.el); this.pip = $('.v3d-pip canvas', this.el);
    $('.v3d-pip', this.el).onclick = () => { this.fechar(); App.setVista('camera'); };
    $('.v3d-ajuda-bt', this.el).onclick = () => { const a = $('.v3d-ajuda', this.el); a.hidden = !a.hidden; };
    this.rend = new T.WebGLRenderer({ canvas: this.cv, antialias: true }); this.rend.outputColorSpace = T.SRGBColorSpace; this.rend.toneMapping = T.AgXToneMapping; this.rend.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    this.cam = new T.PerspectiveCamera(50, 1, .01, 1e6); this.alvo = new T.Vector3(); this.sp = new T.Spherical(10, 1, 0);
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
    if (!this.ativo) return; this.ativo = false; if (this.el) this.el.hidden = true; this.tc?.detach(); this.sel = null;
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
    const alt = (hh / ((cena.h || P.h) * sc)) * 2 * pr.d * Math.tan(cm.fov * Math.PI / 360); m.scale.set(alt * w / hh, alt, 1); m.visible = true;
    if (!(this.tc?.dragging && this.tc.object === m)) m.position.set(n.ancora3d.x, n.ancora3d.y, n.ancora3d.z);
    return m;
  },
  desenha(t) {
    if (!this.ativo) return; const P = App.P, q = App.q, cena = this.cena(), T = Cena3D.T, c = cena && Cena3D.cenas.get(cena.arq); if (!cena) { this.fechar(); return UI.toast('Este trecho tem cenário 2D: a vista 3D fechou. Ela volta nos trechos com cenário 3D.', { time: 5000 }); } if (!c) return;
    const W = Math.max(50, this.el.clientWidth), H = Math.max(50, this.el.clientHeight); this.rend.setSize(W, H, false); this.cam.aspect = W / H;
    if (this.vh.animating) { const dt = this._t ? Math.min(.05, (t - this._t) / 1000) : .016; this._t = t; this.vh.update(dt); this.sp.setFromVector3(this.cam.position.clone().sub(this.alvo)); if (this.vh.animating) this.pede(); else this._t = 0; }
    else { this.cam.position.copy(this.alvo).add(new T.Vector3().setFromSpherical(this.sp)); this.cam.lookAt(this.alvo); }
    this.cam.near = Math.max(.005, this.sp.radius / 2000); this.cam.updateProjectionMatrix(); this.vh.center.copy(this.alvo);
    c.sc.background = new T.Color(cena.ceu || '#c9d3df');
    // câmera do vídeo (objetos reaproveitados)
    const cm = Cena3D.camEm(cena, q), dist = Math.max(1, Math.hypot(cm.px - cm.tx, cm.py - cm.ty, cm.pz - cm.tz));
    this.vcam.fov = cm.fov; this.vcam.aspect = (cena.w || P.w) / (cena.h || P.h); this.vcam.near = dist * .02; this.vcam.far = dist; this.vcam.position.set(cm.px, cm.py, cm.pz); this.vcam.lookAt(cm.tx, cm.ty, cm.tz); this.vcam.updateProjectionMatrix(); this.vcam.updateMatrixWorld(true); this.camHelper.update();
    if (!(this.tc.dragging && this.tc.object === this.bola)) this.bola.position.copy(this.vcam.position);
    this.bola.scale.setScalar(Math.max(.05, this.sp.radius * .012));
    // personagens presos: cria/atualiza/remove placas (sem criar objetos novos a cada quadro)
    const vivos = new Set();
    for (const n of Modelo.todos(P)) if (n.ancora3d && Cena3D.cenaDe(P, n) === cena && Render.vivo?.(P, n, q) !== false) { const m = this.placa(P, n, q, cena); if (m) { vivos.add(n.id); m.lookAt(this.cam.position.x, m.position.y, this.cam.position.z); } }
    for (const id of [...this.placas.keys()]) if (!vivos.has(id)) this.tiraPlaca(id);
    this._pegaveis = [this.bola, ...this.placas.values()];
    this.rend.autoClear = false; this.rend.setViewport(0, 0, W, H); this.rend.clear(); this.rend.render(c.sc, this.cam); this.rend.clearDepth(); this.rend.render(this.aj, this.cam); this.vh.render(this.rend);
    this.desenhaPip(P, q);
  },
  // janelinha: o quadro do vídeo como sai (personagens e efeitos), pequena
  desenhaPip(P, q) {
    const w = 288, h = Math.round(w * P.h / P.w); if (this.pip.width !== w * 2) { this.pip.width = w * 2; this.pip.height = h * 2; this.pip.style.width = w + 'px'; this.pip.style.height = h + 'px'; }
    const ctx = this.pip.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.pip.width, this.pip.height); try { Render.quadro(ctx, P, q, this.pip.width, this.pip.height); } catch (e) { console.warn(e); }
  },
  // o gizmo mexeu: personagem com os pés no chão; câmera anda com o alvo junto
  moveuGizmo() {
    const s = this.sel, cena = this.cena(); if (!s || !cena) return; this._mexeu = true;
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
  tecla(e) {
    if (!this.ativo || /input|textarea|select/i.test(e.target?.tagName || '') || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase(); let feito = true;
    if (k === 'escape') { if (this.sel) this.escolhe(null); else this.fechar(); }
    else if (k === 'f') this.enquadra();
    else if (k === '0' || k === 'home') { this.vistaDaCamera(1, 0); this.pede(); }
    else if (k === '?') { const a = $('.v3d-ajuda', this.el); a.hidden = !a.hidden; }
    else feito = false;
    if (feito) { e.preventDefault(); e.stopPropagation(); }
  },
  ligaMouse() {
    const cv = this.cv, T = () => Cena3D.T; cv.addEventListener('contextmenu', e => e.preventDefault());
    const raio = e => { const r = cv.getBoundingClientRect(), v = new (T().Vector2)(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), rc = new (T().Raycaster)(); rc.setFromCamera(v, this.cam); return rc; };
    const chao = (e, ignorar) => { const cena = this.cena(), c = cena && Cena3D.cenas.get(cena.arq); if (!c) return null; const hit = raio(e).intersectObject(c.sc, true).find(i => i.object.isMesh && i.object.visible && i.object !== ignorar && Cena3D.piso(i)); return hit?.point || null; };
    cv.addEventListener('pointerdown', e => {
      if (this.tc.dragging || this.tc.axis) return; // as setas do gizmo cuidam
      if (this.vh.handleClick(e)) { this._t = 0; this.pede(); return; } // cubo de eixos
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { }
      const x0 = e.clientX, y0 = e.clientY, sp0 = this.sp.clone(), a0 = this.alvo.clone();
      const pego = e.button === 0 && !e.shiftKey ? raio(e).intersectObjects(this._pegaveis || [], false)[0]?.object : null; let andou = false;
      const mv = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (Math.abs(dx) + Math.abs(dy) > 3) andou = true; if (!andou) return;
        if (pego?.userData.no) { const p = chao(ev, pego); if (p) { const n = pego.userData.no; n.ancora3d = { ...n.ancora3d, x: round(p.x, 3), y: round(p.y, 3), z: round(p.z, 3) }; this._mexeu = true; App.pinta(); } return; }
        if (pego?.userData.cam) { const cena = this.cena(), q = App.q, cm = Cena3D.camEm(cena, q), p = raio(ev).ray.intersectPlane(new (T().Plane)(new (T().Vector3)(0, 1, 0), -cm.py), new (T().Vector3)()); if (!p) return;
          Cena3D.poeCam(cena, q, { px: p.x, pz: p.z, tx: cm.tx + p.x - cm.px, tz: cm.tz + p.z - cm.pz }); this._mexeu = true; App.pinta(); return; }
        if (e.button === 2 || e.shiftKey) { const fr = new (T().Vector3)().setFromSpherical(sp0).normalize().negate(), dir = new (T().Vector3)().crossVectors(fr, new (T().Vector3)(0, 1, 0)).normalize(), cima = new (T().Vector3)().crossVectors(dir, fr).normalize(), k = sp0.radius * .0018;
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
