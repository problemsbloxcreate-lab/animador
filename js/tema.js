/* ===================== tema.js — tema (cinza, estilo Toon Boom) e cor de destaque =====================
   Carregado no <head> para aplicar antes de desenhar a tela. Vale para o editor e para o estúdio de ossos.
   Escolha fica salva neste computador (localStorage 'ep-tema'). Para o Estúdio Problems, é o mesmo módulo. */
'use strict';
const Tema = {
  TEMAS: {
    cinza: { nome: 'Cinza (Toon Boom)', v: { bg0: '#262626', bg1: '#303030', bg2: '#393939', bg3: '#434343', bg4: '#4f4f4f', bd: '#1f1f1f', bd2: '#565656', tx: '#e7e7e7', tx2: '#b5b5b5', tx3: '#8b8b8b' }, an: { bg: '#3c3c3c', p: '#2f2f2f', p2: '#393939', line: '#1f1f1f' }, stage: '#4a4a4a' },
    claro: { nome: 'Cinza claro', v: { bg0: '#3a3a3a', bg1: '#464646', bg2: '#505050', bg3: '#5a5a5a', bg4: '#666666', bd: '#2e2e2e', bd2: '#6e6e6e', tx: '#f2f2f2', tx2: '#cdcdcd', tx3: '#a2a2a2' }, an: { bg: '#555555', p: '#454545', p2: '#505050', line: '#2e2e2e' }, stage: '#606060' },
    escuro: { nome: 'Escuro', v: null, an: null, stage: null },
  },
  CORES: [['Azul', '#3d8bff'], ['Roxo', '#8b6cff'], ['Verde-água', '#14b8a6'], ['Laranja', '#ff8a2a'], ['Rosa', '#ff4f9a'], ['Verde', '#3fbf5f'], ['Amarelo', '#e6b422'], ['Vermelho', '#ef4b4b']],
  cfg: { tema: 'cinza', cor: '#3d8bff' },
  load() { try { Object.assign(this.cfg, JSON.parse(localStorage.getItem('ep-tema') || '{}')); } catch { } },
  save() { try { localStorage.setItem('ep-tema', JSON.stringify(this.cfg)); } catch { } },
  mix(hex, k) { // escurece (k<0) ou clareia (k>0)
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, n >> 8 & 255, n & 255].map(v => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  },
  rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, n >> 8 & 255, n & 255].join(','); },
  apply() {
    const T = this.TEMAS[this.cfg.tema] || this.TEMAS.cinza, cor = /^#[0-9a-f]{6}$/i.test(this.cfg.cor) ? this.cfg.cor : '#3d8bff';
    let css = `:root{--ac:${cor};--ac2:${this.mix(cor, -.15)};--acs:rgba(${this.rgb(cor)},.16);--ac-rgb:${this.rgb(cor)}}`;
    if (T.v) css += `:root{${Object.entries(T.v).map(([k, v]) => `--${k}:${v}`).join(';')}}
      .an-root{--an-bg:${T.an.bg};--an-p:${T.an.p};--an-p2:${T.an.p2};--an-line:${T.an.line}}
      .an-root .an-stage,.pv-stage{background:${T.stage}}`;
    let st = document.getElementById('tema-css'); if (!st) { st = document.createElement('style'); st.id = 'tema-css'; (document.head || document.documentElement).appendChild(st); }
    st.textContent = css; document.documentElement.dataset.tema = this.cfg.tema;
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = T.v ? T.v.bg1 : '#17181c';
  },
  set(o) { Object.assign(this.cfg, o); this.save(); this.apply(); try { (typeof Studio !== 'undefined' && Studio.P) && Studio.render(); (typeof App !== 'undefined' && App.project) && App.render?.(); } catch { } },
  // janela "Tema e cores" (menu principal, editor e estúdio)
  open() {
    const sw = (k, c) => `<button class="tm-c${this.cfg.cor.toLowerCase() === c ? ' on' : ''}" data-c="${c}" title="${k}" style="background:${c}"></button>`;
    const body = `<div class="tm">
      <div class="tm-l">Tema</div><div class="tm-t">${Object.entries(this.TEMAS).map(([k, t]) => `<button class="tm-b${this.cfg.tema === k ? ' on' : ''}" data-t="${k}"><i style="background:${t.v ? t.v.bg1 : '#17181c'};border-color:${t.v ? t.v.bd2 : '#3a3e47'}"><s style="background:${t.v ? t.an.bg : '#121317'}"></s></i>${t.nome}</button>`).join('')}</div>
      <div class="tm-l">Cor de destaque</div><div class="tm-cs">${this.CORES.map(([k, c]) => sw(k, c)).join('')}<label class="tm-cu" title="Outra cor"><input type="color" value="${this.cfg.cor}"></label></div></div>`;
    return UI.modal({ title: 'Tema e cores', icon: 'palette', width: 420, body, buttons: [{ label: 'Pronto', kind: 'primary', value: true }], onOpen: a => {
      const re = () => { a.body.querySelectorAll('.tm-b').forEach(b => b.classList.toggle('on', b.dataset.t === this.cfg.tema)); a.body.querySelectorAll('.tm-c').forEach(b => b.classList.toggle('on', b.dataset.c === this.cfg.cor.toLowerCase())); };
      a.body.querySelectorAll('.tm-b').forEach(b => b.onclick = () => { this.set({ tema: b.dataset.t }); re(); });
      a.body.querySelectorAll('.tm-c').forEach(b => b.onclick = () => { this.set({ cor: b.dataset.c }); re(); });
      a.body.querySelector('input[type=color]').oninput = e => { this.set({ cor: e.target.value.toLowerCase() }); re(); };
    } });
  },
};
Tema.load(); Tema.apply();
