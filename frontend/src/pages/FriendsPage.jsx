import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Check, ChevronRight, Clock3, Plus, Search, Send, Target, Trash2, UserPlus, Users, WalletCards, X } from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { MobileSectionNav, WorkspaceHeader } from "../components/WorkspaceHeader";
import { useAuth } from "../context/AuthContext";
import { avatarSrc } from "../utils/avatars";
import { categoryLabel, categoryOptions, currency } from "../utils/formatters";

const defaultGoalDate = new Date(new Date().getFullYear(), new Date().getMonth() + 4, 1).toISOString().slice(0, 10);

function includesParticipant(item, friendId) {
  return (item.participantIds || []).some((id) => String(id) === String(friendId));
}

function PersonIdentity({ person, size = "h-12 w-12" }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img alt={`Avatar de ${person.name}`} className={`${size} shrink-0 rounded-lg object-cover`} src={avatarSrc(person.avatarUrl)} />
      <div className="min-w-0">
        <p className="truncate font-black">{person.name}</p>
        <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">@{person.username}</p>
      </div>
    </div>
  );
}

export function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [goals, setGoals] = useState([]);
  const [limits, setLimits] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  const [planMode, setPlanMode] = useState("goal");
  const [sharedGoalForm, setSharedGoalForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    dueDate: defaultGoalDate
  });
  const [sharedLimitForm, setSharedLimitForm] = useState({ category: "Alimentacao", amount: "" });
  const [counterProposal, setCounterProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const plansRef = useRef(null);

  async function loadWorkspace() {
    const [friendsResponse, goalsResponse, limitsResponse, proposalsResponse] = await Promise.all([
      api.get("/friends"),
      api.get("/goals"),
      api.get("/limits"),
      api.get("/shared-plans")
    ]);
    setFriends(friendsResponse.data.friends || []);
    setIncomingRequests(friendsResponse.data.incomingRequests || []);
    setOutgoingRequests(friendsResponse.data.outgoingRequests || []);
    setGoals(goalsResponse.data.goals || []);
    setLimits(limitsResponse.data.limits || []);
    setProposals(proposalsResponse.data.proposals || []);
  }

  useEffect(() => {
    loadWorkspace()
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedFriendId && !friends.some((friend) => friend.id === selectedFriendId)) setSelectedFriendId("");
  }, [friends, selectedFriendId]);

  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId) || null;
  const sharedPlans = useMemo(() => ({
    goals: selectedFriend ? goals.filter((goal) => includesParticipant(goal, selectedFriend.id)) : [],
    limits: selectedFriend ? limits.filter((limit) => includesParticipant(limit, selectedFriend.id)) : []
  }), [goals, limits, selectedFriend]);
  const sharedProposals = useMemo(() => selectedFriend
    ? proposals.filter((proposal) => (proposal.participantIds || []).some((id) => String(id) === String(selectedFriend.id)))
    : [], [proposals, selectedFriend]);
  const requestCount = incomingRequests.length + outgoingRequests.length;

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function selectFriend(friendId) {
    const willClose = selectedFriendId === friendId;
    setSelectedFriendId(willClose ? "" : friendId);
    setCounterProposal(null);
    if (willClose) return;
    window.requestAnimationFrame(() => {
      if (window.innerWidth < 768) plansRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function addFriend(event) {
    event.preventDefault();
    clearFeedback();
    setWorking("add");
    try {
      const response = await api.post("/friends", { username: friendUsername });
      setFriendUsername("");
      setMessage(response.data.message || "Pedido de amizade enviado.");
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  async function acceptFriend(id) {
    clearFeedback();
    setWorking(id);
    try {
      const response = await api.post(`/friends/${id}/accept`);
      setMessage(response.data.message || "Pedido de amizade aceito.");
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  async function removeRequest(id, label) {
    clearFeedback();
    setWorking(id);
    try {
      await api.delete(`/friends/requests/${id}`);
      setMessage(label);
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  async function deleteFriend() {
    if (!selectedFriend || !window.confirm(`Remover ${selectedFriend.name} da sua lista de amigos?`)) return;
    clearFeedback();
    setWorking("remove");
    try {
      await api.delete(`/friends/${selectedFriend.id}`);
      setSelectedFriendId("");
      setMessage("Amigo removido.");
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  async function createSharedGoal(event) {
    event.preventDefault();
    if (!selectedFriend) return;
    clearFeedback();
    setWorking("goal");
    try {
      await api.post("/shared-plans", { friendId: selectedFriend.id, kind: "goal", terms: sharedGoalForm });
      setSharedGoalForm((current) => ({ ...current, name: "", targetAmount: "", currentAmount: "" }));
      setMessage(`Proposta de meta enviada para ${selectedFriend.name}.`);
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  async function createSharedLimit(event) {
    event.preventDefault();
    if (!selectedFriend) return;
    clearFeedback();
    setWorking("limit");
    try {
      await api.post("/shared-plans", { friendId: selectedFriend.id, kind: "limit", terms: sharedLimitForm });
      setSharedLimitForm((current) => ({ ...current, amount: "" }));
      setMessage(`Proposta de limite enviada para ${selectedFriend.name}.`);
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  async function respondToProposal(proposal, action) {
    clearFeedback();
    setWorking(`${action}-${proposal.id}`);
    try {
      const response = await api.post(`/shared-plans/${proposal.id}/${action}`);
      setMessage(response.data.message);
      setCounterProposal(null);
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  function beginCounter(proposal) {
    setCounterProposal({
      id: proposal.id,
      kind: proposal.kind,
      terms: {
        ...proposal.terms,
        dueDate: proposal.terms?.dueDate ? String(proposal.terms.dueDate).slice(0, 10) : defaultGoalDate
      }
    });
  }

  async function submitCounter(event) {
    event.preventDefault();
    if (!counterProposal) return;
    clearFeedback();
    setWorking(`counter-${counterProposal.id}`);
    try {
      const response = await api.post(`/shared-plans/${counterProposal.id}/counter`, { terms: counterProposal.terms });
      setMessage(response.data.message);
      setCounterProposal(null);
      await loadWorkspace();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  function updateCounter(key, value) {
    setCounterProposal((current) => ({ ...current, terms: { ...current.terms, [key]: value } }));
  }

  return (
    <div className="workspace-page friends-page space-y-6">
      <WorkspaceHeader
        actions={<div className="workspace-header-metric"><span>Amizades</span><strong>{friends.length}</strong></div>}
        description="Veja suas amizades e escolha uma pessoa para construir metas ou limites em conjunto."
        eyebrow="Amigos"
        title="Sua rede financeira"
      />
      <MobileSectionNav sections={[
        { id: "amizades", label: "Amizades" },
        ...(selectedFriend ? [{ id: "planos-compartilhados", label: `Com ${selectedFriend.name.split(" ")[0]}` }] : [])
      ]} />

      {error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300" role="alert">{error}</p> : null}
      {message ? <p className="rounded-lg bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status">{message}</p> : null}

      <section className="grid items-start gap-4 xl:grid-cols-[0.9fr_1.1fr]" id="amizades">
        <div className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2"><Users className="text-emerald-500" size={20} /><h2 className="text-xl font-black">Amizades</h2></div>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Toque em uma pessoa para planejar em conjunto.</p>
            </div>
            {requestCount ? (
              <button className="rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-700 dark:text-emerald-300" onClick={() => setAddOpen(true)} type="button">
                {requestCount} {requestCount === 1 ? "pedido" : "pedidos"}
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {friends.map((friend) => {
              const active = friend.id === selectedFriendId;
              return (
                <button
                  aria-pressed={active}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition duration-200 ${active ? "border-emerald-500 bg-emerald-500/10" : "border-black/5 bg-stone-50 hover:border-emerald-400 hover:bg-emerald-500/5 dark:border-white/5 dark:bg-neutral-800"}`}
                  key={friend.id}
                  onClick={() => selectFriend(friend.id)}
                  type="button"
                >
                  <PersonIdentity person={friend} />
                  <ChevronRight className={`transition-transform ${active ? "rotate-90 text-emerald-600" : "text-zinc-400"}`} size={18} />
                </button>
              );
            })}
          </div>

          {!loading && !friends.length ? (
            <div className="mt-4 rounded-lg border border-dashed border-black/10 px-4 py-8 text-center dark:border-white/10">
              <UserPlus className="mx-auto text-emerald-500" size={28} />
              <p className="mt-3 font-black">Sua lista ainda está vazia</p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Use o botão verde para encontrar alguém pelo nome de usuário.</p>
            </div>
          ) : null}
          {loading ? <p className="mt-4 text-sm text-zinc-500">Carregando amizades...</p> : null}
        </div>

        <div ref={plansRef} id="planos-compartilhados">
          {selectedFriend ? (
            <section className="rounded-lg border border-black/5 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-neutral-900 sm:p-5">
              <div className="flex flex-col gap-4 border-b border-black/5 pb-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <PersonIdentity person={selectedFriend} size="h-16 w-16" />
                <button className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600 dark:border-red-500/30" disabled={working === "remove"} onClick={deleteFriend} type="button">
                  <Trash2 size={16} /> Remover amizade
                </button>
              </div>

              <div className="mt-5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">Planos compartilhados</p>
                    <h2 className="mt-1 text-xl font-black">Planeje com {selectedFriend.name.split(" ")[0]}</h2>
                  </div>
                  <span className="text-xs font-semibold text-zinc-500">{sharedPlans.goals.length + sharedPlans.limits.length} ativos</span>
                </div>

                {sharedPlans.goals.length || sharedPlans.limits.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {sharedPlans.goals.slice(0, 2).map((goal) => (
                      <div className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800" key={goal.id}>
                        <span className="flex items-center gap-2 text-xs font-black text-emerald-700 dark:text-emerald-300"><Target size={14} /> Meta</span>
                        <strong className="mt-2 block truncate">{goal.name}</strong>
                        <p className="mt-1 text-xs text-zinc-500">{currency(goal.currentAmount)} de {currency(goal.targetAmount)}</p>
                      </div>
                    ))}
                    {sharedPlans.limits.slice(0, 2).map((limit) => (
                      <div className="rounded-lg bg-stone-100 p-3 dark:bg-neutral-800" key={limit.id}>
                        <span className="flex items-center gap-2 text-xs font-black text-emerald-700 dark:text-emerald-300"><WalletCards size={14} /> Limite</span>
                        <strong className="mt-2 block truncate">{categoryLabel(limit.category)}</strong>
                        <p className="mt-1 text-xs text-zinc-500">{currency(limit.amount)} por mês</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg bg-stone-100 p-3 text-sm text-zinc-500 dark:bg-neutral-800 dark:text-zinc-400">Vocês ainda não têm planos compartilhados.</p>
                )}
              </div>

              <div className="mt-5 border-t border-black/5 pt-5 dark:border-white/10">
                <div className="flex items-end justify-between gap-3">
                  <div><p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">Aprovações</p><h3 className="mt-1 text-lg font-black">Propostas entre vocês</h3></div>
                  <span className="text-xs font-semibold text-zinc-500">{sharedProposals.filter((proposal) => proposal.status === "pending").length} pendente(s)</span>
                </div>
                <div className="mt-3 grid gap-3">
                  {sharedProposals.map((proposal) => {
                    const incoming = proposal.status === "pending" && String(proposal.currentRecipientId) === String(user?.id);
                    const isCountering = counterProposal?.id === proposal.id;
                    return (
                      <article className={`rounded-lg border p-3 ${incoming ? "border-emerald-500/30 bg-emerald-500/5" : "border-black/5 bg-stone-50 dark:border-white/10 dark:bg-neutral-800"}`} key={proposal.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-300">{proposal.kind === "goal" ? <Target size={14} /> : <WalletCards size={14} />}{proposal.kind === "goal" ? "Meta" : "Limite"} · versão {proposal.revision}</span>
                            <strong className="mt-1 block">{proposal.kind === "goal" ? proposal.terms?.name : categoryLabel(proposal.terms?.category)}</strong>
                            <p className="mt-1 text-xs text-zinc-500">{proposal.kind === "goal" ? `${currency(proposal.terms?.targetAmount)} até ${new Date(proposal.terms?.dueDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : `${currency(proposal.terms?.amount)} por mês`}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${proposal.status === "accepted" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : proposal.status === "rejected" ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{proposal.status === "accepted" ? "Aceita" : proposal.status === "rejected" ? "Recusada" : incoming ? "Sua decisão" : "Aguardando"}</span>
                        </div>

                        {incoming && !isCountering ? (
                          <div className="mt-3 grid grid-cols-3 gap-2">
                            <button className="rounded-lg bg-emerald-500 px-2 py-2 text-xs font-black text-white" disabled={Boolean(working)} onClick={() => respondToProposal(proposal, "accept")} type="button"><Check className="mr-1 inline" size={14} />Aceitar</button>
                            <button className="rounded-lg border border-black/10 px-2 py-2 text-xs font-black dark:border-white/10" disabled={Boolean(working)} onClick={() => beginCounter(proposal)} type="button"><ArrowLeftRight className="mr-1 inline" size={14} />Alterar</button>
                            <button className="rounded-lg border border-red-200 px-2 py-2 text-xs font-black text-red-600 dark:border-red-500/30" disabled={Boolean(working)} onClick={() => respondToProposal(proposal, "reject")} type="button"><X className="mr-1 inline" size={14} />Recusar</button>
                          </div>
                        ) : null}

                        {isCountering ? (
                          <form className="mt-3 grid gap-2 rounded-lg bg-white p-3 dark:bg-neutral-900" onSubmit={submitCounter}>
                            {proposal.kind === "goal" ? <><input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2.5 dark:border-white/10" maxLength={120} onChange={(event) => updateCounter("name", event.target.value)} required value={counterProposal.terms.name} /><div className="grid gap-2 sm:grid-cols-3"><input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2.5 dark:border-white/10" min="0.01" onChange={(event) => updateCounter("targetAmount", event.target.value)} required step="0.01" type="number" value={counterProposal.terms.targetAmount} /><input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2.5 dark:border-white/10" min="0" onChange={(event) => updateCounter("currentAmount", event.target.value)} step="0.01" type="number" value={counterProposal.terms.currentAmount} /><input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2.5 dark:border-white/10" onChange={(event) => updateCounter("dueDate", event.target.value)} required type="date" value={counterProposal.terms.dueDate} /></div></> : <div className="grid gap-2 sm:grid-cols-2"><select className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2.5 dark:border-white/10" onChange={(event) => updateCounter("category", event.target.value)} value={counterProposal.terms.category}>{categoryOptions.filter((category) => !["Renda", "Freelance"].includes(category.value)).map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select><input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-2.5 dark:border-white/10" min="0.01" onChange={(event) => updateCounter("amount", event.target.value)} required step="0.01" type="number" value={counterProposal.terms.amount} /></div>}
                            <div className="grid grid-cols-2 gap-2"><button className="rounded-lg border border-black/10 px-3 py-2 text-xs font-black dark:border-white/10" onClick={() => setCounterProposal(null)} type="button">Cancelar</button><button className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-white" disabled={Boolean(working)} type="submit"><Send className="mr-1 inline" size={14} />Enviar contraproposta</button></div>
                          </form>
                        ) : null}
                      </article>
                    );
                  })}
                  {!sharedProposals.length ? <p className="rounded-lg bg-stone-100 p-3 text-sm text-zinc-500 dark:bg-neutral-800 dark:text-zinc-400">Nenhuma proposta enviada entre vocês.</p> : null}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1 dark:bg-neutral-800" role="tablist">
                <button aria-selected={planMode === "goal"} className={`rounded-md px-3 py-2 text-sm font-black transition ${planMode === "goal" ? "bg-white text-emerald-700 shadow-sm dark:bg-neutral-700 dark:text-emerald-300" : "text-zinc-500"}`} onClick={() => setPlanMode("goal")} role="tab" type="button"><Target className="mr-2 inline" size={16} />Nova meta</button>
                <button aria-selected={planMode === "limit"} className={`rounded-md px-3 py-2 text-sm font-black transition ${planMode === "limit" ? "bg-white text-emerald-700 shadow-sm dark:bg-neutral-700 dark:text-emerald-300" : "text-zinc-500"}`} onClick={() => setPlanMode("limit")} role="tab" type="button"><WalletCards className="mr-2 inline" size={16} />Novo limite</button>
              </div>

              {planMode === "goal" ? (
                <form className="mt-4 grid gap-3" onSubmit={createSharedGoal}>
                  <label><span className="mb-1 block text-sm font-medium">Nome da meta</span><input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" maxLength={120} onChange={(event) => setSharedGoalForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Viagem de férias" required value={sharedGoalForm.name} /></label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label><span className="mb-1 block text-sm font-medium">Valor alvo</span><input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" min="0.01" onChange={(event) => setSharedGoalForm((current) => ({ ...current, targetAmount: event.target.value }))} placeholder="R$ 0,00" required step="0.01" type="number" value={sharedGoalForm.targetAmount} /></label>
                    <label><span className="mb-1 block text-sm font-medium">Já reservado</span><input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" min="0" onChange={(event) => setSharedGoalForm((current) => ({ ...current, currentAmount: event.target.value }))} placeholder="Opcional" step="0.01" type="number" value={sharedGoalForm.currentAmount} /></label>
                    <label><span className="mb-1 block text-sm font-medium">Prazo</span><input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" onChange={(event) => setSharedGoalForm((current) => ({ ...current, dueDate: event.target.value }))} required type="date" value={sharedGoalForm.dueDate} /></label>
                  </div>
                  <button className="rounded-lg bg-emerald-500 px-4 py-3 font-black text-white disabled:opacity-50" disabled={Boolean(working)} type="submit">{working === "goal" ? "Enviando..." : `Enviar proposta para ${selectedFriend.name.split(" ")[0]}`}</button>
                </form>
              ) : (
                <form className="mt-4 grid gap-3" onSubmit={createSharedLimit}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label><span className="mb-1 block text-sm font-medium">Categoria</span><select className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" onChange={(event) => setSharedLimitForm((current) => ({ ...current, category: event.target.value }))} value={sharedLimitForm.category}>{categoryOptions.filter((category) => !["Renda", "Freelance"].includes(category.value)).map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label>
                    <label><span className="mb-1 block text-sm font-medium">Valor mensal</span><input className="w-full rounded-lg border border-black/10 bg-transparent px-3 py-3 dark:border-white/10" min="0.01" onChange={(event) => setSharedLimitForm((current) => ({ ...current, amount: event.target.value }))} placeholder="R$ 0,00" required step="0.01" type="number" value={sharedLimitForm.amount} /></label>
                  </div>
                  <button className="rounded-lg bg-emerald-500 px-4 py-3 font-black text-white disabled:opacity-50" disabled={Boolean(working)} type="submit">{working === "limit" ? "Enviando..." : `Enviar proposta para ${selectedFriend.name.split(" ")[0]}`}</button>
                </form>
              )}
            </section>
          ) : (
            <section className="grid min-h-72 place-items-center rounded-lg border border-dashed border-black/10 bg-white p-8 text-center dark:border-white/10 dark:bg-neutral-900">
              <div><Users className="mx-auto text-emerald-500" size={32} /><h2 className="mt-3 text-xl font-black">Escolha uma amizade</h2><p className="mx-auto mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">Os planos daquela pessoa aparecerão aqui, junto com os atalhos para criar uma meta ou um limite compartilhado.</p></div>
            </section>
          )}
        </div>
      </section>

      <button aria-label="Adicionar amizade" className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-xl transition hover:scale-105 hover:bg-emerald-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 md:bottom-6 md:right-6" onClick={() => setAddOpen(true)} title="Adicionar amizade" type="button"><Plus size={26} strokeWidth={2.5} /></button>

      {addOpen ? (
        <div aria-labelledby="add-friend-title" aria-modal="true" className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddOpen(false); }} role="dialog">
          <section className="max-h-[86dvh] w-full max-w-xl overflow-y-auto rounded-t-lg bg-white p-5 shadow-2xl dark:bg-neutral-900 sm:rounded-lg">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400">Nova conexão</p><h2 className="mt-1 text-2xl font-black" id="add-friend-title">Adicionar amizade</h2></div>
              <button aria-label="Fechar" className="rounded-lg border border-black/10 p-2 dark:border-white/10" onClick={() => setAddOpen(false)} type="button"><X size={18} /></button>
            </div>

            <form className="mt-5" onSubmit={addFriend}>
              <label className="block"><span className="mb-1 block text-sm font-medium">Nome de usuário</span><div className="flex items-center gap-2 rounded-lg border border-black/10 px-3 dark:border-white/10"><Search className="shrink-0 text-zinc-400" size={18} /><input autoCapitalize="none" autoComplete="off" className="min-w-0 flex-1 bg-transparent py-3 outline-none" maxLength={24} onChange={(event) => setFriendUsername(event.target.value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, ""))} placeholder="nome.usuario" required type="text" value={friendUsername} /></div></label>
              <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 font-black text-white disabled:opacity-50" disabled={working === "add"} type="submit"><UserPlus size={18} />{working === "add" ? "Enviando..." : "Enviar pedido"}</button>
            </form>

            {incomingRequests.length ? <div className="mt-6"><p className="mb-2 flex items-center gap-2 text-sm font-black"><UserPlus size={16} /> Pedidos recebidos</p><div className="space-y-2">{incomingRequests.map((request) => <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3" key={request.id}><PersonIdentity person={request} /><div className="flex gap-2"><button aria-label={`Aceitar ${request.name}`} className="rounded-lg bg-emerald-500 p-2 text-white" disabled={working === request.id} onClick={() => acceptFriend(request.id)} type="button"><Check size={16} /></button><button aria-label={`Recusar ${request.name}`} className="rounded-lg border border-black/10 p-2 dark:border-white/10" disabled={working === request.id} onClick={() => removeRequest(request.id, "Pedido recusado.")} type="button"><X size={16} /></button></div></div>)}</div></div> : null}

            {outgoingRequests.length ? <div className="mt-6"><p className="mb-2 flex items-center gap-2 text-sm font-black"><Clock3 size={16} /> Aguardando aceite</p><div className="space-y-2">{outgoingRequests.map((request) => <div className="flex items-center justify-between gap-3 rounded-lg bg-stone-100 p-3 dark:bg-neutral-800" key={request.id}><PersonIdentity person={request} /><button className="rounded-lg border border-black/10 px-3 py-2 text-xs font-bold dark:border-white/10" disabled={working === request.id} onClick={() => removeRequest(request.id, "Pedido cancelado.")} type="button">Cancelar</button></div>)}</div></div> : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
