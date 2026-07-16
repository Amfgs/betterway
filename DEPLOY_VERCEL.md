# Deploy da Better Way na Vercel

Sim, o deploy na Vercel é possível. O caminho mais estável para este monorepo é criar dois projetos na Vercel.

Projetos atuais: `betterway` para o frontend e `betterway-api` para a API. Até a ativação de `betterway.com.br`, o frontend está em `https://betterway.vercel.app`.

## 1. Frontend Web

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Variável obrigatória:

```env
VITE_API_URL=https://betterway-api.vercel.app/api
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
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu_usuario
SMTP_PASS=sua_senha
RESEND_API_KEY=re_sua_chave
EMAIL_FROM=Better Way <conta@mail.betterway.com.br>
```

Em produção, uma conexão MongoDB, `JWT_SECRET` e `CLIENT_URL` são obrigatórios e a API encerra a inicialização quando algum deles estiver ausente. O backend aceita tanto `MONGO_URI` quanto `MONGODB_URI`, nome usado pela integração oficial do MongoDB Atlas na Vercel. O modo local com `backend/data/store.json` é adequado para desenvolvimento, mas arquivos locais não são persistentes em funções serverless.

`RESEND_API_KEY` e `EMAIL_FROM` são necessários para verificação e recuperação por e-mail. O domínio de `EMAIL_FROM` precisa estar verificado na Resend. Sem um provedor configurado, a produção retorna indisponibilidade em vez de expor códigos de acesso.

Marque `MONGODB_URI`, `JWT_SECRET`, `RESEND_API_KEY`, `PLUGGY_CLIENT_SECRET`, `BRAPI_API_KEY`, `NEWS_API_KEY` e credenciais SMTP como **Sensitive**. Use apenas `VITE_API_URL` no frontend: toda variável iniciada por `VITE_` pode ser incorporada ao JavaScript entregue ao navegador.

## 3. Mobile

Depois do deploy, rode o Expo apontando para a API publicada:

```bash
EXPO_PUBLIC_API_URL=https://betterway-api.vercel.app/api npm run dev:mobile
```

Depois que `api.betterway.com.br` estiver ativo, substitua o endereço acima por `https://api.betterway.com.br/api`. A configuração completa do DNS e da Resend está em [DOMAIN_SETUP.md](./DOMAIN_SETUP.md).
