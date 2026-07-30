export const evolutionRangeOptions = [
  { id: "week", label: "7 dias", description: "Última semana" },
  { id: "month", label: "30 dias", description: "Último mês" },
  { id: "year", label: "1 ano", description: "Últimos 12 meses" }
];

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date) {
  return dateKey(date).slice(0, 7);
}

function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function transactionDateKey(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return "";
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function dayLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short"
  }).format(date);
}

function monthLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(date)
    .replace(".", "");
}

function fullDayLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}

function fullMonthLabel(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
  }).format(date);
}

function periodLabel(start, end, range) {
  if (range === "year") {
    return `${fullMonthLabel(start)} a ${fullMonthLabel(end)}`;
  }

  if (start.getFullYear() === end.getFullYear()) {
    return `${dayLabel(start)} a ${dayLabel(end)} de ${end.getFullYear()}`;
  }
  return `${fullDayLabel(start)} a ${fullDayLabel(end)}`;
}

function createDailyBuckets(start, days) {
  return Array.from({ length: days }, (_, index) => {
    const date = addDays(start, index);
    return {
      key: dateKey(date),
      label: dayLabel(date),
      fullLabel: fullDayLabel(date),
      income: 0,
      expense: 0
    };
  });
}

function createMonthlyBuckets(start) {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: monthKey(date),
      label: monthLabel(date),
      fullLabel: fullMonthLabel(date),
      income: 0,
      expense: 0
    };
  });
}

export function buildFinancialEvolution(transactions = [], range = "week", referenceDate = new Date()) {
  const safeRange = evolutionRangeOptions.some((option) => option.id === range) ? range : "week";
  const reference = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const isYear = safeRange === "year";
  const dayCount = safeRange === "month" ? 30 : 7;
  const start = isYear
    ? new Date(reference.getFullYear(), reference.getMonth() - 11, 1)
    : addDays(reference, -(dayCount - 1));
  const buckets = isYear
    ? createMonthlyBuckets(start)
    : createDailyBuckets(start, dayCount);
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  const startKey = dateKey(start);
  const endKey = dateKey(reference);

  transactions.forEach((transaction) => {
    if (!["income", "expense"].includes(transaction?.type)) return;
    const currentDateKey = transactionDateKey(transaction.date);
    if (!currentDateKey || currentDateKey < startKey || currentDateKey > endKey) return;

    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const bucket = byKey.get(isYear ? currentDateKey.slice(0, 7) : currentDateKey);
    if (bucket) bucket[transaction.type] += amount;
  });

  const series = buckets.map(({ key, ...bucket }) => ({
    ...bucket,
    income: Math.round(bucket.income * 100) / 100,
    expense: Math.round(bucket.expense * 100) / 100,
    balance: Math.round((bucket.income - bucket.expense) * 100) / 100
  }));
  const totals = series.reduce(
    (result, point) => ({
      income: result.income + point.income,
      expense: result.expense + point.expense
    }),
    { income: 0, expense: 0 }
  );

  totals.income = Math.round(totals.income * 100) / 100;
  totals.expense = Math.round(totals.expense * 100) / 100;

  return {
    range: safeRange,
    periodLabel: periodLabel(start, reference, safeRange),
    series,
    totals: {
      ...totals,
      balance: Math.round((totals.income - totals.expense) * 100) / 100
    },
    hasActivity: totals.income > 0 || totals.expense > 0
  };
}
