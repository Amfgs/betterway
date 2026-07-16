import { useEffect, useState } from "react";
import { Check, Clock3, Plus, Target, Trash2, UserPlus, Users, WalletCards, X } from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { WorkspaceHeader } from "../components/WorkspaceHeader";
import { categoryOptions } from "../utils/formatters";

const defaultGoalDate = new Date(new Date().getFullYear(), new Date().getMonth() + 4, 1).toISOString().slice(0, 10);

export function FriendsPage() {
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendUsername, setFriendUsername] = useState("");
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
    setIncomingRequests(response.data.incomingRequests || []);
    setOutgoingRequests(response.data.outgoingRequests || []);
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
      const response = await api.post("/friends", { username: friendUsername });
      setFriendUsername("");
      setMessage(response.data.message || "Pedido de amizade enviado.");
      await loadFriends();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function acceptFriend(id) {
    clearFeedback();
    try {
      const response = await api.post(`/friends/${id}/accept`);
      setMessage(response.data.message || "Pedido de amizade aceito.");
      await loadFriends();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function removeRequest(id, label) {
    clearFeedback();
    try {
      await api.delete(`/friends/requests/${id}`);
      setMessage(label);
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
    <div className="workspace-page space-y-6">
      <WorkspaceHeader
        actions={<div className="workspace-header-metric"><span>Amigos conectados</span><strong>{friends.length}</strong></div>}
        description="Convide pessoas próximas e transforme objetivos compartilhados em acordos claros e acompanháveis."
        eyebrow="Construir junto"
        title="Metas e limites que todos entendem"
      />

      {error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}
      {message ? <p className="rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{message}</p> : null}

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900">
          <div className="flex items-center gap-3">
            <Users className="text-emerald-500" size={24} />
            <div>
              <h2 className="text-xl font-black">Lista de amigos</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Encontre alguém pelo nome de usuário público.</p>
            </div>
          </div>
          <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={addFriend}>
            <input
              className="min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10"
              autoCapitalize="none"
              autoComplete="off"
              maxLength={24}
              placeholder="@nome.usuario"
              type="text"
              value={friendUsername}
              onChange={(event) => setFriendUsername(event.target.value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, ""))}
              required
            />
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white" type="submit">
              <UserPlus size={18} />
              Adicionar
            </button>
          </form>
          {incomingRequests.length ? (
            <div className="mt-5 space-y-2">
              <p className="flex items-center gap-2 text-sm font-black"><UserPlus size={16} /> Pedidos recebidos</p>
              {incomingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-black">{request.name}</p>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">@{request.username}</p>
                  </div>
                  <div className="flex gap-2">
                    <button aria-label={`Aceitar ${request.name}`} className="rounded-lg bg-emerald-500 p-2 text-white" onClick={() => acceptFriend(request.id)} title="Aceitar pedido" type="button"><Check size={16} /></button>
                    <button aria-label={`Recusar ${request.name}`} className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => removeRequest(request.id, "Pedido recusado.")} title="Recusar pedido" type="button"><X size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          {outgoingRequests.length ? (
            <div className="mt-5 space-y-2">
              <p className="flex items-center gap-2 text-sm font-black"><Clock3 size={16} /> Aguardando aceite</p>
              {outgoingRequests.map((request) => (
                <div key={request.id} className="flex items-center justify-between gap-3 rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
                  <div className="min-w-0">
                    <p className="truncate font-black">{request.name}</p>
                    <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">@{request.username}</p>
                  </div>
                  <button className="rounded-lg border border-black/10 px-3 py-2 text-xs font-bold text-zinc-500 dark:border-white/10" onClick={() => removeRequest(request.id, "Pedido cancelado.")} type="button">Cancelar</button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-5 space-y-2">
            <p className="text-sm font-black">Amizades aceitas</p>
            {friends.map((friend) => (
              <div key={friend.id} className="flex items-center justify-between gap-3 rounded-lg bg-stone-100 p-3 dark:bg-neutral-800">
                <div>
                  <p className="font-black">{friend.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">@{friend.username}</p>
                </div>
                <button className="rounded-lg border border-black/10 p-2 text-zinc-500 dark:border-white/10" onClick={() => deleteFriend(friend.id)} type="button" title="Remover amigo">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {!friends.length ? (
              <p className="rounded-lg bg-stone-100 p-3 text-sm text-zinc-500 dark:bg-neutral-800 dark:text-zinc-400">
                Nenhuma amizade aceita ainda. Envie um pedido e aguarde a confirmação da outra pessoa.
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
