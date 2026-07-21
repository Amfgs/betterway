const CAPABILITY_LABELS = {
  balance: "Saldo",
  transactions: "Extrato",
  investments: "Investimentos"
};

const providers = [
  {
    id: "inter",
    name: "Banco Inter Empresas",
    accountTypes: ["business"],
    capabilities: ["balance", "transactions"],
    accessMode: "Certificado mTLS e OAuth 2.0",
    eligibility: "Conta Inter Empresas ativa e integração criada no Internet Banking PJ.",
    portalUrl: "https://developers.inter.co/",
    preparationSteps: [
      "Abra Soluções para sua empresa no Internet Banking.",
      "Crie uma integração com os escopos de saldo e extrato.",
      "Ative e guarde Client ID, Client Secret, certificado e chave privada."
    ]
  },
  {
    id: "banco_do_brasil",
    name: "Banco do Brasil",
    accountTypes: ["business"],
    capabilities: ["transactions"],
    accessMode: "OAuth 2.0 e homologação do aplicativo",
    eligibility: "Conta corrente PJ ativa e cadastro no Portal Developers BB.",
    portalUrl: "https://www.bb.com.br/site/developers/api-extratos/",
    preparationSteps: [
      "Cadastre uma aplicação no Portal Developers BB.",
      "Adicione a API de Extratos e valide o fluxo no Sandbox.",
      "Envie a aplicação para produção e conclua a vinculação da conta PJ."
    ]
  },
  {
    id: "santander",
    name: "Santander Empresas",
    accountTypes: ["business"],
    capabilities: ["balance", "transactions"],
    accessMode: "OAuth 2.0 e aprovação de produção",
    eligibility: "Conta Santander PJ ativa e aplicação aprovada no portal do banco.",
    portalUrl: "https://developer.santander.com.br/api/visao-geral/contas-saldo-e-extrato-visao-geral",
    preparationSteps: [
      "Crie uma conta no portal Santander Developers.",
      "Cadastre uma aplicação e selecione Contas, Saldo e Extrato.",
      "Teste no Sandbox e solicite a habilitação do ambiente de produção."
    ]
  },
  {
    id: "bradesco",
    name: "Bradesco Empresas",
    accountTypes: ["business"],
    capabilities: ["balance", "transactions"],
    accessMode: "Certificado e credenciais do produto",
    eligibility: "Cadastro no Bradesco Developers, contratação do produto e conta elegível.",
    portalUrl: "https://api.bradesco/openapis",
    preparationSteps: [
      "Cadastre-se no Bradesco Developers.",
      "Selecione o produto Saldo e Extrato e o ambiente desejado.",
      "Envie o certificado público e gere as credenciais após a aprovação."
    ]
  },
  {
    id: "btg_empresas",
    name: "BTG Pactual Empresas",
    accountTypes: ["business"],
    capabilities: ["balance", "transactions"],
    accessMode: "OAuth 2.0 com escopos somente leitura",
    eligibility: "Conta BTG Pactual Empresas e aplicativo no Developer Console.",
    portalUrl: "https://empresas.btgpactual.com/developers/",
    preparationSteps: [
      "Abra ou vincule uma conta BTG Pactual Empresas.",
      "Crie o aplicativo no Developer Console e valide o Sandbox.",
      "Solicite os escopos accounts.readonly e a publicação em produção."
    ]
  },
  {
    id: "cora",
    name: "Cora",
    accountTypes: ["business"],
    capabilities: ["transactions"],
    accessMode: "Certificado, chave privada e token",
    eligibility: "Conta Cora PJ e habilitação da Integração Direta ou Parceria Cora.",
    portalUrl: "https://developers.cora.com.br/docs/utiliza%C3%A7%C3%A3o-das-apis",
    preparationSteps: [
      "Defina com a Cora se o uso será Integração Direta ou Parceria.",
      "Gere o certificado e a chave exigidos para autenticação.",
      "Habilite o escopo de consulta de extrato no ambiente correto."
    ]
  },
  {
    id: "stone",
    name: "Stone",
    accountTypes: ["business"],
    capabilities: ["balance", "transactions"],
    accessMode: "Token e consentimento da conta",
    eligibility: "Conta Stone e onboarding aprovado pelo time de parcerias.",
    portalUrl: "https://docs.openbank.stone.com.br/docs/",
    preparationSteps: [
      "Solicite o onboarding de parceiro no portal Stone OpenBank.",
      "Valide saldo e extrato no ambiente de Sandbox.",
      "Conclua o consentimento e a habilitação da conta em produção."
    ]
  },
  {
    id: "sicoob",
    name: "Sicoob",
    accountTypes: ["business"],
    capabilities: ["balance", "transactions"],
    accessMode: "Aplicativo no portal e credenciais da cooperativa",
    eligibility: "Conta empresarial e produto liberado pela cooperativa responsável.",
    portalUrl: "https://developers.sicoob.com.br/portal/apis",
    preparationSteps: [
      "Cadastre a aplicação no portal Sicoob Developers.",
      "Confirme com sua cooperativa a disponibilidade de saldo e extrato.",
      "Solicite credenciais de produção e mantenha apenas escopos de leitura."
    ]
  },
  {
    id: "sicredi",
    name: "Sicredi",
    accountTypes: ["business"],
    capabilities: ["balance", "transactions"],
    accessMode: "Aplicativo e aprovação da cooperativa",
    eligibility: "Conta empresarial e API de consulta habilitada pela cooperativa.",
    portalUrl: "https://developer.sicredi.com.br/api-portal/pt-br/node/1",
    preparationSteps: [
      "Cadastre sua solução no Portal do Desenvolvedor Sicredi.",
      "Confirme com a cooperativa os produtos de consulta disponíveis.",
      "Valide o Sandbox antes de solicitar credenciais de produção."
    ]
  },
  {
    id: "pagbank",
    name: "PagBank EDI",
    accountTypes: ["personal", "business"],
    capabilities: ["transactions"],
    accessMode: "Token da API EDI",
    eligibility: "Conta de vendedor PagBank; o extrato é de conciliação e chega em D-1.",
    portalUrl: "https://developer.pagbank.com.br/docs/edi",
    preparationSteps: [
      "Solicite a ativação da API EDI no portal PagBank.",
      "Escolha token por estabelecimento ou um token para vários estabelecimentos.",
      "Aguarde o token por e-mail e considere que os dados são do dia anterior."
    ]
  }
];

const providerMap = new Map(providers.map((provider) => [provider.id, provider]));
const adapterMap = new Map();
const forbiddenCredentialKey = /(password|senha|secret|segredo|token|certificate|certificado|private.?key|chave.?privada|credential|credencial|api.?key)/i;

function publicProvider(provider) {
  return {
    ...provider,
    capabilities: provider.capabilities.map((id) => ({ id, label: CAPABILITY_LABELS[id] || id })),
    costNotice: "O portal pode ser gratuito, mas produção, conta e contrato dependem da instituição.",
    integrationStatus: adapterMap.has(provider.id) ? "ready" : "setup_required"
  };
}

function catalog() {
  return providers.map(publicProvider);
}

function containsCredential(value, path = "") {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) => {
    const nextPath = path ? `${path}.${key}` : key;
    if (forbiddenCredentialKey.test(nextPath)) return true;
    return containsCredential(nested, nextPath);
  });
}

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.expose = true;
  return error;
}

function prepareRequest(payload = {}) {
  if (containsCredential(payload)) {
    throw validationError("Não envie senha, token, certificado ou segredo bancário para a Better Way.");
  }

  const bankId = String(payload.bankId || "").trim().toLowerCase();
  const provider = providerMap.get(bankId);
  if (!provider) throw validationError("Selecione uma instituição disponível no catálogo de APIs diretas.");

  const accountType = String(payload.accountType || "").trim().toLowerCase();
  if (!provider.accountTypes.includes(accountType)) {
    throw validationError("Essa API não aceita o tipo de conta selecionado. Revise a elegibilidade indicada pelo banco.");
  }
  if (payload.acceptedReadOnlyTerms !== true) {
    throw validationError("Confirme que a solicitação será somente para leitura de dados financeiros.");
  }

  const requestedScopes = Array.isArray(payload.scopes)
    ? [...new Set(payload.scopes.map((scope) => String(scope || "").trim().toLowerCase()))]
    : [...provider.capabilities];
  if (!requestedScopes.length || requestedScopes.some((scope) => !provider.capabilities.includes(scope))) {
    throw validationError("Selecione somente os dados de leitura oferecidos por essa instituição.");
  }

  return {
    externalId: `direct:${provider.id}`,
    fields: {
      label: provider.name,
      institutionName: provider.name,
      institutionKey: provider.id,
      accounts: [],
      investments: [],
      transactions: [],
      syncStatus: "pending",
      syncError: { code: "", message: "" },
      directConfig: {
        accountType,
        requestedScopes,
        setupStatus: "action_required",
        eligibilityConfirmedAt: new Date()
      }
    },
    provider: publicProvider(provider)
  };
}

function registerAdapter(bankId, adapter) {
  if (!providerMap.has(bankId)) throw new Error(`Provedor bancário desconhecido: ${bankId}`);
  if (!adapter || typeof adapter.fetchSnapshot !== "function") {
    throw new Error(`O adaptador ${bankId} precisa implementar fetchSnapshot.`);
  }
  adapterMap.set(bankId, adapter);
}

async function fetchSnapshot(connection, context = {}) {
  const bankId = String(connection?.institutionKey || "");
  const adapter = adapterMap.get(bankId);
  if (!adapter) {
    const error = new Error("A preparação foi salva, mas o adaptador desta instituição ainda aguarda credenciais e homologação.");
    error.status = 503;
    error.expose = true;
    throw error;
  }
  const snapshot = await adapter.fetchSnapshot({ connection, ...context });
  return {
    label: connection.label,
    institutionName: connection.institutionName,
    institutionKey: bankId,
    accounts: Array.isArray(snapshot?.accounts) ? snapshot.accounts : [],
    investments: Array.isArray(snapshot?.investments) ? snapshot.investments : [],
    transactions: Array.isArray(snapshot?.transactions) ? snapshot.transactions : [],
    lastSyncedAt: new Date(),
    syncStatus: "active",
    syncError: { code: "", message: "" },
    directConfig: { ...(connection.directConfig || {}), setupStatus: "connected" }
  };
}

module.exports = {
  catalog,
  fetchSnapshot,
  prepareRequest,
  registerAdapter
};
