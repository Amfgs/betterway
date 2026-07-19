import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from "react-native";
import { apiRequest } from "../api/client";
import { Button, colors, styles } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { avatarSource } from "../utils/avatars";
import { categoryLabel, currency } from "../utils/formatters";

const categoryOptions = [
  "Alimentacao",
  "Transporte",
  "Saude",
  "Moradia",
  "Produtos Necessarios",
  "Lazer",
  "Educacao",
  "Investimentos",
  "Outros"
];
const defaultGoalDate = new Date(new Date().getFullYear(), new Date().getMonth() + 4, 1).toISOString().slice(0, 10);

function includesParticipant(item, friendId) {
  return (item.participantIds || []).some((id) => String(id) === String(friendId));
}

function Person({ person, large = false }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", flex: 1, gap: 11, minWidth: 0 }}>
      <Image source={avatarSource(person.avatarUrl)} style={{ borderRadius: 8, height: large ? 62 : 48, width: large ? 62 : 48 }} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: large ? 18 : 15, fontWeight: "900" }}>{person.name}</Text>
        <Text numberOfLines={1} style={styles.muted}>@{person.username}</Text>
      </View>
    </View>
  );
}

export function FriendsScreen() {
  const { token } = useAuth();
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [goals, setGoals] = useState([]);
  const [limits, setLimits] = useState([]);
  const [selectedFriendId, setSelectedFriendId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [friendUsername, setFriendUsername] = useState("");
  const [planMode, setPlanMode] = useState("goal");
  const [goalForm, setGoalForm] = useState({ name: "", targetAmount: "", currentAmount: "", dueDate: defaultGoalDate });
  const [limitForm, setLimitForm] = useState({ category: "Alimentacao", amount: "" });
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadWorkspace() {
    if (!token) return;
    const [friendData, goalData, limitData] = await Promise.all([
      apiRequest("/friends", { token }),
      apiRequest("/goals", { token }),
      apiRequest("/limits", { token })
    ]);
    setFriends(friendData.friends || []);
    setIncomingRequests(friendData.incomingRequests || []);
    setOutgoingRequests(friendData.outgoingRequests || []);
    setGoals(goalData.goals || []);
    setLimits(limitData.limits || []);
  }

  useEffect(() => {
    loadWorkspace().catch((loadError) => setError(loadError.message));
  }, [token]);

  useEffect(() => {
    if (selectedFriendId && !friends.some((friend) => friend.id === selectedFriendId)) setSelectedFriendId("");
  }, [friends, selectedFriendId]);

  const selectedFriend = friends.find((friend) => friend.id === selectedFriendId) || null;
  const selectedPlans = useMemo(() => ({
    goals: selectedFriend ? goals.filter((goal) => includesParticipant(goal, selectedFriend.id)) : [],
    limits: selectedFriend ? limits.filter((limit) => includesParticipant(limit, selectedFriend.id)) : []
  }), [goals, limits, selectedFriend]);

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  async function addFriend() {
    if (!friendUsername) return;
    clearFeedback();
    setWorking("add");
    try {
      const data = await apiRequest("/friends", { method: "POST", token, body: { username: friendUsername } });
      setFriendUsername("");
      setMessage(data.message || "Pedido de amizade enviado.");
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking("");
    }
  }

  async function acceptFriend(id) {
    clearFeedback();
    setWorking(id);
    try {
      const data = await apiRequest(`/friends/${id}/accept`, { method: "POST", token });
      setMessage(data.message || "Pedido aceito.");
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking("");
    }
  }

  async function removeRequest(id, feedback) {
    clearFeedback();
    setWorking(id);
    try {
      await apiRequest(`/friends/requests/${id}`, { method: "DELETE", token });
      setMessage(feedback);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking("");
    }
  }

  function confirmRemoveFriend() {
    if (!selectedFriend) return;
    Alert.alert("Remover amizade?", `${selectedFriend.name} deixará de aparecer na sua lista.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: async () => {
          clearFeedback();
          try {
            await apiRequest(`/friends/${selectedFriend.id}`, { method: "DELETE", token });
            setSelectedFriendId("");
            setMessage("Amigo removido.");
            await loadWorkspace();
          } catch (requestError) {
            setError(requestError.message);
          }
        }
      }
    ]);
  }

  async function createGoal() {
    if (!selectedFriend || !goalForm.name || !goalForm.targetAmount) return;
    clearFeedback();
    setWorking("goal");
    try {
      await apiRequest("/goals", { method: "POST", token, body: { ...goalForm, participantIds: [selectedFriend.id] } });
      setGoalForm((current) => ({ ...current, name: "", targetAmount: "", currentAmount: "" }));
      setMessage(`Meta com ${selectedFriend.name} criada.`);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking("");
    }
  }

  async function createLimit() {
    if (!selectedFriend || !limitForm.amount) return;
    clearFeedback();
    setWorking("limit");
    try {
      await apiRequest("/limits", { method: "POST", token, body: { ...limitForm, participantIds: [selectedFriend.id] } });
      setLimitForm((current) => ({ ...current, amount: "" }));
      setMessage(`Limite com ${selectedFriend.name} criado.`);
      await loadWorkspace();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking("");
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 92 }]} keyboardShouldPersistTaps="handled" style={styles.screen}>
        <View>
          <Text style={styles.eyebrow}>Amigos</Text>
          <Text style={styles.title}>Sua rede financeira</Text>
          <Text style={styles.subtitle}>Escolha uma amizade para construir metas e limites em conjunto.</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Amizades</Text>
            {incomingRequests.length || outgoingRequests.length ? (
              <Pressable onPress={() => setAddOpen(true)} style={[styles.chip, styles.chipActive]}><Text style={[styles.chipText, styles.chipTextActive]}>{incomingRequests.length + outgoingRequests.length} pedido(s)</Text></Pressable>
            ) : null}
          </View>
          <Text style={styles.muted}>Toque em uma pessoa para abrir os planos compartilhados.</Text>
          <View style={{ gap: 8, marginTop: 12 }}>
            {friends.map((friend) => {
              const active = selectedFriendId === friend.id;
              return (
                <Pressable key={friend.id} onPress={() => setSelectedFriendId(friend.id)} style={[styles.listItem, styles.rowBetween, active ? { backgroundColor: "#ecfdf5", borderColor: colors.emerald } : null]}>
                  <Person person={friend} />
                  <Text style={{ color: active ? colors.emerald : colors.muted, fontSize: 22 }}>›</Text>
                </Pressable>
              );
            })}
            {!friends.length ? <Text style={styles.muted}>Nenhuma amizade aceita ainda. Use o botão verde para adicionar alguém.</Text> : null}
          </View>
        </View>

        {selectedFriend ? (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Person large person={selectedFriend} />
              <Pressable onPress={confirmRemoveFriend} style={[styles.chip, { borderColor: "#fecaca", backgroundColor: "#fef2f2" }]}><Text style={[styles.chipText, { color: "#991b1b" }]}>Remover</Text></Pressable>
            </View>

            <Text style={[styles.eyebrow, { marginTop: 18 }]}>Planos compartilhados</Text>
            {selectedPlans.goals.slice(0, 2).map((goal) => <View key={goal.id} style={styles.listItem}><Text style={styles.listItemTitle}>{goal.name}</Text><Text style={styles.muted}>Meta · {currency(goal.currentAmount)} de {currency(goal.targetAmount)}</Text></View>)}
            {selectedPlans.limits.slice(0, 2).map((limit) => <View key={limit.id} style={styles.listItem}><Text style={styles.listItemTitle}>{categoryLabel(limit.category)}</Text><Text style={styles.muted}>Limite · {currency(limit.amount)} por mês</Text></View>)}
            {!selectedPlans.goals.length && !selectedPlans.limits.length ? <Text style={styles.muted}>Vocês ainda não têm planos compartilhados.</Text> : null}

            <View style={[styles.areaSwitcher, { marginTop: 16 }]}>
              <Pressable onPress={() => setPlanMode("goal")} style={[styles.areaSwitcherItem, planMode === "goal" ? styles.areaSwitcherItemActive : null]}><Text style={[styles.areaSwitcherText, planMode === "goal" ? styles.areaSwitcherTextActive : null]}>Nova meta</Text></Pressable>
              <Pressable onPress={() => setPlanMode("limit")} style={[styles.areaSwitcherItem, planMode === "limit" ? styles.areaSwitcherItemActive : null]}><Text style={[styles.areaSwitcherText, planMode === "limit" ? styles.areaSwitcherTextActive : null]}>Novo limite</Text></Pressable>
            </View>

            {planMode === "goal" ? (
              <View style={{ gap: 8, marginTop: 12 }}>
                <TextInput maxLength={120} onChangeText={(value) => setGoalForm((current) => ({ ...current, name: value }))} placeholder="Nome da meta" placeholderTextColor={colors.muted} style={styles.input} value={goalForm.name} />
                <TextInput keyboardType="decimal-pad" onChangeText={(value) => setGoalForm((current) => ({ ...current, targetAmount: value }))} placeholder="Valor alvo" placeholderTextColor={colors.muted} style={styles.input} value={goalForm.targetAmount} />
                <TextInput keyboardType="decimal-pad" onChangeText={(value) => setGoalForm((current) => ({ ...current, currentAmount: value }))} placeholder="Já reservado (opcional)" placeholderTextColor={colors.muted} style={styles.input} value={goalForm.currentAmount} />
                <TextInput onChangeText={(value) => setGoalForm((current) => ({ ...current, dueDate: value }))} placeholder="Prazo AAAA-MM-DD" placeholderTextColor={colors.muted} style={styles.input} value={goalForm.dueDate} />
                <Button disabled={Boolean(working)} onPress={createGoal}>{working === "goal" ? "Criando..." : `Criar com ${selectedFriend.name.split(" ")[0]}`}</Button>
              </View>
            ) : (
              <View style={{ gap: 10, marginTop: 12 }}>
                <View style={styles.chipRow}>{categoryOptions.map((category) => { const active = limitForm.category === category; return <Pressable key={category} onPress={() => setLimitForm((current) => ({ ...current, category }))} style={[styles.chip, active ? styles.chipActive : null]}><Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{categoryLabel(category)}</Text></Pressable>; })}</View>
                <TextInput keyboardType="decimal-pad" onChangeText={(value) => setLimitForm((current) => ({ ...current, amount: value }))} placeholder="Valor mensal" placeholderTextColor={colors.muted} style={styles.input} value={limitForm.amount} />
                <Button disabled={Boolean(working)} onPress={createLimit}>{working === "limit" ? "Criando..." : `Criar com ${selectedFriend.name.split(" ")[0]}`}</Button>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <Pressable accessibilityLabel="Adicionar amizade" onPress={() => setAddOpen(true)} style={{ alignItems: "center", backgroundColor: colors.emerald, borderRadius: 28, bottom: 18, elevation: 8, height: 56, justifyContent: "center", position: "absolute", right: 18, shadowColor: "#000", shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.2, shadowRadius: 8, width: 56 }}><Text style={{ color: "#ffffff", fontSize: 30, fontWeight: "500", lineHeight: 32 }}>+</Text></Pressable>

      <Modal animationType="slide" onRequestClose={() => setAddOpen(false)} presentationStyle="pageSheet" visible={addOpen}>
        <SafeAreaView style={styles.screen}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.rowBetween}><View><Text style={styles.eyebrow}>Nova conexão</Text><Text style={styles.title}>Adicionar amizade</Text></View><Pressable accessibilityLabel="Fechar" onPress={() => setAddOpen(false)} style={styles.chip}><Text style={styles.chipText}>Fechar</Text></Pressable></View>
            <View style={styles.card}>
              <Text style={styles.label}>Nome de usuário</Text>
              <TextInput autoCapitalize="none" autoCorrect={false} maxLength={24} onChangeText={(value) => setFriendUsername(value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9._]/g, ""))} placeholder="nome.usuario" placeholderTextColor={colors.muted} style={[styles.input, { marginTop: 8 }]} value={friendUsername} />
              <View style={{ marginTop: 10 }}><Button disabled={working === "add"} onPress={addFriend}>{working === "add" ? "Enviando..." : "Enviar pedido"}</Button></View>
            </View>

            {incomingRequests.length ? <View style={styles.card}><Text style={styles.label}>Pedidos recebidos</Text>{incomingRequests.map((request) => <View key={request.id} style={[styles.listItem, styles.rowBetween]}><Person person={request} /><View style={{ gap: 6 }}><Pressable disabled={working === request.id} onPress={() => acceptFriend(request.id)} style={[styles.chip, styles.chipActive]}><Text style={[styles.chipText, styles.chipTextActive]}>Aceitar</Text></Pressable><Pressable disabled={working === request.id} onPress={() => removeRequest(request.id, "Pedido recusado.")} style={styles.chip}><Text style={styles.chipText}>Recusar</Text></Pressable></View></View>)}</View> : null}

            {outgoingRequests.length ? <View style={styles.card}><Text style={styles.label}>Aguardando aceite</Text>{outgoingRequests.map((request) => <View key={request.id} style={[styles.listItem, styles.rowBetween]}><Person person={request} /><Pressable disabled={working === request.id} onPress={() => removeRequest(request.id, "Pedido cancelado.")} style={styles.chip}><Text style={styles.chipText}>Cancelar</Text></Pressable></View>)}</View> : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
