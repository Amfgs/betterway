import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pencil, TrendingDown, TrendingUp, X } from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { DatePickerField } from "../components/DatePickerField";
import { categoryLabel, categoryOptions, currency, shortDate } from "../utils/formatters";

function inputDate(value = new Date()) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(value) {
  return String(value || "").slice(0, 7);
}

function monthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function groupByMonth(transactions) {
  return transactions.reduce((groups, transaction) => {
    const key = monthKey(transaction.date);
    if (!groups[key]) {
      groups[key] = {
        key,
        label: monthLabel(key),
        transactions: [],
        income: 0,
        expenses: 0,
        investments: 0
      };
    }
    groups[key].transactions.push(transaction);
    if (transaction.type === "income") groups[key].income += Number(transaction.amount || 0);
    if (transaction.type === "expense") groups[key].expenses += Number(transaction.amount || 0);
    if (transaction.type === "expense" && transaction.category === "Investimentos") {
      groups[key].investments += Number(transaction.amount || 0);
    }
    return groups;
  }, {});
}

export function TimelinePage() {
  const [transactions, setTransactions] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/transactions");
      setTransactions(response.data.transactions || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => Object.values(groupByMonth(transactions)).sort((a, b) => b.key.localeCompare(a.key)), [transactions]);

  function startEdit(transaction) {
    setEditing(transaction.id);
    setForm({
      title: transaction.title || "",
      amount: String(transaction.amount || ""),
      type: transaction.type || "expense",
      category: transaction.category || "Alimentacao",
      isSuperfluous: Boolean(transaction.isSuperfluous),
      date: inputDate(transaction.date),
      notes: transaction.notes || ""
    });
  }

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function cancelEdit() {
    setEditing(null);
    setForm(null);
  }

  async function saveEdit(event) {
    event.preventDefault();
    setError("");
    try {
      await api.put(`/transactions/${editing}`, form);
      cancelEdit();
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Histórico completo</p>
          <h1 className="text-3xl font-black">Linha do tempo completa</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Transações separadas mês a mês, ordenadas pela data escolhida.</p>
        </div>
        <Link className="inline-flex items-center justify-center gap-2 rounded-lg border border-black/10 px-4 py-3 font-black dark:border-white/10" to="/dashboard">
          <ArrowLeft size={17} />
          Voltar ao dashboard
        </Link>
      </div>

      {error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}
      {loading ? <p className="rounded-lg bg-white p-4 text-sm text-zinc-500 shadow-soft dark:bg-neutral-900 dark:text-zinc-400">Carregando linha do tempo...</p> : null}
      {editing && form ? (
        <form className="rounded-lg border border-emerald-500/20 bg-white p-4 shadow-soft dark:bg-neutral-900" onSubmit={saveEdit}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Edição rápida</p>
              <h2 className="text-xl font-black">Ajustar item da linha do tempo</h2>
            </div>
            <button className="rounded-lg border border-black/10 p-2 dark:border-white/10" onClick={cancelEdit} type="button">
              <X size={17} />
            </button>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_9rem_9rem_13rem_10rem_auto] lg:items-end">
            <label>
              <span className="text-sm font-medium">Título</span>
              <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={form.title} onChange={(event) => updateForm("title", event.target.value)} />
            </label>
            <label>
              <span className="text-sm font-medium">Valor</span>
              <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="number" value={form.amount} onChange={(event) => updateForm("amount", event.target.value)} />
            </label>
            <label>
              <span className="text-sm font-medium">Tipo</span>
              <select className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={form.type} onChange={(event) => updateForm("type", event.target.value)}>
                <option value="expense">Saída</option>
                <option value="income">Entrada</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-medium">Setor</span>
              <select className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={form.category} onChange={(event) => updateForm("category", event.target.value)}>
                {categoryOptions.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <DatePickerField label="Data" value={form.date} onChange={(value) => updateForm("date", value)} />
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
              <Pencil size={17} />
              Salvar
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-4">
        {groups.map((group) => {
          const balance = group.income - group.expenses;
          return (
            <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900" key={group.key}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-black capitalize">{group.label}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{group.transactions.length} itens registrados</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-4">
                  <Metric label="Entradas" value={currency(group.income)} tone="safe" />
                  <Metric label="Gastos totais" value={currency(group.expenses)} tone="danger" />
                  <Metric label="Investido" value={currency(group.investments)} tone="safe" />
                  <Metric label="Saldo" value={currency(balance)} tone={balance >= 0 ? "safe" : "danger"} />
                </div>
              </div>

              <div className="mt-4 divide-y divide-black/5 dark:divide-white/10">
                {group.transactions.map((transaction) => (
                  <div className="grid gap-2 py-3 md:grid-cols-[7rem_1fr_auto] md:items-center" key={transaction.id}>
                    <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">{shortDate(transaction.date)}</p>
                    <div>
                      <p className="font-black">{transaction.title}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">{categoryLabel(transaction.category)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 md:justify-end">
                      <p className={`inline-flex items-center gap-1 font-black ${transaction.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {transaction.type === "income" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                        {transaction.type === "income" ? "+" : "-"}
                        {currency(transaction.amount)}
                      </p>
                      <button className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => startEdit(transaction)} type="button" title="Editar">
                        <Pencil size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {!loading && groups.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-sm text-zinc-500 shadow-soft dark:bg-neutral-900 dark:text-zinc-400">
          Nenhuma transação cadastrada ainda.
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className="rounded-lg bg-stone-100 px-3 py-2 dark:bg-neutral-800">
      <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`text-sm font-black ${tone === "safe" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{value}</p>
    </div>
  );
}
