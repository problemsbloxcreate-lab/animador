/* ===================== ajudante.js — AJUDANTE DO BLENDER (13/11/2026, pedido da dona) =====================
   O site não enxerga programas instalados (o navegador não deixa). Ele conversa com o AJUDANTE: um servidorzinho que roda DENTRO do
   Blender deste computador, só em http://127.0.0.1:8810 (ajudante/ponte.py). A equipe não precisa saber disso:
   - INSTALAR uma vez: "Instalar ajudante do Blender.cmd" (baixado daqui). Ele acha o Blender, copia o ajudante para uma pasta própria
     (LOCALAPPDATA/EstudioProblems/ajudante; dá para apagar o arquivo baixado) e registra o link estudio-blender:// (só desta conta).
   - NÃO liga com o Windows: quando o Estúdio precisa do Blender, Ajudante.garante() vê se ele responde; se não, liga sozinho pelo link
     (o Chrome pergunta "Abrir?" na primeira vez; marque "Sempre permitir"), espera ele responder e segue. Ele fica escondido e se
     desliga sozinho depois de 3 horas parado. Reiniciou o computador? O Estúdio liga de novo na próxima vez.
   - Nunca instalado / sem Blender: uma janela curta explica em 2 passos, com o botão de baixar. Nada trava: dá para cancelar.
   - Atualiza sozinho: ao ligar, baixa a versão nova dos scripts do site (vale na vez seguinte). */
'use strict';
const Ajudante = {
  URL: 'http://127.0.0.1:8810',
  ARQ: 'ajudante/Instalar ajudante do Blender.cmd',
  async estado(espera = 1500) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), espera);
    try { const r = await fetch(this.URL + '/estado', { cache: 'no-store', signal: ctl.signal }); return r.ok ? await r.json() : null; } catch { return null; } finally { clearTimeout(t); }
  },
  instalado() { try { return localStorage.getItem('ajudante-blender') === '1'; } catch { return false; } },
  marca() { try { localStorage.setItem('ajudante-blender', '1'); } catch { } },
  // pede ao Windows para ligar o ajudante (link registrado pelo instalador); sem o instalador, o navegador não faz nada
  ligar() { const a = document.createElement('a'); a.href = 'estudio-blender://ligar'; a.rel = 'noopener'; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove(); },
  async espera(seg = 30, passo) { const t0 = Date.now(); while (Date.now() - t0 < seg * 1000) { const e = await this.estado(); if (e) { this.marca(); return e; } passo?.(Math.round((Date.now() - t0) / 1000)); await new Promise(ok => setTimeout(ok, 1000)); } return null; },
  async baixar() {
    try { const r = await fetch(this.ARQ, { cache: 'no-store' }); if (!r.ok) throw new Error(r.status); const b = await r.blob();
      const u = URL.createObjectURL(new Blob([b], { type: 'application/octet-stream' })), a = h(`<a download="Instalar ajudante do Blender.cmd" href="${u}"></a>`); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000);
    } catch (e) { UI.toast('Não consegui baixar o instalador agora. Tente de novo em instantes.', { kind: 'err' }); }
  },
  // GARANTE o ajudante ligado (ou devolve null se a pessoa desistir). motivo = o que vai fazer ("converter o .blend", "renderizar"...)
  async garante(motivo = 'usar o Blender', minVersao = 2) {
    let e = await this.estado(); if (e && (e.versao || 0) >= minVersao) { this.marca(); return e; }
    if (e) return this.janela(motivo, true); // ajudante antigo: o instalador atualiza
    // já instalado aqui antes: tenta ligar sozinho primeiro (sem janela)
    if (this.instalado()) { const t = UI.toast('<span class="spin-dot"></span> Ligando o Blender…', { time: 40000 }); this.ligar(); e = await this.espera(25); t.remove(); if (e) return e; }
    return this.janela(motivo);
  },
  async janela(motivo, velho = false) {
    let ok = null;
    const body = h(`<div class="lg-txt aj-j">
      <p>Para <b>${esc(motivo)}</b>, o Estúdio usa o <b>Blender deste computador</b>, pelo <b>ajudante do Blender</b>.${velho ? ' O deste computador é antigo: baixe e rode o instalador de novo.' : ''}</p>
      <ol><li><b>Já instalou o ajudante?</b> Clique em <b>Ligar o Blender</b>. Se o navegador perguntar "Abrir?", marque <i>Sempre permitir</i> e confirme.</li>
      <li><b>Primeira vez neste computador?</b> Clique em <b>Baixar o instalador</b>, dê dois cliques no arquivo baixado e espere aparecer "Pronto". Depois pode apagar o arquivo.</li></ol>
      <p class="aj-obs">Precisa do Blender instalado (blender.org). O ajudante não fica ligado com o Windows: o Estúdio liga quando precisa e ele se desliga sozinho depois.</p>
      <p class="aj-st" hidden></p></div>`);
    const st = $('.aj-st', body), msg = t => { st.hidden = false; st.innerHTML = t; };
    await UI.modal({ title: velho ? 'Atualizar o ajudante do Blender' : 'Ligar o Blender', icon: 'paisagem', width: 500, semMetro: true, body,
      onOpen: a => {
        const [bBaixa, , bLiga] = a.foot.querySelectorAll('.btn');
        const tenta = async () => { bLiga.disabled = true; msg('<span class="spin-dot"></span> Ligando o Blender…'); this.ligar(); const e = await this.espera(25, s => msg(`<span class="spin-dot"></span> Ligando o Blender… ${s} s`)); bLiga.disabled = false;
          if (e && (e.versao || 0) >= 2) { ok = e; a.close(); } else msg('O Blender não respondeu. Se ainda não instalou o ajudante, clique em <b>Baixar o instalador</b>; depois de instalar, ele liga sozinho.'); };
        bLiga.onclick = e => { e.preventDefault(); tenta(); };
        bBaixa.onclick = async e => { e.preventDefault(); await this.baixar(); msg('Instalador baixado. Dê dois cliques nele (na barra de downloads do navegador). Quando aparecer "Pronto", o Estúdio segue sozinho…');
          const r = await this.espera(180); if (r) { ok = r; a.close(); } };
      },
      buttons: [{ label: 'Baixar o instalador', icon: 'download', left: true, onClick: () => false }, { label: 'Cancelar', value: null }, { label: 'Ligar o Blender', kind: 'primary', onClick: () => false }] });
    if (ok) UI.toast('Blender ligado ✓', { kind: 'ok', time: 2500 });
    return ok;
  },
};
