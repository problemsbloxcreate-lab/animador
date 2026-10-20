/* ===================== team.js — mídia da equipe (nuvem grátis da Cloudflare) e conhecimento da IA =====================
   • Itens da equipe: arquivos guardados no servidor do Estúdio Problems (KV da Cloudflare, grátis, sem cartão: 1 GB,
     até 25 MB por arquivo) — todos da equipe veem. Só quem entra com um e-mail liberado acessa.
     Mostra o tamanho de cada item e a % usada do espaço. A IA só usa esses itens se a caixa
     "A IA pode usar os itens da equipe" estiver marcada.
   • Conhecimento da IA: textos/guias (.txt/.docx/.pdf ou colados) que a IA lê antes de editar.
     Ficam neste computador e podem ser compartilhados com a equipe (pasta "conhecimento/").
   Segurança: quem acessa é decidido pelo servidor (login do Google + EMAILS_PERMITIDOS na Cloudflare). */
'use strict';

const TeamLib = {
  items: null, loading: false, open: false,
  get limiteGB() { return this.limite ? this.limite / 1024 ** 3 : ((typeof TURMA_CONFIG !== 'undefined' && TURMA_CONFIG.equipeLimiteGB) || 1); },
  get enabled() { try { return localStorage.getItem('ps-equipe-ia') === '1'; } catch { return false; } },
  setEnabled(v, show) {
    try { localStorage.setItem('ps-equipe-ia', v ? '1' : '0'); } catch { }
    if (v) { this.open = true; if (show && typeof LibUI !== 'undefined') { LibUI.setTab('media'); } this.refresh(); }
    try { LibUI.render(); } catch { } try { Assistant.paint(); } catch { }
  },
  // chamada ao servidor do Estúdio Problems (com o login do Google)
  async api(path, o = {}) {
    if (!(await TurmaAuth.loginOnly())) throw new Error('Entre com sua conta Google para usar os itens da equipe.');
    const srv = TURMA_CONFIG.iaServidor; if (!srv) throw new Error('Falta o endereço do servidor do Estúdio Problems.');
    let r; try { r = await fetch(srv + path, { ...o, headers: { ...(o.headers || {}), ...(await AIClient.authHeader()) } }); } catch { throw new Error('Não consegui falar com o servidor do Estúdio Problems (internet?).'); }
    if (!r.ok) { const j = await r.json().catch(() => ({})); const e = new Error(j.error?.type === 'sem_kv' ? 'O espaço da equipe ainda não foi ligado na Cloudflare (falta o KV "EQUIPE" — veja o passo a passo).' : r.status === 404 && !j.error ? 'O servidor do Estúdio Problems está desatualizado: cole o worker.js novo na Cloudflare.' : (j.error?.message || 'Erro ' + r.status)); e.status = r.status; throw e; }
    return r;
  },
  err(e) { return e?.message || String(e); },
  async refresh() {
    if (this.loading) return; this.loading = true; this.error = null;
    try {
      const j = await (await this.api('/equipe?pasta=equipe')).json();
      this.limite = j.limite; this.usadoTotal = j.usado;
      this.items = (j.itens || []).map(x => ({ path: x.k, name: x.nome || x.k.replace(/^equipe\/\d+_/, ''), size: +x.tam || 0, type: x.tipo || '', by: x.por || '', at: x.em || '' })).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    } catch (e) { this.error = this.err(e); this.items = this.items || []; }
    this.loading = false; try { LibUI.render(); } catch { }
  },
  used() { return this.usadoTotal ?? (this.items || []).reduce((s, i) => s + i.size, 0); },
  kind(t, n) { return /^image\/gif/.test(t) ? 'gif' : /^image/.test(t) ? 'image' : /^video/.test(t) ? 'video' : /^audio/.test(t) ? 'audio' : (Assets.kindOf({ type: t, name: n }) || 'arquivo'); },
  async send(pasta, blob, nome, tipo) { return this.api(`/equipe?pasta=${pasta}&nome=${encodeURIComponent(nome)}&tipo=${encodeURIComponent(tipo || blob.type || 'application/octet-stream')}`, { method: 'POST', body: blob }); },
  async upload(files) {
    if (!files.length) return;
    const big = files.filter(f => f.size > 25 * 1048576); if (big.length) UI.toast(`${big.length} arquivo(s) maiores que 25 MB ficaram de fora (limite do espaço grátis).`, { kind: 'warn', time: 5000 });
    files = files.filter(f => f.size <= 25 * 1048576); if (!files.length) return;
    const t = UI.toast(`<span class="spin-dot"></span> Enviando para a equipe… <b data-p>0/${files.length}</b>`, { time: 600000 }); let n = 0;
    try { for (const f of files) { await this.send('equipe', f, f.name || 'arquivo', f.type); n++; const el = $('[data-p]', t); if (el) el.textContent = `${n}/${files.length}`; } t.remove(); UI.toast(`${n} arquivo(s) enviados para a equipe.`, { kind: 'ok' }); }
    catch (e) { t.remove(); UI.toast(esc(this.err(e)), { kind: 'err', time: 6000 }); }
    this.refresh();
  },
  async uploadAssets(ids) { const files = ids.map(id => { const rt = Assets.get(id); return rt?.blob && new File([rt.blob], rt.meta.name, { type: rt.meta.mime || rt.blob.type }); }).filter(Boolean); return this.upload(files); },
  async remove(it) {
    if (!(await UI.confirm({ title: 'Apagar da equipe?', msg: `"<b>${esc(it.name)}</b>" será apagado para <b>todos da equipe</b>. Projetos que já usam continuam com a cópia deles.`, ok: 'Apagar', danger: true }))) return;
    try { await this.api('/equipe?k=' + encodeURIComponent(it.path), { method: 'DELETE' }); UI.toast('Apagado da equipe.', { kind: 'ok' }); } catch (e) { UI.toast(esc(this.err(e)), { kind: 'err' }); }
    this.refresh();
  },
  thumbs: new Map(),
  async download(it) { return (await this.api('/equipe/arquivo?k=' + encodeURIComponent(it.path))).blob(); },
  async thumb(it) { if (this.thumbs.has(it.path)) return this.thumbs.get(it.path); const u = URL.createObjectURL(await this.download(it)); this.thumbs.set(it.path, u); return u; },
  async toProject(it) {
    const p = App.project; if (!p) return null;
    p.equipeMap ||= {}; if (p.equipeMap[it.path] && Assets.meta(p.equipeMap[it.path])) return p.equipeMap[it.path];
    const blob = await this.download(it), rt = await Assets.addBlob(blob, it.name, p.id, this.kind(it.type, it.name));
    p.folders ||= []; let fo = p.folders.find(x => x.name === 'Equipe'); if (!fo) { fo = { id: uid('f_'), name: 'Equipe' }; p.folders.push(fo); } (p.assetFolders ||= {})[rt.meta.id] = fo.id;
    p.equipeMap[it.path] = rt.meta.id; App.commit('Item da equipe no projeto', { all: true });
    return rt.meta.id;
  },
  find(name) { const n = String(name || '').replace(/^equipe:/, '').toLowerCase(); return (this.items || []).find(i => i.path.toLowerCase() === n || i.name.toLowerCase() === n) || (this.items || []).find(i => i.name.toLowerCase().includes(n)); },
  async resolve(name) { const it = this.find(name); return it ? this.toProject(it) : null; },
  forPrompt() {
    if (!this.enabled || !this.items?.length) return '';
    return 'ITENS DA EQUIPE (nuvem da equipe — o usuário liberou o uso). Para usar, passe "midia":"equipe:NOME" em adicionar_midia/trocar_midia (o editor baixa sozinho):\n' + this.items.slice(0, 120).map(i => `• equipe:${i.name} (${this.kind(i.type, i.name)}, ${fmtBytes(i.size)})`).join('\n');
  },
  // seção na aba Mídia
  section(b) {
    const used = this.used(), lim = this.limiteGB * 1024 ** 3, pct = Math.min(100, used / lim * 100);
    const el = h(`<div class="eq-sec"><div class="eq-head"><button class="eq-tog" data-t>${ic(this.open ? 'down' : 'right', 12)} <b>Equipe (nuvem)</b></button><span class="sp"></span>
      <label class="switch xs" title="A IA só usa os itens da equipe se isto estiver marcado"><input type="checkbox" data-ia ${this.enabled ? 'checked' : ''}><i></i>IA usa</label></div></div>`);
    $('[data-t]', el).onclick = () => { this.open = !this.open; if (this.open && !this.items) this.refresh(); LibUI.render(); };
    $('[data-ia]', el).onchange = e => this.setEnabled(e.target.checked, false);
    if (this.open) {
      const body = h(`<div class="eq-body">
        <div class="eq-use" title="Espaço da nuvem da equipe (grátis na Cloudflare)"><div class="eq-bar"><i style="width:${pct.toFixed(1)}%"></i></div><small>${this.items ? `${fmtBytes(used)} de ${+this.limiteGB.toFixed(2)} GB (${pct < 1 && used ? '<1' : Math.round(pct)}%) · ${this.items.length} item(ns) · até 25 MB cada` : this.loading ? 'Carregando…' : ''}</small></div>
        ${this.error ? `<div class="hint" style="border-color:#6b2a37">${ic('alert', 12)} ${esc(this.error)}</div>` : ''}
        <div class="btn-row"><button class="btn sm" data-up>${ic('upload', 12)} Enviar para a equipe</button><button class="ibtn xs" data-rf title="Atualizar">${ic('loop', 12)}</button></div>
        <div class="eq-grid" data-g></div></div>`);
      $('[data-up]', body).onclick = async () => this.upload(await pickFiles('image/*,audio/*,video/*,.gif'));
      $('[data-rf]', body).onclick = () => this.refresh();
      const g = $('[data-g]', body);
      (this.items || []).filter(i => LibUI.match ? LibUI.match(i.name) : true).forEach(it => {
        const k = this.kind(it.type, it.name), c = h(`<div class="eq-it" title="${esc(it.name)} — clique para trazer para o projeto"><div class="eq-th">${ic({ image: 'image', gif: 'image', video: 'film', audio: 'music' }[k] || 'file', 18)}</div><span>${esc(it.name)}</span><small>${fmtBytes(it.size)}${it.by ? ` · <span data-quem="${esc(it.by)}"></span>` : ''}</small></div>`); // quem enviou: foto + nome (não o e-mail)
        if ((k === 'image' || k === 'gif') && it.size < 3 * 1048576) this.thumb(it).then(u => { const th = $('.eq-th', c); if (th) th.innerHTML = `<img src="${u}" loading="lazy">`; }).catch(() => { });
        c.onclick = async () => { const t = UI.toast(`<span class="spin-dot"></span> Trazendo "${esc(it.name)}"…`, { time: 60000 }); try { await this.toProject(it); t.remove(); UI.toast(`"${esc(it.name)}" está na Mídia (pasta Equipe).`, { kind: 'ok' }); } catch (e) { t.remove(); UI.toast(esc(e.message || e), { kind: 'err' }); } };
        c.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [{ label: 'Trazer para o projeto', icon: 'download', action: () => c.onclick() }, '-', { label: 'Apagar da equipe', icon: 'trash', danger: true, action: () => this.remove(it) }]); };
        g.appendChild(c);
      });
      if (this.items && !this.items.length && !this.error) g.appendChild(h(`<small style="color:var(--tx3)">Nada enviado ainda. Use "Enviar para a equipe" ou o botão direito numa mídia → Enviar para a equipe.</small>`));
      el.appendChild(body);
    }
    b.appendChild(el);
  },
};

/* ---------- conhecimento da IA (guias, manuais, exemplos que o usuário ensina) ---------- */
const Knowledge = {
  MAX: 60000,
  list() { try { return JSON.parse(localStorage.getItem('ps-ia-conhecimento') || '[]'); } catch { return []; } },
  save(a) { try { localStorage.setItem('ps-ia-conhecimento', JSON.stringify(a)); } catch { UI.toast('Sem espaço para guardar esse texto no navegador.', { kind: 'err' }); } },
  team: [],
  async loadTeam() {
    if (!TeamLib.enabled) { this.team = []; return; }
    try { const j = await (await TeamLib.api('/equipe?pasta=conhecimento')).json(); this.team = [];
      for (const x of (j.itens || []).slice(0, 20)) { try { const blob = await TeamLib.download({ path: x.k }); this.team.push({ nome: (x.nome || x.k).replace(/\.txt$/, ''), texto: await blob.text(), on: true, equipe: true }); } catch { } }
    } catch { this.team = []; }
  },
  forPrompt() {
    const docs = [...this.list().filter(d => d.on !== false), ...this.team]; if (!docs.length) return '';
    let left = this.MAX, out = 'CONHECIMENTO QUE O USUÁRIO ENSINOU (siga estas instruções/guias — têm prioridade sobre as regras gerais, menos sobre o pedido atual):\n';
    for (const d of docs) { if (left <= 200) break; const t = String(d.texto).slice(0, left); out += `\n=== ${d.nome}${d.equipe ? ' (equipe)' : ''} ===\n${t}\n`; left -= t.length; }
    return out;
  },
  async modal() {
    const f = h(`<div><p style="margin-top:0">Ensine a IA com guias, manuais, exemplos de roteiro, regras do seu canal… Ela lê isso <b>antes de cada edição</b>. Pode colar o texto ou abrir arquivos <b>.txt, .docx, .pdf</b>.</p>
      <div class="kn-list" data-l></div>
      <div class="btn-row" style="margin-top:8px"><button class="btn sm primary" data-f>${ic('folder', 12)} Abrir arquivo(s)</button><button class="btn sm" data-p>${ic('paste', 12)} Colar texto</button><span class="sp"></span><small data-n style="color:var(--tx3)"></small></div></div>`);
    const L = $('[data-l]', f), paint = () => {
      const a = this.list(), tot = a.filter(d => d.on !== false).reduce((s, d) => s + d.texto.length, 0);
      $('[data-n]', f).textContent = `${a.length} item(ns) · ${Math.round(tot / 1000)} mil letras ligadas${tot > this.MAX ? ` (a IA lê até ${this.MAX / 1000} mil)` : ''}`;
      L.innerHTML = a.length ? '' : '<small style="color:var(--tx3)">Nada ainda.</small>';
      a.forEach((d, i) => {
        const r = h(`<div class="kn-row"><label class="switch xs"><input type="checkbox" ${d.on !== false ? 'checked' : ''}><i></i></label><b>${esc(d.nome)}</b><small>${Math.round(d.texto.length / 1000) || '<1'} mil letras</small><span class="sp"></span>
          <button class="btn xs" data-s title="Mandar para a nuvem da equipe: todos usam (quando marcarem 'IA usa itens da equipe')">${ic('upload', 11)} Equipe</button><button class="ibtn xs" data-v title="Ver/editar">${ic('edit', 12)}</button><button class="ibtn xs" data-x title="Apagar">${ic('trash', 12)}</button></div>`);
        $('input', r).onchange = e => { const a2 = this.list(); a2[i].on = e.target.checked; this.save(a2); paint(); };
        $('[data-x]', r).onclick = () => { const a2 = this.list(); a2.splice(i, 1); this.save(a2); paint(); };
        $('[data-v]', r).onclick = async () => { const t = await UI.prompt({ title: d.nome, label: 'Texto', value: d.texto, multiline: true }); if (t != null) { const a2 = this.list(); a2[i].texto = t; this.save(a2); paint(); } };
        $('[data-s]', r).onclick = async () => { try { await TeamLib.send('conhecimento', new Blob([d.texto], { type: 'text/plain;charset=utf-8' }), d.nome + '.txt', 'text/plain;charset=utf-8'); UI.toast('Compartilhado com a equipe.', { kind: 'ok' }); } catch (e) { UI.toast(esc(TeamLib.err(e)), { kind: 'err' }); } };
        L.appendChild(r);
      });
    };
    const add = (nome, texto) => { if (!texto?.trim()) return; const a = this.list(); a.push({ id: uid('k_'), nome, texto: texto.trim(), on: true }); this.save(a); paint(); };
    $('[data-f]', f).onclick = async () => { for (const fl of await pickFiles(ScriptFile.ACCEPT, true)) { try { add(fl.name.replace(/\.[^.]+$/, ''), await ScriptFile.read(fl)); } catch (e) { UI.toast(esc(e.message || e), { kind: 'err' }); } } };
    $('[data-p]', f).onclick = async () => { const t = await UI.prompt({ title: 'Colar texto para a IA', label: 'Texto (guia, regras, exemplos…)', value: '', multiline: true }); if (t) add('Texto colado ' + new Date().toLocaleDateString('pt-BR'), t); };
    f.ondragover = e => e.preventDefault(); f.ondrop = async e => { e.preventDefault(); e.stopPropagation(); e._handled = true; for (const fl of [...e.dataTransfer.files].filter(x => ScriptFile.is(x))) { try { add(fl.name.replace(/\.[^.]+$/, ''), await ScriptFile.read(fl)); } catch { } } };
    paint();
    await UI.modal({ title: 'Ensinar a IA', icon: 'sparkles', width: 640, body: f, buttons: [{ label: 'Pronto', kind: 'primary', value: true }] });
    if (TeamLib.enabled) this.loadTeam();
  },
};
