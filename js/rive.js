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
      const pescoco = P.find(p => /pesco[çc]o/i.test(p.nome)), cab = P.find(p => /^cabe[çc]a/i.test(p.nome));
      ok(pescoco && cab?.pai === pescoco.id, pescoco ? (cab?.pai === pescoco.id ? 'Pescoço › Cabeça' : 'A Cabeça não está presa no Pescoço') : 'Sem Pescoço (a cabeça vai direto no Corpo)');
      const anims = dv.animacoes || [], duras = anims.filter(a => !a.suave);
      ok(!duras.length, anims.length ? (duras.length ? `${duras.length} de ${anims.length} animação(ões) ainda quadro a quadro: ${duras.map(a => a.nome).slice(0, 6).join(', ')}${duras.length > 6 ? '…' : ''}` : `${anims.length} animação(ões) com movimento suave`) : 'Nenhuma animação de teste');
      const png = P.flatMap(p => p.imgs || []).filter(i => /\.png$/i.test(i.k || '')).length;
      ok(!png, png ? `${png} imagem(ns) em PNG (o padrão é só vetor)` : 'Só vetor (0 PNG)');
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
