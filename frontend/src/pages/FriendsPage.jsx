import { useEffect, useState } from "react";
import { Plus, Target, Trash2, UserPlus, Users, WalletCards } from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { categoryOptions } from "../utils/formatters";

const defaultGoalDate = new Date(new Date().getFullYear(), new Date().getMonth() + 4, 1).toISOString().slice(0, 10);

export function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [sharedGoalForm, setSharedGoalForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    dueDate: defaultGoalDate,
    participantIds: []
  });
  const [sharedLimitForm, setSharedLimitForm] = useState({
    category: "Alimentacao",
    amount: "",
    participantIds: []
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadFriends() {
    const response = await api.get("/friends");
    setFriends(response.data.friends || []);
  }

  useEffect(() => {
    loadFriends().catch((err) => setError(getErrorMessage(err)));
  }, []);

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  async function addFriend(event) {
    event.preventDefault();
    clearFeedback();
    try {
      await api.post("/friends", { email: friendEmail });
      setFriendEmail("");
      setMessage("Amigo adicionado.");
      await loadFriends();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function deleteFriend(id) {
    clearFeedback();
    try {
      await api.delete(`/friends/${id}`);
      setMessage("Amigo removido.");
      await loadFriends();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function toggleParticipant(kind, id) {
    const setter = kind === "goal" ? setSharedGoalForm : setSharedLimitForm;
    setter((current) => {
      const exists = current.participantIds.includes(id);
      return {
        ...current,
        participantIds: exists ? current.participantIds.filter((item) => item !== id) : [...current.participantIds, id]
      };
    });
  }

  async function createSharedGoal(event) {
    event.preventDefault();
    clearFeedback();
    try {
      await api.post("/goals", sharedGoalForm);
      setSharedGoalForm({
        name: "",
        targetAmount: "",
        currentAmount: "",
        dueDate: sharedGoalForm.dueDate,
        participantIds: []
      });
      setMessage("Meta compartilhada criada.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function createSharedLimit(event) {
    event.preventDefault();
    clearFeedback();
    try {
      await api.post("/limits", sharedLimitForm);
      setSharedLimitForm({
        category: sharedLimitForm.category,
        amount: "",
        participantIds: []
      });
      setMessage("Limite compartilhado criado.");
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const selectedGoalFriends = friends.filter((friend) => sharedGoalForm.participantIds.includes(friend.id));
  const selectedLimitFriends = friends.filter((friend) => sharedLimitForm.participantIds.includes(friend.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Amigos</p>
          <h1 className="text-3xl font-black">Metas e limites em conjunto</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500 dark:text-zinc-400">
            Adicione usuários cadastrados para dividir metas, combinar limites e acompanhar decisões financeiras compartilhadas.
          </p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white px-4 py-3 shadow-soft dark:border-white/10 dark:bg-neutral-900">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Amigos conectados</p>
          <p className="text-2xl font-black">{friends.length}</p>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}
      {message ? <p className="rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{message}</p> : null}

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900">
          <div className="flex items-center gap-3">
            <Users className="text-emerald-500" size={24} />
            <div>
              <h2 className="text-xl font-black">Lista de amigos</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Use o email da conta cadastrada no Valorize+.</p>
            </div>
          </div>
          <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={addFriend}>
            <input
              className="min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10"
              placeholder="email do amigo cadastrado"
              type="email"
              value={friendEmail}
              onChange={(event) => setFriendEmail(event.target.value)}
              required
            />
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
              <UserPlus size={18} />
              Adicionar
            </button>
          </form>
          <div className="mt-5 space-y-2">
            {friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between gap-3 rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
                <div>
                  <p className="font-black">{friend.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{friend.email}</p>
                </div>
                <button className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => deleteFriend(friend.id)} type="button" title="Remover amigo">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {!friends.length ? (
              <p className="rounded-lg bg-stone-100 p-3 text-sm text-zinc-500 dark:bg-neutral-800 dark:text-zinc-400">
                Crie outra conta no cadastro e adicione o email aqui para testar metas e limites compartilhados.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4">
          <form className="rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900" onSubmit={createSharedGoal}>
            <div className="flex items-center gap-3">
              <Target className="text-emerald-500" size={22} />
              <div>
                <h2 className="text-xl font-black">Meta em conjunto</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Escolha quem participa da caixinha compartilhada.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="Nome da meta compartilhada" value={sharedGoalForm.name} onChange={(event) => setSharedGoalForm((current) => ({ ...current, name: event.target.value }))} required />
              <div className="grid gap-3 sm:grid-cols-3">
                <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="Valor alvo" type="number" value={sharedGoalForm.targetAmount} onChange={(event) => setSharedGoalForm((current) => ({ ...current, targetAmount: event.target.value }))} required />
                <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="Já aportado" type="number" value={sharedGoalForm.currentAmount} onChange={(event) => setSharedGoalForm((current) => ({ ...current, currentAmount: event.target.value }))} />
                <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" type="date" value={sharedGoalForm.dueDate} onChange={(event) => setSharedGoalForm((current) => ({ ...current, dueDate: event.target.value }))} required />
              </div>
              <FriendPicker friends={friends} selectedIds={sharedGoalForm.participantIds} onToggle={(id) => toggleParticipant("goal", id)} selectedFriends={selectedGoalFriends} />
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
                <Plus size={18} />
                Criar meta conjunta
              </button>
            </div>
          </form>

          <form className="rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900" onSubmit={createSharedLimit}>
            <div className="flex items-center gap-3">
              <WalletCards className="text-emerald-500" size={22} />
              <div>
                <h2 className="text-xl font-black">Limite em conjunto</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Defina um teto compartilhado por categoria.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <select className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" value={sharedLimitForm.category} onChange={(event) => setSharedLimitForm((current) => ({ ...current, category: event.target.value }))}>
                  {categoryOptions.filter((category) => !["Renda", "Freelance"].includes(category.value)).map((category) => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
                <input className="rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" placeholder="Valor do limite" type="number" value={sharedLimitForm.amount} onChange={(event) => setSharedLimitForm((current) => ({ ...current, amount: event.target.value }))} required />
              </div>
              <FriendPicker friends={friends} selectedIds={sharedLimitForm.participantIds} onToggle={(id) => toggleParticipant("limit", id)} selectedFriends={selectedLimitFriends} />
              <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
                <Plus size={18} />
                Criar limite conjunto
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function FriendPicker({ friends, selectedIds, selectedFriends, onToggle }) {
  return (
    <div>
      <p className="text-sm font-medium">Participantes</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {friends.map((friend) => (
          <button
            key={friend.id}
            className={`rounded-full px-3 py-2 text-sm font-bold ${
              selectedIds.includes(friend.id)
                ? "bg-emerald-500 text-white"
                : "bg-stone-100 text-zinc-600 dark:bg-neutral-800 dark:text-zinc-300"
            }`}
            onClick={() => onToggle(friend.id)}
            type="button"
          >
            {friend.name}
          </button>
        ))}
      </div>
      {!friends.length ? <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Adicione amigos antes de compartilhar.</p> : null}
      {selectedFriends.length ? (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          Participando: {selectedFriends.map((friend) => friend.name).join(", ")}
        </p>
      ) : null}
    </div>
  );
}
