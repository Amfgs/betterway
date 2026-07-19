# Deploy da Better Way na Vercel

Sim, o deploy na Vercel é possível. O caminho mais estável para este monorepo é criar dois projetos na Vercel.

Projetos atuais: `betterway` para o frontend e `betterway-api` para a API. O endereço principal é `https://betterway.com.br`.

## 1. Frontend Web

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Variável obrigatória:

```env
VITE_API_URL=https://betterway-api.vercel.app/api
VITE_GOOGLE_CLIENT_ID=seu_oauth_web_client_id.apps.googleusercontent.com
```

O arquivo `frontend/vercel.json` já mantém o fallback de rotas para o React Router.

## 2. Backend API

- Root Directory: `backend`
- Entrada serverless: `backend/api/index.js`
- Variáveis obrigatórias:

```env
MONGO_URI=sua_string_do_mongodb_atlas
JWT_SECRET=sua_chave_segura
CLIENT_URL=https://betterway.com.br,https://www.betterway.com.br,https://betterway.vercel.app
APP_WEB_URL=https://betterway.com.br
BRAPI_API_KEY=sua_chave_brapi
NEWS_API_KEY=sua_chave_newsapi
PLUGGY_CLIENT_ID=seu_client_id_pluggy
PLUGGY_CLIENT_SECRET=seu_client_secret_pluggy
PLUGGY_ENVIRONMENT=trial
PLUGGY_WEBHOOK_URL=https://api.betterway.com.br/api/bank-connections/pluggy/webhook
PLUGGY_WEBHOOK_SECRET=um_segredo_aleatorio_de_64_caracteres
GOOGLE_CLIENT_ID=seu_oauth_web_client_id.apps.googleusercontent.com
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu_usuario
SMTP_PASS=sua_senha
RESEND_API_KEY=re_sua_chave
EMAIL_FROM=Better Way <no-reply@mail.betterway.com.br>
```

Em produção, uma conexão MongoDB, `JWT_SECRET` e `CLIENT_URL` são obrigatórios e a API encerra a inicialização quando algum deles estiver ausente. O backend aceita tanto `MONGO_URI` quanto `MONGODB_URI`, nome usado pela integração oficial do MongoDB Atlas na Vercel. O modo local com `backend/data/store.json` é adequado para desenvolvimento, mas arquivos locais não são persistentes em funções serverless.

`RESEND_API_KEY` é necessária para verificação e recuperação por e-mail. `EMAIL_FROM` pode ser usado para sobrescrever o remetente, mas, se ficar ausente, a API usa `Better Way <no-reply@mail.betterway.com.br>`. O domínio do remetente precisa estar verificado na Resend. Sem um provedor configurado, a produção retorna indisponibilidade em vez de expor códigos de acesso.

Marque `MONGODB_URI`, `JWT_SECRET`, `RESEND_API_KEY`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_WEBHOOK_SECRET`, `BRAPI_API_KEY`, `NEWS_API_KEY` e credenciais SMTP como **Sensitive**. Use apenas `VITE_API_URL` no frontend: toda variável iniciada por `VITE_` pode ser incorporada ao JavaScript entregue ao navegador.

Para o login Google, use o mesmo OAuth Web Client ID em `VITE_GOOGLE_CLIENT_ID` no projeto web e `GOOGLE_CLIENT_ID` na API. O Client ID identifica o aplicativo e não é segredo; não marque-o como Sensitive. Cadastre `https://betterway.com.br` e `https://www.betterway.com.br` como origens JavaScript autorizadas no Google Cloud. A API valida assinatura, emissor, audiência, expiração e e-mail verificado antes de criar uma sessão Better Way.

Para a Pluggy, use os nomes `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`. Não crie variáveis genéricas como `CLIENT_ID` e `CLIENT_SECRET`, porque o projeto também usa `CLIENT_URL` para CORS e URLs públicas. A `API Key` da Pluggy é temporária; ela não deve ser salva na Vercel nem enviada ao frontend. Enquanto a aplicação estiver em Trial, mantenha `PLUGGY_ENVIRONMENT=trial`; o Connect exibirá o Pluggy Bank. Depois da aprovação comercial da Pluggy, altere para `production` e faça um novo deploy.

Os webhooks `item/created`, `item/updated` e `item/error` usam `Authorization: Bearer <PLUGGY_WEBHOOK_SECRET>`. Para criá-los ou atualizar seus cabeçalhos pela API da Pluggy, carregue as variáveis localmente e execute `npm --workspace backend run configure:pluggy-webhook`.

## 3. Mobile

Depois do deploy, rode o Expo apontando para a API publicada:

```bash
EXPO_PUBLIC_API_URL=https://api.betterway.com.br/api npm run dev:mobile
```

O app publicado já usa `https://api.betterway.com.br/api`, a mesma API do frontend. A configuração completa do DNS e da Resend está em [DOMAIN_SETUP.md](./DOMAIN_SETUP.md).
