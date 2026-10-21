/* ===================== auth.js — entrada pelo login do Google do menu do Estúdio Problems =====================
   O login é feito no MENU; aqui só se usa a sessão de lá e o servidor confirma a conta antes de abrir. */
'use strict';
// o Animador mora no endereço único do Estúdio Problems; quem abrir a cópia do GitHub Pages vai para lá
if (location.hostname === 'problemsbloxcreate-lab.github.io') location.replace('https://estudio.problemsraiz.workers.dev/animador/' + location.pathname.replace(/^\/animador\/?/, '') + location.search + location.hash);
document.documentElement.classList.add('turma-locked');
(() => {
  const st = document.createElement('style');
  st.textContent = `html.turma-locked body>*:not(#turma-login){display:none!important}
#turma-login{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:radial-gradient(1100px 700px at 50% 35%,#1d2030,#111216 70%);font:14px/1.5 'Segoe UI',system-ui,-apple-system,sans-serif;color:#e9ebef;padding:16px;-webkit-user-select:none;user-select:none}
#turma-login .ep-c{width:min(380px,100%);text-align:center;display:grid;justify-items:center;gap:4px}
#turma-login .ep-lg{width:68px;height:68px;border-radius:20px;display:grid;place-items:center;background:linear-gradient(135deg,#3d8bff,#19d3f0);box-shadow:0 14px 40px rgba(61,139,255,.35);margin-bottom:12px;animation:epPulso 1.6s ease-in-out infinite}
#turma-login .ep-nm{font:800 26px/1.05 'Segoe UI',system-ui,sans-serif;letter-spacing:1.5px}
#turma-login .ep-sb{color:#9aa0ab;font-size:12.5px;letter-spacing:.4px}
#turma-login .ep-br{width:180px;height:4px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;margin:18px 0 8px;position:relative}
#turma-login .ep-br::after{content:'';position:absolute;top:0;bottom:0;left:0;width:40%;border-radius:4px;background:linear-gradient(90deg,#3d8bff,#19d3f0);animation:epBarra 1.1s ease-in-out infinite}
#turma-login.ep-erro .ep-br{display:none}#turma-login.ep-erro .ep-lg{animation:none;background:linear-gradient(135deg,#ff6b6b,#ff9a62)}
#turma-login .ep-m{color:#b9bdc6;font-size:13px;min-height:20px;max-width:340px}#turma-login .ep-m .e,#turma-login .ep-m.err{color:#ff8a9a}
#turma-login [hidden]{display:none!important}#turma-login a.ep-bt{display:inline-flex;margin-top:12px;padding:9px 18px;border-radius:10px;background:#3d8bff;color:#fff;text-decoration:none;font-weight:600}#turma-login a.ep-bt:hover{filter:brightness(1.08)}
@keyframes epBarra{0%{transform:translateX(-100%)}100%{transform:translateX(260%)}}@keyframes epPulso{50%{transform:scale(1.05)}}
@media (prefers-reduced-motion:reduce){#turma-login .ep-lg,#turma-login .ep-br::after{animation:none}}
#turma-login .tl-out{margin-top:10px;background:none;border:0;color:#7fb0ff;font-size:12px;cursor:pointer;text-decoration:underline}`;
  document.head.appendChild(st);
})();

const TurmaAuth = {
  SDK: 'https://www.gstatic.com/firebasejs/10.14.1/',
  fb: null, email: null, passed: false, _gate: null,
  async loadSdk() {
    if (window.firebase?.auth) return;
    for (const f of ['firebase-app-compat.js', 'firebase-auth-compat.js']) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = this.SDK + f; s.onload = ok; s.onerror = () => no(new Error('Não consegui carregar o login do Google. Verifique a internet e recarregue.')); document.head.appendChild(s); });
  },
  async init() {
    await this.loadSdk();
    const cfg = (typeof TURMA_CONFIG !== 'undefined' && TURMA_CONFIG.firebase) || null;
    if (!cfg || !cfg.apiKey) throw new Error('Falta a configuração do Firebase em js/config.js.');
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    this.fb = firebase.auth();
    await this.fb.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    try { await this.fb.getRedirectResult(); } catch { }
    return new Promise(r => { const u = this.fb.onAuthStateChanged(x => { u(); r(x); }); });
  },
  async token(force) { const u = this.fb?.currentUser; return u ? u.getIdToken(!!force) : null; },
  // o servidor confirma se a conta pode entrar
  async check() {
    const srv = typeof TURMA_CONFIG !== 'undefined' && TURMA_CONFIG.iaServidor;
    if (!srv) throw new Error('Falta o endereço do servidor do Estúdio Problems em js/config.js.');
    let r; try { r = await fetch(srv + '/quem', { headers: { authorization: 'Bearer ' + await this.token(true) }, cache: 'no-store' }); } catch { throw new Error('Não consegui falar com o servidor do Estúdio Problems. Verifique a internet e tente de novo.'); }
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.email) return j.email;
    const e = new Error(j.error?.message || 'Esta conta não tem acesso ao Estúdio Problems.'); e.denied = r.status === 401 || r.status === 403; throw e;
  },
  // o login é no MENU: manda para lá e, depois de entrar, o menu traz a pessoa de volta para cá (?volta=)
  menuUrl(volta) {
    const base = (typeof TURMA_CONFIG !== 'undefined' && TURMA_CONFIG.menuUrl) || '../';
    const u = new URL(base, location.href); if (volta !== false) u.searchParams.set('volta', location.href); return u.href;
  },
  irParaMenu(volta) { location.href = this.menuUrl(volta); },
  async signOut() { try { await fetch('/sair', { method: 'POST', credentials: 'same-origin' }); } catch { } try { await this.fb?.signOut(); } catch { } this.irParaMenu(false); }, // /sair: apaga a sessão do porteiro (se houver)
  ui() {
    let el = document.getElementById('turma-login');
    if (!el) {
      el = document.createElement('div'); el.id = 'turma-login';
      el.innerHTML = `<div class="ep-c"><div class="ep-lg"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="6" width="13" height="12" rx="2.5" fill="#fff" fill-opacity=".18"/><path d="m15.5 10.2 5-3v9.6l-5-3z" fill="#fff"/></svg></div><div class="ep-nm">ANIMADOR</div><div class="ep-sb">Estúdio Problems</div><div class="ep-br"></div>
        <div class="ep-m" data-msg></div><a class="ep-bt" data-menu hidden>Ir para o menu</a></div>`;
      document.body.appendChild(el);
    }
    return el;
  },
  msg(t, err, spin) { const el = this.ui(), m = el.querySelector('[data-msg]'); el.classList.toggle('ep-erro', !!err); m.className = 'ep-m' + (err ? ' err' : ''); m.innerHTML = t; },
  status(t) { this.msg(t, false, true); },
  // sessão do Google (feita no menu) — usado pela IA e pela mídia da equipe; se caiu, volta para o menu
  async loginOnly() {
    try { if (!this.fb) await this.init(); } catch { }
    if (this.fb?.currentUser) { this.email = this.fb.currentUser.email || null; return this.email; }
    UI.toast('Sua sessão do Google acabou. Entre de novo pelo menu do Estúdio Problems.', { kind: 'err' });
    setTimeout(() => this.irParaMenu(), 1600); return null;
  },
  get logged() { return !!this.fb?.currentUser; },
  // nome e foto da "Minha conta" do menu (porteiro: /conta); se não tiver nada mudado lá, os do Google
  perfil() {
    return this._perfil || (this._perfil = (async () => {
      const u = this.fb?.currentUser, base = { email: this.email, nome: u?.displayName || String(this.email || '').split('@')[0], foto: u?.photoURL || null };
      try { const r = await fetch('/conta', { credentials: 'same-origin', cache: 'no-store' }); if (r.ok && r.headers.get('x-porteiro')) return { ...base, ...(await r.json()) }; } catch { }
      return base;
    })());
  },
  // tela de entrada: só resolve quando há sessão do Google E a conta está liberada pelo servidor
  _esc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
  gate() {
    if (this.passed) return Promise.resolve(this.email);
    if (this._gate) return this._gate;
    return (this._gate = new Promise(async resolve => {
      const el = this.ui(), toMenu = el.querySelector('[data-menu]');
      toMenu.href = this.menuUrl();
      const fail = (t, voltar) => { this.msg(this._esc(t), true); toMenu.hidden = false; if (voltar === false) toMenu.href = this.menuUrl(false); };
      try {
        this.status('Carregando…');
        const u = await this.init();
        if (!u) { this.status('Abrindo o menu para entrar com o Google…'); return this.irParaMenu(); }
        this.status('Conferindo seu acesso…');
        this.email = await this.check(); this.passed = true;
        el.remove(); document.documentElement.classList.remove('turma-locked'); resolve(this.email);
      } catch (e) {
        if (e.denied) { try { await this.fb?.signOut(); } catch { } return fail(e.message + ' Entre com outra conta pelo menu.', false); }
        fail(e.message || String(e));
      }
    }));
  },
};
