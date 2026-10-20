/* ===================== assistant.js — Assistente: "anime aqui pra mim" ===================== */
'use strict';

/* ---------- análise do áudio (onde fala, batidas, gritos) ---------- */
const AudioAnalysis = {
  cache: new Map(),
  // envelope de volume a 50 quadros/s, no tempo da linha do tempo
  envelope(clip) {
    const key = clip.id + ':' + clip.assetId + ':' + clip.offset + ':' + clip.dur + ':' + clip.speed;
    if (this.cache.has(key)) return this.cache.get(key);
    const buf = Assets.audioBuffer(clip.assetId, Assets.ctx()); if (!buf) return null;
    const ch = buf.getChannelData(0), ch2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch, sr = buf.sampleRate, rate = 50, sp = clip.speed || 1;
    const n = Math.floor(clip.dur * rate), env = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t0 = (clip.offset || 0) + i / rate * sp, a = Math.floor(t0 * sr), b = Math.min(ch.length, Math.floor((t0 + sp / rate) * sr));
      let s = 0, c = 0; for (let k = a; k < b; k += 2) { const v = (ch[k] + ch2[k]) / 2; s += v * v; c++; }
      env[i] = c ? Math.sqrt(s / c) * ((clip.volume ?? 100) / 100) : 0;
    }
    const r = { env, rate, start: clip.start }; this.cache.set(key, r); return r;
  },
  analyze(clip) {
    const e = this.envelope(clip); if (!e) return null;
    const { env, rate, start } = e, sorted = Array.from(env).sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * .95)] || 0, max = sorted[sorted.length - 1] || 0;
    const thr = Math.max(.01, p95 * .22);
    // trechos com voz/som
    const segs = []; let s = -1;
    for (let i = 0; i <= env.length; i++) { const on = i < env.length && env[i] > thr; if (on && s < 0) s = i; if (!on && s >= 0) { segs.push([s / rate, i / rate]); s = -1; } }
    const merged = []; for (const g of segs) { const l = merged[merged.length - 1]; if (l && g[0] - l[1] < .22) l[1] = g[1]; else merged.push([...g]); }
    const speech = merged.filter(g => g[1] - g[0] >= .12).map(([a, b]) => [round(start + a, 2), round(start + b, 2)]);
    // batidas (subidas rápidas de volume)
    const on = []; for (let i = 1; i < env.length; i++) on.push(Math.max(0, env[i] - env[i - 1]));
    const mean = on.reduce((a, b) => a + b, 0) / (on.length || 1), sd = Math.sqrt(on.reduce((a, b) => a + (b - mean) ** 2, 0) / (on.length || 1));
    const peaks = []; let last = -1;
    for (let i = 1; i < on.length - 1; i++) if (on[i] > mean + 1.6 * sd && on[i] >= on[i - 1] && on[i] >= on[i + 1] && env[i + 1] > thr * 1.5 && (i - last) / rate > .25) { peaks.push(round(start + (i + 1) / rate, 2)); last = i; }
    // momentos bem altos (grito)
    const loud = []; s = -1; const lt = Math.max(thr * 3, max * .78);
    for (let i = 0; i <= env.length; i++) { const o = i < env.length && env[i] > lt; if (o && s < 0) s = i; if (!o && s >= 0) { if ((i - s) / rate > .08) loud.push([round(start + s / rate, 2), round(start + i / rate, 2)]); s = -1; } }
    return { speech, peaks, loud, max };
  },
  sources() { const P = App.project || (typeof Desenho !== 'undefined' ? Desenho._ed : null); if (!P) return []; return P.clips.filter(c => (c.type === 'audio' || (c.type === 'video' && Assets.meta(c.assetId)?.hasAudio)) && !c.muted && c.assetId); },
};

/* ---------- executa a lista de ações (mesmo formato para a IA e para os comandos rápidos) ---------- */
const AssistExec = {
  KNOWN: ['limpar_voz', 'musica', 'moldura', 'fundo', 'boca', 'enquadrar', 'abaixar_com_voz', 'legendas', 'excluir_faixa', 'limpar_linha_do_tempo', 'animacao', 'efeito', 'transicao', 'keyframe', 'propriedade', 'mover', 'adicionar_midia', 'texto', 'forma', 'cor', 'som', 'marcador', 'remover_animacoes', 'recortar_sprite', 'trocar_midia', 'recortar', 'encaixe', 'dividir', 'excluir', 'duplicar', 'volume', 'velocidade', 'faixa_nova', 'separar_audio', 'renomear', 'espelhar', 'posicionar', 'preso_a', 'pivo', 'visivel', 'separar_sprites', 'pedir_permissao', 'personagem_editavel', 'boneco_reacao', 'boneco_girar', 'boneco_atuar', 'boneco_olhar', 'atualizar_projeto', 'corrigir_personagem', 'limpar_ruido'],
  clamp01(c, t) { return clamp(App.frame(t - c.start), 0, Math.max(0, c.dur - 1 / App.fps)); },
  describe(a) {
    const c = a.clipe && App.clip(a.clipe), cn = c ? `"${c.name || c.type}"` : '';
    const t = v => fmtSec(+v || 0);
    switch (a.tipo) {
      case 'personagem_editavel': return `Separar boca e olhos de ${cn} (vira personagem editável)`;
      case 'boneco_reacao': return `Reação de ${cn} em ${t(a.inicio)}: ${[a.expressao !== undefined && 'expressão ' + a.expressao, a.olhos !== undefined && 'olhos ' + a.olhos, a.boca !== undefined && 'boca ' + a.boca, a.pose && 'pose ' + a.pose].filter(Boolean).join(', ')}${a.duracao ? ' por ' + t(a.duracao) : ''}`;
      case 'boneco_girar': return `Girar "${a.parte}" de ${cn} para ${a.graus}° em ${t(a.inicio)}`;
      case 'atualizar_projeto': return 'Atualiza o projeto para a versão nova';
      case 'corrigir_personagem': return `Procura e corrige erros em ${cn}`;
      case 'limpar_ruido': return `Tira o ruído de ${cn}`;
      case 'boneco_olhar': return `${cn} olha para ${a.olhar || 'o centro'} em ${t(a.inicio)}${a.duracao ? ' por ' + t(a.duracao) : ''}`;
      case 'boneco_atuar': return `Animar ${cn} pela voz (boca, piscadas, acenos${a.intensidade ? ', ' + a.intensidade : ''})`;
      case 'animacao': return `${ANIMS[a.anim]?.name || a.anim} em ${cn} — ${t(a.inicio)} (${t(a.duracao || ANIMS[a.anim]?.dur)})`;
      case 'efeito': return `Efeito ${FX[a.efeito]?.name || a.efeito} ${c ? 'em ' + cn : 'na tela toda'} — ${t(a.inicio)} (${t(a.duracao || FX[a.efeito]?.dur)})`;
      case 'transicao': return `Transição de ${a.lado === 'out' ? 'saída' : 'entrada'} ${TRANS[a.transicao]?.name || a.transicao} em ${cn}`;
      case 'keyframe': return Array.isArray(a.pontos) && a.pontos.length ? `Animar ${ANIMATABLE[a.prop]?.l || a.prop} de ${cn}: ${a.pontos.slice(0, 6).map(q => q.valor + ' (' + t(q.tempo) + ')').join(' → ')}${a.pontos.length > 6 ? ' …' : ''}` : `Keyframe ${ANIMATABLE[a.prop]?.l || a.prop} = ${a.valor} em ${cn} — ${t(a.tempo)}`;
      case 'propriedade': return `${ANIMATABLE[a.prop]?.l || a.prop} = ${a.valor} em ${cn}`;
      case 'mover': return `Mover ${cn} para ${t(a.inicio)}${a.duracao ? ' com ' + t(a.duracao) : ''}`;
      case 'adicionar_midia': return `Colocar "${Assets.meta(a.midia)?.name || a.midia}" em ${t(a.inicio)}`;
      case 'texto': return `Texto "${String(a.texto).slice(0, 40)}" em ${t(a.inicio)} (${t(a.duracao || 3)})`;
      case 'forma': return `Forma ${SHAPES[a.forma] || a.forma} em ${t(a.inicio)}`;
      case 'cor': return `Filtro ${COLOR_PRESETS[a.filtro]?.name || a.filtro} em ${cn}`;
      case 'som': return `Som ${String(a.som).startsWith('lib:') ? '"' + (SoundLib.find(a.som)?.name || a.som).replace(/\.[^.]+$/, '') + '" (biblioteca)' : SOUNDS.defs[a.som]?.name || a.som} em ${t(a.inicio)}${a.volume ? ' · ' + a.volume + '%' : ''}`;
      case 'boca': return `Boca falando em ${cn} (troca para "${Assets.meta(a.midia)?.name || a.midia}" quando houver voz)`;
      case 'limpar_voz': return `Limpar a voz de ${cn}${a.cortar_pausas === false ? '' : ' (tirar pausas)'}`;
      case 'musica': return `Gerar música de fundo ${a.estilo || 'animada'}`;
      case 'moldura': return `Moldura ${a.forma === 'nenhuma' ? 'removida' : 'em círculo'} em ${cn}`;
      case 'fundo': return `Fundo ${a.padrao && a.padrao !== 'nenhum' ? PATTERNS[a.padrao] || a.padrao : 'cor'} em ${t(a.inicio || 0)} (${t(a.duracao || 5)})`;
      case 'abaixar_com_voz': return `Abaixar ${cn} quando tiver voz (${a.quanto ?? 30}%)`;
      case 'enquadrar': return `Enquadrar ${cn}: ${FRAMES[a.modo]?.l || a.modo}${a.lado ? ' (' + a.lado + ')' : ''}`;
      case 'marcador': return `Marcador "${a.nome || ''}" em ${t(a.tempo)}`;
      case 'remover_animacoes': return `Tirar as animações e efeitos de ${cn}`;
      case 'recortar_sprite': return `Recortar ${(a.partes || []).length} parte(s) de "${Assets.meta(a.midia)?.name || a.midia}" (${(a.partes || []).map(x => x.nome).join(', ')}) → pasta "${a.pasta || 'Sprites'}"`;
      case 'trocar_midia': return `Trocar a imagem de ${cn} por "${Assets.meta(a.midia)?.name || a.midia}"`;
      case 'recortar': return `Recortar ${cn} (esq ${a.l || 0}%, dir ${a.r || 0}%, cima ${a.t || 0}%, baixo ${a.b || 0}%)`;
      case 'encaixe': return `${cn}: ${{ contain: 'ajustar à tela', cover: 'preencher a tela', stretch: 'esticar', none: 'tamanho original' }[a.modo] || a.modo}`;
      case 'dividir': return `Dividir ${cn} em ${t(a.tempo)}`;
      case 'excluir': return `Excluir ${cn}`;
      case 'duplicar': return `Duplicar ${cn} para ${t(a.inicio)}`;
      case 'volume': return `Volume de ${cn} = ${a.valor}%`;
      case 'velocidade': return `Velocidade de ${cn} = ${a.valor}x`;
      case 'faixa_nova': return `Nova faixa de ${{ visual: 'vídeo', audio: 'áudio', fx: 'efeitos' }[a.faixa_tipo] || 'vídeo'}${a.nome ? ' "' + a.nome + '"' : ''}`;
      case 'separar_audio': return `Separar o áudio de ${cn}`;
      case 'renomear': return `Renomear ${cn} para "${a.nome}"`;
      case 'espelhar': return `Espelhar ${cn}`;
      case 'legendas': { const aid = a.midia || App.clip(a.clipe)?.assetId; return `Legendas na tela a partir da transcrição de "${Assets.meta(aid)?.name || aid}"${a.estilo ? ' (' + (TEXT_STYLES[a.estilo]?.name || a.estilo) + ')' : ''}`; }
      case 'excluir_faixa': { const tk = App.track(a.faixa); return `Excluir a faixa "${tk?.name || a.faixa}"`; }
      case 'limpar_linha_do_tempo': return `Apagar tudo da linha do tempo${a.faixas ? ' (e recriar as faixas)' : ''}`;
      case 'posicionar': return `Posicionar ${cn}${a.x !== undefined ? ' x ' + a.x : ''}${a.y !== undefined ? ' y ' + a.y : ''}${a.escala !== undefined ? ' escala ' + a.escala : ''}${a.rotacao !== undefined ? ' girar ' + a.rotacao + '°' : ''}${a.opacidade !== undefined ? ' opacidade ' + a.opacidade + '%' : ''}`;
      default: return a.tipo;
    }
  },
  valid(a) {
    const NEW = this._newIds || new Set();
    const need = ['preso_a', 'pivo', 'visivel', 'animacao', 'transicao', 'keyframe', 'propriedade', 'mover', 'cor', 'remover_animacoes', 'recortar', 'encaixe', 'dividir', 'excluir', 'duplicar', 'volume', 'velocidade', 'separar_audio', 'renomear', 'espelhar', 'posicionar', 'enquadrar', 'boca'];
    if (need.includes(a.tipo) && typeof a.clipe === 'string' && (/^novo/.test(a.clipe) || NEW.has(a.clipe))) return null; // criado antes nesta mesma lista
    if (need.includes(a.tipo) && !App.clip(a.clipe)) return 'clipe não encontrado';
    if (a.tipo === 'animacao' && !ANIMS[a.anim]) return 'animação desconhecida';
    if (a.tipo === 'efeito' && !FX[a.efeito]) return 'efeito desconhecido';
    if (a.tipo === 'efeito' && a.clipe && !App.clip(a.clipe) && !(/^novo/.test(a.clipe) || NEW.has(a.clipe))) return 'clipe não encontrado';
    if (a.tipo === 'transicao' && !TRANS[a.transicao]) return 'transição desconhecida';
    if ((a.tipo === 'keyframe' || a.tipo === 'propriedade') && !ANIMATABLE[a.prop]) return 'propriedade desconhecida';
    if (a.tipo === 'keyframe' && !(Array.isArray(a.pontos) && a.pontos.length) && (!isFinite(+a.tempo) || !isFinite(+a.valor))) return 'keyframe sem tempo/valor';
    if (!a.tipo || typeof a.tipo !== 'string') return 'ação sem tipo';
    if (!this.KNOWN.includes(a.tipo)) return 'tipo de ação desconhecido: ' + a.tipo;
    const isNew = v => typeof v === 'string' && (/^(novo|spr|faixa)/.test(v) || NEW.has(v) || (v.startsWith('equipe:') && typeof TeamLib !== 'undefined' && TeamLib.enabled && !!TeamLib.find(v)));
    if ((a.tipo === 'adicionar_midia' || a.tipo === 'trocar_midia') && !Assets.meta(a.midia) && !isNew(a.midia)) return 'mídia não encontrada';
    if (a.tipo === 'trocar_midia' && !App.clip(a.clipe) && !isNew(a.clipe)) return 'clipe não encontrado';
    if (a.tipo === 'recortar_sprite' && (!Assets.meta(a.midia) || !Array.isArray(a.partes) || !a.partes.length)) return 'folha de sprites não encontrada';
    if (a.tipo === 'som' && (String(a.som).startsWith('lib:') ? !SoundLib.find(a.som) : !SOUNDS.defs[a.som])) return 'som desconhecido';
    if (a.tipo === 'fundo' && a.padrao && a.padrao !== 'nenhum' && !PATTERNS[a.padrao]) return 'padrão de fundo desconhecido';
    if (a.tipo === 'enquadrar' && !FRAMES[a.modo]) return 'enquadramento desconhecido';
    if (a.tipo === 'excluir_faixa' && !App.track(a.faixa) && !isNew(a.faixa)) return 'faixa não encontrada';
    if (a.tipo === 'legendas') { const aid = a.midia || App.clip(a.clipe)?.assetId; if (!aid || !Transcribe.get(aid)?.segs?.length) return 'esse áudio não tem transcrição'; }
    if (a.tipo === 'cor' && !COLOR_PRESETS[a.filtro]) return 'filtro desconhecido';
    return null;
  },
  // o que uma lista de ações vai APAGAR (para avisar antes)
  deletions(list) {
    const out = [], p = App.project, nm = c => `"${c.name || c.text?.text?.slice(0, 20) || c.type}" (${{ image: 'imagem', gif: 'GIF', video: 'vídeo', audio: 'áudio', text: 'texto', shape: 'forma', color: 'cor', fx: 'efeito de tela' }[c.type] || c.type}, ${fmtSec(c.start)})`;
    for (const a of list) {
      if (a.tipo === 'limpar_linha_do_tempo') { out.push({ t: `TUDO da linha do tempo: ${p.clips.length} clipe(s)${a.faixas ? ` e as ${p.tracks.length} faixas (são recriadas vazias)` : ''}${a.marcadores ? ` e ${p.markers.length} marcador(es)` : ''}`, n: p.clips.length + (a.faixas ? p.tracks.length : 0), big: true }); }
      else if (a.tipo === 'excluir_faixa') { const tk = App.track(a.faixa); if (tk) { const k = p.clips.filter(c => c.trackId === tk.id).length; out.push({ t: `Faixa "${tk.name}"${k ? ` com ${k} clipe(s)` : ' (vazia)'}`, n: 1 + k }); } }
      else if (a.tipo === 'excluir') { const c = App.clip(a.clipe); if (c) out.push({ t: 'Clipe ' + nm(c), n: 1 }); }
      else if (a.tipo === 'remover_animacoes') { const c = App.clip(a.clipe); if (c && (c.anims.length || c.fx.length)) out.push({ t: `${c.anims.length + c.fx.length} animação(ões)/efeito(s) de ${nm(c)}`, n: c.anims.length + c.fx.length }); }
    }
    return out;
  },
  // recorta partes de uma imagem (folha de sprites) e salva como imagens novas numa pasta
  async cutSprites(a, created) {
    const rt = Assets.get(a.midia); if (!rt) return 0;
    const el = rt.meta.kind === 'gif' ? Assets.gifFrame(rt, 0) : rt.img, W = rt.meta.w, H = rt.meta.h;
    const p = App.project; p.folders ||= []; p.assetFolders ||= {};
    const fname = String(a.pasta || (rt.meta.name.replace(/\.[^.]+$/, '') + ' (sprites)'));
    let f = p.folders.find(x => x.name === fname); if (!f) { f = { id: uid('f_'), name: fname }; p.folders.push(f); }
    let n = 0;
    for (const part of a.partes) {
      const l = clamp(+part.l || 0, 0, 99), t = clamp(+part.t || 0, 0, 99), r = clamp(+part.r || 0, 0, 99), b = clamp(+part.b || 0, 0, 99);
      const sx = W * l / 100, sy = H * t / 100, sw = Math.max(1, W * (1 - (l + r) / 100)), sh = Math.max(1, H * (1 - (t + b) / 100));
      const cv = document.createElement('canvas'); cv.width = Math.round(sw); cv.height = Math.round(sh); cv.getContext('2d').drawImage(el, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
      const nrt = await Assets.addBlob(blob, `${String(part.nome || 'parte ' + (n + 1))}.png`, p.id, 'image');
      p.bin.push(nrt.meta.id); p.assetFolders[nrt.meta.id] = f.id;
      if (part.id_novo) created[part.id_novo] = nrt.meta.id;
      n++;
    }
    return n;
  },
  // só coloca música/efeito sonoro se a pessoa PEDIU no pedido atual
  wantsSound() { const re = /\b(som|sons|sonor\w*|m[uú]sica\w*|trilha|barulh\w*|sfx|audio de fundo|áudio de fundo|ducking|soundtrack|beat)\b/i; return re.test(String((typeof Assistant !== 'undefined' && Assistant.lastAsk) || '').slice(0, 6000)); },
  async run(list) {
    const allowSound = this.wantsSound(); if (!allowSound) list = list.filter(a => !['som', 'musica'].includes(a?.tipo));
    let n = 0;
    const created = {}; // ids temporários "novo1" -> id real (clipes e faixas)
    const cid = id => created[id] || id;
    // REGRA: mexer nas imagens (recortar/separar sprites, pedidos da IA de alterar desenho) só depois de PERGUNTAR
    const img = list.filter(a => ['recortar_sprite', 'separar_sprites', 'pedir_permissao', 'personagem_editavel'].includes(a.tipo));
    let imgOk = true;
    if (img.length) {
      imgOk = await UI.confirm({ title: 'A IA quer mexer nas imagens', icon: 'alert', msg: `Antes de continuar, a IA pede permissão para:<ul style="margin:8px 0 0">${img.map(a => `<li>${esc(a.tipo === 'pedir_permissao' ? a.descricao || '' : this.describe ? this.describe(a) : a.tipo)}</li>`).join('')}</ul><p style="margin-top:8px">As imagens originais nunca são apagadas: os recortes viram imagens <b>novas</b> na Mídia.</p>`, ok: 'Pode fazer', cancel: 'Não mexer nas imagens' });
      if (!imgOk) UI.toast('Ok — nenhuma imagem foi alterada. O resto do pedido foi aplicado.', { time: 4000 });
    }
    for (const a0 of list) {
      if (a0.tipo === 'pedir_permissao') continue;
      if (!imgOk && ['recortar_sprite', 'separar_sprites', 'personagem_editavel'].includes(a0.tipo)) continue;
      const a = { ...a0, clipe: a0.clipe ? cid(a0.clipe) : a0.clipe, faixa: a0.faixa ? cid(a0.faixa) : a0.faixa, midia: a0.midia ? cid(a0.midia) : a0.midia };
      if (a.tipo === 'recortar_sprite') { if (!this.valid(a)) n += await this.cutSprites(a, created); continue; }
      if (a.tipo === 'separar_sprites') { const m = Assets.meta(a.midia); if (m && typeof SpriteSplit !== 'undefined') { const ids = await SpriteSplit.run(m, { pasta: a.pasta, juntar: a.juntar !== false, nomes: a.nomes }); (a.ids_novos || []).forEach((k, i) => { if (ids[i]) created[k] = ids[i]; }); n += ids.length; } continue; }
      if (typeof a.midia === 'string' && a.midia.startsWith('equipe:') && typeof TeamLib !== 'undefined' && TeamLib.enabled) { try { a.midia = (await TeamLib.resolve(a.midia)) || a.midia; } catch { } }
      if (this.valid(a)) continue;
      const c = a.clipe ? App.clip(a.clipe) : null;
      if (!c && a.clipe && !['efeito', 'excluir_faixa', 'limpar_linha_do_tempo', 'legendas'].includes(a.tipo)) continue; // id temporário que não chegou a ser criado
      if (a.tipo === 'personagem_editavel') { if (c?.type === 'image' && typeof RigEdit !== 'undefined') { await RigEdit.fromImage(c, { yes: true }); n++; } continue; }
      if (a.tipo === 'atualizar_projeto') { Upgrade.run(App.project, true); n++; continue; }
      if (a.tipo === 'corrigir_personagem') { if (c?.type === 'anim') { IAFix.run(c); n++; } continue; }
      if (a.tipo === 'limpar_ruido') { if (c?.type === 'audio') { try { c.assetId = await LimparAudio.clean(c.assetId, +a.forca || .6); n++; } catch { } } continue; }
      if (a.tipo.startsWith('boneco_')) { if (c?.type === 'anim' && typeof RigEdit !== 'undefined' && RigEdit.aiAction(a, c)) n++; continue; }
      const P = (def, extra) => ({ ...defaultParams(def), ...(extra || {}) });
      const snd = (def, on) => { const s = defaultSound(def); if (on === true && def.sound) s.mode = 'default'; if (on === false) s.mode = 'off'; if (typeof on === 'string' && SOUNDS.defs[on]) { s.mode = 'default'; s.id = on; } if (!allowSound) s.mode = 'off'; return s; };
      switch (a.tipo) {
        case 'animacao': { const def = ANIMS[a.anim], st = this.clamp01(c, +a.inicio || c.start), du = Math.max(1 / App.fps, Math.min(+a.duracao || def.dur, c.dur - st)); c.anims.push({ id: uid('i_'), type: a.anim, start: st, dur: App.frame(du), params: P(def, a.params), sound: snd(def, a.som) }); break; }
        case 'efeito': {
          const def = FX[a.efeito];
          if (!c && a.clipe && !App.clip(a.clipe)) continue;
          if (c) { const st = this.clamp01(c, +a.inicio || c.start), du = Math.max(1 / App.fps, Math.min(+a.duracao || def.dur, c.dur - st)); c.fx.push({ id: uid('i_'), type: a.efeito, start: st, dur: App.frame(du), params: P(def, a.params), sound: snd(def, a.som), amount: a.intensidade ?? 100, fade: 0 }); }
          else { const fc = App.makeClip('fx', { fxType: a.efeito, start: App.frame(+a.inicio || 0), dur: +a.duracao || def.dur }); fc.sfx.params = P(def, a.params); fc.sfx.sound = snd(def, a.som); const tr = App.project.tracks, fv = tr.findIndex(k => k.type === 'visual'); let tk = tr.find((k, i) => k.type === 'fx' && (fv < 0 || i < fv) && Actions.free(k.id, fc.start, fc.start + fc.dur)); if (!tk) tk = Actions.addTrack('fx', 0, true); fc.trackId = tk.id; App.project.clips.push(fc); }
          break;
        }
        case 'transicao': { const def = TRANS[a.transicao]; c[a.lado === 'out' ? 'trOut' : 'trIn'] = { type: a.transicao, dur: Math.min(+a.duracao || def.dur, c.dur / 2), params: P(def, a.params), sound: snd(def, a.som) }; break; }
        case 'keyframe': {
          const pts = Array.isArray(a.pontos) && a.pontos.length ? a.pontos : [{ tempo: a.tempo, valor: a.valor, ease: a.ease }];
          for (const q of pts) { if (!isFinite(+q.tempo) || !isFinite(+q.valor)) continue; KF.set(c, a.prop, clamp(App.frame(+q.tempo - c.start), 0, c.dur), +q.valor, EASE_NAMES[q.ease || a.ease] ? (q.ease || a.ease) : 'inOut'); }
          break;
        }
        case 'propriedade': setPath(c, a.prop, +a.valor); delete c.kf[a.prop]; break;
        case 'mover': c.start = App.frame(Math.max(0, +a.inicio)); if (a.duracao) c.dur = App.frame(Math.max(1 / App.fps, +a.duracao)); if (a.faixa && App.track(a.faixa) && compatible(c, App.track(a.faixa))) c.trackId = a.faixa; break;
        case 'adicionar_midia': { const nc = Actions.clipForAsset(a.midia, +a.inicio || 0); if (!nc) break; if (a.duracao) nc.dur = App.frame(+a.duracao); if (a.recorte) nc.crop = { l: +a.recorte.l || 0, t: +a.recorte.t || 0, r: +a.recorte.r || 0, b: +a.recorte.b || 0 }; if (['contain', 'cover', 'stretch', 'none'].includes(a.encaixe)) nc.tr.fit = a.encaixe; if (a.nome) nc.name = String(a.nome); if (a.espelhar) nc.tr.flipX = true; if (a.x !== undefined) nc.tr.x = +a.x; if (a.y !== undefined) nc.tr.y = +a.y; if (a.escala) nc.tr.scale = +a.escala; Actions.place(nc, a.faixa); if (a.id_novo) created[a.id_novo] = nc.id; break; }
        case 'texto': { const nc = App.makeClip('text', { style: TEXT_STYLES[a.estilo] ? a.estilo : 'youtube', start: App.frame(+a.inicio || 0), dur: +a.duracao || 3 }); nc.text.text = String(a.texto || 'Texto'); if (a.cor) nc.text.color = a.cor; if (a.tamanho) nc.text.size = +a.tamanho; if (a.x !== undefined) nc.tr.x = +a.x; if (a.y !== undefined) nc.tr.y = +a.y; nc.name = nc.text.text.slice(0, 24); Actions.place(nc, a.faixa); if (a.id_novo) created[a.id_novo] = nc.id; break; }
        case 'forma': { const nc = App.makeClip('shape', { kind: SHAPES[a.forma] ? a.forma : 'rect', start: App.frame(+a.inicio || 0), dur: +a.duracao || 3 }); if (a.cor) nc.shape.fill = a.cor; if (a.largura) nc.shape.w = +a.largura; if (a.altura) nc.shape.h = +a.altura; if (a.x !== undefined) nc.tr.x = +a.x; if (a.y !== undefined) nc.tr.y = +a.y; Actions.place(nc, a.faixa); if (a.id_novo) created[a.id_novo] = nc.id; break; }
        case 'cor': { const tint = c.color.tint; c.color = { ...COLOR_DEFAULT(), tint, ...COLOR_PRESETS[a.filtro].v }; break; }
        case 'enquadrar': if (!Framing.apply(c, a.modo, a.lado)) continue; break;
        case 'limpar_voz': { if (!c || c.type !== 'audio') continue; await VoiceClean.apply(c, { cortar: a.cortar_pausas !== false, db: +a.sensibilidade || -30 }); break; }
        case 'moldura': { if (!c || c.type !== 'image') continue; if (a.forma === 'nenhuma') delete c.badge; else c.badge = { ...Badge.DEF(), ...(a.cor ? { cor: a.cor } : {}), ...(a.borda ? { borda: a.borda } : {}) }; break; }
        case 'musica': { const nc = await MusicGen.add({ estilo: a.estilo, bpm: +a.bpm || 0, inicio: +a.inicio || 0, duracao: +a.duracao || 0, volume: +a.volume || 18, abaixar: +a.abaixar || 30 }); if (a.id_novo && nc) created[a.id_novo] = nc.id; break; }
        case 'fundo': { const pat = a.padrao && a.padrao !== 'nenhum' ? { padrao: a.padrao, c1: a.cor1 || a.cor || '#7b4dff', c2: a.cor2 || '#9b78ff', size: +a.tamanho || 120, speed: a.velocidade ?? 40, dir: a.direcao ?? 135, rot: +a.girar || 0, scale2: +a.desenho || .22, ...(a.cor3 ? { c3: a.cor3 } : {}), ...(a.pulsar ? { pulse: +a.pulsar } : {}), ...(a.bolhas ? { bolhas: true } : {}), ...(a.vinheta ? { vinheta: true } : {}), ...(a.transparencia ? { alpha: +a.transparencia / 100 } : {}) } : null; const nc = App.makeClip('color', { color: a.cor1 || a.cor || '#1e88e5', pattern: pat, start: App.frame(+a.inicio || 0), dur: +a.duracao || 5 }); Actions.place(nc, a.faixa && App.track(a.faixa) ? a.faixa : Actions.bottomTrack(nc.start, nc.dur)); if (a.id_novo) created[a.id_novo] = nc.id; break; }
        case 'abaixar_com_voz': if (c.type !== 'audio') continue; c.duck = clamp(+(a.quanto ?? 30), 0, 100); if (c.duck >= 100) delete c.duck; break;
        case 'boca': if (!Assets.meta(a.midia)) continue; c.boca = { midia: a.midia, audio: a.audio && App.clip(a.audio) ? a.audio : null, limite: +a.limite || .35 }; break;
        case 'som': if (String(a.som).startsWith('lib:')) { const lib = SoundLib.find(a.som), pid = lib && await SoundLib.toProject(lib.id), m = pid && Assets.meta(pid); if (!m) continue; const nc = App.makeClip('audio', { start: App.frame(+a.inicio || 0), dur: m.dur || 1, assetId: pid, name: m.name.replace(/\.[^.]+$/, '') }); nc.volume = +a.volume || 40; Actions.place(nc, a.faixa); break; } else { const nc = App.makeClip('audio', { start: App.frame(+a.inicio || 0), dur: SOUNDS.defs[a.som].sec, assetId: 'snd:' + a.som, name: SOUNDS.defs[a.som].name }); if (a.volume) nc.volume = +a.volume; Actions.place(nc, a.faixa); break; }
        case 'marcador': App.project.markers.push({ id: uid('m_'), t: App.frame(+a.tempo || 0), label: String(a.nome || ''), color: a.cor || '#b36bff' }); break;
        case 'remover_animacoes': c.anims = []; c.fx = []; break;
        case 'trocar_midia': Actions.swapAsset(c, a.midia); break;
        case 'recortar': c.crop = { l: clamp(+a.l || 0, 0, 99), t: clamp(+a.t || 0, 0, 99), r: clamp(+a.r || 0, 0, 99), b: clamp(+a.b || 0, 0, 99) }; break;
        case 'encaixe': if (['contain', 'cover', 'stretch', 'none'].includes(a.modo)) c.tr.fit = a.modo; break;
        case 'dividir': { const nb = Actions.splitCore(c, App.frame(+a.tempo)); if (nb && a.id_novo) created[a.id_novo] = nb.id; break; }
        case 'excluir': App.project.clips = App.project.clips.filter(x => x !== c); break;
        case 'duplicar': { const d = clone(c); d.id = uid('c_'); d.start = App.frame(+a.inicio ?? c.start + c.dur); if (a.faixa && App.track(a.faixa)) d.trackId = a.faixa; App.project.clips.push(d); Actions.resolveOverlaps([d]); if (a.id_novo) created[a.id_novo] = d.id; break; }
        case 'volume': c.volume = clamp(+a.valor, 0, 200); break;
        case 'velocidade': c.speed = clamp(+a.valor || 1, .1, 8); break;
        case 'faixa_nova': { const tp = ['visual', 'audio', 'fx'].includes(a.faixa_tipo) ? a.faixa_tipo : 'visual'; const tr = App.project.tracks, i = tp === 'audio' ? tr.length : tp === 'fx' ? 0 : Math.max(0, tr.findIndex(t => t.type === 'visual')); const tk = Actions.addTrack(tp, a.posicao ?? i, true); if (a.nome) tk.name = String(a.nome); if (a.id_novo) created[a.id_novo] = tk.id; break; }
        case 'separar_audio': if (c.type === 'video' && Assets.meta(c.assetId)?.hasAudio) { const au = App.makeClip('audio', { start: c.start, dur: c.dur, offset: c.offset, assetId: c.assetId, name: (c.name || 'Vídeo') + ' (áudio)' }); au.speed = c.speed; Actions.place(au); c.muted = true; } break;
        case 'renomear': c.name = String(a.nome || c.name); break;
        case 'espelhar': c.tr.flipX = !c.tr.flipX; break;
        case 'preso_a': { const pid = a.pai ? cid(a.pai) : null; if (pid && App.clip(pid) && pid !== c.id) c.parent = pid; else delete c.parent; break; }
        case 'pivo': { const nx = isFinite(+a.x) ? +a.x : 50, ny = isFinite(+a.y) ? +a.y : 50; c.tr.ax = clamp(nx / 100, -1, 2); c.tr.ay = clamp(ny / 100, -1, 2); break; }
        case 'visivel': { const m = { fala: 'fala', falando: 'fala', calado: 'calado', piscando: 'piscar', piscar: 'piscar', aberto: 'naoPiscar', sempre: '' }[a.quando] ?? ''; if (m) c.vis = { modo: m, ...(a.audio ? { audio: cid(a.audio) } : {}), ...(a.cada ? { cada: +a.cada } : {}) }; else delete c.vis; break; }
        case 'legendas': { const aid = a.midia || (c && c.assetId); if (!Transcribe.toSubtitles(aid, { ...a, max: a.max_caracteres, clipe: c?.id, silent: true })) continue; break; }
        case 'excluir_faixa': { const tk = App.track(a.faixa); if (!tk) continue; App.project.clips = App.project.clips.filter(x => x.trackId !== tk.id); App.project.tracks = App.project.tracks.filter(x => x !== tk); break; }
        case 'limpar_linha_do_tempo': {
          const p = App.project; p.clips = []; if (a.marcadores) p.markers = [];
          if (a.faixas) { p.tracks = []; for (const [tp, nm] of [['fx', 'Efeitos 1'], ['visual', 'Vídeo 2'], ['visual', 'Vídeo 1'], ['audio', 'Áudio 1'], ['audio', 'Áudio 2']]) { const tk = Actions.addTrack(tp, p.tracks.length, true); tk.name = nm; } }
          App.sel.clear(); break;
        }
        case 'posicionar': for (const k of ['x', 'y', 'scale', 'rot', 'opacity']) { const v = a[{ scale: 'escala', rot: 'rotacao', opacity: 'opacidade' }[k] || k]; if (v !== undefined && isFinite(+v)) { c.tr[k] = +v; delete c.kf['tr.' + k]; } } break;
        default: continue;
      }
      n++;
    }
    return n;
  },
};

/* ---------- comandos rápidos (funcionam sem IA) ---------- */
const QuickCommands = {
  ANIM_WORDS: [[/pulinho|pular|pula|pulando|saltar/, 'jump'], [/andar|anda|caminhar/, 'walk'], [/correr|corre|correndo/, 'run'], [/tremer de medo|com medo/, 'scared'], [/tremer|treme|tremendo|nervos/, 'shake'], [/balan[cç]ar|balan[cç]a/, 'wobble'], [/fala|falar|falando|boca|conversa/, 'talk'], [/flutuar|flutua/, 'float'], [/pulsar|pulsa/, 'pulse'], [/batimento|cora[cç][aã]o bate/, 'heartbeat'], [/esticar|amassar/, 'squash'], [/crescer|aumentar de tamanho/, 'grow'], [/aparecer|surgir|entrar/, 'popIn'], [/sumir|desaparecer/, 'popOut'], [/cair da tela/, 'fallOff'], [/desmaiar|desmaia/, 'faint'], [/susto|assustar|assusta/, 'scare'], [/tonto|tontura/, 'dizzy'], [/girar|gira|rodar/, 'spin'], [/virar|espelhar/, 'flip'], [/piscar|pisca/, 'blink'], [/sim com a cabe[cç]a|concordar/, 'nodYes'], [/n[aã]o com a cabe[cç]a|negar/, 'nodNo'], [/impacto/, 'zoomPunch']],
  FX_WORDS: [[/glitch|bug/, 'glitch'], [/tv|chiado|chiando|est[aá]tica/, 'tv'], [/tremor de c[aâ]mera|tela tremer|c[aâ]mera tremer|terremoto/, 'shakeCam'], [/zoom de impacto|zoom r[aá]pido/, 'punch'], [/\bzoom\b/, 'zoom'], [/vhs|fita/, 'vhs'], [/flash/, 'flash'], [/dano|tela vermelha/, 'damage'], [/sonho|lembran[cç]a/, 'dream'], [/preto e branco|p&b/, 'bw'], [/linhas de velocidade|anime/, 'speedLines'], [/contorno|borda/, 'outline'], [/brilho/, 'glow'], [/sombra/, 'shadow'], [/vinheta/, 'vignette'], [/barras de cinema|cinema/, 'letterbox'], [/desfoque|borrar/, 'blur'], [/pixel/, 'pixelate'], [/onda|ondula/, 'wave']],
  parse(text) {
    const s = text.toLowerCase(), out = { actions: [], notes: [] };
    // alvo: selecionados, ou clipes citados pelo nome, ou o primeiro clipe visual
    let targets = App.selected().filter(c => !['audio', 'fx'].includes(c.type));
    const named = App.project.clips.filter(c => !['audio', 'fx'].includes(c.type) && c.name && s.includes(c.name.toLowerCase()));
    if (named.length) targets = named;
    if (!targets.length) { const vis = App.project.clips.filter(c => !['audio', 'fx'].includes(c.type) && c.type !== 'color'); const top = App.project.tracks.find(t => t.type === 'visual' && vis.some(c => c.trackId === t.id)); targets = vis.filter(c => top && c.trackId === top.id).slice(0, 1); if (targets.length) out.notes.push(`Usei o clipe "${targets[0].name || targets[0].type}" (selecione outro clipe antes se quiser).`); }
    const sa = s.replace(/quando (ele |ela )?(falar|fala|tiver voz|tiver som|gritar|grita|berrar)|enquanto (ele |ela )?fala|com o [aá]udio|com a voz|no ritmo/g, ' ');
    const anims = this.ANIM_WORDS.filter(([r]) => r.test(sa)).map(([, id]) => id), fxs = this.FX_WORDS.filter(([r]) => r.test(sa)).map(([, id]) => id);
    const screen = /tela toda|tela inteira|na tela/.test(s);
    const comSom = /sem som/.test(s) ? false : /com som/.test(s) ? true : undefined;
    // quando
    const src = AudioAnalysis.sources(), an = src.length ? src.map(c => AudioAnalysis.analyze(c)).filter(Boolean) : [];
    const speech = an.flatMap(x => x.speech).sort((a, b) => a[0] - b[0]), peaks = an.flatMap(x => x.peaks).sort((a, b) => a - b), loud = an.flatMap(x => x.loud);
    const every = s.match(/a cada\s*(\d+(?:[.,]\d+)?)\s*(s|seg|segundo)/), at = s.match(/(?:em|no segundo|aos)\s*(\d+(?:[.,]\d+)?)\s*(?:s|seg|segundo)/), times = s.match(/(\d+)\s*vez(?:es)?/);
    let when = 'cursor';
    if (/quando (ele |ela )?(falar|fala|tiver voz|tiver som)|enquanto fala|com o [aá]udio|com a voz|sincroniz/.test(s)) when = 'speech';
    else if (/batida|ritmo|m[uú]sica|cada pico|nos picos|beat/.test(s)) when = 'peaks';
    else if (/grit|alto|forte|berr/.test(s)) when = 'loud';
    else if (every) when = 'every'; else if (at) when = 'at';
    else if (/come[cç]o|in[ií]cio/.test(s)) when = 'start'; else if (/final|fim\b|termin/.test(s)) when = 'end';
    else if (/tempo todo|o tempo inteiro|sempre|clipe inteiro|inteiro/.test(s)) when = 'whole';
    if (['speech', 'peaks', 'loud'].includes(when) && !src.length) { out.notes.push('Não achei nenhum áudio na linha do tempo para sincronizar.'); return out; }
    const slots = c => {
      const end = c.start + c.dur, inC = t => t >= c.start && t < end;
      if (when === 'speech') return speech.filter(g => g[1] > c.start && g[0] < end).map(([a, b]) => [Math.max(a, c.start), Math.min(b, end) - Math.max(a, c.start)]);
      if (when === 'peaks') return peaks.filter(inC).map(t => [t, null]);
      if (when === 'loud') return loud.filter(g => g[1] > c.start && g[0] < end).map(([a, b]) => [Math.max(a, c.start), Math.max(.3, b - a)]);
      if (when === 'every') { const k = Math.max(.1, parseNum(every[1])), r = []; for (let t = c.start; t < end - .05; t += k) r.push([t, null]); return r; }
      if (when === 'at') return [[parseNum(at[1]), null]];
      if (when === 'start') return [[c.start, null]]; if (when === 'end') return [[Math.max(c.start, end - .6), null]];
      if (when === 'whole') return [[c.start, c.dur]];
      return [[inC(App.t) ? App.t : c.start, null]];
    };
    const count = times ? Math.min(30, +times[1]) : null;
    for (const c of targets) for (const id of anims) {
      const def = ANIMS[id];
      for (const [t, d] of slots(c)) {
        const params = {}; if (count && def.params.some(p => p.k === 'count')) params.count = count;
        if (when === 'speech' && ['jump', 'shake', 'wobble', 'pulse', 'squash'].includes(id) && d) { params.count = Math.max(1, Math.round(d / (def.dur || .5))); }
        out.actions.push({ tipo: 'animacao', clipe: c.id, anim: id, inicio: round(t, 3), duracao: d ? round(d, 3) : def.dur, params, som: comSom });
      }
    }
    for (const id of fxs) {
      const def = FX[id], onScreen = screen || (!targets.length && !def.clipOnly);
      const list = onScreen ? [{ start: 0, dur: Math.max(App.duration, 1), id: null }] : targets.map(c => ({ start: c.start, dur: c.dur, id: c.id }));
      for (const tg of list) for (const [t, d] of slots(tg.id ? App.clip(tg.id) : { start: 0, dur: App.duration })) out.actions.push({ tipo: 'efeito', clipe: tg.id, efeito: id, inicio: round(t, 3), duracao: d ? round(d, 3) : def.dur, som: comSom });
    }
    if (!out.actions.length && !out.notes.length) out.notes.push('Não entendi. Exemplos: "pulinho quando falar", "tremer quando gritar", "glitch na tela toda no começo", "pulinho a cada 2 segundos", "falando quando tiver voz".');
    return out;
  },
};

/* ---------- conversa com a IA (Claude) ---------- */
const AIClient = {
  // Tudo da IA (chave, modelo, limite de gasto, pensar, conferir) é configurado SÓ no servidor do Estúdio Problems, na Cloudflare.
  // O editor só sabe o endereço do servidor (js/config.js). Veja servidor-ia/LEIA-ME.md.
  get server() { return (typeof TURMA_CONFIG !== 'undefined' && TURMA_CONFIG.iaServidor || '').trim().replace(/\/+$/, ''); },
  // login com Google (Firebase) — quando existir, o editor manda o token e o servidor confere
  async authHeader() { try { if (typeof TurmaAuth !== 'undefined' && TurmaAuth.token) { const t = await TurmaAuth.token(); if (t) return { authorization: 'Bearer ' + t }; } } catch { } return {}; },
  get ready() { return !!this.server; },
  remote: null, // o que o servidor informa: { usd, limite, pct, oficial, desde, periodo, modelo, conferir, pensar }
  offline: false,
  addUsage(j) { if (j?.turma_uso) this.remote = { ...(this.remote || {}), ...j.turma_uso }; Assistant.paintUse(); },
  pct() { return this.remote && isFinite(this.remote.pct) ? this.remote.pct : null; },
  periodTxt(p) { return p === 'mes' ? 'neste mês' : 'no total'; },
  get review() { return this.remote?.conferir !== false; },
  get modelName() { return this.MODELS[this.remote?.modelo] || this.remote?.modelo || ''; },
  async fetchRemote() {
    if (!this.server) return;
    try { const r = await fetch(this.server + '/uso', { headers: await this.authHeader() }); if (r.ok) { this.remote = await r.json(); this.offline = false; } else this.offline = true; } catch { this.offline = true; }
    Assistant.paintUse(); if (Assistant.open && !Assistant.log.length) Assistant.paint();
  },
  MODELS: { 'claude-haiku-5-5': 'Haiku 5.5', 'claude-sonnet-5-5': 'Sonnet 5.5', 'claude-opus-5-5': 'Opus 5.5' },
  system() {
    const L = (o, f) => Object.entries(o).map(([id, d]) => `${id} (${d.name}${f ? f(d) : ''})`).join('; ');
    const prm = d => d.params?.length ? ' params: ' + d.params.filter(p => !p.type || p.type === 'select' || p.type === 'ease' || p.type === 'bool').map(p => `${p.k}${p.min !== undefined ? `[${p.min}..${p.max}]` : p.opts ? `[${Object.keys(p.opts).join('|')}]` : ''}`).join(',') : '';
    return `Você é o assistente do editor de vídeo/animação "Estúdio Problems — Animação" (animações estilo Brubs / Mundo Torajo: personagens em imagem parada que dão pulinhos, tremem, falam etc.).
O usuário escreve em português o que quer. FORMATO DA RESPOSTA (obrigatório): uma linha JSON por vez, sem texto fora delas, sem \`\`\`:
{"resumo":"frase curta em português do que você fez"}
{"tipo":...}   ← uma AÇÃO por linha (JSON compacto, sem quebras de linha dentro)
{"tipo":...}
{"fim":true}   ← última linha, quando terminar TODAS as ações
Pode mandar quantas ações precisar (centenas). Se a resposta for cortada por tamanho, eu peço para você continuar de onde parou.

REGRAS IMPORTANTES:
- TODOS os tempos ("inicio", "tempo", "pontos[].tempo") são em SEGUNDOS ABSOLUTOS na linha do tempo (não relativos ao clipe). Animações/efeitos/keyframes de um clipe precisam ficar DENTRO do intervalo dele (início–fim mostrado no contexto).
- Use só ids que existem no contexto (ou ids temporários que você mesmo criou antes na lista com "id_novo"). A ordem das ações importa: crie antes de usar.
- Coordenadas x,y em pixels a partir do CENTRO da tela (x positivo = direita, y positivo = baixo). A tela vai de x=-L/2 a +L/2 e y=-A/2 a +A/2 (L×A no contexto). Mantenha os personagens DENTRO da tela (confira a "caixa na tela" de cada clipe no contexto).
- Tamanho: com encaixe "contain" (padrão), escala 1 = a imagem inteira cabe na tela; escala 0.5 = metade disso. "cover" preenche a tela toda (bom para cenário).
- Faixas de cima ficam NA FRENTE das de baixo. Cenário numa faixa de vídeo de baixo, personagens em faixas acima, textos acima de tudo.
- Seja completo: se o pedido envolve várias falas/cenas, faça TODAS (pode mandar centenas de ações). Não invente mídias que não existem.
Tipos de ação:
- {"tipo":"animacao","clipe":ID,"anim":ANIM,"inicio":s,"duracao":s,"params":{...},"som":true|false|"idDoSom"}
- {"tipo":"efeito","clipe":ID ou null (null = tela toda),"efeito":FX,"inicio":s,"duracao":s,"params":{...},"intensidade":0-100,"som":...}
- {"tipo":"transicao","clipe":ID,"lado":"in"|"out","transicao":TR,"duracao":s}
- {"tipo":"keyframe","clipe":ID,"prop":PROP,"tempo":s,"valor":n,"ease":EASE}  ou vários de uma vez: {"tipo":"keyframe","clipe":ID,"prop":PROP,"pontos":[{"tempo":s,"valor":n,"ease":EASE},...]}
    PROP: ${Object.entries(ANIMATABLE).map(([k, v]) => k + ' (' + v.l + (k === 'tr.opacity' ? ' 0-100' : k === 'tr.scale' || k === 'tr.sx' || k === 'tr.sy' ? ' 1=normal' : k === 'tr.rot' ? ' graus' : k === 'volume' ? ' 0-200' : COLOR_PROPS.find(p => 'color.' + p.k === k) ? ' ' + COLOR_PROPS.find(p => 'color.' + p.k === k).min + '-' + COLOR_PROPS.find(p => 'color.' + p.k === k).max + ', normal ' + COLOR_PROPS.find(p => 'color.' + p.k === k).def : '') + ')').join('; ')}
    EASE: ${Object.keys(EASE_NAMES).join('|')} (o ease do ponto vale para a chegada nele). Zoom de câmera num personagem = keyframes de tr.scale (ex.: 0.7 → 1.1 em 0.3s com "back") + tr.x/tr.y para centralizar.
- {"tipo":"posicionar","clipe":ID,"x":n,"y":n,"escala":n,"rotacao":graus,"opacidade":0-100}  (valor fixo, tira keyframes daquela propriedade)
- {"tipo":"propriedade","clipe":ID,"prop":(igual keyframe),"valor":n}
- {"tipo":"mover","clipe":ID,"inicio":s,"duracao":s,"faixa":ID?}
- {"tipo":"adicionar_midia","midia":ID_DA_MIDIA,"inicio":s,"duracao":s,"x":n,"y":n,"escala":n,"faixa":ID?,"id_novo":"novo1"}  (depois você pode usar "novo1" como clipe nas ações seguintes)
- {"tipo":"texto","texto":"...","estilo":"${Object.keys(TEXT_STYLES).join('|')}","inicio":s,"duracao":s,"x":n,"y":n,"cor":"#hex","tamanho":px,"id_novo":"novo2"}
- {"tipo":"forma","forma":"${Object.keys(SHAPES).join('|')}","inicio":s,"duracao":s,"x":n,"y":n,"cor":"#hex","largura":px,"altura":px,"id_novo":"novo3"}
- {"tipo":"cor","clipe":ID,"filtro":"${Object.keys(COLOR_PRESETS).join('|')}"}
- REGRA DE SOM: NUNCA coloque música ("musica") nem efeitos sonoros ("som", ou "som" ligado em animação/efeito/transição — mande "som":false) se o usuário NÃO pediu som/música no pedido. Pedido de animar, editar, mexer, legendar etc. NÃO é pedido de som.
- SONS LONGOS (trilha, violino, brilho, caixa registradora — tudo que não é efeito rápido de menos de ~1,5 s) NUNCA tocam um em cima do outro: termine o anterior quando o próximo começar. Em parte TRISTE, deixe a música de fundo muda (mute/volume 0) e toque só o som triste.
- {"tipo":"som","som":SOM ou "lib:ID" (som REAL da biblioteca do usuário — prefira),"inicio":s,"volume":0-200}  (efeitos sonoros: volume 20–45 para não cobrir a voz)
- {"tipo":"boca","clipe":ID,"midia":ID_IMAGEM_BOCA_ABERTA,"audio":ID_CLIPE_DA_VOZ?}  (se o personagem tiver uma pose igual com a boca aberta: ela aparece sozinha enquanto a voz toca — use isso quando houver par boca fechada/aberta)
- {"tipo":"limpar_voz","clipe":ID_DO_AUDIO_DE_VOZ,"cortar_pausas":true,"sensibilidade":-30}  (FAÇA PRIMEIRO, antes de montar: tira as pausas, filtra, comprime e normaliza a voz; cria um áudio novo e já transcreve de novo — depois disso use a transcrição NOVA para os tempos. Peça com o pedido "dinâmico/tirar pausas" ou quando a voz estiver baixa/com silêncios longos)
- {"tipo":"musica","estilo":"${Object.keys(MusicGen.ESTILOS).join('|')}","bpm":0,"inicio":0,"duracao":0,"volume":18,"abaixar":30,"id_novo":"novoX"?}  (gera uma música instrumental sem direitos autorais do tamanho do vídeo, baixinha e abaixando com a voz; duracao 0 = até o fim)
- {"tipo":"moldura","clipe":ID_IMAGEM,"forma":"circulo|nenhuma","cor":"#40e0f0","borda":"#ffffff"}  (selo redondo: a imagem fica dentro de um círculo colorido com borda branca e sombra — ótimo para quem é CITADO na fala (ex.: o Problems no círculo ciano), aparecendo com rollIn + estrelinhas + som boing/ding)
- {"tipo":"fundo","padrao":"${Object.keys(PATTERNS).join('|')}|nenhum","cor1":"#fundo","cor2":"#desenho","tamanho":120,"velocidade":40,"direcao":135,"girar":0,"cor3":"#cor_de_baixo"?,"pulsar":0.6?,"bolhas":true?,"vinheta":true?,"transparencia":32?,"inicio":0,"duracao":S,"faixa":ID?,"id_novo":"novoX"?}  (cor3 = fundo em degradê de cor1 para cor3; pulsar = bolinhas pulsando 0–1; bolhas = bolhas grandes subindo; vinheta = bordas escuras; transparencia = % do desenho. O fundo do Shorts do Problems: padrao bolinhas, cor1 #582ed6, cor3 #2896f5, cor2 #ffffff, transparencia 32, pulsar 0.6, bolhas, vinheta, tamanho 150, velocidade 55. fundo que se repete para sempre andando devagar — bolinhas/xadrez/listras etc.; "nenhum" = cor lisa. Use cores próximas entre cor1 e cor2 para não brigar com os personagens; velocidade 20–60 px/s. Coloque na faixa de vídeo MAIS DE BAIXO, cobrindo o vídeo todo)
- {"tipo":"abaixar_com_voz","clipe":ID_DA_MUSICA,"quanto":30}  (ducking: a música fica em "quanto"% do volume enquanto alguém fala e volta sozinha nas pausas — use SEMPRE em música de fundo)
- {"tipo":"enquadrar","clipe":ID,"modo":"corpo|joelho|cintura|busto|rosto","lado":"esq|dir|meio"}  (corta a parte de baixo do desenho e encosta o personagem no pé da tela: corpo todo, barriga pra cima, busto, rosto)
- Reações em cima do personagem: {"tipo":"efeito","clipe":ID,"efeito":"emote","inicio":s,"duracao":1.1,"params":{"kind":"exclamacao|interrogacao|suor|raiva|coracao|estrelas|reticencias|choque|lampada|musica|zzz","side":"dir|esq|meio","size":130}}
- {"tipo":"marcador","tempo":s,"nome":"..."}
- {"tipo":"remover_animacoes","clipe":ID}
- {"tipo":"recortar","clipe":ID,"l":%,"t":%,"r":%,"b":%}  (porcentagem cortada de cada lado — use para pegar só uma parte da imagem, ex.: folha com o boneco de frente e de costas)
- {"tipo":"encaixe","clipe":ID,"modo":"contain|cover|stretch|none"}
- {"tipo":"dividir","clipe":ID,"tempo":s,"id_novo":"novo4"}  (a parte depois do corte vira "novo4")
- {"tipo":"excluir","clipe":ID} · {"tipo":"duplicar","clipe":ID,"inicio":s,"id_novo":"novo5"}
- {"tipo":"volume","clipe":ID,"valor":0-200} · {"tipo":"velocidade","clipe":ID,"valor":0.25-4}
- {"tipo":"faixa_nova","faixa_tipo":"visual|audio|fx","nome":"...","id_novo":"faixa1"}  (use "faixa1" em "faixa" depois)
- {"tipo":"legendas","midia":ID_DO_AUDIO ou "clipe":ID_DO_CLIPE_DE_AUDIO,"estilo":"${Object.keys(TEXT_STYLES).join('|')}","max_caracteres":42,"y":n,"cor":"#hex","tamanho":px}
    (cria uma faixa "Legendas" com um texto por fala, nos tempos EXATOS da transcrição. Para legendas/textos com as falas use SEMPRE esta ação em vez de vários "texto". Depois você pode mudar textos específicos.)
- {"tipo":"excluir_faixa","faixa":ID}  ·  {"tipo":"limpar_linha_do_tempo","faixas":true|false,"marcadores":true|false}  (apaga TODOS os clipes; com "faixas":true também recria as faixas do zero)
    APAGAR: só apague quando o usuário pedir ou quando for necessário para o pedido (ex.: "comece do zero"). O usuário SEMPRE vai ver um aviso e confirmar antes de qualquer coisa ser apagada.
- {"tipo":"separar_audio","clipe":ID} · {"tipo":"renomear","clipe":ID,"nome":"..."} · {"tipo":"espelhar","clipe":ID}
- "adicionar_midia" também aceita "recorte":{"l","t","r","b"}, "encaixe", "nome" e "espelhar":true
- {"tipo":"recortar_sprite","midia":ID,"pasta":"Problems - expressões","partes":[{"nome":"Problems feliz","l":%,"t":%,"r":%,"b":%,"id_novo":"spr1"}, ...]}
    (FOLHA DE SPRITES: olhe a imagem, ache cada pose/expressão — feliz, triste, bravo, assustado, falando, de costas… — e recorte cada uma com margem pequena. Elas viram imagens novas numa pasta da Mídia, e depois você usa "spr1", "spr2"… em "midia")
- {"tipo":"separar_sprites","midia":ID,"pasta":"...","juntar":true,"nomes":["feliz","triste",...],"ids_novos":["spr1","spr2",...]}  (separa AUTOMATICAMENTE cada desenho de uma folha de sprites com fundo transparente — prefira a "recortar_sprite"; "juntar":false para folhas de cenário/objetos)
- PERSONAGEM EDITÁVEL / COM OSSOS (prefira isto a trocar imagens inteiras quando o personagem tiver boca/olhos): {"tipo":"personagem_editavel","clipe":ID_IMAGEM} (separa boca e olhos da imagem PNGtuber num boneco — pede permissão sozinho; depois o clipe vira tipo anim e já anima boca/piscar pela voz) · {"tipo":"boneco_reacao","clipe":ID_ANIM,"inicio":s,"duracao":s,"expressao":"nome ou número do desenho da cabeça","olhos":"abertos|meio fechados|fechados|bravos","boca":"fechada|meio|aberta|grande","pose":"NOME_DA_POSE"} (troca a reação naquele momento; duracao 0 = segura) · {"tipo":"boneco_girar","clipe":ID_ANIM,"parte":"nome da parte","graus":G,"inicio":s,"transicao":quadros} · {"tipo":"boneco_olhar","clipe":ID_ANIM,"inicio":s,"duracao":s,"olhar":"centro|esq|dir|cima|baixo|cima-esq|cima-dir|baixo-esq|baixo-dir"} (pupilas — olhe para quem fala/para o que é citado) · {"tipo":"boneco_atuar","clipe":ID_ANIM,"intensidade":"calmo|normal|expressivo"} (boca pela voz, piscadas, acenos, expressões). Use as reações para dar vida: expressão nova em cada emoção, olhos fechados de riso, olhos bravos no grito, boca grande no grito.
- MANUTENÇÃO: {"tipo":"atualizar_projeto"} (atualiza o projeto/.toon antigo para a versão nova do programa) · {"tipo":"corrigir_personagem","clipe":ID_ANIM} (acha peças soltas, cortes mal feitos e pivôs errados; mostra antes/depois para a pessoa confirmar) · {"tipo":"limpar_ruido","clipe":ID_AUDIO,"forca":0.35|0.6|0.9} (tira chiado/barulho de fundo da voz gravada).
- BONECO COM PARTES: {"tipo":"preso_a","clipe":ID_DA_PARTE,"pai":ID_DO_CORPO} (a parte segue tudo que o corpo faz) · {"tipo":"pivo","clipe":ID,"x":%,"y":%} (ponto de giro dentro da imagem, ex.: ombro) · {"tipo":"visivel","clipe":ID,"quando":"falando|calado|piscando|aberto|sempre","audio":ID_DO_CLIPE_DE_VOZ} (boca fechada aparece "calado", olhos fechados aparecem "piscando" — boca e piscada automáticas)
- {"tipo":"trocar_midia","clipe":ID,"midia":ID ou "spr1"}  (troca a imagem de um clipe mantendo posição e animações — ótimo para mudar a expressão do personagem; use "dividir" antes para trocar só a partir de um momento)

ANIM: ${L(ANIMS, prm)}
FX: ${L(FX, prm)}
TR: ${L(TRANS)}
SOM (sons prontos): ${Object.entries(SOUNDS.defs).map(([k, v]) => k + ' (' + v.name + ')').join('; ')}

${GENRE.text(GENRE.formatOf(App.project))}
${typeof Knowledge !== 'undefined' ? Knowledge.forPrompt() : ''}
FORMATO DESTE PROJETO: ${GENRE.formatOf(App.project) === 'video' ? 'VÍDEO DO YOUTUBE (horizontal) — siga as regras de vídeo' : 'SHORTS (vertical) — siga as regras de Shorts (legendas SEMPRE)'}.
ESTILO "Mundo Torajo"/Brubs: personagens são imagens paradas (PNG) sobre um cenário. Quem fala tem movimento SUTIL (voiceBounce fraco ou talk com amp ≤0,03) enquanto a fala toca — pulinho/tremor só em ênfase, nunca o tempo todo; entram com pop/deslizar; reações com susto/tremer; piadas com zoom de impacto (punch) ou tremor de câmera; cortes secos entre cenas. Faça o cenário ocupar a tela (encaixe cover) numa faixa de vídeo de baixo, personagens numa faixa acima (escala ~0.5–0.9, y positivo para ficarem mais embaixo). Quem fala pode ficar um pouco maior ou dar um pulinho no começo da fala.
Você recebe imagens das mídias para ver o que tem nelas (e decidir recortes, quem é quem, onde posicionar). As imagens vêm com uma GRADE fina por cima a cada 10% (linhas numeradas 10..90 na borda) só para você medir recortes com precisão — a grade NÃO faz parte da imagem. Para "recortar"/"recortar_sprite", meça pela grade: l = % da esquerda até a borda esquerda da parte, r = % da borda direita da parte até o fim da imagem (igual t e b). Deixe ~1-2% de margem e nunca corte cabeça/pés.
PERSONAGENS PELO NOME: se o usuário citar um personagem (ex.: "o Problems", "a Guima"), procure pelo nome do arquivo, da pasta ou olhando as imagens, e use essas mídias. Se houver várias expressões do mesmo personagem, escolha a que combina com a fala/emoção (e troque com "dividir" + "trocar_midia" ao longo da cena). Em momentos fortes (susto, piada, grito), use zoom (keyframes de escala ou o efeito punch) e tremores.
REFERÊNCIAS DE ESTILO: se o contexto tiver "REFERÊNCIAS DE ESTILO", copie aquele estilo (ritmo dos cortes, zooms, tremidas, como os personagens entram/falam/reagem, textos, efeitos), adaptando ao que o projeto tem. Diga no resumo que seguiu a referência.
MÍDIAS CITADAS: o usuário pode citar mídias/clipes no texto como @nome ou "nome" — junto vem o ID entre colchetes. Use exatamente essas mídias/clipes.
TRANSCRIÇÃO: se houver "TRANSCRIÇÃO DOS ÁUDIOS", ela diz exatamente O QUE é falado e QUANDO. Use para saber quem fala o quê, sincronizar a animação "talk" com cada fala, reagir às piadas/gritos no momento certo e fazer legendas (só se pedirem) com o texto e os tempos certos. Confie mais nela do que no roteiro para os tempos.
ROTEIRO: se houver roteiro, siga a ordem das falas. Os trechos de "fala/som" da análise de áudio estão em ordem — associe cada fala do roteiro ao próximo trecho de fala (se tiver menos trechos que falas, junte falas curtas). Use legendas (texto estilo "subtitle") só se o usuário pedir.
Dicas: para "falar com o áudio", use a animação talk nos trechos "fala". Para batidas/ritmo, use jump curtos (0.25–0.4s) nos "picos". Para gritos, shake ou scare nos "altos". Não deixe animações iguais se sobrepondo no mesmo clipe. Por padrão deixe "som":false, a não ser que o usuário peça som. Se não der para fazer algo, explique no "resumo" e mande só o resumo e {"fim":true}.
Se o pedido for ambíguo, escolha o jeito mais comum no estilo Mundo Torajo e diga no "resumo" o que escolheu. O "resumo" deve ser curto e em português simples.
Responda APENAS as linhas JSON (resumo, ações, fim) — sem \`\`\`, sem comentários, sem texto solto.`;
  },
  context() {
    const p = App.project, S = p.settings;
    const tracks = p.tracks.map((t, i) => `${t.id} | ${t.type} | "${t.name}" | ordem ${i + 1}${t.type === 'visual' && i === p.tracks.findIndex(x => x.type === 'visual') ? ' (vídeo mais na frente)' : ''}`).join('\n');
    const box = c => { try { if (['audio', 'fx'].includes(c.type)) return ''; const g = Renderer.geom(p, c, c.start + Math.min(.05, c.dur / 2)), b = g.box; const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => g.m.transformPoint(new DOMPoint(x, y))); const xs = pts.map(q => q.x - S.w / 2), ys = pts.map(q => q.y - S.h / 2); return ` | caixa na tela x ${Math.round(Math.min(...xs))}..${Math.round(Math.max(...xs))} y ${Math.round(Math.min(...ys))}..${Math.round(Math.max(...ys))}`; } catch { return ''; } };
    const cr = c => c.crop && (c.crop.l || c.crop.t || c.crop.r || c.crop.b) ? ` | recorte l${c.crop.l} t${c.crop.t} r${c.crop.r} b${c.crop.b}` : '';
    const clips = p.clips.map(c => `${c.id} | ${c.type} | "${c.name || ''}"${c.assetId ? ' | mídia ' + c.assetId : ''} | faixa ${c.trackId} | ${round(c.start, 2)}s–${round(c.start + c.dur, 2)}s${c.tr ? ` | x ${round(c.tr.x, 1)} y ${round(c.tr.y, 1)} escala ${round(c.tr.scale, 3)}${c.tr.rot ? ' rot ' + c.tr.rot : ''}${c.tr.opacity !== 100 ? ' opac ' + c.tr.opacity : ''}${c.tr.fit && c.tr.fit !== 'contain' ? ' encaixe ' + c.tr.fit : ''}${c.tr.flipX ? ' espelhado' : ''}` : ''}${box(c)}${cr(c)}${c.type === 'audio' || c.type === 'video' ? ' | volume ' + (c.volume ?? 100) : ''}${c.type === 'text' ? ' | texto: "' + (c.text?.text || '').slice(0, 60) + '"' : ''}${c.type === 'fx' ? ' | efeito de tela ' + (c.sfx?.type || c.fxType || '') : ''}${c.kf && Object.keys(c.kf).length ? ' | keyframes: ' + Object.entries(c.kf).map(([k, v]) => k + '×' + (v?.length || 0)).join(',') : ''}${c.anims?.length ? ' | animações: ' + c.anims.map(a => a.type + '@' + round(c.start + a.start, 2) + '+' + round(a.dur, 2)).join(',') : ''}${c.fx?.length ? ' | efeitos: ' + c.fx.map(a => a.type + '@' + round(c.start + a.start, 2)).join(',') : ''}`).join('\n');
    const fname = id => { const f = (p.folders || []).find(x => x.id === (p.assetFolders || {})[id]); return f ? ` | pasta "${f.name}"` : ''; };
    const assets = Assets.list(p.id).map(a => `${a.id} | ${a.kind} | "${a.name}"${fname(a.id)}${a.dur ? ' | ' + round(a.dur, 2) + 's' : ''}${a.w ? ' | ' + a.w + 'x' + a.h : ''}`).join('\n');
    const audio = AudioAnalysis.sources().map(c => { const r = AudioAnalysis.analyze(c); if (!r) return ''; return `Áudio do clipe ${c.id} ("${c.name || ''}"):\n  fala/som: ${r.speech.slice(0, 80).map(g => g[0] + '-' + g[1]).join(', ') || 'nenhum'}\n  picos/batidas: ${r.peaks.slice(0, 80).join(', ') || 'nenhum'}\n  bem alto (gritos): ${r.loud.slice(0, 40).map(g => g[0] + '-' + g[1]).join(', ') || 'nenhum'}`; }).filter(Boolean).join('\n');
    return `PROJETO: "${p.name}" ${S.w}x${S.h} ${S.fps}fps, duração ${round(App.duration, 2)}s. Cursor vermelho em ${round(App.t, 2)}s.
Tela: L=${S.w} A=${S.h} → x vai de ${-S.w / 2} a ${S.w / 2}, y de ${-S.h / 2} a ${S.h / 2}.
Selecionados: ${App.selected().map(c => c.id).join(', ') || 'nenhum'}
${p.markers?.length ? 'Marcadores: ' + p.markers.map(m => `"${m.label || ''}"@${round(m.t, 2)}s`).join(', ') : ''}
FAIXAS (de cima para baixo):
${tracks}
CLIPES:
${clips || '(nenhum)'}
MÍDIAS NA BIBLIOTECA:
${assets || '(nenhuma)'}
${audio ? 'ANÁLISE DE ÁUDIO (segundos na linha do tempo):\n' + audio : ''}
${p.script ? 'ROTEIRO DO USUÁRIO (PRIORIDADE MÁXIMA — siga de perto: ordem das cenas, quem fala cada fala, e transforme cada indicação entre parênteses/colchetes em ação no editor no momento certo da fala; só invente o que o roteiro não diz):\n' + String(p.script).slice(0, 30000) : ''}
${(p.personagens || []).length ? 'PERSONAGENS (o usuário explicou quem é quem):\n' + p.personagens.map(c => `• ${c.nome}: ${c.descricao || ''} · imagens/poses: ${(c.midias || []).filter(id => Assets.meta(id)).map(id => id + ' "' + Assets.meta(id).name + '"').join(', ') || '—'}`).join('\n') : ''}
${p.explicacao ? 'O QUE ACONTECE NO VÍDEO (explicação do usuário):\n' + p.explicacao : ''}
${(p.canaisBase || []).length ? 'CANAIS ESCOLHIDOS COMO BASE: ' + p.canaisBase.map(k => GENRE.CANAIS[k]?.nome).filter(Boolean).join(', ') : ''}${(p.canaisLinks || []).length ? ' · canais citados: ' + p.canaisLinks.join(', ') : ''}${(p.canaisNovos || []).length ? ' · canais novos (dos links): ' + p.canaisNovos.join(', ') : ''}
${typeof RigEdit !== 'undefined' ? RigEdit.forPrompt() : ''}
${typeof TeamLib !== 'undefined' ? TeamLib.forPrompt() : ''}
${typeof SoundLib !== 'undefined' ? SoundLib.forPrompt() : ''}
${typeof Transcribe !== 'undefined' ? Transcribe.forPrompt() : ''}
${typeof StyleRefs !== 'undefined' ? StyleRefs.forPrompt() : ''}`;
  },
  // miniaturas das mídias para a IA "ver" (só as que ainda não foram mandadas nesta conversa)
  sent: new Set(),
  async images() {
    const out = [];
    const list = Assets.list(App.project.id).filter(a => (a.kind === 'image' || a.kind === 'gif' || a.kind === 'video') && !this.sent.has(a.id)).slice(0, 12);
    for (const a of list) {
      const rt = Assets.get(a.id); let el = rt?.img; if (a.kind === 'gif') el = Assets.gifFrame(rt, 0);
      if (a.kind === 'video') { if (!a.thumb) continue; el = new Image(); el.src = a.thumb; await el.decode().catch(() => { }); }
      if (!el) continue;
      const w0 = a.w || el.naturalWidth || el.width, h0 = a.h || el.naturalHeight || el.height, k = Math.min(1, (Math.max(w0, h0) > 900 ? 1024 : 640) / Math.max(w0, h0));
      const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k)); const g = cv.getContext('2d'); g.drawImage(el, 0, 0, cv.width, cv.height);
      if (a.kind !== 'video') this.grid(g, cv.width, cv.height);
      const png = a.kind !== 'video', data = cv.toDataURL(png ? 'image/png' : 'image/jpeg', .8).split(',')[1];
      out.push({ type: 'text', text: `Mídia ${a.id} ("${a.name}", ${a.kind}, ${w0}x${h0}${a.kind === 'video' ? ', um quadro do vídeo' : ''}):` }, { type: 'image', source: { type: 'base64', media_type: png ? 'image/png' : 'image/jpeg', data } });
      this.sent.add(a.id);
    }
    return out;
  },
  // modo CONVERSA: só conversa, não edita
  systemChat() {
    return `Você é o assistente do editor de vídeo/animação "Estúdio Problems — Animação" (animações estilo Brubs / Mundo Torajo). Agora você está no MODO CONVERSA.
- Converse em português do Brasil, de forma simpática, curta e clara. Pode cumprimentar, tirar dúvidas sobre o editor (faixas, keyframes, recortes, efeitos, exportar MP4…), dar ideias de roteiro, piadas, animações e opinar sobre o projeto (você recebe o resumo do projeto e as mídias citadas).
- Neste modo você NÃO consegue mexer no projeto.
- Se a mensagem for um PEDIDO PARA EDITAR/ANIMAR/MEXER no projeto (ex.: "anima aqui", "recorta essa imagem", "deleta tudo", "faz ele pular"), comece a resposta EXATAMENTE com [EDICAO] e diga em uma frase curta que é só desligar a opção "Conversa" (ou clicar no botão que vai aparecer) para você fazer a edição. Pode adiantar em 1–2 frases o que pretende fazer.
- Responda em texto normal (pode usar **negrito** e listas curtas). Nada de JSON.`;
  },
  // grade de 10% por cima da imagem (ajuda a IA a medir recortes)
  grid(g, w, hh) {
    g.save(); g.lineWidth = 1; g.font = `bold ${Math.max(9, Math.round(Math.min(w, hh) / 45))}px sans-serif`; g.textBaseline = 'top';
    for (let i = 1; i < 10; i++) {
      const x = Math.round(w * i / 10) + .5, y = Math.round(hh * i / 10) + .5;
      g.strokeStyle = i === 5 ? 'rgba(255,0,200,.55)' : 'rgba(255,0,200,.3)'; g.setLineDash(i === 5 ? [] : [4, 4]);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, hh); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      g.fillStyle = 'rgba(255,0,200,.9)'; g.fillText(String(i * 10), x + 2, 1); g.fillText(String(i * 10), 1, y + 2);
    }
    g.restore();
  },
  ctrl: null,
  // chama a API com novas tentativas (servidor ocupado, internet caiu…)
  async call(messages, system, onText) {
    const srv = this.server; if (!srv) throw new Error('A IA do Estúdio Problems ainda não foi ligada. Quem cuida do editor precisa configurar o servidor na Cloudflare (servidor-ia/LEIA-ME.md).');
    this.ctrl = new AbortController(); const ctrl = this.ctrl;
    let idle = null; const poke = () => { clearTimeout(idle); idle = setTimeout(() => ctrl.abort('tempo'), 4 * 60 * 1000); }; // para se ficar 4 min sem receber nada
    try {
      for (let tryN = 0; ; tryN++) {
        // modelo, limite de tokens e "pensar" são colocados pelo servidor; a resposta vem aos poucos (stream)
        const body = { system: [{ type: 'text', text: system || this.system(), cache_control: { type: 'ephemeral' } }], messages };
        let r, j;
        poke();
        try {
          r = await fetch(srv + '/v1/messages', { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', ...(await this.authHeader()) }, body: JSON.stringify(body) });
          if (r.ok && /event-stream/.test(r.headers?.get?.('content-type') || '')) j = await this.readStream(r, onText, poke);
          else j = await r.json().catch(() => ({}));
        } catch (e) {
          if (ctrl.signal.aborted) throw new Error(ctrl.signal.reason === 'tempo' ? 'A IA ficou muito tempo sem responder. Tente de novo.' : 'Pedido cancelado.');
          if (tryN < 2) { await new Promise(r => setTimeout(r, 3000 * (tryN + 1))); continue; }
          throw new Error('Não consegui falar com o servidor da IA. Confira a internet e tente de novo.');
        }
        if (r.ok && j.error && !j._text) { // erro no meio do stream antes de vir texto (ex.: servidor ocupado)
          if (tryN < 3 && /overload|rate|api_error/i.test(j.error.type || '')) { await new Promise(res => setTimeout(res, 4000 * (tryN + 1))); continue; }
          throw new Error('A IA deu erro: ' + (j.error.message || j.error.type));
        }
        if (r.ok) { this.addUsage(j); if (!j.turma_uso) this.fetchRemote(); return j; }
        const m = j?.error?.message || r.statusText;
        if (j?.error?.type === 'login') throw new Error('Para usar a IA do Estúdio Problems, entre com sua conta Google.');
        if (j?.error?.type === 'limite') { this.addUsage(j); throw new Error('A equipe já usou 100% do limite de gasto da IA. Quem cuida do servidor precisa aumentar o limite ou colocar mais créditos.'); }
        if (j?.error?.type === 'origem' || r.status === 403) throw new Error('O servidor da IA não aceitou este site. Quem cuida do servidor precisa colocar este endereço em ORIGENS na Cloudflare.');
        if (j?.error?.type === 'config') throw new Error('O servidor da IA está sem a chave. Quem cuida do servidor precisa colocar ANTHROPIC_API_KEY na Cloudflare.');
        if ([429, 500, 502, 503, 529].includes(r.status) && tryN < 3 && !/credit|balance|billing/i.test(m)) { await new Promise(res => setTimeout(res, (r.status === 429 ? 8000 : 4000) * (tryN + 1))); continue; }
        if (r.status === 401) throw new Error('A chave da API que está na Cloudflare é inválida. Quem cuida do servidor precisa trocar ANTHROPIC_API_KEY.');
        if (r.status === 429) throw new Error('Muitos pedidos seguidos ou limite da conta atingido. Espere um pouco e tente de novo.');
        if (r.status === 529 || r.status === 503) throw new Error('Os servidores da IA estão muito ocupados agora. Tente de novo em alguns minutos.');
        if (/credit|balance|billing/i.test(m)) throw new Error('A conta da API está sem créditos. Quem cuida precisa adicionar créditos em console.anthropic.com.');
        if (/prompt is too long|too many tokens|request too large|413/i.test(m) || r.status === 413) throw new Error('O projeto + mídias ficaram grandes demais para mandar de uma vez. Tente citar só as mídias que importam ou dividir o pedido.');
        if (/model/i.test(m) && r.status === 404) throw new Error('O modelo escolhido na Cloudflare (MODELO) não existe ou não está liberado na conta.');
        throw new Error('A IA respondeu com erro: ' + m);
      }
    } finally { clearTimeout(idle); if (this.ctrl === ctrl) this.ctrl = null; }
  },
  // lê a resposta que chega aos pedaços (Server-Sent Events)
  async readStream(r, onText, poke) {
    const rd = r.body.getReader(), dec = new TextDecoder(); let buf = '', text = '', stop = null, err = null, usage = {};
    for (;;) {
      const { done, value } = await rd.read(); if (done) break; poke?.();
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
        const ev = buf.slice(0, i); buf = buf.slice(i).replace(/^\r?\n\r?\n/, '');
        const data = ev.split(/\r?\n/).filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('');
        if (!data) continue; let d; try { d = JSON.parse(data); } catch { continue; }
        if (d.type === 'content_block_delta' && d.delta?.type === 'text_delta') { text += d.delta.text; onText?.(text); }
        else if (d.type === 'message_start') usage = { ...(d.message?.usage || {}) };
        else if (d.type === 'message_delta') { stop = d.delta?.stop_reason || stop; Object.assign(usage, d.usage || {}); }
        else if (d.type === 'error') err = d.error;
        else if (d.type === 'turma_uso') this.remote = { ...(this.remote || {}), ...d.uso };
      }
    }
    return { content: [{ type: 'text', text }], stop_reason: stop, usage, error: err, _text: text.length > 0 };
  },
  cancel() { this.ctrl?.abort('user'); },
  // quadros do resultado para a IA conferir
  async frames(times, onFrame) {
    const p = App.project, S = p.settings, q = 640 / Math.max(S.w, S.h), out = [];
    for (const [i, t] of times.entries()) {
      onFrame?.(i, t); await sleep(120);
      try {
        await Renderer.prepare(p, t); const cv = document.createElement('canvas'); Renderer.render(cv, p, t, { q, noSync: true });
        out.push({ type: 'text', text: `Quadro do resultado em ${round(t, 2)}s:` }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: cv.toDataURL('image/jpeg', .75).split(',')[1] } });
      } catch { }
    }
    return out;
  },
  parse(text) {
    const tries = [], f = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (f) tries.push(f[1]);
    const i = text.indexOf('{'), k = text.lastIndexOf('}'); if (i >= 0 && k > i) tries.push(text.slice(i, k + 1));
    tries.push(text);
    for (const t of tries) { for (const v of [t, t.replace(/,\s*([}\]])/g, '$1').replace(/\/\/[^\n"]*$/gm, '')]) { try { const d = JSON.parse(v); if (d && typeof d === 'object') return Array.isArray(d) ? { acoes: d } : d; } catch { } } }
    return null;
  },
  // lê as linhas {"resumo"} {"tipo"...} {"fim":true} (aceita também o JSON antigo {"resumo","acoes":[...]})
  parseLines(text) {
    const out = { resumo: '', acoes: [], fim: false, ok: false };
    const t = String(text || '').replace(/```(?:json)?/g, '');
    for (let line of t.split(/\r?\n/)) {
      line = line.trim().replace(/,\s*$/, ''); if (!line.startsWith('{')) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      out.ok = true;
      if (o.tipo) out.acoes.push(o);
      if (typeof o.resumo === 'string') out.resumo = out.resumo ? out.resumo + ' ' + o.resumo : o.resumo;
      if (Array.isArray(o.acoes)) out.acoes.push(...o.acoes.filter(a => a && a.tipo));
      if (o.fim) out.fim = true;
    }
    if (!out.ok) { const d = this.parse(t); if (d) { out.ok = true; out.resumo = d.resumo || ''; if (Array.isArray(d.acoes)) out.acoes.push(...d.acoes); out.fim = true; } }
    return out;
  },
  async chat(prompt, history, extraContent) {
    if (!this.ready) throw new Error('A IA do Estúdio Problems ainda não foi ligada (falta configurar o servidor na Cloudflare).');
    const content = [{ type: 'text', text: this.context() }, ...(extraContent || []), { type: 'text', text: 'MENSAGEM: ' + prompt }];
    const messages = [...history, { role: 'user', content }];
    const j = await this.call(messages, this.systemChat(), extraContent?.onText);
    let text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim() || '…';
    const edit = /^\s*\[EDICAO\]/i.test(text); text = text.replace(/^\s*\[EDICAO\]\s*/i, '');
    const slim = messages.map(m => m.role === 'user' && Array.isArray(m.content) ? { role: 'user', content: m.content.filter(b => b.type === 'text').map(b => b.text).join('\n').slice(-6000) } : m);
    return { text, edit, messages: [...slim, { role: 'assistant', content: text }] };
  },
  // imagem de uma mídia (para mídias citadas)
  async assetImage(id, big) {
    const a = Assets.meta(id); if (!a || !['image', 'gif', 'video'].includes(a.kind)) return [];
    const rt = Assets.get(a.id); let el = rt?.img; if (a.kind === 'gif') el = Assets.gifFrame(rt, 0);
    if (a.kind === 'video') { if (!a.thumb) return []; el = new Image(); el.src = a.thumb; await el.decode().catch(() => { }); }
    if (!el) return [];
    const w0 = a.w || el.naturalWidth || el.width, h0 = a.h || el.naturalHeight || el.height, k = Math.min(1, (big ? 1280 : 640) / Math.max(w0, h0));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k)); const g = cv.getContext('2d'); g.drawImage(el, 0, 0, cv.width, cv.height);
    if (a.kind !== 'video') this.grid(g, cv.width, cv.height);
    const png = a.kind !== 'video'; this.sent.add(a.id);
    return [{ type: 'text', text: `Mídia CITADA ${a.id} ("${a.name}", ${a.kind}, ${w0}x${h0}):` }, { type: 'image', source: { type: 'base64', media_type: png ? 'image/png' : 'image/jpeg', data: cv.toDataURL(png ? 'image/png' : 'image/jpeg', .85).split(',')[1] } }];
  },
  async ask(prompt, history, extraContent, onProgress) {
    if (!this.ready) throw new Error('A IA do Estúdio Problems ainda não foi ligada (falta configurar o servidor na Cloudflare).');
    const imgs = await this.images();
    const content = [{ type: 'text', text: this.context() }, ...imgs, ...(extraContent || []), { type: 'text', text: 'PEDIDO: ' + prompt, cache_control: { type: 'ephemeral' } }];
    const messages = [...history, { role: 'user', content }];
    let conv = messages, all = { resumo: '', acoes: [], fim: false }, round = 0, lastText = '';
    const count = t => (t.match(/\{"tipo"/g) || []).length;
    for (;;) {
      const j = await this.call(conv, null, t => onProgress?.(all.acoes.length + count(t), round));
      const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      const r = this.parseLines(text); lastText = text;
      if (!r.ok && round === 0 && j.stop_reason !== 'max_tokens') { // não veio no formato: pede de novo uma vez
        conv = [...conv, { role: 'assistant', content: text || '...' }, { role: 'user', content: 'Sua resposta não veio no formato certo. Mande de novo SOMENTE as linhas JSON: {"resumo":...} depois uma ação {"tipo":...} por linha e no fim {"fim":true}.' }];
        round++; continue;
      }
      if (r.resumo && !all.resumo) all.resumo = r.resumo;
      all.acoes.push(...r.acoes); all.fim = r.fim;
      // cortou por tamanho → pede para continuar de onde parou
      if (j.stop_reason === 'max_tokens' && !r.fim && round < 12) {
        const done = text.split(/\r?\n/).filter(l => { try { JSON.parse(l.trim().replace(/,\s*$/, '')); return true; } catch { return false; } }).join('\n');
        const last = r.acoes.at(-1);
        conv = [...conv, { role: 'assistant', content: done || '{"resumo":"..."}' }, { role: 'user', content: `Sua resposta foi cortada por ser grande — até agora recebi ${all.acoes.length} ações${last ? ` (a última foi ${JSON.stringify(last).slice(0, 200)})` : ''}. CONTINUE de onde parou: mande SÓ as próximas ações (uma por linha, mesmo formato), sem repetir nenhuma. Quando acabar tudo, mande {"fim":true}.` }];
        round++; onProgress?.(all.acoes.length, round, true); continue;
      }
      break;
    }
    if (!all.acoes.length && !all.resumo) throw new Error('A IA não devolveu uma lista de ações que eu entenda. Tente explicar de outro jeito.');
    // no histórico fica só o texto (as imagens já foram vistas), e a resposta resumida
    const slim = messages.map(m => m.role === 'user' && Array.isArray(m.content) ? { role: 'user', content: m.content.filter(b => b.type === 'text').map(b => b.text).join('\n').slice(-6000) } : m);
    const hist = [JSON.stringify({ resumo: all.resumo }), ...all.acoes.map(a => JSON.stringify(a))].join('\n');
    return { data: { resumo: all.resumo, acoes: all.acoes }, raw: lastText, messages: [...slim, { role: 'assistant', content: hist.length > 8000 ? hist.slice(0, 8000) + `\n… (+${all.acoes.length} ações no total)` : hist }] };
  },
};

/* ---------- painel ---------- */
const Assistant = {
  open: false, history: [], mode: null, log: [], chat: (() => { try { return localStorage.getItem('ps-ai-chat') !== '0'; } catch { return true; } })(), cites: [], locked: false,
  get working() { return !!(this.busy || this.applying); },
  toggle(v = !this.open, force) {
    if (!v && this.open && this.working && !force) { UI.toast('Espere a IA terminar para fechar o assistente (ou clique em <b>Parar</b>).', { kind: 'warn', time: 3000 }); const a = $('#assistant'); a?.classList.remove('nudge'); void a?.offsetWidth; a?.classList.add('nudge'); return; }
    this.open = v; let el = $('#assistant'); $('#btn-ai')?.classList.remove('ready');
    if (!v) { el && el.remove(); return; }
    this.mode = 'ai'; // só a IA (Claude)
    try { ['ps-ai-key', 'ps-ai-model', 'ps-ai-server', 'ps-ai-usage', 'ps-ai-budget', 'ps-ai-period', 'ps-ai-think', 'ps-ai-review'].forEach(k => localStorage.removeItem(k)); } catch { } // configurações antigas: agora é tudo na Cloudflare
    el = h(`<div id="assistant" class="assistant"><div class="as-head"><span class="as-ic">${ic('sparkles', 16)}</span><b>Assistente</b><span class="sp"></span><button class="as-use" data-a="use" title="Quanto já foi usado da IA este mês"></button><button class="ibtn xs" data-a="clr" title="Limpar a conversa">${ic('trash', 13)}</button><button class="ibtn xs" data-a="x" title="Fechar">${ic('x', 14)}</button></div>
      <div class="as-log"></div>
      <div class="as-mode"><div class="as-seg" data-seg><button data-m="chat" title="A IA só conversa e tira dúvidas">${ic('text', 12)} Conversar</button><button data-m="edit" title="A IA mexe no projeto (edita, anima, monta)">${ic('sparkles', 12)} Editar</button></div><span class="sp"></span><label class="switch xs" data-autow title="Quando a IA terminar, já aplica no projeto (dá para desfazer)"><input type="checkbox" data-auto><i></i>Aplicar sozinho</label><input type="checkbox" data-chat hidden><span data-chatw hidden></span></div>
      <div class="as-tools"><button class="btn sm" data-a="att" title="Imagens, áudios, vídeos ou um roteiro (.txt)">${ic('upload', 12)} Anexar</button><button class="btn sm" data-a="scr" title="Colar ou abrir um roteiro">${ic('file', 12)} Roteiro</button><button class="btn sm" data-a="inf" title="Personagens, áudios, o que acontece, canais para estudar, cenário e pedidos extras">${ic('edit', 12)} Vídeo</button><button class="btn sm" data-a="pre" title="Pedidos prontos para acelerar">${ic('bolt', 12)} Prontos</button><button class="btn sm" data-a="kn" title="Ensinar a IA: guias, manuais, exemplos (.txt, .docx, .pdf ou texto colado)">${ic('bookmark', 12)} Ensinar</button><button class="btn sm" data-a="eqb" title="A IA pode usar os itens da equipe (nuvem)">${ic('package', 12)} Equipe</button><input type="checkbox" data-eq hidden><span data-eqw hidden></span><span class="as-scr" data-scr></span></div>
      <div class="as-hint" data-hint></div>
      <div class="as-in"><div class="as-ed" contenteditable="true" spellcheck="true" data-ph="Ex.: pegue o áudio da voz e faça o personagem falar"></div><button class="btn primary" data-a="send" title="Enviar (Ctrl+Enter)">${ic('right', 14)}</button></div></div>`);
    document.body.appendChild(el);
    this.place(el); this.makeMovable(el);
    $('[data-a=x]', el).onclick = () => this.toggle(false);
    $('[data-a=use]', el).onclick = () => this.usageModal();
    $('[data-a=clr]', el).onclick = () => this.clearChat();
    this.paintUse(); AIClient.fetchRemote();
    const ta = $('.as-ed', el); this.bindEditor(ta, el);
    ta.addEventListener('input', debounce(() => this.paintUsed(el), 250));
    $('[data-a=send]', el).onclick = () => this.send();
    $('[data-a=att]', el).onclick = async () => { const f = await pickFiles('image/*,video/*,audio/*,.gif,.txt,.md,.srt'); if (f.length) this.attach(f); };
    $('[data-a=scr]', el).onclick = () => this.scriptModal();
    $('[data-a=kn]', el).onclick = () => Knowledge.modal();
    $('[data-eq]', el).onchange = e => TeamLib.setEnabled(e.target.checked, true);
    $('[data-a=eqb]', el).onclick = async () => { await TeamLib.setEnabled(!TeamLib.enabled, true); this.paintUsed(el); };
    $$('[data-seg] button', el).forEach(b => b.onclick = () => { this.chat = b.dataset.m === 'chat'; try { localStorage.setItem('ps-ai-chat', this.chat ? '1' : '0'); } catch { } this.paint(); });
    $('[data-a=inf]', el).onclick = () => { if (this.working || this.busy) return; Creator.open({ project: App.project, lockFormat: true, formato: GENRE.formatOf(App.project), edit: true }); };
    $('[data-a=pre]', el).onclick = e => { const r = e.currentTarget.getBoundingClientRect(); this.presetMenu(r.left, r.top); };
    const ch = $('[data-chat]', el); ch.checked = this.chat; ch.onchange = () => { this.chat = ch.checked; this.paint(); };
    el.addEventListener('animationend', () => el.classList.add('shown'), { once: true });
    const au = $('[data-auto]', el); au.checked = this.auto; au.onchange = () => { this.auto = au.checked; this.paintUsed(el); UI.toast(au.checked ? 'A IA vai aplicar sozinha quando terminar (dá para desfazer)' : 'A IA vai mostrar o plano antes de aplicar', { time: 2500 }); };
    el.ondragover = e => { e.preventDefault(); e.stopPropagation(); el.classList.add('over'); }; el.ondragleave = () => el.classList.remove('over');
    el.ondrop = e => {
      e.preventDefault(); e.stopPropagation(); e._handled = true; el.classList.remove('over');
      if (e.dataTransfer.files.length) return this.attach([...e.dataTransfer.files]);
      // mídia arrastada da biblioteca → entra no texto como citação (não envia)
      let d; try { d = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
      if (d?.kind === 'asset') this.cite((d.ids?.length ? d.ids : [d.id]).map(id => ({ kind: 'midia', id })));
    };
    this.paint(); setTimeout(() => ta.focus(), 50);
  },
  paintUse() {
    const b = $('#assistant .as-use'); if (!b) return;
    const p = AIClient.pct(); if (!AIClient.ready) { b.style.display = 'none'; return; }
    b.style.display = '';
    if (p === null) { b.innerHTML = `<i style="--p:0"></i>?%`; b.title = 'Uso da IA do Estúdio Problems'; return; }
    const pc = Math.min(100, p * 100), col = pc >= 90 ? 'var(--err)' : pc >= 70 ? 'var(--warn)' : 'var(--ok)', r = AIClient.remote;
    b.innerHTML = `<i style="--p:${pc};--c:${col}"></i>${pc < 10 && pc > 0 ? pc.toFixed(1) : Math.round(pc)}%`;
    b.title = `IA do Estúdio Problems${r.oficial ? ' (gasto oficial)' : ''}: ${Math.round(pc)}% usado ${AIClient.periodTxt(r.periodo)} — US$ ${(r.usd || 0).toFixed(2)} de US$ ${r.limite}`;
  },
  async usageModal() {
    await AIClient.fetchRemote();
    const r = AIClient.remote, p = AIClient.pct() ?? 0, pc = Math.min(100, p * 100);
    const ring = `<div class="as-ring" style="--p:${pc};--c:${pc >= 90 ? 'var(--err)' : pc >= 70 ? 'var(--warn)' : 'var(--ok)'}"><b>${pc < 10 && pc > 0 ? pc.toFixed(1) : Math.round(pc)}%</b></div>`;
    const f = h(`<div><div style="display:flex;gap:16px;align-items:center">${ring}<div>${r
      ? `<b>Uso da IA do Estúdio Problems ${AIClient.periodTxt(r.periodo)}</b><br>US$ ${(r.usd || 0).toFixed(2)} de US$ ${r.limite} · ${r.n ?? 0} pedido(s)${AIClient.modelName ? ' · ' + esc(AIClient.modelName) : ''}<br><small>${r.oficial ? `<b style="color:var(--ok)">Gasto oficial da Anthropic</b>${r.desde ? ' desde ' + esc(r.desde) : ''} (atualiza a cada ~5 min).` : 'Estimativa (o gasto oficial aparece quando a chave de Admin estiver no servidor).'} Soma de todos os colegas. Em 100% a IA para até aumentarem o limite.</small>`
      : `Não consegui falar com o servidor da IA agora.`}</div></div>
      <p style="margin:14px 0 0;font-size:12px;color:var(--tx3)">${ic('info', 11)} A chave, o modelo e o limite são configurados só na Cloudflare, por quem cuida do servidor.</p></div>`);
    await UI.modal({ title: 'Uso da IA', icon: 'sparkles', width: 460, body: f, buttons: [{ label: 'Fechar', kind: 'primary', value: null }] });
  },
  // posição e tamanho do painel (arrastar pelo topo, redimensionar pelo canto)
  get pos() { try { return JSON.parse(localStorage.getItem('ps-ai-pos') || 'null'); } catch { return null; } },
  set pos(v) { try { v ? localStorage.setItem('ps-ai-pos', JSON.stringify(v)) : localStorage.removeItem('ps-ai-pos'); } catch { } },
  place(el) {
    const p = this.pos; if (!p) { el.style.left = el.style.top = el.style.width = el.style.height = ''; el.style.right = ''; return; }
    const W = innerWidth, H = innerHeight, w = clamp(p.w || 400, 300, W - 16), hh = clamp(p.h || 640, 280, H - 16);
    Object.assign(el.style, { width: w + 'px', height: hh + 'px', left: clamp(p.x, 8 - w + 120, W - 120) + 'px', top: clamp(p.y, 4, H - 44) + 'px', right: 'auto' });
  },
  makeMovable(el) {
    const head = $('.as-head', el);
    head.title = 'Arraste para mover · duplo clique volta ao lugar';
    head.onpointerdown = e => {
      if (e.button !== 0 || e.target.closest('button')) return;
      e.preventDefault(); const r = el.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
      el.classList.add('moving'); head.setPointerCapture(e.pointerId);
      const mv = ev => { const p = { x: ev.clientX - dx, y: ev.clientY - dy, w: r.width, h: r.height }; this.pos = p; this.place(el); };
      const up = () => { el.classList.remove('moving'); head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', up); head.removeEventListener('pointercancel', up); };
      head.addEventListener('pointermove', mv); head.addEventListener('pointerup', up); head.addEventListener('pointercancel', up);
    };
    head.ondblclick = e => { if (e.target.closest('button')) return; this.pos = null; this.place(el); };
    const g = h(`<div class="as-grip" title="Arraste para mudar o tamanho"></div>`); el.appendChild(g);
    g.onpointerdown = e => {
      e.preventDefault(); e.stopPropagation(); const r = el.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY; g.setPointerCapture(e.pointerId); el.classList.add('moving');
      const mv = ev => { this.pos = { x: r.left, y: r.top, w: r.width + ev.clientX - x0, h: r.height + ev.clientY - y0 }; this.place(el); };
      const up = () => { el.classList.remove('moving'); g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); };
      g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    };
    if (!this._rs) { this._rs = true; addEventListener('resize', () => { const a = $('#assistant'); if (a) this.place(a); }); }
  },
  paint() {
    const el = $('#assistant'); if (!el) return;
    const ai = true;
    $('[data-chatw]', el).style.display = ai ? '' : 'none'; $('[data-chat]', el).checked = this.chat; const eqc = $('[data-eq]', el); if (eqc) eqc.checked = TeamLib.enabled;
    $('[data-autow]', el).style.display = ai && !this.chat ? '' : 'none';
    el.classList.toggle('chatting', ai && this.chat);
    $$('[data-seg] button', el).forEach(b => b.classList.toggle('on', (b.dataset.m === 'chat') === !!this.chat));
    const hint = $('[data-hint]', el);
    hint.innerHTML = ''; void (ai && AIClient.ready ? (this.chat ? `${ic('info', 11)} <b>Modo conversa</b>: eu só converso e tiro dúvidas. Para eu <b>editar/animar</b>, desligue <b>Conversa</b>.` : `${ic('sparkles', 11)} <b>Modo edição</b>: eu mexo no projeto. Cite mídias com o botão direito → <b>Citar na IA</b>, arrastando aqui, ou escrevendo o nome entre aspas.`) : '');
    $('.as-ed', el).dataset.ph = ai && this.chat ? 'Converse comigo… (use @ para citar mídias e itens da linha do tempo)' : 'Ex.: faça o @personagem falar com o @áudio… (digite @ para citar)';
    this.paintUsed(el);
    const sc = $('[data-scr]', el); sc.innerHTML = App.project?.script ? `${ic('file', 11)} roteiro: ${App.project.script.length} letras` : '';
    const log = $('.as-log', el);
    if (!this.log.length) log.innerHTML = `<div class="as-msg sys">${AIClient.ready ? `${this.chat ? 'Oi! Pode conversar comigo, tirar dúvidas ou pedir ideias. Quando quiser que eu edite, clique em <b>Editar</b>.' : 'Escreva o que você quer e eu faço no editor: animações, efeitos, textos, sincronizar com o áudio…'}<br><small>Selecione o clipe do personagem antes, se quiser que eu use ele.${AIClient.modelName ? ' Usando: ' + esc(AIClient.modelName) : ''}${AIClient.offline ? ' <span style="color:var(--warn)">· não consegui falar com o servidor da IA agora</span>' : ''}</small>` : `A <b>IA do Estúdio Problems</b> ainda não foi ligada.<br><small>Quem cuida do editor configura uma vez na Cloudflare (pasta <b>servidor-ia</b>, arquivo LEIA-ME) e coloca o endereço em <b>js/config.js</b>. Depois disso funciona para todo mundo.</small>`}</div>`;
    else { log.innerHTML = ''; this.log.forEach(m => { this.decorate(m); log.appendChild(m); }); }
    log.scrollTop = log.scrollHeight;
    this.paintReply();
  },
  /* ---------- responder a uma mensagem ---------- */
  decorate(m) {
    if (!m.classList.contains('me') && !m.classList.contains('ai')) return;
    if (m.querySelector(':scope > .as-reply')) return;
    const b = h(`<button class="as-reply" title="Responder a esta mensagem">${ic('undo', 11)} Responder</button>`);
    b.onclick = e => { e.stopPropagation(); this.replyTo(m); };
    m.appendChild(b);
  },
  msgText(m) { const c = m.cloneNode(true); c.querySelectorAll('button,.as-q,.btn-row').forEach(x => x.remove()); return c.innerText.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); },
  replyTo(m) {
    const t = this.msgText(m); if (!t) return;
    this.reply = { who: m.classList.contains('me') ? 'você' : 'IA', text: t.slice(0, 1200) };
    this.paintReply(); const ed = $('#assistant .as-ed'); ed && ed.focus();
  },
  paintReply() {
    const el = $('#assistant'); if (!el) return;
    let bar = $('.as-replybar', el);
    if (!this.reply) { bar && bar.remove(); return; }
    if (!bar) { bar = h('<div class="as-replybar"></div>'); $('.as-in', el).before(bar); }
    bar.innerHTML = `${ic('undo', 12)}<div><small>Respondendo ${this.reply.who === 'IA' ? 'à IA' : 'a você'}</small><span>${esc(this.reply.text.slice(0, 160))}${this.reply.text.length > 160 ? '…' : ''}</span></div><button class="ibtn xs" title="Cancelar resposta">${ic('x', 12)}</button>`;
    $('button', bar).onclick = () => { this.reply = null; this.paintReply(); };
  },
  isText(f) { return ScriptFile.is(f); },
  async attach(files) {
    this._attached = true;
    const texts = files.filter(f => this.isText(f)), media = files.filter(f => !this.isText(f));
    if (texts.length) { let t = ''; try { t = (await Promise.all(texts.map(f => ScriptFile.read(f)))).join('\n\n'); } catch (e) { UI.toast(esc(e.message || e), { kind: 'err' }); } App.project.script = (App.project.script ? App.project.script + '\n\n' : '') + t; App.commit('Roteiro adicionado', { noRefresh: true }); this.addMsg(`${ic('file', 12)} Roteiro lido (${t.length} letras). Agora é só pedir.`, 'sys'); }
    if (media.length) { const r = await Actions.importFiles(media); if (r.length) this.addMsg(`${ic('upload', 12)} ${r.length} arquivo(s) adicionados à Mídia: ${r.map(x => esc(x.meta.name)).join(', ')}`, 'sys'); }
    this.paint();
  },
  // botões que já têm algo que a IA vai usar ficam coloridos (igual o botão do Assistente)
  paintUsed(el = $('#assistant')) {
    if (!el || !App.project) return;
    const p = App.project, cur = ($('.as-ed', el)?.textContent || '').replace(/\s+/g, ' ');
    const on = (sel, v, tip) => { const b = $(sel, el); if (!b) return; b.classList.toggle('ai-on', !!v); if (tip) b.dataset.used = v ? tip : ''; };
    on('[data-a=scr]', p.script?.trim(), 'roteiro no projeto');
    on('[data-a=pre]', this.PRESETS.concat(this.myPresets()).some(pr => pr.p && cur.includes(pr.p.replace(/\s+/g, ' ').slice(0, 120))), 'pronto escolhido');
    on('[data-a=kn]', typeof Knowledge !== 'undefined' && Knowledge.list?.().length, 'a IA já aprendeu');
    on('[data-a=inf]', !!(p.explicacaoTexto || p.personagens?.length || p.canaisBase?.length), 'informações do vídeo');
    on('[data-a=att]', this._attached || this.cites?.length || $('.as-ed .as-chip', el), 'anexos/citações');
    on('[data-a=eqb]', typeof TeamLib !== 'undefined' && TeamLib.enabled, 'itens da equipe');
    $('[data-autow]', el)?.classList.toggle('ai-sw', !!this.auto);
  },
  /* ---------- pedidos prontos (pre-prompts) ---------- */
  PRESETS: [
    // ---------- Shorts ----------
    { g: 'Shorts', fmt: 'shorts', l: 'Receita: Shorts do Problems (completo)', p: 'Monte o Shorts inteiro na RECEITA "SHORTS DO PROBLEMS": 1) limpar_voz tirando as pausas e use a transcrição nova; 2) fundo de bolinhas em degradê roxo→azul pulsando, com bolhas e vinheta; 3) personagem grande (cintura) com contorno branco de adesivo + sombra, entrando com dropIn, voiceBounce SUTIL (amount ~0,015) + idle quase parado, trocando de pose a CADA frase pela emoção com poseSwap; 4) quem for citado aparece em moldura circular com rollIn + estrelinhas + boing/ding e o personagem aponta para ele; 5) impacto (zoomPunch/shakeCam curto/flash) só nas falas fortes; 6) legendas no terço de cima; 7) música animada gerada baixinha abaixando com a voz; sons baixos; 8) final com hold de reação de 0,4 s.' },
    { g: 'Shorts', fmt: 'shorts', l: 'Shorts estilo Mundo Torajo (piada)', p: 'Monte como um Short do Mundo Torajo: gancho com a situação já montada no 1º segundo, setup segurando a pose, escalada com microeventos (olhar, prop, reação de quem escuta), virada com snapZoom + 2–4 quadros de silêncio + hit, punchline com pose extrema + shake curto + som principal, e HOLD de reação de 0,3–0,7 s no fim. Legendas sempre, 3–6 efeitos sonoros no total, câmera e personagem nunca se mexendo ao mesmo tempo.' },
    { g: 'Shorts', fmt: 'shorts', l: 'Shorts storytime (estilo Brubs)', p: 'Monte como storytime da Brubs: a narração manda; cada nova ideia da fala muda a imagem (pose, enquadramento, objeto ou texto) a cada 1,5–3 s; poses "de verbo" que encenam ou contradizem o que é dito; push-in leve nas frases importantes; hold de reação depois de cada piada; legendas em todo o vídeo.' },
    { g: 'Shorts', fmt: 'shorts', l: 'Gancho forte no 1º segundo', p: 'Melhore só o começo: o 1º segundo precisa prender — pose extrema já na tela (sem entrada longa), snapZoom ou enterSide com whoosh, texto grande com a pergunta/promessa do vídeo por 1,5 s e um som de impacto. Não mexa no resto.' },
    { g: 'Shorts', fmt: 'shorts', l: 'Final com loop', p: 'Faça o final ligar com o começo (para o Short dar loop): última pose parecida com a primeira, hold curto, sem fade para preto, e o último som combinando com o primeiro.' },
    // ---------- Vídeo longo ----------
    { g: 'Vídeo longo', fmt: 'video', l: 'Montar o vídeo longo completo', p: 'Monte o vídeo do YouTube completo seguindo as regras de VÍDEO LONGO: abertura curta com o assunto (até 10 s), blocos/capítulos com cenário próprio, personagens lado a lado em diálogo (quem fala em destaque, quem escuta reage), troca de pose por ideia a cada 2–3,5 s, enquadramentos variados (corpo → cintura → close nas piadas), transição curta entre blocos, música mudando por bloco e abaixando com a voz, textos só para ênfase.' },
    { g: 'Vídeo longo', fmt: 'video', l: 'Dividir em capítulos', p: 'Divida o vídeo em capítulos pela transcrição: coloque um marcador no começo de cada assunto, um título curto animado (popIn) de 2 s no início de cada capítulo, troque o cenário/fundo e a música de clima em cada um, com transição curta entre eles.' },
    { g: 'Vídeo longo', fmt: 'video', l: 'Diálogo entre personagens', p: 'Encene o diálogo: cada personagem de um lado (enquadrar esq/dir), quem fala fica com boca falando e voiceBounce sutil (hopTalk só numa palavra de ênfase), quem escuta fica em idle e reage (emote/lean/troca de expressão) nas falas do outro; alterne planos: dois juntos → close em quem fala nas falas importantes → dois juntos de novo.' },
    { g: 'Vídeo longo', fmt: 'video', l: 'Intro + final (inscreva-se)', p: 'Crie uma abertura de até 8 s (título do vídeo grande com popIn, personagem entrando com enterSide e som) e um final de 10 s com o personagem pedindo para se inscrever, texto "INSCREVA-SE" com pulse e música subindo.' },
    { g: 'Vídeo longo', fmt: 'video', l: 'Deixar menos parado', p: 'Revise o vídeo todo e acabe com trechos parados: onde passar de 5 s sem mudança visual, adicione troca de pose, reenquadramento, push-in leve, objeto/texto de ênfase ou reação de quem escuta — sempre de acordo com o que está sendo dito, sem efeito aleatório.' },
    // ---------- Montar ----------
    { g: 'Montar', l: 'Seguir o roteiro à risca', p: 'Siga o roteiro de perto: monte as cenas na mesma ordem, quem fala cada fala, e transforme cada indicação entre parênteses/colchetes (emoção, zoom, som, entrada, pose, cenário) em ação no momento exato da fala no áudio (use a transcrição).' },
    { g: 'Montar', l: 'Continuar de onde parou', p: 'Continue a edição a partir do último trecho montado até o fim do áudio, no mesmo estilo do que já está na linha do tempo.' },
    // ---------- Voz e som ----------
    { g: 'Voz e som', l: 'Limpar voz (tirar pausas)', p: 'Use limpar_voz no áudio de voz para tirar as pausas e normalizar, e depois reposicione o que estiver fora de lugar usando a transcrição nova.' },
    { g: 'Voz e som', l: 'Música de fundo gerada', p: 'Gere uma música de fundo (ação musica) no estilo que combina com o vídeo, do começo ao fim, volume ~18 e abaixando com a voz; corte a música por um instante antes da piada principal.' },
    { g: 'Voz e som', l: 'Sons nas reações (baixinho)', p: 'Adicione efeitos sonoros só em reação, impacto, entrada e troca de cena (3–6 a cada 15 s), baixinhos (15–35%), começando 1–2 quadros antes do movimento; prefira os sons da biblioteca; nunca cubra a voz.' },
    { g: 'Voz e som', l: 'Legendas', p: 'Crie as legendas do áudio de voz (estilo youtube, até ~16 letras por vez), no terço de cima, sem tampar rostos.' },
    // ---------- Animação e câmera ----------
    { g: 'Animação e câmera', l: 'Personagem falando (voz + boca)', p: 'Faça quem fala ter voiceBounce SUTIL (amount 0,012–0,018) só enquanto fala (transcrição), sem pulinhos constantes; se existir imagem de boca aberta da mesma pose, ative a boca falando.' },
    { g: 'Animação e câmera', l: 'Trocar poses pela emoção', p: 'Troque as poses a cada frase ou mudança de emoção, escolhendo a imagem que combina com o que é dito (use a transcrição), com poseSwap (puxão) e um pop baixinho.' },
    { g: 'Animação e câmera', l: 'Quem escuta reage', p: 'Faça quem NÃO está falando reagir: olhar, inclinar (lean), trocar expressão e um emote de vez em quando, sem roubar a atenção de quem fala.' },
    { g: 'Animação e câmera', l: 'Destacar quem é citado', p: 'Quando alguém (pessoa/personagem/canal) for citado na fala e existir imagem dele na Mídia, mostre a imagem com moldura em círculo, rollIn + estrelinhas + boing/ding, até o fim da frase, e o personagem aponta para ele.' },
    { g: 'Animação e câmera', l: 'Snap zoom + shake na piada', p: 'Na virada/piada: snapZoom (+8–12%) com leve overshoot + shakeCam curto (≤0,2 s) + som de impacto, e depois hold de reação de 0,3–0,6 s.' },
    { g: 'Animação e câmera', l: 'Variar enquadramento', p: 'Varie o enquadramento (corpo, cintura, busto, rosto) e o lado da tela conforme a intensidade de cada momento — nada sempre centralizado igual; o corpo continua abaixo da tela.' },
    { g: 'Animação e câmera', l: 'Fundo de bolinhas do Shorts', p: 'Coloque o fundo de bolinhas do Shorts (degradê roxo→azul, bolinhas brancas pulsando, bolhas subindo e vinheta) na faixa de baixo cobrindo o vídeo todo.' },
    // ---------- Revisar ----------
    { g: 'Revisar', l: 'Revisão completa (checklist)', p: 'Revise a edição inteira pelo checklist e corrija o que falhar: 1º quadro compreensível sem contexto; nada parado por mais de 5 s sem motivo; cada troca de pose tem motivo na fala; quem não fala reage; piada com hold depois da última palavra; zoom/shake só em beats; voz clara com todos os sons; nada importante colado nas bordas; final intencional.' },
    { g: 'Revisar', l: 'Deixar mais exagerado', p: 'Deixe tudo mais exagerado no estilo cartoon: poses mais extremas, reações maiores, mais emotes e sons de meme nos momentos certos — mantendo os holds e a voz clara.' },
    { g: 'Revisar', l: 'Deixar mais calmo', p: 'Deixe a edição mais calma e limpa: menos zoom e tremor, sons mais baixos, trocas de pose só nas mudanças de ideia, holds mais longos.' },
    // ---------- Conversa ----------
    { g: 'Conversa', l: 'O que você fez?', p: 'Me explique em poucas linhas o que você montou e onde estão as piadas principais.', chat: true },
    { g: 'Conversa', l: 'Ideias de piadas', p: 'Leia o roteiro/transcrição e me sugira 5 ideias de piadas visuais, reações ou sons para deixar o vídeo mais engraçado.', chat: true },
    { g: 'Conversa', l: 'Quais poses faltam?', p: 'Olhe as imagens dos personagens e me diga quais poses/expressões faltam para esse vídeo ficar melhor (ex.: apontando, assustado, rindo).', chat: true },
    { g: 'Conversa', l: 'Melhorar meu roteiro', p: 'Leia meu roteiro e sugira como deixar mais engraçado e com mais ritmo para o formato deste projeto (gancho, virada, punchline, final), sem mudar a ideia.', chat: true },
  ],
  myPresets() { try { return JSON.parse(localStorage.getItem('ps-ai-pre') || '[]'); } catch { return []; } },
  saveMyPresets(a) { try { localStorage.setItem('ps-ai-pre', JSON.stringify(a)); } catch { } },
  usePreset(pr) {
    const ed = $('#assistant .as-ed'); if (!ed) return;
    const has = ed.textContent.trim().length > 0;
    // vários prontos: cada um vai num parágrafo separado (linha em branco entre eles); se algum edita, a IA edita
    const want = has ? (this.chat && !!pr.chat) : !!pr.chat;
    if (this.chat !== want) { this.chat = want; this.paint(); UI.toast(want ? 'Modo Conversa ligado (só conversa).' : 'Modo Conversa desligado: a IA vai editar.', { time: 1800 }); }
    if (has) { while (ed.lastChild && ed.lastChild.nodeType === 3 && !ed.lastChild.textContent.trim()) ed.lastChild.remove(); if (ed.lastChild?.nodeName === 'BR') ed.lastChild.remove(); ed.appendChild(document.createTextNode('\n\n' + pr.p)); }
    else ed.textContent = pr.p;
    ed.focus(); ed.scrollTop = ed.scrollHeight; this.paintUsed();
    try { const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); } catch { }
  },
  presetMenu(x, y) {
    // o formato do projeto vem primeiro; o outro formato fica no fim
    const fmt = App.project ? GENRE.formatOf(App.project) : 'shorts', groups = {};
    [...this.PRESETS].sort((x, y) => (x.fmt && x.fmt !== fmt ? 1 : 0) - (y.fmt && y.fmt !== fmt ? 1 : 0)).forEach(pr => (groups[pr.g + (pr.fmt && pr.fmt !== fmt ? ' (outro formato)' : '')] ||= []).push(pr));
    const mine = this.myPresets();
    const cur = ($('#assistant .as-ed')?.textContent || '').replace(/\s+/g, ' '), used = pr => !!pr.p && cur.includes(pr.p.replace(/\s+/g, ' ').slice(0, 120));
    const items = Object.entries(groups).map(([g, list]) => ({ label: g, used: list.some(used), sub: list.map(pr => ({ label: pr.l, used: used(pr), checked: used(pr), action: () => this.usePreset(pr) })) }));
    items.push('-');
    if (mine.length) items.push({ label: 'Meus prontos', sub: mine.map((pr, i) => ({ label: pr.l, action: () => this.usePreset(pr) })).concat(['-', { label: 'Apagar um dos meus…', icon: 'trash', action: async () => { const n = await UI.prompt({ title: 'Apagar pronto', label: 'Nome exato do pronto para apagar', value: mine[mine.length - 1].l }); if (n) { this.saveMyPresets(mine.filter(p => p.l !== n)); UI.toast('Apagado.', { time: 1500 }); } } }]) });
    items.push({ label: 'Salvar o texto atual como pronto…', icon: 'plus', action: async () => { const t = this.readEd().text.trim(); if (!t) return UI.toast('Escreva o pedido na caixa primeiro.', { kind: 'warn' }); const n = await UI.prompt({ title: 'Salvar pedido pronto', label: 'Nome do botão', value: t.slice(0, 32) }); if (!n) return; this.saveMyPresets([...mine.filter(p => p.l !== n), { g: 'Meus', l: n, p: t, chat: this.chat }]); UI.toast('Salvo em Prontos → Meus prontos.', { time: 1800 }); } });
    UI.ctx(x, y, items);
  },
  async scriptModal() {
    const f = h(`<div><p style="margin-top:0">Cole o roteiro aqui (pode ser com nomes, ex.: <b>PROBLEMS: oi gente!</b>). A IA usa o roteiro e o áudio para montar e animar.</p><textarea rows="14" style="width:100%;font-size:13px" placeholder="CENA 1 — quarto\nPROBLEMS: Fala galera!\nAMIGO: ...">${esc(App.project.script || '')}</textarea><div class="btn-row"><button class="btn sm" data-a="open">${ic('folder', 12)} Abrir arquivo (.txt, .docx, .pdf)</button></div></div>`);
    $('[data-a=open]', f).onclick = async () => { const fl = await pickFiles(ScriptFile.ACCEPT, false); if (fl[0]) try { $('textarea', f).value = await ScriptFile.read(fl[0]); } catch (e) { UI.toast(esc(e.message || e), { kind: 'err' }); } };
    const o = await UI.modal({ title: 'Roteiro do projeto', icon: 'file', width: 620, body: f, buttons: [{ label: 'Apagar roteiro', left: true, value: '' }, { label: 'Cancelar', value: null }, { label: 'Salvar roteiro', kind: 'primary', collect: () => $('textarea', f).value }] });
    if (o === null) return;
    App.project.script = o; App.commit(o ? 'Roteiro salvo no projeto' : 'Roteiro apagado', { toast: true, noRefresh: true }); this.paint();
  },
  // janela que aparece ao criar um projeto
  async wizard() { return Creator.open({ project: App.project, lockFormat: true, formato: GENRE.formatOf(App.project), skipLabel: 'Pular (fazer depois)' }); },

  /* ---------- citar mídias e itens da linha do tempo (chips coloridos no texto) ---------- */
  info(kind, id) {
    const p = App.project; if (!p) return null;
    const dur = d => d ? ' · ' + fmtSec(d) : '';
    if (kind === 'midia') { const m = Assets.meta(id); if (!m) return null; return { name: m.name, thumb: m.thumb, icon: { image: 'image', gif: 'gif', video: 'film', audio: 'music' }[m.kind] || 'image', sub: `Mídia · ${{ image: 'imagem', gif: 'GIF', video: 'vídeo', audio: 'áudio' }[m.kind] || m.kind}${m.w ? ` · ${m.w}×${m.h}` : ''}${dur(m.dur)}` }; }
    if (kind === 'clipe') { const c = App.clip(id); if (!c) return null; const m = c.assetId && Assets.meta(c.assetId), tk = App.track(c.trackId); return { name: c.name || c.text?.text?.slice(0, 24) || c.type, thumb: m?.thumb, icon: { audio: 'music', video: 'film', text: 'text', shape: 'shapes', fx: 'sparkles', gif: 'gif' }[c.type] || 'image', sub: `Linha do tempo · ${tk?.name || ''} · ${fmtSec(c.start)}–${fmtSec(c.start + c.dur)}${c.anims?.length ? ` · ${c.anims.length} animação(ões)` : ''}` }; }
    if (kind === 'faixa') { const t = App.track(id); if (!t) return null; return { name: t.name, icon: { audio: 'music', fx: 'sparkles' }[t.type] || 'film', sub: `Faixa de ${{ visual: 'vídeo', audio: 'áudio', fx: 'efeitos' }[t.type]} · ${p.clips.filter(c => c.trackId === id).length} clipe(s)` }; }
    if (kind === 'link') {
      const pf = StyleRefs.platform(id), P = StyleRefs.PF[pf] || 'Link', r = StyleRefs.findRef(id);
      const short = id.replace(/^https?:\/\/(www\.|m\.)?/i, '').slice(0, 38) + (id.length > 50 ? '…' : '');
      const named = r && r.title && !/^Vídeo do (YouTube|TikTok|Instagram)$/.test(r.title);
      const st = pf === 'instagram' ? 'o Instagram não deixa a IA abrir — baixe o vídeo e coloque na Mídia' : !r ? 'vai virar referência de estilo quando você enviar' : r.status === 'analisando' ? 'analisando…' : r.status === 'pronta' ? (r.ativa ? 'referência de estilo em uso ✓' : 'referência desligada') : r.status === 'erro' ? 'erro: ' + (r.erro || '') : '';
      return { name: named ? r.title : `${P} · ${short}`, thumb: r?.thumb, icon: 'film', glyph: { youtube: '▶', tiktok: '♪', instagram: '◎' }[pf] || '🔗', pf, sub: `Link do ${P} — ${st}` };
    }
    if (kind === 'marcador') { const m = p.markers.find(x => x.id === id); if (!m) return null; return { name: m.label || 'Marcador', icon: 'marker', sub: `Marcador em ${fmtSec(m.t)}`, color: m.color }; }
    return null;
  },
  chipHTML(kind, id) {
    const f = this.info(kind, id); if (!f) return '';
    if (kind === 'link') return `<span class="as-chip k-link pf-${f.pf}" contenteditable="false" data-k="link" data-id="${esc(id)}"><em class="lg">${f.glyph}</em>${f.thumb ? `<i style="background-image:url('${f.thumb}')"></i>` : ''}<b>${esc(f.name)}</b></span>`;
    return `<span class="as-chip k-${kind}" contenteditable="false" data-k="${kind}" data-id="${esc(id)}">${f.thumb ? `<i style="background-image:url('${f.thumb}')"></i>` : `<em>${ic(f.icon, 11)}</em>`}<b>${esc(f.name)}</b></span>`;
  },
  ed() { return $('#assistant .as-ed'); },
  saveRange() { const sel = getSelection(), e = this.ed(); if (sel.rangeCount && e && e.contains(sel.anchorNode)) this.range = sel.getRangeAt(0).cloneRange(); },
  placeCaret(node, after = true) { const r = document.createRange(), sel = getSelection(); after ? r.setStartAfter(node) : r.setStartBefore(node); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); this.range = r.cloneRange(); },
  insertChips(items, range) {
    const e = this.ed(); if (!e) return 0;
    e.focus();
    let r = range || (this.range && e.contains(this.range.startContainer) ? this.range : null);
    if (!r) { r = document.createRange(); r.selectNodeContents(e); r.collapse(false); }
    let n = 0, last = null;
    for (const it of items) {
      const html = this.chipHTML(it.kind, it.id); if (!html) continue;
      const chip = h(html), sp = document.createTextNode(' ');
      r.insertNode(sp); r.insertNode(chip); r.setStartAfter(sp); r.collapse(true); last = sp; n++;
    }
    if (last) this.placeCaret(last);
    this.edChanged();
    return n;
  },
  cite(items) {
    if (!this.open) this.toggle(true);
    const n = this.insertChips(items);
    if (n) UI.toast(`${n > 1 ? n + ' itens citados' : 'Citado'} na conversa`, { time: 1500 });
  },
  // lê o texto do editor: chips viram @nome (e a lista do que foi citado)
  readEd(e = this.ed()) {
    const refs = [], seen = new Set(); let text = '';
    const walk = n => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) text += c.nodeValue.replace(/ /g, ' ');
        else if (c.classList?.contains('as-chip') && c.dataset.k === 'link') { text += c.dataset.id; if (!seen.has('link' + c.dataset.id)) { seen.add('link' + c.dataset.id); refs.push({ kind: 'link', id: c.dataset.id, tok: c.dataset.id }); } }
        else if (c.classList?.contains('as-chip')) { const f = this.info(c.dataset.k, c.dataset.id); const tok = '@' + (f?.name || c.textContent).replace(/\s+/g, '_'); text += tok; if (!seen.has(c.dataset.k + c.dataset.id)) { seen.add(c.dataset.k + c.dataset.id); refs.push({ kind: c.dataset.k, id: c.dataset.id, tok }); } }
        else if (c.nodeName === 'BR') text += '\n';
        else { if (/^(DIV|P)$/.test(c.nodeName) && text && !text.endsWith('\n')) text += '\n'; walk(c); }
      }
    };
    walk(e);
    return { text: text.replace(/[ \t]+\n/g, '\n').trim(), refs, html: e.innerHTML };
  },
  edChanged() { const e = this.ed(); if (!e) return; if (!e.textContent.trim() && !$('.as-chip', e)) e.innerHTML = ''; },
  /* ---------- @ para escolher o que citar ---------- */
  acItems(q) {
    const p = App.project, n = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_\s]+/g, ' ');
    const qq = n(q), out = [];
    const add = (kind, id, name) => { if (!qq || n(name).includes(qq)) out.push({ kind, id, name }); };
    for (const a of Assets.list(p.id)) add('midia', a.id, a.name);
    for (const c of [...p.clips].sort((a, b) => a.start - b.start)) add('clipe', c.id, c.name || c.text?.text || c.type);
    for (const t of p.tracks) add('faixa', t.id, t.name);
    for (const m of p.markers) add('marcador', m.id, m.label || 'Marcador');
    return out.slice(0, 40);
  },
  acQuery() {
    const sel = getSelection(), e = this.ed(); if (!sel.rangeCount || !e || !sel.isCollapsed) return null;
    const node = sel.anchorNode; if (!node || node.nodeType !== 3 || !e.contains(node)) return null;
    const before = node.nodeValue.slice(0, sel.anchorOffset), m = before.match(/(^|[\s (])@([^\s @]{0,40})$/);
    return m ? { node, end: sel.anchorOffset, start: sel.anchorOffset - m[2].length - 1, q: m[2] } : null;
  },
  acShow() {
    const q = this.acQuery(); let box = $('#assistant .as-ac');
    if (!q) { box && box.remove(); this.ac = null; return; }
    const items = this.acItems(q.q);
    if (!box) { box = h('<div class="as-ac"></div>'); $('#assistant .as-in').appendChild(box); }
    this.ac = { q, items, i: Math.min(this.ac?.i || 0, Math.max(0, items.length - 1)) };
    const label = { midia: 'Mídia', clipe: 'Linha do tempo · clipes', faixa: 'Linha do tempo · faixas', marcador: 'Linha do tempo · marcadores' };
    let last = '';
    box.innerHTML = items.length ? items.map((it, k) => { const f = this.info(it.kind, it.id), L = label[it.kind], head = L !== last ? `<div class="as-ac-h">${L}</div>` : ''; last = L; return `${head}<div class="as-ac-i ${k === this.ac.i ? 'on' : ''}" data-i="${k}">${f.thumb ? `<i style="background-image:url('${f.thumb}')"></i>` : `<em>${ic(f.icon, 12)}</em>`}<div><b>${esc(f.name)}</b><small>${esc(f.sub)}</small></div></div>`; }).join('') : `<div class="as-ac-h">Nada com "${esc(q.q)}"</div>`;
    $$('.as-ac-i', box).forEach(x => { x.onmousedown = ev => { ev.preventDefault(); this.ac.i = +x.dataset.i; this.acPick(); }; });
    $('.as-ac-i.on', box)?.scrollIntoView({ block: 'nearest' });
  },
  acPick() {
    const a = this.ac; if (!a || !a.items.length) return;
    const it = a.items[a.i], r = document.createRange(); r.setStart(a.q.node, a.q.start); r.setEnd(a.q.node, a.q.end); r.deleteContents();
    $('#assistant .as-ac')?.remove(); this.ac = null;
    this.insertChips([it], r);
  },
  bindEditor(e, panel) {
    e.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (this.ac) {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); this.ac.i = clamp(this.ac.i + (ev.key === 'ArrowDown' ? 1 : -1), 0, this.ac.items.length - 1); this.acShow(); return; }
        if ((ev.key === 'Enter' || ev.key === 'Tab') && this.ac.items.length) { ev.preventDefault(); this.acPick(); return; }
        if (ev.key === 'Escape') { ev.preventDefault(); $('#assistant .as-ac')?.remove(); this.ac = null; return; }
      }
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); this.send(); }
    });
    e.addEventListener('input', () => { this.edChanged(); this.saveRange(); this.acShow(); });
    e.addEventListener('keyup', ev => { if (ev.key === ' ' || ev.key === 'Enter') this.linkify(); this.saveRange(); if (!['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(ev.key)) this.acShow(); });
    e.addEventListener('mouseup', () => this.saveRange());
    e.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== e) { $('#assistant .as-ac')?.remove(); this.ac = null; } }, 150));
    e.addEventListener('paste', ev => {
      ev.preventDefault(); const t = ev.clipboardData.getData('text/plain'); let last = 0;
      for (const m of t.matchAll(StyleRefs.LINK_RE)) {
        const url = m[0].replace(/[),.!?]+$/, ''); if (!StyleRefs.platform(url)) continue;
        if (m.index > last) document.execCommand('insertText', false, t.slice(last, m.index));
        this.saveRange(); this.insertChips([{ kind: 'link', id: url }]); last = m.index + url.length;
      }
      if (last < t.length) document.execCommand('insertText', false, t.slice(last));
      this.saveRange();
    });
    e.addEventListener('drop', ev => { if (!ev.dataTransfer.files.length) ev.preventDefault(); });
    // chips: passar o mouse mostra o item, clicar mostra na Mídia / linha do tempo
    panel.addEventListener('mouseover', ev => { const c = ev.target.closest?.('.as-chip'); this.pop(c || null); });
    panel.addEventListener('mouseleave', () => this.pop(null));
    if (!this._popg) { this._popg = true; ['pointerdown', 'wheel', 'keydown'].forEach(t => addEventListener(t, () => this.pop(null), true)); }
    panel.addEventListener('mouseout', ev => { const c = ev.target.closest?.('.as-chip'); if (c && !c.contains(ev.relatedTarget)) this.pop(null); });
    panel.addEventListener('click', ev => { const c = ev.target.closest?.('.as-chip'); if (c) { ev.preventDefault(); this.pop(null); this.reveal(c.dataset.k, c.dataset.id); } });
  },
  // link digitado: quando termina (espaço), vira etiqueta
  linkify() {
    const sel = getSelection(), e = this.ed(); if (!sel.rangeCount || !e) return;
    const node = sel.anchorNode; if (!node || node.nodeType !== 3 || !e.contains(node)) return;
    const before = node.nodeValue.slice(0, sel.anchorOffset), m = before.match(/(https?:\/\/\S+)[\s\u00a0]$/); if (!m) return;
    const url = m[1].replace(/[),.!?]+$/, ''); if (!StyleRefs.platform(url)) return;
    const st = before.length - m[0].length, r = document.createRange(); r.setStart(node, st); r.setEnd(node, st + m[1].length); r.deleteContents();
    this.insertChips([{ kind: 'link', id: url }], r);
  },
  pop(chip) {
    let b = $('#as-pop'); if (!chip) { b && b.remove(); return; }
    const f = this.info(chip.dataset.k, chip.dataset.id);
    if (!b) { b = h('<div id="as-pop"></div>'); document.body.appendChild(b); }
    b.innerHTML = f ? `${f.thumb ? `<div class="pv" style="background-image:url('${f.thumb}')"></div>` : `<div class="pv ic">${ic(f.icon, 30)}</div>`}<b>${esc(f.name)}</b><small>${esc(f.sub)}</small><span>${chip.dataset.k === 'midia' ? 'Clique para mostrar na Mídia' : chip.dataset.k === 'link' ? (StyleRefs.findRef(chip.dataset.id) ? 'Clique para ver a ficha de estilo' : 'Clique para abrir o link') : 'Clique para mostrar na linha do tempo'}</span>` : `<b>Item não existe mais</b><small>Foi apagado do projeto.</small>`;
    const r = chip.getBoundingClientRect(), W = 230; b.style.width = W + 'px';
    b.style.left = clamp(r.left + r.width / 2 - W / 2, 6, innerWidth - W - 6) + 'px';
    const above = r.top > 240; b.style.top = (above ? r.top - 8 : r.bottom + 8) + 'px'; b.classList.toggle('above', above);
  },
  reveal(kind, id) {
    const p = App.project;
    if (kind === 'link') { const r = StyleRefs.findRef(id); if (r) { LibUI.setTab('media'); return StyleRefs.open(r); } return window.open(id, '_blank', 'noopener'); }
    if (kind === 'midia') { if (!Assets.meta(id)) return UI.toast('Essa mídia não existe mais.', { kind: 'warn' }); LibUI.setTab('media'); LibUI.folder = LibUI.folderOf(id); LibUI.selAssets = new Set([id]); LibUI.render(); LibUI.reveal([id]); return; }
    const flash = el => { if (!el) return; el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); el.classList.remove('as-flash'); void el.offsetWidth; el.classList.add('as-flash'); };
    const show = t => { App.seek(t); const sc = Timeline.scroll; if (sc) { const x = t * Timeline.pps, w = sc.clientWidth - Timeline.hw(); if (x < sc.scrollLeft || x > sc.scrollLeft + w - 60) sc.scrollLeft = Math.max(0, x - w / 3); } };
    if (kind === 'clipe') { const c = App.clip(id); if (!c) return UI.toast('Esse clipe não existe mais.', { kind: 'warn' }); App.select(c.id); show(c.start); setTimeout(() => flash($(`.clip[data-clip="${c.id}"]`)), 60); return; }
    if (kind === 'faixa') { if (!App.track(id)) return UI.toast('Essa faixa não existe mais.', { kind: 'warn' }); App.activeTrack = id; App.refresh({ timeline: true }); setTimeout(() => flash($(`[data-lane="${id}"]`)?.parentElement), 60); return; }
    if (kind === 'marcador') { const m = p.markers.find(x => x.id === id); if (!m) return UI.toast('Esse marcador não existe mais.', { kind: 'warn' }); show(m.t); return; }
  },
  // acha o que foi citado: chips (@) ou "nome do arquivo" entre aspas
  refs(text, chips = []) {
    const found = new Map(), p = App.project, assets = Assets.list(p.id);
    for (const c of chips) found.set(c.kind + c.id, c);
    const norm = s => String(s || '').toLowerCase().replace(/\.[a-z0-9]{2,4}$/, '').replace(/[_\s]+/g, ' ').trim();
    for (const m of text.matchAll(/["“”']([^"“”'\n]{1,80})["“”']/g)) {
      const q = norm(m[1]); if (!q) continue;
      const a = assets.find(x => norm(x.name) === q); if (a) { if (!found.has('midia' + a.id)) found.set('midia' + a.id, { kind: 'midia', id: a.id, tok: m[0] }); continue; }
      const c = p.clips.find(x => norm(x.name) === q); if (c && !found.has('clipe' + c.id)) found.set('clipe' + c.id, { kind: 'clipe', id: c.id, tok: m[0] });
    }
    return [...found.values()];
  },
  expand(text, refs) {
    let t = text;
    for (const r of refs) {
      const m = r.kind === 'midia' ? Assets.meta(r.id) : null, c = r.kind === 'clipe' ? App.clip(r.id) : null, tk = r.kind === 'faixa' ? App.track(r.id) : null, mk = r.kind === 'marcador' ? App.project.markers.find(x => x.id === r.id) : null;
      const tag = m ? `[mídia ${m.id}, ${m.kind}, "${m.name}"]` : c ? `[clipe ${c.id}, ${c.type}, "${c.name || ''}", faixa ${c.trackId}, ${round(c.start, 2)}s–${round(c.start + c.dur, 2)}s]` : tk ? `[faixa ${tk.id}, ${tk.type}, "${tk.name}"]` : r.kind === 'link' ? `[link do ${StyleRefs.PF[StyleRefs.platform(r.id)] || 'vídeo'} — ${StyleRefs.findRef(r.id)?.ficha ? 'virou REFERÊNCIA DE ESTILO "' + StyleRefs.findRef(r.id).title + '" (veja a ficha no contexto)' : 'não deu para abrir o vídeo'}]` : mk ? `[marcador "${mk.label || ''}" em ${round(mk.t, 2)}s]` : '';
      t = t.split(r.tok).join(r.tok + ' ' + tag);
    }
    return t;
  },
  async citedImages(refs) {
    const out = [];
    for (const r of refs.slice(0, 6)) { const id = r.kind === 'midia' ? r.id : App.clip(r.id)?.assetId; if (id) out.push(...await AIClient.assetImage(id, true)); }
    return out;
  },
  /* ---------- histórico salvo no projeto (sobrevive ao F5 e vai junto no .toon) ---------- */
  serialize() {
    const log = this.log.filter(m => !m.querySelector('.spin-dot')).slice(-150).map(m => {
      const c = m.cloneNode(true);
      c.querySelectorAll('.btn-row').forEach(r => { if (r.querySelector('[data-a=ap]')) r.innerHTML = '<span style="color:var(--tx3)">(plano de antes — peça de novo se quiser aplicar)</span>'; else r.querySelectorAll('button').forEach(b => b.remove()); });
      c.querySelectorAll('button').forEach(b => b.remove());
      return { c: [...m.classList].filter(x => x !== 'as-msg').join(' '), h: c.innerHTML.slice(0, 20000) };
    });
    const history = this.history.slice(-16).map(x => ({ role: x.role, content: typeof x.content === 'string' ? x.content.slice(-8000) : x.content }));
    return { log, history, v: 1 };
  },
  persist: debounce(() => { const p = App.project; if (!p) return; p.aiChat = Assistant.serialize(); App.setDirty(true); }, 800),
  restore(p) {
    const d = p?.aiChat; this.log = []; this.history = [];
    if (d?.log?.length) this.log = d.log.map(e => h(`<div class="as-msg ${e.c}">${e.h}</div>`));
    if (d?.history?.length) this.history = d.history.filter(x => x && x.role && typeof x.content === 'string');
    if (this.open) this.paint();
  },
  async clearChat() {
    if (!this.log.length) return;
    if (!(await UI.confirm({ title: 'Limpar a conversa', msg: 'Apagar todas as mensagens desta conversa com a IA? (o projeto não muda)', ok: 'Limpar', danger: true }))) return;
    this.log = []; this.history = []; AIClient.sent.clear(); App.project.aiChat = null; App.setDirty(true); this.paint();
  },
  /* ---------- trava o editor enquanto a IA mexe no projeto ---------- */
  lock(on, label) {
    this.locked = on; let o = $('#ai-lock');
    if (!on) { o && o.remove(); return; }
    if (App.playing) App.pause();
    if (!o) {
      o = h(`<div id="ai-lock"><div class="ai-lock-box"><span class="spin-dot"></span><div><b data-l></b><small>Espere a IA terminar — o editor fica travado para nada se misturar.</small></div><button class="btn sm" data-stop>Parar a IA</button></div></div>`);
      document.body.appendChild(o); $('[data-stop]', o).onclick = () => AIClient.cancel();
      ['pointerdown', 'mousedown', 'click', 'dblclick', 'contextmenu', 'wheel', 'dragover', 'drop'].forEach(ev => o.addEventListener(ev, e => { if (!e.target.closest('[data-stop]')) { e.preventDefault(); e.stopPropagation(); } }, { passive: false }));
    }
    $('[data-l]', o).textContent = label || 'A IA está editando o projeto…';
    if (!this._lk) { this._lk = true; window.addEventListener('keydown', e => { if (this.locked && !e.target.closest?.('#assistant') && !e.target.closest?.('.modal')) { e.stopImmediatePropagation(); e.preventDefault(); } }, true); }
  },
  // aviso grande antes de apagar qualquer coisa → 'all' | 'nodel' | 'cancel'
  async confirmDeletes(list) {
    const del = AssistExec.deletions(list); if (!del.length) return 'all';
    const n = del.reduce((s, d) => s + d.n, 0);
    Notify.send('A IA precisa da sua confirmação', `Ela quer apagar ${n} coisa(s)`);
    const f = h(`<div><div class="del-warn">${ic('trash', 28)}<div><b>A IA vai APAGAR ${n} coisa(s) do projeto.</b><br><small>Confira a lista. Dá para desfazer depois (Ctrl+Z), mas olhe com atenção.</small></div></div>
      <ul class="del-list">${del.map(d => `<li class="${d.big ? 'big' : ''}">${esc(d.t)}</li>`).join('')}</ul></div>`);
    const r = await UI.modal({ title: 'Atenção: a IA quer apagar coisas', icon: 'trash', width: 580, body: f, sticky: true, cancelValue: 'cancel', buttons: [{ label: 'Cancelar tudo', value: 'cancel', left: true }, { label: 'Fazer o resto sem apagar', value: 'nodel' }, { label: `Apagar ${n} e aplicar`, kind: 'danger', value: 'all' }] });
    return r || 'cancel';
  },
  addMsg(html, cls) { const m = h(`<div class="as-msg ${cls}">${html}</div>`); this.decorate(m); if (cls === 'err' && /conta Google/.test(html)) { const bt = h(`<div class="btn-row"><button class="btn sm primary">${ic('lock', 12)} Entrar pelo menu</button></div>`); $('button', bt).onclick = async () => { if (await TurmaAuth.loginOnly()) { bt.remove(); UI.toast('Pronto! Pode pedir de novo.', { kind: 'ok' }); } }; m.appendChild(bt); } this.log.push(m); if (cls !== 'sys' || !/spin-dot/.test(html)) this.persist(); const log = $('#assistant .as-log'); if (log) { if (this.log.length === 1) log.innerHTML = ''; log.appendChild(m); log.scrollTop = log.scrollHeight; } return m; },
  // mensagem do usuário: mantém os chips coloridos, o resto vira texto
  msgHTML(html) {
    const d = document.createElement('div'); d.innerHTML = html; let out = '';
    const walk = n => { for (const c of n.childNodes) { if (c.nodeType === 3) out += esc(c.nodeValue); else if (c.classList?.contains('as-chip')) { c.removeAttribute('contenteditable'); out += c.outerHTML; } else if (c.nodeName === 'BR') out += '<br>'; else { if (/^(DIV|P)$/.test(c.nodeName) && out && !out.endsWith('<br>')) out += '<br>'; walk(c); } } };
    walk(d); return out;
  },
  md(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^[-•] (.+)$/gm, '• $1').replace(/\n/g, '<br>'); },
  async send(again) {
    const el = $('#assistant'); if (this.busy) return; this.pop(null);
    const rd0 = again && typeof again === 'object' ? again : this.readEd(); if (!rd0.text) return;
    // respondendo a uma mensagem: a IA recebe o trecho citado junto
    const rp = !(again && typeof again === 'object') && this.reply ? this.reply : null;
    const rd = rp ? { ...rd0, text: `[Respondendo à mensagem ${rp.who === 'IA' ? 'da IA' : 'que eu mandei'}: "${rp.text.slice(0, 900)}"]\n${rd0.text}`, html: `<div class="as-q">${esc(rp.text.slice(0, 200))}${rp.text.length > 200 ? '…' : ''}</div>` + rd0.html } : rd0, text = rd.text;
    if (rp) { this.reply = null; this.paintReply(); }
    const refs = this.refs(text, rd.refs); this.lastAsk = text;
    if (!(again && typeof again === 'object')) { this.ed().innerHTML = ''; this.addMsg(rp ? rd.html.replace(/^(<div class="as-q">[\s\S]*?<\/div>)([\s\S]*)$/, (m0, q, rest) => q + this.msgHTML(rest)) : this.msgHTML(rd.html), 'me'); this.persist(); }
    this.lastSent = rd;
    if (!AIClient.ready) { this.addMsg('A IA do Estúdio Problems ainda não foi ligada (falta configurar o servidor na Cloudflare).', 'err'); return; }
    const links = StyleRefs.findLinks(text).filter(u => !StyleRefs.findRef(u));
    for (const u of links) {
      const pf = StyleRefs.platform(u), P = StyleRefs.PF[pf];
      if (pf === 'instagram') { await StyleRefs.addLink(u, true); this.addMsg(`${ic('alert', 12)} O <b>Instagram</b> não deixa a IA abrir o vídeo pelo link. Para usar como referência, baixe o vídeo (se tiver permissão) e coloque na Mídia → botão direito → <b>Usar como referência de estilo</b>.`, 'sys'); continue; }
      const m = this.addMsg(`<span class="spin-dot"></span> Lendo o vídeo de referência do ${P}…`, 'sys'); const r = await StyleRefs.addLink(u, true); m.remove(); this.log = this.log.filter(x => x !== m);
      if (r?.ficha) this.addMsg(`${ic('film', 12)} Referência de estilo adicionada: <b>${esc(r.title)}</b> — vou seguir esse estilo. (Mídia → Referências de estilo)`, 'sys');
    }
    $$('#assistant .as-log .as-chip.k-link').forEach(c => c.replaceWith(h(this.chipHTML('link', c.dataset.id))));
    // áudios sem transcrição: transcreve antes, para a IA saber o que é falado e quando
    const audIds = [...Assets.list(App.project.id).filter(a => a.kind === 'audio').slice(0, 8).map(a => a.id), ...App.project.clips.filter(c => (c.type === 'audio' || (c.type === 'video' && Assets.meta(c.assetId)?.hasAudio)) && !c.muted && c.assetId && !c.assetId.startsWith('snd:')).map(c => c.assetId), ...refs.filter(r => r.kind === 'midia').map(r => r.id)];
    let trMsg = null;
    this.busy = true; this.setBusy(true);
    try { await Transcribe.ensure(audIds, n => { trMsg = this.addMsg(`<span class="spin-dot"></span> Transcrevendo ${n > 1 ? n + ' áudios' : 'o áudio'} para a IA entender as falas…`, 'sys'); }); } catch { }
    this.busy = false; this.setBusy(false);
    if (trMsg) { trMsg.remove(); this.log = this.log.filter(x => x !== trMsg); const k = audIds.filter(id => Transcribe.get(id)?.segs?.length).length; if (k) this.addMsg(`${ic('text', 12)} Transcrição pronta — dá para ver e corrigir no painel da direita (aba Transcrição) ou no ícone <b>T</b> da Mídia.`, 'sys'); }
    if (typeof TeamLib !== 'undefined' && TeamLib.enabled) { try { if (!TeamLib.items) await TeamLib.refresh(); if (!Knowledge._teamLoaded) { Knowledge._teamLoaded = true; await Knowledge.loadTeam(); } } catch { } }
    const full = this.expand(text, refs), imgs = await this.citedImages(refs);
    if (this.chat) return this.sendChat(text, full, imgs);
    this.busy = true; this.setBusy(true); this.lock(true, 'A IA está montando a edição…');
    const wait = this.addMsg(`<span class="spin-dot"></span> <span data-w>A IA está montando a edição…</span><span data-n></span> <button class="btn xs" data-stop>Parar</button><br><small>Pode minimizar ou usar outra aba — eu aviso quando ficar pronto.</small>`, 'sys');
    $('[data-stop]', wait).onclick = () => AIClient.cancel();
    const tm = this.timer(wait, 'edit', 'A IA está montando a edição…');
    try {
      const { data, messages } = await AIClient.ask(full, this.history.slice(-8), imgs, (n, round, cont) => { const w = $('[data-n]', wait); if (w) w.textContent = n ? ` · ${n} ação(ões) escritas${round ? ` · parte ${round + 1}` : ''}` : (cont ? ' · continuando…' : ''); });
      this.history = messages;
      wait.remove(); this.log = this.log.filter(x => x !== wait);
      const acts = Array.isArray(data.acoes) ? data.acoes : [];
      this.plan(acts, data.resumo ? esc(data.resumo) : '', this.auto || this.forceAuto, { fromAI: true, prompt: text });
      Notify.send(this.auto ? 'Edição feita pela IA!' : 'A IA terminou — confira e aplique', data.resumo || `${acts.length} mudança(s)`);
      if (!this.open) { $('#btn-ai').classList.add('ready'); UI.toast('A IA terminou a edição', { kind: 'ok', action: { label: 'Ver', fn: () => this.toggle(true) } }); }
    } catch (e) { tm.fail = true; wait.remove(); this.log = this.log.filter(x => x !== wait); this.addMsg(esc(e.message || e), 'err'); Notify.send('A IA deu erro', String(e.message || e)); }
    tm.stop(!tm.fail);
    this.busy = false; this.setBusy(false); if (!this.applying) this.lock(false);
  },
  // tempo da IA em minutos + quanto deve demorar (média das últimas respostas deste tipo)
  fmtDur(sec) { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return m ? `${m} min${s ? ' ' + String(s).padStart(2, '0') + ' s' : ''}` : `${s} s`; },
  estimate(kind) { let a = []; try { a = JSON.parse(localStorage.getItem('ps-ai-tempos') || '{}')[kind] || []; } catch { } const def = { edit: 100, chat: 20, review: 70 }[kind] || 60; if (!a.length) return def; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; },
  learnTime(kind, sec) { try { const o = JSON.parse(localStorage.getItem('ps-ai-tempos') || '{}'); o[kind] = [...(o[kind] || []), Math.round(sec)].slice(-7); localStorage.setItem('ps-ai-tempos', JSON.stringify(o)); } catch { } },
  timer(wait, kind, label) {
    const t0 = Date.now(), est = this.estimate(kind);
    const put = () => { const el = (Date.now() - t0) / 1000, w = $('[data-w]', wait); const left = est - el;
      const tx = `${label} ${this.fmtDur(el)} · ${left > 5 ? 'deve levar ~' + this.fmtDur(Math.ceil(est / 10) * 10) : el < est * 2 ? 'quase lá…' : 'está demorando mais que o normal…'}`;
      if (w) w.textContent = tx; TabTitle.set(null, `IA ${this.fmtDur(el)}`); };
    put(); const tick = setInterval(put, 1000);
    return { t0, stop: ok => { clearInterval(tick); TabTitle.clear(); if (ok) this.learnTime(kind, (Date.now() - t0) / 1000); } };
  },
  async sendChat(text, full, imgs) {
    this.busy = true; this.setBusy(true);
    const wait = this.addMsg(`<span class="spin-dot"></span> <span data-w>pensando…</span>`, 'sys');
    const tm = this.timer(wait, 'chat', 'pensando…');
    try {
      const r = await AIClient.chat(full, this.history.slice(-10), imgs);
      this.history = r.messages; wait.remove(); this.log = this.log.filter(x => x !== wait);
      const m = this.addMsg(this.md(r.text) + (r.edit ? `<div class="btn-row"><button class="btn sm primary" data-a="ed">${ic('sparkles', 12)} Ir para Editar e fazer a edição</button></div>` : ''), 'ai');
      if (r.edit) { const rd = this.lastSent; $('[data-a=ed]', m).onclick = () => { $('.btn-row', m).remove(); this.chat = false; this.paint(); this.send(rd); }; }
      if (!this.open) { $('#btn-ai').classList.add('ready'); }
      tm.stop(true);
    } catch (e) { tm.stop(false); wait.remove(); this.log = this.log.filter(x => x !== wait); this.addMsg(esc(e.message || e), 'err'); }
    this.busy = false; this.setBusy(false);
  },
  // depois de aplicar: a IA olha quadros do resultado e corrige o que ficou errado
  async reviewRun(applied, prompt) {
    if (this.busy) return;
    this.busy = true; this.setBusy(true); this.lock(true, 'A IA está conferindo o resultado…');
    const wait = this.addMsg(`<span class="spin-dot"></span> <span data-f>Conferindo o resultado…</span><br><span data-w></span> <button class="btn xs" data-stop>Parar</button><div class="as-prog"><i data-p></i></div>`, 'sys');
    let tm = null;
    $('[data-stop]', wait).onclick = () => AIClient.cancel();
    try {
      const ts = new Set(); const D = Math.max(.1, App.duration - .05);
      for (const a of applied) { const c = a.clipe && App.clip(a.clipe); for (const v of [a.inicio, a.tempo]) if (isFinite(+v)) ts.add(clamp(+v + .15, 0, D)); if (Array.isArray(a.pontos)) a.pontos.forEach(q => isFinite(+q.tempo) && ts.add(clamp(+q.tempo, 0, D))); if (c) ts.add(clamp(c.start + c.dur / 2, 0, D)); }
      let times = [...ts].sort((x, y) => x - y); if (times.length > 6) times = Array.from({ length: 6 }, (_, i) => times[Math.round(i * (times.length - 1) / 5)]);
      if (!times.length) times = [Math.min(App.t, D)];
      const tl = [...new Set(times.map(t => round(t, 2)))], D2 = App.duration;
      const imgs = await AIClient.frames(tl, (i, t) => { const pc = Math.round((i + 1) / tl.length * 100); const f = $('[data-f]', wait), pb = $('[data-p]', wait); if (f) f.innerHTML = `Olhando o quadro <b>${i + 1} de ${tl.length}</b> · em <b>${fmtTime(t, App.fps, false)}</b> de ${fmtTime(D2, App.fps, false)} · <b>${pc}%</b>`; if (pb) pb.style.width = pc + '%'; });
      { const f = $('[data-f]', wait); if (f) f.innerHTML = `Vi ${tl.length} quadro(s) (de ${fmtTime(tl[0], App.fps, false)} a ${fmtTime(tl[tl.length - 1], App.fps, false)} · vídeo de ${fmtTime(D2, App.fps, false)}) · <b>100%</b> — a IA está analisando`; }
      tm = this.timer(wait, 'review', 'Analisando…');
      const bad = this.lastBad?.length ? '\nAções que NÃO puderam ser feitas: ' + this.lastBad.join('; ') : '';
      const { data, messages } = await AIClient.ask(`REVISÃO: as ações que você mandou já foram aplicadas. Acima estão quadros do RESULTADO. Confira com cuidado se ficou como o pedido original ("${String(prompt || '').slice(0, 400)}"): personagens certos e inteiros na tela (nada cortado fora da borda, recortes sem pedaço de outra pose), tamanhos e posições bons, expressões certas, textos legíveis, nada tampando o que não devia.${bad}\nSe algo estiver errado, mande SÓ as ações de correção (ex.: posicionar, recortar, keyframe, trocar_midia). Se estiver tudo bem, mande só {"resumo":"Conferi: ..."} e {"fim":true}.`, this.history.slice(-8), imgs);
      this.history = messages;
      wait.remove(); this.log = this.log.filter(x => x !== wait);
      const acts = Array.isArray(data.acoes) ? data.acoes : [];
      this.plan(acts, data.resumo ? esc(data.resumo) : '', this.auto, { review: true });
      if (acts.length) Notify.send('A IA conferiu e sugeriu ajustes', data.resumo || `${acts.length} ajuste(s)`);
      tm?.stop(true);
    } catch (e) { tm?.stop(false); wait.remove(); this.log = this.log.filter(x => x !== wait); this.addMsg('Não deu para conferir o resultado: ' + esc(e.message || e), 'err'); }
    this.busy = false; this.setBusy(false); if (!this.applying) this.lock(false);
  },
  // mostra o que vai ser feito e pede para aplicar (nada muda sem você confirmar)
  setBusy(on) { const x = $('#assistant [data-a=x]'); if (x) { x.classList.toggle('locked', !!on); x.title = on ? 'Espere a IA terminar' : 'Fechar'; }
    if (!this._bu) { this._bu = true; addEventListener('beforeunload', () => { if (this.working) this.persist?.(); }); } const b = $('#btn-ai'); if (!b) return; b.classList.toggle('busy', on); b.innerHTML = on ? '<span class="spin-dot"></span>IA trabalhando…' : ic('sparkles', 14) + 'Assistente'; },
  get auto() { try { return localStorage.getItem('ps-ai-auto') !== '0'; } catch { return true; } },
  set auto(v) { try { localStorage.setItem('ps-ai-auto', v ? '1' : '0'); } catch { } },
  plan(actions, note, autoApply, o = {}) {
    actions = (actions || []).filter(a => a && typeof a === 'object');
    AssistExec._newIds = new Set([...actions.map(a => a.id_novo), ...actions.flatMap(a => (a.partes || []).map(x => x.id_novo))].filter(Boolean));
    const ok = actions.filter(a => !AssistExec.valid(a)), badL = actions.filter(a => AssistExec.valid(a)), bad = badL.length;
    const why = bad ? `<details class="as-bad"><summary>${bad} ignorada(s)</summary>${badL.slice(0, 12).map(a => `<div>• ${esc(a.tipo || '?')}: ${esc(AssistExec.valid(a))}</div>`).join('')}</details>` : '';
    this.lastBad = badL.map(a => `${a.tipo}: ${AssistExec.valid(a)}`);
    if (!ok.length) { const mm = this.addMsg((note ? note + '<br>' : '') + (bad ? why : (o.review ? `<span style="color:var(--ok)">${ic('check', 12)} Conferi os quadros: está tudo certo.</span>` : 'Nada para fazer.')), 'ai'); return mm; }
    const m = this.addMsg(`${note ? `<div>${note}</div>` : ''}<div class="as-plan"><b>${o.review ? 'Ajustes depois de conferir' : 'Vou fazer'} ${ok.length} coisa(s):</b><ol>${ok.slice(0, 40).map(a => `<li>${esc(AssistExec.describe(a))}</li>`).join('')}${ok.length > 40 ? `<li>… e mais ${ok.length - 40}</li>` : ''}</ol>${why}</div><div class="btn-row"><button class="btn sm primary" data-a="ap">${ic('check', 12)} Aplicar</button><button class="btn sm" data-a="no">Não</button></div>`, 'ai');
    $('[data-a=ap]', m).onclick = async () => {
      $('[data-a=ap]', m).disabled = true; $('[data-a=ap]', m).innerHTML = '<span class="spin-dot"></span> Aplicando…';
      this.lock(false);
      const ans = await this.confirmDeletes(ok);
      if (ans === 'cancel') { $('.btn-row', m).innerHTML = '<span style="color:var(--tx3)">Cancelado (nada foi apagado)</span>'; return; }
      const DEL = ['excluir', 'excluir_faixa', 'limpar_linha_do_tempo', 'remover_animacoes'];
      const list = ans === 'nodel' ? ok.filter(a => !DEL.includes(a.tipo)) : ok;
      this.applying = true; this.lock(true, 'A IA está aplicando as mudanças…');
      let n = 0; try { n = await AssistExec.run(list); } finally { this.applying = false; this.lock(false); }
      $('.btn-row', m).innerHTML = `<span style="color:var(--ok)">${ic('check', 12)} Feito (${n})</span> <button class="btn sm" data-a="un">Desfazer</button>`;
      $('[data-a=un]', m).onclick = () => { App.undo(); $('.btn-row', m).innerHTML = '<span style="color:var(--tx3)">Desfeito</span>'; };
      App.commit(`Assistente: ${n} mudança(s) aplicada(s)`, { toast: true, all: true });
      const first = list.find(a => a.inicio !== undefined); if (first) App.seek(+first.inicio);
      if (o.fromAI && !o.review && AIClient.review && AIClient.ready && n) this.reviewRun(list, o.prompt);
    };
    $('[data-a=no]', m).onclick = () => { $('.btn-row', m).innerHTML = '<span style="color:var(--tx3)">Cancelado</span>'; };
    if (autoApply) $('[data-a=ap]', m).click();
  },
};
