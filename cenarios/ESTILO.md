# Estilo dos cenários do Animador

Cenários de fundo simples, todos com a mesma cara, para combinar com os personagens de contorno preto grosso.
Os prontos daqui (`*.json`) foram aprovados pelo dono e são os exemplos que a IA do Animador usa para aprender o estilo
(o texto que ensina a IA está em `js/cenarios.js`, em `Cenarios.SIS`).

## Como é o estilo
- Ilustração chapada de feltro / giz pastel: formas geométricas simples, **sem contorno**, sem sombra realista e **sem perspectiva** (vista de frente, como cenário de teatro).
- Bordas felpudas e irregulares, mas **nítidas** (sem desfoque); granulado leve dentro de cada cor e um grão fino por cima. Isso é o acabamento do desenho (`Cenarios.desenhar`), não precisa ser desenhado à mão.
- Cores pastéis um pouco apagadas: parede creme, piso creme com faixas, céu azul-claro com degradê no horizonte, madeira marrom quente, verdes de folha; destaques pequenos em vermelho, rosa e amarelo.
- Detalhes pequenos dão a graça: risco escuro dividindo portas, puxadores redondos, reflexo diagonal no vidro, faixas no piso, flores de quatro pétalas.
- Composição pensada para animação: faixa de chão livre embaixo (y ≈ 760–1080) para os personagens andarem, centro sem poluição, 3 a 6 elementos principais.

## Formato
Sempre 1920×1080, camadas de trás para a frente:
`{ "nome": "...", "total": N, "camadas": [ { "o": "Objeto", "c": "#cor", "t": granulado, "b": borda, "f": [formas] }, { "degrade": { "de", "ate", "cor", "forca" } } ] }`

`"o"` marca o começo de um objeto (Fundo, Janela, Sofá…): as camadas seguintes são dele até o próximo `"o"`. Cada objeto vira uma **peça** separada (PNG transparente recortado, com a posição no cenário), que dá para pôr na cena em camadas, mandar para a Mídia ou baixar. Escreva cada objeto inteiro de uma vez. `"total"` é quantas camadas vêm (para o tempo que falta).
Formas: `["ret",x0,y0,x1,y1]`, `["red",x0,y0,x1,y1,raio]`, `["elipse",x0,y0,x1,y1]`, `["poli",x,y,…]`,
`["linha",esp,x,y,…]`, `["anel",x0,y0,x1,y1,esp]`, `["arco",x0,y0,x1,y1,grau0,grau1,esp]`.
`t` padrão 10 (6–12; 4–7 em detalhes), `b` padrão 4 (1 no fundo inteiro; 2–3 em detalhes pequenos).

## Para pôr um cenário novo entre os prontos
Salve o JSON aqui, uma miniatura 384×216 em `miniaturas/<id>.jpg` e acrescente `{ id, nome }` em `Cenarios.PRONTOS`.
