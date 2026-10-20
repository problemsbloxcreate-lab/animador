/* ===================== creator.js — "Criar vídeo com IA" (modo simples) =====================
   Uma tela só: formato (Shorts ou vídeo), personagens (imagens + quem é), áudios, o que acontece,
   links/canais para a IA estudar antes, cenários e pedidos extras → a IA monta tudo no editor completo. */
'use strict';

/* ---------- ler roteiro de arquivo: .txt/.md/.srt/.vtt, .docx (Word) e .pdf ---------- */
const ScriptFile = {
  ACCEPT: '.txt,.md,.srt,.vtt,.docx,.pdf,text/*',
  is(f) { return /\.(txt|md|srt|vtt|docx|pdf)$/i.test(f.name) || (f.type || '').startsWith('text/'); },
  async read(f) {
    const n = f.name.toLowerCase();
    if (n.endsWith('.docx')) return this.docx(await f.arrayBuffer());
    if (n.endsWith('.pdf')) return this.pdf(await f.arrayBuffer());
    return (await f.text()).replace(/\r/g, '');
  },
  async inflate(u8) { const ds = new DecompressionStream('deflate-raw'); const r = new Blob([u8]).stream().pipeThrough(ds); return new Uint8Array(await new Response(r).arrayBuffer()); },
  async docx(buf) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
    let e = buf.byteLength - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--; if (e < 0) throw new Error('Arquivo .docx inválido');
    const cnt = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true), xml = null;
    for (let i = 0; i < cnt; i++) {
      const method = dv.getUint16(p + 10, true), csz = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lo = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      if (name === 'word/document.xml') { const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u8.subarray(ds, ds + csz); xml = dec.decode(method === 8 ? await this.inflate(raw) : raw); break; }
      p += 46 + nl + xl + cl;
    }
    if (!xml) throw new Error('Não achei o texto dentro do .docx');
    const doc = new DOMParser().parseFromString(xml, 'application/xml'), W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main', out = [];
    for (const para of doc.getElementsByTagNameNS(W, 'p')) {
      let t = ''; for (const n of para.getElementsByTagNameNS(W, '*')) { if (n.localName === 't') t += n.textContent; else if (n.localName === 'tab') t += '\t'; else if (n.localName === 'br') t += '\n'; }
      out.push(t);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  },
  async pdf(buf) {
    if (!window.pdfjsLib) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; sc.onload = ok; sc.onerror = () => no(new Error('Não consegui carregar o leitor de PDF (precisa de internet).')); document.head.appendChild(sc); });
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise, pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const tc = await (await pdf.getPage(i)).getTextContent(); let line = '', lastY = null, txt = '';
      for (const it of tc.items) { const y = it.transform?.[5]; if (lastY !== null && Math.abs(y - lastY) > 2) { txt += line.trimEnd() + '\n'; line = ''; } line += it.str; if (it.hasEOL) { txt += line.trimEnd() + '\n'; line = ''; } lastY = y; }
      pages.push(txt + line);
    }
    return pages.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  },
};

/* ---------- de qual canal é um link? (marca o canal conhecido ou cria um novo) ---------- */
const ChannelDetect = {
  KEYS: { brubs: /brubs/i, torajo: /torajo/i, drawnmask: /drawn\s*-?mask/i, batatinha: /batatinha/i },
  known(name) { for (const [k, re] of Object.entries(this.KEYS)) if (re.test(name || '')) return k; return null; },
  cache: {},
  async of(url) {
    if (this.cache[url] !== undefined) return this.cache[url];
    let name = null, m;
    if ((m = url.match(/youtube\.com\/(?:@|c\/|user\/)([^\/?#\s]+)/i))) name = '@' + decodeURIComponent(m[1]).replace(/^@/, '');
    else if ((m = url.match(/tiktok\.com\/@([^\/?#\s]+)/i))) name = '@' + m[1];
    else if ((m = url.match(/instagram\.com\/(?!reel|reels|p\/|tv\/)([\w.]+)/i))) name = '@' + m[1];
    else if (StyleRefs.ytId(url) && AIClient.server) {
      try { const q = await fetch(`${AIClient.server}/yt/info?id=${StyleRefs.ytId(url)}`, { headers: await AIClient.authHeader() }); const j = q.ok ? await q.json() : {}; name = j.author_name || null; } catch { }
    }
    return (this.cache[url] = name);
  },
};

const Creator = {
  async open(o = {}) {
    const st = { formato: o.formato || 'shorts', chars: [], audios: [], cenarios: [] };
    const fmtTxt = f0 => f0 === 'video' ? 'Vídeo do YouTube (horizontal)' : 'Shorts (vertical)';
    const f = h(`<div class="cr cr2">
      <div class="cr-top">${o.lockFormat && o.project ? `<span class="cr-badge">${ic('film', 13)} ${fmtTxt(o.formato)} · ${o.project.settings.w}×${o.project.settings.h}</span>` : `<div class="cr-fmt"><button data-fmt="shorts"><i class="ph v"></i><b>Shorts</b><small>vertical · legendas</small></button><button data-fmt="video"><i class="ph h"></i><b>Vídeo do YouTube</b><small>horizontal</small></button></div>`}
        <span class="cr-tip">Coloque <b>quem aparece</b>, <b>a voz</b> e <b>o que acontece</b>. O resto a IA faz.</span></div>
      <div class="cr-step"><b><span class="cr-n">1</span> Quem aparece</b><small>uma imagem por pose/expressão (ou uma folha de sprites) e um nome</small>
        <div class="cr-chars" data-chars></div><button class="btn sm" data-a="char">${ic('plus', 12)} Outro personagem</button></div>
      <div class="cr-step"><b><span class="cr-n">2</span> A voz</b><small>o áudio com as falas (a IA transcreve e sincroniza tudo)</small>
        <div class="import-zone cr-drop" data-aud>${ic('mic', 18)}<b>Arraste o áudio aqui ou clique</b></div><div class="cr-list" data-audl></div></div>
      <div class="cr-step"><b><span class="cr-n">3</span> O que acontece</b><small>uma ou duas frases — ou cole o roteiro abaixo</small>
        <textarea data-exp rows="3" placeholder="Ex.: O Problems reclama de um canal que copia ele; quando fala o nome do canal, aparece a imagem do Problems no círculo. Termina convencido."></textarea>
        <details class="cr-sub" ${o.project?.script ? 'open' : ''}><summary>${ic('file', 12)} Tenho roteiro</summary>
          <textarea data-scr rows="6" placeholder="Cole o roteiro (ou abra .txt/.docx/.pdf). Ex.:&#10;PROBLEMS (bravo): Quem destruiu meu quarto?!&#10;[ZOOM no rosto] [som de impacto]&#10;VERDE (assustado): ...eu não fui"></textarea>
          <div class="btn-row" style="margin-top:6px"><button class="btn sm" data-a="scrf">${ic('folder', 12)} Abrir arquivo</button><small data-scrn style="color:var(--tx3)"></small></div></details></div>
      <details class="cr-more"><summary>Mais opções <small>(estilo, links para estudar, cenário, pedidos)</small></summary>
        <div class="cr-step"><b>Estilo e referências</b><small>marque os canais-base ou cole links de vídeos/canais para a IA estudar antes</small>
          <div class="cr-chan" data-chan>${Object.entries(GENRE.CANAIS).map(([k, c]) => `<label class="chip"><input type="checkbox" data-ch="${k}" checked> ${esc(c.nome)}</label>`).join('')}</div>
          <textarea data-links rows="2" placeholder="Links (um por linha): vídeos do YouTube/TikTok ou canais (youtube.com/@canal)"></textarea><small data-chdet style="color:var(--tx3)"></small></div>
        <div class="cr-step"><b>Cenário</b><small>sem cenário a IA usa o fundo de bolinhas animado</small>
          <div class="import-zone cr-drop" data-bg>${ic('image', 18)}<b>Arraste cenários aqui ou clique</b></div><div class="cr-list" data-bgl></div></div>
        <div class="cr-step"><b>Pedidos extras</b>
          <input type="text" data-extra placeholder="Ex.: bem exagerado, legenda amarela, terminar acenando">
          <div class="cr-quick">${['bem exagerado (cartoon)', 'ritmo calmo', 'legenda amarela', 'muitos sons de meme', 'poucos sons, só nas piadas', 'música de fundo baixinha', 'terminar com hold e pose de efeito', 'personagem aponta para quem é citado', 'tirar as pausas da voz'].map(t => `<span class="chip" data-q="${t}">+ ${t}</span>`).join('')}</div></div>
        ${typeof TeamLib !== 'undefined' ? `<label class="switch" style="margin-top:4px"><input type="checkbox" data-eq ${TeamLib.enabled ? 'checked' : ''}><i></i>A IA pode usar os itens da equipe (nuvem)</label>` : ''}
      </details>
      <div data-ai style="margin-top:4px"></div>
    </div>`);
    const paintFmt = () => $$('[data-fmt]', f).forEach(b => b.classList.toggle('on', b.dataset.fmt === st.formato));
    $$('[data-fmt]', f).forEach(b => b.onclick = () => { st.formato = b.dataset.fmt; paintFmt(); }); paintFmt();
    const EQ = $('[data-eq]', f); if (EQ) EQ.onchange = () => TeamLib.setEnabled(EQ.checked, true);
    $('[data-ai]', f).innerHTML = AIClient.ready ? '' : `<div class="hint" style="margin:0">${ic('alert', 12)} A IA do Estúdio Problems não está ligada neste editor (falta o servidor na Cloudflare). Dá para preparar tudo, mas a montagem automática precisa da IA.</div>`;
    // personagens
    const CH = $('[data-chars]', f);
    const addChar = (init) => {
      const c = { nome: init?.nome || '', descricao: (init?.descricao || '').replace(/ \(as imagens são FOLHA DE SPRITES[^)]*\)/, ''), files: [], midias: (init?.midias || []).filter(id => Assets.meta(id)), sheet: !!init?.folha }; st.chars.push(c);
      const el = h(`<div class="cr-char"><div class="cr-thumbs" data-th>${ic('image', 20)}<small>imagens</small></div><div style="flex:1;display:flex;flex-direction:column;gap:6px">
        <input type="text" data-n placeholder="Nome (ex.: Problems)"><textarea data-d rows="2" placeholder="Quem é / jeito (ex.: protagonista, azul, fala rápido e se assusta fácil)"></textarea>
        <label class="switch" style="font-size:12px"><input type="checkbox" data-s><i></i>É uma folha de sprites (a IA recorta cada pose)</label></div><button class="ibtn xs" data-x title="Tirar">${ic('x', 12)}</button></div>`);
      $('[data-n]', el).value = c.nome; $('[data-d]', el).value = c.descricao; $('[data-s]', el).checked = c.sheet;
      $('[data-n]', el).oninput = e => c.nome = e.target.value; $('[data-d]', el).oninput = e => c.descricao = e.target.value; $('[data-s]', el).onchange = e => c.sheet = e.target.checked;
      const th = $('[data-th]', el), paint = () => { const srcs = [...c.midias.map(id => Assets.meta(id)?.thumb).filter(Boolean), ...c.files.map(fl => URL.createObjectURL(fl))]; th.innerHTML = srcs.length ? srcs.slice(0, 6).map(u => `<img src="${u}">`).join('') + (srcs.length > 6 ? `<small>+${srcs.length - 6}</small>` : '') : `${ic('image', 20)}<small>clique ou arraste as imagens</small>`; };
      const take = fl => { c.files.push(...fl.filter(x => /image/.test(x.type) || /\.(png|jpe?g|webp|gif)$/i.test(x.name))); paint(); if (!c.nome && c.files[0]) { c.nome = c.files[0].name.replace(/\.[^.]+$/, '').replace(/[-_]?\d+$/, ''); $('[data-n]', el).value = c.nome; } };
      th.onclick = async () => take(await pickFiles('image/*'));
      th.ondragover = e => { e.preventDefault(); e.stopPropagation(); th.classList.add('over'); }; th.ondragleave = () => th.classList.remove('over');
      th.ondrop = e => { e.preventDefault(); e.stopPropagation(); e._handled = true; th.classList.remove('over'); take([...e.dataTransfer.files]); };
      $('[data-x]', el).onclick = () => { st.chars = st.chars.filter(x => x !== c); el.remove(); };
      CH.appendChild(el); paint();
    };
    $('[data-a=char]', f).onclick = () => addChar();
    // projeto que já tem as informações (abrindo pelo Assistente): preenche tudo
    const P0 = o.project;
    if (P0?.personagens?.length) P0.personagens.forEach(pc => addChar(pc)); else addChar();
    if (P0) {
      const ex = String(P0.explicacao || ''), k = ex.indexOf('\nPedidos extras: ');
      $('[data-exp]', f).value = P0.explicacaoTexto ?? (k >= 0 ? ex.slice(0, k) : ex.replace(/^Pedidos extras: [\s\S]*$/, ''));
      $('[data-extra]', f).value = P0.extras ?? (k >= 0 ? ex.slice(k + 17) : '');
      if (P0.canaisBase) $$('[data-ch]', f).forEach(cb => cb.checked = P0.canaisBase.includes(cb.dataset.ch));
      const links = [...(P0.canaisLinks || []), ...((typeof StyleRefs !== 'undefined' ? StyleRefs.list() : []).map(r => r.url).filter(Boolean))];
      if (links.length) $('[data-links]', f).value = [...new Set(links)].join('\n');
      (P0.canaisNovos || []).forEach(n => $('[data-chan]', f).appendChild(h(`<label class="chip auto"><input type="checkbox" data-new="${esc(n)}" checked> ${ic('plus', 10)} ${esc(n)}</label>`)));
    }
    const zone = (sel, list, arr, acc) => {
      const z = $(sel, f), L = $(list, f), paint = () => L.innerHTML = arr.map(x => `<span class="chip static">${esc(x.name)}</span>`).join('');
      const take = fl => { arr.push(...fl.filter(acc)); paint(); };
      z.onclick = async () => take(await pickFiles(sel === '[data-aud]' ? 'audio/*,video/*' : 'image/*,video/*'));
      z.ondragover = e => { e.preventDefault(); e.stopPropagation(); z.classList.add('over'); }; z.ondragleave = () => z.classList.remove('over');
      z.ondrop = e => { e.preventDefault(); e.stopPropagation(); e._handled = true; z.classList.remove('over'); take([...e.dataTransfer.files]); };
    };
    // links → marca o canal conhecido ou cria um chip novo para o canal
    const LK = $('[data-links]', f), CHN = $('[data-chan]', f), chDet = $('[data-chdet]', f);
    const detect = debounce(async () => {
      const urls = LK.value.split(/\s+/).filter(x => /^https?:\/\//.test(x)); const found = [];
      for (const u of urls) {
        const name = await ChannelDetect.of(u); if (!name) continue;
        const k = ChannelDetect.known(name);
        if (k) { const cb = $(`[data-ch="${k}"]`, CHN); if (cb) { cb.checked = true; cb.parentElement.classList.add('auto'); } found.push(GENRE.CANAIS[k].nome); continue; }
        if (![...$$('[data-new]', CHN)].some(x => x.dataset.new === name)) CHN.appendChild(h(`<label class="chip auto" title="Canal novo (veio dos links)"><input type="checkbox" data-new="${esc(name)}" checked> ${ic('plus', 10)} ${esc(name)}</label>`));
        found.push(name);
      }
      chDet.textContent = found.length ? 'Canais detectados nos links: ' + [...new Set(found)].join(', ') : (urls.length && !AIClient.server ? 'Para descobrir o canal de links de vídeo, a IA do Estúdio Problems precisa estar ligada.' : '');
    }, 500);
    LK.oninput = detect;
    $$('[data-q]', f).forEach(c => c.onclick = () => { const i = $('[data-extra]', f), t = c.dataset.q; if (i.value.includes(t)) return; i.value = (i.value.trim() ? i.value.trim().replace(/[,.]$/, '') + ', ' : '') + t; c.classList.add('on'); });
    // roteiro: colar ou abrir arquivo (também dá para arrastar o arquivo em cima do campo)
    const SC = $('[data-scr]', f), scN = $('[data-scrn]', f);
    if (o.project?.script) SC.value = o.project.script;
    const loadScript = async fl => { if (!fl) return; scN.textContent = 'Lendo ' + fl.name + '…'; try { const t = await ScriptFile.read(fl); SC.value = (SC.value.trim() ? SC.value.trim() + '\n\n' : '') + t; scN.textContent = `${fl.name}: ${t.length} letras`; } catch (e) { scN.textContent = ''; UI.toast(esc(e.message || e), { kind: 'err' }); } };
    $('[data-a=scrf]', f).onclick = async () => loadScript((await pickFiles(ScriptFile.ACCEPT, false))[0]);
    SC.ondragover = e => { e.preventDefault(); e.stopPropagation(); }; SC.ondrop = e => { const fl = [...(e.dataTransfer?.files || [])].find(x => ScriptFile.is(x)); if (!fl) return; e.preventDefault(); e.stopPropagation(); e._handled = true; loadScript(fl); };
    zone('[data-aud]', '[data-audl]', st.audios, x => ['audio', 'video'].includes(Assets.kindOf(x)));
    zone('[data-bg]', '[data-bgl]', st.cenarios, x => ['image', 'video', 'gif'].includes(Assets.kindOf(x)));
    const ok = await UI.modal({ title: o.edit ? 'Informações do vídeo para a IA' : 'Criar vídeo com IA', icon: 'sparkles', width: 760, body: f, sticky: true, cancelValue: null, buttons: o.edit ? [{ label: 'Cancelar', value: null }, { label: 'Só salvar', value: 'save' }, { label: 'Salvar e montar o vídeo', kind: 'primary', icon: 'sparkles', value: true }] : [{ label: o.skipLabel || 'Cancelar', value: null }, { label: 'Gerar o vídeo com 1 clique', kind: 'primary', icon: 'sparkles', value: true }] });
    if (!ok) return false;
    if (ok === 'save') o = { ...o, noGenerate: true };
    st.explicacao = $('[data-exp]', f).value.trim(); st.roteiro = SC.value.trim(); st.extra = $('[data-extra]', f).value.trim();
    st.canais = $$('[data-ch]', f).filter(x => x.checked).map(x => x.dataset.ch);
    st.links = $('[data-links]', f).value.split(/\s+/).filter(x => /^https?:\/\//.test(x)); st.novos = $$('[data-new]', f).filter(x => x.checked).map(x => x.dataset.new);
    st.chars = st.chars.filter(c => c.files.length || c.midias?.length || c.nome);
    await this.build(st, o);
    return true;
  },

  async build(st, o) {
    const busy = UI.toast('<span class="spin-dot"></span> Preparando o projeto…', { time: 600000 });
    try {
      if (!o.project) {
        const tpl = TEMPLATES.find(t => t.id === (st.formato === 'video' ? 'yt1080' : 'shorts'));
        const name = (st.explicacao.split(/[.\n!?]/)[0] || 'Vídeo com IA').slice(0, 48);
        const p = App.newProject({ name, w: tpl.w, h: tpl.h, fps: tpl.fps });
        await DB.put('projects', { id: p.id, name: p.name, created: p.created, modified: p.modified, settings: p.settings, dur: 0, data: JSON.stringify(p) });
        await App.open(p);
      }
      const p = App.project; p.formato = st.formato; p.explicacao = [st.explicacao, st.extra && 'Pedidos extras: ' + st.extra].filter(Boolean).join('\n'); p.explicacaoTexto = st.explicacao; p.extras = st.extra;
      p.folders ||= []; p.assetFolders ||= {};
      const folder = name => { let fo = p.folders.find(x => x.name === name); if (!fo) { fo = { id: uid('f_'), name }; p.folders.push(fo); } return fo.id; };
      p.personagens = [];
      for (const c of st.chars) {
        const nome = c.nome || 'Personagem', rts = c.files.length ? await Actions.importFiles(c.files, { folder: folder(nome), silent: true }) : [];
        p.personagens.push({ nome, descricao: (c.descricao || '') + (c.sheet ? ' (as imagens são FOLHA DE SPRITES: recorte cada pose com recortar_sprite, numa pasta com o nome do personagem)' : ''), midias: [...(c.midias || []), ...rts.map(r => r.meta.id)], folha: !!c.sheet });
      }
      if (st.audios.length) await Actions.importFiles(st.audios, { folder: folder('Áudios'), silent: true });
      if (st.cenarios.length) await Actions.importFiles(st.cenarios, { folder: folder('Cenários'), silent: true });
      p.canaisBase = st.canais; p.canaisNovos = st.novos || []; p.script = st.roteiro || '';
      App.commit('Projeto preparado para a IA', { all: true });
      busy.remove();
      // links: viram referências de estilo (vídeos) ou notas (canais)
      const isVid = u => StyleRefs.platform(u) && !/tiktok\.com\/@[^\/?#]+\/?(\?.*)?$/i.test(u), canaisLinks = st.links.filter(u => !isVid(u));
      for (const u of st.links.filter(isVid)) { const m = UI.toast(`<span class="spin-dot"></span> Estudando ${esc(u)}…`, { time: 120000 }); try { await StyleRefs.addLink(u, true); } catch { } m.remove(); }
      p.canaisLinks = canaisLinks; App.commit('Canais de referência', { noRefresh: true });
      if (o.noGenerate) { UI.toast('Informações salvas — a IA usa isso em todos os pedidos.', { kind: 'ok' }); try { Assistant.paint(); } catch { } return; }
      // monta o pedido para a IA
      const base = st.canais.map(k => GENRE.CANAIS[k]?.nome).filter(Boolean);
      const pedido = `MONTE O VÍDEO COMPLETO no formato ${st.formato === 'video' ? 'VÍDEO DO YOUTUBE (horizontal)' : 'SHORTS (vertical)'}, do começo ao fim, usando os personagens, áudios e cenários da Mídia.
${base.length ? 'Base de estilo: ' + base.join(', ') + ' (siga as regras do gênero).' : ''}${(st.novos || []).length ? '\nCanais novos para estudar (vieram dos links do usuário): ' + st.novos.join(', ') + ' — use as referências de estilo desses links e o que souber desses canais.' : ''}${canaisLinks.length ? '\nO usuário também citou estes canais (você não consegue abri-los; use o que souber do estilo deles): ' + canaisLinks.join(', ') : ''}
Passo a passo: ${p.personagens.some(c => c.folha) ? 'recorte as folhas de sprites em poses (recortar_sprite, uma pasta por personagem); ' : ''}coloque o(s) áudio(s) de voz na faixa de áudio desde o início; ${st.cenarios.length ? 'cenário na faixa de baixo (encaixe cover); ' : 'fundo com padrão que se repete andando devagar (ação "fundo": bolinhas, xadrez, listras…) na faixa de baixo cobrindo o vídeo todo; '}personagens com enquadramento (corpo/cintura/busto, alternando), idle quase parado, voiceBounce sutil em quem fala (hopTalk só em ênfase) (use a TRANSCRIÇÃO para saber quem fala o quê e quando), troca de pose por frase de acordo com a emoção, reações (emote, zoomPunch, shake) nos momentos fortes, efeitos sonoros baixos (prefira os da biblioteca real), câmera com aproximação lenta${st.formato === 'shorts' ? ', e LEGENDAS (ação "legendas") do começo ao fim' : ''}.
${st.roteiro ? `
TEM ROTEIRO (está no contexto como "ROTEIRO DO USUÁRIO"): SIGA O ROTEIRO DE PERTO — mesma ordem de cenas e falas; quem fala cada fala; toda indicação entre parênteses/colchetes (emoção, ação, zoom, som, entrada, pose, cenário) vira ação no editor no momento em que aquela fala acontece no áudio (ache o tempo pela transcrição). Não invente cenas fora do roteiro; preencha só o que ele não diz (idle, reações secundárias, pequenos sons) seguindo as regras do gênero.` : ''}
${p.explicacao ? 'O que acontece: ' + p.explicacao : ''}`;
      Assistant.toggle(true); Assistant.chat = false; Assistant.paint();
      const ed = $('#assistant .as-ed'); ed.textContent = pedido;
      Assistant.forceAuto = true; await Assistant.send(); Assistant.forceAuto = false;
    } catch (e) { busy.remove(); UI.toast('Não deu para preparar: ' + esc(e.message || e), { kind: 'err' }); console.error(e); }
  },
};
