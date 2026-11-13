/* ===================== nuvemanim.js — ANIMAÇÕES na nuvem da equipe (decisão do dono, 30/10/2026) =====================
   Toda animação do Animador vai sozinha para a nuvem (servidor turma-ia, rota /animacoes): pasta "animacoes/<id>/" com
   projeto.json (sem a miniatura), thumb.jpg e arq/<chave> = imagens e áudios que só existem nela (as dos personagens da
   equipe já estão em personagens/ e não sobem de novo). Igual ao Ateliê: manda 1 min depois da última mudança e ao esconder
   a aba; ao vivo com mais gente só UMA pessoa da sala manda (a de menor id) e avisa as outras (meta.nuvemEm).
   Abrir uma animação da nuvem entra sozinho no AO VIVO (sala an-<id>, sem o botão Trabalhar junto).
   Personagem da animação que NÃO está na nuvem do Ateliê sobe junto, na pasta "PERSONAGENS ANIMADOR AUTOMATICO" (criada se
   não existir); se alguém mudar a pasta dele depois, ela não é mexida de novo.
   No projeto: P.nuvemEm = quando ESTE computador mandou/recebeu da nuvem; P.nuvemMod = marca da versão da nuvem que ele tem. */
'use strict';
/* TELA "CARREGANDO DA NUVEM" (04/11/2026, pedido do dono): ao abrir uma animação da nuvem pelos Recentes do menu (?nuvem=<id>),
   a tela preta da inicialização (só o ícone) vira um carregamento estilo Windows: nuvem com as bolinhas girando dentro,
   "Carregando da nuvem", o nome, a barrinha fina e a %. Fica por baixo da tela de inicialização (que some com fade por cima).
   NUNCA tenta de novo sozinha; erro ou fim = some. */
const NuvemTela = {
  el: null, alvo: 0, mostrado: 0, raf: 0,
  css() {
    if (document.getElementById('nt-css')) return;
    const s = document.createElement('style'); s.id = 'nt-css';
    s.textContent = `#nuvem-tela{position:fixed;inset:0;z-index:2147483646;background:#000;display:flex;align-items:center;justify-content:center;font:14px/1.5 system-ui,'Segoe UI',sans-serif;color:#e8e9ec;user-select:none;-webkit-user-select:none;transition:opacity .4s ease}
#nuvem-tela.nt-sai{opacity:0;pointer-events:none}
#nuvem-tela .nt-c{position:relative;width:260px;height:260px;display:flex;flex-direction:column;align-items:center;justify-content:center}
#nuvem-tela .nt-ic{width:84px;height:84px;transition:transform .7s cubic-bezier(.4,0,.2,1),opacity .5s ease;animation:ntRespira 2.6s ease-in-out infinite}
#nuvem-tela .nt-ic img{width:84px;height:84px;display:block}
#nuvem-tela .nt-nv{position:absolute;top:50%;left:50%;width:132px;height:92px;margin:-78px 0 0 -66px;opacity:0;transform:scale(.6);transition:opacity .5s ease .25s,transform .6s cubic-bezier(.2,.9,.3,1.2) .25s}
#nuvem-tela .nt-nv svg{width:132px;height:92px;overflow:visible}
#nuvem-tela .nt-nv path{fill:none;stroke:#e8e9ec;stroke-width:3;stroke-linejoin:round;stroke-dasharray:420;stroke-dashoffset:420;transition:stroke-dashoffset 1s ease .3s}
#nuvem-tela .nt-dots{position:absolute;left:50%;top:58%;width:34px;height:34px;margin:-17px 0 0 -17px}
#nuvem-tela .nt-dots i{position:absolute;inset:0;animation:ntGira 2.2s infinite}
#nuvem-tela .nt-dots i::after{content:'';position:absolute;left:50%;top:0;width:4.5px;height:4.5px;margin-left:-2.25px;border-radius:50%;background:#e8e9ec}
#nuvem-tela .nt-dots i:nth-child(2){animation-delay:.12s}#nuvem-tela .nt-dots i:nth-child(3){animation-delay:.24s}#nuvem-tela .nt-dots i:nth-child(4){animation-delay:.36s}#nuvem-tela .nt-dots i:nth-child(5){animation-delay:.48s}
#nuvem-tela .nt-tx{position:absolute;top:calc(50% + 34px);left:50%;width:300px;margin-left:-150px;text-align:center;opacity:0;transform:translateY(6px);transition:opacity .45s ease .45s,transform .45s ease .45s}
#nuvem-tela .nt-t{font-size:13.5px;color:#e8e9ec;font-weight:500}
#nuvem-tela .nt-nm{font-size:12px;color:#7d8089;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
#nuvem-tela .nt-br{width:200px;height:5px;border-radius:3px;background:rgba(255,255,255,.16);margin:16px auto 10px;overflow:hidden}
#nuvem-tela .nt-br>i{display:block;height:100%;width:0;background:#e8e9ec;border-radius:3px}
#nuvem-tela .nt-pc{font-size:11.5px;color:#7d8089}#nuvem-tela .nt-pc b{color:#c3c6cc;font-weight:600}
#nuvem-tela.nt-on .nt-ic{transform:translateY(-118px) scale(.42);opacity:.9;animation:none}
#nuvem-tela.nt-on .nt-nv{opacity:1;transform:none}#nuvem-tela.nt-on .nt-nv path{stroke-dashoffset:0}
#nuvem-tela.nt-on .nt-tx{opacity:1;transform:none}
#nuvem-tela.nt-vidro{background:rgba(8,9,12,.55);-webkit-backdrop-filter:blur(16px) saturate(.9);backdrop-filter:blur(16px) saturate(.9)}
#nuvem-tela.nt-indef .nt-br>i{width:35%!important;animation:ntIndef 1.3s ease-in-out infinite}#nuvem-tela.nt-indef .nt-pc b,#nuvem-tela.nt-indef .nt-pc .nt-sep{display:none}
#nuvem-tela .nt-pc .nt-sep{font-style:normal}
@keyframes ntIndef{0%{transform:translateX(-100%)}100%{transform:translateX(290%)}}
@keyframes ntRespira{50%{transform:scale(1.045)}}
@keyframes ntGira{0%{transform:rotate(225deg);opacity:1;animation-timing-function:ease-out}7%{transform:rotate(345deg);animation-timing-function:linear}30%{transform:rotate(455deg);animation-timing-function:ease-in-out}39%{transform:rotate(690deg);animation-timing-function:linear}70%{transform:rotate(815deg);opacity:1;animation-timing-function:ease-out}75%{transform:rotate(945deg);animation-timing-function:ease-out}76%,100%{transform:rotate(945deg);opacity:0}}
@media (prefers-reduced-motion:reduce){#nuvem-tela *{animation:none!important;transition:none!important}}
/* CARREGAMENTO ÚNICO (pedido da dona, 12/11/2026): esta tela é a MESMA do carregamento C (a da entrada, #turma-login):
   fundo liso, ícone do programa dentro do anel parado, brilho na cor do programa piscando leve, título e UMA linha "54% · frase".
   Do começo ao fim só o texto muda (nada de nuvem desenhada, barra ou fundo preto). */
#nuvem-tela{--pt-tx:#f5f5f7;--pt-tx2:rgba(235,235,245,.66);background:#141416;font-family:"Inter","Segoe UI Variable Text","Segoe UI",system-ui,sans-serif}
html[data-tema="claro"] #nuvem-tela{--pt-tx:#1d1d1f;--pt-tx2:rgba(60,60,67,.66);background:#f2f2f5}
#nuvem-tela.nt-vidro{background:color-mix(in srgb,#141416 84%,transparent)}html[data-tema="claro"] #nuvem-tela.nt-vidro{background:color-mix(in srgb,#f2f2f5 84%,transparent)}
#nuvem-tela::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(260px 260px at 50% calc(50% - 64px),color-mix(in srgb,var(--ep-cor,#3fd6f2) 30%,transparent),transparent 72%);animation:epBrilho 1.8s ease-in-out infinite alternate}
html[data-tema="claro"] #nuvem-tela::before{background:radial-gradient(260px 260px at 50% calc(50% - 64px),color-mix(in srgb,var(--ep-cor,#3fd6f2) 22%,transparent),transparent 72%)}
#nuvem-tela .nt-c{position:relative;z-index:1;width:auto;height:auto;transform:translateY(-4vh);display:flex;flex-direction:column;align-items:center;justify-content:center}
#nuvem-tela .nt-ic,#nuvem-tela.nt-on .nt-ic{position:relative;width:60px;height:60px;margin:30px;transform:none;opacity:1;animation:none;transition:none}
#nuvem-tela .nt-ic::before{content:"";position:absolute;inset:-30px;border-radius:50%;background:conic-gradient(var(--pt-tx) calc(var(--ep-p,0) * 1%),color-mix(in srgb,var(--pt-tx) 13%,transparent) 0);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 4px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 4px))}
#nuvem-tela .nt-ic img{width:60px;height:60px;border-radius:14px;box-shadow:0 8px 22px rgba(0,0,0,.3);animation:epRespira2 2.6s ease-in-out infinite}
@keyframes epRespira2{50%{transform:scale(1.06)}}@keyframes epBrilho{from{opacity:.6}to{opacity:1}}
#nuvem-tela .nt-br{display:none}
/* A NUVEM VOLTA (ajuste da dona, 12/11/2026): quando passa a carregar da nuvem, a logo some devagar e a nuvem com as bolinhas
   aparece no mesmo lugar, dentro do MESMO anel parado (fade + leve subida, 380 ms). Mesmo tema, mesmas cores, nada de pular de tela. */
#nuvem-tela .nt-nv,#nuvem-tela.nt-on .nt-nv{position:absolute;top:60px;left:50%;width:78px;height:54px;margin:-25px 0 0 -39px;z-index:1;pointer-events:none;transition:opacity .38s cubic-bezier(.2,.7,.2,1),transform .38s cubic-bezier(.2,.7,.2,1)}
#nuvem-tela .nt-nv{opacity:0;transform:translateY(7px)}#nuvem-tela.nt-on .nt-nv{opacity:1;transform:none}
#nuvem-tela .nt-nv svg{width:78px;height:54px}
#nuvem-tela .nt-nv path,#nuvem-tela.nt-on .nt-nv path{stroke:var(--pt-tx);stroke-width:4.2;stroke-dasharray:none;stroke-dashoffset:0;transition:none}
#nuvem-tela .nt-dots{left:28px;top:21px;width:22px;height:22px;margin:0}#nuvem-tela .nt-dots i{transform-origin:50% 50%}#nuvem-tela .nt-dots i::after{left:9px;width:4px;height:4px;margin-left:0;background:var(--pt-tx)}
#nuvem-tela .nt-ic img{transition:opacity .32s ease}#nuvem-tela.nt-on .nt-ic img{opacity:0}
#nuvem-tela .nt-t,#nuvem-tela .nt-pc span{transition:opacity .2s ease}#nuvem-tela .nt-troca{opacity:0}
@media (prefers-reduced-motion:reduce){#nuvem-tela .nt-nv,#nuvem-tela.nt-on .nt-nv{transform:none!important;transition:opacity .35s ease!important}#nuvem-tela .nt-ic img{transition:opacity .35s ease!important}#nuvem-tela .nt-pc span{transition:opacity .2s ease!important}}
#nuvem-tela .nt-tx,#nuvem-tela.nt-on .nt-tx{position:relative;top:auto;left:auto;width:auto;margin:0;opacity:1;transform:none;transition:none}
#nuvem-tela .nt-t{margin:26px 0 4px;font-weight:600;font-size:20px;line-height:1.25;letter-spacing:-.01em;color:var(--pt-tx)}
#nuvem-tela .nt-pc{font-size:13.5px;color:var(--pt-tx2);white-space:nowrap;max-width:60vw;overflow:hidden;text-overflow:ellipsis}#nuvem-tela .nt-pc b{color:var(--pt-tx);font-weight:600;font-variant-numeric:tabular-nums}
#nuvem-tela .nt-nm{position:absolute;top:100%;left:50%;transform:translateX(-50%);width:max-content;max-width:60vw;margin-top:6px;font-size:12px;color:var(--pt-tx2)}
@media (prefers-reduced-motion:reduce){#nuvem-tela::before{animation:none}}
#nuvem-tela .nt-pc b{display:inline-block;min-width:2.6em;text-align:right;font-variant-numeric:tabular-nums}`;
    document.head.appendChild(s);
  },
  // prog: 'an' (Animador) ou 'at' (Ateliê) = o ícone do começo; o.titulo (no lugar de "Carregando da nuvem"), o.vidro (fundo desfocado
  // por cima do programa, para salvar/enviar/atualizar), o.indef (barra andando sem % até chegar um andamento de verdade)
  inicio(nome, prog = 'an', o = {}) {
    if (this.el) return; this.css(); this.alvo = 0; this.mostrado = 0; this.acabou = false;
    const EI = window.EstudioIcones, ic = EI ? EI.url(prog) : prog === 'at' ? 'icones/atelie.svg' : 'icones/icone-192.png';
    const el = this.el = document.createElement('div'); el.id = 'nuvem-tela'; el.setAttribute('role', 'progressbar'); el.setAttribute('aria-label', 'Carregando da nuvem');
    el.innerHTML = `<div class="nt-c"><div class="nt-ic"><img alt="" src="${esc(ic)}"></div>
      <div class="nt-nv"><svg viewBox="0 0 132 92"><path d="M34 82 H100 A26 26 0 0 0 104 30.4 A34 34 0 0 0 40.6 22 A30 30 0 0 0 34 82 Z"/></svg><span class="nt-dots"><i></i><i></i><i></i><i></i><i></i></span></div>
      <div class="nt-tx"><div class="nt-t"></div><div class="nt-nm"></div><div class="nt-br"><i></i></div><div class="nt-pc"><b>0%</b><i class="nt-sep"> · </i><span>Conectando…</span></div></div></div>`;
    el.querySelector('.nt-t').textContent = o.titulo || 'Carregando da nuvem'; el.querySelector('.nt-nm').textContent = nome || '';
    if (o.vidro) el.classList.add('nt-vidro'); if (o.indef) el.classList.add('nt-indef');
    try { const fg = EI?.config?.()?.[prog]?.fg; el.style.setProperty('--ep-cor', /^#[0-9a-f]{6}$/i.test(fg || '') ? fg : prog === 'at' ? '#ffb04a' : '#3fd6f2'); } catch { } // brilho na cor do programa, igual à entrada
    document.body.appendChild(el);
    // a transição do ícone para a nuvem acontece quando a tela de inicialização (por cima) já saiu: assim dá para ver (no máximo 13 s esperando)
    // a inicialização (já com o acesso conferido) não espera o download: sai logo e esta tela (igual por baixo) assume
    const t0 = Date.now(), vira = () => { if (!this.el) return; const b = document.getElementById('turma-login'); if (b && Date.now() - t0 < 13000) { if (Date.now() - t0 > 500 && !b.classList.contains('ep-saindo')) { b.classList.add('ep-saindo'); setTimeout(() => b.remove(), 380); } return setTimeout(vira, 120); } setTimeout(() => { if (!this.acabou) this.el?.classList.add('nt-on'); }, Math.max(150, 300 - (Date.now() - t0))); }; // conferência rápida (< 0,3 s) nem mostra a nuvem (pedido da dona, 12/11/2026)
    vira(); this.anda();
  },
  nome(n) { const e = this.el?.querySelector('.nt-nm'); if (e && n) e.textContent = n; },
  // f = 0..1 (do download de verdade); txt = o que está baixando
  passo(f, txt) { if (!this.el) return; if (f != null && isFinite(f)) { this.el.classList.remove('nt-indef'); this.alvo = Math.max(this.alvo, Math.min(1, f)); } if (txt) { const sp = this.el.querySelector('.nt-pc span'), so = s => s.replace(/[\d\s\/.…%]+/g, ''); // frase nova = troca suave (crossfade); só o número mudou = na hora
      if (so(sp.textContent) === so(txt)) { if (!sp._troca) sp.textContent = txt; else sp._prox = txt; }
      else { sp._prox = txt; if (!sp._troca) { sp._troca = 1; sp.classList.add('nt-troca'); setTimeout(() => { sp.textContent = sp._prox; sp._troca = 0; sp.classList.remove('nt-troca'); }, 200); } } } },
  anda() { // a barra corre suave até o valor de verdade (sem pular)
    cancelAnimationFrame(this.raf); if (!this.el) return;
    this.mostrado += (this.alvo - this.mostrado) * .12; if (this.alvo - this.mostrado < .002) this.mostrado = this.alvo;
    const p = Math.round(this.mostrado * 100); this.el.querySelector('.nt-br>i').style.width = (this.mostrado * 100).toFixed(1) + '%'; this.el.querySelector('.nt-pc b').textContent = p + '%'; this.el.style.setProperty('--ep-p', (this.mostrado * 100).toFixed(1));
    this.raf = requestAnimationFrame(() => this.anda());
  },
  async fim(ok) {
    const el = this.el; if (!el) return; this.acabou = true; // terminou: a nuvem não entra mais (conferência rápida nem pisca)
    if (ok) { this.passo(1, 'Pronto'); await new Promise(r => setTimeout(r, 380)); }
    cancelAnimationFrame(this.raf); this.el = null; el.classList.add('nt-sai'); setTimeout(() => el.remove(), 450);
  },
};
const NuvemAnim = {
  PASTA_AUTO: 'PERSONAGENS ANIMADOR AUTOMATICO',
  _ks: new Map(), // id → Set das chaves que já estão na nuvem
  // cópias de segurança feitas aqui ("(anterior)", "(antes da atualização)") ficam só neste computador
  // SÓ AS NOVAS (decisão do dono, 30/10/2026): animação criada/aberta de arquivo daqui em diante (P.nuvemAuto) ou que já veio da nuvem;
  // as que já existiam neste computador ficam só nele
  // P.semNuvem = tirada da nuvem (botão "Remover da nuvem" aqui ou em outro computador): não volta sozinha, só pelo "Enviar para a nuvem"
  vai(P) { return !!(P && P.id && /^[A-Za-z0-9_-]{2,40}$/.test(P.id) && !P.anterior && !P.soLocal && !P.semNuvem && (P.nuvemAuto || P.nuvemEm)); },
  // assinatura rápida de um texto (para não regravar o que não mudou)
  assina(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return t.length + ':' + (h >>> 0).toString(36); },
  _enviado: new Map(), // id → { j: assinatura do projeto.json, t: assinatura da miniatura } que já estão na nuvem
  pasta(id) { return `animacoes/${id}/`; },
  chaveArq(id, k) { return this.pasta(id) + 'arq/' + encodeURIComponent(k).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); },
  // ---------- lista ----------
  lista(novo) {
    if (!novo && this._lista && Date.now() - this._listaEm < 60000) return this._lista;
    this._listaEm = Date.now(); return (this._lista = (async () => (await (await Nuvem.pede('/animacoes')).json()).itens || [])().catch(e => { this._lista = null; throw e; }));
  },
  async noServidor(id) { const s = new Set(); for (const it of (await (await Nuvem.pede('/animacoes?id=' + encodeURIComponent(id))).json()).itens || []) s.add(it.k); this._ks.set(id, s); return s; },
  // chaves do projeto que precisam ir para a nuvem da animação: tudo que NÃO está na nuvem dos personagens nem no site (cenários da casa)
  async chavesProprias(P) {
    let naNuvemP = this._kP; if (!naNuvemP || Date.now() - this._kPEm > 300000) { naNuvemP = new Set(); try { for (const it of (await (await Nuvem.pede('/personagens')).json()).itens || []) naNuvemP.add(it.k); this._kP = naNuvemP; this._kPEm = Date.now(); } catch { } }
    return Toon.ids(P).filter(k => !naNuvemP.has(k) && !/^cenarios\//.test(k));
  },
  // ---------- mandar ----------
  async salvar(P, aoAndar) {
    if (!this.vai(P)) return false; const id = P.id;
    await this.personagensQueFaltam(P, aoAndar).catch(e => console.warn('personagens automáticos', e));
    const ja = this._ks.get(id) || await this.noServidor(id).catch(() => new Set()), ks = await this.chavesProprias(P);
    const falta = ks.filter(k => !ja.has(this.chaveArq(id, k))); let n = 0;
    for (const k of falta) { const b = await Arq.pegaBlob(k); if (!b) continue; aoAndar?.(`Enviando arquivos da animação… ${++n}/${falta.length}`);
      await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.chaveArq(id, k)), { method: 'POST', body: b }); ja.add(this.chaveArq(id, k)); }
    const env = this._enviado.get(id) || {};
    if (P.thumb) { const at = this.assina(P.thumb); if (at !== env.t) { try { const b = await (await fetch(P.thumb)).blob(); await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.pasta(id) + 'thumb.jpg'), { method: 'POST', body: b }); env.t = at; } catch { } } }
    const semMarca = o => { const { thumb, nuvemEm, nuvemMod, modificado, autor, edicoes, ...c } = o; return c; }, aj = this.assina(JSON.stringify(semMarca(P)));
    let r = { ok: true };
    if (aj !== env.j) { // nada mudou de verdade (só a hora de salvar ou quem editou): não regrava
      await Autores.marca(P); delete P.semNuvem; if (App.P?.id === id) { App.P.autor = P.autor; App.P.edicoes = P.edicoes; } // quem criou / editou (foto e nome, nunca o e-mail), igual ao Ateliê
      const { thumb, nuvemEm, nuvemMod, ...corpo } = P, q = x => x && { i: x.id, n: x.nome, t: x.em };
      const quem = encodeURIComponent(JSON.stringify({ a: q(P.autor), e: (P.edicoes || []).slice(-6).map(q) }));
      r = await (await Nuvem.pede(`/animacoes/arquivo?nome=${encodeURIComponent(P.nome || '')}&quem=${quem}&k=` + encodeURIComponent(this.pasta(id) + 'projeto.json'), { method: 'POST', body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' } })).json().catch(() => ({})); if (r.ok !== false) env.j = aj; }
    this._enviado.set(id, env);
    // arquivos que a animação já não usa saem da nuvem (só os dela; os dos personagens da equipe não)
    const usa = new Set(ks.map(k => this.chaveArq(id, k))); for (const k of [...ja]) if (/\/arq\//.test(k) && !usa.has(k)) { try { await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(k), { method: 'DELETE' }); ja.delete(k); } catch { } }
    this._lista = null; return r.ok !== false;
  },
  // personagem da animação que não está na nuvem do Ateliê: sobe na pasta automática (só se ainda não tem pasta escolhida na nuvem)
  async personagensQueFaltam(P, aoAndar) {
    const defs = Object.values(P.personagens || {}).filter(d => d?.id && /^[a-z0-9][a-z0-9-]{1,40}$/.test(d.id)); if (!defs.length) return;
    const feitos = new Set(P.persAuto || []), tentou = this._tentou ||= new Set();
    const faltam = []; for (const d of defs) {
      if (feitos.has(d.id) || tentou.has(d.id)) continue; // já mandado por esta animação (ou já tentado agora): não manda de novo
      const est = await Nuvem.estaNaNuvem(d.id); if (est !== false) continue; // null = não deu para saber: não sobe nada
      if (await DB.get('personagens', d.id).catch(() => null)) continue; // este computador já o viu NA NUVEM: alguém tirou de lá de propósito, não volta sozinho
      faltam.push(d); }
    if (!faltam.length) return;
    for (const d0 of faltam) {
      const def = clone(d0); delete def._local; delete def._vista;
      for (const p of Modelo.todasPartes(def)) p.imgs = (p.imgs || []).filter(i => !i.doQuadro); // imagens feitas só para um quadro desta animação não vão para o personagem da equipe
      aoAndar?.(`Mandando o personagem “${def.nome || 'sem nome'}” para a nuvem…`); tentou.add(d0.id);
      try { await Icone.prepara(def); } catch { }
      await Nuvem.salvar(def, null, { limpar: false }); feitos.add(d0.id);
    }
    if (App.P?.id === P.id) App.P.persAuto = [...feitos]; P.persAuto = [...feitos];
    await PastasBib.grava('nuvem', o => { if (!o.pastas.includes(this.PASTA_AUTO)) o.pastas.push(this.PASTA_AUTO); for (const d of faltam) if (!o.de[d.id]) o.de[d.id] = this.PASTA_AUTO; });
    Nuvem._lista = null;
  },
  // a chave já está na nuvem da equipe (personagens ou arquivos desta animação)? (para o ao vivo não mandar de novo pelo tempo real)
  temNaNuvem(id, k) { return !!(this._kP?.has(k) || this._ks.get(id)?.has(this.chaveArq(id, k))); },
  async baixarArq(id, k) { const b = await (await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.chaveArq(id, k)))).blob(); return b?.size ? b : null; },
  // "quem" da lista da nuvem (códigos e nomes) no formato do Autores.selo; a foto e o nome de agora vêm do Autores.vivo
  quemDe(it) { const q = it?.quem, P = x => x?.i ? { id: x.i, nome: x.n || '…', em: x.t || 0 } : null; if (!q?.a) return /^u[0-9a-f]{16}$/.test(it?.por || '') ? { autor: { id: it.por, nome: '…', em: Date.parse(it.em || 0) || it.mod || 0 }, edicoes: [], modificado: it.mod } : null; return { autor: P(q.a), edicoes: (q.e || []).map(P).filter(Boolean), modificado: it.mod }; },
  // ---------- baixar ----------
  async baixarProjeto(id, andou = () => { }) { // andou(0..1, texto): o progresso de verdade (para a tela "Carregando da nuvem")
    andou(.04, 'Baixando a animação…');
    const r = await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.pasta(id) + 'projeto.json')); const P = await r.json();
    andou(.1, 'Conferindo os arquivos…');
    const ks = await this.noServidor(id).catch(() => new Set());
    // MAIS RÁPIDO (04/11/2026): 1) o que já está neste computador (as mesmas imagens/personagens de outras animações) nem é pedido;
    // 2) o que falta baixa 10 de cada vez (antes era 1 por vez). O número de pedidos à nuvem é o mesmo, só não fica um esperando o outro.
    const ids = [...Toon.ids(P)], falta = [];
    for (const k of ids) { if (await Arq.pegaBlob(k).catch(() => null)) continue; if (ks.has(this.chaveArq(id, k)) || /^(personagens|cenlib)\//.test(k)) falta.push(k); }
    const ja = ids.length - falta.length; let feitos = 0, prox = 0;
    andou(.14, falta.length ? 'Faltam ' + falta.length + ' arquivos' + (ja ? ' (' + ja + ' já estão neste computador)' : '') : 'Tudo já está neste computador');
    const um = async k => { const ka = this.chaveArq(id, k);
      if (ks.has(ka)) { try { const b = await (await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(ka))).blob(); await Arq.guardar(b, k); return; } catch { } }
      if (/^personagens\//.test(k)) await Nuvem.baixar(k).catch(() => null); else if (/^cenlib\//.test(k) && typeof CenNuvem !== 'undefined') await CenNuvem.baixar(k).catch(() => null); };
    await Promise.all(Array.from({ length: Math.min(10, falta.length) }, async () => { while (prox < falta.length) { await um(falta[prox++]); feitos++; andou(.14 + .8 * feitos / falta.length, 'Arquivos ' + feitos + ' de ' + falta.length); } }));
    andou(.95, 'Quase pronto…');
    if (ks.has(this.pasta(id) + 'thumb.jpg')) { try { const b = await (await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.pasta(id) + 'thumb.jpg'))).blob(); P.thumb = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }); } catch { } }
    return P;
  },
  // abrir uma animação pela tela inicial: a versão da nuvem quando ela é mais nova; com gente na sala ao vivo, a da sala
  async abrir(id, local, o = {}) { // o.tela: mostra a tela "Carregando da nuvem" (aberto pelos Recentes do menu) em vez da janelinha Ocupado
    // A TELA JÁ NO CLIQUE (pedido da dona, 05/11/2026): antes ela só aparecia depois de conferir a lista da nuvem e quem está ao vivo,
    // e nesse meio-tempo parecia que o clique não tinha funcionado. Agora aparece na hora e diz o que está fazendo.
    const minha0 = !NuvemTela.el; if (minha0) { NuvemTela.inicio(local?.nome || ''); NuvemTela.passo(null, 'Conferindo a versão mais nova na nuvem…'); }
    try { return await this._abrir(id, local, o); } finally { if (minha0 && NuvemTela.el) NuvemTela.fim(true); }
  },
  async _abrir(id, local, o = {}) {
    let it = null; try { it = (await this.lista(true)).find(x => x.id === id); } catch { }
    let P = local; if (it?.nome) NuvemTela.nome(it.nome);
    if (AoVivo.ligado()) NuvemTela.passo(null, 'Vendo se tem alguém trabalhando nela agora…');
    const outros = AoVivo.ligado() ? await AoVivo.outrosNaSala('an-' + id) : 0;
    if (it && !outros && (!local || (it.mod || 0) > (local.nuvemMod || 0))) {
      const mudouAqui = local && (local.modificado || 0) > (local.nuvemEm || 0) + 3000 && local.nuvemMod; // mudanças daqui que ainda não foram e a nuvem também mudou
      let usar = 'nuvem';
      if (mudouAqui) NuvemTela.fim(); // a pergunta não pode ficar escondida atrás da tela de carregamento
      if (mudouAqui) usar = await UI.modal({ title: 'Esta animação mudou nos dois lugares', icon: 'cloud', width: 460, body: `<div>A versão da <b>nuvem da equipe</b> é mais nova, mas este computador tem mudanças que ainda não foram para a nuvem.<br><br>A versão que você não escolher fica guardada aqui como <b>(anterior)</b>.</div>`, buttons: [{ label: 'Usar a deste computador', value: 'local' }, { label: 'Usar a da nuvem', kind: 'primary', value: 'nuvem' }] }) || 'nuvem';
      if (usar === 'nuvem') {
        // SEMPRE a tela "Carregando da nuvem" (decisão do dono, 04/11/2026: nada da janelinha antiga ao abrir da nuvem); aberta aqui = fecha aqui
        const minha = !NuvemTela.el; if (minha) NuvemTela.inicio(it.nome); else NuvemTela.nome(it.nome);
        try { const N = await this.baixarProjeto(id, (f, txt) => NuvemTela.passo(f, txt)); if (mudouAqui) { const ant = clone(local); ant.id = uid('p'); ant.nome = local.nome + ' (anterior)'; ant.anterior = { em: Date.now() }; await DB.put('projetos', ant); }
          N.id = id; N.nuvemEm = Date.now(); N.nuvemMod = it.mod || Date.now(); N.modificado = N.modificado || Date.now(); await DB.put('projetos', JSON.parse(JSON.stringify(N))); P = N; }
        catch (e) { if (minha) NuvemTela.fim(); UI.toast('Não deu para baixar da nuvem: ' + esc(e.message) + (local ? ' Abrindo a cópia deste computador.' : ''), { kind: 'warn', time: 8000 }); if (!local) return; }
        if (minha && NuvemTela.el) { try { return await App.abrir(P); } finally { NuvemTela.fim(true); } } // a tela só sai com o editor já pronto por baixo
      }
    }
    if (!P && outros) { NuvemTela.fim(); const s = { sala: 'an-' + id, nome: it?.nome }; return Home.entrarJunto(s); }
    if (P) { NuvemTela.passo(.9, 'Abrindo a animação…'); return App.abrir(P); }
  },
  // botão ATUALIZAR do Animador: confere a nuvem e traz a versão mais nova (com gente junto o ao vivo já mantém tudo igual)
  async atualizar() {
    const P = App.P; if (!P) return;
    if (!this.vai(P)) return UI.toast('Esta animação está só neste computador: não tem versão na nuvem para trazer.', { kind: 'warn' });
    if (this.aoVivoJunto()) return UI.toast('Você está trabalhando junto ao vivo: as mudanças de todos já chegam na hora.', { kind: 'ok' });
    let it; try { it = (await this.lista(true)).find(x => x.id === P.id); } catch (e) { return UI.toast('A nuvem não respondeu: ' + esc(e.message || ''), { kind: 'warn' }); }
    if (!it) { if (await this.foiRemovida(P)) { App.pintaNuvem(); return UI.toast('Esta animação foi tirada da nuvem: ficou só neste computador.', { kind: 'warn', time: 7000 }); } return UI.toast('Ainda não está na nuvem. Use "Enviar agora".', { kind: 'warn' }); }
    if ((it.mod || 0) <= (P.nuvemMod || 0) + 1000) { if (this.sujo(P)) await this.sincronizar(true); App.pintaNuvem(); return UI.toast('Já está na versão mais nova da nuvem.', { kind: 'ok' }); }
    await App.salvarJa(); return this.abrir(P.id, App.P); // mais nova lá: pergunta se este computador também mudou e reabre
  },
  // ---------- remover / enviar (botões da tela inicial) ----------
  // tira da nuvem da equipe (a pasta inteira) e marca para não voltar sozinha; a cópia deste computador continua
  async remover(id) {
    await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.pasta(id)), { method: 'DELETE' });
    this._lista = null; this._ks.delete(id); this._enviado.delete(id);
    const P = await DB.get('projetos', id).catch(() => null); if (P) { this.marcaFora(P); await DB.put('projetos', P); }
    if (App.P?.id === id) { this.marcaFora(App.P); if (AoVivo.ad?.ctx === 'animador' && AoVivo.ad.auto) await AoVivo.sair().catch(() => { }); App.pintaJunto?.(); }
    try { await PastasBib.grava('animn', o => { delete o.de[id]; }); } catch { }
  },
  marcaFora(P) { P.semNuvem = true; delete P.nuvemAuto; delete P.nuvemEm; delete P.nuvemMod; delete P.persAuto; },
  // manda AGORA para a nuvem (tela de espera com o andamento) e volta a ir sozinha dali em diante
  async enviar(P) {
    delete P.semNuvem; P.nuvemAuto = true; P.modificado = Math.max(P.modificado || 0, Date.now()); await DB.put('projetos', JSON.parse(JSON.stringify(P)));
    await Ocupado.nuvem(`Enviando "${P.nome || 'Animação'}" para a nuvem`, async () => {
      await this.salvar(P, t => Ocupado.anda?.(t));
      let mod = Date.now(); try { mod = (await this.lista(true)).find(x => x.id === P.id)?.mod || mod; } catch { }
      P.nuvemEm = Date.now(); P.nuvemMod = mod; await DB.put('projetos', JSON.parse(JSON.stringify(P)));
      if (App.P?.id === P.id) { App.P.nuvemEm = P.nuvemEm; App.P.nuvemMod = mod; delete App.P.semNuvem; App.P.nuvemAuto = true; this.entrarAoVivo(P.id).catch(() => { }); }
    });
  },
  // já esteve na nuvem (tem nuvemMod) e sumiu da lista = alguém tirou de lá: não manda de novo, vira só deste computador
  async foiRemovida(P) {
    if (!P?.nuvemMod) return false; let l; try { l = await this.lista(true); } catch { return false; }
    if (l.some(x => x.id === P.id)) return false; this.marcaFora(P); await DB.put('projetos', JSON.parse(JSON.stringify(P))).catch(() => { }); return true;
  },
  // ---------- automático ----------
  aoVivoJunto() { if (!AoVivo.ativo || AoVivo.ad?.ctx !== 'animador') return false; const me = AoVivo.eu?.id; return Object.keys(AoVivo.gente || {}).some(i => i !== me); },
  guardiao() { if (!this.aoVivoJunto()) return true; const me = AoVivo.eu.id, ids = [...new Set([...Object.keys(AoVivo.gente || {}), me])].sort(); return ids[0] === me; },
  sujo(P) { return this.vai(P) && (P.modificado || 0) > (P.nuvemEm || 0) + 1000; },
  // chamado depois de salvar neste computador
  agenda() { const P = App.P; if (!this.sujo(P)) return; clearTimeout(this._t);
    const naReserva = (() => { try { return window.EstudioLimite?.naReserva?.(); } catch { return false; } })();
    this._t = setTimeout(() => this.sincronizar(), this.aoVivoJunto() || naReserva ? 600000 : 60000);
    if (!this._ligouEsconder) { this._ligouEsconder = true; document.addEventListener('visibilitychange', () => { if (document.hidden && this.sujo(App.P) && !this.enviando && Date.now() - (this._envioEm || 0) > 120000) this.sincronizar(); }); } },
  async sincronizar(agora) {
    clearTimeout(this._t); const P = App.P; if (!this.vai(P)) return;
    if (!agora && !this.guardiao()) return; // ao vivo: quem manda é outra pessoa da sala
    if (this.enviando) { this._denovo = true; if (agora) await this.enviando; return; }
    if (!this.sujo(P) && !agora) return;
    if (await this.foiRemovida(P)) { if (App.P?.id === P.id) { this.marcaFora(App.P); App.salvoTxt('Salvo neste computador (tirada da nuvem)'); } return; }
    this._envioEm = Date.now(); const id = P.id, em = Date.now();
    this.enviando = Ocupado.mantem(async () => {
      try { await App.salvarJa(); const snap = JSON.parse(JSON.stringify(App.P)); if (snap.id !== id) return;
        App.salvoTxt('Enviando para a nuvem…'); await this.salvar(snap);
        let mod = Date.now(); try { mod = (await this.lista(true)).find(x => x.id === id)?.mod || mod; } catch { }
        if (App.P?.id === id && App.P.publicacoes?.id) { try { await Exportar.pubAuto?.(App.P, snap); } catch (e) { console.warn('Publicações automático', e); } } // Pu: atualiza o Não publicados junto
        if (App.P?.id === id) { App.P.nuvemEm = em; App.P.nuvemMod = mod; await DB.put('projetos', JSON.parse(JSON.stringify(App.P))).catch(() => { }); App.salvoTxt(this.sujo(App.P) ? 'Salvo neste computador' : 'Salvo na nuvem da equipe'); }
        if (this.aoVivoJunto()) try { AoVivo.t.setMeta(AoVivo.sala, { nuvemEm: { t: Date.now(), por: AoVivo.eu.id, mod } }); } catch { }
        this.erro = null;
      } catch (e) { this.erro = e.message || 'sem conexão'; if (App.P?.id === id) App.salvoTxt('Salvo neste computador (a nuvem não respondeu)'); }
    });
    App.pintaNuvem?.(); await this.enviando; this.enviando = null; App.pintaNuvem?.();
    if (this._denovo) { this._denovo = false; if (this.sujo(App.P)) this.agenda(); }
  },
  // outra pessoa da sala mandou: se não tenho mudança minha indo, o que está na tela é o que foi para a nuvem
  salvoPorOutro(m) { const P = App.P; if (!P || !m || m.por === AoVivo.eu?.id || AoVivo.pend?.length) return; clearTimeout(this._t); P.nuvemEm = Date.now(); P.nuvemMod = m.mod || P.nuvemMod; DB.put('projetos', JSON.parse(JSON.stringify(P))).catch(() => { }); App.salvoTxt('Salvo na nuvem da equipe'); },
  // abriu uma animação: entra sozinho no ao vivo (sala an-<id>) e, se ela ainda não está na nuvem, manda
  async aoAbrir(P) {
    if (!this.vai(P)) return; const id = P.id;
    if (await this.foiRemovida(P)) { this.marcaFora(P); return; } // tirada da nuvem em outro computador: fica só aqui
    this.noServidor(id).catch(() => { }); this.chavesProprias(P).catch(() => { }); // o que já está na nuvem (para o ao vivo não mandar de novo)
    if (!P.nuvemEm) { P.modificado = Math.max(P.modificado || 0, Date.now()); await this.sincronizar(true).catch(() => { }); } // primeira vez: vai para a nuvem ANTES de abrir a sala (os arquivos não passam pelo tempo real)
    else if (this.sujo(P)) this.agenda();
    if (App.P?.id === id) this.entrarAoVivo(id).catch(() => { });
  },
  async entrarAoVivo(id, n = 0) {
    if (!AoVivo.ligado() || App.P?.id !== id || EMBED) return; if (AoVivo.ativo && AoVivo.sala === 'an-' + id) return;
    const eu = await AoVivo.quem().catch(() => ({}));
    if (await AoVivo.entrar(AoVivo.adAnimador(false, true), { meta: { tipo: 'animador', nome: App.P.nome, por: eu.nome || '', w: App.P.w, h: App.P.h, fim: false, auto: true } })) { App.pintaJunto(); return; }
    if (n < 4) { clearTimeout(this._tenta); this._tenta = setTimeout(() => this.entrarAoVivo(id, n + 1).catch(() => { }), 5000); return; }
    UI.toast('Trabalhar junto ao vivo: ' + esc(AoVivo.erro || 'não consegui entrar'), { kind: 'warn', time: 10000 });
  },
  // ao fechar: se ninguém mais está na sala e há mudança que não foi, manda agora
  async aoFechar() { const P = App.P; if (!this.sujo(P)) return; if (this.aoVivoJunto() && !this.guardiao()) return; await this.sincronizar(true).catch(() => { }); },
};
