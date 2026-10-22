/* ===================== pastas.js — imagens em PASTAS viram partes =====================
   Soltar (ou escolher) pastas no Ateliê: cada pasta vira UMA parte com o nome dela ("perna_frente" → "Perna frente",
   "02-braco_esq" → "Braco esq"), com todas as imagens de dentro. Uma pasta que só tem outras pastas (ex.: "Lumi/") é
   só o pacote: as de dentro viram as partes; imagens soltas nela viram uma parte cada (como antes).
   Pastas mais fundas viram as PASTAS DE IMAGENS da parte (olhos/felizes/… → parte "Olhos", pasta "Felizes").
   Cada File volta com f._parte (nome da parte) e f._pasta (pasta de imagens dentro dela), e o addImagens agrupa. */
'use strict';
const Pastas = {
  // nome bonito: tira número na frente, troca _ - . por espaço, primeira letra maiúscula
  limpa(n) { n = String(n || '').replace(/^\s*\d+\s*[-_.)\s]+\s*/, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim(); return n ? n.charAt(0).toUpperCase() + n.slice(1) : String(n || '').trim(); },
  nrm: s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-.\s]+/g, ' ').trim(),
  ehImg: f => /^image\//.test(f.type) || /\.(png|webp|gif|jpe?g|svg)$/i.test(f.name),
  // dentro de cada parte: primeiro as imagens da própria pasta (a 1ª vira a padrão), depois as das subpastas; números em ordem (2 antes de 10)
  ordem: (a, b) => (a.segs[0] || '').localeCompare(b.segs[0] || '', 'pt', { numeric: true, sensitivity: 'base' }) || a.segs.length - b.segs.length || a.caminho.localeCompare(b.caminho, 'pt', { numeric: true, sensitivity: 'base' }),
  // marca os arquivos: L = [{ file, segs (pastas abaixo da pasta solta), raiz (nome da pasta solta) }]
  marca(L) {
    // pastas que só embrulham (Personagens › Lumi › perna_frente…): enquanto tudo estiver dentro da MESMA pasta e ainda tiver pastas abaixo, desce um nível
    while (L.length && L.every(x => x.segs.length >= 1 && x.segs[0] === L[0].segs[0]) && L.some(x => x.segs.length >= 2)) for (const x of L) { x.raiz = x.segs[0]; x.segs = x.segs.slice(1); }
    const temSub = L.some(x => x.segs.length), out = [];
    for (const x of L.sort(this.ordem)) { if (!this.ehImg(x.file)) continue;
      const segs = temSub ? x.segs : x.raiz ? [x.raiz] : []; // pasta só com imagens = uma parte; com subpastas = só o pacote
      if (segs.length) { x.file._parte = this.limpa(segs[0]); x.file._pasta = segs.slice(1).map(s => this.limpa(s)).join(' / ') || null; }
      out.push(x.file); }
    return out;
  },
  // dentro do evento drop (tem que pegar as "entries" antes de qualquer await)
  deDrop(dt) {
    const ents = [...(dt?.items || [])].filter(i => i.kind === 'file').map(i => i.webkitGetAsEntry?.()).filter(Boolean), soltos = [...(dt?.files || [])];
    if (!ents.some(e => e.isDirectory)) return Promise.resolve(soltos.filter(f => this.ehImg(f)));
    return (async () => { const out = [];
      for (const e of ents) {
        if (e.isFile) { const f = await this.arquivo(e); if (f && this.ehImg(f)) out.push(f); continue; }
        const L = []; await this.lerPasta(e, [], L); out.push(...this.marca(L.map(x => ({ ...x, raiz: e.name }))));
      }
      return out; })();
  },
  arquivo: e => new Promise(ok => e.file(ok, () => ok(null))),
  async lerPasta(dir, segs, L) {
    const r = dir.createReader(); let lote;
    do { lote = await new Promise(ok => r.readEntries(ok, () => ok([]))); // readEntries devolve aos pedaços (até ~100 por vez)
      for (const e of lote) { if (e.name.startsWith('.')) continue;
        if (e.isDirectory) await this.lerPasta(e, [...segs, e.name], L);
        else { const f = await this.arquivo(e); if (f) L.push({ file: f, segs, caminho: [...segs, e.name].join('/') }); } }
    } while (lote.length);
  },
  // clicar na caixa: o seletor do sistema não escolhe imagens e pastas juntos, então pergunta qual
  escolherDe(ev, imagens) {
    return new Promise(ok => UI.ctx(ev.clientX, ev.clientY, [{ head: 'Escolher' },
      { label: 'Imagens…', icon: 'image', action: async () => ok(await imagens()) },
      { label: 'Uma pasta… (cada pasta de dentro vira uma parte)', icon: 'folder', action: async () => { const l = await this.escolher(); ok(l ? await semVetor(l) : null); } }]));
  },
  // escolher uma pasta pelo seletor do sistema
  escolher() {
    return new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.webkitdirectory = true;
      i.onchange = () => { const fs = [...(i.files || [])]; if (!fs.length) return ok(null);
        const L = fs.map(f => { const ps = (f.webkitRelativePath || f.name).split('/'); return { file: f, raiz: ps.length > 1 ? ps[0] : null, segs: ps.slice(1, -1), caminho: ps.slice(1).join('/') }; });
        ok(this.marca(L)); };
      i.click(); });
  },
  // imagens soltas em cima de UMA parte: as pastas viram pastas de imagens dela (não partes novas)
  paraParte(fs) { for (const f of fs) if (f._parte) { f._pasta = [f._parte, f._pasta].filter(Boolean).join(' / '); delete f._parte; } return fs; },
  // "referência" no nome da pasta ou da imagem = é a referência (o personagem inteiro)
  ehRefNome: n => /(^|[^a-z])(referencia|ref)([^a-z]|$)/.test(String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()),
  virarRef(f, sim) {
    if (sim && !f._ref) { f._antes = { parte: f._parte, pasta: f._pasta }; f._parte = 'Referência'; f._pasta = null; f._ref = true; }
    else if (!sim && f._ref) { const a = f._antes || {}; if (a.parte && !this.ehRefNome(a.parte)) f._parte = a.parte; else delete f._parte; f._pasta = a.pasta && !this.ehRefNome(a.pasta) ? a.pasta : null; delete f._ref; delete f._antes; }
    return f;
  },
  herda(novo, de) { if (novo && de && novo !== de) { if (de._parte) novo._parte = de._parte; if (de._pasta) novo._pasta = de._pasta; } return novo; },
};
