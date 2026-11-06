/* ===================== redes.js — MODELOS DE SHORTS / TIKTOK / REELS sobre a câmera =====================
   Pedido do dono (05/11/2026): no modo Câmera, três botões ao lado da Mídia mostram por cima do vídeo um modelo FALSO da tela
   de cada app (ícones da direita, canal, título, som, contagens, barra de baixo), para conferir se nada importante fica
   escondido. Só aparece quando um dos botões está ligado; nunca vai para o vídeo exportado (é desenhado só no palco).
   As posições são uma adaptação, em uma tela de 1080 de largura, das telas dos apps e dos guias de "safe zone"
   (topo ~250 px, coluna da direita ~150–180 px, faixa de baixo ~350–670 px) — os apps mudam de vez em quando.
   Clique direito num dos botões: título, nome do canal, @ e foto (ficam neste navegador). */
'use strict';
const Redes = {
  ativo: null, // 'shorts' | 'tiktok' | 'reels' | null
  K: 'animador-redes-modelo',
  cfg() { let c = {}; try { c = JSON.parse(localStorage.getItem(this.K) || '{}') || {}; } catch { } return { titulo: '', canal: 'Problems', arroba: 'problems', foto: '', ...c }; },
  salvaCfg(c) { try { localStorage.setItem(this.K, JSON.stringify(c)); } catch { UI.toast('Não consegui guardar (a foto é grande demais?).', { kind: 'warn' }); } this._img = null; App.pinta(); },
  NOMES: { shorts: 'YouTube Shorts', tiktok: 'TikTok', reels: 'Instagram Reels' },
  // ícones dos botões (desenhos simples, não os logos)
  BT: {
    shorts: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="2.5" width="16" height="19" rx="5" fill="#ff0033"/><path d="M10 8.5v7l6-3.5z" fill="#fff"/></svg>',
    tiktok: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" fill="none" stroke="#25f4ee" stroke-width="2.6" stroke-linecap="round" transform="translate(-1 -.6)"/><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" fill="none" stroke="#fe2c55" stroke-width="2.6" stroke-linecap="round" transform="translate(1 .6)"/><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.2 4.3 5 4.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>',
    reels: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="rdg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".45" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="url(#rdg)" stroke-width="2.2"/><path d="M2.5 8.5h19M8 2.8l3 5.6M14 2.8l3 5.6" stroke="url(#rdg)" stroke-width="2"/><path d="M10 12v5.5l4.8-2.75z" fill="url(#rdg)"/></svg>',
  },
  // ---------- botões no cabeçalho da Mídia (só no modo Câmera) ----------
  pintaBotoes() {
    const cab = $('#midia-cab'); if (!cab) return; let g = $('.redes-bts', cab);
    if (!g) { g = h('<span class="redes-bts" role="group" aria-label="Modelos de Shorts, TikTok e Reels"></span>'); const ref = $('h3', cab); (ref?.nextElementSibling || ref)?.after(g);
      for (const k of ['shorts', 'tiktok', 'reels']) { const b = h(`<button class="ibtn" data-rede="${k}" title="Ver como fica no ${this.NOMES[k]} (modelo de mentira por cima da câmera) · clique direito: título, canal e foto">${this.BT[k]}</button>`);
        b.onclick = () => { this.ativo = this.ativo === k ? null : k; this.pintaBotoes(); App.pinta(); };
        b.oncontextmenu = ev => { ev.preventDefault(); this.configurar(); }; g.appendChild(b); } }
    const cam = App.modoVista === 'camera'; g.hidden = !cam;
    $$('[data-rede]', g).forEach(b => b.classList.toggle('on', b.dataset.rede === this.ativo));
  },
  async configurar() {
    const c = this.cfg(), body = h(`<div class="redes-cfg"><label>Título (vazio = o nome da animação)<input type="text" data-c="titulo" maxlength="140"></label>
      <label>Nome do canal<input type="text" data-c="canal" maxlength="40"></label><label>@ do canal<input type="text" data-c="arroba" maxlength="40"></label>
      <div class="redes-foto"><span class="rf-av"></span><button class="btn sm" data-foto>${ic('image', 13)} Foto do canal…</button><button class="btn sm ghost" data-semfoto>Sem foto</button></div></div>`);
    for (const i of $$('[data-c]', body)) i.value = c[i.dataset.c] || ''; let foto = c.foto;
    const pf = () => { $('.rf-av', body).style.backgroundImage = foto ? `url("${foto}")` : ''; $('.rf-av', body).innerHTML = foto ? '' : '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="20" fill="#c7c9cc"/><circle cx="20" cy="16.4" r="7.2" fill="#f2f3f4"/><ellipse cx="20" cy="36.4" rx="13.6" ry="11.6" fill="#f2f3f4"/></svg>'; }; pf();
    $('[data-semfoto]', body).onclick = () => { foto = ''; pf(); };
    $('[data-foto]', body).onclick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { const f = i.files?.[0]; if (!f) return;
      const bm = await createImageBitmap(f), cv = new OffscreenCanvas(160, 160), x = cv.getContext('2d'), s = Math.min(bm.width, bm.height); x.drawImage(bm, (bm.width - s) / 2, (bm.height - s) / 2, s, s, 0, 0, 160, 160);
      const bl = await cv.convertToBlob({ type: 'image/jpeg', quality: .85 }); foto = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(bl); }); pf(); }; i.click(); };
    const v = await UI.modal({ title: 'Modelos de Shorts, TikTok e Reels', icon: 'film', width: 420, body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Usar', kind: 'primary', value: true }] });
    if (!v) return; const n = { ...c, foto }; for (const i of $$('[data-c]', body)) n[i.dataset.c] = i.value.trim(); n.arroba = n.arroba.replace(/^@+/, ''); this.salvaCfg(n);
  },
  // ---------- desenho: SVG (1080 de largura × a altura da animação na mesma escala) virando imagem, guardada até algo mudar ----------
  // A BARRA DE BAIXO (preta, ~150 px) fica EMBAIXO do vídeo, como no celular: ela não cobre nada (pedido da dona, 06/11/2026).
  // O palco reserva esse espaço (App.desenhaPalco) e o modelo é desenhado no vídeo + barra. Só em vídeo em pé.
  barra(P) { return this.ativo && P && P.w / P.h <= .6 ? P.w * 150 / 1080 : 0; },
  desenha(ctx, x, y, w, h, hb = 0) {
    if (!this.ativo || !App.P) return; h += hb; const c = this.cfg(), tit = c.titulo || App.P.nome || 'Título do vídeo', H = Math.round(1080 * h / w);
    const chave = [this.ativo, H, tit, c.canal, c.arroba, c.foto.length, c.foto.slice(-40)].join('|');
    if (this._chave !== chave) { this._chave = chave; this._img = null; const img = new Image(); img.onload = () => { if (this._chave === chave) { this._img = img; App.pinta(); } };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(this.svg(this.ativo, H, tit, c)); }
    if (this._img) ctx.drawImage(this._img, x, y, w, h);
    if (w / h > .6) { ctx.save(); ctx.fillStyle = 'rgba(255,200,60,.95)'; ctx.font = `600 ${Math.max(11, w * .018)}px Segoe UI`; ctx.fillText('Este modelo é para vídeo em pé (9:16)', x + 8, y + h - 8); ctx.restore(); }
  },
  // ícones de linha (24×24), em branco com sombra, como nos apps
  P: {
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    heartF: '<path fill="#fff" d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    coment: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    comentF: '<path fill="#fff" d="M12 3c5.2 0 9.5 3.6 9.5 8.2S17.2 19.4 12 19.4c-1 0-2-.1-2.9-.4L4.5 21.5l1-4.2C3.6 15.8 2.5 13.6 2.5 11.2 2.5 6.6 6.8 3 12 3z"/><circle cx="7.6" cy="11.2" r="1.3" fill="#222"/><circle cx="12" cy="11.2" r="1.3" fill="#222"/><circle cx="16.4" cy="11.2" r="1.3" fill="#222"/>',
    salvarF: '<path fill="#fff" d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
    compartF: '<path fill="#fff" d="M13.5 4.5 22 12l-8.5 7.5v-4.3C7.6 15.2 4.3 17 2 20.5 2.8 14 6.3 9.6 13.5 8.8z"/>',
    aviao: '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    joia: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
    remix: '<path d="m2 9 3-3 3 3"/><path d="M13 18H7a2 2 0 0 1-2-2V6"/><path d="m22 15-3 3-3-3"/><path d="M11 6h6a2 2 0 0 1 2 2v10"/>',
    compart: '<path d="M14 5l7 7-7 7"/><path d="M21 12H9a6 6 0 0 0-6 6v2"/>',
    busca: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.6-4.6"/>',
    pontosV: '<circle cx="12" cy="5" r="1.6" fill="#fff"/><circle cx="12" cy="12" r="1.6" fill="#fff"/><circle cx="12" cy="19" r="1.6" fill="#fff"/>',
    pontosH: '<circle cx="5" cy="12" r="1.6" fill="#fff"/><circle cx="12" cy="12" r="1.6" fill="#fff"/><circle cx="19" cy="12" r="1.6" fill="#fff"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3.5"/>',
    casa: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    amigos: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2a5 5 0 0 1 5.5 5.3"/>',
    caixa: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    mais: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/>',
    shortsNav: '<rect x="6" y="3" width="12" height="18" rx="4"/><path d="M10.5 9.5v5l4-2.5z" fill="#fff"/>',
    inscr: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M10.5 10v5l4-2.5z" fill="#fff"/><path d="M6 3h12"/>',
    voce: '<rect x="3" y="3" width="18" height="18" rx="9"/><path d="M8 15c1 1.3 2.4 2 4 2s3-.7 4-2"/>',
    lupa: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.6-4.6"/>',
    reelsNav: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M3 8.5h18M8.5 3.3l3 5.2M14.5 3.3l3 5.2"/><path d="M10 12v5.5l4.8-2.75z" fill="#fff"/>',
    sacola: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    nota: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    vivo: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M8 10v4h2M12 10v4M14.5 10l1.2 4 1.3-4" stroke-width="1.6"/>',
  },
  // sem foto: a pessoa genérica em fundo cinza (como nas redes quando a conta não tem foto)
  semFoto(x, y, r) { const id = 'sf' + Math.round(x) + '_' + Math.round(y); return `<clipPath id="${id}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><circle cx="${x}" cy="${y}" r="${r}" fill="#c7c9cc"/><g clip-path="url(#${id})" fill="#f2f3f4"><circle cx="${x}" cy="${y - r * .18}" r="${r * .36}"/><ellipse cx="${x}" cy="${y + r * .82}" rx="${r * .68}" ry="${r * .58}"/></g><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="3"/>`; },
  svg(plat, H, tit, c) {
    const e = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
    const I = (n, x, y, s = 64, sw = 2) => `<g transform="translate(${x - s / 2} ${y - s / 2}) scale(${s / 24})" fill="none" stroke="#fff" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" filter="url(#sb)">${this.P[n]}</g>`;
    const T = (x, y, t, o = {}) => `<text x="${x}" y="${y}" font-size="${o.s || 30}" font-weight="${o.w || 500}" fill="${o.c || '#fff'}" text-anchor="${o.a || 'start'}" filter="url(#sb)">${e(t)}</text>`;
    const av = (x, y, r) => c.foto ? `<clipPath id="ca"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath><image href="${c.foto}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#ca)" preserveAspectRatio="xMidYMid slice"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="3"/>`
      : this.semFoto(x, y, r);
    // quebra o título em até 2 linhas de ~n letras
    const linhas = (t, n) => { const ws = String(t).split(/\s+/), L = ['']; for (const w of ws) { if ((L[L.length - 1] + ' ' + w).trim().length > n && L[L.length - 1]) { if (L.length === 2) { L[1] = L[1].replace(/\s*\S*$/, '') + '…'; break; } L.push(''); } L[L.length - 1] = (L[L.length - 1] + ' ' + w).trim(); } return L; };
    const nav = (ics, ativo, y) => `<rect x="0" y="${y}" width="1080" height="${H - y}" fill="#000"/>` + ics.map((n, i) => { const x = 108 + i * 216; return n === 'maisTT'
      ? `<g transform="translate(${x - 52} ${y + 30})"><rect x="0" y="0" width="104" height="64" rx="16" fill="#25f4ee"/><rect x="8" y="0" width="104" height="64" rx="16" fill="#fe2c55"/><rect x="4" y="0" width="104" height="64" rx="16" fill="#fff"/><path d="M56 16v32M40 32h32" stroke="#000" stroke-width="6" stroke-linecap="round"/></g>`
      : I(n, x, y + 62, 58, i === ativo ? 2.4 : 1.8); }).join('');
    const bx = `<linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 ${H}" width="1080" height="${H}" font-family="Roboto,'Segoe UI',Arial,sans-serif"><defs>${bx}<filter id="sb" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-opacity=".55"/></filter></defs>`;
    s += `<rect x="0" y="${H - 900}" width="1080" height="900" fill="url(#gb)"/>`;
    const NB = H - 150; // faixa de navegação de baixo (~150 px) nos três
    if (plat === 'shorts') {
      s += I('busca', 880, 110, 58) + I('pontosV', 1010, 110, 58);
      // 2026: o Shorts trocou o joinha por um CORAÇÃO e tirou o 'Não gostei' (testes desde junho, mais amplo em julho)
      const col = [['heartF', '48 mil'], ['comentF', '1,2 mil'], ['compartF', 'Compartilhar'], ['remix', 'Remix']]; let y = NB - 840;
      for (const [n, t] of col) { s += n === 'joiaB' ? `<g transform="translate(0 ${2 * y - 16}) scale(1 -1)">${I('joia', 1000, y - 8, 64)}</g>` : I(n, 1000, y, 64); s += T(1000, y + 66, t, { s: t.length > 9 ? 22 : 26, a: 'middle', w: 500 }); y += 168; }
      s += `<rect x="962" y="${NB - 200}" width="76" height="76" rx="14" fill="#444" stroke="#fff" stroke-width="3"/>` + I('nota', 1000, NB - 162, 40);
      const yc = NB - 300; s += av(76, yc, 38) + T(130, yc + 11, '@' + (c.arroba || 'canal'), { s: 32, w: 600 }) + `<rect x="${150 + (('@' + c.arroba).length * 17)}" y="${yc - 34}" width="210" height="68" rx="34" fill="#fff"/>` + T(255 + (('@' + c.arroba).length * 17), yc + 11, 'Inscrever-se', { s: 28, w: 700, c: '#0f0f0f', a: 'middle' });
      linhas(tit, 40).forEach((l, i) => { s += T(40, yc + 82 + i * 42, l, { s: 32, w: 500 }); });
      s += I('nota', 56, NB - 70, 30) + T(84, NB - 60, `${c.canal} · Som original`, { s: 26 });
      s += `<rect x="0" y="${NB - 6}" width="1080" height="6" fill="rgba(255,255,255,.35)"/><rect x="0" y="${NB - 6}" width="380" height="6" fill="#ff0033"/>`;
      s += nav(['casa', 'shortsNav', 'mais', 'inscr', 'voce'], 1, NB);
    } else if (plat === 'tiktok') {
      s += I('vivo', 70, 120, 60, 1.8) + T(430, 132, 'Seguindo', { s: 36, w: 600, c: 'rgba(255,255,255,.7)', a: 'middle' }) + T(650, 132, 'Para você', { s: 36, w: 700, a: 'middle' }) + `<rect x="615" y="152" width="70" height="6" rx="3" fill="#fff"/>` + I('busca', 1010, 120, 60);
      const ya = NB - 1010; s += av(990, ya, 50) + `<circle cx="990" cy="${ya + 50}" r="20" fill="#fe2c55"/><path d="M990 ${ya + 40}v20M980 ${ya + 50}h20" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`;
      const col = [['heartF', '128,4 mil'], ['comentF', '2.311'], ['salvarF', '9.876'], ['compartF', '4.512']]; let y = ya + 165;
      for (const [n, t] of col) { s += I(n, 990, y, 78) + T(990, y + 72, t, { s: 26, a: 'middle', w: 600 }); y += 168; }
      s += `<circle cx="990" cy="${NB - 85}" r="46" fill="#222" stroke="#555" stroke-width="14"/>` + (c.foto ? `<clipPath id="cd"><circle cx="990" cy="${NB - 85}" r="22"/></clipPath><image href="${c.foto}" x="968" y="${NB - 107}" width="44" height="44" clip-path="url(#cd)"/>` : `<circle cx="990" cy="${NB - 85}" r="22" fill="#c7c9cc"/>`);
      s += T(40, NB - 250, c.canal || 'canal', { s: 36, w: 700 });
      linhas(tit + '  #animação #humor', 44).forEach((l, i) => { s += T(40, NB - 195 + i * 44, l, { s: 32, w: 400 }); });
      s += I('nota', 56, NB - 70, 30) + T(84, NB - 60, `som original - ${c.canal}`, { s: 28 });
      s += nav(['casa', 'amigos', 'maisTT', 'caixa', 'perfil'], 0, NB);
    } else { // reels
      s += T(40, 132, 'Reels', { s: 50, w: 700 }) + `<path d="M190 104l14 14 14-14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" filter="url(#sb)"/>` + I('camera', 1010, 116, 62);
      // botão de REPOSTAR (2025) entre comentar e compartilhar
      const col = [['heart', '48,2 mil'], ['coment', '1.204'], ['remix', '612'], ['aviao', '3.118']]; let y = NB - 900;
      for (const [n, t] of col) { s += I(n, 1000, y, 68) + T(1000, y + 68, t, { s: 26, a: 'middle', w: 600 }); y += 160; }
      s += I('pontosH', 1000, y - 10, 60); s += `<rect x="964" y="${NB - 150}" width="72" height="72" rx="14" fill="#444" stroke="#fff" stroke-width="3"/>`;
      const yc = NB - 290; s += av(74, yc, 36) + T(126, yc + 11, c.arroba || 'canal', { s: 30, w: 700 }) + `<rect x="${144 + (c.arroba || 'canal').length * 17}" y="${yc - 28}" width="130" height="56" rx="12" fill="none" stroke="#fff" stroke-width="2.5"/>` + T(209 + (c.arroba || 'canal').length * 17, yc + 10, 'Seguir', { s: 28, w: 600, a: 'middle' });
      linhas(tit, 46).forEach((l, i) => { s += T(40, yc + 76 + i * 40, l, { s: 30, w: 400 }); });
      s += I('nota', 56, NB - 46, 28) + T(84, NB - 36, `${c.arroba} · Áudio original`, { s: 26 });
      s += nav(['casa', 'reelsNav', 'aviao', 'lupa', 'perfil'], 1, NB); // barra nova: Início, Reels, Mensagens, Busca, Perfil (sem o + no meio)
    }
    return s + '</svg>';
  },
};
