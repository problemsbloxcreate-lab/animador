# Animador — instruções para o Claude
- Português. Nunca chaves, senhas ou e-mails no código ou nos textos do repositório (ele é público: nada de detalhes de segurança aqui).
- O acesso é só pelo login do Google do menu do Estúdio Problems: não remova nem contorne `TurmaAuth.gate()` (js/home.js) e não crie bypass/modo teste.
- Padrão de todos os projetos do Estúdio: nome em MAIÚSCULAS no cabeçalho, `/estudio-conta.js` com `<span data-estudio-conta>`, ícones de linha (sem emoji), espaço no navegador registrado em `EstudioConta.espaco`.
- Publicar = commit + `git pull --rebase` + push na `main` (o GitHub Pages publica a raiz), só quando o dono pedir.
- Conferir antes do push: `for f in js/*.js; do node --check "$f"; done`.

## Estrutura
- `js/modelo.js` dados (projeto, camadas, personagem por partes) e o cálculo de cada quadro · `js/desenho.js` desenha · `js/app.js` editor e palco
- `js/arvore.js` hierarquia · `js/folha.js` timeline · `js/lado.js` painel da direita · `js/atelie.js` ateliê de personagens · `js/pintura.js` pintar/apagar/balde/conta-gotas, cores base e trocar cores (à mão ou pela IA) no ateliê
- `js/efeitos.js` visuais/efeitos · `js/som.js` voz, boca e legendas · `js/ia.js` IA · `js/exportar.js` MP4 · `js/nuvem.js` biblioteca de personagens · `js/home.js` início e arquivo .animador
- `js/cenarios.js` cenários no estilo da casa (RABISCADO imperfeito, como rascunho; o de feltro foi abandonado): prontos em `cenarios/*.json` + IA que cria/ajusta no mesmo estilo; o guia do estilo está em `cenarios/ESTILO.md` — siga-o em qualquer cenário novo; cada objeto ("o") vira uma peça separada · `js/midia.js` aba Mídia (imagens guardadas neste computador para reaproveitar)
