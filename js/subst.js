/* SUBSTITUIR PELO .atelieanimador ESCOLHENDO O QUE TRAZER (decisão do dono, 29/10/2026)
   Compara o personagem aberto com o do arquivo, VISTA POR VISTA, em itens: cada PARTE (desenho pelo conteúdo das imagens, não pelo nome,
   + posição/ajustes), as POSES (cada sessão), as ANIMAÇÕES de teste, o fundo/raiz da vista e as configurações do personagem.
   Janela: em cima "Com diferença" (todos MARCADOS; um botão desmarca tudo / marca tudo de novo), embaixo "Sem diferença" (DESMARCADOS,
   com marcar/desmarcar todos), os dois separados pelas vistas; dá para marcar à mão. Só o marcado vem do arquivo; o resto fica como está.
   A versão de antes vai SEMPRE para "Só neste computador" como "<nome> (anterior)" (não existe mais o "vistas (antigo)"). */
'use strict';
const Subst = {
  CONF_FORA: ['partes', 'sessoes', 'animacoes', 'raiz', 'vis', 'vistas', 'vistaAtual', 'id', 'nome', 'pasta', 'autor', 'edicoes', 'modificado', 'thumb', 'v', 'iaPlano', 'iaCorrecoes', '_mod', '_local', 'copiaLocal', 'semNuvem'],
  nrm: s => String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
  // as vistas de um personagem: [{ id, nome, tipo, o (objeto com partes/sessoes/animacoes/raiz/vis) }]
  vistas(def) { Modelo.garanteVistas(def); return (def.vistas || []).map(v => ({ id: v.id, nome: v.nome, tipo: v.tipo, o: Modelo.naVista(def, v.id) })); },
  // impressão digital de cada imagem (pelo conteúdo): mesma imagem com outro nome = igual; mesmo nome com outro desenho = diferente
  async digitais(keys) {
    const out = new Map(), L = [...new Set(keys.filter(Boolean))]; let i = 0;
    await Promise.all(Array.from({ length: Math.min(6, L.length) }, async () => { while (i < L.length) { const k = L[i++];
      try { const b = await Arq.pegaBlob(k); if (!b) { out.set(k, 'sem:' + k); continue; } const h = await crypto.subtle.digest('SHA-1', await b.arrayBuffer());
        out.set(k, 'h:' + [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('')); } catch { out.set(k, 'sem:' + k); } } }));
    return out;
  },
  // JSON com as chaves de imagem trocadas pela digital (assim a comparação é pelo desenho)
  // listas/objetos vazios contam como "nada" (pastas: [] e sem pastas são a mesma coisa)
  json(o, dig) { return JSON.stringify(o ?? null, (c, v) => { if (typeof v === 'string' && dig.has(v)) return dig.get(v); if (Array.isArray(v) && !v.length) return undefined; if (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) return undefined; return v; }); },
  achar(lista, x) { return lista.find(y => y.id === x.id) || lista.find(y => this.nrm(y.nome) === this.nrm(x.nome)) || null; },
  // a lista de itens: { vista, vid, tipo, id, nome, dif, motivo, de (do arquivo), ag (de agora) }
  async comparar(atual, novo) {
    const A = this.vistas(atual), N = this.vistas(novo), dig = await this.digitais([...Modelo.chavesImgs(atual), ...Modelo.chavesImgs(novo)]);
    const J = o => this.json(o, dig), itens = [];
    for (const vn of N) {
      const va = A.find(v => v.id === vn.id) || A.find(v => this.nrm(v.nome) === this.nrm(vn.nome));
      if (!va) { itens.push({ vista: vn.nome, vid: vn.id, tipo: 'vista', id: vn.id, nome: `Vista inteira "${vn.nome}"`, dif: true, motivo: 'nova no arquivo', de: vn }); continue; }
      const grupo = (tipo, la, ln, motivo) => {
        for (const x of ln) { const y = this.achar(la, x);
          if (!y) { itens.push({ vista: va.nome, vid: va.id, tipo, id: x.id, nome: x.nome, dif: true, motivo: 'nova no arquivo', de: x }); continue; }
          const a = J(y), b = J(x); itens.push({ vista: va.nome, vid: va.id, tipo, id: y.id, nome: x.nome || y.nome, dif: a !== b, motivo: a === b ? '' : motivo(y, x), de: x, ag: y }); }
        for (const y of la) if (!ln.some(x => x.id === y.id || this.nrm(x.nome) === this.nrm(y.nome))) itens.push({ vista: va.nome, vid: va.id, tipo, id: y.id, nome: y.nome, dif: true, motivo: 'não está no arquivo (sai)', ag: y, sai: true });
      };
      grupo('parte', va.o.partes || [], vn.o.partes || [], (y, x) => { const m = []; if (J(y.imgs) !== J(x.imgs)) m.push('desenho'); if (J({ ...y, imgs: 0 }) !== J({ ...x, imgs: 0 })) m.push(J(y.base) !== J(x.base) ? 'posição' : 'ajustes'); return m.join(' e ') + ' mudou'; });
      grupo('poses', va.o.sessoes || [], vn.o.sessoes || [], (y, x) => { const n = (x.presets || []).filter(p => { const q = (y.presets || []).find(z => z.id === p.id); return !q || J(q) !== J(p); }).length; return n ? `${n} pose${n > 1 ? 's' : ''} mudou/nova` : 'mudou'; });
      grupo('anim', va.o.animacoes || [], vn.o.animacoes || [], () => 'frames mudaram');
      const fa = { raiz: va.o.raiz, vis: va.o.vis || null }, fn = { raiz: vn.o.raiz, vis: vn.o.vis || null };
      itens.push({ vista: va.nome, vid: va.id, tipo: 'vistaconf', id: 'vc:' + va.id, nome: 'Raiz, fundo e fantasma da vista', dif: J(fa) !== J(fn), motivo: J(fa) !== J(fn) ? 'mudou' : '', de: fn, ag: fa });
    }
    // ícone e cor AUTOMÁTICOS são refeitos sozinhos (ao exportar, salvar…): não contam como mudança
    const conf = d => { const o = {}; for (const [c, v] of Object.entries(d)) if (!this.CONF_FORA.includes(c)) o[c] = v;
      if ((d.iconeModo || 'auto') === 'auto' && !d.iconeFixo) delete o.icone; if ((d.corModo || 'auto') === 'auto') delete o.cor; return o; };
    const ca = conf(atual), cn = conf(novo);
    itens.push({ vista: 'Personagem', vid: '_conf', tipo: 'conf', id: 'conf', nome: 'Configurações (ícone, cor, cor interna, fps, áudios de teste…)', dif: J(ca) !== J(cn), motivo: J(ca) !== J(cn) ? 'mudou' : '', de: cn, ag: ca });
    return itens;
  },
  // ---------- a janela ----------
  ICO: { parte: 'image', poses: 'layers', anim: 'film', vistaconf: 'eye', vista: 'eye', conf: 'gear' },
  TIPO: { parte: 'Parte', poses: 'Poses', anim: 'Animação', vistaconf: 'Vista', vista: 'Vista', conf: 'Personagem' },
  async janela(atual, novo, itens, f, fpsHtml) {
    const urls = [], prev = {}, url = async p => { const im = p && ((p.imgs || []).find(i => i.id === p.base?.img) || p.imgs?.[0]); if (!im?.k) return '';
      const b = await Arq.pegaBlob(im.k).catch(() => null); if (!b) return ''; const u = URL.createObjectURL(b); urls.push(u); return u; };
    // miniatura (a do arquivo, ou a de agora se ela sai) + o que a lupa mostra ao passar o mouse: agora → arquivo
    const mini = async (it, i) => { if (it.tipo !== 'parte') return ''; const a = await url(it.ag), d = await url(it.de), u = d || a; if (!u) return '';
      prev[i] = it.dif && a && d ? [['Agora', a], ['Do arquivo', d]] : [[it.sai ? 'Agora (sai)' : d && !a ? 'Do arquivo (nova)' : 'Igual nos dois', u]]; return `<img src="${u}" alt="">`; };
    const linha = async (it, i) => `<label class="sb-it${it.sai ? ' sai' : ''}" data-i="${i}"><input type="checkbox" ${it.dif ? 'checked' : ''}><span class="sb-mini" data-zi="${i}">${await mini(it, i) || ic(this.ICO[it.tipo] || 'layers', 14)}</span><span class="sb-nm"><b>${esc(it.nome || '(sem nome)')}</b><small>${esc(this.TIPO[it.tipo] || '')}${it.motivo ? ' · ' + esc(it.motivo) : ''}</small></span></label>`;
    const bloco = async (L, cls) => { const porV = new Map(); for (const [i, it] of L) { if (!porV.has(it.vista)) porV.set(it.vista, []); porV.get(it.vista).push([i, it]); }
      let s = ''; for (const [v, l] of porV) { s += `<div class="sb-v"><div class="sb-vt">${ic(v === 'Personagem' ? 'gear' : 'eye', 12)} ${esc(v)} <small>${l.length}</small></div>`; for (const [i, it] of l) s += await linha(it, i); s += '</div>'; }
      return s || `<div class="sb-vazio">${cls === 'dif' ? 'Nenhuma diferença encontrada: o arquivo é igual ao personagem de agora.' : 'Tudo mudou.'}</div>`; };
    const idx = itens.map((it, i) => [i, it]), D = idx.filter(([, it]) => it.dif), I = idx.filter(([, it]) => !it.dif);
    const corpo = h(`<div class="sb">
      <div class="sb-top">Trazer do arquivo <b>${esc(f.name)}</b> para <b>${esc(atual.nome)}</b> só o que estiver marcado; o resto fica como está.${Atelie.naNuvem ? ' Ele está na nuvem: a nuvem da equipe recebe o resultado.' : ''}</div>
      ${fpsHtml}
      <div class="sb-sec dif"><div class="sb-h">${ic('alert', 13)} Com diferença <small>${D.length}</small><span class="sp"></span><button class="btn sm" data-tdif></button></div><div class="sb-l">${await bloco(D, 'dif')}</div></div>
      <div class="sb-sec igual"><div class="sb-h">${ic('check', 13)} Sem diferença encontrada <small>${I.length}</small><span class="sp"></span><button class="btn sm" data-mi>Marcar todos</button><button class="btn sm" data-di>Desmarcar todos</button></div><div class="sb-l">${await bloco(I, 'igual')}</div></div>
      <div class="sb-nota">${ic('save', 12)} Antes, a versão de agora fica guardada como <b>${esc(atual.nome)} (anterior)</b> em <b>Só neste computador</b>${AoVivo.ativo ? ' de todos que estão junto' : ''}. Ctrl+Z também volta.</div></div>`);
    const caixas = sel => $$(sel + ' .sb-it input', corpo), conta = () => $$('.sb-it input', corpo).filter(c => c.checked).length;
    let ok = null; const pintaTodos = () => { const L = caixas('.sb-sec.dif'), b = $('[data-tdif]', corpo); b.hidden = !L.length; b.textContent = L.length && L.every(c => c.checked) ? 'Desmarcar tudo' : 'Marcar tudo'; const n = conta(); if (ok) { ok.textContent = `Trazer ${n} marcado${n === 1 ? '' : 's'}`; ok.disabled = !n; } };
    $('[data-tdif]', corpo).onclick = () => { const L = caixas('.sb-sec.dif'), todos = L.every(c => c.checked); L.forEach(c => c.checked = !todos); pintaTodos(); };
    $('[data-mi]', corpo).onclick = () => { caixas('.sb-sec.igual').forEach(c => c.checked = true); pintaTodos(); };
    $('[data-di]', corpo).onclick = () => { caixas('.sb-sec.igual').forEach(c => c.checked = false); pintaTodos(); };
    corpo.addEventListener('change', pintaTodos);
    // lupa: versão grande da miniatura (lado que cabe na tela)
    let zoom = null; const tiraZoom = () => { zoom?.remove(); zoom = null; };
    corpo.addEventListener('mouseover', e => { const m = e.target.closest('.sb-mini[data-zi]'), P = m && prev[m.dataset.zi]; if (!P) return; tiraZoom();
      const nome = itens[+m.dataset.zi]?.nome || '';
      zoom = h(`<div class="sb-zoom"><div class="sb-zt">${esc(nome)}</div><div class="sb-zg">${P.map(([t, u], j) => `${j ? `<span class="sb-zs">${ic('right', 14)}</span>` : ''}<figure><span><img src="${u}" alt=""></span><figcaption>${esc(t)}</figcaption></figure>`).join('')}</div></div>`);
      document.body.appendChild(zoom); const r = m.getBoundingClientRect(), z = zoom.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      let x = r.right + 12; if (x + z.width > W - 8) x = r.left - z.width - 12; if (x < 8) x = Math.max(8, Math.min(W - z.width - 8, r.left));
      let y = r.top + r.height / 2 - z.height / 2; y = Math.max(8, Math.min(H - z.height - 8, y));
      zoom.style.left = x + 'px'; zoom.style.top = y + 'px'; });
    corpo.addEventListener('mouseout', e => { const m = e.target.closest('.sb-mini[data-zi]'); if (m && !m.contains(e.relatedTarget)) tiraZoom(); });
    corpo.addEventListener('scroll', tiraZoom, true);
    let marcados = null;
    const op = await UI.modal({ title: 'Substituir: escolha o que trazer do arquivo', icon: 'layers', width: 640, body: corpo,
      onOpen: api => { ok = $$('button', api.foot).find(x => /Trazer/.test(x.textContent)) || null; pintaTodos(); },
      buttons: [{ label: 'Cancelar', value: null }, { label: 'Abrir como outro personagem', value: 'abrir' },
        { label: 'Trazer os marcados', kind: 'primary', onClick: () => { marcados = $$('.sb-it', corpo).filter(l => $('input', l).checked).map(l => itens[+l.dataset.i]); return 'sub'; } }] });
    tiraZoom(); urls.forEach(u => setTimeout(() => URL.revokeObjectURL(u), 2000));
    return { op: marcados ? 'sub' : op, marcados: marcados || [], fps: +$('[data-fps]', corpo)?.value || 0 };
  },
  // ---------- aplicar o que foi marcado ----------
  aplicar(atual, novo, marcados) {
    const d = clone(atual); Modelo.garanteVistas(d);
    const alvo = vid => vid === d.vistaAtual ? d : d.vistas.find(v => v.id === vid);
    const troca = (lista, it) => { const i = lista.findIndex(x => x.id === it.id); if (it.sai) { if (i >= 0) lista.splice(i, 1); return; } const c = clone(it.de); if (it.ag) c.id = it.ag.id; if (i >= 0) lista[i] = c; else lista.push(c); };
    for (const it of marcados) {
      if (it.tipo === 'conf') { const ic0 = d.icone, cor0 = d.cor; for (const c of Object.keys(d)) if (!this.CONF_FORA.includes(c)) delete d[c]; Object.assign(d, clone(it.de)); if (d.icone === undefined && ic0) d.icone = ic0; if (d.cor === undefined && cor0) d.cor = cor0; continue; }
      if (it.tipo === 'vista') { const v = it.de; let id = v.id; if (d.vistas.some(x => x.id === id)) id = uid('vi');
        d.vistas.push({ id, nome: v.nome, tipo: v.tipo || 'outra', partes: clone(v.o.partes || []), sessoes: clone(v.o.sessoes || []), animacoes: clone(v.o.animacoes || []), raiz: v.o.raiz, ...(v.o.vis ? { vis: clone(v.o.vis) } : {}) }); continue; }
      const t = alvo(it.vid); if (!t) continue;
      if (it.tipo === 'vistaconf') { t.raiz = it.de.raiz; if (it.de.vis) t.vis = clone(it.de.vis); else delete t.vis; continue; }
      const campo = { parte: 'partes', poses: 'sessoes', anim: 'animacoes' }[it.tipo]; if (!campo) continue; t[campo] ||= []; troca(t[campo], it);
    }
    // parte que saiu: tira de raiz/pai das outras (ficam sem pai)
    for (const v of [d, ...d.vistas.filter(v => v.id !== d.vistaAtual && v.partes)]) { const ids = new Set(v.partes.map(p => p.id)); for (const p of v.partes) if (p.pai && !ids.has(p.pai)) delete p.pai; if (v.raiz && !ids.has(v.raiz)) v.raiz = v.partes[0]?.id || null; }
    Modelo.garanteVistas(d); return d;
  },
};
