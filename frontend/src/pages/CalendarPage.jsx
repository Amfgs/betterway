import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, SlidersHorizontal, Trash2, WalletCards, X } from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { GuidedSectionHeader, WorkspaceHeader, WorkspacePeriodControl } from "../components/WorkspaceHeader";
import { useAuth } from "../context/AuthContext";
import { currency, shortDate } from "../utils/formatters";
import { readScopedStoredValue, removeStoredValue, scopedStorageKey, storageKeys } from "../utils/storageKeys";

const defaultWeekdays = [0, 1, 2, 3, 4, 5, 6];
const weekdayOptions = [
  { value: 0, short: "Dom", label: "Domingo" },
  { value: 1, short: "Seg", label: "Segunda" },
  { value: 2, short: "Ter", label: "Terça" },
  { value: 3, short: "Qua", label: "Quarta" },
  { value: 4, short: "Qui", label: "Quinta" },
  { value: 5, short: "Sex", label: "Sexta" },
  { value: 6, short: "Sáb", label: "Sábado" }
];

function inputMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function inputDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateKey(date) {
  return inputDate(date);
}

function monthDays(month) {
  const [year, monthValue] = month.split("-").map(Number);
  const first = new Date(year, monthValue - 1, 1);
  const last = new Date(year, monthValue, 0);
  return Array.from({ length: last.getDate() }, (_, index) => {
    const date = new Date(year, monthValue - 1, index + 1);
    return {
      date,
      key: dateKey(date),
      day: index + 1,
      weekday: date.getDay(),
      isWeekend: [0, 6].includes(date.getDay())
    };
  });
}

function compactCurrency(value) {
  return `R$ ${Math.round(Number(value || 0)).toLocaleString("pt-BR")}`;
}

function loadSpecs(userId) {
  try {
    const parsed = JSON.parse(readScopedStoredValue(storageKeys.calendarSpecs, storageKeys.legacyCalendarSpecs, userId, "{}"));
    const includedWeekdays = Array.isArray(parsed.includedWeekdays)
      ? parsed.includedWeekdays.map(Number).filter((day) => defaultWeekdays.includes(day))
      : defaultWeekdays;
    return {
      weekendMultiplier: parsed.weekendMultiplier || 1.25,
      weekendExtra: parsed.weekendExtra || 0,
      fixedDays: parsed.fixedDays || {},
      ignoredDays: parsed.ignoredDays || {},
      includedWeekdays
    };
  } catch {
    return { weekendMultiplier: 1.25, weekendExtra: 0, fixedDays: {}, ignoredDays: {}, includedWeekdays: defaultWeekdays };
  }
}

export function CalendarPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(inputMonth());
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [specs, setSpecs] = useState(() => loadSpecs(user?.id));
  const [form, setForm] = useState({ date: inputDate(), amount: "", note: "" });
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [dayForm, setDayForm] = useState({ amount: "", note: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(scopedStorageKey(storageKeys.calendarSpecs, user.id), JSON.stringify(specs));
  }, [specs, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    removeStoredValue(storageKeys.calendarSpecs, storageKeys.legacyCalendarSpecs);
    setSpecs(loadSpecs(user.id));
  }, [user?.id]);

  useEffect(() => {
    setError("");
    Promise.all([api.get("/transactions"), api.get("/transactions/summary", { params: { month } })])
      .then(([transactionsResponse, summaryResponse]) => {
        setTransactions(transactionsResponse.data.transactions || []);
        setSummary(summaryResponse.data);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [month]);

  const calendar = useMemo(() => {
    const days = monthDays(month);
    const todayKey = inputDate();
    const includedWeekdays = Array.isArray(specs.includedWeekdays) ? specs.includedWeekdays : defaultWeekdays;
    const ignoredDays = specs.ignoredDays || {};
    const fixedDays = specs.fixedDays || {};
    const monthTransactions = transactions.filter((transaction) => String(transaction.date || "").slice(0, 7) === month);
    const income = monthTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const expenses = monthTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const limitRemainders = (summary?.limits || []).map((limit) => Math.max(Number(limit.amount || 0) - Number(limit.spent || 0), 0));
    const limitsBudget = limitRemainders.reduce((sum, value) => sum + value, 0);
    const generalLimitBudget = Math.max(Number(summary?.widgets?.monthlyLimit || 0) - Number(summary?.widgets?.expensesForLimit || 0), 0);
    const available = limitsBudget > 0 ? limitsBudget : generalLimitBudget;

    function participates(day) {
      const fixed = fixedDays[day.key];
      const ignored = Boolean(ignoredDays[day.key]);
      const weekdayIncluded = includedWeekdays.includes(day.weekday);
      return !ignored && (weekdayIncluded || Boolean(fixed));
    }

    const remainingDays = days.filter((day) => day.key >= todayKey && participates(day));
    const weekendExtra = Number(specs.weekendExtra || 0);
    const fixedTotal = remainingDays.reduce((sum, day) => sum + Number(fixedDays[day.key]?.amount || 0), 0);
    const weekendExtraTotal = remainingDays.reduce((sum, day) => {
      if (fixedDays[day.key] || !day.isWeekend) return sum;
      return sum + weekendExtra;
    }, 0);
    const flexibleBudget = Math.max(available - fixedTotal - weekendExtraTotal, 0);
    const totalWeight = remainingDays.reduce((sum, day) => {
      if (fixedDays[day.key]) return sum;
      return sum + (day.isWeekend ? Number(specs.weekendMultiplier || 1) : 1);
    }, 0);

    const enriched = days.map((day) => {
      const fixed = fixedDays[day.key];
      const ignored = ignoredDays[day.key];
      const past = day.key < todayKey;
      const weekdayIncluded = includedWeekdays.includes(day.weekday);
      const includedInDistribution = participates(day);
      const base = fixed
        ? Number(fixed.amount || 0)
        : !past && includedInDistribution && totalWeight
          ? (flexibleBudget * (day.isWeekend ? Number(specs.weekendMultiplier || 1) : 1)) / totalWeight
          : 0;
      const suggested = day.isWeekend && !fixed && !past && includedInDistribution ? base + weekendExtra : base;
      const spent = monthTransactions
        .filter((transaction) => String(transaction.date || "").slice(0, 10) === day.key && transaction.type === "expense")
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
      return {
        ...day,
        past,
        fixed,
        ignored,
        weekdayIncluded,
        includedInDistribution,
        suggested,
        spent,
        availableAfterSpent: suggested - spent
      };
    });

    return {
      days: enriched,
      income,
      expenses,
      available,
      limitsBudget,
      generalLimitBudget,
      limitsCount: (summary?.limits || []).length,
      remainingDays: remainingDays.length,
      ignoredDays: days.filter((day) => !participates(day)).length,
      fixedTotal,
      weekendExtraTotal,
      flexibleBudget
    };
  }, [month, specs, summary, transactions]);

  const selectedDay = selectedDayKey ? calendar.days.find((day) => day.key === selectedDayKey) : null;
  const selectedMonthLabel = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
  }, [month]);

  function updateSpec(key, value) {
    setSpecs((current) => ({ ...current, [key]: value }));
  }

  function toggleWeekday(value) {
    setSpecs((current) => {
      const active = new Set(Array.isArray(current.includedWeekdays) ? current.includedWeekdays : defaultWeekdays);
      if (active.has(value)) active.delete(value);
      else active.add(value);
      return {
        ...current,
        includedWeekdays: defaultWeekdays.filter((day) => active.has(day))
      };
    });
  }

  function addFixedDay(event) {
    event.preventDefault();
    if (!form.date || !form.amount) return;
    setSpecs((current) => {
      const ignoredDays = { ...(current.ignoredDays || {}) };
      delete ignoredDays[form.date];
      return {
        ...current,
        ignoredDays,
        fixedDays: {
          ...(current.fixedDays || {}),
          [form.date]: {
            amount: Number(form.amount),
            note: form.note
          }
        }
      };
    });
    setForm({ date: form.date, amount: "", note: "" });
  }

  function removeFixedDay(dayKey) {
    setSpecs((current) => {
      const next = { ...current.fixedDays };
      delete next[dayKey];
      return { ...current, fixedDays: next };
    });
  }

  function openDayDialog(day) {
    setSelectedDayKey(day.key);
    setDayForm({
      amount: day.fixed?.amount ?? "",
      note: day.fixed?.note || day.ignored?.note || ""
    });
  }

  function closeDayDialog() {
    setSelectedDayKey(null);
    setDayForm({ amount: "", note: "" });
  }

  function dedicateSelectedDay(event) {
    event.preventDefault();
    if (!selectedDayKey || !dayForm.amount) return;
    setSpecs((current) => {
      const ignoredDays = { ...(current.ignoredDays || {}) };
      delete ignoredDays[selectedDayKey];
      return {
        ...current,
        ignoredDays,
        fixedDays: {
          ...(current.fixedDays || {}),
          [selectedDayKey]: {
            amount: Number(dayForm.amount),
            note: dayForm.note
          }
        }
      };
    });
    closeDayDialog();
  }

  function ignoreSelectedDay() {
    if (!selectedDayKey) return;
    setSpecs((current) => {
      const fixedDays = { ...(current.fixedDays || {}) };
      delete fixedDays[selectedDayKey];
      return {
        ...current,
        fixedDays,
        ignoredDays: {
          ...(current.ignoredDays || {}),
          [selectedDayKey]: {
            note: dayForm.note || "Ignorado manualmente"
          }
        }
      };
    });
    closeDayDialog();
  }

  function reactivateSelectedDay() {
    if (!selectedDayKey) return;
    setSpecs((current) => {
      const ignoredDays = { ...(current.ignoredDays || {}) };
      delete ignoredDays[selectedDayKey];
      return { ...current, ignoredDays };
    });
    closeDayDialog();
  }

  function clearSelectedDayDedicatedValue() {
    if (!selectedDayKey) return;
    setSpecs((current) => {
      const fixedDays = { ...(current.fixedDays || {}) };
      delete fixedDays[selectedDayKey];
      return { ...current, fixedDays };
    });
    closeDayDialog();
  }

  return (
    <div className="workspace-page calendar-page space-y-6">
      {selectedDay ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-lg border border-white/10 bg-white p-5 shadow-2xl dark:bg-neutral-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Ajuste do dia</p>
                <h2 className="text-2xl font-black">{shortDate(selectedDay.key)}</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Defina um valor dedicado para esse dia ou remova ele da distribuição.
                </p>
              </div>
              <button className="rounded-lg border border-black/10 p-2 dark:border-white/10" onClick={closeDayDialog} type="button">
                <X size={18} />
              </button>
            </div>

            <form className="mt-5 grid gap-3" onSubmit={dedicateSelectedDay}>
              <label>
                <span className="text-sm font-medium">Valor dedicado</span>
                <input
                  className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10"
                  min="0"
                  type="number"
                  value={dayForm.amount}
                  onChange={(event) => setDayForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </label>
              <label>
                <span className="text-sm font-medium">Observação</span>
                <input
                  className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10"
                  placeholder="Ex: jantar, viagem, dia sem gasto..."
                  value={dayForm.note}
                  onChange={(event) => setDayForm((current) => ({ ...current, note: event.target.value }))}
                />
              </label>
              <button className="rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
                Dedicar valor específico
              </button>
            </form>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-black text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200" onClick={ignoreSelectedDay} type="button">
                Ignorar dia
              </button>
              {selectedDay.ignored ? (
                <button className="rounded-lg border border-black/10 px-4 py-3 font-black dark:border-white/10" onClick={reactivateSelectedDay} type="button">
                  Reativar dia
                </button>
              ) : null}
              {selectedDay.fixed ? (
                <button className="rounded-lg border border-black/10 px-4 py-3 font-black dark:border-white/10" onClick={clearSelectedDayDedicatedValue} type="button">
                  Remover valor dedicado
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <WorkspaceHeader
        description="Transforme seus limites em um valor diário possível e ajuste somente os dias que fogem da rotina."
        eyebrow="Calendário"
        title={`Planeje ${selectedMonthLabel}`}
      />
      <WorkspacePeriodControl
        description="O calendário recalcula os dias sempre que seus limites ou movimentações mudam."
        label="Mês planejado"
        onChange={setMonth}
        value={month}
      />

      {error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}

      <section className="guided-page-section" id="resumo-calendario">
        <GuidedSectionHeader
          description="O valor disponível vem dos limites ainda não utilizados, e não do saldo total da sua conta."
          icon={WalletCards}
          title="Veja quanto ainda pode distribuir"
        />
        <div className="calendar-metrics grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Limites disponíveis" primary value={currency(calendar.available)} tone={calendar.available >= 0 ? "safe" : "danger"} />
          <Metric label="Dias na distribuição" value={calendar.remainingDays} />
          <Metric label="Saídas do mês" value={currency(calendar.expenses)} tone="danger" />
          <Metric label="Entradas do mês" value={currency(calendar.income)} />
          <Metric label="Limites cadastrados" value={calendar.limitsCount || "Teto geral"} />
        </div>
      </section>

      <section className="calendar-workspace grid gap-4 xl:grid-cols-[1.28fr_0.72fr]">
        <div className="calendar-settings space-y-4" id="ajustes-calendario">
          <GuidedSectionHeader
            description="Escolha dias da semana, dê mais peso aos fins de semana e reserve valores para situações específicas."
            icon={SlidersHorizontal}
            title="Ajuste somente o que for exceção"
          />
          <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
            <div className="flex items-center gap-2">
              <CalendarDays className="text-emerald-500" size={20} />
              <h2 className="text-xl font-black">Pesos e extras</h2>
            </div>
            <div className="mt-4 grid gap-3">
              <label>
                <span className="text-sm font-medium">Peso dos fins de semana</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" min="1" step="0.05" type="number" value={specs.weekendMultiplier} onChange={(event) => updateSpec("weekendMultiplier", event.target.value)} />
              </label>
              <label>
                <span className="text-sm font-medium">Extra por fim de semana</span>
                <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="number" value={specs.weekendExtra} onChange={(event) => updateSpec("weekendExtra", event.target.value)} />
              </label>
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Use o peso para dar mais verba proporcional aos fins de semana. O extra é somado depois da divisão automática.
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
            <h2 className="text-xl font-black">Dias da semana</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Desmarque os dias que não devem receber valor na distribuição automática.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {weekdayOptions.map((weekday) => {
                const active = (specs.includedWeekdays || defaultWeekdays).includes(weekday.value);
                return (
                  <button
                    aria-pressed={active}
                    className={`rounded-lg border px-3 py-2 text-sm font-black transition ${
                      active
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-black/10 bg-stone-100 text-zinc-500 dark:border-white/10 dark:bg-neutral-800 dark:text-zinc-400"
                    }`}
                    key={weekday.value}
                    onClick={() => toggleWeekday(weekday.value)}
                    type="button"
                    title={weekday.label}
                  >
                    {weekday.short}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Um dia específico com valor dedicado continua entrando como exceção, mesmo que o dia da semana esteja desmarcado.
            </p>
          </section>

          <form className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900" onSubmit={addFixedDay}>
            <div className="flex items-center gap-2">
              <Plus className="text-emerald-500" size={20} />
              <h2 className="text-xl font-black">Reserva de valores</h2>
            </div>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Reserve um valor para um dia específico e o calendário redistribui o restante.
            </p>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="text-sm font-medium">Dia específico</span>
                  <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
                </label>
                <label>
                  <span className="text-sm font-medium">Valor reservado</span>
                  <input className="mt-1 w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="number" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} />
                </label>
              </div>
              <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="Motivo: jantar, viagem, presente..." value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
                <Plus size={18} />
                Reservar dia
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
            <h2 className="text-xl font-black">Dias fixados</h2>
            <div className="mt-3 space-y-2">
              {Object.entries(specs.fixedDays).map(([key, item]) => (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-100 p-3 dark:bg-neutral-800" key={key}>
                  <div>
                    <p className="font-black">{shortDate(key)} · {currency(item.amount)}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.note || "Sem observação"}</p>
                  </div>
                  <button className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => removeFixedDay(key)} type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {!Object.keys(specs.fixedDays).length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum dia fixado ainda.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900">
            <h2 className="text-xl font-black">Dias ignorados</h2>
            <div className="mt-3 space-y-2">
              {Object.entries(specs.ignoredDays || {}).map(([key, item]) => (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-100 p-3 dark:bg-neutral-800" key={key}>
                  <div>
                    <p className="font-black">{shortDate(key)}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.note || "Ignorado manualmente"}</p>
                  </div>
                  <button className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => setSpecs((current) => {
                    const ignoredDays = { ...(current.ignoredDays || {}) };
                    delete ignoredDays[key];
                    return { ...current, ignoredDays };
                  })} type="button">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {!Object.keys(specs.ignoredDays || {}).length ? <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum dia ignorado manualmente.</p> : null}
            </div>
          </div>
        </div>

        <div className="calendar-board-wrap" id="calendario-mensal">
          <GuidedSectionHeader
            description="Cada dia mostra a sugestão de gasto e o que já foi usado. Toque em uma data para dedicar um valor ou ignorá-la."
            icon={CalendarDays}
            title="Leia seu mês dia a dia"
          />
          <div className="calendar-board rounded-lg border border-black/5 bg-white p-2 shadow-soft dark:border-white/10 dark:bg-neutral-900 sm:p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-black uppercase text-zinc-500 dark:text-zinc-300">
            {weekdayOptions.map((day) => (
              <span key={day.value}>{day.short}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 sm:gap-2">
            {Array.from({ length: new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1).getDay() }).map((_, index) => (
              <div key={`blank-${index}`} />
            ))}
            {calendar.days.map((day) => (
              <button
                className={`min-h-24 rounded-lg border p-1.5 text-left text-[0.66rem] transition hover:-translate-y-0.5 hover:shadow sm:min-h-32 sm:p-2 sm:text-sm ${
                  !day.includedInDistribution
                    ? "border-zinc-300 bg-zinc-200/80 text-zinc-500 dark:border-white/10 dark:bg-neutral-800/80 dark:text-zinc-400"
                    : day.past
                    ? "border-black/5 bg-stone-100 text-zinc-400 dark:border-white/5 dark:bg-neutral-800/60"
                    : day.availableAfterSpent < 0
                      ? "border-red-200 bg-red-50 text-red-950 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-50"
                      : "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-50"
                }`}
                key={day.key}
                onClick={() => openDayDialog(day)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <p className="font-black">{day.day}</p>
                  <div className="flex flex-wrap justify-end gap-1">
                    {day.isWeekend ? <span className="hidden rounded-full bg-black/10 px-2 py-0.5 text-[0.65rem] font-black dark:bg-white/10 sm:inline-flex">fim</span> : null}
                    {!day.includedInDistribution ? <span className="hidden rounded-full bg-black/10 px-2 py-0.5 text-[0.65rem] font-black dark:bg-white/10 sm:inline-flex">{day.ignored ? "ignorado" : "fora"}</span> : null}
                    {day.fixed ? <span className="hidden rounded-full bg-black/10 px-2 py-0.5 text-[0.65rem] font-black dark:bg-white/10 sm:inline-flex">fixo</span> : null}
                  </div>
                </div>
                <p className="mt-2 text-[0.56rem] opacity-70 dark:text-zinc-300 dark:opacity-100 sm:text-xs">Sugestão</p>
                <p className="font-black sm:hidden">{compactCurrency(day.suggested)}</p>
                <p className="hidden font-black sm:block">{currency(day.suggested)}</p>
                <p className="mt-1 text-[0.56rem] opacity-70 dark:text-zinc-300 dark:opacity-100 sm:text-xs">Gasto</p>
                <p className="font-bold sm:hidden">{compactCurrency(day.spent)}</p>
                <p className="hidden font-bold sm:block">{currency(day.spent)}</p>
                {day.fixed ? <p className="mt-2 hidden rounded bg-white/60 p-1 text-xs font-bold dark:bg-black/20 sm:block">{day.fixed.note || "Dia reservado"}</p> : null}
                {day.ignored ? <p className="mt-2 hidden rounded bg-white/60 p-1 text-xs font-bold dark:bg-black/20 sm:block">{day.ignored.note || "Ignorado manualmente"}</p> : null}
              </button>
            ))}
          </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, tone = "neutral", primary = false }) {
  const color = tone === "danger" ? "text-red-600 dark:text-red-300" : tone === "safe" ? "text-emerald-600 dark:text-emerald-300" : "";
  return (
    <div className={`calendar-metric rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900 ${primary ? "primary" : ""}`}>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-2 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}
