import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function toInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseInputDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDisplayDate(value) {
  if (!value) return "Selecionar data";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(parseInputDate(value));
}

function buildCalendarDays(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return {
      date: day,
      key: toInputDate(day),
      inCurrentMonth: day.getMonth() === month
    };
  });
}

export function DatePickerField({ label = "Data", value, onChange }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseInputDate(value));
  const days = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(viewDate);
  const today = toInputDate(new Date());

  function moveMonth(direction) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
  }

  function selectDate(nextValue) {
    onChange(nextValue);
    setViewDate(parseInputDate(nextValue));
    setOpen(false);
  }

  return (
    <div className="relative">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
      <button
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-black/10 bg-white px-3 py-3 text-left text-sm font-semibold text-zinc-900 shadow-sm transition hover:border-emerald-400 dark:border-white/10 dark:bg-neutral-950 dark:text-zinc-50"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{formatDisplayDate(value)}</span>
        <CalendarDays className="text-emerald-500" size={18} />
      </button>

      {open ? (
        <div className="absolute left-0 z-30 mt-2 w-full min-w-[19rem] rounded-lg border border-black/10 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-neutral-950">
          <div className="flex items-center justify-between gap-3">
            <button className="rounded-lg border border-black/10 p-2 text-zinc-600 dark:border-white/10 dark:text-zinc-300" onClick={() => moveMonth(-1)} type="button">
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-black capitalize">{monthLabel}</p>
            <button className="rounded-lg border border-black/10 p-2 text-zinc-600 dark:border-white/10 dark:text-zinc-300" onClick={() => moveMonth(1)} type="button">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-black uppercase text-zinc-400">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const selected = day.key === value;
              const isToday = day.key === today;
              return (
                <button
                  className={`aspect-square rounded-lg text-sm font-bold transition ${
                    selected
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                      : isToday
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : day.inCurrentMonth
                          ? "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-white/10"
                          : "text-zinc-300 hover:bg-zinc-50 dark:text-zinc-700 dark:hover:bg-white/5"
                  }`}
                  key={day.key}
                  onClick={() => selectDate(day.key)}
                  type="button"
                >
                  {day.date.getDate()}
                </button>
              );
            })}
          </div>

          <button className="mt-3 w-full rounded-lg bg-zinc-100 px-3 py-2 text-sm font-black text-zinc-700 dark:bg-white/10 dark:text-zinc-200" onClick={() => selectDate(today)} type="button">
            Usar hoje
          </button>
        </div>
      ) : null}
    </div>
  );
}
