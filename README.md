# Valorize+

App financeiro comportamental com API Node/Express, web desktop em React/Vite e mobile em Expo.

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

Se o QR Code do Expo nao abrir corretamente no celular ou aparecer "Nenhum dado usavel encontrado", use o tunel:

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
CLIENT_URL=http://localhost:5173
LOCAL_STORE_PATH=
APP_WEB_URL=http://localhost:5173
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
```

Sem `MONGO_URI`, o backend usa um arquivo local em `backend/data/store.json`. Isso preserva logins, metas, limites, amigos e transacoes entre reinicios do servidor.

Notícias reais: se `NEWS_API_KEY` estiver ausente, o backend usa Google News RSS em tempo real. Cotações: cripto usa CoinGecko; ações/FIIs usam Brapi sem token quando possível, e ficam completas com `BRAPI_API_KEY`.

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

O fluxo de "Esqueceu a senha?" envia um código/link por e-mail usando SMTP. Configure no `backend/.env`:

```env
APP_WEB_URL=http://localhost:5173
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu_usuario
SMTP_PASS=sua_senha
EMAIL_FROM="Valorize+ <no-reply@valorize.local>"
```

Sem SMTP configurado, o backend mantém o fluxo em modo desenvolvimento: ele imprime o token no terminal e também retorna `devResetToken` para teste local.

## Estrutura

- `backend`: autenticação JWT, transações, metas, carteira, notícias e simulador.
- `frontend`: dashboard web desktop/mobile com rotas protegidas e tema claro/escuro.
- `mobile`: app Expo com fluxo de autenticação e telas principais.
