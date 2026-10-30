/* ===================== nuvemanim.js — ANIMAÇÕES na nuvem da equipe (decisão do dono, 30/10/2026) =====================
   Toda animação do Animador vai sozinha para a nuvem (servidor turma-ia, rota /animacoes): pasta "animacoes/<id>/" com
   projeto.json (sem a miniatura), thumb.jpg e arq/<chave> = imagens e áudios que só existem nela (as dos personagens da
   equipe já estão em personagens/ e não sobem de novo). Igual ao Ateliê: manda 1 min depois da última mudança e ao esconder
   a aba; ao vivo com mais gente só UMA pessoa da sala manda (a de menor id) e avisa as outras (meta.nuvemEm).
   Abrir uma animação da nuvem entra sozinho no AO VIVO (sala an-<id>, sem o botão Trabalhar junto).
   Personagem da animação que NÃO está na nuvem do Ateliê sobe junto, na pasta "PERSONAGENS ANIMADOR AUTOMATICO" (criada se
   não existir); se alguém mudar a pasta dele depois, ela não é mexida de novo.
   No projeto: P.nuvemEm = quando ESTE computador mandou/recebeu da nuvem; P.nuvemMod = marca da versão da nuvem que ele tem. */
'use strict';
const NuvemAnim = {
  PASTA_AUTO: 'PERSONAGENS ANIMADOR AUTOMATICO',
  _ks: new Map(), // id → Set das chaves que já estão na nuvem
  // cópias de segurança feitas aqui ("(anterior)", "(antes da atualização)") ficam só neste computador
  vai(P) { return !!(P && P.id && /^[A-Za-z0-9_-]{2,40}$/.test(P.id) && !P.anterior && !P.soLocal); },
  pasta(id) { return `animacoes/${id}/`; },
  chaveArq(id, k) { return this.pasta(id) + 'arq/' + encodeURIComponent(k).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); },
  // ---------- lista ----------
  lista(novo) {
    if (!novo && this._lista && Date.now() - this._listaEm < 60000) return this._lista;
    this._listaEm = Date.now(); return (this._lista = (async () => (await (await Nuvem.pede('/animacoes')).json()).itens || [])().catch(e => { this._lista = null; throw e; }));
  },
  async noServidor(id) { const s = new Set(); for (const it of (await (await Nuvem.pede('/animacoes?id=' + encodeURIComponent(id))).json()).itens || []) s.add(it.k); this._ks.set(id, s); return s; },
  // chaves do projeto que precisam ir para a nuvem da animação: tudo que NÃO está na nuvem dos personagens nem no site (cenários da casa)
  async chavesProprias(P) {
    let naNuvemP = this._kP; if (!naNuvemP || Date.now() - this._kPEm > 120000) { naNuvemP = new Set(); try { for (const it of (await (await Nuvem.pede('/personagens')).json()).itens || []) naNuvemP.add(it.k); this._kP = naNuvemP; this._kPEm = Date.now(); } catch { } }
    return Toon.ids(P).filter(k => !naNuvemP.has(k) && !/^cenarios\//.test(k));
  },
  // ---------- mandar ----------
  async salvar(P, aoAndar) {
    if (!this.vai(P)) return false; const id = P.id;
    await this.personagensQueFaltam(P, aoAndar).catch(e => console.warn('personagens automáticos', e));
    const ja = this._ks.get(id) || await this.noServidor(id).catch(() => new Set()), ks = await this.chavesProprias(P);
    const falta = ks.filter(k => !ja.has(this.chaveArq(id, k))); let n = 0;
    for (const k of falta) { const b = await Arq.pegaBlob(k); if (!b) continue; aoAndar?.(`Enviando arquivos da animação… ${++n}/${falta.length}`);
      await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.chaveArq(id, k)), { method: 'POST', body: b }); ja.add(this.chaveArq(id, k)); }
    if (P.thumb) { try { const b = await (await fetch(P.thumb)).blob(); await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.pasta(id) + 'thumb.jpg'), { method: 'POST', body: b }); } catch { } }
    const { thumb, nuvemEm, nuvemMod, ...corpo } = P;
    const r = await (await Nuvem.pede(`/animacoes/arquivo?nome=${encodeURIComponent(P.nome || '')}&k=` + encodeURIComponent(this.pasta(id) + 'projeto.json'), { method: 'POST', body: JSON.stringify(corpo), headers: { 'content-type': 'application/json' } })).json().catch(() => ({}));
    // arquivos que a animação já não usa saem da nuvem (só os dela; os dos personagens da equipe não)
    const usa = new Set(ks.map(k => this.chaveArq(id, k))); for (const k of [...ja]) if (/\/arq\//.test(k) && !usa.has(k)) { try { await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(k), { method: 'DELETE' }); ja.delete(k); } catch { } }
    this._lista = null; return r.ok !== false;
  },
  // personagem da animação que não está na nuvem do Ateliê: sobe na pasta automática (só se ainda não tem pasta escolhida na nuvem)
  async personagensQueFaltam(P, aoAndar) {
    const defs = Object.values(P.personagens || {}).filter(d => d?.id && /^[a-z0-9][a-z0-9-]{1,40}$/.test(d.id)); if (!defs.length) return;
    const faltam = []; for (const d of defs) { const est = await Nuvem.estaNaNuvem(d.id); if (est === false) faltam.push(d); } // null = não deu para saber: não sobe nada
    if (!faltam.length) return;
    for (const d0 of faltam) {
      const def = clone(d0); delete def._local; delete def._vista;
      for (const p of Modelo.todasPartes(def)) p.imgs = (p.imgs || []).filter(i => !i.doQuadro); // imagens feitas só para um quadro desta animação não vão para o personagem da equipe
      aoAndar?.(`Mandando o personagem “${def.nome || 'sem nome'}” para a nuvem…`);
      try { await Icone.prepara(def); } catch { }
      await Nuvem.salvar(def, null, { limpar: false });
    }
    await PastasBib.grava('nuvem', o => { if (!o.pastas.includes(this.PASTA_AUTO)) o.pastas.push(this.PASTA_AUTO); for (const d of faltam) if (!o.de[d.id]) o.de[d.id] = this.PASTA_AUTO; });
    Nuvem._lista = null;
  },
  // a chave já está na nuvem da equipe (personagens ou arquivos desta animação)? (para o ao vivo não mandar de novo pelo tempo real)
  temNaNuvem(id, k) { return !!(this._kP?.has(k) || this._ks.get(id)?.has(this.chaveArq(id, k))); },
  async baixarArq(id, k) { const b = await (await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.chaveArq(id, k)))).blob(); return b?.size ? b : null; },
  // ---------- baixar ----------
  async baixarProjeto(id) {
    const r = await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.pasta(id) + 'projeto.json')); const P = await r.json();
    const ks = await this.noServidor(id).catch(() => new Set());
    for (const k of Toon.ids(P)) { if (await Arq.pegaBlob(k)) continue;
      const ka = this.chaveArq(id, k);
      if (ks.has(ka)) { try { const b = await (await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(ka))).blob(); await Arq.guardar(b, k); continue; } catch { } }
      if (/^personagens\//.test(k)) await Nuvem.baixar(k).catch(() => null); }
    if (ks.has(this.pasta(id) + 'thumb.jpg')) { try { const b = await (await Nuvem.pede('/animacoes/arquivo?k=' + encodeURIComponent(this.pasta(id) + 'thumb.jpg'))).blob(); P.thumb = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }); } catch { } }
    return P;
  },
  // abrir uma animação pela tela inicial: a versão da nuvem quando ela é mais nova; com gente na sala ao vivo, a da sala
  async abrir(id, local) {
    let it = null; try { it = (await this.lista(true)).find(x => x.id === id); } catch { }
    let P = local;
    const outros = AoVivo.ligado() ? await AoVivo.outrosNaSala('an-' + id) : 0;
    if (it && !outros && (!local || (it.mod || 0) > (local.nuvemMod || 0))) {
      const mudouAqui = local && (local.modificado || 0) > (local.nuvemEm || 0) + 3000 && local.nuvemMod; // mudanças daqui que ainda não foram e a nuvem também mudou
      let usar = 'nuvem';
      if (mudouAqui) usar = await UI.modal({ title: 'Esta animação mudou nos dois lugares', icon: 'cloud', width: 460, body: `<div>A versão da <b>nuvem da equipe</b> é mais nova, mas este computador tem mudanças que ainda não foram para a nuvem.<br><br>A versão que você não escolher fica guardada aqui como <b>(anterior)</b>.</div>`, buttons: [{ label: 'Usar a deste computador', value: 'local' }, { label: 'Usar a da nuvem', kind: 'primary', value: 'nuvem' }] }) || 'nuvem';
      if (usar === 'nuvem') {
        const fim = Ocupado.inicio({ tipo: 'arquivo', icone: 'cloud', titulo: `Abrindo "${it.nome || 'Animação'}"`, subtitulo: 'Baixando a animação da nuvem da equipe…' });
        try { const N = await this.baixarProjeto(id); if (mudouAqui) { const ant = clone(local); ant.id = uid('p'); ant.nome = local.nome + ' (anterior)'; ant.anterior = { em: Date.now() }; await DB.put('projetos', ant); }
          N.id = id; N.nuvemEm = Date.now(); N.nuvemMod = it.mod || Date.now(); N.modificado = N.modificado || Date.now(); await DB.put('projetos', JSON.parse(JSON.stringify(N))); P = N; }
        catch (e) { UI.toast('Não deu para baixar da nuvem: ' + esc(e.message) + (local ? ' Abrindo a cópia deste computador.' : ''), { kind: 'warn', time: 8000 }); if (!local) return; }
        finally { fim(); }
      }
    }
    if (!P && outros) { const s = { sala: 'an-' + id, nome: it?.nome }; return Home.entrarJunto(s); }
    if (P) return App.abrir(P);
  },
  // ---------- automático ----------
  aoVivoJunto() { if (!AoVivo.ativo || AoVivo.ad?.ctx !== 'animador') return false; const me = AoVivo.eu?.id; return Object.keys(AoVivo.gente || {}).some(i => i !== me); },
  guardiao() { if (!this.aoVivoJunto()) return true; const me = AoVivo.eu.id, ids = [...new Set([...Object.keys(AoVivo.gente || {}), me])].sort(); return ids[0] === me; },
  sujo(P) { return this.vai(P) && (P.modificado || 0) > (P.nuvemEm || 0) + 1000; },
  // chamado depois de salvar neste computador
  agenda() { const P = App.P; if (!this.sujo(P)) return; clearTimeout(this._t);
    const naReserva = (() => { try { return window.EstudioLimite?.naReserva?.(); } catch { return false; } })();
    this._t = setTimeout(() => this.sincronizar(), this.aoVivoJunto() || naReserva ? 600000 : 60000);
    if (!this._ligouEsconder) { this._ligouEsconder = true; document.addEventListener('visibilitychange', () => { if (document.hidden && this.sujo(App.P) && !this.enviando && Date.now() - (this._envioEm || 0) > 120000) this.sincronizar(); }); } },
  async sincronizar(agora) {
    clearTimeout(this._t); const P = App.P; if (!this.vai(P)) return;
    if (!agora && !this.guardiao()) return; // ao vivo: quem manda é outra pessoa da sala
    if (this.enviando) { this._denovo = true; if (agora) await this.enviando; return; }
    if (!this.sujo(P) && !agora) return;
    this._envioEm = Date.now(); const id = P.id, em = Date.now();
    this.enviando = Ocupado.mantem(async () => {
      try { await App.salvarJa(); const snap = JSON.parse(JSON.stringify(App.P)); if (snap.id !== id) return;
        App.salvoTxt('Enviando para a nuvem…'); await this.salvar(snap);
        let mod = Date.now(); try { mod = (await this.lista(true)).find(x => x.id === id)?.mod || mod; } catch { }
        if (App.P?.id === id) { App.P.nuvemEm = em; App.P.nuvemMod = mod; await DB.put('projetos', JSON.parse(JSON.stringify(App.P))).catch(() => { }); App.salvoTxt(this.sujo(App.P) ? 'Salvo neste computador' : 'Salvo na nuvem da equipe'); }
        if (this.aoVivoJunto()) try { AoVivo.t.setMeta(AoVivo.sala, { nuvemEm: { t: Date.now(), por: AoVivo.eu.id, mod } }); } catch { }
        this.erro = null;
      } catch (e) { this.erro = e.message || 'sem conexão'; if (App.P?.id === id) App.salvoTxt('Salvo neste computador (a nuvem não respondeu)'); }
    });
    await this.enviando; this.enviando = null;
    if (this._denovo) { this._denovo = false; if (this.sujo(App.P)) this.agenda(); }
  },
  // outra pessoa da sala mandou: se não tenho mudança minha indo, o que está na tela é o que foi para a nuvem
  salvoPorOutro(m) { const P = App.P; if (!P || !m || m.por === AoVivo.eu?.id || AoVivo.pend?.length) return; clearTimeout(this._t); P.nuvemEm = Date.now(); P.nuvemMod = m.mod || P.nuvemMod; DB.put('projetos', JSON.parse(JSON.stringify(P))).catch(() => { }); App.salvoTxt('Salvo na nuvem da equipe'); },
  // abriu uma animação: entra sozinho no ao vivo (sala an-<id>) e, se ela ainda não está na nuvem, manda
  async aoAbrir(P) {
    if (!this.vai(P)) return; const id = P.id;
    this.noServidor(id).catch(() => { }); this.chavesProprias(P).catch(() => { }); // o que já está na nuvem (para o ao vivo não mandar de novo)
    if (!P.nuvemEm) { P.modificado = Math.max(P.modificado || 0, Date.now()); await this.sincronizar(true).catch(() => { }); } // primeira vez: vai para a nuvem ANTES de abrir a sala (os arquivos não passam pelo tempo real)
    else if (this.sujo(P)) this.agenda();
    if (App.P?.id === id) this.entrarAoVivo(id).catch(() => { });
  },
  async entrarAoVivo(id, n = 0) {
    if (!AoVivo.ligado() || App.P?.id !== id || EMBED) return; if (AoVivo.ativo && AoVivo.sala === 'an-' + id) return;
    const eu = await AoVivo.quem().catch(() => ({}));
    if (await AoVivo.entrar(AoVivo.adAnimador(false, true), { meta: { tipo: 'animador', nome: App.P.nome, por: eu.nome || '', w: App.P.w, h: App.P.h, fim: false, auto: true } })) { App.pintaJunto(); return; }
    if (n < 4) { clearTimeout(this._tenta); this._tenta = setTimeout(() => this.entrarAoVivo(id, n + 1).catch(() => { }), 5000); return; }
    UI.toast('Trabalhar junto ao vivo: ' + esc(AoVivo.erro || 'não consegui entrar'), { kind: 'warn', time: 10000 });
  },
  // ao fechar: se ninguém mais está na sala e há mudança que não foi, manda agora
  async aoFechar() { const P = App.P; if (!this.sujo(P)) return; if (this.aoVivoJunto() && !this.guardiao()) return; await this.sincronizar(true).catch(() => { }); },
};
