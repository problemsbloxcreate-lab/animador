# Estilo dos cenários do Animador — rabiscado imperfeito

Cenários de fundo simples com cara de **rascunho feito à mão**, para combinar com os personagens.
O estilo antigo (feltro/giz) foi abandonado. Os prontos daqui (`*.json`) foram aprovados pelo dono e são os exemplos que a
IA do Animador usa para aprender (o texto que ensina a IA está em `js/cenarios.js`, em `Cenarios.SIS`).

## Como é o estilo
- Cores chapadas pastéis um pouco apagadas, vista de frente (sem perspectiva, sem sombra realista).
- **Nada reto**: cada canto sai um pouco fora do lugar, os lados têm barriga e tremem de leve; curvas ficam irregulares mas suaves.
- Contorno na **mesma cor do objeto, mais escura**, riscado lado a lado e passando um pouco do canto; às vezes um 2º risco leve.
- A pintura fica levemente fora do registro do contorno; hachuras diagonais soltas nas áreas grandes; brilho riscado no vidro.
- Nuvem, copa de árvore e arbusto são **uma forma só** (`nuvem`, `copa`), nunca bolas sobrepostas. Sem florzinhas espalhadas no chão.
- Composição para animação: chão livre embaixo (y ≈ 780–1080), centro sem poluição, 3 a 7 objetos principais.
Tudo isso é feito pelo desenho (`Cenarios.camada`); o JSON só descreve formas limpas.

## Formato
Sempre 1920×1080, camadas de trás para a frente:
`{ "nome": "...", "total": N, "camadas": [ { "o": "Objeto", "c": "#cor", "l": 0, "h": 0-3, "v": 1, "f": [formas] }, { "degrade": { "de", "ate", "cor", "forca" } } ] }`
- `"o"` marca o começo de um objeto; as camadas seguintes são dele até o próximo `"o"`. Cada objeto vira uma **peça** separada.
- `"l": 0` sem contorno · `"h"` hachuras (automático nas áreas grandes) · `"v": 1` vidro com brilho.
- Formas: `["ret",x0,y0,x1,y1]`, `["red",x0,y0,x1,y1,raio]`, `["elipse",x0,y0,x1,y1]`, `["poli",x,y,…]`, `["linha",esp,x,y,…]`,
  `["anel",x0,y0,x1,y1,esp]`, `["arco",x0,y0,x1,y1,grau0,grau1,esp]`, `["nuvem",cx,cy,escala]`, `["copa",cx,cy,rx,ry,calombos]`.

## Para pôr um cenário novo entre os prontos
Salve o JSON aqui, uma miniatura 384×216 em `miniaturas/<id>.jpg` e acrescente `{ id, nome }` em `Cenarios.PRONTOS`.
