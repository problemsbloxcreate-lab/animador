# Cenários em CAMADAS — como fazer um cenário novo e salvar no Animador

O cenário de referência é o **Planetário do Problems** (`cenarios/planetario/`). Todo cenário novo pedido ao Claude
é feito **do mesmo jeito** e entra na janela **Cenários** do Animador (`js/cenlib.js`).

## O estilo (pintado azul com profundidade)
- Pintado com luz: parede com degradê (escuro embaixo à esquerda, claro em cima à direita), pinceladas leves, chão em perspectiva.
- Profundidade de verdade: um ponto de fuga para estantes, caixas e móveis (lateral e topo fugindo para ele), sombras projetadas
  borradas, brilho fino na borda do lado da luz, contorno escuro fino (#0f1433), primeiro plano desfocado (mesa, caneca, caderno).
- A MESMA luz ambiente em todas as camadas (degradê de luz × vinheta, brilho ciano no alto à direita, tinta azul nos escuros).
- Respiro: cena limpa, poucos detalhes e significativos. Sem camisetas, sem luzinhas, sem brilho de janela (regras do dono).
- O poder do Problems é **gelo**: coisas de gelo combinam.
- Imagens que o dono manda (bonecos, capa do livro, fotos, artes dos personagens) entram **originais**, nunca recriadas.

## Cada objeto é uma camada
- Uma camada por objeto (estante, cada boneco, cada globo, quadro, caneca…). Assim a equipe move, esconde e anima cada um.
- **Vetor (SVG) para o que é desenho**, PNG para o que é foto/arte de verdade (bonecos, a Lumi).
- **Regra do dono: tem que ficar IGUAL.** Toda camada SVG é comparada com a versão pintada (PNG) pixel a pixel; se o SVG
  ficar diferente (textura pintada, geada borrada, letras, estrelas sorteadas…), a camada fica **PNG**. No Planetário ficaram PNG:
  parede e chão, gelo na parede, floco, carta, caderno e o quadro da Terra (além das fotos). O quadro do planeta azul e a
  Terra de foto da cúpula ficaram de fora: vinham de uma foto de banco de imagens (a cúpula ganhou uma Terra em vetor).
- Variações e testes viram **camadas desligadas** (`"oculta": true`), nunca camadas apagadas: o dono testa e muda de ideia rápido.

## O pacote
```
cenarios/<id>/cenario.json      o padrão do cenário
cenarios/<id>/camadas/*.svg|png uma imagem por camada, do tamanho w×h em que ela aparece na tela 1920×1080
cenarios/<id>/miniatura.jpg     480×270
cenarios/biblioteca.json        a lista dos cenários da casa (acrescente o novo aqui)
```
`cenario.json`:
```json
{ "formato": "cenario-camadas", "v": 1, "id": "planetario", "nome": "Planetário do Problems", "estilo": "pintado-azul",
  "tags": ["quarto"], "w": 1920, "h": 1080, "miniatura": "miniatura.jpg",
  "cena": { "luz": 100, "con": 100, "sat": 100, "mat": 0 },
  "camadas": [ { "id": "estante", "nome": "Estante", "arq": "camadas/estante.svg", "tipo": "svg", "w": 611, "h": 800,
                 "cx": 403, "cy": 569, "s": 1, "r": 0, "flip": false, "oculta": false, "trava": false,
                 "fx": { "luz": 139, "con": 100, "sat": 100, "mat": 0 } } ] }
```
- Camadas **de trás para a frente**. `cx/cy` = centro na tela, `s` = escala sobre `w×h`, `r` = giro em graus, `fx` = cor e luz
  (iluminação/contraste/saturação em %, matiz em graus; é o mesmo `filter` do editor do Planetário).
- O SVG tem `width`/`height` = `w`/`h` (o Animador desenha no tamanho da tela, nítido no zoom) e **não carrega nada de fora**
  (fotos embutidas em base64, letras viradas contorno: SVG dentro de `<img>` não abre fontes nem links).

## Como gerar (ferramentas em `cenarios/ferramentas/`)
1. Desenhe com `svglib.py` (as mesmas funções do estilo: `estante`, `caixa`, `poli`, `sombra`, `borda_luz`, `traco`, `vg/hg`,
   `imagem` para fotos, `texto` vira contorno) — veja `planetario_svg.py` como exemplo completo. A luz ambiente vai sozinha
   em cada camada (`luz_ambiente`: filtro com `feImage` + `feComposite` aritmético, sem halo nas bordas).
   (`planetario_svg.py` roda dentro da pasta do pacote do Planetário, que tem as imagens originais e as PNG pintadas.)
2. Rasterize e compare com a PNG pintada: `node rasteriza.js <saida> <rast>` e `sh medir.sh` (média da diferença por camada
   e o desvio de cor); `python3 lado.py <ids>` faz o lado a lado. Olhe as imagens: o que não ficar igual vai como PNG.
3. Monte o `cenario.json` (a arrumação que a equipe fez no editor vira o padrão: `cx, cy, s, r, flip, fx`, z = ordem)
   e gere a miniatura com `node padrao.js cenarios/<id> saida.png` (desenha o padrão com os filtros, igual ao Animador).
4. Acrescente em `cenarios/biblioteca.json` e publique.

## No Animador (janela Cenários — `js/cenlib.js`)
- Biblioteca: **Nesta animação**, **Da casa** (este repositório), **Meus** (neste computador: variações, cenários montados com
  imagens, arquivos `.cenario` abertos) e os **Rabiscados** antigos (viram camadas PNG). Busca e etiquetas (`tags`).
- Fora da cena a janela edita o **padrão** do cenário (mover, tamanho, giro, espelhar, opacidade, cor e luz por camada e da
  cena inteira, ordem arrastando). **Pôr na cena** cria uma PASTA de cenário com uma camada de imagem por camada.
- Na cena (botão direito no cenário › **Cenário: padrão e keyframes…**): **Padrão** muda a camada em todos os quadros (a
  diferença vai para todas as chaves dela) e **Neste keyframe** muda só deste quadro até o próximo keyframe do cenário
  (o próximo segura o valor de antes). Os keyframes do cenário aparecem em fila; "Ir mudando entre os keyframes" liga o interp.
- A cor e a luz ficam na chave (`chave.fx`, `Modelo.fxNo`, desenhadas em `Render.umNo` com `ctx.filter`; a da pasta vale para
  tudo dentro dela).

## Gerador oficial no Animador (rascunho)
- A janela Cenários (e o passo Cenários do Roteiro) tem **Gerar › Oficial (pintado)**: a IA descreve o lugar em formas simples e
  `js/cenoficial.js` desenha cada objeto como camada SVG com as mesmas regras deste guia (parede/chão com ponto de fuga, sombra,
  borda de luz, contorno #0f1433, desfoque do primeiro plano, luz ambiente). Sai como **rascunho para aprovar** (`aprovar: true`).
- É um rascunho rápido: um cenário que vai para a casa (`cenarios/<id>/`) continua sendo feito/acabado à mão por este guia.
- **De representação** = rabiscado (`ESTILO.md`), para lugares de passagem; gerado pela IA antiga e salvo como camadas PNG.
