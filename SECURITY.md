# Segurança da Better Way

Última revisão: 16 de julho de 2026.

Nenhuma auditoria consegue prometer risco zero. Esta revisão cobre o código, dependências, configuração versionada e metadados visíveis da Vercel; não substitui pentest independente nem a configuração das contas do Registro.br, Resend e MongoDB Atlas.

## Controles implementados

- Todas as rotas financeiras exigem JWT e consultam documentos pelo `userId` autenticado.
- O JWT usa apenas `sub` e versão da sessão, algoritmo `HS256`, expiração de sete dias e não carrega e-mail ou dados financeiros.
- Senhas são armazenadas apenas como hash bcrypt. O backend limita o tamanho ao intervalo seguro do bcrypt e invalida sessões após troca de senha ou e-mail.
- Verificação de e-mail e recuperação usam códigos aleatórios de oito dígitos armazenados apenas como SHA-256, com expiração, cooldown e bloqueio persistente após cinco erros.
- Login e ações de e-mail têm rate limiting; respostas de recuperação e amizade evitam revelar e-mails cadastrados.
- Amigos recebem somente nome, nome de usuário e avatar. E-mail, salário e demais dados privados não entram na resposta pública.
- Conexões bancárias removem `userId`, IDs do provedor e nome do arquivo antes de responder ao cliente. A sincronização Pluggy confirma o proprietário do item.
- O importador bancário aceita apenas CSV de até 900 KB e no máximo 10 mil linhas; o corpo global da API é limitado a 1 MB.
- Produção não inicia sem MongoDB, `JWT_SECRET` forte e origens CORS explícitas. O modo local não é usado como persistência serverless.
- Headers web incluem CSP, HSTS, bloqueio de iframe, `nosniff`, política de referência e restrições de permissões.
- O repositório ignora `.env`, `.vercel`, dados locais e artefatos. A varredura do código e do histórico não encontrou chave real versionada.
- O GitHub está com Secret Scanning, Push Protection, alertas de vulnerabilidade e atualizações de segurança do Dependabot ativos.
- Não há Supabase, Firebase ou acesso direto do navegador ao banco. O frontend conversa apenas com a API autenticada.

## Dependências

- Todos os workspaces: nenhuma vulnerabilidade conhecida pelo `npm audit --omit=dev`.
- Frontend e backend possuem lockfiles próprios para que os projetos separados da Vercel instalem exatamente as versões auditadas.
- As dependências transitivas `postcss` e `uuid` do ferramental Expo foram fixadas em versões corrigidas por overrides de escopo restrito, mantendo o SDK 54.
- A compatibilidade do mobile é verificada com Expo Doctor e exportação do bundle iOS antes da publicação.

## Ações obrigatórias antes do lançamento

1. Rotacione a chave da Resend que foi compartilhada durante a configuração. Primeiro publique a nova chave na Vercel e faça redeploy; depois revogue a antiga.
2. Marque todos os segredos de produção como **Sensitive** na Vercel. Em especial: `MONGODB_URI`, `JWT_SECRET`, `RESEND_API_KEY` e `PLUGGY_CLIENT_SECRET`.
3. No Atlas, use um usuário exclusivo do aplicativo com acesso somente ao banco da Better Way, senha aleatória forte e autenticação SCRAM-SHA-256.
4. Revise a lista de IPs do Atlas. A Vercel usa saída dinâmica por padrão; para remover `0.0.0.0/0`, use Static IPs na Vercel e permita somente esses endereços, ou adote uma rede privada compatível.
5. Ative autenticação em dois fatores nas contas GitHub, Vercel, MongoDB Atlas, Resend e Registro.br. Remova colaboradores que não precisem de acesso.
6. Ative **Standard Protection** nos previews da Vercel para que URLs de branches e deployments antigos não fiquem públicas.
7. Mantenha backups do Atlas, alertas de acesso e rotação periódica de `JWT_SECRET`, credencial do banco, Resend e Pluggy.

## Risco residual conhecido

O cliente web mantém o JWT no `localStorage` para preservar a sessão. A CSP estrita e a ausência de HTML dinâmico reduzem o risco de XSS, mas cookies `HttpOnly` com proteção CSRF seriam uma defesa adicional. Essa migração deve ser feita junto da adoção definitiva de `betterway.com.br` e `api.betterway.com.br`, para não quebrar cookies entre os domínios temporários da Vercel. O mobile já usa o Keychain/Keystore por meio do Expo SecureStore.
