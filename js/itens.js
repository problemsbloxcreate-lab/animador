/* ===================== itens.js — ITENS DE CENA (gerador + biblioteca) =====================
   Decisão do dono (26/10/2026): objetos soltos (cavalo, caneca, livro, cristal de gelo…) gerados à parte, para pôr DENTRO de um
   cenário (janela Cenários › Itens) ou direto na cena (botão Itens da Mídia). Só movimento: um item é UMA imagem; anima com
   chaves, trêmulo, ondular e Deformar — não é personagem em peças.
   Dois estilos, como os cenários: OFICIAL (pintado azul, SVG com as regras de js/cenoficial.js) e DE REPRESENTAÇÃO (rabiscado,
   PNG pela IA de js/cenarios.js). Os itens nascem no TAMANHO DE UM CENÁRIO 1920×1080 (a mesma escala das camadas dos cenários).
   Biblioteca neste computador: arquivos["itens-cena"] = [{ id, nome, tags, estilo: 'oficial'|'rep', k, tipo: 'svg'|'png', w, h, mini, em, fonte? }]. */
'use strict';
const Itens = {
  CHAVE: 'itens-cena',
  async lista() { try { return (await DB.get('arquivos', this.CHAVE)) || []; } catch { return []; } },
  async grava(l) { await DB.put('arquivos', l, this.CHAVE); },
  async guarda(it) { const l = await this.lista(), i = l.findIndex(x => x.id === it.id); if (i >= 0) l[i] = it; else l.unshift(it); await this.grava(l); return it; },

  SIS_OFICIAL: () => CenOficial.SIS.split('Responda SÓ com um JSON')[0] + `AGORA VOCÊ DESENHA UM ITEM SOLTO (um objeto só), sem parede, sem chão, sem fundo — ele vai ser posto dentro de um cenário depois.
Desenhe no TAMANHO em que ele apareceria num cenário 1920×1080 (um copo tem uns 60 px de altura, uma cadeira ~260, um cavalo ~420, uma árvore ~700), usando coordenadas de 0 a 1000. Mostre a frente e um pouco do lado/topo (o ponto de fuga fica acima e ao centro), com a luz de cima à direita.
Responda SÓ com um JSON (sem texto antes ou depois):
{"nome":"nome curto","tags":["animal","fazenda"],"formas":[ FORMA, ... ]}
De trás para a frente, até ~60 formas.
FORMA = {"f":FIG,"cor":COR,"sombra":true|false,"luz":true|false,"contorno":0..5,"op":0..1}
  FIG: ["ret",x0,y0,x1,y1]  ["red",x0,y0,x1,y1,raio]  ["elipse",x0,y0,x1,y1]  ["poli",x,y,x,y,...]  ["linha",espessura,x,y,x,y,...]  ["curva","M x y C x y x y x y ... Z"]
  COR: "#rrggbb" | ["#cor de cima","#cor de baixo"] | {"h":["#esquerda","#direita"]}
  "sombra" = sombra borrada projetada; "luz" = brilho fino na borda do lado da luz; "contorno" padrão 3 (0 = sem contorno).`,

  /* ---------- gerar ---------- */
  async gerar(estilo, pedido) {
    pedido = String(pedido || '').trim().slice(0, 700); if (!pedido) return null;
    const it = estilo === 'oficial' ? await this.gerarOficial(pedido) : await this.gerarRep(pedido);
    it.mini = await this.miniDe(it); await this.guarda(it); return it;
  },
  async gerarOficial(pedido) {
    const ref = await CenOficial.refImg(), content = [];
    if (ref) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: ref } }, { type: 'text', text: '↑ O PLANETÁRIO DO PROBLEMS: o estilo oficial (copie a luz, as cores e o contorno; não os objetos).' });
    let j = null;
    for (let tent = 0; tent < 2 && !j; tent++) {
      const out = await IA.chama(this.SIS_OFICIAL(), [...content, { type: 'text', text: `ITEM PEDIDO: ${pedido}${tent ? '\n\nA resposta anterior veio quebrada: faça mais simples e responda só o JSON.' : ''}` }], null, { tipo: 'cenario', titulo: 'Desenhando o item oficial' });
      try { const r = CenOficial.limpar({ camadas: [{ nome: 'item', plano: 'meio', formas: IA.json(out).formas }] }); if (r.camadas[0]?.formas?.length) j = { ...IA.json(out), formas: r.camadas[0].formas }; } catch { }
    }
    if (!j) throw new Error('A IA não conseguiu desenhar o item. Tente descrever mais simples.');
    // o desenho vai para o meio do cenário antes da luz ambiente (a luz depende de onde a coisa está na tela)
    const pts = j.formas.flatMap(s => CenOficial.pontos(s.f)), [x0, y0, x1, y1] = CenOficial.caixaDe(pts), dx = 960 - (x0 + x1) / 2, dy = 640 - (y0 + y1) / 2;
    const C = CenOficial.novoCtx(); for (const s of j.formas) CenOficial.forma(C, s);
    C.el = [`<g transform="translate(${CenOficial.f(dx)} ${CenOficial.f(dy)})">${C.el.join('')}</g>`];
    const folga = 30 + (j.formas.some(s => s.sombra) ? 34 : 0), cx = [Math.floor(x0 + dx - folga), Math.floor(y0 + dy - folga), Math.ceil(x1 - x0 + folga * 2), Math.ceil(y1 - y0 + folga * 2)];
    const svg = CenOficial.svg(C, cx).replace('data-cenario="oficial"', 'data-item="oficial"'), b = new Blob([svg], { type: 'image/svg+xml' }), k = await Arq.guardar(b, uid('a') + '.svg'), bm = await Arq.deBlob(b, k); if (bm) Arq.img.set(k, bm);
    const nome = String(j.nome || pedido).replace(/[<>"&]/g, '').slice(0, 40);
    return { id: uid('it'), nome, tags: (Array.isArray(j.tags) ? j.tags : []).map(t => String(t).replace(/[<>"&]/g, '').slice(0, 20)).slice(0, 6), estilo: 'oficial', k, tipo: 'svg', w: cx[2], h: cx[3], em: Date.now(), fonte: j };
  },
  async gerarRep(pedido) {
    const sis = await Cenarios.sistema(), out = await IA.chama(sis, `PEDIDO: um OBJETO SÓ (não um cenário): ${pedido}\nSem fundo, sem parede, sem chão, sem céu. Desenhe no tamanho em que ele apareceria num cenário 1920×1080, perto do meio da tela. Pode ser em várias camadas (partes do objeto).`, null, { tipo: 'cenario', titulo: 'Desenhando o item rabiscado' });
    const { j } = Cenarios.lerJSON(out), r = Cenarios.limpar(j, true); if (!r.cena.camadas.length) throw new Error('A IA não conseguiu desenhar o item. Tente descrever mais simples.');
    const est = await Cenarios.estadoDe({ ...r.cena, ia: true }), ps = est.pecas.filter(p => !p.oculta); if (!ps.length) throw new Error('O item saiu vazio.');
    const x0 = Math.min(...ps.map(p => p.x)), y0 = Math.min(...ps.map(p => p.y)), x1 = Math.max(...ps.map(p => p.x + p.w)), y1 = Math.max(...ps.map(p => p.y + p.h)), f = 12;
    const cv = document.createElement('canvas'); cv.width = Math.ceil(x1 - x0 + f * 2); cv.height = Math.ceil(y1 - y0 + f * 2); const g = cv.getContext('2d');
    for (const p of ps) g.drawImage(p.cv, p.x - x0 + f, p.y - y0 + f, p.w, p.h);
    const b = await Cenarios.blob(cv), k = await Arq.guardar(b, uid('a') + '.png'); Arq.img.set(k, await createImageBitmap(b));
    return { id: uid('it'), nome: (r.cena.nome || pedido).replace(/[<>"&]/g, '').slice(0, 40), tags: ['rabiscado'], estilo: 'rep', k, tipo: 'png', w: cv.width, h: cv.height, em: Date.now() };
  },
  async miniDe(it, lado = 160) {
    await Arq.garantir([it.k]); const bm = Arq.img.get(it.k); if (!bm) return null;
    const cv = document.createElement('canvas'); cv.width = cv.height = lado; const g = cv.getContext('2d'), s = Math.min(lado * .9 / it.w, lado * .9 / it.h);
    g.drawImage(bm, (lado - it.w * s) / 2, (lado - it.h * s) / 2, it.w * s, it.h * s); return cv.toDataURL('image/png');
  },
  // um item como CAMADA de cenário (padrão do cenário, coordenadas 1920×1080)
  camada(it, cx = 960, cy = 640) { return { id: slugCen(it.nome) + '-' + uid('c').slice(-4), nome: it.nome, k: it.k, tipo: it.tipo, w: it.w, h: it.h, cx, cy, s: 1, r: 0 }; },
  // direto na cena: no mesmo tamanho que teria dentro de um cenário posto na cena (mesma conta do CenLib.porNaCena)
  async porNaCena(it) {
    const P = App.P; if (!P) return UI.toast('Abra uma animação primeiro.', { kind: 'err' });
    await Arq.garantir([it.k]); const bm = Arq.img.get(it.k), c = Modelo.camera(P, App.q), z = c.zoom || 1;
    const sCen = Math.max(P.w / z / CenLib.W, P.h / z / CenLib.H) * 1.02, s = round(sCen * it.w / (bm?.width || it.w), 3);
    const n = Modelo.novoNo('imagem', { arq: it.k, nome: it.nome.slice(0, 40), s }); n.chaves[0].s = s; if (it.tipo === 'svg') n.vetor = true; n.item = it.id;
    App.inserir(n, 'Item ' + it.nome); UI.toast(`<b>${esc(it.nome)}</b> entrou na cena. Anime com chaves (mover, girar, tamanho), Trêmulo/Ondular ou Deformar (T).`, { kind: 'ok', time: 6000 });
  },

  /* ---------- janela "Itens de cena" (escolher ou gerar) ---------- */
  // o.titulo, o.botao = texto do botão de usar. Devolve o item escolhido (ou null)
  // ESTILO (decisão do dono): abas Rabiscado | Oficial — mostram os itens daquele estilo E é nele que o "Gerar" desenha.
  // o.estilo = já abre no estilo do cenário (janela Cenários › Pôr um item); senão o último usado (localStorage)
  estiloSalvo() { try { return localStorage.getItem('animador-itens-estilo') === 'oficial' ? 'oficial' : 'rep'; } catch { return 'rep'; } },
  async abrir(o = {}) {
    let l = await this.lista(), filtro = o.estilo || this.estiloSalvo(), busca = '', escolhido = null, api = null;
    const body = h(`<div class="it-j"><div class="it-topo"><span class="it-rot">Estilo</span><div class="it-fil" role="tablist"><button data-f="rep">${ic('pencil', 12)} Rabiscado</button><button data-f="oficial">${ic('brush', 12)} Oficial (pintado azul)</button></div><input type="search" class="it-busca" placeholder="Buscar item…"><span class="sp"></span>
      <button class="btn sm ia" data-g title="Gera no estilo escolhido nas abas">${ic('sparkles', 13)} <span></span></button></div>
      <div class="it-grade"></div><p class="it-dica">Um item é uma imagem só: anima com movimento (chaves, girar, tamanho, Trêmulo, Ondular, Deformar). Dois cliques usa o item; botão direito renomeia ou apaga.</p></div>`);
    const grade = $('.it-grade', body);
    const pinta = () => {
      $$('.it-fil button', body).forEach(x => x.classList.toggle('on', x.dataset.f === filtro)); $('[data-g] span', body).textContent = filtro === 'oficial' ? 'Gerar item oficial…' : 'Gerar item rabiscado…';
      const b = busca.trim().toLowerCase(), L = l.filter(x => x.estilo === filtro && (!b || x.nome.toLowerCase().includes(b) || (x.tags || []).some(t => t.toLowerCase().includes(b))));
      grade.innerHTML = ''; if (!L.length) { grade.appendChild(h(`<div class="it-vazio">${busca ? 'Nada encontrado.' : `Nenhum item ${filtro === 'oficial' ? 'oficial' : 'rabiscado'} ainda. Gere o primeiro no botão aí em cima.`}</div>`)); return; }
      for (const it of L) {
        const c = h(`<div class="it-card ${it.estilo} ${escolhido === it.id ? 'sel' : ''}" tabindex="0" title="${esc(it.nome)}">${it.mini ? `<img src="${it.mini}" alt="">` : '<i></i>'}<b>${esc(it.nome)}</b><small>${it.estilo === 'oficial' ? 'oficial · SVG' : 'rabiscado · PNG'}</small></div>`);
        c.onclick = () => { escolhido = it.id; pinta(); }; c.ondblclick = () => { escolhido = it.id; api?.close(it); };
        c.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [{ head: it.nome },
          { label: 'Renomear…', icon: 'edit', action: async () => { const n = await UI.prompt({ title: 'Nome do item', value: it.nome }); if (!n?.trim()) return; it.nome = n.trim().slice(0, 40); await this.grava(l); pinta(); } },
          { label: 'Baixar a imagem', icon: 'download', action: async () => { const b = await Arq.pegaBlob(it.k); if (b) downloadBlob(b, slugCen(it.nome) + (it.tipo === 'svg' ? '.svg' : '.png')); } }, '-',
          { label: 'Apagar deste computador', icon: 'trash', danger: true, action: async () => { if (!(await UI.confirm({ title: 'Apagar o item?', msg: `"<b>${esc(it.nome)}</b>" sai da biblioteca de itens. Cenários e animações que já usam continuam com ele.`, ok: 'Apagar', danger: true }))) return; l = l.filter(x => x.id !== it.id); await this.grava(l); pinta(); } }]); };
        grade.appendChild(c);
      }
    };
    $('.it-busca', body).oninput = e => { busca = e.target.value; pinta(); };
    $$('.it-fil button', body).forEach(b => b.onclick = () => { filtro = b.dataset.f; try { localStorage.setItem('animador-itens-estilo', filtro); } catch { } pinta(); });
    $$('[data-g]', body).forEach(b => b.onclick = async () => {
      const ofi = filtro === 'oficial', ped = await UI.prompt({ title: ofi ? 'Gerar um item OFICIAL (pintado azul)' : 'Gerar um item RABISCADO', label: 'Descreva o objeto', multiline: true, ia: true, placeholder: 'Ex.: cavalo marrom de crina escura, parado de lado, olhando para a esquerda' });
      if (!ped?.trim()) return;
      try { const it = await this.gerar(filtro, ped); l = await this.lista(); escolhido = it.id; pinta(); UI.toast(`<b>${esc(it.nome)}</b> entrou na biblioteca de itens.`, { kind: 'ok' }); }
      catch (e) { UI.toast('O item não saiu: ' + esc(e.message), { kind: 'err', time: 7000 }); }
    });
    return UI.modal({ title: o.titulo || 'Itens de cena', icon: 'package', width: 860, body, onOpen: a => { api = a; a.el.querySelector('.modal')?.classList.add('it-modal'); pinta(); },
      buttons: [{ label: 'Fechar', value: null }, { label: o.botao || 'Usar este item', kind: 'primary', onClick: () => { const it = l.find(x => x.id === escolhido); if (!it) { UI.toast('Escolha um item (um clique) ou gere um.', { kind: 'warn' }); return false; } return it; } }] });
  },
  // botão da Mídia: escolher/gerar e pôr direto na cena
  async naCena() { const it = await this.abrir({ botao: 'Pôr na cena' }); if (it && typeof it === 'object') await this.porNaCena(it); },
};
