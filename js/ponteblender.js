/* ===================== ponteblender.js — RENDERIZAR CENÁRIO 3D NO BLENDER (13/11/2026) =====================
   Liga o Estúdio a um Blender NESTE computador: a pasta "cenarios" (rua-escola.blend, ginasio.blend, quarto.blend + ponte.py)
   roda LIGAR-PONTE.bat, que deixa um servidor em http://127.0.0.1:8810 (só esta máquina; aceita só o Estúdio e localhost).
   O botão (menu Cenário › "Renderizar cenário 3D (Blender)…"):
     1. lê a CÂMERA do projeto quadro a quadro (Modelo.camera → [x, y, zoom]) no trecho escolhido;
     2. manda para a ponte (POST /render), que renderiza um pedido por vez em segundo plano, direto em vídeo;
     3. acompanha o andamento (GET /trabalho/<id>) e, pronto, baixa fundo.mp4 (+ frente.webm com transparência, pólen da frente)
        e põe com CenarioVideo.adicionar: o fundo NA FRENTE dos cenários 2D que já existem (convenção de cenarios.js/cenlib.js)
        e atrás do resto; a frente no topo. Opções (ligadas por padrão): visual A2 (Efeitos.usarVisual) e luz de borda do EP2 em todo
        personagem que ainda não tem (LuzBorda.liga com LUZ_BORDA). Nada é apagado: as camadas antigas continuam lá (dá para esconder ou apagar à mão).
   A câmera é copiada NA HORA do pedido: mexeu na câmera ou no tempo do trecho, renderiza de novo.
   Por script: await PonteBlender.renderizar({ cenario: 'rua-escola', de: 0, ate: 704, ancora: 'Casa do Problems', escala: 100 })
   (com P: outro projeto, não aberto; salvar: false = não grava no banco; proxy: false = sem a cópia leve) */
'use strict';
const PonteBlender = {
  URL: 'http://127.0.0.1:8810',
  LUZ_BORDA: { dir: 135, cor: [255, 238, 180], largura: 7, suave: 1.6, forca: 0.85, aquece: true }, // a do EP2 (sol de cima à esquerda, quente)

  async api(caminho, o = {}) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), o.espera || 4000);
    try {
      const r = await fetch(this.URL + caminho, { method: o.corpo ? 'POST' : 'GET', signal: ctl.signal, headers: o.corpo ? { 'Content-Type': 'application/json' } : {}, body: o.corpo ? JSON.stringify(o.corpo) : undefined });
      if (o.blob) { if (!r.ok) throw new Error('A ponte não entregou o vídeo (' + r.status + ').'); return await r.blob(); }
      const j = await r.json(); if (!r.ok) throw new Error(j.erro || ('Erro ' + r.status)); return j;
    } finally { clearTimeout(t); }
  },
  async estado() { try { return await this.api('/estado', { espera: 2500 }); } catch { return null; } },

  // câmera do Estúdio no trecho [de, ate] (inclusive) → [[cx, cy, zoom], ...]
  cameraDo(P, de, ate) { const out = []; for (let q = de; q <= ate; q++) { const c = Modelo.camera(P, q); out.push([round(c.x, 2), round(c.y, 2), round(c.zoom || 1, 4)]); } return out; },

  async abrir() {
    const P = App.P; if (!P) return UI.toast('Abra uma animação antes.', { kind: 'warn' });
    let est = typeof Ajudante !== 'undefined' ? await Ajudante.garante('renderizar o cenário 3D', 1) : await this.estado(); if (!est && typeof Ajudante !== 'undefined') return; // AJUDANTE DO BLENDER (js/ajudante.js)
    while (!est) {
      const r = await UI.modal({ title: 'Ligar o Blender', icon: 'film', width: 480, body: `<p>O Estúdio não achou a <b>ponte do Blender</b> neste computador.</p>
        <ol style="margin:8px 0 0 18px;line-height:1.6"><li>Abra a pasta <b>cenarios</b> (a que tem rua-escola.blend, ginasio.blend e quarto.blend).</li>
        <li>Dê dois cliques em <b>LIGAR-PONTE.bat</b> e deixe a janela preta aberta.</li><li>Volte aqui e clique em <b>Tentar de novo</b>.</li></ol>
        <p style="opacity:.7;margin-top:8px">Precisa do Blender 5.1 instalado. O render roda na placa de vídeo deste computador.</p>`,
        buttons: [{ label: 'Cancelar', value: false }, { label: 'Tentar de novo', kind: 'primary', value: true }] });
      if (!r) return; est = await this.estado();
    }
    if (!est.cenarios?.length) return UI.toast('A ponte está ligada, mas não achou nenhum cenário na pasta.', { kind: 'err' });
    const ult = (() => { try { return JSON.parse(localStorage.getItem('ponteBlender') || '{}'); } catch { return {}; } })();
    const fim = Math.max(0, (P.duracao || 1) - 1), q = App.q || 0;
    const body = h(`<div class="pb-form" style="display:grid;gap:10px">
      <label>Cenário<br><select data-c style="width:100%">${est.cenarios.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></label>
      <div data-nota style="opacity:.7;font-size:12px"></div>
      <label data-anc-l>Casa no meio do palco (x=1100)<br><select data-a style="width:100%"></select></label>
      <div style="display:flex;gap:10px"><label style="flex:1">Do quadro<br><input data-de type="number" min="1" max="${fim + 1}" value="${q + 1}" style="width:100%"></label>
        <label style="flex:1">Até o quadro<br><input data-ate type="number" min="1" max="${fim + 1}" value="${fim + 1}" style="width:100%"></label></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn" data-tudo>Animação toda</button><button class="btn" data-daqui>Daqui até o fim</button></div>
      <label>Qualidade<br><select data-e style="width:100%"><option value="100">Final (1920×1080)</option><option value="50">Rascunho (metade, 4× mais rápido)</option></select></label>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-a2 checked> Ligar o visual "Rua 3D (A2)" na animação (cor + vinheta)</label>
      <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-lb checked> Luz de borda nos personagens (igual ao EP2)</label>
      <div data-info style="opacity:.75;font-size:12px"></div></div>`);
    const $c = $('[data-c]', body), $a = $('[data-a]', body), $de = $('[data-de]', body), $ate = $('[data-ate]', body);
    const atualiza = () => {
      const c = est.cenarios.find(x => x.id === $c.value); $('[data-nota]', body).textContent = c?.nota || '';
      $('[data-anc-l]', body).hidden = !c?.ancoras?.length;
      $a.innerHTML = (c?.ancoras || []).map(a => `<option ${a === (ult.ancora || c.ancora_padrao) ? 'selected' : ''}>${esc(a)}</option>`).join('');
      const n = clamp(+$ate.value, 1, fim + 1) - clamp(+$de.value, 1, fim + 1) + 1;
      $('[data-info]', body).textContent = n > 0 ? `${n} quadros (${(n / (P.fps || 24)).toFixed(1)} s). O fundo entra na frente dos cenários 2D que já existem; nada é apagado.` : 'O "até" precisa ser depois do "do".';
    };
    if (ult.cenario && est.cenarios.some(c => c.id === ult.cenario)) $c.value = ult.cenario;
    $c.onchange = atualiza; $de.oninput = $ate.oninput = () => { $('[data-info]', body).textContent = ''; atualiza(); };
    $('[data-tudo]', body).onclick = () => { $de.value = 1; $ate.value = fim + 1; atualiza(); };
    $('[data-daqui]', body).onclick = () => { $de.value = q + 1; $ate.value = fim + 1; atualiza(); };
    atualiza();
    const o = await UI.modal({ title: 'Renderizar cenário 3D (Blender)', icon: 'film', width: 480, body,
      buttons: [{ label: 'Cancelar', value: null }, { label: 'Renderizar', kind: 'primary', collect: () => ({ cenario: $c.value, ancora: $a.value || null, de: clamp(+$de.value, 1, fim + 1) - 1, ate: clamp(+$ate.value, 1, fim + 1) - 1, escala: +$('[data-e]', body).value, a2: $('[data-a2]', body).checked, luzBorda: $('[data-lb]', body).checked }) }] });
    if (!o) return;
    if (o.ate < o.de) return UI.toast('O "até" precisa ser depois do "do".', { kind: 'warn' });
    try { localStorage.setItem('ponteBlender', JSON.stringify({ cenario: o.cenario, ancora: o.ancora })); } catch {}
    try { await this.renderizar(o); } catch (e) { UI.toast(esc(e.message || String(e)), { kind: 'err', time: 8000 }); }
  },

  // pedido + acompanhamento + vídeos no projeto. Devolve os nós criados.
  async renderizar(o) {
    const P = o.P || App.P, idP = P.id, nome = (await this.estado())?.cenarios?.find(c => c.id === o.cenario)?.nome || o.cenario;
    const { id } = await this.api('/render', { corpo: { cenario: o.cenario, ancora: o.ancora, quadros: this.cameraDo(P, o.de, o.ate), w: P.w, h: P.h, fps: P.fps || 24, escala: o.escala || 100 }, espera: 20000 });
    let cancelou = false;
    const t = UI.toast(`<span class="spin-dot"></span> <b>Blender:</b> <span data-pb>na fila…</span> <button class="btn" data-pbx style="margin-left:8px">Cancelar</button>`, { time: 24 * 3600e3 });
    const $txt = $('[data-pb]', t); $('[data-pbx]', t).onclick = () => { cancelou = true; this.api('/cancelar/' + id, { corpo: {} }).catch(() => {}); };
    let p;
    try {
      for (;;) {
        await new Promise(r => setTimeout(r, 1000));
        try { p = await this.api('/trabalho/' + id); } catch { $txt.textContent = 'sem resposta da ponte (a janela preta fechou?)…'; continue; }
        if (p.estado === 'pronto' || p.estado === 'erro' || p.estado === 'cancelado') break;
        if (p.estado === 'fila') { $txt.textContent = `na fila (${(p.na_frente || 0) + 1}º)…`; continue; }
        const pc = p.total ? Math.round(100 * p.feito / p.total) : 0, falta = p.feito > 2 ? Math.round(p.seg / p.feito * (p.total - p.feito)) : null;
        $txt.textContent = `${nome}: ${p.camadas > 1 ? (p.camada === 'frente' ? 'camada da frente' : 'fundo') + ' · ' : ''}${p.feito}/${p.total} quadros (${pc}%)${falta != null ? ` · falta ~${falta >= 90 ? Math.round(falta / 60) + ' min' : falta + ' s'}` : ''}`;
      }
    } finally { t.remove(); }
    if (cancelou || p.estado === 'cancelado') { UI.toast('Render do cenário cancelado.', { kind: 'warn' }); return []; }
    if (p.estado === 'erro') throw new Error('O Blender deu erro: ' + (p.erro || 'sem detalhe'));
    const aberta = !o.P || o.P === App.P;
    if (aberta && App.P?.id !== idP) throw new Error('A animação aberta mudou durante o render. Abra a animação de antes e renderize de novo.');
    const t2 = UI.toast('<span class="spin-dot"></span> Guardando o cenário na animação…', { time: 300000 }), nos = [];
    try {
      const rot = `${nome} · ${o.de + 1}–${o.ate + 1}`;
      const fundo = await this.api(`/arquivo/${id}/fundo.mp4`, { blob: true, espera: 300000 });
      const n = await CenarioVideo.adicionar(new File([fundo], 'fundo.mp4', { type: 'video/mp4' }), { nome: 'Cenário 3D · ' + rot, inicio: o.de, posicao: 'fundo', P, salvar: false, proxy: o.proxy });
      const i0 = P.raiz.indexOf(n); if (i0 >= 0) P.raiz.splice(i0, 1);
      const i = P.raiz.findIndex(x => x.cenario || x.fundoPadrao); if (i >= 0) P.raiz.splice(i, 0, n); else P.raiz.push(n); // na frente dos cenários antigos
      nos.push(n);
      if ((p.arquivos || []).includes('frente.webm')) {
        const fr = await this.api(`/arquivo/${id}/frente.webm`, { blob: true, espera: 300000 });
        nos.push(await CenarioVideo.adicionar(new File([fr], 'frente.webm', { type: 'video/webm' }), { nome: 'Cenário 3D (frente) · ' + rot, inicio: o.de, posicao: 'topo', P, salvar: false, proxy: o.proxy }));
      }
      if (o.a2 && typeof Efeitos !== 'undefined' && Efeitos.usarVisual) Efeitos.usarVisual('a2', P);
      if (o.luzBorda && aberta && typeof LuzBorda !== 'undefined') Modelo.cada(P.raiz, x => { if (x.tipo === 'personagem' && !x.luzBorda?.on) LuzBorda.liga(x, this.LUZ_BORDA); }); // quem já tem luz de borda fica como está
      if (aberta) { App.sel = n.id; App.commit('Cenário 3D do Blender'); await App.salvarJa(); }
      else if (o.salvar !== false) { P.modificado = Date.now(); await DB.put('projetos', JSON.parse(JSON.stringify(P))); }
    } finally { t2.remove(); }
    UI.toast(`<b>${esc(nome)}</b> entrou do quadro ${o.de + 1} ao ${o.ate + 1}${nos.length > 1 ? ' (fundo + camada da frente)' : ''}. Se um cenário 2D antigo aparecer por cima, esconda a camada dele.`, { kind: 'ok', time: 9000 });
    return nos;
  },
};
