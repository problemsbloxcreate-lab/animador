/* ===================== rive.js — BASE "RIVE" DO ATELIÊ (pedido da dona, 10/11/2026) =====================
   "Rive" no Estúdio = o jeito do Stick v6 e do Problems (Rive), não o programa Rive: um rig de recorte em que
     1) tudo fica pendurado no Corpo (Pescoço › Cabeça, Braço › Antebraço › Mão, Coxa › Canela),
     2) cotovelo e joelho têm "Contorno" atrás e "Tampa" na frente (a dobra não abre buraco),
     3) antebraço e canela ficam visíveis e separados desde a pose padrão (o cotovelo dobra girando, não trocando o desenho),
     4) as animações são poucas poses-chave e o movimento entre elas é suave (Ateliê: a.suave; Animador: n.suaveP).
   Aqui fica o CONFERIR RIG: botão "Rive" no cabeçalho do Ateliê (#at-rive) abre a janela lateral com o que falta em cada vista
   e um botão para ligar o movimento suave em todas as animações. Só lê o personagem; a única coisa que muda é esse botão (um passo do Ctrl+Z). */
'use strict';
const RiveRig = {
  ACAB: /contorno|tampa|ombro|refer[êe]ncia|^ref$|modelo|fantasma|sombra/i,
  // o que falta para a base Rive, vista por vista: [{ vista, membros, itens: [{ ok, txt }] }]
  conferir(def) {
    const vistas = def.vistas?.length ? def.vistas.map(v => ({ id: v.id, nome: v.nome || 'Vista' })) : [{ id: null, nome: 'Frente' }], out = [];
    for (const v of vistas) {
      let dv; try { dv = Modelo.naVista(def, v.id); } catch { continue; } if (!dv?.partes?.length) continue;
      const P = dv.partes, porId = Object.fromEntries(P.map(p => [p.id, p])), raiz = porId[dv.raiz] || P.find(p => !p.pai), itens = [], ok = (b, txt) => itens.push({ ok: !!b, txt });
      const soltas = P.filter(p => p !== raiz && !p.pai && !this.ACAB.test(p.nome) && p.base?.vis !== false);
      ok(raiz && /corpo/i.test(raiz.nome), raiz ? `Raiz: ${raiz.nome}${/corpo/i.test(raiz.nome) ? '' : ' (o padrão é "Corpo")'}` : 'Sem parte raiz');
      ok(!soltas.length, soltas.length ? `Soltas do Corpo (ficam para trás quando ele mexe): ${soltas.map(p => p.nome).join(', ')}` : 'Tudo pendurado no Corpo');
      // braço = Braço › Antebraço › Mão (Rig.cadeias); perna = Coxa › Canela, com o pé desenhado na canela (esqueleto padrão) ou separado
      const L = Rig.cadeias(dv), br = L.filter(c => c.tipo === 'braco').length;
      const canelas = P.filter(p => /canela|perna de baixo/i.test(p.nome) && porId[p.pai] && /coxa|perna/i.test(porId[p.pai].nome) && porId[p.pai].pai), pe = canelas.length;
      ok(br >= 2 && pe >= 2, `Membros achados: ${br} braço(s), ${pe} perna(s)${br >= 2 && pe >= 2 ? '' : ' (o padrão é 2 e 2: Braço › Antebraço › Mão, Coxa › Canela)'}`);
      const escondidos = [...L.filter(c => c.tipo === 'braco').map(c => porId[c.meio]), ...canelas].filter(p => p && p.base?.vis === false);
      ok(!escondidos.length, escondidos.length ? `Começam escondidos (o braço troca de desenho para dobrar): ${escondidos.map(p => p.nome).join(', ')}` : 'Antebraço e canela visíveis desde a pose padrão');
      const tampas = P.filter(p => /tampa/i.test(p.nome)).length, contornos = P.filter(p => /contorno/i.test(p.nome)).length, juntas = br + pe;
      ok(juntas && tampas >= juntas && contornos >= juntas, `Juntas com Contorno + Tampa: ${Math.min(tampas, contornos)} de ${juntas || 4}`);
      // o pescoço de verdade é o pai da Cabeça; "Contorno do pescoço e ombros" e afins não contam (Lumi, 11/11/2026)
      const cab = P.find(p => /^cabe[çc]a/i.test(p.nome)), paiCab = cab && porId[cab.pai], pescoco = paiCab && /pesco[çc]o/i.test(paiCab.nome) ? paiCab : P.find(p => /^pesco[çc]o$/i.test(p.nome)) || P.find(p => /pesco[çc]o/i.test(p.nome) && !/contorno|ombro/i.test(p.nome));
      ok(pescoco && cab?.pai === pescoco.id, pescoco ? (cab?.pai === pescoco.id ? 'Pescoço › Cabeça' : 'A Cabeça não está presa no Pescoço') : 'Sem Pescoço (a cabeça vai direto no Corpo)');
      const anims = dv.animacoes || [], duras = anims.filter(a => !a.suave);
      ok(!duras.length, anims.length ? (duras.length ? `${duras.length} de ${anims.length} animação(ões) ainda quadro a quadro: ${duras.map(a => a.nome).slice(0, 6).join(', ')}${duras.length > 6 ? '…' : ''}` : `${anims.length} animação(ões) com movimento suave`) : 'Nenhuma animação de teste');
      const png = P.flatMap(p => p.imgs || []).filter(i => /\.png$/i.test(i.k || '')).length;
      ok(!png, png ? `${png} imagem(ns) em PNG (o padrão é só vetor)` : 'Só vetor (0 PNG)');
      // TRAVA DAS JUNTAS (11/11/2026): no perfil, poses com cotovelo/joelho para o lado errado ou dobrando demais (Rig.trava corrige no movimento)
      if (Rig.ehPerfil(dv)) { let ruins = []; try { const olha = Rig.olhaPara(dv, Modelo.partesNoEstado(dv, {})), M = Rig.membrosTrava(dv);
        for (const s of dv.sessoes || []) for (const pr of s.presets || []) { const ids = Object.keys(pr.estado || {}); if (!M.some(c => ids.includes(c.raiz) || ids.includes(c.meio))) continue;
          for (const x of Rig.dobras(dv, Modelo.partesNoEstado(dv, { sessoes: { [s.id]: pr.id } }), olha)) if ((x.errado || x.excesso) && (ids.includes(x.cad.raiz) || ids.includes(x.cad.meio))) ruins.push(`${pr.nome} (${x.tipo === 'braco' ? 'cotovelo' : 'joelho'} ${x.errado ? 'para o lado errado' : 'dobrando demais'})`); } } catch { }
        ok(!ruins.length, ruins.length ? `Poses fora da trava das juntas: ${ruins.slice(0, 6).join(', ')}${ruins.length > 6 ? '…' : ''}` : 'Cotovelos e joelhos dentro da trava'); }
      out.push({ vista: v.nome, itens, falta: itens.filter(x => !x.ok).length });
    }
    return out;
  },
  // liga o movimento suave em todas as animações de todas as vistas
  ligarSuave(def) { let n = 0; for (const a of Modelo.todasAnims ? Modelo.todasAnims(def) : def.animacoes || []) if (!a.suave) { a.suave = true; n++; } return n; },
  async abrir() {
    const def = Atelie.def; if (!def) return; const R = this.conferir(def), total = R.reduce((n, v) => n + v.falta, 0);
    const body = h(`<div class="rive-conf"><div style="color:rgba(255,255,255,.75);margin-bottom:14px">Confere ${esc(def.nome || 'o personagem')} contra a base Rive do Ateliê (igual ao Stick v6 e ao Problems). Nada muda aqui.</div>
      ${R.map(v => `<div class="rive-v"><div class="rive-vt">${esc(v.vista)}<small>${v.falta ? `${v.falta} a arrumar` : 'tudo certo'}</small></div>${v.itens.map(x => `<div class="rive-i ${x.ok ? 'ok' : 'nao'}">${ic(x.ok ? 'check' : 'x', 13)}<span>${esc(x.txt)}</span></div>`).join('')}</div>`).join('') || '<div class="vazio">Sem partes para conferir.</div>'}</div>`);
    const r = await UI.modal({ title: total ? `Rig Rive: ${total} ponto(s) a arrumar` : 'Rig Rive: tudo certo', icon: 'wave', width: 560, body,
      buttons: [{ label: 'Fechar', value: null }, { label: 'Ligar o movimento suave em todas as animações', kind: 'primary', value: 'suave' }] });
    if (r === 'suave') { const n = this.ligarSuave(def); if (n) { Atelie.commit(); Atelie.pinta(); } UI.toast(n ? `Movimento suave ligado em ${n} animação(ões).` : 'Todas as animações já estavam com movimento suave.', { kind: 'ok' }); }
  },
};
document.addEventListener('click', e => { if (e.target.closest?.('#at-rive')) RiveRig.abrir(); });

/* TRANSIÇÕES SUAVES NO ATELIÊ (pedido da dona, 10/11/2026): trocar de animação, dar play, parar ou ir para outro frame não pula mais —
   as peças vão da pose que estava na tela até a nova em ~0,28 s (mesma curva do movimento suave; parte que troca de desenho troca junto
   com as presas nela, no meio, para não abrir vão). Trocar de VISTA (os desenhos são outros) faz uma passagem rápida de uma imagem para
   a outra por cima do palco. Só muda o que aparece na tela: nada disso é gravado no personagem. */
const Transicao = {
  DUR: 280, _tr: null,
  ease: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  // guarda a pose da tela agora (antes de trocar)
  de(antes) { if (!antes || !Atelie.def) return; this._tr = { antes, t0: performance.now(), def: Atelie.def, vista: Atelie.def.vistaAtual }; this.anda(); },
  anda() { cancelAnimationFrame(this._raf); const passo = () => { if (!this._tr) return; try { Atelie.desenha(); } catch { } if (performance.now() - this._tr.t0 < this.DUR) this._raf = requestAnimationFrame(passo); else { this._tr = null; try { Atelie.desenha(); } catch { } } }; this._raf = requestAnimationFrame(passo); },
  misturar(e) {
    const tr = this._tr; if (!tr || !e) return e; const def = Atelie.def;
    if (def !== tr.def || def.vistaAtual !== tr.vista) { this._tr = null; return e; }
    const u = (performance.now() - tr.t0) / this.DUR; if (u >= 1) return e; const t = this.ease(Math.max(0, u)), A = tr.antes, out = {};
    const filhos = {}; for (const p of def.partes) if (p.pai) (filhos[p.pai] ||= []).push(p.id);
    const desc = id => { const L = [id]; for (let i = 0; i < L.length; i++) L.push(...(filhos[L[i]] || [])); return L; };
    const junto = new Set(); for (const pid of Object.keys(e)) if (A[pid] && (A[pid].img || null) !== (e[pid]?.img || null)) desc(pid).forEach(id => junto.add(id));
    for (const [pid, b] of Object.entries(e)) { const a = A[pid];
      if (!a || !b || (a.vis === false) !== (b.vis === false)) { out[pid] = b; continue; }
      const x = { ...(junto.has(pid) && t < .5 ? a : b) };
      for (const c of junto.has(pid) ? ['r'] : ['x', 'y', 'r', 's']) { const va = a[c] ?? (c === 's' ? 1 : 0), vb = b[c] ?? (c === 's' ? 1 : 0); if (va === vb) continue; let d = vb - va; if (c === 'r') d = Rig.norm(d); x[c] = va + d * t; }
      out[pid] = x; }
    return out;
  },
  // passagem de uma vista para a outra: a imagem de antes some devagar por cima do palco
  esmaecer(snap) { const cv = Atelie.cv, pai = cv?.parentElement; if (!snap || !pai) return; snap.style.cssText = 'pointer-events:none;opacity:1;transition:opacity .26s ease-out;z-index:1'; pai.insertBefore(snap, cv.nextSibling); requestAnimationFrame(() => requestAnimationFrame(() => { snap.style.opacity = '0'; })); setTimeout(() => snap.remove(), 420); },
  foto() { const cv = Atelie.cv; if (!cv?.width) return null; try { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; c.getContext('2d').drawImage(cv, 0, 0); return c; } catch { return null; } },
  liga() {
    if (this._ok || typeof Atelie === 'undefined' || typeof Animacoes === 'undefined') return; this._ok = true;
    const est = Atelie.estado; Atelie.estado = function (...x) { return Transicao.misturar(est.apply(this, x)); };
    const agora = () => { try { return Atelie.def && Atelie.cv ? JSON.parse(JSON.stringify(Atelie.estado())) : null; } catch { return null; } };
    for (const nm of ['tocar', 'irPara']) { const f = Animacoes[nm]; Animacoes[nm] = function (...x) { const antes = agora(); const r = f.apply(this, x); Transicao.de(antes); return r; }; }
    const pa = Animacoes.parar; Animacoes.parar = function (quieto) { const tocava = !!this.tocando, antes = tocava && !quieto ? agora() : null; const r = pa.call(this, quieto); if (antes) Transicao.de(antes); return r; };
    if (typeof Linha !== 'undefined' && Linha.parar) { const lp = Linha.parar; Linha.parar = function (...x) { const antes = Animacoes.tocando || Atelie.teste ? agora() : null; const r = lp.apply(this, x); if (antes) Transicao.de(antes); return r; }; } // botão Parar / Esc: volta suave à pose padrão
    const tv = Atelie.trocaVista; if (tv) Atelie.trocaVista = function (...x) { const snap = Transicao.foto(); Transicao._tr = null; const r = tv.apply(this, x); const fim = () => Transicao.esmaecer(snap); if (r?.then) r.then(fim, fim); else fim(); return r; };
  },
};
// os scripts do Ateliê (animacoes.js, linha.js) carregam depois deste: liga quando a página termina de abrir
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => Transicao.liga()); else Transicao.liga();

/* ANIMAÇÃO NOVA = SÓ O EDITOR DE VÍDEO (pedido da dona, 10/11/2026): na animação nova (`P.rive`) o padrão é o modo Vídeo (trilhas e blocos,
   js/premiere.js) e os botões "Animação | Vídeo" somem. O modo Animação (o quadro a quadro, js/folha.js) virou LEGACY: nas animações antigas
   continua como sempre; nas novas só aparece ao entrar num bloco (dois cliques, como abrir uma sequência no Premiere), com o botão
   "Voltar ao vídeo". Não muda o modo guardado das animações antigas (localStorage `animador-tl-modo`). */
const SoVideo = {
  liga() {
    if (this._ok || typeof App === 'undefined' || typeof Folha === 'undefined' || !Folha.setModo) return; this._ok = true;
    const ab = App.abrir; App.abrir = async function (...x) { const r = await ab.apply(this, x); try { SoVideo.aplica(); } catch (e) { console.warn(e); } return r; };
    const pm = Folha.pintaModo; if (pm) Folha.pintaModo = function (...x) { const r = pm.apply(this, x); SoVideo.pinta(); return r; };
    const fe = App.fechar; if (fe) App.fechar = function (...x) { const r = fe.apply(this, x); SoVideo.pinta(); return r; };
  },
  novo() { return !!App.P?.rive; },
  aplica() {
    const K = Folha.CH_MODO || 'animador-tl-modo';
    if (this.novo()) { if (Folha.modo !== 'video') { let antes = null; try { antes = localStorage.getItem(K); } catch { } Folha.setModo('video'); this._voltar = Folha.modo; try { if (antes == null) localStorage.removeItem(K); else localStorage.setItem(K, antes); } catch { } this._forcou = true; } }
    else if (this._forcou) { this._forcou = false; let guardado = 'anim'; try { guardado = localStorage.getItem(K) === 'video' ? 'video' : 'anim'; } catch { } if (Folha.modo !== guardado) Folha.setModo(guardado); }
    this.pinta();
  },
  pinta() {
    const novo = !!(App.P && this.novo()); document.body.classList.toggle('proj-rive', novo); const sw = document.getElementById('tl-modo'); if (!sw) return;
    let b = document.getElementById('tl-volta-video');
    if (!b) { b = h(`<button class="btn sm tl-volta-video" id="tl-volta-video" hidden title="Sair de dentro do bloco e voltar para as trilhas do vídeo">${ic('film', 12)}<span>Voltar ao vídeo</span></button>`); b.onclick = () => { const K = Folha.CH_MODO || 'animador-tl-modo'; let antes = null; try { antes = localStorage.getItem(K); } catch { } Folha.setModo('video'); try { if (antes == null) localStorage.removeItem(K); else localStorage.setItem(K, antes); } catch { } }; sw.after(b); }
    sw.hidden = novo; b.hidden = !(novo && Folha.modo !== 'video');
  },
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => SoVideo.liga()); else SoVideo.liga();
