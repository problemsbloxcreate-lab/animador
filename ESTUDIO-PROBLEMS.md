# Estúdio Problems — módulo Animação

Este programa é o módulo **Animação** do Estúdio Problems (editor de vídeo + PNGtuber + bonecos com ossos).
O Estúdio Problems de Minecraft (Shorts / Edição) ainda está sendo feito; quando ficar pronto, os dois se juntam.

## O que já está pronto para a unificação
- `js/config.js` → `ESTUDIO` (nome e módulo mostrados no título, login e telas).
- `js/estudio.js` → `EstudioModulos`:
  - `lista`: módulos (Animação, Shorts, Edição). Para ligar um, troque `url` e `pronto: true`.
  - barra de módulos na tela inicial (`html()` / `bind()`), hoje com Shorts/Edição "em breve".
  - `ponte`: formato de troca de personagem entre módulos (`estudio-problems/personagem`) e escuta de
    `postMessage` (desligada: `ligado: false`, `origensPermitidas: []`).
- Projetos: IndexedDB `turma-studios`, arquivo `.toon` (zip: `toon.json`, `projeto.json`, `midias.json`).
  Clipes de personagem têm `type: 'anim'` e `anim: { P: { settings, frames, rigs, camera } }`.

## Passos sugeridos quando o Estúdio Problems estiver pronto
1. Decidir se fica um site só (rotas) ou dois sites com o mesmo login.
2. Preencher `EstudioModulos.lista.shorts/edicao.url` e `pronto: true`.
3. Se for em janelas/iframes, ligar `ponte.ligado` e pôr a origem em `origensPermitidas`.
4. Manter o login com Google + checagem no servidor (veja SEGURANCA.md) — nada de abrir sem login.

Os nomes internos (banco `turma-studios`, servidor `turma-ia`, chaves `ps-*`) ficaram iguais de propósito,
para não perder projetos nem configurações.

## Ícone e logo (exclusivos do módulo Animação)
- `icones/` (icone-192/512, maskable, simbolo.svg, turma.ico) e o logo roxo/verde-água são **só do módulo Animação**.
- Na unificação **não substitua** o ícone/logo do Estúdio Problems (editor de Minecraft): o app unificado usa o ícone dele; este fica apenas no seletor de módulos / tela da Animação (renomeie a pasta para `icones/animacao/` ao juntar).

## Tema (js/tema.js)
- Tema e cor de destaque ficam em `localStorage['ep-tema']` ({tema, cor}). Pode ser o mesmo módulo para o Estúdio Problems inteiro.

## Ossos "No vídeo"
- Vindo do editor (`animar.html?ed=&c=&t=`), o estúdio abre no MESMO quadro do editor e mostra o boneco no MESMO lugar do vídeo (Studio.ctx, clipM, bgFrame). "Separado" é opcional.
