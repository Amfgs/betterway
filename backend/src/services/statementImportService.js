const crypto = require("crypto");
const { parse } = require("csv-parse/sync");

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function numberFrom(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  let clean = String(value ?? "").trim();
  if (!clean) return 0;
  const negative = /^\(.*\)$/.test(clean);
  clean = clean.replace(/[()R$\s]/g, "").replace(/[^0-9,.-]/g, "");
  const comma = clean.lastIndexOf(",");
  const dot = clean.lastIndexOf(".");
  if (comma > dot) clean = clean.replace(/\./g, "").replace(",", ".");
  else clean = clean.replace(/,/g, "");
  const parsed = Number(clean);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -Math.abs(parsed) : parsed;
}

function pick(record, aliases) {
  for (const alias of aliases) {
    if (record[alias] !== undefined && record[alias] !== "") return record[alias];
  }
  return "";
}

function signedMovement(record) {
  const rawValue = numberFrom(pick(record, ["valor", "amount", "movimento", "movement"]));
  const type = normalizeKey(pick(record, ["tipo", "type", "natureza", "nature"]));
  if (["saida", "debito", "expense", "debit", "pagamento"].some((word) => type.includes(word))) {
    return -Math.abs(rawValue);
  }
  if (["entrada", "credito", "income", "credit", "recebimento"].some((word) => type.includes(word))) {
    return Math.abs(rawValue);
  }
  return rawValue;
}

function parseRecords(content) {
  return parse(content, {
    bom: true,
    columns: (headers) => headers.map(normalizeKey),
    delimiter: [";", ",", "\t"],
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
    max_record_size: 100000,
    to_line: 10001
  });
}

function statementSnapshot(records, options) {
  const balances = records
    .map((record) => pick(record, ["saldo", "balance", "saldo_apos_movimento"]))
    .filter((value) => value !== "");
  const calculatedBalance = numberFrom(options.openingBalance) + records.reduce((sum, record) => sum + signedMovement(record), 0);
  const balance = balances.length ? numberFrom(balances[balances.length - 1]) : calculatedBalance;

  return {
    accounts: [{
      externalId: `import-account-${normalizeKey(options.accountName) || "principal"}`,
      name: options.accountName || "Conta importada",
      type: "BANK",
      subtype: "IMPORTED_STATEMENT",
      balance,
      currencyCode: "BRL"
    }],
    investments: [],
    detectedFormat: "transactions"
  };
}

function positionsSnapshot(records) {
  const accountTypes = ["conta", "conta_corrente", "poupanca", "checking", "savings", "account", "saldo_em_conta"];
  const accounts = [];
  const investments = [];

  records.forEach((record, index) => {
    const type = normalizeKey(pick(record, ["tipo", "type", "categoria", "category"]));
    const name = pick(record, ["nome", "name", "descricao", "description", "ativo", "asset"]) || `Posição ${index + 1}`;
    const balance = numberFrom(pick(record, ["saldo", "balance", "valor_atual", "current_value", "montante", "amount"]));
    const quantity = numberFrom(pick(record, ["quantidade", "quantity", "qtd"]));
    const unitValue = numberFrom(pick(record, ["preco", "price", "preco_atual", "unit_value"]));
    const finalBalance = balance || quantity * unitValue;
    const externalId = pick(record, ["id", "identificador", "codigo", "code", "ticker"]) || `import-position-${index + 1}`;

    if (accountTypes.includes(type)) {
      accounts.push({
        externalId,
        name,
        type: "BANK",
        subtype: type.toUpperCase(),
        balance: finalBalance,
        currencyCode: "BRL"
      });
      return;
    }

    investments.push({
      externalId,
      name,
      code: pick(record, ["codigo", "code", "ticker", "identificador"]),
      type: type.toUpperCase() || "OTHER",
      subtype: "IMPORTED_POSITION",
      balance: finalBalance,
      quantity,
      unitValue,
      amountProfit: numberFrom(pick(record, ["lucro", "profit", "rendimento", "yield"])),
      currencyCode: "BRL"
    });
  });

  return { accounts, investments, detectedFormat: "positions" };
}

function parseStatement(content, options = {}) {
  if (typeof content !== "string" || !content || Buffer.byteLength(content, "utf8") > 900000) {
    const error = new Error("O CSV precisa ter conteúdo e no máximo 900 KB.");
    error.status = 400;
    throw error;
  }

  let records;
  try {
    records = parseRecords(content);
  } catch (error) {
    const invalid = new Error("Não foi possível ler o CSV. Confira os cabeçalhos e o separador do arquivo.");
    invalid.status = 400;
    throw invalid;
  }
  if (!records.length) {
    const error = new Error("O CSV não possui linhas utilizáveis.");
    error.status = 400;
    throw error;
  }

  const first = records[0];
  const hasMovementColumns = ["valor", "amount", "movimento", "movement"].some((key) => key in first);
  const hasPositionColumns = ["saldo", "balance", "valor_atual", "current_value", "montante"].some((key) => key in first);
  const format = options.format === "positions" || options.format === "transactions"
    ? options.format
    : hasPositionColumns && !hasMovementColumns
      ? "positions"
      : "transactions";
  const snapshot = format === "positions" ? positionsSnapshot(records) : statementSnapshot(records, options);
  if (!snapshot.accounts.length && !snapshot.investments.length) {
    const error = new Error("Nenhum saldo ou investimento foi reconhecido no arquivo.");
    error.status = 400;
    throw error;
  }

  const cleanLabel = (value, fallback, max = 120) => String(value || fallback).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
  const accountName = cleanLabel(options.accountName, "Importação bancária");
  return {
    ...snapshot,
    externalId: `import-${crypto.createHash("sha256").update(accountName.toLowerCase()).digest("hex").slice(0, 16)}`,
    label: accountName,
    institutionName: cleanLabel(options.institutionName, accountName),
    sourceFile: cleanLabel(options.fileName, "extrato.csv", 180),
    recordCount: records.length,
    lastSyncedAt: new Date().toISOString()
  };
}

module.exports = {
  parseStatement
};
