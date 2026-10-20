# Instruções para assistentes de IA neste projeto (Animador do Estúdio Problems)
Leia e siga **SEGURANCA.md**. Resumo obrigatório:
- Não remova, desative, contorne ou enfraqueça o login com Google (js/auth.js) nem a checagem no servidor (servidor-ia/worker.js: confereLogin, /quem, EMAILS_PERMITIDOS).
- Não crie bypass, modo teste, senha mestra ou login falso. Não escreva e-mails, senhas ou chaves no código.
- Mudanças de acesso são feitas só pelo dono, na Cloudflare/Firebase.
- Sem criptografia desde 20/10/2026 (decisão do dono): o código fica direto neste repositório e o GitHub Pages publica a raiz.
  Publicar = commit + `git pull --rebase` + push na `main` (só quando o dono pedir).
- O botão "Entrar com Google" fica só no MENU do Estúdio Problems; este projeto usa a sessão do menu e confere no servidor (/quem).
- Conferir antes do push: `for f in js/*.js js/anim/*.js; do node --check "$f"; done`.

## Login e ligação com o menu (NÃO QUEBRAR) — decisão do dono, 20/10/2026
- Todos os projetos do Estúdio Problems entram SÓ pelo login do Google do menu. Endereço único: https://estudio.problemsraiz.workers.dev
  (menu em `/`, ADM em `/adm`, `/shorts/`, `/editor/`, `/modelador/`, `/animador/`). Nenhum projeto tem senha própria.
- Quem libera é o **porteiro** (Worker `estudio`, conta Cloudflare "problemsraiz", código em `porteiro/` do repo
  `problemsbloxcreate-lab.github.io`): confere o e-mail no servidor `turma-ia` (EMAILS_PERMITIDOS) e guarda um cookie de sessão.
  Os projetos com portão próprio (Shorts, Editor) só aceitam o **passe assinado** do porteiro (cabeçalho `x-porteiro-passe`,
  conferido com `PORTEIRO_URL/chave-publica`). Sem passe → redireciona para o menu. Não crie bypass, senha nem "modo teste".
- Projeto novo: precisa de uma entrada em `PROJETOS` (porteiro/wrangler.toml). Página que precisa de login no navegador usa
  `<script src="/estudio-login.js"></script>`; o botão da conta (foto, nome, e-mail, Minha conta, Voltar ao menu, Sair) é
  `<script src="/estudio-conta.js" defer></script>` (+ opcional `<span data-estudio-conta></span>` no cabeçalho).
- Links internos para o menu usam `/` (raiz do endereço único). Nada de endereços antigos (`*.problemsbloxcreate.workers.dev`
  do Shorts/Editor, `github.io`): o GitHub Pages só serve de origem para o porteiro e redireciona para o endereço único.
- Servidor de sons (`sons-problems`) fica na conta Cloudflare antiga "problemsbloxcreate" (espaço só para os sons). As páginas
  falam com ele pelo `/nuvem/` do porteiro (passe, sem senha); só os robôs do GitHub usam a senha da equipe (SENHA_SONS).
- Conta da pessoa (nome, foto, fundo do menu): `GET/POST /conta` no porteiro (KV PERFIS). Fundo próprio de imagem/vídeo fica só
  no navegador (IndexedDB).
- Depois de qualquer mudança: conferir o diagnóstico da Action "Publicar o porteiro" (todos os projetos com passe aceito).
