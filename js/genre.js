/* ===================== genre.js — o "jeito" das animações de YouTube brasileiras =====================
   Guia de estilo (para a IA e para os modelos prontos), animações e efeitos extras que esse tipo de vídeo usa:
   personagem respirando parado, pulinhos de fala, troca de pose com "pop", reações (!, ?, suor, raiva…),
   enquadramento (corpo todo / cintura / busto / rosto) e a biblioteca de sons reais do usuário. */
'use strict';

/* ---------- guia de estilo ---------- */
const GENRE = {
  // canais de referência (o editor não assiste vídeos: estas notas são o "jeito" geral do gênero; o usuário pode corrigir)
  CANAIS: {
    brubs: { nome: 'Brubs', notas: 'Storytime: a NARRAÇÃO é a espinha dorsal; as imagens encenam, exageram ou contradizem o que é dito. Animação seletiva: maior parte é quadro sustentado + troca de pose/expressão; movimento caro só na punchline. O editor faz o timing cômico: quanto tempo a expressão fica, quando cortar, quanto aproximar, que som vende a pose.' },
    torajo: { nome: 'Mundo Torajo', notas: 'Personagens em PNG (poses) + composição + edição como motor do vídeo. Uma cena funciona com 1 fundo + 2 poses + 3 expressões + 1 objeto + 4 sons. Personagem entra com slide acelerado e leve overshoot (whoosh); fala séria = push-in 4–8% e música abaixa; reação = smash cut para outra pose + impacto (pop/hit); piada = HOLD na reação quase sem movimento e silêncio curto; depois plano mais aberto e a cena segue.' },
    drawnmask: { nome: 'Drawn Mask', notas: 'Começou com animações curtas de baixo frame rate e evoluiu para "edição animada" (Edited Tales): a montagem assume o trabalho — cortes por ideia, zoom e reenquadramento, pausas dramáticas, sons pontuais.' },
    batatinha: { nome: 'Turma da Batatinha', notas: 'Turma de personagens em esquetes; nos episódios especiais é animação completa (storyboard, animatic, VFX). No editor: quem fala fica em destaque (movimento sutil, pose clara); os outros reagem com troca de expressão; ritmo de esquete com piada no fim; em clipes musicais o impacto visual cai na batida.' },
  },
  REGRAS: `IMAGENS: NUNCA altere, recorte, separe, redesenhe ou apague desenhos sem PERGUNTAR. Se precisar (ex.: separar uma folha de sprites, recortar uma parte, pedir um desenho novo), mande antes {"tipo":"pedir_permissao","descricao":"o que e por quê"} — o editor pergunta ao usuário e só faz se ele aceitar.
ANIMAÇÃO DE RECORTE COM OSSOS: existe o ESTÚDIO DE ANIMAÇÃO (botão na tela inicial; estilo Toon Boom Harmony). Lá o personagem é montado em partes com ossos (pivôs nas juntas, IK na mão/pé), recebe poses, troca de desenho (bocas, olhos, cabeça em 8 direções) e atuação pela voz. Quando o usuário quiser animação de verdade com ossos (não só PNGtuber), sugira o estúdio; um projeto de lá entra aqui como objeto "animação" (camada que você pode mover, escalar e pôr efeitos).
ATUAÇÃO ESTILO DISNEY TV (vale também aqui no editor): poucas poses fortes trocadas na sílaba tônica da palavra de ênfase; antecipação de 2–3 quadros; passar 5–10% do ponto e assentar; a cabeça lidera e o corpo vem 2 quadros depois; piscar a cada 2–5 s numa virada; boca em 2s; hold vivo 0,4–2 s; assimetria (nada de pose espelhada perfeita); gesto chega antes da palavra; comédia = take rápido + hold longo da reação; câmera quase parada, push-in lento na emoção.
RECORTE ESTILO TOON BOOM (como o personagem é separado): peças com SOBREPOSIÇÃO nas juntas (pescoço entra por baixo da cabeça; ombro, cotovelo e joelho com ponta redonda escondida) para girar sem abrir buraco; olho em camadas (pálpebra/contorno, branco, PUPILA que desliza dentro do branco); boné, cabelo, franja e capuz em peças próprias (cabelo balança com atraso); logo/estampa é peça presa na roupa; mãos com poses diferentes como troca de desenho.
PERSONAGEM VIVO (nada de boneco duro): 1) EXPRESSÕES — se houver imagens de expressão (pose/rosto feliz, triste, surpresa, brava, piscando, rindo, preocupada), troque a imagem na reação (take) e não fique no mesmo rosto mais de ~3 s; uma expressão por emoção/ideia do roteiro. 2) BOCA — quem fala sempre tem boca animada pela voz (boca falando/"boca" no clipe, ou parte boca com vários desenhos: fechada, meio, aberta, grande); boca fechada no silêncio. 3) OLHOS — piscar a cada 2–5 s (parte olhos fechados com modo piscar) e olhos bravos/fechados na reação certa. 4) CABELO E ROUPA — mechas/partes soltas presas ao corpo com balanço atrasado (overlap), nunca grudadas. 5) CORPO — entre trocas de pose, deriva lenta de 1–2° (hold vivo) e inclinação de cabeça nas palavras fortes; nunca tudo parado por mais de 2 s, nunca tremendo.
MOVIMENTO SUTIL (estilo Disney TV — The Owl House / Amphibia): NADA de personagem tremendo ou pulando o tempo todo. Quem fala fica numa POSE CLARA e "viva" (moving hold): respiração/voiceBounce bem fraco (0,012–0,018), um piscar, uma inclinação de cabeça na palavra forte. Pulinho (hopTalk/jump/hopJoy) e tremor (shake/scared) SÓ em ênfase real (grito, susto, alegria, piada) e por pouco tempo (0,3–0,8 s). A energia vem da TROCA DE POSE no beat certo (antecipação curta → pose nova com leve passar do ponto → hold), não de movimento constante.
COMO ESSES CANAIS ANIMAM (animação de YouTube BR — Brubs, Mundo Torajo, Drawn Mask, Turma da Batatinha, Hu3cat, Violeta Raposa):
PROCESSO OBRIGATÓRIO (pense assim antes de escrever as ações):
 1) Leia a TRANSCRIÇÃO (e o ROTEIRO, se houver) e faça o BEAT MAP: para cada frase → intenção (apresenta, explica, escala, vira, punchline, reação), emoção e quem fala/quem é citado.
 2) Classifique cada beat em A/B/C/D (abaixo) e escolha a pose/imagem certa pela emoção.
 3) Monte a BASE: voz (limpar_voz se tiver pausas longas), fundo/cenário na faixa de baixo cobrindo tudo, personagens enquadrados.
 4) Coloque as trocas de pose nos tempos exatos das falas (dividir + trocar_midia + poseSwap), idle/voiceBounce contínuos, reações de quem escuta.
 5) Câmera e impacto só nos beats certos; depois SOM (pontuação baixinha) e MÚSICA (abaixando com a voz); por último LEGENDAS (Shorts).
 6) Confira o checklist final antes do {"fim":true}. Use o "resumo" para explicar ao usuário, em poucas linhas, o que fez em cada parte.
RESUMO: o roteiro cria o beat, a VOZ cria o tempo, o desenho cria a leitura, a EDIÇÃO cria a atuação e o SOM cria o impacto. O vídeo não precisa estar em movimento o tempo todo — precisa MUDAR DE INTENÇÃO o tempo todo.
• Personagens são PNGs parados (uma imagem por pose/expressão). A atuação vem da edição: troca de pose, enquadramento, câmera, entradas, reações e som.
• COMECE PELO ÁUDIO: leia a transcrição, marque os BEATS (nova ideia, punchline, revelação, susto, transição) e só então monte. Corte silêncios mortos/repetições na voz quando fizer sentido (dividir/remover trecho).
• 4 NÍVEIS (use o mais barato que funciona; suba de nível só quando o momento merece):
  A) quadro sustentado — pose quase parada + "idle" + push-in leve (exposição, contexto);
  B) troca de pose/expressão — dividir + trocar_midia com "poseSwap" (diálogo, reação, construção da piada);
  C) motion do editor — "pushIn", "snapZoom", "enterSide" (overshoot), "shake", "zoomPunch", "punch"/"shakeCam" curtos, speedLines, blur;
  D) animação dedicada — várias poses em sequência rápida, path, efeitos fortes — SÓ na punchline/ápice.
  Um vídeo bom tem muitos beats A/B, alguns C e pouquíssimos D. Tudo D = cansa; tudo A = parece slide.
• TIMING: na fala normal, algum evento visual relevante a cada 1,5–3,5 s (troca de pose, reenquadramento, zoom, texto, objeto). Uma frase longa pode ter 2–4 beats visuais. Antes da piada, antecipe 4–10 quadros; depois da piada/fala absurda, HOLD de 6–18 quadros (0,2–0,6 s) na reação, quase sem movimento — o silêncio vende a piada. Emoção/suspense: planos mais longos. Ação: planos curtos alternando tamanhos.
• CADA TROCA RESPONDE AO SENTIDO DA FALA (nada de troca aleatória). Poses "de verbo": apontando, escondendo, julgando, surtando, comemorando — escolha pela emoção/ação do que está sendo dito. Não fique só trocando a boca: mude pose, olhar e enquadramento.
• PARADO: quem está na tela usa "idle" (respiração/balanço sutil) para não "morrer". FALANDO: "hopTalk" leve; quem escuta reage de vez em quando (emote/lean/pose).
• CORPO CONTINUA ABAIXO DA TELA: com "enquadrar" em joelho/cintura/busto/rosto o editor estende o corpo para baixo da borda (sem corte vazio). NUNCA deixe a borda do recorte aparecer: não suba o personagem com "posicionar"/keyframe de y depois de enquadrar, não use "recorte" manual no lugar de "enquadrar" e não use "jump"/"float" grandes em personagem cortado — prefira hopTalk/idle/poseSwap (que é um puxão para baixo e volta). Personagem que pula de verdade ou anda deve estar em "corpo" (corpo todo).
• TROCA DE POSE = PUXÃO: ao trocar de sprite (dividir + trocar_midia) aplique "poseSwap" (~0,3 s) no começo do clipe novo: ele afunda um pouco como se fosse puxado de baixo e volta com um quique — nunca uma troca seca flutuando.
• ENQUADRAMENTO (ação "enquadrar"): varie — "corpo" (abre cena), "cintura" (barriga pra cima, o mais usado ao falar), "busto" (ênfase), "rosto" (choque/piada). Não deixe sempre centralizado: use lado "esq"/"dir", direção do olhar e espaço negativo. O mesmo desenho rende plano aberto, médio, close e extreme close.
• ENTRADAS/SAÍDAS: nada de deslizar "PowerPoint". Use "enterSide" (aceleração + overshoot + whoosh), "popIn", "enterBottom"; saída "popOut". Misture curvas: entradas secas, ease suave e overshoot.
• CÂMERA: "pushIn" (4–8%) para frase importante; "snapZoom" para absurdo/susto/revelação; afastar cria constrangimento. ZOOM É PONTUAÇÃO — não em toda frase.
• SHAKE: 2–6 quadros (0,07–0,2 s) só em impacto; longo parece defeito. Squash/stretch 2–8%, pouco.
• POSES-CHAVE > movimento constante: neutra de escuta → antecipação (recua) → ação (gesto amplo) → reação → settle (pequena volta). Olhos/sobrancelha carregam a intenção; o olhar chega antes da cabeça. "blink" logo antes de uma troca de pose disfarça a troca. Hard cut de uma pose calma para uma reação extrema é mais engraçado que interpolar.
• HOLD sem ficar morto: durante a pose segurada mantenha "idle", um piscar, micro push-in ou reação do personagem secundário. Quem NÃO fala também reage (olha, pisca, encolhe — emote/lean/pose).
• REAÇÕES: efeito "emote" (! ? suor raiva coração estrelas … choque lâmpada) ~1 s sobre o personagem, junto de pose nova.
• SOM — hierarquia: 1) voz sempre compreensível; 2) SFX narrativo (porta, impacto, objeto, passo, mensagem); 3) SFX de edição (whoosh, pop, riser, hit) reforçando o corte; 4) música por blocos de emoção, ABAIXANDO sob a fala (ação "abaixar_com_voz"); 5) ambiência quase imperceptível. SFX é PONTUAÇÃO, não papel de parede: escolha sons que explicam a ação ou vendem a punchline, volume 15–40%, e deixe espaço entre eles. Prefira os SONS REAIS da biblioteca do usuário.
• FUNDO: cenário desenhado ou fundo com padrão que se repete andando devagar (ação "fundo": bolinhas, quadrados, xadrez, listras, estrelas…, cores próximas entre si); parallax (fundo mais lento que o personagem) dá vida.
• CHECAGEM FINAL: nenhum trecho de 5–7 s visualmente igual sem motivo; poses legíveis sem ouvir; shakes curtos; sons não competem; imagens com margem para zoom/shake sem cortar cabeça/mãos; os momentos importantes receberam mais trabalho que as passagens.`,
  SHORTS: `FORMATO SHORTS (9:16) — estudo principal: Shorts animados do Mundo Torajo (piadas fechadas de 13–20 s):
O ÁUDIO É O RELÓGIO (a partitura); as poses fazem a atuação; a edição transforma desenhos parados em energia contínua. UMA premissa por Short.
• BEAT MAP primeiro (pela transcrição): palavra que inicia a ideia (1º frame chamativo), pausas de respiração (olhar/reação), palavra enfatizada (troca de pose ou snapZoom), interrupção (corte ou entrada de outro personagem), silêncio antes da piada (NÃO preencher — é tensão), última sílaba do punchline (reserve reação depois).
• ANATOMIA (Short de ~15 s; escale proporcionalmente se for maior):
  0–1,2 s GANCHO: situação já montada, pose extrema/estranha, sem entrada longa; silhueta clara.
  1–4 s SETUP: a regra da cena (quem quer o quê). Segure a pose; mude só o que carrega informação (boca/olho/pose de rosto); push-in ~4%.
  4–9 s ESCALADA: densidade de microeventos — olhar pro lado, zoom mínimo, prop/personagem entrando, reação secundária.
  9–13 s VIRADA: close + snapZoom, 2–4 quadros de silêncio + hit.
  PUNCHLINE: pose extrema + shake curto + SFX principal.
  FINAL: HOLD de 0,3–0,7 s depois da última palavra (piscar/settle, cauda do som) — o fim é intencional, nunca "o arquivo acabou".
• LEGENDAS SEMPRE: ação "legendas" (estilo youtube, ~14–18 letras por vez). Três zonas verticais: em cima rosto/olhos e o que precisa ser lido primeiro; no meio mãos/props/interação; embaixo corpo secundário e área de segurança. Nada importante colado nas bordas (a interface do Shorts cobre a parte de baixo e a direita) — legendas no terço de cima ou logo acima do meio, sem tampar o rosto.
• RECEITAS (pontos de partida): push-in de fala 100→107% em 0,8–1,6 s ("pushIn" amount .07); punchline snap +6–12% em 2–4 quadros com overshoot de 1–2% ("snapZoom" amount .08–.12); shake de impacto 0,13–0,33 s com amplitude caindo; entrada lateral passando 10–40% do ponto e voltando ("enterSide"); reaction hold 4–12 quadros; flash de impacto 1–2 quadros, raro; corte no pico do movimento.
• CONTRASTE é o estilo: hold calmo → mudança brusca → reação clara. Zoom/shake em todo segundo NÃO é o estilo. Câmera e personagem não fazem a mesma coisa ao mesmo tempo (se o personagem entra violento, câmera parada; se o personagem está em hold, a câmera mexe).
• SOM: 3–6 SFX úteis num Short de 15 s (não parede sonora); SFX pode começar 1–2 quadros ANTES do movimento (parece mais rápido); silêncio é efeito (tire música por uma fração de segundo antes da resposta absurda). Música, se houver, baixa sob a fala ("abaixar_com_voz").
• Comparação/lista (A vs B, "qual a altura?"): mesma composição repetida com reação diferente em cada uma; acelere as primeiras e guarde tempo para o último exagero.
• Personagem grande (cintura/busto/rosto), alternando lados; poses de verbo e de reação; quem não fala reage.`,
  MANUAL: `MANUAL DE SHORTS ANIMADOS (prompt-mestre do usuário — siga sempre nos Shorts):
Você é diretor, roteirista, storyboarder, animador 2D e editor de SHORTS VERTICAIS de comédia cartoon para público jovem (linguagem da animação curta brasileira de internet). Aprenda os PRINCÍPIOS, nunca copie personagens/falas/assets de outros canais.
OBJETIVO: shorts de 8–25 s que pareçam intencionalmente animados e editados (não slides): premissa única, hook imediato, setup mínimo, 1–3 escaladas, payoff forte e reação curta.
PENSE NESTA ORDEM: BEATS (eventos cômicos) → POSES → CORTES → só então movimentos intermediários.
FÓRMULA: 0–1 s hook (pergunta/conflito/gesto estranho já na tela) · 1–4 s setup (só a relação necessária) · 4–9 s escalada (1–3 mudanças claras: pose nova, personagem novo, repetição com variação, objeto, aproximação) · 9–15 s payoff (maior contraste visual e sonoro) · 15–19 s reação/cauda (reação curta, silêncio ou corte que cristaliza a piada).
7 FORMATOS (reconheça qual é o vídeo): desafio verbal (pergunta → resposta → pegadinha) · comparação A/B (mesma composição, atuação oposta, troca rápida) · repetição com escalada (mesma mecânica 2–5x, cada vez mais forte; acelere as primeiras) · teste de identidade (pergunta-teste → resposta rápida → descoberta) · explosão de personalidade (calmo pergunta → outro domina a tela) · tensão falsa → piada ("modo sério" com sombra/vinheta/cor escura → a piada volta a cor limpa: use o efeito "modoSerio" e tire na piada) · storytime curto (narrador → encenação → consequência → frase final).
ROTEIRO: comece dentro da ação (nada de "oi gente"); a ideia cabe numa frase; 1–3 personagens; cada um reage pela personalidade (sério, impulsivo, desentendido, confiante, cansado, observador); o punchline MUDA algo (informação, expressão, escala, luz, pose, objeto, som ou enquadramento); depois do punchline encerre rápido.
QUANDO TROCAR A POSE: quando o objetivo da fala muda (perguntar → perceber → atacar); nos substantivos/verbos fortes (não em toda sílaba); quando outro personagem entra ou domina; para preparar a piada e de novo no exato quadro do payoff; depois do payoff, 1 reação forte vale mais que 4 pequenas. Reação atrasada (demora uma fração de segundo para entender e só então muda o rosto) deixa a piada mais forte. Expressão antes da boca.
EDIÇÃO: hard cut é o padrão (transição elaborada só se ela for a piada) · push-in curto para percepção/ameaça/vergonha/frase decisiva · snap zoom no impacto, rápido, pequeno, com som e voltando · shake só no pico (grito, colisão, golpe, queda, susto) · punch-in de reação (corta do plano de dois para o rosto de quem entendeu) · freeze de 2–8 quadros depois de algo absurdo · cut on word (corte exatamente na palavra-chave) · silêncio visual/musical de 0,15–0,5 s antes do punchline.
DENSIDADE: em 15 s, 8–16 eventos perceptíveis (pose, corte, reação, objeto, zoom, texto, som), mas só 3–6 grandes. Erros: "PowerPoint" (3–5 s sem mudança → micro atuação + recorte de câmera + reação); "TikTok genérico" (zoom em toda frase → zoom só na mudança emocional); "sem punchline" (tudo igual → guarde escala/efeito/som máximo para o final); "caótico" (tudo se mexe → uma camada líder por beat).
VISUAL: fundo simples e legível, personagem é o foco, formas grandes; texto na tela só se carrega informação ou é a piada; overlays permitidos: speedLines, choque radial, vergonha (blush), suor, lágrimas, poeira, estrelas, flash branco, vinheta leve, sombra dramática.
ÁUDIO: a voz manda no timing; whoosh = câmera/pose rápida; pop = objeto/texto/olhar; impacto = punchline/colisão (1 forte por clímax); boing = deformação; gasp = reação; beep = censura; glitch = tema digital; silêncio 0,15–0,6 s antes/depois do punchline. Não use som em todo corte.
CRITÉRIO: se uma cena pode sair sem prejudicar setup, escalada ou payoff, tire; se um efeito não melhora leitura, timing ou emoção, tire. Máxima clareza cômica por segundo, não máxima quantidade de movimento. "Mova a coisa certa no momento certo."
NO "resumo" (antes das ações) escreva curto: IDEIA EM 1 FRASE · FORMATO · BEAT SHEET com tempos (hook/setup/escalada/payoff/reação) · CHECK DE RETENÇÃO (por que o 1º segundo prende e onde está o payoff).`,
  RECEITA: `RECEITA "SHORTS DO PROBLEMS" (edição aprovada pelo usuário — use como padrão nos Shorts dele):
1) VOZ: "limpar_voz" primeiro (tira pausas, filtro de grave, compressor, normaliza) → use a transcrição NOVA para todos os tempos.
2) FUNDO: "fundo" bolinhas em degradê (#582ed6 → #2896f5), bolinhas brancas 32%, pulsar 0.6, bolhas grandes subindo, vinheta, andando na diagonal (~55 px/s).
3) PERSONAGEM: grande na parte de baixo (enquadrar cintura/joelho), efeito "outline" branco (~9 px, estilo adesivo) + "shadow" roxa suave; entra com "dropIn" (cai com mola); "voiceBounce" BEM SUTIL (amount 0,012–0,018, sem pulinhos) + "idle" quase imperceptível; troca de pose a CADA frase pela emoção (feliz, bravo, gritando, explicando, apontando, ombros, olhando pra cima, pensando, de lado, convencido…), com "poseSwap" e som "pop" baixinho.
4) QUEM É CITADO (ex.: "Problems"): imagem dele com "moldura" em círculo (dentro ciano #40e0f0, borda branca), entra com "rollIn" + "estrelinhas", sons boing + ding (e whoosh logo antes); fica até o fim da frase e sai com "popOut"; o personagem troca para a pose APONTANDO na direção dele.
5) IMPACTO só nas falas fortes: "zoomPunch"/"punch" (~7%, 0,5 s), "shakeCam" curto (0,35 s, com ampliar para não mostrar borda), "flash" branco curto antes do final com som "riser"; "estrelinhas" + "sparkle" nos momentos de conquista.
6) COMEÇO: flash branco de 0,12 s (transição fadeWhite) + "thump" + "sparkle". FIM: pose feliz + flash.
7) SOM: efeitos ~25–35% (uns 11 dB abaixo da voz), nunca altos; "musica" animada gerada, volume ~18 e "abaixar_com_voz" 30.
8) LEGENDAS: "legendas" estilo youtube no terço de cima (deixe o topo livre do personagem).`,
  VIDEO: `FORMATO VÍDEO DO YOUTUBE (16:9, horizontal, tipicamente 3–12 min):
• ESTRUTURA: abertura de até 10 s (assunto/promessa + personagem entrando + título grande), BLOCOS por assunto (um "marcador" no início de cada um, título curto animado, cenário/fundo próprio, música de clima por bloco), e final com chamada (inscreva-se) + hold.
• Legendas só se o usuário pedir (texto na tela só para ênfase: títulos, números, palavras de impacto).
• Ritmo: evento visual a cada 2–3,5 s; em explicação pode segurar mais (A/B), em ação/piada encurte. Nunca mais de 5–7 s visualmente igual sem motivo.
• DIÁLOGO: cada personagem de um lado (enquadrar esq/dir), quem fala em destaque (voiceBounce sutil/boca; hopTalk só numa ênfase), quem escuta reage; alterne plano conjunto → close em quem fala nas falas importantes → conjunto.
• Enquadramentos variados (corpo para abrir cena, cintura no diálogo, busto/rosto nas piadas), cortes secos ou transição curta entre blocos; música muda quando muda o bloco emocional e sempre abaixa com a voz.
• Em vídeo longo, economize: muitos beats A/B, alguns C, pouquíssimos D — reserve os efeitos para as piadas e viradas.`,

  text(format) { return this.REGRAS + '\n' + (format === 'video' ? this.VIDEO : this.SHORTS + '\n' + this.MANUAL + '\n' + this.RECEITA) + '\nCANAIS DE REFERÊNCIA:\n' + Object.values(this.CANAIS).map(c => `• ${c.nome}: ${c.notas}`).join('\n'); },
  formatOf(p) { if (p?.formato) return p.formato; const s = p?.settings; return s && s.h > s.w ? 'shorts' : 'video'; },
};

/* ---------- animações extras ---------- */
Object.assign(ANIMS, {
  idle: {
    name: 'Respirando (parado)', cat: 'Movimento', dur: 6, sound: '', hint: 'O personagem "respira" e balança de leve — use o tempo todo em quem está na tela.',
    params: [{ k: 'amp', l: 'Intensidade', min: 0, max: .1, step: .005, def: .01 }, { k: 'speed', l: 'Velocidade', min: .2, max: 3, step: .05, def: .45 }, { k: 'sway', l: 'Balanço', min: 0, max: 5, step: .1, def: .5, unit: '°' }],
    fn(p, P, x) { const w = Math.sin(x.t * P.speed * Math.PI * 2); return { sy: 1 + P.amp * (w * .5 + .5), sx: 1 - P.amp * .35 * (w * .5 + .5), rot: Math.sin(x.t * P.speed * Math.PI) * P.sway, pivot: 'bottom' }; }
  },
  hopTalk: {
    name: 'Pulinhos de fala', cat: 'Movimento', dur: 2, sound: '', hint: 'Pulinhos curtos no ritmo da fala (estilo Brubs/Torajo).',
    params: [{ k: 'height', l: 'Altura', min: 0, max: 80, def: 6, unit: 'px' }, { k: 'speed', l: 'Pulos por segundo', min: .5, max: 8, step: .1, def: 2.2 }, { k: 'squash', l: 'Amassar', min: 0, max: .3, step: .01, def: .025 }],
    fn(p, P, x) { const ph = (x.t * P.speed) % 1, k = 1 + .5 * hash(Math.floor(x.t * P.speed)), up = Math.sin(ph * Math.PI); return { dy: -P.height * k * up, sy: 1 + P.squash * (up - .3), sx: 1 - P.squash * .6 * (up - .3), pivot: 'bottom' }; }
  },
  poseSwap: {
    name: 'Troca de pose (puxão)', cat: 'Entrada', dur: .3, sound: '', hint: 'Quando a pose muda: o personagem dá um puxão para baixo e volta quicando (o corpo continua abaixo da tela, sem aparecer o corte).',
    params: [{ k: 'amount', l: 'Força', min: 0, max: .4, step: .01, def: .06 }, { k: 'pull', l: 'Puxão para baixo', min: 0, max: .15, step: .005, def: .02 }],
    fn(p, P, x) {
      // "puxão": afunda rápido (como se puxassem de baixo da tela), volta subindo com um quique — o corte nunca aparece porque o corpo continua abaixo da tela
      const v = Math.sin(Math.min(1, p) * Math.PI) * (1 - p * .3), pl = P.pull ?? .035;
      const dip = p < .3 ? Ease.out(p / .3) : p < .75 ? 1 - Ease.inOut((p - .3) / .45) * 1.25 : -.25 * (1 - (p - .75) / .25);
      return { sx: 1 + P.amount * v, sy: 1 - P.amount * .7 * v + P.amount * .25 * (p > .5 ? v : 0), dy: pl * (x?.H || 1080) * dip, pivot: 'bottom' };
    }
  },
  enterBottom: {
    name: 'Subir de baixo', cat: 'Entrada', dur: .45, sound: 'swoosh', hold: 'before', hint: 'Entra subindo da parte de baixo da tela.',
    params: [{ k: 'ease', l: 'Movimento', type: 'ease', def: 'back' }],
    fn(p, P, x) { const v = Ease[P.ease || 'back'](p); return { dy: (1 - v) * x.H * .8, op: Math.min(1, p * 3) }; }
  },
  enterSide: {
    name: 'Entrar pelo lado (overshoot)', cat: 'Entrada', dur: .5, sound: 'whoosh', hold: 'before', hint: 'Entra com aceleração, passa um pouco do ponto e volta (nada de deslizar "PowerPoint").',
    params: [{ k: 'dir', l: 'Vem da', type: 'select', opts: { left: 'Esquerda', right: 'Direita' }, def: 'left' }, { k: 'over', l: 'Passar do ponto', min: 0, max: .4, step: .01, def: .15 }],
    fn(p, P, x) { const sgn = P.dir === 'right' ? 1 : -1, D = x.W * .9; let v; if (p < .62) v = 1 - Ease.out(p / .62) * (1 + P.over); else v = -P.over + P.over * Ease.inOut((p - .62) / .38); const lean = p < .62 ? -sgn * 6 * (1 - p / .62) : sgn * 3 * Math.sin((p - .62) / .38 * Math.PI); return { dx: sgn * D * Math.max(-P.over, v), rot: lean, sx: 1 + (p < .62 ? .04 * (1 - p / .62) : 0), pivot: 'bottom' }; }
  },
  pushIn: {
    name: 'Aproximar devagar (push-in)', cat: 'Escala', dur: 3, sound: '', hint: 'Zoom lento de ênfase (4–8%) — dá peso à frase.',
    params: [{ k: 'amount', l: 'Quanto', min: 0, max: .5, step: .01, def: .06 }],
    fn(p, P) { const v = 1 + P.amount * Ease.inOut(p); return { sx: v, sy: v }; }
  },
  snapZoom: {
    name: 'Zoom seco (snap)', cat: 'Escala', dur: 1.2, sound: 'hit', hint: 'Aproxima quase instantaneamente e segura — absurdo, susto, revelação.',
    params: [{ k: 'amount', l: 'Quanto', min: 0, max: 2, step: .01, def: .1 }, { k: 'over', l: 'Passar do ponto', min: 0, max: .1, step: .005, def: .015 }, { k: 'back', l: 'Voltar no fim', type: 'bool', def: false }],
    fn(p, P, x) { const t = x.t, T = .1, out = P.back && p > .85 ? 1 - (p - .85) / .15 : 1; let k; if (t < T) k = Ease.out(t / T) * (1 + (P.over || 0) / Math.max(.01, P.amount)); else if (t < T + .12) { const u = (t - T) / .12; k = 1 + ((P.over || 0) / Math.max(.01, P.amount)) * (1 - Ease.inOut(u)); } else k = 1; const v = 1 + P.amount * k * out; return { sx: v, sy: v }; }
  },
  lean: {
    name: 'Inclinar', cat: 'Movimento', dur: .8, sound: '', hint: 'Inclina para o lado e volta (curiosidade, dúvida).',
    params: [{ k: 'angle', l: 'Ângulo', min: -30, max: 30, def: 8, unit: '°' }],
    fn(p, P) { return { rot: Math.sin(p * Math.PI) * P.angle, pivot: 'bottom' }; }
  },
});

/* ---------- efeito "reação" (desenhado sobre o personagem) ---------- */
const EMOTES = { vergonha: 'Vergonha (bochechas vermelhas)', lagrimas: 'Lágrimas (choro)', poeira: 'Poeira (saindo correndo)', exclamacao: '! (susto)', interrogacao: '? (dúvida)', suor: 'Gota de suor', raiva: 'Veia de raiva', coracao: 'Corações', estrelas: 'Estrelas (tonto)', reticencias: '… (silêncio)', choque: 'Linhas de choque', lampada: 'Lâmpada (ideia)', musica: 'Notas musicais', zzz: 'Zzz (sono)' };
FX.emote = {
  name: 'Reação (! ? suor…)', cat: 'Personagem', dur: 1.1, sound: 'pop', soundDefault: 'off', clipOnly: true, hint: 'Símbolo de reação em cima do personagem: susto, dúvida, suor, raiva, corações…',
  params: [{ k: 'kind', l: 'Reação', type: 'select', opts: EMOTES, def: 'exclamacao' }, { k: 'size', l: 'Tamanho', min: 30, max: 400, def: 130, unit: 'px' }, { k: 'side', l: 'Lado', type: 'select', opts: { dir: 'Direita', esq: 'Esquerda', meio: 'Em cima' }, def: 'dir' }, { k: 'color', l: 'Cor', type: 'color', def: '#ffde26' }],
  apply(c, cv, P, x) {
    const b = x.bounds || { x: cv.width * .35, y: cv.height * .25, w: cv.width * .3, h: cv.height * .5 };
    const q = x.q || 1, S = P.size * q, t = x.t, pop = t < .18 ? Ease.back(t / .18) : 1, bob = Math.sin(t * 6) * S * .04;
    const hx = P.side === 'esq' ? b.x + b.w * .2 : P.side === 'meio' ? b.x + b.w * .5 : b.x + b.w * .8, hy = b.y + b.h * .06;
    c.save(); c.translate(hx, hy + bob); c.scale(pop, pop); c.lineJoin = 'round'; c.lineCap = 'round';
    const stroke = (w = S * .07) => { c.lineWidth = w; c.strokeStyle = '#111'; };
    const txt = (s, col) => { c.font = `900 ${S}px "Luckiest Guy","Bangers",Impact,sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; stroke(S * .12); c.strokeText(s, 0, 0); c.fillStyle = col; c.fillText(s, 0, 0); };
    switch (P.kind) {
      case 'exclamacao': c.rotate(.18); txt('!', P.color); break;
      case 'interrogacao': c.rotate(.15); txt('?', P.color === '#ffde26' ? '#7fd3ff' : P.color); break;
      case 'reticencias': { const n = Math.min(3, Math.floor(t / .25) + 1); txt('.'.repeat(n).padEnd(3, ' '), '#fff'); break; }
      case 'suor': { c.translate(S * .1, S * .35 + (t % 1) * S * .25); c.beginPath(); c.moveTo(0, -S * .35); c.bezierCurveTo(S * .28, -S * .02, S * .22, S * .25, 0, S * .25); c.bezierCurveTo(-S * .22, S * .25, -S * .28, -S * .02, 0, -S * .35); c.fillStyle = '#8fd6ff'; c.fill(); stroke(S * .05); c.stroke(); c.beginPath(); c.arc(-S * .06, S * .06, S * .05, 0, 7); c.fillStyle = '#fff'; c.fill(); break; }
      case 'raiva': { const pulse = 1 + Math.sin(t * 14) * .08; c.scale(pulse, pulse); c.strokeStyle = '#e8203b'; c.lineWidth = S * .1; for (let i = 0; i < 4; i++) { c.save(); c.rotate(i * Math.PI / 2 + Math.PI / 4); c.beginPath(); c.moveTo(S * .08, S * .3); c.quadraticCurveTo(S * .1, S * .1, S * .3, S * .08); c.stroke(); c.restore(); } break; }
      case 'coracao': for (let i = 0; i < 3; i++) { const tt = (t * .8 + i / 3) % 1, s = S * (.35 + .1 * i) * (1 - tt * .3); c.save(); c.translate((i - 1) * S * .35, -tt * S * .9); c.globalAlpha = 1 - tt; c.beginPath(); c.moveTo(0, s * .3); c.bezierCurveTo(-s * .6, -s * .1, -s * .3, -s * .55, 0, -s * .2); c.bezierCurveTo(s * .3, -s * .55, s * .6, -s * .1, 0, s * .3); c.fillStyle = '#ff4f8b'; c.fill(); stroke(S * .035); c.stroke(); c.restore(); } break;
      case 'estrelas': for (let i = 0; i < 4; i++) { const a = t * 5 + i * Math.PI / 2, r = S * .6; c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r * .35 + S * .3); c.rotate(a); c.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? S * .09 : S * .2, aa = k * Math.PI / 5; c.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); } c.closePath(); c.fillStyle = '#ffde26'; c.fill(); stroke(S * .03); c.stroke(); c.restore(); } break;
      case 'choque': { c.translate(-(hx - (b.x + b.w * .5)), S * .2); c.strokeStyle = '#fff'; for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI, r0 = Math.max(b.w * .45, S * .7), j = Math.sin(t * 30 + i) * S * .04; c.lineWidth = S * .07; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * .7 + j); c.lineTo(Math.cos(a) * (r0 + S * .5), Math.sin(a) * (r0 + S * .5) * .7 + j); stroke(S * .12); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = S * .06; c.stroke(); } break; }
      case 'lampada': { const g = .6 + .4 * Math.abs(Math.sin(t * 6)); c.shadowColor = '#fff27a'; c.shadowBlur = S * .5 * g; c.beginPath(); c.arc(0, 0, S * .32, 0, 7); c.fillStyle = '#fff27a'; c.fill(); c.shadowBlur = 0; stroke(S * .05); c.stroke(); c.fillStyle = '#888'; c.fillRect(-S * .14, S * .28, S * .28, S * .2); c.strokeRect(-S * .14, S * .28, S * .28, S * .2); break; }
      case 'musica': for (let i = 0; i < 2; i++) { const tt = (t * .7 + i * .5) % 1; c.save(); c.translate((i ? 1 : -1) * S * .3, -tt * S); c.globalAlpha = 1 - tt; txt(i ? '♫' : '♪', P.color); c.restore(); } break;
      case 'vergonha': { c.translate(-(hx - (b.x + b.w * .5)), b.h * .14); c.globalAlpha = .55 + .15 * Math.sin(t * 5); c.fillStyle = '#ff5c8a'; for (const sx of [-1, 1]) { c.beginPath(); c.ellipse(sx * b.w * .17, 0, S * .32, S * .16, 0, 0, 7); c.fill(); c.strokeStyle = '#d02c62'; c.lineWidth = S * .04; for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(sx * b.w * .17 + k * S * .14 - S * .05, -S * .06); c.lineTo(sx * b.w * .17 + k * S * .14 + S * .05, S * .06); c.stroke(); } } break; }
      case 'lagrimas': { c.translate(-(hx - (b.x + b.w * .5)), b.h * .12); for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const tt = (t * 1.6 + k / 3) % 1; c.save(); c.translate(sx * (b.w * .14 + tt * S * .6), tt * S * 1.2); c.globalAlpha = 1 - tt; c.beginPath(); c.moveTo(0, -S * .18); c.quadraticCurveTo(S * .14, 0, 0, S * .12); c.quadraticCurveTo(-S * .14, 0, 0, -S * .18); c.fillStyle = '#8fd6ff'; c.fill(); c.restore(); } break; }
      case 'poeira': { c.translate(-(hx - (b.x + b.w * .5)), b.h * .9); for (let k = 0; k < 6; k++) { const tt = Math.min(1, t * 1.4 + k * .05), r = S * (.25 + .35 * tt) * (1 - k * .06); c.globalAlpha = Math.max(0, .75 - tt * .75); c.fillStyle = '#e8e1d4'; c.beginPath(); c.arc((k - 2.5) * S * .35 * (1 + tt), -tt * S * .3 - (k % 2) * S * .2, r, 0, 7); c.fill(); } break; }
      case 'zzz': for (let i = 0; i < 3; i++) { const tt = (t * .5 + i / 3) % 1; c.save(); c.translate(tt * S * .5, -tt * S); c.scale(.4 + tt * .5, .4 + tt * .5); c.globalAlpha = 1 - tt; txt('Z', '#cfe3ff'); c.restore(); } break;
    }
    c.restore();
  },
};

/* ---------- enquadramento (corpo todo / cintura / busto / rosto) ---------- */
const FRAMES = { corpo: { l: 'Corpo todo', keep: 1, h: .82 }, joelho: { l: 'Do joelho pra cima', keep: .78, h: .86 }, cintura: { l: 'Barriga pra cima (cintura)', keep: .58, h: .9 }, busto: { l: 'Busto (peito pra cima)', keep: .42, h: .92 }, rosto: { l: 'Rosto (bem perto)', keep: .26, h: .95 } };
const Framing = {
  // área realmente desenhada (sem o transparente em volta), em % da imagem
  // área realmente desenhada (sem o transparente/sujeirinhas em volta), em % da imagem; keep = fração de cima considerada na largura
  box(id, keep = 1) {
    const rt = Assets.get(id); if (!rt) return null;
    const el = rt.img || rt.frames?.[0]?.bmp; if (!el || rt.meta.kind === 'video') return null;
    try {
      if (!rt._alpha) {
        const W = el.naturalWidth || el.width, H = el.naturalHeight || el.height, k = Math.min(1, 256 / Math.max(W, H)), w = Math.max(1, Math.round(W * k)), h = Math.max(1, Math.round(H * k));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(el, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data, on = new Uint8Array(w * h); for (let q = 0; q < w * h; q++) on[q] = d[q * 4 + 3] > 24 ? 1 : 0;
        rt._alpha = { w, h, on };
      }
      const { w, h, on } = rt._alpha, rows = new Array(h).fill(0);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rows[y] += on[y * w + x];
      const minR = Math.max(1, w * .01); let y0 = 0, y1 = h - 1; while (y0 < h && rows[y0] < minR) y0++; while (y1 > y0 && rows[y1] < minR) y1--;
      if (y0 >= y1) return null;
      const ye = Math.round(y0 + (y1 - y0) * keep), cols = new Array(w).fill(0);
      for (let y = y0; y <= ye; y++) for (let x = 0; x < w; x++) cols[x] += on[y * w + x];
      const minC = Math.max(1, (ye - y0) * .02); let x0 = 0, x1 = w - 1; while (x0 < w && cols[x0] < minC) x0++; while (x1 > x0 && cols[x1] < minC) x1--;
      return { l: x0 / w * 100, t: y0 / h * 100, r: (w - 1 - x1) / w * 100, b: (h - 1 - y1) / h * 100 };
    } catch { return null; }
  },
  // corta a parte de baixo do desenho e encosta o personagem no pé da tela, ocupando "h" da altura
  apply(c, mode, side) {
    const f = FRAMES[mode]; if (!f || !['image', 'gif', 'video'].includes(c.type)) return false;
    const m = Assets.meta(c.assetId); if (!m) return false;
    const S = App.project.settings, bx = this.box(c.assetId, f.keep) || { l: 0, t: 0, r: 0, b: 0 };
    const figH = 100 - bx.t - bx.b, r1 = v => Math.round(v * 10) / 10;
    // margem pequena em cima/lados para não cortar cabelo/mãos
    c.crop = { l: r1(Math.max(0, bx.l - 1)), r: r1(Math.max(0, bx.r - 1)), t: r1(Math.max(0, bx.t - 1.5)), b: r1(clamp(100 - bx.t - figH * f.keep, 0, 95)) };
    // tamanho do conteúdo recortado na tela com escala 1 (encaixe contain)
    const cw = m.w * (1 - ((c.crop.l || 0) + (c.crop.r || 0)) / 100), ch = m.h * (1 - ((c.crop.t || 0) + c.crop.b) / 100);
    const fit = Math.min(S.w / cw, S.h / ch), targetH = S.h * f.h, maxW = S.w * (side === 'esq' || side === 'dir' ? (S.h > S.w ? .86 : .5) : .96);
    c.tr.fit = 'contain'; c.tr.scale = round(Math.min(targetH / (ch * fit), maxW / (cw * fit)), 3);
    const drawnH = ch * fit * c.tr.scale, drawnW = cw * fit * c.tr.scale;
    c.tr.y = round(S.h / 2 - drawnH / 2 + (mode === 'corpo' ? -S.h * .03 : 0), 1);
    c.tr.x = side === 'esq' ? round(-S.w / 2 + drawnW / 2 + S.w * .04, 1) : side === 'dir' ? round(S.w / 2 - drawnW / 2 - S.w * .04, 1) : c.tr.x || 0;
    for (const k of ['tr.scale', 'tr.y']) if (c.kf?.[k]) delete c.kf[k];
    c.frame = { mode, side: side || c.frame?.side || 'meio' };
    if (mode === 'corpo') delete c.extend; else c.extend = true; // o corpo continua abaixo da tela
    return true;
  },
  menu(clips) {
    const on = clips.some(c => c.extend);
    return Object.entries(FRAMES).map(([k, f]) => ({ label: f.l, checked: clips.length === 1 && clips[0].frame?.mode === k, action: () => { let n = 0; clips.forEach(c => { if (this.apply(c, k, c.frame?.side)) n++; }); if (n) App.commit(`Enquadramento: ${f.l}`, { toast: true }); else UI.toast('Funciona em imagens/vídeos de personagem.', { kind: 'warn' }); } }))
      .concat(['-', ...['esq', 'meio', 'dir'].map(sd => ({ label: { esq: 'Lado esquerdo', meio: 'No meio', dir: 'Lado direito' }[sd], checked: clips.length === 1 && clips[0].frame?.side === sd, action: () => { clips.forEach(c => this.apply(c, c.frame?.mode || 'cintura', sd)); App.commit('Lado do personagem', { toast: true }); } })),
        '-', { label: 'Corpo continua abaixo da tela (sem corte vazio)', checked: on, action: () => { clips.forEach(c => { if (on) delete c.extend; else c.extend = true; }); App.commit(on ? 'Corte normal' : 'Corpo continua abaixo da tela', { toast: true }); } }]);
  },
};

/* ---------- biblioteca de sons reais (fica salva no navegador e vale para todos os projetos) ---------- */
const COMMON_SFX = [
  ['censor beep', 'Beep de censura', 'meme'], ['rewind', 'Rebobinar', 'transição'], ['swish', 'Swish (troca rápida)', 'transição'], ['impact', 'Impacto cartoon', 'impacto'], ['crowd laugh', 'Risada curta de plateia', 'meme'],
  ['vine boom', 'Vine boom (impacto grave)', 'impacto'], ['bruh', 'Bruh', 'meme'], ['sad trombone', 'Trombone triste (fail)', 'meme'], ['record scratch', 'Disco arranhando (parada brusca)', 'meme'],
  ['bonk', 'Bonk (pancada na cabeça)', 'cartoon'], ['boing', 'Boing (pulo)', 'cartoon'], ['slide whistle', 'Apito subindo/descendo', 'cartoon'], ['cartoon run', 'Corrida de desenho', 'cartoon'],
  ['punch', 'Soco', 'impacto'], ['whoosh', 'Whoosh (passagem)', 'transição'], ['pop', 'Pop (aparecer)', 'cartoon'], ['ding', 'Ding (ideia/acerto)', 'ui'],
  ['wrong buzzer', 'Buzina de erro', 'ui'], ['correct', 'Acertou', 'ui'], ['crickets', 'Grilos (silêncio constrangedor)', 'meme'], ['laugh track', 'Risada de plateia', 'meme'],
  ['rimshot', 'Ba-dum-tss', 'meme'], ['dramatic', 'Suspense dramático (dun dun dun)', 'meme'], ['wow', 'Wow / uau', 'meme'], ['emotional damage', 'Emotional damage', 'meme'],
  ['fart', 'Pum', 'meme'], ['glass break', 'Vidro quebrando', 'impacto'], ['explosion', 'Explosão', 'impacto'], ['scream', 'Grito', 'reação'],
  ['gasp', 'Susto (respiração)', 'reação'], ['heartbeat', 'Batimento', 'tensão'], ['typing', 'Digitando', 'ui'], ['notification', 'Notificação', 'ui'],
  ['camera shutter', 'Foto (câmera)', 'ui'], ['magic', 'Brilho mágico', 'cartoon'], ['fail', 'Fail / derrota', 'meme'], ['victory', 'Vitória / fanfarra', 'meme'],
];
const SoundLib = {
  PID: '__lib_sons__',
  loaded: false,
  async load() { try { await Assets.loadProjectAssets(this.PID); this.loaded = true; } catch { } },
  list() { return Assets.list(this.PID).filter(a => a.kind === 'audio'); },
  guess(name) { const n = name.toLowerCase(); const hit = COMMON_SFX.find(([k]) => n.includes(k) || n.replace(/[-_]/g, ' ').includes(k)); return hit ? hit[2] : 'outros'; },
  async add(files) {
    let n = 0;
    for (const f of files) { if (Assets.kindOf(f) !== 'audio') continue; const rt = await Assets.addBlob(f, f.name, this.PID, 'audio'); if (!rt.error) { rt.meta.cat = this.guess(f.name); n++; } }
    UI.toast(n ? `${n} som(ns) guardado(s) na sua biblioteca (vale para todos os projetos)` : 'Nenhum áudio encontrado nos arquivos.', { kind: n ? 'ok' : 'warn' });
    if (typeof LibUI !== 'undefined') LibUI.render();
  },
  async remove(id) { await Assets.remove(id); LibUI.render(); },
  find(q) { const n = String(q || '').replace(/^lib:/, '').toLowerCase(); const l = this.list(); return l.find(a => a.id === n) || l.find(a => a.name.toLowerCase().replace(/\.[^.]+$/, '') === n) || l.find(a => a.name.toLowerCase().includes(n)); },
  // copia o som para dentro do projeto (assim ele vai junto no .toon)
  async toProject(libId) {
    const p = App.project, a = Assets.get(libId); if (!a) return null;
    p.libMap ||= {}; if (p.libMap[libId] && Assets.meta(p.libMap[libId])) return p.libMap[libId];
    const rt = await Assets.addBlob(a.blob, a.meta.name, p.id, 'audio'); p.bin.push(rt.meta.id);
    const f = (p.folders ||= []).find(x => x.name === 'Sons') || (() => { const nf = { id: uid('f_'), name: 'Sons' }; p.folders.push(nf); return nf; })();
    (p.assetFolders ||= {})[rt.meta.id] = f.id; p.libMap[libId] = rt.meta.id;
    return rt.meta.id;
  },
  forPrompt() { const l = this.list(); return l.length ? 'SONS REAIS DA BIBLIOTECA DO USUÁRIO (prefira estes; use "som":"lib:ID"):\n' + l.slice(0, 120).map(a => `lib:${a.id} "${a.name.replace(/\.[^.]+$/, '')}"${a.dur ? ' ' + round(a.dur, 1) + 's' : ''}`).join('\n') : ''; },
  section(b) {
    const l = this.list();
    const s = h(`<div class="sec-lib"><div class="lgroup" style="display:flex;align-items:center;gap:6px">Minha biblioteca de sons (${l.length})<span style="flex:1"></span><button class="ibtn xs" data-a="add" title="Adicionar sons reais (mp3, wav, ogg…)">${ic('plus', 12)} Sons</button></div>
      <div class="hint" style="margin:0 0 8px">${ic('info', 12)} Coloque aqui os sons reais que você usa (vine boom, bruh, bonk…). Ficam guardados neste navegador para <b>todos os projetos</b>, e a IA usa eles. Arraste arquivos para cá também. Use sons que você tem direito de usar (ex.: bancos gratuitos como Pixabay/Freesound).</div></div>`);
    $('[data-a=add]', s).onclick = async () => { const f = await pickFiles('audio/*,.mp3,.wav,.ogg,.m4a'); if (f.length) this.add(f); };
    s.ondragover = e => { e.preventDefault(); s.classList.add('over'); }; s.ondragleave = () => s.classList.remove('over');
    s.ondrop = e => { e.preventDefault(); e.stopPropagation(); e._handled = true; s.classList.remove('over'); if (e.dataTransfer.files.length) this.add([...e.dataTransfer.files]); };
    for (const a of l.filter(a => LibUI.match(a.name))) {
      const el = h(`<button class="lbtn"><div class="lb-prev" style="background:#3a2a1d;color:#ffb85f" data-p>${ic('play', 16)}</div><div style="flex:1;min-width:0"><b style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block">${esc(a.name.replace(/\.[^.]+$/, ''))}</b><small>${a.dur ? fmtSec(a.dur) : ''} · real</small></div><span class="ibtn xs" data-add title="Colocar no cursor">${ic('plus', 13)}</span></button>`);
      $('[data-p]', el).onclick = e => { e.stopPropagation(); AudioEngine.preview(a.id); };
      el.onclick = () => AudioEngine.preview(a.id);
      $('[data-add]', el).onclick = async e => { e.stopPropagation(); const id = await this.toProject(a.id); if (id) Actions.addAssetAt(id, App.t); };
      el.oncontextmenu = e => { e.preventDefault(); UI.ctx(e.clientX, e.clientY, [{ head: a.name }, { label: 'Colocar no cursor', icon: 'plus', action: async () => { const id = await this.toProject(a.id); if (id) Actions.addAssetAt(id, App.t); } }, { label: 'Tirar da biblioteca', icon: 'trash', danger: true, action: () => this.remove(a.id) }]); };
      el.draggable = true; el.addEventListener('dragstart', async e => { e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'libsound', id: a.id })); LibUI.dragKind = 'asset'; });
      s.appendChild(el);
    }
    const miss = COMMON_SFX.filter(([k]) => !l.some(a => a.name.toLowerCase().replace(/[-_]/g, ' ').includes(k)));
    if (miss.length) s.appendChild(h(`<details class="sfx-miss"><summary>Sons mais usados nesse tipo de vídeo que ainda faltam (${miss.length})</summary><div>${miss.map(([k, n]) => `<span class="chip static" title="Nomeie o arquivo com '${k}' para o editor reconhecer">${esc(n)}</span>`).join('')}</div></details>`));
    b.appendChild(s);
    b.appendChild(h(`<div class="lgroup" style="margin-top:10px">Sons prontos do editor</div>`));
  },
};

/* ---------- boca sincronizada: troca para a imagem de "boca aberta" quando a voz está tocando ---------- */
const Mouth = {
  cache: new Map(),
  env(ac) { const e = AudioAnalysis.envelope(ac); if (!e) return null; let k = this.cache.get(e); if (!k) { const s = Array.from(e.env).sort((a, b) => a - b); k = s[Math.floor(s.length * .9)] || 1e-4; this.cache.set(e, k); } return { ...e, p90: k }; },
  open(clip, lt) {
    const b = clip.boca; if (!b || !b.midia) return false;
    const t = clip.start + lt, list = b.audio ? [App.clip(b.audio)].filter(Boolean) : AudioAnalysis.sources();
    for (const ac of list) {
      if (t < ac.start || t > ac.start + ac.dur) continue;
      const e = this.env(ac); if (!e) continue;
      const i = Math.floor((t - e.start) * e.rate), v = Math.max(e.env[i] || 0, e.env[i - 1] || 0);
      if (v > e.p90 * (b.limite ?? .35)) return true;
    }
    return false;
  },
  async dialog(c) {
    const imgs = Assets.list(App.project.id).filter(a => a.kind === 'image' && a.id !== c.assetId), auds = App.project.clips.filter(x => x.type === 'audio' || (x.type === 'video' && Assets.meta(x.assetId)?.hasAudio));
    if (!imgs.length) return UI.toast('Importe a imagem do personagem com a boca aberta primeiro.', { kind: 'warn' });
    const f = h(`<div class="fgrid"><p class="full" style="margin:0">Enquanto a voz estiver tocando, o personagem troca para a imagem de <b>boca aberta</b> (e volta quando a voz para) — o jeito clássico de "falar" desses desenhos.</p>
      <label class="field full">Imagem com a boca aberta<select data-k="midia">${imgs.map(a => `<option value="${a.id}" ${c.boca?.midia === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <label class="field full">Voz<select data-k="audio"><option value="">Qualquer voz da linha do tempo</option>${auds.map(a => `<option value="${a.id}" ${c.boca?.audio === a.id ? 'selected' : ''}>${esc(a.name || 'áudio')} (${fmtSec(a.start)})</option>`).join('')}</select></label>
      <label class="field full">Sensibilidade (menor = abre mais fácil)<input type="range" min="0.1" max="1" step="0.05" data-k="limite" value="${c.boca?.limite ?? .35}"></label></div>`);
    const o = await UI.modal({ title: 'Boca falando', icon: 'mic', width: 480, body: f, buttons: [{ label: 'Tirar', left: true, value: 'off' }, { label: 'Cancelar', value: null }, { label: 'Aplicar', kind: 'primary', collect: () => Actions.readForm(f) }] });
    if (o === 'off') { delete c.boca; App.commit('Boca falando desligada', { toast: true }); return; }
    if (!o) return;
    c.boca = { midia: o.midia, audio: o.audio || null, limite: +o.limite };
    App.commit('Boca falando ligada', { toast: true });
  },
};

/* ---------- fundos com padrão que se repete para sempre (bolinhas, quadrados, xadrez…) ---------- */
const PATTERNS = {
  bolinhas: 'Bolinhas (polka dots)', bolinhasGrade: 'Bolinhas alinhadas', quadrados: 'Quadradinhos', xadrez: 'Xadrez', xadrezToalha: 'Xadrez de toalha (piquenique)',
  listras: 'Listras', diagonais: 'Listras diagonais', grade: 'Grade (linhas)', cruzes: 'Cruzinhas (+)', estrelas: 'Estrelas', coracoes: 'Corações',
  losangos: 'Losangos', triangulos: 'Triângulos', zigueZague: 'Zigue-zague', ondas: 'Ondas', circulos: 'Círculos (anéis)', confete: 'Confete', espiral: 'Hipnose (espiral)',
};
const PatternBG = {
  DEF: () => ({ mode: 'pattern', padrao: 'bolinhas', c1: '#7b4dff', c2: '#9b78ff', size: 120, speed: 40, dir: 135, rot: 0, scale2: .22 }),
  cache: new Map(),
  // um "azulejo" do padrão (P×P) — repetido infinitamente
  tile(f) {
    const P = Math.max(8, Math.min(600, Math.round(f.size || 120))), key = [f.padrao, f.c1, f.c2, P, f.scale2, !!f.c3, f.alpha ?? 1].join('|');
    let cv = this.cache.get(key); if (cv) return cv;
    if (this.cache.size > 60) this.cache.clear();
    cv = document.createElement('canvas'); cv.width = cv.height = P; const g = cv.getContext('2d'), k = f.scale2 ?? .22, A = f.c2;
    if (!f.c3) { g.fillStyle = f.c1; g.fillRect(0, 0, P, P); } g.fillStyle = A; g.globalAlpha = f.alpha ?? 1; g.strokeStyle = A; g.lineCap = 'round'; g.lineJoin = 'round';
    const dot = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    const each = (fn, pts) => pts.forEach(([x, y]) => [-P, 0, P].forEach(dx => [-P, 0, P].forEach(dy => fn(x + dx, y + dy))));
    const star = (x, y, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * .45 : r, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    const heart = (x, y, r) => { g.beginPath(); g.moveTo(x, y + r * .8); g.bezierCurveTo(x - r * 1.3, y, x - r * .7, y - r * 1, x, y - r * .35); g.bezierCurveTo(x + r * .7, y - r * 1, x + r * 1.3, y, x, y + r * .8); g.fill(); };
    switch (f.padrao) {
      case 'bolinhas': each((x, y) => dot(x, y, P * k), [[P * .25, P * .25], [P * .75, P * .75]]); break;
      case 'bolinhasGrade': each((x, y) => dot(x, y, P * k * 1.2), [[P / 2, P / 2]]); break;
      case 'quadrados': { const s = P * k * 1.8; g.fillRect(P / 2 - s / 2, P / 2 - s / 2, s, s); break; }
      case 'xadrez': g.fillRect(0, 0, P / 2, P / 2); g.fillRect(P / 2, P / 2, P / 2, P / 2); break;
      case 'xadrezToalha': { g.globalAlpha = .5; g.fillRect(0, 0, P / 2, P); g.fillRect(0, 0, P, P / 2); g.globalAlpha = 1; g.fillRect(0, 0, P / 2, P / 2); break; }
      case 'listras': g.fillRect(0, 0, P, P / 2); break;
      case 'diagonais': { g.lineWidth = P * .5 / Math.SQRT2; for (const o of [-P, 0, P]) { g.beginPath(); g.moveTo(o - P, P + P); g.lineTo(o + P + P, -P); g.stroke(); } g.lineCap = 'butt'; break; }
      case 'grade': g.lineWidth = Math.max(1, P * k * .3); g.strokeRect(0, 0, P, P); break;
      case 'cruzes': { const L = P * k * 1.4, w = Math.max(2, P * k * .45); g.fillRect(P / 2 - L / 2, P / 2 - w / 2, L, w); g.fillRect(P / 2 - w / 2, P / 2 - L / 2, w, L); break; }
      case 'estrelas': each((x, y) => star(x, y, P * k * 1.1), [[P * .25, P * .25], [P * .75, P * .75]]); break;
      case 'coracoes': each((x, y) => heart(x, y, P * k), [[P * .25, P * .28], [P * .75, P * .78]]); break;
      case 'losangos': g.beginPath(); g.moveTo(P / 2, 0); g.lineTo(P, P / 2); g.lineTo(P / 2, P); g.lineTo(0, P / 2); g.closePath(); g.fill(); break;
      case 'triangulos': g.beginPath(); g.moveTo(0, P); g.lineTo(P / 2, 0); g.lineTo(P, P); g.closePath(); g.fill(); break;
      case 'zigueZague': { g.lineWidth = P * k * .6; g.beginPath(); g.moveTo(-P / 4, P * .75); for (let i = 0; i <= 6; i++) g.lineTo(-P / 4 + i * P / 4, i % 2 ? P * .25 : P * .75); g.stroke(); break; }
      case 'ondas': { g.lineWidth = P * k * .6; for (const o of [0, P]) { g.beginPath(); for (let x = -2; x <= P + 2; x += 2) g.lineTo(x, o + P / 2 + Math.sin(x / P * Math.PI * 2) * P * .18); g.stroke(); } break; }
      case 'circulos': g.lineWidth = Math.max(2, P * k * .35); each((x, y) => { g.beginPath(); g.arc(x, y, P * .3, 0, 7); g.stroke(); }, [[P / 2, P / 2]]); break;
      case 'confete': { const R = (i) => (Math.sin(i * 127.1 + P) * 43758.5453) % 1; for (let i = 0; i < 9; i++) { const x = Math.abs(R(i)) * P, y = Math.abs(R(i + 30)) * P, a = R(i + 60) * 6; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = [A, '#ffde26', '#ff4f8b', '#3ee0b5', '#ffffff'][i % 5]; g.fillRect(-P * k * .5, -P * k * .18, P * k, P * k * .36); g.restore(); } break; }
      case 'espiral': break; // desenhado à parte (não é azulejo)
    }
    this.cache.set(key, cv); return cv;
  },
  // desenha no retângulo b; t = segundos (faz o padrão andar)
  draw(c, f, b, t) {
    if (f.padrao === 'espiral') {
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.hypot(b.w, b.h) / 2, n = 16, rot = t * (f.speed || 40) / 60;
      c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip(); c.fillStyle = f.c1; c.fillRect(b.x, b.y, b.w, b.h); c.fillStyle = f.c2;
      for (let i = 0; i < n; i += 2) { c.beginPath(); c.moveTo(cx, cy); for (let r = 0; r <= R; r += 8) { const a = rot + i / n * Math.PI * 2 + r / (f.size || 120); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } for (let r = R; r >= 0; r -= 8) { const a = rot + (i + 1) / n * Math.PI * 2 + r / (f.size || 120); c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); c.fill(); }
      c.restore(); return;
    }
    if (f.c3) { const g = c.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, f.c1); g.addColorStop(1, f.c3); c.fillStyle = g; c.fillRect(b.x, b.y, b.w, b.h); }
    if (f.pulse > 0 && /^bolinhas/.test(f.padrao)) { this.pulseDots(c, f, b, t); this.extras(c, f, b, t); return; }
    const tile = this.tile(f), P = tile.width, pat = c.createPattern(tile, 'repeat');
    const d = (f.dir ?? 135) * Math.PI / 180, dist = t * (f.speed || 0), ox = ((Math.cos(d) * dist) % P + P) % P, oy = ((Math.sin(d) * dist) % P + P) % P;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.hypot(b.w, b.h) / 2 + P;
    c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip();
    c.translate(cx, cy); c.rotate((f.rot || 0) * Math.PI / 180); c.translate(ox - R, oy - R);
    c.fillStyle = pat; c.fillRect(-P, -P, 2 * R + 2 * P, 2 * R + 2 * P); c.restore();
    this.extras(c, f, b, t);
  },
  // bolinhas que pulsam (tamanho e brilho), andando sem fim — como no fundo do Shorts
  pulseDots(c, f, b, t) {
    const P = Math.max(16, f.size || 120), d = (f.dir ?? 135) * Math.PI / 180, dist = t * (f.speed || 0), ox = ((Math.cos(d) * dist) % (P * 2) + P * 2) % (P * 2), oy = ((Math.sin(d) * dist) % (P * 2) + P * 2) % (P * 2);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.hypot(b.w, b.h) / 2 + P * 2, k = f.scale2 ?? .22, pu = f.pulse;
    c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip(); c.translate(cx, cy); c.rotate((f.rot || 0) * Math.PI / 180); c.fillStyle = f.c2;
    const grid = f.padrao === 'bolinhasGrade';
    for (let row = Math.floor(-R / P) - 2; row <= R / P + 2; row++) for (let col = Math.floor(-R / P) - 2; col <= R / P + 2; col++) {
      const x = col * P + (!grid && row % 2 ? P / 2 : 0) + ox - P, y = row * P + oy - P, ph = row * .7 + col * 1.3;
      const r = P * k * (1 + pu * .45 * Math.sin(t * 3.2 + ph)); c.globalAlpha = (f.alpha ?? 1) * Math.max(.05, Math.min(1, 1 - pu * .35 + pu * .3 * Math.sin(t * 2 + ph * 1.7)));
      c.beginPath(); c.arc(x, y, Math.max(1, r), 0, 7); c.fill();
    }
    c.restore();
  },
  // bolhas grandes subindo + vinheta (profundidade)
  extras(c, f, b, t) {
    if (f.bolhas) {
      c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip(); c.fillStyle = '#ffffff';
      const S = Math.max(b.w, b.h) / 1920;
      for (let i = 0; i < 9; i++) { const br = (60 + hash(i + 1) * 80) * S * 1.4, sp = (25 + hash(i + 2) * 45) * S * 1.4, x = b.x + hash(i + 3) * b.w + 40 * S * Math.sin(t * .8 + i), y = b.y + ((hash(i + 4) * (b.h + 300 * S) - t * sp) % (b.h + 300 * S) + b.h + 300 * S) % (b.h + 300 * S) - 150 * S; c.globalAlpha = .09; c.beginPath(); c.arc(x, y, br, 0, 7); c.fill(); }
      c.restore();
    }
    if (f.vinheta) { const g = c.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * .35, b.x + b.w / 2, b.y + b.h / 2, Math.hypot(b.w, b.h) * .6); g.addColorStop(0, 'rgba(15,5,45,0)'); g.addColorStop(1, 'rgba(15,5,45,.5)'); c.save(); c.fillStyle = g; c.fillRect(b.x, b.y, b.w, b.h); c.restore(); }
  },
};
