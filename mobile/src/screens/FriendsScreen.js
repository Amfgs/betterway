import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { apiRequest } from "../api/client";
import { Button, colors, styles } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { categoryLabel } from "../utils/formatters";

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

export function FriendsScreen() {
  const { token } = useAuth();
  const [friends, setFriends] = useState([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [goalForm, setGoalForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    dueDate: defaultGoalDate,
    participantIds: []
  });
  const [limitForm, setLimitForm] = useState({
    category: "Alimentacao",
    amount: "",
    participantIds: []
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadFriends() {
    if (!token) return;
    const data = await apiRequest("/friends", { token });
    setFriends(data.friends || []);
  }

  useEffect(() => {
    loadFriends().catch((err) => setError(err.message));
  }, [token]);

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  async function addFriend() {
    if (!friendEmail) return;
    clearFeedback();
    try {
      await apiRequest("/friends", {
        method: "POST",
        token,
        body: { email: friendEmail }
      });
      setFriendEmail("");
      setMessage("Amigo adicionado.");
      await loadFriends();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeFriend(id) {
    clearFeedback();
    try {
      await apiRequest(`/friends/${id}`, { method: "DELETE", token });
      setMessage("Amigo removido.");
      await loadFriends();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleParticipant(kind, id) {
    const setter = kind === "goal" ? setGoalForm : setLimitForm;
    setter((current) => {
      const exists = current.participantIds.includes(id);
      return {
        ...current,
        participantIds: exists ? current.participantIds.filter((item) => item !== id) : [...current.participantIds, id]
      };
    });
  }

  async function createGoal() {
    if (!goalForm.name || !goalForm.targetAmount) return;
    clearFeedback();
    try {
      await apiRequest("/goals", {
        method: "POST",
        token,
        body: goalForm
      });
      setGoalForm({
        name: "",
        targetAmount: "",
        currentAmount: "",
        dueDate: goalForm.dueDate,
        participantIds: []
      });
      setMessage("Meta compartilhada criada.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function createLimit() {
    if (!limitForm.amount) return;
    clearFeedback();
    try {
      await apiRequest("/limits", {
        method: "POST",
        token,
        body: limitForm
      });
      setLimitForm({
        category: limitForm.category,
        amount: "",
        participantIds: []
      });
      setMessage("Limite compartilhado criado.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View>
        <Text style={styles.eyebrow}>Amigos</Text>
        <Text style={styles.title}>Metas e limites juntos</Text>
        <Text style={styles.subtitle}>Conecte outras contas cadastradas para dividir caixinhas e tetos.</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.label}>Adicionar amigo</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setFriendEmail}
          placeholder="email do amigo cadastrado"
          placeholderTextColor={colors.muted}
          style={[styles.input, { marginTop: 8 }]}
          value={friendEmail}
        />
        <View style={{ marginTop: 10 }}>
          <Button onPress={addFriend}>Adicionar</Button>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Amigos conectados</Text>
        {friends.map((friend) => (
          <View key={friend.id} style={[styles.listItem, styles.rowBetween]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>{friend.name}</Text>
              <Text style={styles.muted}>{friend.email}</Text>
            </View>
            <Pressable onPress={() => removeFriend(friend.id)} style={[styles.chip, { borderColor: "#fecaca", backgroundColor: "#fef2f2" }]}>
              <Text style={[styles.chipText, { color: "#991b1b" }]}>Remover</Text>
            </Pressable>
          </View>
        ))}
        {!friends.length ? <Text style={styles.muted}>Adicione uma conta existente para começar.</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Meta em conjunto</Text>
        <TextInput placeholder="Nome da meta" placeholderTextColor={colors.muted} style={styles.input} value={goalForm.name} onChangeText={(value) => setGoalForm((current) => ({ ...current, name: value }))} />
        <View style={{ height: 8 }} />
        <TextInput keyboardType="numeric" placeholder="Valor alvo" placeholderTextColor={colors.muted} style={styles.input} value={goalForm.targetAmount} onChangeText={(value) => setGoalForm((current) => ({ ...current, targetAmount: value }))} />
        <View style={{ height: 8 }} />
        <TextInput keyboardType="numeric" placeholder="Já aportado" placeholderTextColor={colors.muted} style={styles.input} value={goalForm.currentAmount} onChangeText={(value) => setGoalForm((current) => ({ ...current, currentAmount: value }))} />
        <View style={{ height: 8 }} />
        <TextInput placeholder="Prazo AAAA-MM-DD" placeholderTextColor={colors.muted} style={styles.input} value={goalForm.dueDate} onChangeText={(value) => setGoalForm((current) => ({ ...current, dueDate: value }))} />
        <FriendPicker friends={friends} selectedIds={goalForm.participantIds} onToggle={(id) => toggleParticipant("goal", id)} />
        <Button onPress={createGoal}>Criar meta conjunta</Button>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Limite em conjunto</Text>
        <View style={styles.chipRow}>
          {categoryOptions.map((category) => {
            const active = limitForm.category === category;
            return (
              <Pressable key={category} onPress={() => setLimitForm((current) => ({ ...current, category }))} style={[styles.chip, active ? styles.chipActive : null]}>
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{categoryLabel(category)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ height: 10 }} />
        <TextInput keyboardType="numeric" placeholder="Valor do limite" placeholderTextColor={colors.muted} style={styles.input} value={limitForm.amount} onChangeText={(value) => setLimitForm((current) => ({ ...current, amount: value }))} />
        <FriendPicker friends={friends} selectedIds={limitForm.participantIds} onToggle={(id) => toggleParticipant("limit", id)} />
        <Button onPress={createLimit}>Criar limite conjunto</Button>
      </View>
    </ScrollView>
  );
}

function FriendPicker({ friends, selectedIds, onToggle }) {
  return (
    <View style={{ marginVertical: 12 }}>
      <Text style={styles.label}>Participantes</Text>
      <View style={[styles.chipRow, { marginTop: 8 }]}>
        {friends.map((friend) => {
          const active = selectedIds.includes(friend.id);
          return (
            <Pressable key={friend.id} onPress={() => onToggle(friend.id)} style={[styles.chip, active ? styles.chipActive : null]}>
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{friend.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {!friends.length ? <Text style={styles.muted}>Adicione amigos antes de compartilhar.</Text> : null}
    </View>
  );
}
