# Domínio da Better Way

Os três domínios já foram associados aos projetos corretos na Vercel:

- `betterway.com.br` e `www.betterway.com.br` no projeto `betterway`.
- `api.betterway.com.br` no projeto `betterway-api`.

Falta apenas publicar os registros no provedor DNS atual, o Registro.br.

## 1. Configurar o Registro.br

1. Entre em `registro.br`, abra **Domínios** e selecione `betterway.com.br`.
2. Em **DNS**, escolha **Configurar zona DNS** e abra o modo avançado.
3. Crie os registros abaixo. No domínio raiz, deixe o campo **Nome** vazio se a interface não aceitar `@`.

| Nome | Tipo | Valor |
| --- | --- | --- |
| `@` ou vazio | `A` | `76.76.21.21` |
| `www` | `A` | `76.76.21.21` |
| `api` | `A` | `76.76.21.21` |

Mantenha os nameservers atuais do Registro.br. Não é necessário delegar o domínio inteiro para a Vercel, e assim os registros de e-mail da Resend continuam no mesmo painel.

## 2. Confirmar na Vercel

Quando o DNS propagar, abra **Settings > Domains**:

1. No projeto `betterway`, confirme `betterway.com.br` como domínio principal.
2. Configure `www.betterway.com.br` para redirecionar permanentemente para `betterway.com.br`.
3. No projeto `betterway-api`, confirme `api.betterway.com.br`.
4. Aguarde os certificados HTTPS aparecerem como válidos.

Verificação pelo terminal:

```bash
dig +short betterway.com.br A
dig +short www.betterway.com.br A
dig +short api.betterway.com.br A
curl -I https://betterway.com.br
curl https://api.betterway.com.br/api/health
```

## 3. Atualizar as variáveis

No frontend `betterway`, em **Settings > Environment Variables**:

```env
VITE_API_URL=https://api.betterway.com.br/api
```

No backend `betterway-api`:

```env
CLIENT_URL=https://betterway.com.br,https://www.betterway.com.br,https://betterway.vercel.app
APP_WEB_URL=https://betterway.com.br
```

Faça um novo deploy dos dois projetos depois de salvar. Alterações em variáveis não modificam deployments antigos.

## 4. Verificar a Resend

Use um subdomínio transacional para separar a reputação dos e-mails do site:

1. Na Resend, abra **Domains > Add domain** e informe `mail.betterway.com.br`.
2. Copie exatamente os registros SPF, DKIM e MX gerados pela Resend para a zona DNS no Registro.br. Os valores são exclusivos da conta e não devem ser inventados ou salvos no Git.
3. Aguarde o estado **Verified**.
4. Crie uma nova chave da Resend e salve-a como variável **Sensitive** no projeto `betterway-api`.
5. Configure o remetente:

```env
EMAIL_FROM=Better Way <conta@mail.betterway.com.br>
```

6. Faça redeploy da API e teste cadastro, reenvio de verificação e recuperação de senha.

A chave usada durante o desenvolvimento foi compartilhada em uma conversa e deve ser revogada depois que a nova chave estiver funcionando.
