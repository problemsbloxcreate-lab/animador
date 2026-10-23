/* ===================== difrasc.js — DIFERENÇAS entre o rascunho deste computador e a versão da nuvem =====================
   Na janela "Tem um rascunho neste computador", o botão "Ver as diferenças" abre uma lista com SÓ o que é diferente:
   nome/pasta/fps, vistas, partes (novas, que saíram, posição/ajustes), imagens de cada parte (lado a lado: nuvem × rascunho),
   poses (sessões e presets) e animações de teste. Passar o mouse numa miniatura mostra a imagem grande ao lado. Nada muda aqui:
   é só para ver com calma antes de escolher. */
'use strict';
const DifRasc = {
  // ---------- o que mudou ----------
  lista(nuvem, rasc) {
    const out = [], J = o => JSON.stringify(o ?? null), porId = L => new Map((L || []).map(x => [x.id, x]));
    const poe = (grupo, tipo, txt, a, b) => out.push({ grupo, tipo, txt, a, b }); // tipo: novo (só no rascunho) | saiu (só na nuvem) | mudou
    if (nuvem.nome !== rasc.nome) poe('Personagem', 'mudou', `Nome: "${nuvem.nome}" → "${rasc.nome}"`);
    if ((nuvem.pasta || '') !== (rasc.pasta || '')) poe('Personagem', 'mudou', `Pasta: "${nuvem.pasta || 'Personagens'}" → "${rasc.pasta || 'Personagens'}"`);
    if (Modelo.fpsDe?.(nuvem) !== Modelo.fpsDe?.(rasc)) poe('Personagem', 'mudou', `FPS: ${Modelo.fpsDe(nuvem)} → ${Modelo.fpsDe(rasc)}`);
    if ((nuvem.icone || '') !== (rasc.icone || '') && (nuvem.icone || rasc.icone)) poe('Personagem', 'mudou', 'Ícone do personagem', { url: nuvem.icone }, { url: rasc.icone });
    const vn = porId(nuvem.vistas), vr = porId(rasc.vistas), ids = [...new Set([...vn.keys(), ...vr.keys()])];
    const varias = ids.length > 1;
    for (const vid of ids.length ? ids : [null]) {
      const A = vn.has(vid) || !vid ? Modelo.naVista(nuvem, vid) : null, B = vr.has(vid) || !vid ? Modelo.naVista(rasc, vid) : null;
      const nomeV = (vr.get(vid) || vn.get(vid))?.nome || 'Vista', g = s => varias ? `${nomeV} › ${s}` : s;
      if (!A) { poe(g('Vistas'), 'novo', `Vista "${nomeV}"`); continue; } if (!B) { poe(g('Vistas'), 'saiu', `Vista "${nomeV}"`); continue; }
      const pa = porId(A.partes), pb = porId(B.partes);
      const capa = p => { const i = (p?.imgs || []).find(x => x.id === p.base?.img) || p?.imgs?.[0]; return i?.k ? { k: i.k } : null; };
      for (const id of new Set([...pa.keys(), ...pb.keys()])) {
        const x = pa.get(id), y = pb.get(id), nome = (y || x).nome || 'Parte';
        if (!x) { poe(g('Partes'), 'novo', `Parte "${nome}" (${(y.imgs || []).length} imagens)`, null, capa(y)); continue; }
        if (!y) { poe(g('Partes'), 'saiu', `Parte "${nome}"`, capa(x), null); continue; }
        if (x.nome !== y.nome) poe(g('Partes'), 'mudou', `Parte "${x.nome}" virou "${y.nome}"`);
        const sem = p => { const c = { ...p }; delete c.imgs; delete c.nome; return c; };
        if (J(sem(x)) !== J(sem(y))) poe(g('Partes'), 'mudou', `"${nome}": posição, profundidade ou ajustes`, capa(x), capa(y));
        const ia = porId(x.imgs), ib = porId(y.imgs);
        for (const iid of new Set([...ia.keys(), ...ib.keys()])) {
          const u = ia.get(iid), v = ib.get(iid), n = (v || u).nome || 'imagem';
          if (!u) poe(g('Imagens'), 'novo', `${nome} › ${n}`, null, { k: v.k });
          else if (!v) poe(g('Imagens'), 'saiu', `${nome} › ${n}`, { k: u.k }, null);
          else if (u.k !== v.k || J(u.camadas) !== J(v.camadas)) poe(g('Imagens'), 'mudou', `${nome} › ${n} (desenho mudou)`, { k: u.k }, { k: v.k });
          else if (J({ ...u, nome: 0 }) !== J({ ...v, nome: 0 })) poe(g('Imagens'), 'mudou', `${nome} › ${n} (posição/tamanho da imagem)`, { k: u.k }, { k: v.k });
        }
      }
      const sa = porId(A.sessoes), sb = porId(B.sessoes);
      for (const id of new Set([...sa.keys(), ...sb.keys()])) {
        const x = sa.get(id), y = sb.get(id), nome = (y || x).nome || 'Sessão';
        if (!x) { poe(g('Poses'), 'novo', `Sessão "${nome}" (${(y.presets || []).length} poses)`); continue; }
        if (!y) { poe(g('Poses'), 'saiu', `Sessão "${nome}"`); continue; }
        const qa = porId(x.presets), qb = porId(y.presets);
        for (const pid of new Set([...qa.keys(), ...qb.keys()])) {
          const u = qa.get(pid), v = qb.get(pid), n = (v || u).nome || 'pose';
          if (!u) poe(g('Poses'), 'novo', `${nome} › ${n}`); else if (!v) poe(g('Poses'), 'saiu', `${nome} › ${n}`); else if (J(u) !== J(v)) poe(g('Poses'), 'mudou', `${nome} › ${n}`);
        }
        if (x.nome !== y.nome) poe(g('Poses'), 'mudou', `Sessão "${x.nome}" virou "${y.nome}"`);
      }
      const aa = porId(A.animacoes), ab = porId(B.animacoes);
      for (const id of new Set([...aa.keys(), ...ab.keys()])) {
        const x = aa.get(id), y = ab.get(id), nome = (y || x).nome || 'Animação';
        const passos = a => (a?.trilhas || []).reduce((t, tr) => t + (tr?.length || tr?.passos?.length || 0), 0);
        if (!x) poe(g('Animações de teste'), 'novo', `"${nome}" (${passos(y)} frames)`);
        else if (!y) poe(g('Animações de teste'), 'saiu', `"${nome}"`);
        else if (J(x) !== J(y)) poe(g('Animações de teste'), 'mudou', `"${nome}": ${passos(x)} → ${passos(y)} frames`);
      }
    }
    return out;
  },
  // ---------- miniatura (chave de imagem do personagem ou data URL) ----------
  async url(m) {
    if (!m) return null; if (m.url) return m.url; if (!m.k) return null;
    (this._urls ||= new Map()); if (this._urls.has(m.k)) return this._urls.get(m.k);
    let b = await Arq.pegaBlob(m.k).catch(() => null); if (!b) b = await Nuvem.baixar(m.k).catch(() => null); if (!b) return null;
    const u = URL.createObjectURL(b); this._urls.set(m.k, u); return u;
  },
  // ---------- a janela ----------
  async abrir(nuvem, rasc) {
    const L = this.lista(nuvem, rasc), grupos = [...new Set(L.map(x => x.grupo))];
    const tag = { novo: ['novo no rascunho', 'dr-novo'], saiu: ['só na nuvem', 'dr-saiu'], mudou: ['mudou', 'dr-mudou'] };
    const mini = (m, lado) => m ? `<span class="dr-mini" data-m="${esc(JSON.stringify(m))}" title="${lado}"><span class="spin-dot"></span></span>` : `<span class="dr-mini dr-vazia" title="${lado}">—</span>`;
    const body = h(`<div class="dr">
      <div class="dr-topo"><div><small>${ic('cloud', 13)} Nuvem · ${nuvem.modificado ? fmtDate(nuvem.modificado) : 'antes'}</small>${mini(nuvem.thumb ? { url: nuvem.thumb } : null, 'Nuvem')}</div>
        <div><small>${ic('monitor', 13)} Rascunho deste computador</small>${mini(rasc.thumb ? { url: rasc.thumb } : null, 'Rascunho')}</div></div>
      ${L.length ? `<div class="dr-n">${L.length} diferença${L.length === 1 ? '' : 's'} · passe o mouse numa imagem para ver grande</div>` : '<div class="vazio">Não achei diferença no desenho: só mudou algo pequeno (como a ordem de alguma lista ou a data).</div>'}
      ${grupos.map(gr => `<div class="dr-g"><b>${esc(gr)}</b>${L.filter(x => x.grupo === gr).map(x => `<div class="dr-l"><span class="dr-t ${tag[x.tipo][1]}">${tag[x.tipo][0]}</span><span class="dr-txt">${esc(x.txt)}</span>${x.a || x.b ? `<span class="dr-par">${mini(x.a, 'Nuvem')}<span class="dr-seta">→</span>${mini(x.b, 'Rascunho')}</span>` : ''}</div>`).join('')}</div>`).join('')}
    </div>`);
    // miniaturas chegam aos poucos (as da nuvem podem precisar baixar)
    for (const el of body.querySelectorAll('[data-m]')) this.url(JSON.parse(el.dataset.m)).then(u => { el.innerHTML = u ? `<img src="${u}" alt="">` : '<small>sem imagem</small>'; });
    // passar o mouse: a imagem grande ao lado do mouse
    let zoom = null; const tira = () => { zoom?.remove(); zoom = null; };
    body.addEventListener('mouseover', e => { const img = e.target.closest('.dr-mini img'); if (!img) return; tira(); zoom = h(`<div class="dr-zoom"><img src="${img.src}" alt=""><small>${esc(img.closest('.dr-mini').title)}</small></div>`); document.body.appendChild(zoom); });
    body.addEventListener('mousemove', e => { if (!zoom) return; const W = 340, x = e.clientX + 18 + W > innerWidth ? e.clientX - W - 18 : e.clientX + 18; zoom.style.left = x + 'px'; zoom.style.top = Math.max(8, Math.min(innerHeight - W - 30, e.clientY - W / 2)) + 'px'; });
    body.addEventListener('mouseout', e => { if (e.target.closest('.dr-mini') && !e.relatedTarget?.closest?.('.dr-mini')) tira(); });
    await UI.modal({ title: 'Diferenças: nuvem × rascunho', icon: 'layers', width: 640, body, buttons: [{ label: 'Fechar', kind: 'primary', value: true }] });
    tira();
  },
};
// botão "Ver as diferenças" dentro da janela do rascunho (o Ateliê guarda o par em Atelie._difPar antes de abrir a janela)
document.addEventListener('click', e => { if (!e.target.closest?.('[data-difs]') || !Atelie._difPar) return; e.preventDefault(); DifRasc.abrir(Atelie._difPar.nuvem, Atelie._difPar.rasc); });
