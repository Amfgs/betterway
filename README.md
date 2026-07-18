# Better Way

App financeiro comportamental com API Node/Express, web desktop em React/Vite e mobile em Expo.

Produção atual: [betterway.vercel.app](https://betterway.vercel.app) · API: [betterway-api.vercel.app](https://betterway-api.vercel.app/api/health)

O domínio `betterway.com.br` já está associado aos projetos da Vercel e aguarda os registros no Registro.br. Consulte [DOMAIN_SETUP.md](./DOMAIN_SETUP.md). A arquitetura e o checklist de segurança estão em [SECURITY.md](./SECURITY.md).

## Sistema de design

O projeto adota o contrato aberto do Open Design por meio do arquivo
[`DESIGN.md`](./DESIGN.md). Ele centraliza identidade, tokens semânticos,
tipografia, componentes, movimento, responsividade e regras de acessibilidade.
As referências estudadas e as decisões aplicadas à Better Way estão registradas
em [`docs/DESIGN_RESEARCH.md`](./docs/DESIGN_RESEARCH.md).

## Rodando o projeto

```bash
npm install
npm run dev
```

Isso sobe API e web juntos. Se preferir terminais separados:

```bash
npm run dev:backend
npm run dev:web
```

Para mobile:

```bash
npm run dev:mobile
```

Se o QR Code do Expo não abrir corretamente no celular ou aparecer "Nenhum dado usável encontrado", use o túnel:

```bash
npm run dev:mobile:tunnel
```

O app mobile usa Expo SDK 54 para manter compatibilidade com o Expo Go instalado pela App Store. Como o app Expo fica no workspace `mobile`, rode os comandos pela raiz usando o script do workspace, ou entre na pasta `mobile` antes de usar `npx expo`.

Se o celular ainda mostrar incompatibilidade, feche o Expo Go, pare o terminal antigo e rode novamente com cache limpo:

```bash
npm run dev:mobile -- --clear
```

Esse script inicia o Metro em modo Expo Go (`expo start --go --host lan`). Para executar manualmente:

```bash
cd mobile
npx expo start --go -c
```

## Variáveis de ambiente

Copie `backend/.env.example` para `backend/.env`.

```env
PORT=5050
MONGO_URI=
JWT_SECRET=troque_esta_chave_em_producao
BRAPI_API_KEY=
NEWS_API_KEY=
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
CLIENT_URL=http://localhost:5173
LOCAL_STORE_PATH=
APP_WEB_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="Better Way <no-reply@mail.betterway.com.br>"
RESEND_API_KEY=
```

Sem `MONGO_URI` ou `MONGODB_URI`, o backend usa um arquivo local em `backend/data/store.json`. Isso preserva logins, metas, limites, amigos e transações entre reinícios do servidor.

Notícias reais: se `NEWS_API_KEY` estiver ausente, o backend usa Google News RSS em tempo real. Cotações: cripto usa CoinGecko; ações/FIIs usam Brapi sem token quando possível, e ficam completas com `BRAPI_API_KEY`.

Conexão bancária: com `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`, o usuário pode autorizar contas por Open Finance e sincronizar saldos, investimentos e os últimos 90 dias do extrato. Sem essas credenciais, a importação de CSV continua disponível e calcula saldo, posições e movimentações sem armazenar o arquivo bruto.

Sessões persistentes expiram 15 dias após o primeiro login, mesmo que o perfil seja alterado. No app nativo, o token fica no Secure Store e o usuário pode ativar Face ID, Touch ID ou biometria Android para desbloqueá-lo; a senha nunca é salva no aparelho.

O desbloqueio por Face ID no iOS precisa de um development build ou do aplicativo instalado, pois o Expo Go não oferece esse recurso. Durante testes no Expo Go, a sessão persistente de 15 dias continua funcionando normalmente.

Para o app Expo consumir a API em um celular físico, ajuste `mobile/.env` ou rode com:

```bash
EXPO_PUBLIC_API_URL=http://SEU_IP_LOCAL:5050/api npm run dev:mobile
```

O script `npm run dev:mobile` já tenta detectar o IP do Mac automaticamente. Se a conta criada no web não aparecer no iPhone, abra a tela de login do mobile e confira `API ativa`. Ela precisa apontar para o mesmo backend do web, por exemplo:

```text
http://192.168.0.10:5050/api
```

Se estiver `localhost`, o iPhone está tentando falar com ele mesmo, não com o Mac.

## Recuperação de senha por e-mail

O fluxo de "Esqueceu a senha?" envia um código por e-mail usando a API da Resend, com SMTP como alternativa. Depois de verificar o subdomínio `mail.betterway.com.br` na Resend, configure no `backend/.env`:

```env
APP_WEB_URL=http://localhost:5173
EMAIL_FROM="Better Way <no-reply@mail.betterway.com.br>"
RESEND_API_KEY=re_sua_chave
```

Se `RESEND_API_KEY` estiver configurada e `EMAIL_FROM` ficar ausente, a API usa `Better Way <no-reply@mail.betterway.com.br>` como remetente padrão.

Sem Resend ou SMTP configurado, o backend mantém o fluxo em modo desenvolvimento: ele imprime o token no terminal e também retorna `devResetToken` para teste local.

## Estrutura

- `backend`: autenticação JWT, transações, metas, carteira, notícias e simulador.
- `frontend`: dashboard web desktop/mobile com rotas protegidas e tema claro/escuro.
- `mobile`: app Expo com fluxo de autenticação e telas principais.
