/* CONTROLES DO PERSONAGEM ("código" do personagem; decisão do dono, 29/10/2026)
   No Ateliê o personagem ganha uma RECEITA em JSON (def.controles) com caixas de marcar, escolhas, cores, barras e botões.
   No Animador ela vira um painel (Propriedades › Controles e No quadro) para personalizar SEM mexer no arquivo original:
   tirar a bolsa em todas as vistas, trocar a cor do cabelo, trocar o personagem, pôr uma pose, grudar uma camada na mão…

   SEGURANÇA (o mais importante): NÃO é JavaScript e nada dele é executado. O texto é lido com JSON.parse e passa por
   `Controles.valida`, que monta um objeto NOVO só com os campos e ações desta lista (qualquer chave desconhecida = erro),
   com limites de tamanho, cores só #rrggbb, ids só letras/números, números presos em faixas. Os textos só aparecem
   escapados (esc). Sem HTML, sem endereços, sem scripts: o pior que uma receita pode fazer é esconder/mexer partes do
   próprio personagem na animação. O que vem guardado (nuvem, .atelieanimador, animação) passa pelo validador de novo.

   Estado: n.ctrl {id: valor} (esta camada) · P.ctrl[defId] {id: valor} ("vale": "short") · chave.ctrl {id: valor} ("animavel": segura até a próxima chave).
   Efeitos (no desenho, Render.estadoPartes/pecasPersonagem): esconder, mostrar, imagem, mover, opacidade, trocarCor.
   Ações (botões, viram um passo do Ctrl+Z): pose, vista, animacao, personagem, marcar, grudar, soltar, corInterna.
   GRUDAR: n.gruda = { no, parte, nome, q0 } numa camada → ela anda junto com a parte (Controles.deltaGruda, em Render.umNo e Rig.matNo). */
'use strict';
const Controles = {
  MAX_TXT: 60000, MAX_ITENS: 300,
  // ---------- o validador (lista do que é permitido) ----------
  PROIBIDO: /^(__proto__|constructor|prototype)$/,
  valida(entrada) {
    const erros = []; let n = 0; const ids = new Set(), ruim = k => this.PROIBIDO.test(k);
    let o = entrada;
    if (typeof o === 'string') { if (o.length > this.MAX_TXT) return { erros: [`O código passou de ${this.MAX_TXT} letras.`] }; try { o = JSON.parse(o); } catch (e) { return { erros: ['Não é um JSON válido: ' + e.message] }; } }
    if (Array.isArray(o)) o = { itens: o };
    if (!o || typeof o !== 'object') return { erros: ['O código tem que ser um objeto { "itens": [ … ] }.'] };
    const onde = p => p ? ` (em ${p})` : '';
    const so = (x, campos, p) => { if (!x || typeof x !== 'object' || Array.isArray(x)) { erros.push('Esperava um objeto' + onde(p)); return false; } for (const k of Object.keys(x)) if (!campos.includes(k)) erros.push(`Campo "${String(k).slice(0, 30)}" não existe${onde(p)}. Pode: ${campos.join(', ')}`); return true; };
    const txt = (v, p, max = 80, obrig = false) => { if (v == null || v === '') { if (obrig) erros.push('Falta o texto' + onde(p)); return undefined; } if (typeof v !== 'string') { erros.push('Esperava um texto' + onde(p)); return undefined; } return v.replace(/[\u0000-\u001f<>]/g, '').slice(0, max); };
    const cor = (v, p) => { if (typeof v !== 'string') { erros.push('Cor tem que ser "#rrggbb"' + onde(p)); return undefined; } let s = v.trim().toLowerCase(); if (/^#[0-9a-f]{3}$/.test(s)) s = '#' + [...s.slice(1)].map(c => c + c).join(''); if (!/^#[0-9a-f]{6}$/.test(s)) { erros.push(`Cor "${v.slice(0, 12)}" inválida: use #rrggbb` + onde(p)); return undefined; } return s; };
    const num = (v, p, mi, ma, dol = false) => { if (dol && v === '$') return '$'; const x = +v; if (typeof v === 'boolean' || v === '' || v == null || !isFinite(x)) { erros.push('Esperava um número' + (dol ? ' (ou "$")' : '') + onde(p)); return undefined; } return Math.min(ma, Math.max(mi, x)); };
    const lista = (v, p, max = 50) => { if (v == null) return []; if (!Array.isArray(v)) v = [v]; if (v.length > max) { erros.push(`Lista grande demais (máx. ${max})` + onde(p)); v = v.slice(0, max); } return v; };
    const pads = (v, p) => lista(v, p).map(s => txt(s, p, 60)).filter(Boolean);
    const id = (v, p) => { if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(v) || ruim(v)) { erros.push(`"id" tem que ser só letras, números, _ ou - (até 40)` + onde(p)); return undefined; } if (ids.has(v)) erros.push(`id "${v}" repetido`); ids.add(v); return v; };
    const comuns = (x, out, p) => { out.titulo = txt(x.titulo, p, 80, true); if (x.dica != null) out.dica = txt(x.dica, p, 240); if (x.vale != null) { if (!['camada', 'short'].includes(x.vale)) erros.push('"vale" é "camada" ou "short"' + onde(p)); else out.vale = x.vale; } if (x.animavel != null) out.animavel = !!x.animavel; };
    const efeito = (e, p, dol) => {
      if (!e || typeof e !== 'object' || Array.isArray(e)) { erros.push('Efeito tem que ser um objeto' + onde(p)); return null; }
      const ks = Object.keys(e).filter(k => k !== 'vistas'); if (ks.length !== 1) { erros.push(`Cada efeito tem UMA ação (${this.EFEITOS.join(', ')}) + "vistas" opcional` + onde(p)); return null; }
      const k = ks[0], v = e[k], out = {}; if (e.vistas != null) out.vistas = pads(e.vistas, p);
      if (k === 'esconder' || k === 'mostrar') out[k] = pads(v, p);
      else if (k === 'imagem') { if (!so(v, ['parte', 'imagem'], p)) return null; out.imagem = { parte: txt(v.parte, p, 60, true), imagem: txt(v.imagem, p, 60, true) }; }
      else if (k === 'mover') { if (!so(v, ['partes', 'x', 'y', 'r', 's'], p)) return null; const m = { partes: pads(v.partes, p) }; for (const c of ['x', 'y', 'r']) if (v[c] != null) m[c] = num(v[c], p, -5000, 5000, dol); if (v.s != null) m.s = num(v.s, p, .01, 20, dol); out.mover = m; }
      else if (k === 'opacidade') { if (!so(v, ['partes', 'valor'], p)) return null; out.opacidade = { partes: pads(v.partes, p), valor: num(v.valor, p, 0, 1, dol) }; }
      else if (k === 'trocarCor') { if (!so(v, ['partes', 'de', 'para', 'tol'], p)) return null; const t = { partes: pads(v.partes, p), para: v.para === '$' && dol ? '$' : cor(v.para, p) }; if (v.de != null) t.de = lista(v.de, p, 12).map(c => cor(c, p)).filter(Boolean); if (v.tol != null) t.tol = num(v.tol, p, 0, 255); out.trocarCor = t; }
      else { erros.push(`Efeito "${String(k).slice(0, 30)}" não existe${onde(p)}. Pode: ${this.EFEITOS.join(', ')}`); return null; }
      return out;
    };
    const efeitos = (v, p, dol) => lista(v, p, 40).map(e => efeito(e, p, dol)).filter(Boolean);
    const acao = (a, p) => {
      if (!a || typeof a !== 'object' || Array.isArray(a)) { erros.push('Ação tem que ser um objeto' + onde(p)); return null; }
      const ks = Object.keys(a); if (ks.length !== 1) { erros.push(`Cada ação tem UMA chave (${this.ACOES.join(', ')})` + onde(p)); return null; }
      const k = ks[0], v = a[k];
      if (k === 'pose') { if (!v || typeof v !== 'object' || Array.isArray(v)) { erros.push('"pose" é { "Sessão": "Preset" }' + onde(p)); return null; } const o2 = Object.create(null); for (const [s, pr] of Object.entries(v).slice(0, 30)) { if (ruim(s)) { erros.push('nome proibido' + onde(p)); continue; } const sn = txt(s, p, 60, true); if (sn) o2[sn] = pr == null ? null : txt(pr, p, 60); } return { pose: o2 }; }
      if (k === 'vista' || k === 'animacao' || k === 'personagem') return { [k]: txt(v, p, 60, true) };
      if (k === 'marcar') { if (!v || typeof v !== 'object' || Array.isArray(v)) { erros.push('"marcar" é { "id": valor }' + onde(p)); return null; } const o2 = Object.create(null); for (const [i, x] of Object.entries(v).slice(0, 40)) { if (!/^[A-Za-z0-9_-]{1,40}$/.test(i) || ruim(i)) { erros.push('id inválido em "marcar"' + onde(p)); continue; } if (typeof x === 'boolean' || (typeof x === 'number' && isFinite(x))) o2[i] = x; else if (typeof x === 'string') o2[i] = txt(x, p, 60); else erros.push('valor de "marcar" é sim/não, número ou texto' + onde(p)); } return { marcar: o2 }; }
      if (k === 'grudar') { if (!so(v, ['camada', 'parte'], p)) return null; return { grudar: { camada: txt(v.camada, p, 80, true), parte: txt(v.parte, p, 60, true) } }; }
      if (k === 'soltar') { if (!so(v, ['camada'], p)) return null; return { soltar: { camada: txt(v.camada, p, 80, true) } }; }
      if (k === 'corInterna') { if (v === 'original' || v === null) return { corInterna: v === null ? null : 'original' }; const c = cor(v, p); return c ? { corInterna: c } : null; }
      erros.push(`Ação "${String(k).slice(0, 30)}" não existe${onde(p)}. Pode: ${this.ACOES.join(', ')}`); return null;
    };
    const item = (x, p, nivel) => {
      if (++n > this.MAX_ITENS) { if (n === this.MAX_ITENS + 1) erros.push(`Mais de ${this.MAX_ITENS} controles.`); return null; }
      if (!x || typeof x !== 'object' || Array.isArray(x)) { erros.push('Cada item é um objeto' + onde(p)); return null; }
      const t = x.tipo, q = `${p} › ${typeof x.titulo === 'string' ? x.titulo.slice(0, 30) : t || '?'}`, out = { tipo: t };
      if (t === 'secao') { if (!so(x, ['tipo', 'titulo', 'aberta', 'itens'], q)) return null; if (nivel > 1) { erros.push('Seção dentro de seção dentro de seção: no máximo 2 níveis' + onde(q)); return null; } out.titulo = txt(x.titulo, q, 80, true); out.aberta = x.aberta !== false; out.itens = lista(x.itens, q, 100).map(y => item(y, q, nivel + 1)).filter(Boolean); return out; }
      if (t === 'texto') { if (!so(x, ['tipo', 'texto'], q)) return null; out.texto = txt(x.texto, q, 400, true); return out; }
      if (t === 'caixa') { if (!so(x, ['tipo', 'id', 'titulo', 'dica', 'vale', 'animavel', 'padrao', 'porVista', 'ligado', 'desligado'], q)) return null; out.id = id(x.id, q); comuns(x, out, q); out.padrao = x.padrao !== false; out.porVista = !!x.porVista; out.ligado = efeitos(x.ligado, q); out.desligado = efeitos(x.desligado, q); return out; }
      if (t === 'escolha') { if (!so(x, ['tipo', 'id', 'titulo', 'dica', 'vale', 'animavel', 'padrao', 'opcoes'], q)) return null; out.id = id(x.id, q); comuns(x, out, q);
        out.opcoes = lista(x.opcoes, q, 40).map((o2, i) => { const qq = `${q} › opção ${i + 1}`; if (!so(o2, ['titulo', 'cor', 'efeitos'], qq)) return null; const r = { titulo: txt(o2.titulo, qq, 60, true) }; if (o2.cor != null) r.cor = cor(o2.cor, qq); r.efeitos = efeitos(o2.efeitos, qq); return r; }).filter(Boolean);
        if (!out.opcoes.length) erros.push('Escolha sem opções' + onde(q)); out.padrao = typeof x.padrao === 'string' ? Math.max(0, out.opcoes.findIndex(o2 => o2.titulo === x.padrao)) : Math.min(out.opcoes.length - 1, Math.max(0, Math.round(+x.padrao || 0))); return out; }
      if (t === 'cor') { if (!so(x, ['tipo', 'id', 'titulo', 'dica', 'vale', 'animavel', 'padrao', 'partes', 'de', 'tol', 'amostras'], q)) return null; out.id = id(x.id, q); comuns(x, out, q); out.partes = pads(x.partes, q); if (!out.partes.length) erros.push('"partes" vazio' + onde(q));
        out.padrao = x.padrao != null ? cor(x.padrao, q) : undefined; if (x.de != null) out.de = lista(x.de, q, 12).map(c => cor(c, q)).filter(Boolean); if (x.tol != null) out.tol = num(x.tol, q, 0, 255); out.amostras = lista(x.amostras, q, 16).map(c => cor(c, q)).filter(Boolean); return out; }
      if (t === 'barra') { if (!so(x, ['tipo', 'id', 'titulo', 'dica', 'vale', 'animavel', 'padrao', 'min', 'max', 'passo', 'efeitos'], q)) return null; out.id = id(x.id, q); comuns(x, out, q); out.min = num(x.min ?? 0, q, -1e4, 1e4); out.max = num(x.max ?? 1, q, -1e4, 1e4); if (out.max <= out.min) out.max = out.min + 1; out.passo = num(x.passo ?? (out.max - out.min) / 100, q, .0001, 1e4); out.padrao = num(x.padrao ?? out.min, q, out.min, out.max); out.efeitos = efeitos(x.efeitos, q, true); return out; }
      if (t === 'botao') { if (!so(x, ['tipo', 'titulo', 'dica', 'icone', 'acoes'], q)) return null; out.titulo = txt(x.titulo, q, 80, true); if (x.dica != null) out.dica = txt(x.dica, q, 240); if (x.icone != null) { if (typeof x.icone === 'string' && /^[A-Za-z]{1,20}$/.test(x.icone)) out.icone = x.icone; else erros.push('"icone" é só o nome (letras)' + onde(q)); } out.acoes = lista(x.acoes, q, 30).map(a => acao(a, q)).filter(Boolean); if (!out.acoes.length) erros.push('Botão sem ações' + onde(q)); return out; }
      erros.push(`Tipo "${String(t).slice(0, 30)}" não existe${onde(p)}. Pode: ${this.TIPOS.join(', ')}`); return null;
    };
    if (!so(o, ['versao', 'itens'], 'raiz')) return { erros };
    const itens = lista(o.itens, 'raiz', 200).map(x => item(x, 'raiz', 0)).filter(Boolean);
    return { erros, limpo: { versao: 1, itens } };
  },
  TIPOS: ['secao', 'texto', 'caixa', 'escolha', 'cor', 'barra', 'botao'],
  EFEITOS: ['esconder', 'mostrar', 'imagem', 'mover', 'opacidade', 'trocarCor'],
  ACOES: ['pose', 'vista', 'animacao', 'personagem', 'marcar', 'grudar', 'soltar', 'corInterna'],
  // a receita do personagem já validada (cache pelo objeto; o que veio de fora passa de novo pelo validador)
  _cache: new WeakMap(),
  de(def) { const c = def?.controles; if (!c || typeof c !== 'object') return null; if (this._cache.has(c)) return this._cache.get(c); const r = this.valida(clone(c)); const v = !r.erros.length && r.limpo?.itens?.length ? r.limpo : null; if (r.erros.length) console.warn('[Controles] receita com erro, ignorada:', r.erros.slice(0, 3)); /* guardada com erro (mexida à mão fora do Ateliê) = nada roda */ this._cache.set(c, v); return v; },
  todos(rec) { const out = []; const anda = l => { for (const x of l || []) { if (x.tipo === 'secao') anda(x.itens); else out.push(x); } }; anda(rec?.itens); return out; },
  nrm: s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(),
  // "Cabelo*" = começa com Cabelo; sem * = nome igual (sem acento e sem maiúscula)
  bate(pad, nome) { const p = this.nrm(pad), n = this.nrm(nome); if (!p.includes('*')) return p === n; const re = new RegExp('^' + p.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$'); return re.test(n); },
  partes(dv, pads) { return (dv.partes || []).filter(p => pads.some(x => this.bate(x, p.nome))); },
  // ---------- estado de cada controle ----------
  vistaId(def, dv, est) { return dv?._vista || est?.vista || def?.vistas?.[0]?.id || '_'; },
  valor(P, n, q, c) {
    if (c.animavel && n.chaves) { let v; for (const k of Modelo.quadrosChave(n)) { if (k > q) break; const x = n.chaves[k].ctrl?.[c.id]; if (x !== undefined) v = x; } if (v !== undefined) return this.confere(c, v); }
    const v = c.vale === 'short' ? P?.ctrl?.[n.ref]?.[c.id] : n.ctrl?.[c.id]; return this.confere(c, v);
  },
  confere(c, v) { // valor guardado → valor do tipo certo (o que não bate volta ao padrão)
    if (c.tipo === 'caixa') { if (c.porVista && v && typeof v === 'object') { const o = Object.create(null); for (const [k, x] of Object.entries(v)) if (typeof x === 'boolean') o[k] = x; return o; } return typeof v === 'boolean' ? v : c.padrao; }
    if (c.tipo === 'escolha') { const i = Math.round(+v); return Number.isInteger(i) && i >= 0 && i < c.opcoes.length && v !== null && v !== '' ? i : c.padrao; }
    if (c.tipo === 'cor') return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : (c.padrao || null);
    if (c.tipo === 'barra') return typeof v === 'number' && isFinite(v) ? Math.min(c.max, Math.max(c.min, v)) : c.padrao;
    return v;
  },
  caixaNa(c, v, vid) { return c.porVista && v && typeof v === 'object' ? (v[vid] ?? c.padrao) : (typeof v === 'boolean' ? v : c.padrao); },
  poe(P, n, q, c, v) {
    if (c.animavel) { const k = Modelo.chave(n, q); k.ctrl = { ...(k.ctrl || {}), [c.id]: v }; return; }
    if (c.vale === 'short') { P.ctrl = P.ctrl || {}; P.ctrl[n.ref] = { ...(P.ctrl[n.ref] || {}), [c.id]: v }; return; }
    n.ctrl = { ...(n.ctrl || {}), [c.id]: v };
  },
  // ---------- efeitos no desenho ----------
  ativos(P, n, q, def, dv, est) {
    const rec = this.de(def); if (!rec) return null; const vid = this.vistaId(def, dv, est), vnome = this.nrm(def.vistas?.find(v => v.id === vid)?.nome || ''), out = [];
    const naVista = e => !e.vistas?.length || e.vistas.some(x => this.bate(x, vnome));
    const sub = (e, v) => JSON.parse(JSON.stringify(e), (k, x) => x === '$' ? v : x);
    for (const c of this.todos(rec)) {
      const v = this.valor(P, n, q, c); let efs = [];
      if (c.tipo === 'caixa') efs = this.caixaNa(c, v, vid) ? c.ligado : c.desligado;
      else if (c.tipo === 'escolha') efs = c.opcoes[v]?.efeitos || [];
      else if (c.tipo === 'cor') { if (v && v !== c.padrao) efs = [{ trocarCor: { partes: c.partes, de: c.de, para: v, tol: c.tol } }]; }
      else if (c.tipo === 'barra') efs = c.efeitos.map(e => sub(e, v));
      for (const e of efs) if (naVista(e)) out.push(e);
    }
    return out.length ? out : null;
  },
  // muda o estado das partes (ep) e devolve o que vale por peça (opacidade, troca de cor)
  aplica(P, n, q, def, dv, est, ep) {
    let efs; try { efs = this.ativos(P, n, q, def, dv, est); } catch (e) { console.warn('[Controles]', e); return { ep, pecas: null }; } if (!efs) return { ep, pecas: null };
    ep = { ...ep }; const pecas = {}, mexe = (p, f) => { ep[p.id] = { ...(ep[p.id] || p.base) }; f(ep[p.id]); };
    for (const e of efs) {
      if (e.esconder) for (const p of this.partes(dv, e.esconder)) mexe(p, s => s.vis = false);
      else if (e.mostrar) for (const p of this.partes(dv, e.mostrar)) mexe(p, s => s.vis = true);
      else if (e.imagem) for (const p of this.partes(dv, [e.imagem.parte])) { const im = (p.imgs || []).find(i => this.bate(e.imagem.imagem, i.nome)); if (im) mexe(p, s => s.img = im.id); }
      else if (e.mover) for (const p of this.partes(dv, e.mover.partes)) mexe(p, s => { const m = e.mover; if (+m.x) s.x = (s.x || 0) + +m.x; if (+m.y) s.y = (s.y || 0) + +m.y; if (+m.r) s.r = (s.r || 0) + +m.r; if (m.s != null && +m.s > 0) s.s = (s.s ?? 1) * +m.s; });
      else if (e.opacidade) for (const p of this.partes(dv, e.opacidade.partes)) { const x = (pecas[p.id] ||= {}); x.op = (x.op ?? 1) * Math.min(1, Math.max(0, +e.opacidade.valor)); }
      else if (e.trocarCor && /^#[0-9a-f]{6}$/i.test(e.trocarCor.para || '')) for (const p of this.partes(dv, e.trocarCor.partes)) ((pecas[p.id] ||= {}).troca ||= []).push({ de: e.trocarCor.de || null, para: e.trocarCor.para, tol: e.trocarCor.tol ?? 60 });
    }
    return { ep, pecas };
  },
  // ---------- TROCAR COR (sem mexer no arquivo: uma cópia na memória, por imagem + regra) ----------
  hex2rgb: h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)],
  rgb2hsl(r, g, b) { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b), l = (M + m) / 2; if (M === m) return [0, 0, l]; const d = M - m, s = l > .5 ? d / (2 - M - m) : d / (M + m); const h = M === r ? (g - b) / d + (g < b ? 6 : 0) : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, s, l]; },
  hsl2rgb(h, s, l) { if (!s) { const v = Math.round(l * 255); return [v, v, v]; } const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q, f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map(x => Math.round(x * 255)); },
  // uma cor → a cor nova (ou null se a regra não vale para ela). Mantém o sombreado: anda a mesma distância de claro/escuro que a cor de referência
  mapeia(rgb, regras) {
    for (const r of regras) {
      const t = this.rgb2hsl(...this.hex2rgb(r.para)), px = this.rgb2hsl(...rgb); let ref = null;
      if (r.de?.length) { let best = Infinity; for (const d of r.de) { const c = this.hex2rgb(d), dist = Math.hypot(c[0] - rgb[0], c[1] - rgb[1], c[2] - rgb[2]); if (dist < best) { best = dist; ref = c; } } if (best > (r.tol ?? 60)) continue; ref = this.rgb2hsl(...ref); }
      else { if (px[2] < .14 || px[2] > .985) continue; ref = [px[0], px[1], .5]; } // sem "de": pinta tudo que não é a linha preta nem o branco puro
      const cl = x => Math.min(1, Math.max(0, x)); return this.hsl2rgb(t[0], cl(px[1] + (t[1] - ref[1])), cl(px[2] + (t[2] - ref[2])));
    }
    return null;
  },
  trocaCache: new Map(), _trocaFaz: new Set(),
  comTroca(bm, it, aoChegar) {
    const R = it?.troca; if (!bm || !R?.length || !it.img?.k) return bm; const k = it.img.k, ch = k + '|' + JSON.stringify(R) + '|' + (it.cor || ''), c = this.trocaCache.get(ch); if (c && c.src === bm) return c.out;
    const guarda = out => { this.trocaCache.set(ch, { src: bm, out }); if (this.trocaCache.size > 200) this.trocaCache.delete(this.trocaCache.keys().next().value); };
    if (typeof Vetor !== 'undefined' && Vetor.eh(k)) {
      if (!this._trocaFaz.has(ch)) { this._trocaFaz.add(ch); (async () => { try { let t = await Vetor.texto(k); if (it.cor) t = Vetor.recolore(t, it.cor);
        const memo = {}; t = t.replace(/<mask[\s\S]*?<\/mask>|#([0-9a-f]{6}|[0-9a-f]{3})\b/gi, (m, h) => { if (m[0] === '<') return m; const x = (h.length === 3 ? [...h].map(c2 => c2 + c2).join('') : h).toLowerCase(); if (!(x in memo)) { const o = this.mapeia(this.hex2rgb('#' + x), R); memo[x] = o ? '#' + o.map(v => v.toString(16).padStart(2, '0')).join('') : null; } return memo[x] || m; });
        const im = await Vetor.imagem(new Blob([t], { type: 'image/svg+xml' })); if (im) guarda(im); } catch (e) { console.warn('[trocar cor]', e); } finally { this._trocaFaz.delete(ch); } aoChegar?.(); })(); }
      return c ? c.out : bm;
    }
    const cv = document.createElement('canvas'); cv.width = bm.width; cv.height = bm.height; const x = cv.getContext('2d'); x.drawImage(bm, 0, 0);
    try { const d = x.getImageData(0, 0, cv.width, cv.height), a = d.data, memo = new Map();
      for (let i = 0; i < a.length; i += 4) { if (a[i + 3] < 8) continue; const key = (a[i] << 16) | (a[i + 1] << 8) | a[i + 2]; let o = memo.get(key); if (o === undefined) { o = this.mapeia([a[i], a[i + 1], a[i + 2]], R); memo.set(key, o); } if (o) { a[i] = o[0]; a[i + 1] = o[1]; a[i + 2] = o[2]; } }
      x.putImageData(d, 0, 0); } catch (e) { console.warn('[trocar cor]', e); return bm; }
    guarda(cv); return cv;
  },
  // ---------- GRUDAR uma camada numa parte de um personagem ----------
  _gGuarda: 0,
  matParte(P, alvo, g, q) {
    const ee = Render.estadoPartes(P, alvo, q); if (!ee) return null; const p = ee.dv.partes.find(x => x.id === g.parte) || ee.dv.partes.find(x => this.nrm(x.nome) === this.nrm(g.nome)); if (!p) return null;
    const it = Modelo.montar(ee.dv, ee.ep, Rig.matNo(P, alvo, q)).find(x => x.parte.id === p.id); return it ? it.mp : Modelo.montar(ee.dv, { ...ee.ep, [p.id]: { ...(ee.ep[p.id] || p.base), vis: true } }, Rig.matNo(P, alvo, q)).find(x => x.parte.id === p.id)?.mp || null;
  },
  // quanto a parte andou desde o quadro em que grudou (no mundo): a camada recebe o mesmo movimento
  deltaGruda(P, n, q) {
    const g = n.gruda; if (!g || this._gGuarda > 3) return null; const alvo = Modelo.todos(P).find(x => x.id === g.no); if (!alvo || alvo === n || alvo.tipo !== 'personagem') return null;
    this._gGuarda++; try { const a = this.matParte(P, alvo, g, q), b = this.matParte(P, alvo, g, g.q0 || 0); return a && b ? a.multiply(b.inverse()) : null; } catch { return null; } finally { this._gGuarda--; }
  },
  // ---------- botões ----------
  async aperta(P, n, c, q = App.q) {
    const ia = [], fora = []; let muda = false;
    for (const a of c.acoes) {
      if (a.pose) ia.push({ tipo: 'pose', camada: n.id, quadro: q + 1, sessoes: a.pose });
      else if (a.vista) ia.push({ tipo: 'vista', camada: n.id, quadro: q + 1, vista: a.vista });
      else if (a.animacao) ia.push({ tipo: 'animacao', camada: n.id, quadro: q + 1, animacao: a.animacao });
      else if (a.marcar) { const rec = this.de(P.personagens[n.ref]); for (const [i, v] of Object.entries(a.marcar)) { const cc = this.todos(rec).find(x => x.id === i); if (!cc) { fora.push(`controle "${i}"`); continue; } const vv = cc.tipo === 'escolha' && typeof v === 'string' ? cc.opcoes.findIndex(o => this.bate(v, o.titulo)) : v; this.poe(P, n, q, cc, this.confere(cc, vv)); muda = true; } }
      else if (a.grudar) { const outro = IA.acha(Modelo.todos(P).filter(x => x !== n), a.grudar.camada), dv = Render.estadoPartes(P, n, q)?.dv, pt = dv && this.partes(dv, [a.grudar.parte])[0]; if (!outro || !pt) { fora.push(!outro ? `camada "${a.grudar.camada}"` : `parte "${a.grudar.parte}"`); continue; } outro.gruda = { no: n.id, parte: pt.id, nome: pt.nome, q0: q }; muda = true; }
      else if (a.soltar) { const outro = IA.acha(Modelo.todos(P), a.soltar.camada); if (outro?.gruda) { delete outro.gruda; muda = true; } else fora.push(`camada "${a.soltar.camada}"`); }
      else if ('corInterna' in a) { if (a.corInterna === null) delete n.cor; else n.cor = a.corInterna; muda = true; }
      else if (a.personagem) { const d = await this.achaPersonagem(P, a.personagem); if (!d) { fora.push(`personagem "${a.personagem}"`); continue; } if (!P.personagens[d.id]) { P.personagens[d.id] = d; await Arq.garantir(Modelo.chavesImgs(d)).catch(() => { }); Icone.garanteNoEditor?.(P); } n.ref = d.id; muda = true; }
    }
    if (ia.length) { const r = IA.aplicar(ia); if (r < ia.length) fora.push('pose/vista/animação com nome que não existe'); if (r) muda = true; }
    if (muda) App.commit(c.titulo, { semArvore: true });
    if (fora.length) UI.toast(`<b>${esc(c.titulo)}</b>: não achei ${esc(fora.join(', '))}.`, { kind: 'warn', time: 5000 });
  },
  async achaPersonagem(P, nome) {
    const L = Object.values(P.personagens), x = L.find(d => d.id === nome) || L.find(d => this.nrm(d.nome) === this.nrm(nome)); if (x) return x;
    try { const it = (await Nuvem.lista()).find(d => d.id === nome || this.nrm(d.nome) === this.nrm(nome)); if (it) return await Nuvem.abrir(it.id); } catch { }
    try { const r = (await Atelie.rascunhos()).find(r => this.nrm(r.def.nome) === this.nrm(nome)); if (r) return clone(r.def); } catch { }
    return null;
  },
  // ---------- o painel (Animador e prévia do Ateliê) ----------
  // ctx: { def, vistas: [{id,nome}], vistaAgora, get(c), set(c, v), botao(c), vale(c) }
  painel(rec, ctx) {
    const box = h('<div class="ct-painel"></div>');
    const um = (c, alvo) => {
      const dica = c.dica ? ` title="${esc(c.dica)}"` : '', tag = ctx.tag?.(c) || '';
      if (c.tipo === 'texto') { alvo.appendChild(h(`<div class="ct-txt">${esc(c.texto)}</div>`)); return; }
      if (c.tipo === 'caixa' && c.porVista && ctx.vistas.length > 1) {
        const v = ctx.get(c), g = h(`<div class="ct-grupo"${dica}><div class="ct-gt"><b>${esc(c.titulo)}</b>${tag}<span class="sp"></span><button class="btn sm" data-todas></button></div><div class="ct-vs"></div></div>`), vs = $('.ct-vs', g);
        const todas = () => ctx.vistas.every(x => this.caixaNa(c, v, x.id)); const pintaB = () => $('[data-todas]', g).textContent = todas() ? 'Desmarcar todas' : 'Marcar todas';
        for (const x of ctx.vistas) { const l = h(`<label class="ct-chk ${x.id === ctx.vistaAgora ? 'agora' : ''}"><input type="checkbox" ${this.caixaNa(c, v, x.id) ? 'checked' : ''}><span>${esc(x.nome)}</span></label>`);
          $('input', l).onchange = e => { const o = { ...(v && typeof v === 'object' ? v : {}) }; for (const y of ctx.vistas) if (!(y.id in o)) o[y.id] = this.caixaNa(c, v, y.id); o[x.id] = e.target.checked; ctx.set(c, o); }; vs.appendChild(l); }
        $('[data-todas]', g).onclick = () => { const on = !todas(), o = {}; for (const y of ctx.vistas) o[y.id] = on; ctx.set(c, o); }; pintaB(); alvo.appendChild(g); return; }
      if (c.tipo === 'caixa') { const l = h(`<label class="ct-chk ct-linha"${dica}><input type="checkbox" ${this.caixaNa(c, ctx.get(c), ctx.vistaAgora) ? 'checked' : ''}><span>${esc(c.titulo)}</span>${tag}</label>`); $('input', l).onchange = e => ctx.set(c, c.porVista ? Object.fromEntries(ctx.vistas.map(y => [y.id, e.target.checked])) : e.target.checked); alvo.appendChild(l); return; }
      if (c.tipo === 'escolha') { const v = ctx.get(c), g = h(`<div class="ct-grupo"${dica}><div class="ct-gt"><b>${esc(c.titulo)}</b>${tag}</div><div class="ct-ops"></div></div>`);
        c.opcoes.forEach((o, i) => { const b = h(`<button class="ct-op ${i === v ? 'on' : ''}">${o.cor ? `<i style="background:${o.cor}"></i>` : ''}<span>${esc(o.titulo)}</span></button>`); b.onclick = () => ctx.set(c, i); $('.ct-ops', g).appendChild(b); }); alvo.appendChild(g); return; }
      if (c.tipo === 'cor') { const v = ctx.get(c) || c.padrao || '#888888', g = h(`<div class="ct-grupo"${dica}><div class="ct-gt"><b>${esc(c.titulo)}</b>${tag}<span class="sp"></span>${c.padrao ? `<button class="btn sm" data-orig title="Volta à cor do Ateliê">Original</button>` : ''}</div><div class="ct-cores"><input type="color" value="${v}"></div></div>`), cs = $('.ct-cores', g);
        for (const a of c.amostras || []) { const b = h(`<button class="ct-am ${a === v ? 'on' : ''}" style="background:${a}" title="${a}"></button>`); b.onclick = () => ctx.set(c, a); cs.appendChild(b); }
        const inp = $('input', g); inp.oninput = () => ctx.set(c, inp.value, true); inp.onchange = () => ctx.set(c, inp.value); $('[data-orig]', g)?.addEventListener('click', () => ctx.set(c, c.padrao)); alvo.appendChild(g); return; }
      if (c.tipo === 'barra') { const v = ctx.get(c), g = h(`<div class="ct-grupo"${dica}><div class="ct-gt"><b>${esc(c.titulo)}</b>${tag}<span class="sp"></span><small class="ct-val">${round(v, 3)}</small></div><input type="range" min="${c.min}" max="${c.max}" step="${c.passo}" value="${v}"></div>`), r = $('input', g);
        r.oninput = () => { $('.ct-val', g).textContent = round(+r.value, 3); ctx.set(c, +r.value, true); }; r.onchange = () => ctx.set(c, +r.value); r.ondblclick = () => ctx.set(c, c.padrao); alvo.appendChild(g); return; }
      if (c.tipo === 'botao') { const b = h(`<button class="btn sm ct-bt"${dica}>${ic(c.icone || 'sparkles', 13)}<span>${esc(c.titulo)}</span></button>`); b.onclick = () => ctx.botao(c); const u = alvo.lastElementChild; (u?.classList.contains('ct-bts') ? u : alvo.appendChild(h('<div class="ct-bts"></div>'))).appendChild(b); return; }
    };
    const nivel = (L, alvo) => { for (const c of L) { if (c.tipo === 'secao') { const d = h(`<details class="ct-sec" ${c.aberta ? 'open' : ''}><summary>${ic('right', 10)}<b>${esc(c.titulo)}</b></summary><div class="ct-corpo"></div></details>`); nivel(c.itens, $('.ct-corpo', d)); alvo.appendChild(d); } else um(c, alvo); } };
    nivel(rec.itens, box); return box;
  },
  // painel do Animador para a camada n (personagem)
  painelNo(P, n) {
    const def = P.personagens[n.ref], rec = this.de(def); if (!rec) return null; const q = App.q, est = Modelo.estadoPersonagem(n, q), dv = Modelo.naVista(def, est.vista);
    const vistas = (def.vistas?.length ? def.vistas : [{ id: '_', nome: 'Única' }]).map(v => ({ id: v.id, nome: v.nome }));
    const pn = this.painel(rec, { def, vistas, vistaAgora: this.vistaId(def, dv, est), get: c => this.valor(P, n, App.q, c),
      tag: c => c.animavel ? `<span class="ct-tag anim" title="Fica numa chave no quadro de agora e segura até a próxima">chave</span>` : c.vale === 'short' ? `<span class="ct-tag short" title="Vale para este personagem no vídeo inteiro">vídeo todo</span>` : '',
      set: (c, v, vivo) => { this.poe(P, n, App.q, c, v); if (vivo) App.pinta(); else App.commit(c.titulo, { semArvore: true }); },
      botao: c => this.aperta(P, n, c) });
    // bem SEPARADO do resto do Animador (pedido do dono): moldura própria + de onde vem
    const box = h(`<div class="ct-moldura"><div class="ct-origem">${ic('code', 13)}<span><b>Código do personagem</b><small>feito no Ateliê para ${esc(def.nome)} · muda só esta animação, nunca o personagem</small></span><button class="ibtn" title="Editar o código no Ateliê">${ic('edit', 13)}</button></div></div>`);
    $('button', box).onclick = () => Atelie.abrirAba(def.id); box.appendChild(pn); return box;
  },
  // ---------- o editor (Ateliê) ----------
  EXEMPLO: { versao: 1, itens: [
    { tipo: 'secao', titulo: 'Acessórios', itens: [
      { tipo: 'caixa', id: 'bolsa', titulo: 'Com bolsa', porVista: true, padrao: true, dica: 'Desmarcado = a bolsa some (em cada vista marcada)', desligado: [{ esconder: ['Bolsa*', 'Alça*'] }] },
      { tipo: 'caixa', id: 'oculos', titulo: 'Óculos', padrao: false, ligado: [{ mostrar: ['Óculos'] }], desligado: [{ esconder: ['Óculos'] }] }] },
    { tipo: 'secao', titulo: 'Cores', itens: [
      { tipo: 'cor', id: 'cabelo', titulo: 'Cor do cabelo', vale: 'short', partes: ['Cabelo*', 'Franja*', 'Mecha*'], padrao: '#5a3a22', de: ['#5a3a22'], tol: 70, amostras: ['#5a3a22', '#e8c26a', '#c0462a', '#202020', '#7a4fd0'] },
      { tipo: 'escolha', id: 'roupa', titulo: 'Roupa', opcoes: [{ titulo: 'Original' }, { titulo: 'Azul', cor: '#3a6fd8', efeitos: [{ trocarCor: { partes: ['Camisa*', 'Manga*'], para: '#3a6fd8' } }] }] }] },
    { tipo: 'secao', titulo: 'Atuação', itens: [
      { tipo: 'barra', id: 'cabeca', titulo: 'Inclinar a cabeça', min: -20, max: 20, passo: 1, padrao: 0, animavel: true, efeitos: [{ mover: { partes: ['Cabeça'], r: '$' } }] },
      { tipo: 'botao', titulo: 'Sorrir', icone: 'sparkles', acoes: [{ pose: { Boca: 'Sorriso' } }] },
      { tipo: 'botao', titulo: 'Virar de lado', acoes: [{ vista: 'Lado' }] },
      { tipo: 'botao', titulo: 'Segurar a caneca', dica: 'Gruda a camada "Caneca" na mão direita', acoes: [{ grudar: { camada: 'Caneca', parte: 'Mão direita' } }] },
      { tipo: 'botao', titulo: 'Soltar a caneca', acoes: [{ soltar: { camada: 'Caneca' } }] },
      { tipo: 'botao', titulo: 'Trocar para a Clara', acoes: [{ personagem: 'Clara' }] }] }] },
  formata(o) { return JSON.stringify(o, null, 2).replace(/\[\s+("[^"\n]*"(,\s+"[^"\n]*")*)\s+\]/g, (m, x) => '[' + x.replace(/\s+/g, ' ') + ']'); },
  // nomes que o código pode usar (partes, imagens, poses, vistas, animações)
  nomes(def) {
    const vs = def.vistas?.length ? def.vistas : [{ id: null, nome: '' }], partes = new Set(), poses = [], anims = new Set();
    for (const v of vs) { const dv = Modelo.naVista(def, v.id); for (const p of dv.partes || []) partes.add(p.nome); for (const s of dv.sessoes || []) poses.push(`${s.nome}: ${(s.presets || []).map(p => p.nome).join(', ')}`); for (const a of dv.animacoes || []) anims.add(a.nome); }
    return { partes: [...partes], poses: [...new Set(poses)], vistas: vs.map(v => v.nome).filter(Boolean), anims: [...anims] };
  },
  async editar() {
    const def = Atelie.def; if (!def) return; const N = this.nomes(def);
    let txtIni = def.controles ? this.formata(def.controles) : '', prev = {}, vistaP = def.vistaAtual || def.vistas?.[0]?.id || null;
    const corpo = h(`<div class="ct-ed">
      <div class="ct-ed-top">Uma <b>receita</b> (JSON) com caixas, escolhas, cores, barras e botões que aparecem no <b>Animador</b> para este personagem. Muda só a animação, nunca o arquivo do Ateliê. Não é programa: só os campos da lista são aceitos (nada de scripts, links ou HTML).</div>
      <div class="ct-ed-g"><div class="ct-ed-esq"><textarea spellcheck="false" placeholder='{ "itens": [ … ] }'></textarea><div class="ct-ed-erros"></div>
        <div class="ct-ed-bts"><button class="btn sm" data-ex>${ic('file', 12)} Exemplo</button><button class="btn sm" data-fmt>${ic('check', 12)} Arrumar</button><button class="btn sm ia" data-ia>${ic('sparkles', 12)} Criar com a IA…</button><span class="sp"></span><button class="btn sm ghost" data-ref>${ic('info', 12)} O que dá para usar</button></div></div>
        <div class="ct-ed-dir"><div class="ct-ed-pt">Prévia ${def.vistas?.length > 1 ? `<select data-vp>${def.vistas.map(v => `<option value="${esc(v.id)}" ${v.id === vistaP ? 'selected' : ''}>${esc(v.nome)}</option>`).join('')}</select>` : ''}</div><canvas class="ct-ed-cv" width="360" height="300"></canvas><div class="ct-ed-pn"></div></div></div>
      <div class="ct-ed-nomes"><b>Partes:</b> ${esc(N.partes.join(', ') || '—')}<br><b>Poses:</b> ${esc(N.poses.join(' · ') || '—')}<br><b>Vistas:</b> ${esc(N.vistas.join(', ') || '—')} · <b>Animações:</b> ${esc(N.anims.join(', ') || '—')}</div></div>`);
    const ta = $('textarea', corpo), er = $('.ct-ed-erros', corpo), pn = $('.ct-ed-pn', corpo), cv = $('canvas', corpo); ta.value = txtIni; let atual = null;
    const desenha = () => this.desenhaPrevia(cv, def, atual, prev, vistaP);
    const confere = () => { const t = ta.value.trim(); if (!t) { atual = null; er.innerHTML = `<span class="ok">Vazio: o personagem fica sem controles.</span>`; pn.innerHTML = ''; desenha(); return true; }
      const r = this.valida(t); atual = r.limpo || null; er.innerHTML = r.erros.length ? r.erros.slice(0, 8).map(x => `<div>${ic('alert', 11)} ${esc(x)}</div>`).join('') + (r.erros.length > 8 ? `<div>… e mais ${r.erros.length - 8}</div>` : '') : `<span class="ok">${ic('check', 11)} Certo: ${this.todos(atual).length} controle(s).</span>`;
      pn.innerHTML = ''; if (atual) { const vistas = (def.vistas?.length ? def.vistas : [{ id: '_', nome: 'Única' }]).map(v => ({ id: v.id, nome: v.nome }));
        pn.appendChild(this.painel(atual, { def, vistas, vistaAgora: vistaP || '_', get: c => this.confere(c, prev[c.id]), tag: c => c.vale === 'short' ? '<span class="ct-tag short">vídeo todo</span>' : c.animavel ? '<span class="ct-tag anim">chave</span>' : '',
          set: (c, v, vivo) => { prev[c.id] = v; desenha(); if (!vivo) confere(); }, botao: c => UI.toast(`Botão <b>${esc(c.titulo)}</b>: funciona no Animador (${c.acoes.map(a => Object.keys(a)[0]).join(', ')}).`, { time: 3000 }) })); }
      desenha(); return !r.erros.length; };
    let tm; ta.oninput = () => { clearTimeout(tm); tm = setTimeout(confere, 350); };
    ta.onkeydown = e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); } e.stopPropagation(); };
    $('[data-ex]', corpo).onclick = () => { ta.value = this.formata(this.EXEMPLO); confere(); };
    $('[data-fmt]', corpo).onclick = () => { try { ta.value = this.formata(JSON.parse(ta.value)); } catch { } confere(); };
    $('[data-vp]', corpo)?.addEventListener('change', e => { vistaP = e.target.value; confere(); });
    $('[data-ref]', corpo).onclick = () => UI.modal({ title: 'O que a receita pode ter', icon: 'info', width: 620, body: h(`<div class="ct-ref">${this.AJUDA}</div>`), buttons: [{ label: 'Fechar', value: null }] });
    $('[data-ia]', corpo).onclick = async () => { const pedido = await UI.prompt({ title: 'Criar os controles com a IA', label: 'O que os controles devem fazer?', placeholder: 'ex.: caixa com/sem bolsa em cada vista, cor do cabelo, botão de sorrir', multiline: true, ia: true, icon: 'sparkles' }); if (!pedido) return;
      try { const out = await IA.chama(this.sisIA(def), [{ type: 'text', text: `Personagem: ${def.nome}\nNomes: ${JSON.stringify(N)}\nReceita de agora: ${ta.value.slice(0, 8000) || '(nenhuma)'}\n\nPedido: ${pedido}` }], null, { titulo: 'Criando os controles' });
        const j = IA.json(out); const r = this.valida(j); if (!r.limpo) throw new Error(r.erros[0] || 'resposta vazia'); ta.value = this.formata(r.limpo); confere(); } catch (e) { UI.toast('A IA não conseguiu: ' + esc(e.message), { kind: 'err' }); } };
    confere();
    const r = await UI.modal({ title: `Código do personagem · ${def.nome}`, icon: 'code', width: 1000, body: corpo, buttons: [{ label: 'Cancelar', value: null }, { label: 'Tirar os controles', value: 'tira', left: true }, { label: 'Salvar no personagem', kind: 'primary', onClick: () => { if (!confere()) { UI.toast('Arrume os erros antes de salvar.', { kind: 'warn' }); return true; } return 'ok'; } }] });
    if (r === 'tira') { if (def.controles) { delete def.controles; Atelie.commit('Tirar os controles'); UI.toast('Controles tirados.', { kind: 'ok' }); } return; }
    if (r !== 'ok') return;
    if (atual) def.controles = atual; else delete def.controles; Atelie.commit('Controles do personagem');
    UI.toast(atual ? `Controles salvos (${this.todos(atual).length}). Vão com o personagem para a nuvem e aparecem no Animador.` : 'Personagem sem controles.', { kind: 'ok', time: 4000 });
  },
  // desenha o personagem com os efeitos da prévia (só para ver no editor)
  desenhaPrevia(cv, def, rec, prev, vistaId) {
    const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height);
    try { const P = { personagens: { [def.id]: { ...def, controles: rec || undefined } }, ctrl: { [def.id]: prev } }, n = { id: '_prev', ref: def.id, chaves: { 0: vistaId ? { vista: vistaId } : {} }, ctrl: prev };
      const ee = Render.estadoPartes(P, n, 0); if (!ee) return; const L = Render.pecasPersonagem(P, n, 0, new DOMMatrix()), b = Modelo.caixaPersonagem(ee.dv, ee.ep), s = Math.min((cv.width - 20) / (b.w || 1), (cv.height - 20) / (b.h || 1));
      const base = new DOMMatrix().translate(cv.width / 2, cv.height / 2).scale(s).translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      for (const it of L) { if (!it.img) continue; const bm = Arq.comAp(Render.bm(it.img.k), it, () => this.desenhaPrevia(cv, def, rec, prev, vistaId)); if (!bm) continue; const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2;
        x.setTransform(base.multiply(it.m)); x.globalAlpha = it.op ?? 1; x.drawImage(bm, -px + (it.img.ajuste?.x || 0), -py + (it.img.ajuste?.y || 0), it.img.w, it.img.h); }
      x.globalAlpha = 1; } catch (e) { console.warn('[Controles prévia]', e); }
  },
  sisIA(def) { return `Você escreve RECEITAS DE CONTROLES (JSON) para um personagem 2D do Animador do Estúdio Problems. Responda SÓ o JSON { "versao": 1, "itens": [...] }, sem texto fora. Use SÓ os nomes de partes, poses, vistas e animações que vierem em "Nomes" ("Parte*" pega todas que começam assim). Formato:\n${this.AJUDA.replace(/<[^>]+>/g, '')}\nMantenha o que já existe na receita de agora, a menos que o pedido diga o contrário. Ids curtos sem espaço.`; },
  AJUDA: `<p><b>Raiz</b>: <code>{ "versao": 1, "itens": [ … ] }</code></p>
<p><b>Itens</b> (todos com "titulo"; os que guardam valor têm "id"):<br>
<code>secao</code> { titulo, aberta, itens } · <code>texto</code> { texto } (uma nota)<br>
<code>caixa</code> { id, titulo, padrao: true|false, porVista: true (uma caixa por vista + Marcar/Desmarcar todas), ligado: [efeitos], desligado: [efeitos] }<br>
<code>escolha</code> { id, titulo, padrao: nº ou título, opcoes: [ { titulo, cor: "#rrggbb", efeitos: [ … ] } ] }<br>
<code>cor</code> { id, titulo, partes: ["Cabelo*"], padrao: "#cor original", de: ["#cores a trocar"], tol: 0–255, amostras: ["#…"] } (sem "de" = pinta tudo que não é linha preta)<br>
<code>barra</code> { id, titulo, min, max, passo, padrao, efeitos: [ … com "$" no lugar do número ] }<br>
<code>botao</code> { titulo, dica, icone, acoes: [ … ] }</p>
<p>Opcionais em caixa/escolha/cor/barra: "dica", <code>"vale": "short"</code> (o mesmo valor para este personagem no vídeo inteiro; padrão = só esta camada), <code>"animavel": true</code> (o valor fica numa CHAVE no quadro de agora e segura até a próxima: dá para animar).</p>
<p><b>Efeitos</b> (um por objeto; + <code>"vistas": ["Lado"]</code> opcional = só nessas vistas):<br>
<code>{ "esconder": ["Bolsa", "Alça*"] }</code> · <code>{ "mostrar": [ … ] }</code> · <code>{ "imagem": { "parte": "Boca", "imagem": "Aberta" } }</code><br>
<code>{ "mover": { "partes": [ … ], "x": 0, "y": 0, "r": 10, "s": 1.1 } }</code> (soma à pose) · <code>{ "opacidade": { "partes": [ … ], "valor": 0.5 } }</code><br>
<code>{ "trocarCor": { "partes": [ … ], "de": ["#5a3a22"], "para": "#c0462a", "tol": 60 } }</code> (mantém o sombreado)</p>
<p><b>Ações dos botões</b> (no quadro de agora, um passo do Ctrl+Z):<br>
<code>{ "pose": { "Boca": "Sorriso" } }</code> · <code>{ "vista": "Lado" }</code> · <code>{ "animacao": "Andar" }</code> · <code>{ "personagem": "Clara" }</code> (troca por outro personagem do Ateliê/nuvem)<br>
<code>{ "marcar": { "bolsa": false, "roupa": "Azul" } }</code> (muda outros controles) · <code>{ "corInterna": "#ffd0e0" }</code> (ou "original", ou null)<br>
<code>{ "grudar": { "camada": "Caneca", "parte": "Mão direita" } }</code> (a camada anda junto com a parte) · <code>{ "soltar": { "camada": "Caneca" } }</code></p>`,
  // para a IA do Animador: os controles de cada personagem (id, tipo, valor de agora)
  contexto(P, n, q) {
    const rec = this.de(P.personagens[n.ref]); if (!rec) return undefined;
    return this.todos(rec).map(c => ({ id: c.id, tipo: c.tipo, titulo: c.titulo, valor: c.tipo === 'botao' ? undefined : this.valor(P, n, q, c), opcoes: c.opcoes?.map(o => o.titulo), min: c.min, max: c.max, animavel: c.animavel || undefined, acoes: c.tipo === 'botao' ? c.acoes.map(a => Object.keys(a)[0]) : undefined }));
  },
  // ação da IA/Plano: {"tipo":"controle","camada","id","valor","quadro"} ou {"tipo":"apertar","camada","botao"}
  daIA(P, a, no, qq) {
    const rec = this.de(P.personagens[no.ref]); if (!rec) return false;
    if (a.tipo === 'apertar') { const c = this.todos(rec).find(x => x.tipo === 'botao' && this.bate(String(a.botao || ''), x.titulo)); if (!c) return false; this.aperta(P, no, c, qq); return true; }
    const c = this.todos(rec).find(x => x.id === a.id || this.bate(String(a.id || ''), x.titulo || '')); if (!c || c.tipo === 'botao') return false;
    let v = a.valor; if (c.tipo === 'escolha' && typeof v === 'string') v = c.opcoes.findIndex(o => this.bate(v, o.titulo)); this.poe(P, no, qq, c, this.confere(c, v)); return true;
  },
};
