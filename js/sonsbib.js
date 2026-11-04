/* ===================== sonsbib.js — SONS DA EQUIPE: a biblioteca (repositório estudio-biblioteca) dentro do Animador =====================
   Lida pelo /nuvem/ do porteiro (login do Google, sem senha): indice.json (pk.ev = [caminho, nome, pasta, é música]) e a/<sha1 de "pk:<caminho>">.
   Janela com busca e pastas: ▶ ouve, "Pôr" põe no quadro atual (efeito como "efeito"; música como "música" com fade).
   O tempo do vídeo NUNCA aumenta: o som que passaria do fim é cortado no último quadro. */
'use strict';
const SonsBib = {
  ix: null, blobs: new Map(), fonte: null, abertas: new Set(),
  sem: x => String(x || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(),
  async indice() {
    if (this.ix) return this.ix;
    const r = await fetch('/nuvem/bib/arq?p=indice.json', { cache: 'no-store' }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error?.message || 'a biblioteca de sons respondeu ' + r.status);
    const j = await r.json();
    this.ix = (j.pk?.ev || []).map(e => ({ rel: e[0], nome: e[1], pasta: e[2], mus: !!e[3], busca: this.sem(e[1] + ' ' + e[2]) }));
    return this.ix;
  },
  async blob(it) {
    if (this.blobs.has(it.rel)) return this.blobs.get(it.rel);
    const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode('pk:' + it.rel)), hx = [...new Uint8Array(d)].map(x => x.toString(16).padStart(2, '0')).join('');
    const r = await fetch('/nuvem/bib/arq?p=a/' + hx); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error?.message || 'o som não veio (' + r.status + ')');
    const b = await r.blob(); this.blobs.set(it.rel, b); return b;
  },
  parar() { try { this.fonte?.stop(); } catch { } this.fonte = null; $$('.sb-it.tocando').forEach(x => x.classList.remove('tocando')); },
  async ouvir(it, linha) {
    const era = linha.classList.contains('tocando'); this.parar(); if (era) return;
    try {
      const ac = Som.ac(); await ac.resume(); const buf = await ac.decodeAudioData(await (await this.blob(it)).arrayBuffer());
      const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.onended = () => { if (this.fonte === src) this.parar(); };
      src.start(); this.fonte = src; linha.classList.add('tocando');
    } catch (e) { UI.toast('Não deu para ouvir: ' + esc(e.message || e), { kind: 'err' }); }
  },
  // põe no quadro atual, sem mudar a duração do vídeo
  async por(it) {
    const P = App.P, q = App.q, fps = P.fps;
    if (q >= P.duracao - 1) return UI.toast('O quadro atual é o último do vídeo: escolha um quadro antes.', { kind: 'warn' });
    try {
      const arq = await Arq.guardar(await this.blob(it)), b = await Som.decod(arq); if (!b) throw new Error('o áudio não abriu');
      const cabe = (P.duracao - q) / fps, a = { id: uid('au'), nome: it.nome.slice(0, 50), arq, de: q, vol: it.mus ? .5 : 1, tipo: it.mus ? 'musica' : 'efeito' };
      if (b.duration > cabe) a.dur = +cabe.toFixed(3);
      if (it.mus) { a.fi = .5; a.fo = Math.min(2, (a.dur ?? b.duration) / 3); }
      P.audios.push(a); App.commit('Pôr som da biblioteca'); Lado.aba('som');
      UI.toast(`<b>${esc(a.nome)}</b> entrou no quadro ${q + 1}${a.dur != null ? ' (cortado no fim do vídeo)' : ''}.`, { kind: 'ok' });
    } catch (e) { UI.toast('Não deu para pôr o som: ' + esc(e.message || e), { kind: 'err' }); }
  },
  async abrir() {
    const body = h(`<div class="sb"><div class="sb-topo"><label class="sb-busca">${ic('search', 14)}<input type="search" placeholder="Buscar (ex.: vitória, pulo, Mario, suspense)"></label></div>
      <div class="sb-info">Entra no quadro <b>${App.q + 1}</b>. ▶ ouve · <b>Pôr</b> põe no vídeo. Música entra como música (abaixa na fala), com fade.</div><div class="sb-lista"><div class="vazio"><span class="spin-dot"></span> Carregando os sons da equipe…</div></div></div>`);
    const lista = $('.sb-lista', body), busca = $('input', body);
    UI.modal({ title: 'Sons da equipe', icon: 'music', width: 620, body, buttons: [{ label: 'Fechar', value: null }] }).then(() => this.parar());
    let ix; try { ix = await this.indice(); } catch (e) { lista.innerHTML = `<div class="vazio">Não consegui abrir a biblioteca: ${esc(e.message || e)}</div>`; return; }
    const linha = it => {
      const l = h(`<div class="sb-it ${it.mus ? 'mus' : ''}"><button class="ibtn" data-o title="Ouvir">${ic('play', 13)}</button><span title="${esc(it.pasta)}">${esc(it.nome)}</span><button class="btn sm" data-p>${ic('plus', 12)} Pôr</button></div>`);
      $('[data-o]', l).onclick = () => this.ouvir(it, l); $('[data-p]', l).onclick = () => this.por(it); return l;
    };
    const pastas = [...new Set(ix.map(i => i.pasta))].sort((x, y) => (/^M[UÚ]SICA/.test(y) - /^M[UÚ]SICA/.test(x)) || (/^JOGO/.test(y) - /^JOGO/.test(x)) || x.localeCompare(y, 'pt'));
    const pinta = () => {
      this.parar(); lista.innerHTML = ''; const t = this.sem(busca.value.trim());
      if (t) { const ps = t.split(/\s+/), achou = ix.filter(i => ps.every(p => i.busca.includes(p)));
        if (!achou.length) return lista.appendChild(h('<div class="vazio">Nada com esse nome.</div>'));
        achou.slice(0, 200).forEach(i => lista.appendChild(linha(i)));
        if (achou.length > 200) lista.appendChild(h(`<div class="vazio">Mais ${achou.length - 200}: escreva mais palavras.</div>`)); return; }
      for (const p of pastas) {
        const dentro = ix.filter(i => i.pasta === p), ab = this.abertas.has(p);
        const cab = h(`<div class="sb-pasta">${ic(ab ? 'down' : 'right', 12)}${ic(/^M[UÚ]SICA/.test(p) ? 'music' : 'folder', 14)}<b>${esc(p)}</b><small>${dentro.length}</small></div>`);
        cab.onclick = () => { ab ? this.abertas.delete(p) : this.abertas.add(p); pinta(); }; lista.appendChild(cab);
        if (ab) { dentro.slice(0, 400).forEach(i => lista.appendChild(linha(i))); if (dentro.length > 400) lista.appendChild(h(`<div class="vazio">Mais ${dentro.length - 400} nesta pasta: use a busca.</div>`)); }
      }
    };
    let tm; busca.oninput = () => { clearTimeout(tm); tm = setTimeout(pinta, 200); }; pinta(); busca.focus();
  },
};
(() => { const st = document.createElement('style'); st.textContent = `.sb{display:grid;gap:8px}.sb-busca{display:flex;width:100%;box-sizing:border-box;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--bd);border-radius:8px;background:var(--bg1)}.sb-busca input{flex:1;min-width:0;width:auto;border:0;background:none;color:inherit;outline:0;font:inherit}
.sb-info{color:var(--tx3);font-size:12px}.sb-lista{max-height:min(60vh,520px);overflow:auto;display:grid;gap:2px;align-content:start}
.sb-pasta{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;cursor:pointer;background:var(--bg1)}.sb-pasta:hover{filter:brightness(1.15)}.sb-pasta small{margin-left:auto;color:var(--tx3)}
.sb-it{display:flex;align-items:center;gap:6px;padding:2px 4px 2px 18px;border-radius:6px}.sb-it:hover{background:var(--bg1)}.sb-it span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}
.sb-it.mus span{color:#9fb7ff}.sb-it.tocando{background:var(--bg1);outline:1px solid #ffd27a}`; document.head.appendChild(st); })();
