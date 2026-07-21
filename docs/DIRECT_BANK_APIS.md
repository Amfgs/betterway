# APIs bancárias diretas na Better Way

A BW possui uma base comum para integrações bancárias oficiais. O usuário pode
selecionar a instituição, confirmar o tipo de conta e registrar os escopos de
leitura desejados. Essa preparação não coleta senha, token, certificado, chave
privada ou segredo bancário.

## Limite importante

As APIs diretas abaixo não substituem o Open Finance para a maioria das contas
pessoais. Em geral, elas atendem contas PJ do próprio banco ou parceiros
homologados. O acesso ao portal e ao Sandbox pode ser gratuito, mas a instituição
pode exigir conta elegível, contrato, certificado, análise comercial ou tarifa
em produção.

Para uma plataforma usada por várias pessoas, confirme por escrito que o banco
permite acessar contas de terceiros mediante consentimento. Credenciais criadas
para a conta da própria Better Way nunca devem ser reutilizadas para representar
outros usuários.

## O que coletar manualmente

Guarde estes itens fora do Git e fora de conversas. Quando o adaptador específico
for implementado, os segredos da aplicação devem entrar como variáveis Sensitive
na Vercel ou em um cofre de segredos compatível.

1. Nome do produto/API liberado e ambiente, Sandbox ou Produção.
2. Client ID e Client Secret da aplicação, quando existirem.
3. Certificado público, certificado cliente e chave privada exigidos por mTLS.
4. URLs oficiais de token, autorização, saldo, extrato e webhook.
5. Escopos de leitura aprovados, sem permissões de pagamento.
6. Identificador da conta ou empresa exigido pela API.
7. Regras de renovação, expiração, limites de chamada e consentimento.
8. Confirmação contratual de que a integração pode atender usuários da BW.

Não envie esses valores pelo formulário da BW. Ele registra somente a etapa de
preparação. O backend rejeita campos com nomes de senha, segredo, token,
certificado, chave privada ou credencial.

## Instituições mapeadas

| Instituição | Perfil | Leitura prevista | Ação manual |
| --- | --- | --- | --- |
| Inter Empresas | PJ | Saldo e extrato | No Internet Banking, abra Soluções para sua empresa, crie a integração, habilite `saldo.read` e `extrato.read` e baixe as credenciais e o certificado. |
| Banco do Brasil | PJ | Extrato e saldos parciais | Crie a aplicação no Portal Developers BB, adicione API de Extratos, teste no Sandbox e envie para produção. |
| Santander Empresas | PJ | Contas, saldo e extrato | Cadastre a aplicação, selecione Contas, Saldo e Extrato, teste e solicite a aprovação de produção. |
| Bradesco Empresas | PJ | Saldo e extrato | Cadastre-se, selecione o produto, conclua a assinatura exigida e envie o certificado público para gerar credenciais. |
| BTG Pactual Empresas | PJ | Saldo e extrato | Abra ou vincule a conta PJ, crie o app no Developer Console e solicite escopos `accounts.readonly`. |
| Cora | PJ | Extrato, com saldo no retorno | Defina Integração Direta ou Parceria, gere certificado e chave e habilite o escopo de extrato. |
| Stone | PJ | Saldo e extrato | Solicite onboarding de parceiro, valide o Sandbox e conclua consentimento e produção. |
| Sicoob | PJ | Depende da cooperativa | Cadastre a aplicação e confirme com a cooperativa a liberação de APIs de consulta. |
| Sicredi | PJ | Depende da cooperativa | Cadastre a solução e confirme com a cooperativa quais produtos de leitura estão disponíveis. |
| PagBank EDI | PF/PJ vendedor | Extrato de conciliação D-1 | Solicite ativação e token da API EDI no portal. Não é um extrato bancário em tempo real. |

Portais oficiais:

- [Inter Empresas](https://developers.inter.co/)
- [Banco do Brasil](https://www.bb.com.br/site/developers/api-extratos/)
- [Santander](https://developer.santander.com.br/api/visao-geral/contas-saldo-e-extrato-visao-geral)
- [Bradesco](https://api.bradesco/openapis)
- [BTG Pactual Empresas](https://empresas.btgpactual.com/developers/)
- [Cora](https://developers.cora.com.br/docs/utiliza%C3%A7%C3%A3o-das-apis)
- [Stone](https://docs.openbank.stone.com.br/docs/)
- [Sicoob](https://developers.sicoob.com.br/portal/apis)
- [Sicredi](https://developer.sicredi.com.br/api-portal/pt-br/node/1)
- [PagBank EDI](https://developer.pagbank.com.br/docs/edi)

## Como um adaptador entra no backend

Cada banco deve registrar um módulo com `directBankService.registerAdapter` e
implementar `fetchSnapshot`. O retorno é normalizado neste formato:

```js
{
  accounts: [],
  investments: [],
  transactions: []
}
```

O serviço comum adiciona data de sincronização, estado da conexão, isolamento
por usuário e tratamento de erro. Essa fronteira evita espalhar formatos de
bancos diferentes pelos controllers, gráficos e cálculos do produto.

Antes de ativar um adaptador em produção:

1. Confirme o direito contratual de atender terceiros.
2. Use apenas escopos de leitura.
3. Mantenha segredos fora do MongoDB e do frontend.
4. Valide mTLS e TLS com verificação de certificado habilitada.
5. Adicione testes de isolamento entre usuários e de revogação do consentimento.
6. Registre webhook com assinatura ou segredo rotacionável, quando disponível.
7. Defina retenção e exclusão dos dados conforme consentimento e LGPD.
