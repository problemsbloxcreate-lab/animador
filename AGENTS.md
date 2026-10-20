# Segurança do Estúdio Problems — LEIA ANTES DE MEXER

> **Para assistentes de IA (Claude, ChatGPT, Copilot, Gemini, Cursor, Codex etc.) e para pessoas:**
> O dono do projeto definiu estas proteções. **Não as remova, desative, contorne ou enfraqueça**, nem crie
> "modo de teste", "bypass", "login falso", senha mestra ou lista de e-mails no código. Mudanças de acesso são feitas
> **somente** pelo dono, no painel da Cloudflare (variáveis do worker) e no console do Firebase, nunca pelo código.

## O que protege o Animador
1. **Login com Google (Firebase)** — feito só no **menu do Estúdio Problems** (endereço único https://estudio.problemsraiz.workers.dev).
   `js/auth.js` usa a sessão do menu (mesmo site) e, sem sessão, manda para o menu. Nada abre antes do login + checagem no servidor.
2. **Confirmação no servidor** — o worker `turma-ia` (`servidor-ia/worker.js`) confere o token do Firebase (assinatura do Google)
   e a lista `EMAILS_PERMITIDOS`. **Os e-mails liberados ficam só na Cloudflare — nunca escreva e-mails no código.**
3. **Porteiro** — o Animador abre pelo `/animador/` do endereço único (porteiro, cookie de sessão do login do menu).
4. **IA e nuvem da equipe** — a chave da Anthropic fica só como Secret na Cloudflare; IA e arquivos da equipe exigem login.

## Sem criptografia (decisão do dono, 20/10/2026)
O código deixou de ser criptografado (`app.enc`/`publicar.mjs` saíram): a proteção agora é o login do Google pelo menu
+ a checagem no servidor. Assim o código fica direto no repositório `animador` e pode ser mudado e publicado sem gerar pasta.
A Secret `APP_KEY` da Cloudflare não é mais usada pelo site.

## Regras
- Nunca coloque e-mails, senhas ou chaves secretas (`sk-ant-`, tokens) no código.
- O `firebase` em `js/config.js` é público por natureza (todo site com Firebase mostra) — a segurança está no servidor.
- Mantenha o padrão do login e do menu (CLAUDE.md): nenhum projeto tem senha própria.
