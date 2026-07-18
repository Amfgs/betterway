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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
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

export function todayInput() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
