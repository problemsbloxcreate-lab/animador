/* ===================== versao.js — VERSÃO NOVA do site: trava e pede para atualizar =====================
   versao.json (gravado pela Action "Versão do site" a cada mudança publicada) diz o código da versão. Ao abrir, guarda o
   de agora; de 2 em 2 minutos (e ao voltar para a aba) confere de novo. Mudou = uma tela por cima de tudo trava as mudanças
   (quem continuasse mexendo numa versão velha podia estragar o arquivo de quem está na nova, no ao vivo e na nuvem) e o
   tela "Atualizando" (só ao vivo ou num personagem da nuvem: `precisa()`; fora disso espera) guarda o que falta, baixa os arquivos novos (sem o cache do navegador) e recarrega. */
'use strict';
const Versao = {
  atual: null, travado: false,
  async le() { try { const r = await fetch('versao.json?_=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return null; return (await r.json())?.v || null; } catch { return null; } },
  async liga() {
    if (this._ok) return; this._ok = true; this.atual = await this.le();
    setInterval(() => this.confere(), 120000); setInterval(() => { if (this.nova && !this.travado && this.precisa()) this.trava(this.nova); }, 3000);
    addEventListener('focus', () => this.confere()); document.addEventListener('visibilitychange', () => { if (!document.hidden) this.confere(); });
  },
  async confere() {
    if (this.travado || Date.now() - (this._ult || 0) < 20000) return; this._ult = Date.now();
    const v = await this.le(); if (!v) return; if (!this.atual) { this.atual = v; return; }
    if (v !== this.atual) { this.nova = v; if (this.precisa()) this.trava(v); }
  },
  // a trava só aparece quando a versão importa para os outros: trabalhando junto AO VIVO ou mexendo num personagem que está NA NUVEM.
  // Fora disso (projeto local, tela inicial) a versão nova fica esperando e trava quando entrar num desses (vê de 3 em 3 s).
  precisa() {
    try { if (typeof AoVivo !== 'undefined' && AoVivo.ativo) return true;
      const at = document.getElementById('atelie'); if (typeof Atelie !== 'undefined' && Atelie.def && Atelie.naNuvem && at && !at.classList.contains('hidden')) return true; } catch { }
    return false;
  },
  // VERSÃO NOVA = TELA "ATUALIZANDO" (decisão do dono, 04/11/2026): a mesma do Perfil › Atualizar todos os sites (fundo desfocado,
  // bolinhas girando, barra e %), sozinha, sem botão. Baixa SÓ os arquivos desta página (não varre o site todo: economiza pedidos).
  // Contra laço: atualizou sozinho há menos de 3 min nesta aba = volta a aparecer o aviso com o botão (não recarrega de novo sozinho).
  trava() {
    if (this.travado) return; this.travado = true;
    let ult = 0; try { ult = +sessionStorage.getItem('animador-versao-auto') || 0; } catch { }
    this._bloq = e => { if (e.target.closest?.('.versao-trava')) return; e.preventDefault(); e.stopPropagation(); };
    for (const ev of ['keydown', 'wheel', 'contextmenu', 'drop', 'paste']) addEventListener(ev, this._bloq, { capture: true, passive: false });
    // SEMPRE IGUAL (pedido do dono, 05/11/2026): sempre a tela "Atualizando", sozinha, sem botão. Contra laço: se atualizou sozinho há
    // menos de 3 min nesta aba (várias publicações seguidas), a mesma tela espera o resto do tempo e aí atualiza.
    const falta = 180000 - (Date.now() - ult);
    if (falta <= 0) return this.atualizar();
    const diz = this.tela(); this._tela = diz; let t = Math.ceil(falta / 1000); const anda = () => { diz(`Esperando a versão nova terminar de publicar… ${t} s`, 2); if (t-- <= 0) { clearInterval(iv); document.getElementById('ep-atualizando')?.remove(); this.atualizar(); } }, iv = setInterval(anda, 1000); anda();
  },
  tela() { // a tela "Atualizando" (igual à do Perfil › Atualizar todos os sites, do /estudio-conta.js)
    if (!document.getElementById('ep-atualizando-css')) { const st = document.createElement('style'); st.id = 'ep-atualizando-css'; st.textContent = '#ep-atualizando{position:fixed;inset:0;z-index:2147483647;background:rgba(8,9,12,.5);-webkit-backdrop-filter:blur(16px) saturate(.9);backdrop-filter:blur(16px) saturate(.9);display:flex;align-items:center;justify-content:center;font:14px/1.5 \'Segoe UI\',system-ui,sans-serif;color:#f1f2f4;cursor:progress;-webkit-user-select:none;user-select:none;animation:epAtEntra .25s ease both}'
      + '#ep-atualizando .ep-at-c{display:grid;justify-items:center}#ep-atualizando .ep-at-sp{position:relative;width:46px;height:46px}#ep-atualizando .ep-at-sp i{position:absolute;inset:0;opacity:0;animation:epAtGira 4.4s infinite}#ep-atualizando .ep-at-sp i::after{content:\'\';position:absolute;top:0;left:50%;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:#fff}'
      + [0, 1, 2, 3, 4].map(n => `#ep-atualizando .ep-at-sp i:nth-child(${n + 1}){animation-delay:${(n * .22).toFixed(2)}s}`).join('')
      + '@keyframes epAtGira{0%{transform:rotate(180deg);opacity:1;animation-timing-function:ease-out}7%{transform:rotate(300deg);animation-timing-function:linear}30%{transform:rotate(470deg);animation-timing-function:ease-in-out}39%{transform:rotate(645deg);animation-timing-function:linear}70%{transform:rotate(770deg);animation-timing-function:ease-out}75%{transform:rotate(900deg);opacity:1}76%,100%{transform:rotate(900deg);opacity:0}}'
      + '#ep-atualizando .ep-at-t{margin-top:22px;font-size:17px;font-weight:600;letter-spacing:.2px}#ep-atualizando .ep-at-s{font-size:12px;color:#a3a7ae;margin-top:2px}#ep-atualizando .ep-at-br{width:200px;height:5px;border-radius:3px;background:rgba(255,255,255,.18);margin:18px 0 10px;overflow:hidden}#ep-atualizando .ep-at-br>i{display:block;height:100%;width:0;background:#f1f2f4;border-radius:3px;transition:width .35s ease}#ep-atualizando .ep-at-pc{display:flex;gap:8px;align-items:baseline;font-size:11.5px;color:#a3a7ae}#ep-atualizando .ep-at-pc b{color:#e3e5e8;font-variant-numeric:tabular-nums;min-width:34px;text-align:right}#ep-atualizando .ep-at-pc span{font-variant-numeric:tabular-nums;white-space:nowrap}'
      + '@keyframes epAtEntra{from{opacity:0}}@media (prefers-reduced-motion:reduce){#ep-atualizando{animation:none}#ep-atualizando .ep-at-sp i{animation-duration:8s}}'; document.head.appendChild(st); }
    const el = document.createElement('div'); el.id = 'ep-atualizando'; el.className = 'versao-trava'; el.setAttribute('role', 'status');
    el.innerHTML = '<div class="ep-at-c"><div class="ep-at-sp" aria-hidden="true">' + '<i></i>'.repeat(5) + '</div><div class="ep-at-t">Atualizando</div><div class="ep-at-s">Tem uma versão nova do Animador</div><div class="ep-at-br"><i></i></div><div class="ep-at-pc"><b>0%</b><span>Guardando o que você fez…</span></div></div>';
    document.body.appendChild(el); try { document.activeElement?.blur?.(); } catch { }
    return (t, pct) => { el.querySelector('.ep-at-pc span').textContent = t; const p = Math.max(0, Math.min(100, Math.round(pct))); el.querySelector('.ep-at-pc b').textContent = p + '%'; el.querySelector('.ep-at-br>i').style.width = p + '%'; };
  },
  async atualizar(el) {
    if (this._atualizando) return; this._atualizando = true; el?.remove(); const diz = this.tela(); diz('Guardando o que você fez…', 3);
    try { sessionStorage.setItem('animador-versao-auto', String(Date.now())); } catch { }
    try { await App.salvarJa?.(); } catch { } try { if (Atelie.def && Atelie.sujo) await Atelie.rascunho?.(true); } catch { } try { await AoVivo._fila; } catch { }
    await new Promise(r => setTimeout(r, 700)); // o rascunho do Ateliê grava meio segundo depois da última mudança
    const urls = [...new Set([location.href.split('#')[0], ...$$('script[src]').map(s => s.src), ...$$('link[rel=stylesheet]').map(l => l.href)])].filter(u => u.startsWith(location.origin));
    let feitos = 0, prox = 0; diz('0 de ' + urls.length + ' arquivos', 10);
    await Promise.all(Array.from({ length: 6 }, async () => { while (prox < urls.length) { await fetch(urls[prox++], { cache: 'reload' }).catch(() => null); feitos++; diz(feitos + ' de ' + urls.length + ' arquivos', 10 + 88 * feitos / urls.length); } })); // troca o que o navegador tinha guardado (6 de cada vez)
    diz('Pronto, recarregando…', 100); setTimeout(() => location.reload(), 600);
  },
};
