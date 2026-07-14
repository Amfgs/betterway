export function currency(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value || 0));
}

export function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function shortDate(value) {
  if (!value) return "-";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short"
    }).format(date);
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

export const categoryLabels = {
  Alimentacao: "Alimentação",
  Transporte: "Transporte",
  Saude: "Saúde",
  Moradia: "Moradia",
  "Produtos Necessarios": "Produtos Necessários",
  Lazer: "Lazer",
  Educacao: "Educação",
  Investimentos: "Investimentos",
  Renda: "Renda",
  Freelance: "Freelance",
  Outros: "Outros"
};

export function categoryLabel(value) {
  return categoryLabels[value] || value || "-";
}

export function monthInputValue(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export const categories = Object.keys(categoryLabels);

export const categoryOptions = categories.map((value) => ({
  value,
  label: categoryLabel(value)
}));
