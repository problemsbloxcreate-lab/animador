/* ===================== notasclaude.js — NOTAS DO CLAUDE dentro de cada personagem (decisão do dono, 30/10/2026) =====================
   Um guia que viaja COM o personagem (def.claude: nuvem, .atelieanimador, animações) para qualquer conversa do Claude saber
   como ele foi montado, o que já foi feito (expressões, poses, rig, correções) e como transformá-lo num bom rig no Animador.
   Não aparece na tela no dia a dia: só no menu do Ateliê › "Notas para o Claude…" (discreto) e pelo console.
     def.claude = { guia: 'texto livre (como mexer neste personagem)', registro: [{ em, oque, como, por }] }
   Pelo console (Claude no navegador da pessoa, Ateliê aberto no personagem):
     NotasClaude.ler()                         → o guia + o registro do personagem aberto (texto pronto para ler)
     NotasClaude.anotar('o que fiz', 'como')   → acrescenta no registro (vai para a nuvem com o personagem)
     NotasClaude.guia('texto')                 → troca o guia inteiro
   No Animador: Plano.notas('Lumi') lê as do personagem da animação. Sem chaves, e-mails nem senhas aqui dentro (é texto do personagem). */
'use strict';
const NotasClaude = {
  MAX_REG: 200, MAX_TXT: 4000, MAX_GUIA: 20000,
  limpa(t, max) { return String(t ?? '').replace(/\u0000/g, '').slice(0, max); },
  de(def) { const c = def?.claude || {}; return { guia: this.limpa(c.guia, this.MAX_GUIA), registro: Array.isArray(c.registro) ? c.registro.slice(-this.MAX_REG) : [] }; },
  // texto para ler (o que outra conversa precisa saber antes de mexer)
  texto(def) {
    if (!def) return 'Nenhum personagem.'; const c = this.de(def), n = def.nome || 'Personagem';
    const L = [`# Notas do Claude — ${n}`, '', '## Guia', c.guia || '(sem guia ainda)', '', `## Registro (${c.registro.length})`];
    for (const r of c.registro) L.push(`- ${new Date(r.em || 0).toLocaleString('pt-BR')} · ${r.oque}${r.como ? `\n  como: ${r.como}` : ''}`);
    return L.join('\n');
  },
  alvo(nome) { // Ateliê aberto = o personagem dele; no Animador, pelo nome (só leitura: a cópia da animação não é a da equipe)
    if (typeof Atelie !== 'undefined' && Atelie.def && (!nome || IA.acha([Atelie.def], nome))) return { def: Atelie.def, edita: !Atelie.soQuadro && !Atelie.daAnim };
    if (typeof App !== 'undefined' && App.P) { const L = Object.values(App.P.personagens || {}), d = nome ? IA.acha(L, nome) : L[0]; if (d) return { def: d, edita: false }; }
    return { def: null, edita: false };
  },
  ler(nome) { return this.texto(this.alvo(nome).def); },
  muda(fn, rotulo) {
    const a = this.alvo(); if (!a.def) throw new Error('Abra o personagem no Ateliê (completo) primeiro.');
    if (!a.edita) throw new Error('Este é a cópia de uma animação: anote no personagem da equipe (Ateliê completo).');
    const c = this.de(a.def); fn(c); a.def.claude = { guia: this.limpa(c.guia, this.MAX_GUIA), registro: c.registro.slice(-this.MAX_REG) };
    Atelie.commit(rotulo); return this.texto(a.def);
  },
  anotar(oque, como = '', o = {}) {
    if (!String(oque || '').trim()) throw new Error('Diga o que foi feito.');
    return this.muda(c => c.registro.push({ em: Date.now(), oque: this.limpa(oque, 300), como: this.limpa(como, this.MAX_TXT), por: this.limpa(o.por || 'Claude', 40) }), 'Nota para o Claude');
  },
  guia(texto) { return this.muda(c => { c.guia = this.limpa(texto, this.MAX_GUIA); }, 'Guia para o Claude'); },
  // janela discreta do menu do Ateliê: ler o registro e editar o guia
  async abrir() {
    const a = this.alvo(); if (!a.def) return UI.toast('Abra um personagem primeiro.', { kind: 'warn' }); const c = this.de(a.def);
    const body = h(`<div class="nc-j"><div class="nc-t">Guia de como mexer neste personagem e o que já foi feito, para as conversas do Claude lerem antes de mexer. Vai junto com o personagem.</div>
      <label class="nc-l">Guia</label><textarea class="nc-g" rows="9" ${a.edita ? '' : 'readonly'} placeholder="Como este personagem foi montado, nomes das partes, poses/expressões, o que evitar, como fazer o rig no Animador…">${esc(c.guia)}</textarea>
      <label class="nc-l">Registro (${c.registro.length})</label><div class="nc-r">${c.registro.length ? c.registro.slice().reverse().map(r => `<div class="nc-i"><b>${esc(r.oque)}</b><small>${esc(r.por || 'Claude')} · ${fmtDate(r.em)}</small>${r.como ? `<div>${esc(r.como)}</div>` : ''}</div>`).join('') : '<div class="vazio">Nada anotado ainda.</div>'}</div></div>`);
    const v = await UI.modal({ title: 'Notas para o Claude', icon: 'code', width: 620, body, buttons: a.edita ? [{ label: 'Fechar', value: null }, { label: 'Salvar o guia', kind: 'primary', value: 'ok' }] : [{ label: 'Fechar', kind: 'primary', value: null }] });
    if (v === 'ok') { const t = $('.nc-g', body).value; if (t !== c.guia) { this.guia(t); UI.toast('Guia salvo no personagem.', { kind: 'ok' }); } }
  },
};
