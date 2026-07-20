import { useState } from "react";
import { Check, UserRound, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { avatarOptions } from "../utils/avatars";

export function AvatarOnboarding({ onFinished }) {
  const { user, updateProfile } = useAuth();
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const open = Boolean(user && !user.avatarUrl && !user.onboarding?.avatarPromptDismissed);

  if (!open) return null;

  async function confirmAvatar() {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await updateProfile({ avatarUrl: selected, onboarding: { avatarPromptDismissed: true } });
      onFinished?.();
    } catch (avatarError) {
      setError(avatarError?.response?.data?.message || avatarError.message || "Não foi possível salvar seu avatar.");
    } finally {
      setSaving(false);
    }
  }

  async function dismissAvatar() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await updateProfile({ onboarding: { avatarPromptDismissed: true } });
      onFinished?.();
    } catch (avatarError) {
      setError(avatarError?.response?.data?.message || avatarError.message || "Não foi possível fechar esta etapa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div aria-labelledby="avatar-onboarding-title" aria-modal="true" className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-neutral-950/75 p-3 backdrop-blur-sm sm:p-6" role="dialog">
      <section className="avatar-onboarding-dialog my-auto w-full max-w-4xl overflow-hidden rounded-lg border border-white/10 bg-white shadow-2xl dark:bg-neutral-900">
        <button aria-label="Escolher avatar depois" className="avatar-onboarding-close" disabled={saving} onClick={dismissAvatar} type="button"><X size={19} /></button>
        <div className="border-b border-black/5 px-5 py-4 dark:border-white/10 sm:px-7 sm:py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white"><UserRound size={22} /></span>
            <div>
              <p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">Seu primeiro passo</p>
              <h2 className="text-xl font-black sm:text-2xl" id="avatar-onboarding-title">Escolha como você aparece na Better Way</h2>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">Esta imagem identifica seu perfil e aparece para seus amigos. Você poderá trocá-la depois em Perfil.</p>
        </div>

        <div className="grid max-h-[58vh] grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-5 sm:gap-3 sm:p-6">
          {avatarOptions.map((avatar) => {
            const active = selected === avatar.value;
            return (
              <button
                aria-pressed={active}
                className={`group relative rounded-lg border p-2 text-left transition duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${active ? "border-emerald-500 bg-emerald-500/10" : "border-black/10 hover:border-emerald-400 dark:border-white/10"}`}
                key={avatar.value}
                onClick={() => setSelected(avatar.value)}
                type="button"
              >
                <span className="relative block aspect-square overflow-hidden rounded-lg bg-stone-100 dark:bg-neutral-800">
                  <img alt={`Avatar ${avatar.label}`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" src={avatar.src} />
                  {active ? <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white shadow-lg"><Check size={16} strokeWidth={3} /></span> : null}
                </span>
                <strong className="mt-2 block truncate text-center text-sm">{avatar.label}</strong>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-black/5 px-5 py-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Selecione uma imagem para continuar.</p>
            {error ? <p className="mt-1 text-sm font-medium text-red-600" role="alert">{error}</p> : null}
          </div>
          <button className="rounded-lg bg-emerald-500 px-6 py-3 font-black text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selected || saving} onClick={confirmAvatar} type="button">
            {saving ? "Salvando..." : "Usar este avatar"}
          </button>
        </div>
      </section>
    </div>
  );
}
