/* ===================== nuvem.js — biblioteca de personagens da equipe (nuvem do Estúdio Problems, com o login do Google) =====================
   Cada personagem é uma pasta "personagens/<id>/" com personagem.json + imagens. Toda a equipe vê e usa a mesma biblioteca,
   e o navegador guarda uma cópia para abrir rápido (e sem internet). */
'use strict';
const Nuvem = {
  get srv() { return (typeof TURMA_CONFIG !== 'undefined' && TURMA_CONFIG.iaServidor || '').replace(/\/+$/, ''); },
  async hd() { try { const t = await TurmaAuth.token(); return t ? { authorization: 'Bearer ' + t } : {}; } catch { return {}; } },
  async pede(caminho, o = {}) {
    const r = await fetch(this.srv + caminho, { ...o, headers: { ...(await this.hd()), ...(o.headers || {}) } });
    if (r.headers.get('x-nuvem') === 'reserva') { const m = (o.method || 'GET').toUpperCase(), oque = /^\/personagens(\?|$)/.test(caminho) ? 'a lista dos personagens' : m === 'POST' ? 'salvar os personagens' : m === 'DELETE' ? 'apagar imagens antigas' : 'abrir o que foi salvo hoje';
      (this._usoRes ||= new Set()).add(oque); }
    setTimeout(() => this._resPinta?.(), 0);
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error?.message || 'A nuvem respondeu ' + r.status); }
    return r;
  },
  // lista os personagens da equipe: [{ id, nome, pasta, thumb, por, em }]
  // a lista fica guardada por 2 min (já vem pronta da tela de carregamento); salvar/apagar ou "Atualizar" busca de novo
  // este personagem está na nuvem da equipe agora? true/false; null = não deu para saber (lista incompleta ou sem resposta)
  async estaNaNuvem(id) { if (!id) return false;
    for (const novo of [false, true]) { let l; try { l = await this.lista(novo); } catch { return null; } if (this.semLista || this.parcial) return null; // lista incompleta (limite): não decide
      if (l.some(x => x.id === id)) return true; } // não achou na guardada: confere na lista de agora antes de dizer que não está (pode ter acabado de subir)
    return false; },
  lista(novo) {
    if (!novo && this._lista && Date.now() - this._listaEm < 120000) return this._lista;
    this._listaEm = Date.now(); return (this._lista = this._listaJa().catch(e => { this._lista = null; throw e; }));
  },
  async _listaJa() {
    let j; this.listaDoPc = false;
    let r0; try { r0 = await this.pede('/personagens'); j = await r0.json(); }
    catch (e) { // nem a nuvem nem a reserva deixaram listar: a parte da nuvem fica VAZIA (nada do computador no lugar dela);
      // as cópias que este computador tem ficam separadas, marcadas como cópia local (Home mostra em vermelho, abrir = cópia só daqui)
      this.copiasPc = (await DB.all('personagens').catch(() => [])).filter(d => d?.id && d.nome && !d._local);
      if (!this.copiasPc.length) throw e; this.semLista = e.message || 'sem lista'; return [];
    }
    this.semLista = null; this.copiasPc = null; this.parcial = r0.headers.get('x-nuvem-parcial') === '1';
    const ids = new Set(), mods = {}; const tams = {}, exts = {}; for (const it of j.itens || []) { const m = it.k.match(/^personagens\/([^/]+)\//); if (m) { tams[m[1]] = (tams[m[1]] || 0) + (+it.tam || 0); if (/\/img\/(?!ap)[^/]+$/.test(it.k)) (exts[m[1]] ||= []).push(it.k); } }
    const naRes = new Set(); for (const it of j.itens || []) { const m = it.k.match(/^personagens\/([^/]+)\/personagem\.json$/); if (m) { ids.add(m[1]); mods[m[1]] = it.mod || null; if (it._res) naRes.add(m[1]); } }
    const out = [];
    await Promise.all([...ids].map(async id => { try { const d = await this.abrir(id, true, mods[id]); out.push({ id, nome: d.nome, pasta: d.pasta || 'Personagens', thumb: d.thumb, modificado: d.modificado, por: d.por, autor: d.autor, edicoes: d.edicoes, tam: tams[id] || 0, naRes: naRes.has(id), tipos: Vetor.tiposDef(d).length ? Vetor.tiposDef(d) : Vetor.tipos(exts[id] || []) }); } catch { } }));
    // lista PARCIAL (a principal não listou, sem foto nem cópia de segurança): só vieram os personagens salvos na reserva;
    // os outros que este computador tem aparecem separados como cópia local
    if (this.parcial) this.copiasPc = (await DB.all('personagens').catch(() => [])).filter(d => d?.id && d.nome && !d._local && !ids.has(d.id));
    const apag = this._apagados; if (apag) for (const [i, t] of [...apag]) if (Date.now() - t > 180e3) apag.delete(i);
    return out.filter(it => !apag?.has(it.id)).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt'));
  },
  // definição do personagem (da nuvem; se estiver sem internet, a cópia do navegador)
  // mod = marca da última gravação na nuvem: se a cópia deste computador é a mesma, não baixa de novo
  // soNuvem: só a versão da nuvem (sem cair na cópia do computador quando a nuvem não responde) — o Ateliê usa para não confundir as duas
  async abrir(id, rapido, mod, soNuvem) {
    if (mod) { const local = await DB.get('personagens', id).catch(() => null); if (local && local._mod === mod) return local; }
    try { const d = await (await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${id}/personagem.json`))).json(); if (mod) d._mod = mod; await DB.put('personagens', d); return d; }
    catch (e) { if (soNuvem) throw e; const local = await DB.get('personagens', id); if (local) return local; throw e; }
  },
  async baixar(k) {
    let r; try { r = await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k)); }
    catch (e) { // imagem que já foi convertida para WEBP na nuvem (animação antiga ainda com o nome .png): pega a versão webp
      if (!/\.(png|jpe?g)$/i.test(k)) throw e; r = await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k.replace(/\.(png|jpe?g)$/i, '.webp'))); }
    const b = await r.blob(); await DB.put('arquivos', b, k); return b;
  },
  // salva: manda as imagens que ainda não estão na nuvem e depois o personagem.json
  // quem é ADM pode apagar da nuvem; os outros recebem o aviso para pedir a um ADM (o servidor também confere)
  adm: false, // guardado da última vez que perguntou (para o menu já sair certo)
  async souAdm() { try { return (this.adm = !!(await window.EstudioConta?.perfil?.())?.adm); } catch { return false; } },
  async pedeAdm(nome) { if (window.EstudioConta?.nuvem?.pedeAdm) return window.EstudioConta.nuvem.pedeAdm(nome); return UI.modal({ title: 'Só um ADM pode apagar da nuvem', icon: 'cloud', width: 440, body: `<div>Peça para um ADM apagar <b>${esc(nome || 'isso')}</b> da nuvem da equipe (no menu, ADM › Nuvem).</div>`, buttons: [{ label: 'Entendi', kind: 'primary', value: true }] }); },
  // aviso na biblioteca enquanto a nuvem principal está no limite do dia (usando a reserva, ou só esperando as 21h);
  // a marca vem do /estudio-conta.js (EstudioLimite), que lê o que o servidor responde
  avisoReserva(el) {
    if (!el) return; const L = window.EstudioLimite;
    const pinta = () => { if (!el.isConnected) { clearInterval(iv); return; } const t = L?.marcado?.() || 0;
      const pc = false ? `<div class="res-aviso lim">${ic('cloud', 14)}<span>A nuvem não deixou listar tudo agora. Aparecem os personagens já conhecidos, cada um aberto <b>direto da nuvem</b> (a versão de sempre, não a cópia do computador). Algum criado hoje por outra pessoa pode faltar até a nuvem voltar.</span></div>` : '';
      if (!t) { el.innerHTML = L?.voltando?.() ? `<div class="res-aviso">${ic('cloud', 14)}<span><b>A nuvem principal já voltou.</b> O que foi salvo na nuvem reserva durante o limite está voltando para ela sozinho, em poucos minutos.</span></div>` : pc; return; }
      const m = Math.max(0, Math.ceil((t - Date.now()) / 6e4)), falta = m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min` : `${m} min`;
      const usos = [...(this._usoRes || [])], diz = usos.length ? ` (${usos.join(', ')})` : '';
      el.innerHTML = L.naReserva?.() || usos.length || this.parcial ? `<div class="res-aviso">${ic('cloud', 14)}<span>Limite de hoje atingido: usando a <b>nuvem reserva</b>${diz}. Nada muda para a equipe; volta ao normal às 21h (em ${falta}).</span></div>`
        : `<div class="res-aviso lim">${ic('cloud', 14)}<span>Limite de hoje atingido. Se precisar, a <b>nuvem reserva</b> entra no lugar; volta ao normal às 21h (em ${falta}).</span></div>`; el.innerHTML += pc; };
    const iv = setInterval(pinta, 30e3); addEventListener('storage', e => { if (e.key === 'estudio-limite-cf') pinta(); }); pinta(); this._resPinta = this._listaPc = pinta;
  },
  avisaEspaco() { if (Date.now() - (this._espEm || 0) < 120e3) return; this._espEm = Date.now(); try { window.EstudioConta?.nuvem?.atualizar?.(); } catch { } },
  // o que já está na nuvem de cada personagem fica guardado aqui depois da 1ª vez (o "salvar" automático não lista a nuvem toda a cada mudança)
  _ks: new Map(),
  // o.limpar === false (envio automático): as imagens que saíram ficam para apagar no próximo envio "de verdade" (botão, sair):
  // cada apagada gasta do limite do dia e, com o Ctrl+Z, a mesma imagem voltaria e teria de subir de novo
  async salvar(def, aoAndar, o = {}) {
    this._lista = null;
    let existentes = this._ks.get(def.id);
    if (!existentes) { existentes = new Set(); let listou = false; try { const r = await this.pede('/personagens'), j = await r.json(); for (const it of j.itens || []) if (it.k.startsWith(`personagens/${def.id}/`)) existentes.add(it.k); listou = true;
        // lista PARCIAL (só o que está na reserva): as imagens que já estão na principal não aparecem nela. A versão da nuvem diz
        // quais imagens existem (cada mudança vira chave nova), então elas não sobem de novo para a reserva à toa
        if (r.headers.get('x-nuvem-parcial') === '1') { try { const d = await (await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${def.id}/personagem.json`))).json(); for (const k of Modelo.chavesImgs(d)) existentes.add(k); for (const a of d.audios || []) if (a.k) existentes.add(a.k); } catch { } }
      } catch { } if (listou) this._ks.set(def.id, existentes); }
    // PERSONAGENS VÃO EM PNG (sem perda nenhuma; decisão do dono). Imagens que chegaram a ir em webp voltam para a PNG original, se ela estiver neste computador.
    const troca = await this.voltaPng(def, aoAndar); this.ultimaTroca = troca;
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(String(def.id))) throw new Error('o código deste personagem não é aceito pela nuvem. Use “Duplicar (cópia só neste computador)” e salve a cópia na nuvem.');
    await this.arrumaChaves(def, aoAndar); // chave que a nuvem não aceita (letra maiúscula, _, outra pasta, .JPG…) vira uma chave certa antes de enviar
    const auds = (def.audios || []).map(a => a.k).filter(Boolean); // áudios de teste do Ateliê
    const imgs = [...Modelo.chavesImgs(def), ...auds].filter(Boolean), falta = imgs.filter(k => !existentes.has(k)), semAudio = [];
    let n = 0;
    for (const k of falta) {
      const b = await Arq.pegaBlob(k); if (!b) continue;
      aoAndar?.(`Enviando ${/\/aud\//.test(k) ? 'áudios' : 'imagens'}… ${++n}/${falta.length}`);
      if (/\/aud\//.test(k)) { try { await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k), { method: 'POST', body: b }); existentes.add(k); } catch { semAudio.push(k); } continue; } // áudio que a nuvem não aceitar fica só neste computador (e no .atelieanimador)
      try { await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k), { method: 'POST', body: b }); } catch (e) { throw new Error(`a nuvem não aceitou a imagem “${String(k).split('/').pop()}” (${e.message})`); } existentes.add(k);
    }
    this.semAudio = semAudio; if (semAudio.length) setTimeout(() => UI.toast(`${semAudio.length} áudio(s) de teste não foram aceitos pela nuvem: continuam neste computador e vão no .atelieanimador.`, { kind: 'warn', time: 7000 }), 50);
    def.modificado = Date.now(); await Autores.marca(def); // quem subiu (fica para sempre) e quem editou
    aoAndar?.('Salvando o personagem…');
    await this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${def.id}/personagem.json`) + '&nome=' + encodeURIComponent(def.nome || ''), { method: 'POST', body: JSON.stringify(def), headers: { 'content-type': 'application/json' } });
    await DB.put('personagens', JSON.parse(JSON.stringify(def)));
    // imagens que saíram do personagem não ficam ocupando espaço na nuvem
    const usadas = new Set(imgs);
    if (o.limpar !== false) for (const k of [...existentes]) if ((k.startsWith(`personagens/${def.id}/img/`) || k.startsWith(`personagens/${def.id}/aud/`)) && !usadas.has(k)) { await this.pede('/personagens/arquivo?k=' + encodeURIComponent(k), { method: 'DELETE' }).catch(() => { }); existentes.delete(k); }
    existentes.add(`personagens/${def.id}/personagem.json`); this.avisaEspaco();
  },
  // A NUVEM SÓ ACEITA personagens/<id>/img/<a-z0-9->.png|webp|gif|jpg|jpeg|svg (e aud/ para os áudios). Imagem com outra chave
  // (veio de um arquivo feito fora, de outra pasta, nome com maiúscula ou _) ganha uma cópia com chave certa e o personagem passa a usar ela.
  KP: /^personagens\/[a-z0-9][a-z0-9-]{1,40}\/img\/[a-z0-9][a-z0-9-]{1,60}\.(png|webp|gif|jpg|jpeg|svg)$/,
  async arrumaChaves(def, aoAndar) {
    const ruins = Modelo.chavesImgs(def).filter(k => !this.KP.test(k)); if (!ruins.length) return {};
    const troca = {}; let n = 0;
    for (const k of ruins) {
      let b = await Arq.pegaBlob(k); if (!b) b = await this.baixar(k).catch(() => null); if (!b) continue; aoAndar?.(`Arrumando o nome das imagens… ${++n}/${ruins.length}`);
      let ext = (String(k).match(/\.(png|webp|gif|jpe?g|svg)$/i)?.[1] || { 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' }[b.type] || '').toLowerCase();
      if (!ext) { try { const bm = await createImageBitmap(b), c = document.createElement('canvas'); c.width = bm.width; c.height = bm.height; c.getContext('2d').drawImage(bm, 0, 0); b = await new Promise(r => c.toBlob(r, 'image/png')); ext = 'png'; } catch { continue; } } // formato que a nuvem não guarda: vira PNG
      const nk = `personagens/${def.id}/img/${uid('im').toLowerCase().replace(/[^a-z0-9]/g, '')}.${ext}`; await Arq.guardar(b, nk); const bm = Arq.img.get(k); if (bm) Arq.img.set(nk, bm); troca[k] = nk;
    }
    if (!Object.keys(troca).length) return troca;
    const anda = o => { if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { if (typeof o[i] === 'string' && troca[o[i]]) o[i] = troca[o[i]]; else if (o[i] && typeof o[i] === 'object') anda(o[i]); } return; }
      for (const c of Object.keys(o)) { const v = o[c]; if (typeof v === 'string' && troca[v]) o[c] = troca[v]; else if (v && typeof v === 'object') anda(v); } };
    anda(def); if (typeof Atelie !== 'undefined' && Atelie.def && Atelie.def !== def && Atelie.def.id === def.id) anda(Atelie.def); // o aberto também passa a usar a chave nova
    return troca;
  },
  // converte as imagens PNG/JPG do personagem para WEBP (só se ficar menor) e troca as chaves no def; devolve { chaveVelha: chaveNova }
  async paraWebp(def, aoAndar) {
    const troca = {}, alvos = Modelo.chavesImgs(def).filter(k => /\.(png|jpe?g)$/i.test(k)); let n = 0;
    for (const k of alvos) {
      try { let b = await Arq.pegaBlob(k); if (!b) b = await this.baixar(k).catch(() => null); if (!b) continue; aoAndar?.(`Compactando as imagens (webp)… ${++n}/${alvos.length}`);
        const bm = await createImageBitmap(b), c = new OffscreenCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0);
        const w = await c.convertToBlob({ type: 'image/webp', quality: .92 }); if (w.type !== 'image/webp' || w.size >= b.size * .95) continue; // navegador sem webp, ou não ficou menor
        const nk = k.replace(/\.(png|jpe?g)$/i, '.webp'); await Arq.guardar(w, nk); Arq.img.set(nk, bm); await DB.put('arquivos', k, 'orig:' + nk).catch(() => { }); troca[k] = nk; // aqui continua valendo a ORIGINAL (sem perda): a webp é só para a nuvem
      } catch { }
    }
    for (const p of Modelo.todasPartes(def)) for (const i of p.imgs) if (troca[i.k]) i.k = troca[i.k]; for (const v of def.vistas || []) if (v.vis?.fantasma?.k && troca[v.vis.fantasma.k]) v.vis.fantasma.k = troca[v.vis.fantasma.k];
    if (def.vis?.fantasma?.k && troca[def.vis.fantasma.k]) def.vis.fantasma.k = troca[def.vis.fantasma.k];
    return troca;
  },
  // desfaz a conversão: webp → a PNG original guardada aqui (arquivos["orig:<webp>"])
  async voltaPng(def, aoAndar) {
    const troca = {}, alvos = Modelo.chavesImgs(def).filter(k => /\.webp$/i.test(k));
    for (const k of alvos) { try { const o = await DB.get('arquivos', 'orig:' + k); if (o && await Arq.pegaBlob(o)) troca[k] = o; } catch { } }
    if (Object.keys(troca).length) aoAndar?.('Voltando as imagens para PNG (sem perda)…');
    for (const p of Modelo.todasPartes(def)) for (const i of p.imgs) if (troca[i.k]) i.k = troca[i.k]; for (const v of def.vistas || []) if (v.vis?.fantasma?.k && troca[v.vis.fantasma.k]) v.vis.fantasma.k = troca[v.vis.fantasma.k];
    if (def.vis?.fantasma?.k && troca[def.vis.fantasma.k]) def.vis.fantasma.k = troca[def.vis.fantasma.k];
    return troca;
  },
  // aplica a troca de chaves num texto JSON do personagem
  remapear(txt, troca) { if (!txt) return txt; for (const [a, b] of Object.entries(troca || {})) txt = txt.split(JSON.stringify(a)).join(JSON.stringify(b)); return txt; },
  // apagado agora: some da lista na hora (a nuvem pode levar até ~1 min para a lista de todos os lugares mostrar que saiu)
  async apagar(id) { this._lista = null;
    await Ocupado.nuvem('Apagando da nuvem', () => this.pede('/personagens/arquivo?k=' + encodeURIComponent(`personagens/${id}/`), { method: 'DELETE' }), { icone: 'trash', subtitulo: 'Apagando o personagem e as imagens dele…', fimTxt: 'Apagado da nuvem' });
    (this._apagados ||= new Map()).set(id, Date.now()); await DB.del('personagens', id); this._ks.delete(id); this._lista = null; this.avisaEspaco(); UI.toast('Apagado da nuvem da equipe.', { kind: 'ok' }); },

  /* ---------- cenários da equipe: só entram aqui quando alguém escolhe "Salvar na nuvem" (botão direito na camada) ---------- */
  async cenarios() { const j = await (await this.pede('/cenarios')).json(); return (j.itens || []).sort((a, b) => String(b.em || '').localeCompare(String(a.em || ''))); },
  async baixarCenario(k) { const b0 = await DB.get('arquivos', k); if (b0) return b0; let r; try { r = await this.pede('/cenarios/arquivo?k=' + encodeURIComponent(k)); } catch (e) { if (!/\.(png|jpe?g)$/i.test(k)) throw e; r = await this.pede('/cenarios/arquivo?k=' + encodeURIComponent(k.replace(/\.(png|jpe?g)$/i, '.webp'))); } const b = await r.blob(); await DB.put('arquivos', b, k); return b; },
  async salvarCenario(n) {
    let b = n.tipo === 'pasta' && n.cenaEd ? await Cenarios.blob(Cenarios.compoe(await Cenarios.deSerial(n.cenaEd))) : await Arq.pegaBlob(n.arq); /* pasta do cenário: vai a imagem do cenário inteiro */ if (!b) throw new Error('A imagem desta camada não está neste computador.');
    if (b.type !== 'image/webp') { try { const bm = await createImageBitmap(b), c = new OffscreenCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0); const w = await c.convertToBlob({ type: 'image/webp', quality: .92 }); if (w.type === 'image/webp' && w.size < b.size * .95) b = w; } catch { } } // na nuvem vai em WEBP quando fica menor
    const ext = { 'image/png': 'png', 'image/webp': 'webp' }[b.type] || 'jpg';
    const slug = String(n.nome || 'cenario').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cenario';
    const k = `cenarios/${/^[a-z0-9]/.test(slug) ? slug : 'c-' + slug}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    await this.pede(`/cenarios/arquivo?k=${encodeURIComponent(k)}&nome=${encodeURIComponent(n.nome || 'Cenário')}${n.ia ? '&ia=1' : ''}`, { method: 'POST', body: b, headers: { 'content-type': b.type || 'image/jpeg' } });
    await DB.put('arquivos', b, k); this.avisaEspaco(); return k;
  },
  async apagarCenario(k) { await this.pede('/cenarios/arquivo?k=' + encodeURIComponent(k), { method: 'DELETE' }); },
};

/* ---------- escolher um cenário da nuvem da equipe ---------- */
const CenariosNuvem = {
  async escolher() {
    if (!App.P) return;
    const body = h('<div><div class="vazio"><span class="spin-dot"></span> Carregando os cenários da equipe…</div></div>'), urls = [];
    const p = UI.modal({ title: 'Cenários da equipe', icon: 'cloud', width: 720, body, buttons: [{ label: 'Prontos e com a IA…', kind: 'ia', left: true, onClick: () => { setTimeout(() => Cenarios.abrir(), 50); return true; } }, { label: 'Fechar', value: null }] });
    const pinta = async () => {
      await Nuvem.souAdm();
      let lista; try { lista = await Nuvem.cenarios(); } catch (e) { body.innerHTML = `<div class="vazio">Não consegui abrir: ${esc(e.message)}</div>`; return; }
      if (!lista.length) { body.innerHTML = '<div class="vazio">Nenhum cenário na nuvem ainda.<br>Ponha um cenário (pronto, da IA ou uma imagem) e use o botão direito › <b>Salvar na nuvem</b>.</div>'; return; }
      body.innerHTML = ''; const g = h('<div class="grade cen-g"></div>'); body.appendChild(g);
      for (const it of lista) {
        const c = h(`<div class="pc"><div class="th" style="aspect-ratio:16/10"><span class="spin-dot"></span></div><div class="in"><b>${esc(it.nome || 'Cenário')}${it.ia ? ' <span class="tag-ia">IA</span>' : ''}</b><small>${it.em ? fmtDate(Date.parse(it.em)) : ''}${it.por ? ` · <span data-quem="${esc(it.por)}"></span>` : ''}</small></div><button class="ibtn mn${Nuvem.adm ? '' : ' so-adm'}" title="${Nuvem.adm ? 'Apagar da nuvem' : 'Só um ADM pode apagar da nuvem'}">${ic(Nuvem.adm ? 'trash' : 'lock', 14)}</button></div>`);
        Nuvem.baixarCenario(it.k).then(b => { const u = URL.createObjectURL(b); urls.push(u); const th = $('.th', c); th.innerHTML = ''; th.style.backgroundImage = `url('${u}')`; }).catch(() => { $('.th', c).innerHTML = ic('alert', 18); });
        c.onclick = async e => {
          if (e.target.closest('.mn')) return; c.style.opacity = .5;
          try { const b = await Nuvem.baixarCenario(it.k); const n = await Cenarios.porEmCamadas(await Cenarios.estadoDaImagem(b, it.nome || 'Cenário'), { semAviso: true }); n.nuvem = it.k; if (it.ia) n.ia = true; App.commit('Cenário da nuvem'); $('#modal-root .modal-back [data-x]')?.click(); }
          catch (er) { c.style.opacity = 1; UI.toast(esc(er.message), { kind: 'err' }); }
        };
        $('.mn', c).onclick = async e => { e.stopPropagation(); if (!(await Nuvem.souAdm())) return Nuvem.pedeAdm(it.nome || 'este cenário'); if (!(await UI.confirm({ title: 'Apagar da nuvem da equipe?', msg: `"<b>${esc(it.nome || 'Cenário')}</b>" some para todo mundo. As animações que já usam continuam com a cópia delas.`, ok: 'Apagar', danger: true }))) return;
          try { await Ocupado.nuvem('Apagando o cenário da nuvem', () => Nuvem.apagarCenario(it.k), { icone: 'trash', fimTxt: 'Apagado da nuvem' }); pinta(); } catch (er) { UI.toast(esc(er.message), { kind: 'err' }); } };
        g.appendChild(c);
      }
    };
    pinta(); await p; urls.forEach(u => setTimeout(() => URL.revokeObjectURL(u), 3000));
  },
};

/* ---------- quem subiu / quem editou cada personagem da nuvem ----------
   def.autor = quem subiu primeiro (nunca muda) · def.edicoes = a última vez que cada pessoa salvou (as 12 mais recentes).
   No cartão aparece a foto e o nome no canto; passando o mouse, um balão mostra quando subiu e quem mexeu, com as datas. */
const Autores = {
  _eu: null,
  async eu() {
    if (this._eu) return this._eu;
    const p = await TurmaAuth.perfil().catch(() => ({})), email = p.email || TurmaAuth.email || '';
    return (this._eu = { nome: p.nome || String(email).split('@')[0] || 'Alguém', foto: await this.miniFoto(p.foto), id: await this.idDe(email) });
  },
  // o e-mail nunca vai para o personagem/arquivo: só um código tirado dele (o mesmo e-mail dá sempre o mesmo código)
  async idDe(email) {
    email = String(email || '').trim().toLowerCase(); if (!email) return 'anon';
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('estudio-problems:' + email)); return 'u' + [...new Uint8Array(b)].slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); }
    catch { let h2 = 0; for (const c of email) h2 = (h2 * 31 + c.charCodeAt(0)) | 0; return 'u' + (h2 >>> 0).toString(16); }
  },
  // troca qualquer e-mail que tenha ficado guardado (versão de antes) pelo código
  async limpa(o) {
    if (!o) return o; for (const x of [o.autor, ...(o.edicoes || [])]) if (x && /@/.test(x.id || '')) x.id = await this.idDe(x.id);
    if (o.autor && o.edicoes) { const vistos = new Set(); o.edicoes = o.edicoes.sort((a, b) => b.em - a.em).filter(x => !vistos.has(x.id) && vistos.add(x.id)).sort((a, b) => a.em - b.em); }
    return o;
  },
  // foto pequena (a "Minha conta" pode guardar a foto inteira; aqui basta 64 px para não pesar o personagem)
  async miniFoto(f) {
    // foto do Google (https://…) fica como endereço; a da "Minha conta" (/conta/foto, só vale para a própria pessoa) vira imagem pequena dentro do arquivo
    if (!f) return null; if (/^https:\/\//.test(f) && f.length < 1000) return f;
    try { const im = new Image(); im.src = f; await im.decode(); const S = 64, c = document.createElement('canvas'); c.width = c.height = S; const k = Math.max(S / im.naturalWidth, S / im.naturalHeight), w = im.naturalWidth * k, hh = im.naturalHeight * k;
      c.getContext('2d').drawImage(im, (S - w) / 2, (S - hh) / 2, w, hh); return c.toDataURL('image/jpeg', .82); } catch { return null; }
  },
  async marca(def) {
    await this.limpa(def); const eu = await this.eu(), agora = Date.now();
    if (!def.autor) def.autor = { ...eu, em: agora };
    delete def.semNuvem; // voltou para a nuvem: o histórico de lá recomeça
    def.edicoes = [...(def.edicoes || []).filter(x => x.id !== eu.id), { ...eu, em: agora }].slice(-12);
  },
  // arquivo sem criador conhecido (feito/editado pela IA, ou de antes da ficha): quem abre primeiro vira o dono. Devolve true se assumiu
  desconhecido(a) { return !a || !/^u[0-9a-f]{16}$/.test(a.id || '') || !!a.ia; },
  async assumir(o) {
    if (!o || !this.desconhecido(o.autor)) return false; const eu = await this.eu(); if (!eu?.id || eu.id === 'anon') return false;
    delete o.autorAntes; o.autor = { ...eu, em: Date.now(), assumiu: true };
    o.edicoes = [...(o.edicoes || []).filter(x => !this.desconhecido(x) && x.id !== eu.id), { ...eu, em: Date.now() }].slice(-12); return true;
  },
  AVISO_DONO: 'O criador deste arquivo é <b>desconhecido</b>. Como você foi a primeira pessoa a abrir, <b>você passa a ser a dona/o dono dele</b>: seu nome e sua foto aparecem como quem criou.',
  // criador desconhecido (IA ou sem registro): nada de nome da IA na tela; some das edições e do "arquivo feito por"
  semIa(o) {
    if (!o) return o; const r = { ...o, edicoes: (o.edicoes || []).filter(x => !this.desconhecido(x)) };
    if (o.autor && this.desconhecido(o.autor)) r.autor = { nome: 'Desconhecido', em: o.autor.em, desc: true };
    if (o.pacote?.por && this.desconhecido(o.pacote.por)) r.pacote = { ...o.pacote, por: null };
    return r;
  },
  // quem mexeu, sem contar quem subiu (mais recente primeiro)
  editores(d) { return (d.edicoes || []).filter(x => x.id !== d.autor?.id && !this.desconhecido(x)).sort((a, b) => b.em - a.em); },
  av(p, cls = '') { const ini = esc(String(p?.nome || '?').trim().charAt(0).toUpperCase() || '?'); return p?.foto ? `<img class="aut-av ${cls}" src="${esc(p.foto)}" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML='<span class=&quot;aut-av ${cls}&quot;>${ini}</span>'">` : `<span class="aut-av ${cls}">${ini}</span>`; },
  // selo do canto do cartão: a foto e o nome de quem subiu; se outra pessoa editou, a foto dela por cima e "editado por"
  // nome e foto de AGORA da pessoa (o que ela pôs na "Minha conta"), pelo código guardado no arquivo; se não achar, fica o que foi guardado
  _vivos: new Map(),
  vivo(p) {
    if (!p?.id || !/^u[0-9a-f]{16}$/.test(p.id)) return Promise.resolve(p);
    if (!this._vivos.has(p.id)) this._vivos.set(p.id, fetch('/pessoa?u=' + encodeURIComponent(p.id), { credentials: 'same-origin', cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null));
    return this._vivos.get(p.id).then(j => j?.nome ? { ...p, nome: j.nome, foto: j.foto || (/^\/conta\//.test(p.foto || '') ? null : p.foto) } : p);
  },
  // antes de mostrar: nome e foto de AGORA de cada pessoa, com a foto já baixada (sem trocar na frente da pessoa)
  async preCarregar(gente) {
    const ps = await Promise.all([...new Map(gente.filter(p => p?.id).map(p => [p.id, p])).values()].map(p => this.vivo(p)));
    const pre = window.EstudioConta?.preImg || (u => !u ? null : new Promise(ok => { const im = new Image(); im.onload = im.onerror = ok; im.src = u; setTimeout(ok, 5000); }));
    await Promise.all(ps.map(p => pre(p?.foto)));
    return ps;
  },
  // ficha do arquivo: espera os nomes e fotos atualizados (no máximo 3 s) para já abrir certa
  async prepara(o) {
    const gente = [o.autor, ...(o.edicoes || []), o.pacote?.por].filter(Boolean);
    await Promise.race([this.preCarregar(gente), new Promise(r => setTimeout(r, 3000))]).catch(() => { });
    const [autor, edicoes, por] = await Promise.all([o.autor ? this.vivo(o.autor) : null, Promise.all((o.edicoes || []).map(x => this.vivo(x))), o.pacote?.por ? this.vivo(o.pacote.por) : null]);
    return { ...o, autor: autor || o.autor, edicoes, pacote: o.pacote ? { ...o.pacote, por } : o.pacote };
  },
  async aoVivo(d) { const autor = await this.vivo(d.autor), edicoes = await Promise.all((d.edicoes || []).map(x => this.vivo(x))); return { ...d, autor, edicoes }; },
  // NÃO ESTÁ NA NUVEM (saiu de lá ou nunca foi): tira o histórico da nuvem para não confundir — fica só quem criou (como arquivo normal)
  semNuvem(def) { if (!def) return def; def.edicoes = []; def.semNuvem = true; return def; },
  selo(d0, o = {}) { // o.local = este personagem está só neste computador (não está na nuvem agora)
    if (!d0?.autor) return null; d0 = this.semIa(d0); let d = d0, eds = this.editores(d), ult = eds[0];
    const el = h(`<div class="autores" title=""></div>`);
    const pinta = () => { eds = this.editores(d); ult = eds[0]; el.innerHTML = `${this.av(d.autor)}${ult ? this.av(ult, 'sob') : ''}<span class="aut-nm">${esc(d.autor.nome)}${ult ? `<small> · editado por ${esc(ult.nome)}${eds.length > 1 ? ` +${eds.length - 1}` : ''}</small>` : ''}</span>`; };
    pinta(); this.aoVivo(d0).then(x => { d = this.semIa(x); pinta(); }); // troca pelo nome e foto de agora assim que chegar
    let pop = null; const fecha = () => { pop?.remove(); pop = null; };
    el.onmouseenter = () => { fecha();
      pop = h(`<div class="aut-pop"><div class="aut-l">${this.av(d.autor)}<div><b>${esc(d.autor.nome)}</b><small>${d.autor.desc ? 'criador desconhecido' : (o.local || d.semNuvem ? 'criou · ' : 'subiu para a nuvem · ') + fmtDate(d.autor.em)}</small></div></div>
        ${o.local ? '<div class="aut-t">Só neste computador</div>' : ''}
        ${eds.length ? `<div class="aut-t">Editado por</div>${eds.map(x => `<div class="aut-l">${this.av(x)}<div><b>${esc(x.nome)}</b><small>última edição · ${fmtDate(x.em)}</small></div></div>`).join('')}` : '<div class="aut-t">Ninguém mais editou</div>'}
        ${d.modificado ? `<div class="aut-t">Salvo pela última vez ${fmtDate(d.modificado)}</div>` : ''}</div>`);
      document.body.appendChild(pop); const r = el.getBoundingClientRect(), pr = pop.getBoundingClientRect();
      pop.style.left = Math.max(6, Math.min(r.left, innerWidth - pr.width - 6)) + 'px'; pop.style.top = (r.bottom + pr.height + 6 > innerHeight ? r.top - pr.height - 6 : r.bottom + 6) + 'px'; };
    el.onmouseleave = fecha; el.addEventListener('click', fecha);
    return el;
  },
};

/* ---------- ficha de quem fez (aparece ao abrir um .animador ou .atelieanimador): foto, nome e datas, nunca o e-mail ---------- */
Autores.ficha = function (o0) {
  let o = this.semIa(o0);
  const L = (p, txt) => `<div class="aut-l">${this.av(p)}<div><b>${esc(p.nome || 'Alguém')}</b><small>${p.desc ? 'criador desconhecido' : txt}</small></div></div>`;
  const eds = o.autor ? this.editores(o) : (o.edicoes || []).slice().sort((a, b) => b.em - a.em);
  const el = h(`<div class="ficha">
    <div class="ficha-top">${o.thumb ? `<div class="ficha-th" style="background-image:url('${o.thumb}')"></div>` : `<div class="ficha-th">${ic(o.ico || 'layers', 26)}</div>`}<div><small>${esc(o.tipo || '')}</small><b>${esc(o.nome || '')}</b>${o.resumo ? `<small>${o.resumo}</small>` : ''}</div></div>
    ${o.aviso ? `<div class="ficha-aviso">${ic('alert', 16)}<div>${o.aviso}</div></div>` : ''}
    <div class="aut-pop ficha-pop">
      ${o.autor ? `<div class="aut-t" style="border:0;margin:0">Criado por</div>${L(o.autor, (o.verboAutor || 'criou') + ' · ' + fmtDate(o.autor.em))}` : '<div class="aut-t" style="border:0;margin:0">Quem criou não ficou registrado (arquivo de antes desta versão)</div>'}
      ${eds.length ? `<div class="aut-t">Editado por</div>${eds.map(x => L(x, 'última edição · ' + fmtDate(x.em))).join('')}` : ''}
      ${o.pacote?.por ? `<div class="aut-t">Arquivo feito por</div>${L(o.pacote.por, 'baixou este arquivo · ' + fmtDate(o.pacote.em))}` : ''}
    </div></div>`);
  // troca pelo nome e a foto de AGORA de cada pessoa (a foto guardada no arquivo pode ser antiga ou só valer para quem fez)
  (async () => { try {
    const [autor, edicoes, por] = await Promise.all([o.autor ? this.vivo(o.autor) : null, Promise.all((o.edicoes || []).map(x => this.vivo(x))), o.pacote?.por ? this.vivo(o.pacote.por) : null]);
    o = this.semIa({ ...o, autor, edicoes, pacote: o.pacote ? { ...o.pacote, por } : o.pacote });
    const pop = el.querySelector('.ficha-pop'); if (!pop) return;
    const eds2 = o.autor ? this.editores(o) : (o.edicoes || []).slice().sort((a, b) => b.em - a.em);
    pop.innerHTML = `${o.autor ? `<div class="aut-t" style="border:0;margin:0">Criado por</div>${L(o.autor, (o.verboAutor || 'criou') + ' · ' + fmtDate(o.autor.em))}` : '<div class="aut-t" style="border:0;margin:0">Quem criou não ficou registrado (arquivo de antes desta versão)</div>'}
      ${eds2.length ? `<div class="aut-t">Editado por</div>${eds2.map(x => L(x, 'última edição · ' + fmtDate(x.em))).join('')}` : ''}
      ${o.pacote?.por ? `<div class="aut-t">Arquivo feito por</div>${L(o.pacote.por, 'baixou este arquivo · ' + fmtDate(o.pacote.em))}` : ''}`;
  } catch { } })();
  return el;
};
