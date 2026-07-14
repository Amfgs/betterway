import { X } from "lucide-react";
import { currency } from "../utils/formatters";

export function OpportunityModal({ opportunity, onClose }) {
  if (!opportunity) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div className="w-full max-w-xl rounded-lg border border-white/10 bg-white p-5 shadow-2xl dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Raio-X da Compra</p>
            <h2 className="mt-1 text-2xl font-black">Antes do próximo gasto, olha isso.</h2>
          </div>
          <button className="rounded-lg border border-black/10 p-2 dark:border-white/10" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Meta adiada</p>
            <p className="text-xl font-black">{opportunity.daysDelayed} dias</p>
          </div>
          <div className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Juros em 3 anos</p>
            <p className="text-xl font-black">{currency(opportunity.futureValue)}</p>
          </div>
          <div className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Horas de trabalho</p>
            <p className="text-xl font-black">{opportunity.hoursWorked.toFixed(1)}h</p>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {opportunity.messages.map((message) => (
            <p key={message} className="rounded-lg border border-black/5 p-3 text-sm dark:border-white/10">
              {message}
            </p>
          ))}
        </div>
        <button className="mt-5 w-full rounded-lg bg-emerald-500 px-4 py-3 font-bold text-white" onClick={onClose} type="button">
          Entendi o custo real
        </button>
      </div>
    </div>
  );
}
