/* ===================== troca.js — TROCAR O PERSONAGEM DE UMA CAMADA (decisão do dono, 28/10/2026) =====================
   Lumi, Melzinha e Nimbo seguem o PADRÃO DE NOMES DA CASA (os nomes de sessões e poses da Lumi). Trocar = cada chave da camada
   passa a pedir a MESMA sessão e a MESMA pose (pelo nome) no outro personagem; vista e ajustes de partes também vão pelo nome.
   O que o outro não tem sai daquela chave (fica a base dele) e aparece no resumo. Ctrl+Z volta. */
'use strict';
const Troca = {
  norm: s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\(base\)/g, '').replace(/[^a-z0-9/°+-]+/g, ' ').trim(),
  // sinônimos que ainda existem entre os personagens (singular/plural, nomes antigos)
  SIN: { 'tronco': 'corpo', 'balanco do cabelo': 'cabelo', 'pernas as duas': 'pernas', 'aberto': 'abertos', 'fechado': 'fechados', 'piscando': 'fechados', 'feliz': 'felizes',
    'meio fechado': 'meio fechados', 'surpreso': 'surpresos', 'arregalado': 'surpresos', 'pendurado': 'caido', 'reta neutra': 'fechada reta', 'emburrada': 'brava',
    'passo frente': 'passo a frente', 'passo tras': 'passo atras', 'inclinada para a direita': 'inclinada direita', 'inclinada para a esquerda': 'inclinada esquerda', 'punho fechado': 'punho', 'aberta acenando': 'aberta' },
  chave(s) { const n = this.norm(s); return this.SIN[n] || n; },
  vistaDe(def, vid) { const vs = def.vistas || []; if (!vs.length) return null; return vs.find(v => v.id === vid) || vs[0]; },
  vistaPorNome(def, nome) { const vs = def.vistas || []; if (!vs.length) return null; return vs.find(v => this.norm(v.nome) === this.norm(nome)) || null; },
  sessoes(def, vid) { return (vid && def.vistas?.length ? Modelo.naVista(def, vid) : def).sessoes || []; },
  partes(def, vid) { return (vid && def.vistas?.length ? Modelo.naVista(def, vid) : def).partes || []; },
  // converte uma chave do personagem A para o B. Devolve { k, falta: [textos] }
  chaveNova(A, B, k0) {
    const k = clone(k0), falta = [];
    const vA = this.vistaDe(A, k.vista), vB = vA ? this.vistaPorNome(B, vA.nome) : null;
    if ('vista' in k) { if (vB) k.vista = vB.id; else { delete k.vista; if (vA && B.vistas?.length) falta.push('vista ' + vA.nome); } }
    const idA = vA?.id, idB = vB?.id || (B.vistas?.[0]?.id);
    if (k.sessoes) {
      const SA = this.sessoes(A, idA), SB = this.sessoes(B, idB), out = {};
      for (const [sid, pid] of Object.entries(k.sessoes)) {
        const sa = SA.find(s => s.id === sid), pa = sa?.presets.find(p => p.id === pid); if (!sa || !pa) continue;
        const sb = SB.find(s => this.chave(s.nome) === this.chave(sa.nome)), pb = sb?.presets.find(p => this.chave(p.nome) === this.chave(pa.nome));
        if (pb) out[sb.id] = pb.id; else falta.push(`${sa.nome} › ${pa.nome}`);
      }
      k.sessoes = out;
    }
    if (k.partes) {
      const PA = this.partes(A, idA), PB = this.partes(B, idB), out = {};
      for (const [pid, v] of Object.entries(k.partes)) { const pa = PA.find(p => p.id === pid), pb = pa && PB.find(p => this.norm(p.nome) === this.norm(pa.nome)); if (pb) { const vv = { ...v }; delete vv.img; out[pb.id] = vv; } }
      k.partes = out;
    }
    return { k, falta };
  },
  async trocar(n) {
    const A = App.P.personagens[n.ref]; if (!A) return UI.toast('Não achei o personagem desta camada.', { kind: 'err' });
    const B = await Biblioteca.escolher(); if (!B || B.id === A.id) return;
    App.P.personagens[B.id] ||= B; await Arq.garantir(Modelo.chavesImgs(B)).catch(() => { }); Icone.garanteNoEditor?.(App.P);
    const faltas = new Map(); let nCh = 0;
    for (const q of Object.keys(n.chaves || {})) { const r = this.chaveNova(A, App.P.personagens[B.id], n.chaves[q]); n.chaves[q] = r.k; nCh++; for (const f of r.falta) faltas.set(f, (faltas.get(f) || 0) + 1); }
    // tamanho: o novo fica com a mesma ALTURA na tela do antigo
    try { const ha = Modelo.caixaPersonagem(A, Modelo.partesNoEstado(A, {})).h, hb = Modelo.caixaPersonagem(B, Modelo.partesNoEstado(B, {})).h;
      if (ha > 0 && hb > 0) { const f = ha / hb; for (const k of Object.values(n.chaves)) if (k.s != null) k.s = round(k.s * f, 3); } } catch { }
    n.ref = B.id; if (!n.nome || n.nome === A.nome) n.nome = B.nome;
    App.commit('Trocar ' + A.nome + ' por ' + B.nome);
    const L = [...faltas].sort((a, b) => b[1] - a[1]);
    UI.modal({ title: `${esc(A.nome)} → ${esc(B.nome)}`, icon: 'users', width: 520, body: `<div>${nCh} chaves convertidas pelo nome das poses.</div>` +
      (L.length ? `<div style="margin-top:8px">O ${esc(B.nome)} não tem estas poses (nessas chaves ficou a base dele):</div><ul style="max-height:240px;overflow:auto;margin:6px 0 0;padding-left:18px">${L.map(([f, c]) => `<li>${esc(f)} <small>(${c}×)</small></li>`).join('')}</ul>` : '<div style="margin-top:8px">Todas as poses existem nele.</div>'),
      buttons: [{ label: 'Ok', kind: 'primary', value: true }] });
  },
};
