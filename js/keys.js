/* ===================== keys.js — atalhos do teclado (personalizáveis) ===================== */
'use strict';

const Keys = {
  // [id, nome, combinação padrão, função]
  list: () => {
    const f = () => 1 / App.fps;
    return [
      ['play', 'Tocar / pausar', 'Space', () => Mic.recording ? LibUI.stopRec() : App.toggle()],
      ['record', 'Gravar voz (liga e para)', 'R', () => LibUI.quickRecord()],
      ['prevFrame', 'Voltar 1 quadro', 'ArrowLeft', () => App.seek(App.t - f())],
      ['nextFrame', 'Avançar 1 quadro', 'ArrowRight', () => App.seek(App.t + f())],
      ['prevSec', 'Voltar 1 segundo', 'Shift+ArrowLeft', () => App.seek(App.t - 1)],
      ['nextSec', 'Avançar 1 segundo', 'Shift+ArrowRight', () => App.seek(App.t + 1)],
      ['prevEdit', 'Ir para o corte anterior', 'ArrowUp', () => Actions.jumpEdit(-1)],
      ['nextEdit', 'Ir para o próximo corte', 'ArrowDown', () => Actions.jumpEdit(1)],
      ['home', 'Ir para o início', 'Home', () => App.seek(0)],
      ['end', 'Ir para o fim', 'End', () => App.seek(App.duration)],
      ['split', 'Dividir no cursor', 'S', () => Actions.split()],
      ['drawBrush', 'Desenho: pincel', 'B', () => EdDraw.setTool(EdDraw.tool === 'pincel' ? null : 'pincel')],
      ['drawPencil', 'Desenho: lápis', 'P', () => EdDraw.setTool(EdDraw.tool === 'lapis' ? null : 'lapis')],
      ['drawEraser', 'Desenho: borracha', 'E', () => EdDraw.setTool(EdDraw.tool === 'borracha' ? null : 'borracha')],
      ['drawBucket', 'Desenho: balde', 'G', () => EdDraw.setTool(EdDraw.tool === 'balde' ? null : 'balde')],
      ['drawPick', 'Desenho: conta-gotas', 'I', () => EdDraw.setTool(EdDraw.tool === 'conta' ? null : 'conta')],
      ['drawOnion', 'Papel-cebola', 'O', () => EdDraw.toggleOnion()],
      ['drawPrev', 'Desenho: quadro anterior', ',', () => EdDraw.step(-1)],
      ['drawNext', 'Desenho: próximo quadro', '.', () => EdDraw.step(1)],
      ['razor', 'Ferramenta lâmina (cortar)', 'C', () => Timeline.setTool('razor')],
      ['select', 'Ferramenta seleção', 'V', () => Timeline.setTool('select')],
      ['delete', 'Excluir / fechar espaço vazio', 'Delete', () => App.selGap ? Actions.closeGap(App.selGap) : App.selFx ? Actions.removeFxInst(App.selFx) : App.sel.size && Actions.deleteSel()],
      ['delete2', 'Excluir (tecla alternativa)', 'Backspace', () => App.selGap ? Actions.closeGap(App.selGap) : App.selFx ? Actions.removeFxInst(App.selFx) : App.sel.size && Actions.deleteSel()],
      ['rippleDelete', 'Excluir e fechar o espaço', 'Shift+Delete', () => App.sel.size && Actions.deleteSel(true)],
      ['deselect', 'Tirar seleção / parar gravação', 'Escape', () => { if (Mic.recording) LibUI.stopRec(); App.clearSel(); }],
      ['nudgeL', 'Mover clipe 1 quadro para trás', 'Alt+ArrowLeft', () => App.sel.size && Actions.nudge(-f())],
      ['nudgeR', 'Mover clipe 1 quadro para frente', 'Alt+ArrowRight', () => App.sel.size && Actions.nudge(f())],
      ['copy', 'Copiar clipes', 'Ctrl+C', () => Actions.copy()],
      ['cut', 'Recortar clipes', 'Ctrl+X', () => Actions.cut()],
      ['paste', 'Colar clipes no cursor', 'Ctrl+V', () => Actions.paste()],
      ['copyFx', 'Copiar efeitos', 'Ctrl+Shift+C', () => Actions.copyEffects()],
      ['pasteFx', 'Colar efeitos', 'Ctrl+Shift+V', () => Actions.pasteEffectsDialog()],
      ['duplicate', 'Duplicar', 'Ctrl+D', () => Actions.duplicate()],
      ['selectAll', 'Selecionar tudo', 'Ctrl+A', () => { if (LibUI.focused && LibUI.tab === 'media') return LibUI.selectAllVisible(); App.select(App.project.clips.map(c => c.id)); }],
      ['undo', 'Desfazer', 'Ctrl+Z', () => App.undo()],
      ['redo', 'Refazer', 'Ctrl+Y', () => App.redo()],
      ['redo2', 'Refazer (alternativo)', 'Ctrl+Shift+Z', () => App.redo()],
      ['keyframe', 'Keyframe de posição/tamanho/giro', 'K', () => Actions.keyAll()],
      ['autokey', 'Modo animar (liga/desliga)', 'A', () => App.setAutoKey(!App.autoKey)],
      ['marker', 'Adicionar marcador', 'M', () => Actions.addMarker()],
      ['snap', 'Grudar (liga/desliga)', 'N', () => Timeline.toggleSnap()],
      ['loop', 'Repetir (loop)', 'L', () => { App.loop = !App.loop; $('#tp-loop').classList.toggle('on', App.loop); }],
      ['fit', 'Ver o projeto inteiro', 'F', () => Timeline.fit()],
      ['heights', 'Trocar altura das faixas', 'H', () => Timeline.cycleHeights()],
      ['back1s', 'Voltar 1 segundo (alternativo)', 'J', () => App.seek(App.t - 1)],
      ['zoomIn', 'Zoom + na linha do tempo', '=', () => Timeline.zoomBy(1.25)],
      ['zoomOut', 'Zoom - na linha do tempo', '-', () => Timeline.zoomBy(.8)],
      ['import', 'Importar mídia', 'Ctrl+I', () => Actions.importDialog()],
      ['save', 'Salvar (neste computador)', 'Ctrl+S', () => App.save()],
      ['saveToon', 'Salvar arquivo .toon', 'Ctrl+Shift+S', () => Actions.saveToon()],
      ['export', 'Exportar vídeo', 'Ctrl+E', () => Exporter.open()],
      ['settings', 'Configurações do projeto', 'Ctrl+P', () => Actions.projectSettings()],
      ['assistant', 'Abrir o Assistente (IA)', 'Ctrl+J', () => Assistant.toggle()],
    ];
  },
  ALWAYS: new Set(['save', 'saveToon', 'export']), // funcionam até digitando
  custom: (() => { try { return JSON.parse(localStorage.getItem('ps-keys') || '{}'); } catch { return {}; } })(),
  get(id) { if (id in this.custom) return this.custom[id]; const r = this.list().find(x => x[0] === id); return r ? r[2] : ''; },
  label(id) { return (this.get(id) || '').replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('Space', 'Espaço').replace('Delete', 'Del').replace('Escape', 'Esc'); },
  combo(e) {
    let k = e.key; if (k === ' ') k = 'Space'; else if (k === '+') k = '='; else if (k === '_') k = '-'; else if (k.length === 1) k = k.toUpperCase();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(k)) return null;
    return [(e.ctrlKey || e.metaKey) && 'Ctrl', e.shiftKey && k.length > 1 || e.shiftKey && /[A-Z0-9=\-]/.test(k) ? 'Shift' : null, e.altKey && 'Alt', k].filter(Boolean).join('+');
  },
  save() { try { localStorage.setItem('ps-keys', JSON.stringify(this.custom)); } catch { } },
  init() {
    document.addEventListener('keydown', e => {
      if (this.capturing) return;
      if (!App.project || $('#editor').classList.contains('hidden')) return;
      if ($('.modal-back')) return;
      const tg = e.target, typing = tg.tagName === 'INPUT' && !['range', 'checkbox', 'color', 'button'].includes(tg.type) || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT';
      const c = this.combo(e); if (!c) return;
      const hit = this.list().find(([id]) => this.get(id) === c);
      if (!hit) return;
      if (typing && !this.ALWAYS.has(hit[0])) return;
      e.preventDefault(); hit[3]();
    });
  },
  // janela de atalhos: clique numa tecla para trocar
  open() {
    const body = h(`<div><p style="margin-top:0">Clique numa tecla para trocar e aperte a nova combinação (ex.: <kbd>Ctrl</kbd>+<kbd>B</kbd>). <kbd>Esc</kbd> cancela.</p><div class="kbd-list" data-l style="max-height:52vh;overflow:auto;padding-right:6px"></div></div>`);
    const fill = () => {
      const l = $('[data-l]', body); l.innerHTML = '';
      this.list().forEach(([id, name, def]) => {
        const changed = id in this.custom && this.custom[id] !== def;
        const k = h(`<button class="btn sm" style="justify-content:flex-start;min-width:120px;${changed ? 'border-color:var(--cy)' : ''}" title="Clique para trocar">${this.get(id) ? `<kbd>${esc(this.label(id))}</kbd>` : '<span style="color:var(--tx3)">sem atalho</span>'}</button>`);
        const n = h(`<span style="display:flex;align-items:center;gap:6px">${esc(name)}${changed ? `<span class="chip" data-r title="Voltar este ao padrão (${esc(def)})">padrão</span>` : ''}</span>`);
        k.onclick = () => this.capture(id, k, fill);
        if ($('[data-r]', n)) $('[data-r]', n).onclick = () => { delete this.custom[id]; this.save(); fill(); App.initMenus(); };
        l.append(k, n);
      });
    };
    fill();
    UI.modal({ title: 'Atalhos do teclado', icon: 'keyboard', width: 620, body, buttons: [{ label: 'Voltar tudo ao padrão', left: true, onClick: async () => { if (await UI.confirm({ title: 'Voltar ao padrão?', msg: 'Todos os atalhos que você trocou voltam a ser os originais.', ok: 'Voltar ao padrão' })) { this.custom = {}; this.save(); fill(); App.initMenus(); UI.toast('Atalhos voltaram ao padrão', { kind: 'ok' }); } return false; } }, { label: 'Pronto', kind: 'primary' }] });
  },
  capture(id, btn, refill) {
    btn.innerHTML = '<span style="color:var(--cy)">aperte as teclas…</span>'; this.capturing = true;
    const on = e => {
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') return done();
      const c = this.combo(e); if (!c) return;
      const other = this.list().find(([o]) => o !== id && this.get(o) === c);
      if (other) { this.custom[other[0]] = ''; UI.toast(`"${esc(c)}" era de <b>${esc(other[1])}</b> — esse ficou sem atalho`, { kind: 'warn', time: 4500 }); }
      this.custom[id] = c; this.save(); done();
    };
    const done = () => { document.removeEventListener('keydown', on, true); this.capturing = false; refill(); App.initMenus(); };
    document.addEventListener('keydown', on, true);
  },
};
