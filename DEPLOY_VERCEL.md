# Deploy do Valorize+ na Vercel

Sim, o deploy na Vercel é possível. O caminho mais estável para este monorepo é criar dois projetos na Vercel.

## 1. Frontend Web

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Variável obrigatória:

```env
VITE_API_URL=https://sua-api.vercel.app/api
```

O arquivo `frontend/vercel.json` já mantém o fallback de rotas para o React Router.

## 2. Backend API

- Root Directory: `backend`
- Entrada serverless: `backend/api/index.js`
- Variáveis obrigatórias:

```env
MONGO_URI=sua_string_do_mongodb_atlas
JWT_SECRET=sua_chave_segura
CLIENT_URL=https://seu-frontend.vercel.app
APP_WEB_URL=https://seu-frontend.vercel.app
BRAPI_API_KEY=sua_chave_brapi
NEWS_API_KEY=sua_chave_newsapi
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu_usuario
SMTP_PASS=sua_senha
EMAIL_FROM=Valorize+ <nao-responda@seu-dominio.com>
```

Em produção, uma conexão MongoDB, `JWT_SECRET` e `CLIENT_URL` são obrigatórios e a API encerra a inicialização quando algum deles estiver ausente. O backend aceita tanto `MONGO_URI` quanto `MONGODB_URI`, nome usado pela integração oficial do MongoDB Atlas na Vercel. O modo local com `backend/data/store.json` é adequado para desenvolvimento, mas arquivos locais não são persistentes em funções serverless.

As variáveis SMTP são necessárias para a recuperação de senha por e-mail. Sem elas, esse fluxo retorna indisponibilidade em produção em vez de expor um token de redefinição.

## 3. Mobile

Depois do deploy, rode o Expo apontando para a API publicada:

```bash
EXPO_PUBLIC_API_URL=https://sua-api.vercel.app/api npm run dev:mobile
```
