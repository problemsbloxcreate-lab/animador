/* ===================== previa.js — passar o mouse num personagem (biblioteca, rascunhos, "Pôr um personagem") mostra ele se mexendo =====================
   Toca, em sequência, as animações de teste do personagem (andar, falar, piscar…). Sem animações, passa pelas poses/expressões das sessões.
   Funciona sozinho em qualquer cartão com data-prev-id (personagem da nuvem) ou data-prev-rasc (rascunho deste computador). */
'use strict';
const Previa = {
  defs: new Map(), atual: null, onde: new Map(), // onde: em que ponto parou cada personagem (volta dali quando o mouse volta)
  async def(card) {
    const k = this.chave(card), id = card.dataset.prevId || card.dataset.prevRasc;
    if (!this.defs.has(k)) this.defs.set(k, (card.dataset.prevRasc ? DB.get('arquivos', 'rascunho:' + id).then(r => r?.def) : Nuvem.abrir(id, true)).catch(() => null));
    return this.defs.get(k);
  },
  chave(card) { return (card.dataset.prevRasc ? 'r:' : 'n:') + (card.dataset.prevId || card.dataset.prevRasc); },
  // a sequência: [{ nome, escolhas, ms }]
  roteiro(def) {
    const out = [];
    for (const a of def.animacoes || []) {
      const tr = (a.trilhas || []).filter(t => t.length); if (!tr.length) continue;
      const n = Math.max(...tr.map(t => t.length)), voltas = Math.max(2, Math.ceil(8 / n)), ms = clamp(+a.vel || 250, 60, 1200);
      for (let i = 0; i < n * voltas; i++) out.push({ nome: a.nome || 'Animação', escolhas: Animacoes.frame(a, i), ms });
    }
    if (!out.length) for (const s of def.sessoes || []) for (const pr of s.presets || []) out.push({ nome: `${s.nome}: ${pr.nome}`, escolhas: { sessoes: { [s.id]: pr.id }, partes: {} }, ms: 550 });
    if (!out.length) out.push({ nome: '', escolhas: {}, ms: 1000 });
    return out;
  },
  async entra(card) {
    if (this.atual?.card === card) return; this.sai();
    const ctl = { card, vivo: true }; this.atual = ctl;
    await new Promise(r => setTimeout(r, 220)); if (!ctl.vivo) return; // só quando o mouse fica um pouquinho
    const th = card.querySelector('.th'); if (!th) return;
    const sp = h('<span class="prev-carr"><span class="spin-dot"></span></span>'); th.appendChild(sp);
    const def = await this.def(card); if (!ctl.vivo || !def?.partes?.length) { sp.remove(); return; }
    const ks = [...new Set(def.partes.flatMap(p => p.imgs.map(i => i.k)).filter(Boolean))];
    await Promise.race([Arq.garantir(ks), new Promise(r => setTimeout(r, 6000))]); sp.remove(); if (!ctl.vivo) return;
    const rot = this.roteiro(def), d = devicePixelRatio || 1, r = th.getBoundingClientRect(), cv = document.createElement('canvas'), rot1 = h('<span class="prev-nome"></span>');
    cv.className = 'prev-cv'; cv.width = Math.max(2, r.width * d); cv.height = Math.max(2, r.height * d); th.append(cv, rot1); th.classList.add('previa');
    // caixa que cabe todas as poses (para o personagem não pular de tamanho)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of rot.filter((_, i) => i < 60)) { const b = Modelo.caixaPersonagem(def, Modelo.partesNoEstado(def, f.escolhas)); if (!(b.w > 0)) continue; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); }
    if (!isFinite(x0)) { x0 = -100; y0 = -100; x1 = 100; y1 = 100; }
    const k = Math.min(cv.width / (x1 - x0), cv.height / (y1 - y0)) * .86, ox = cv.width / 2 - (x0 + x1) / 2 * k, oy = cv.height / 2 - (y0 + y1) / 2 * k, c = cv.getContext('2d');
    const kp = this.chave(card); let i = (this.onde.get(kp) || 0) % rot.length; // continua de onde parou; depois da última animação volta para a primeira
    const quadro = () => {
      if (!ctl.vivo) return; const f = rot[i % rot.length]; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
      const base = new DOMMatrix().translate(ox, oy).scale(k);
      for (const it of Modelo.montar(def, Modelo.partesNoEstado(def, f.escolhas))) {
        if (!it.img) continue; const bm = Arq.comAp(Arq.img.get(it.img.k), it); if (!bm) continue; const px = it.img.pivo?.x ?? it.img.w / 2, py = it.img.pivo?.y ?? it.img.h / 2;
        c.setTransform(base.multiply(it.m)); c.drawImage(bm, -px + (it.img.ajuste?.x || 0), -py + (it.img.ajuste?.y || 0), it.img.w, it.img.h);
      }
      rot1.textContent = f.nome; rot1.hidden = !f.nome; this.onde.set(kp, i % rot.length); i++; ctl.t = setTimeout(quadro, f.ms);
    };
    quadro();
    ctl.limpa = () => { clearTimeout(ctl.t); cv.remove(); rot1.remove(); th.classList.remove('previa'); };
  },
  sai() { const a = this.atual; if (!a) return; a.vivo = false; a.limpa?.(); this.atual = null; },
};
// liga sozinho em qualquer cartão de personagem marcado
document.addEventListener('mouseover', e => { const card = e.target.closest?.('[data-prev-id],[data-prev-rasc]'); if (card) Previa.entra(card); else if (Previa.atual) Previa.sai(); });
document.addEventListener('mouseout', e => { const card = Previa.atual?.card; if (card && !card.contains(e.relatedTarget)) Previa.sai(); });
