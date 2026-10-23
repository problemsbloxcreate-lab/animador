/* ===================== versao.js — VERSÃO NOVA do site: trava e pede para atualizar =====================
   versao.json (gravado pela Action "Versão do site" a cada mudança publicada) diz o código da versão. Ao abrir, guarda o
   de agora; de 2 em 2 minutos (e ao voltar para a aba) confere de novo. Mudou = uma tela por cima de tudo trava as mudanças
   (quem continuasse mexendo numa versão velha podia estragar o arquivo de quem está na nova, no ao vivo e na nuvem) e o
   botão (só ao vivo ou num personagem da nuvem: `precisa()`; fora disso espera) "Atualizar agora" guarda o que falta, baixa os arquivos novos (sem o cache do navegador) e recarrega. */
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
  trava() {
    if (this.travado) return; this.travado = true;
    const el = h(`<div class="versao-trava" role="alertdialog"><div class="vt-card"><div class="vt-ic">${ic('download', 26)}</div><b>Tem uma versão nova do Animador</b>
      <div>Para não estragar nada (no ao vivo e na nuvem todo mundo precisa estar na mesma versão), as mudanças ficam travadas até você atualizar a página.</div>
      <small>O que você fez até agora fica guardado neste computador.</small><button class="btn primary" data-a>${ic('redo', 14)} Atualizar agora</button></div></div>`);
    document.body.appendChild(el); $('[data-a]', el).onclick = () => this.atualizar(el);
    this._bloq = e => { if (e.target.closest?.('.versao-trava')) return; e.preventDefault(); e.stopPropagation(); };
    for (const ev of ['keydown', 'wheel', 'contextmenu', 'drop', 'paste']) addEventListener(ev, this._bloq, { capture: true, passive: false });
  },
  async atualizar(el) {
    const b = $('[data-a]', el); b.disabled = true; b.innerHTML = '<span class="spin-dot"></span> Guardando e baixando a versão nova…';
    try { await App.salvarJa?.(); } catch { } try { if (Atelie.def && Atelie.sujo) await Atelie.rascunho?.(true); } catch { } try { await AoVivo._fila; } catch { }
    await new Promise(r => setTimeout(r, 700)); // o rascunho do Ateliê grava meio segundo depois da última mudança
    const urls = [...new Set([location.href.split('#')[0], ...$$('script[src]').map(s => s.src), ...$$('link[rel=stylesheet]').map(l => l.href)])].filter(u => u.startsWith(location.origin));
    await Promise.all(urls.map(u => fetch(u, { cache: 'reload' }).catch(() => null))); // troca o que o navegador tinha guardado
    location.reload();
  },
};
