import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { apiRequest } from "../api/client";
import { Button, Field, LoadingBlock, StatCard, colors, styles } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { categoryLabel, currency, percent, todayInput } from "../utils/formatters";

const categoryOptions = ["Alimentacao", "Transporte", "Saude", "Moradia", "Lazer", "Produtos Necessarios", "Investimentos"];

export function DashboardScreen() {
  const { token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    amount: "",
    type: "expense",
    category: "Lazer",
    isSuperfluous: false,
    date: todayInput()
  });
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [goalForm, setGoalForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "",
    dueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 3, 1).toISOString().slice(0, 10)
  });
  const [limitForm, setLimitForm] = useState({
    category: "Alimentacao",
    amount: ""
  });
  const [opportunity, setOpportunity] = useState(null);

  async function load() {
    setError("");
    try {
      const data = await apiRequest("/transactions/summary", { token });
      setSummary(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateGoal(key, value) {
    setGoalForm((current) => ({ ...current, [key]: value }));
  }

  function updateLimit(key, value) {
    setLimitForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    setError("");
    try {
      const data = await apiRequest(editingTransactionId ? `/transactions/${editingTransactionId}` : "/transactions", {
        method: editingTransactionId ? "PUT" : "POST",
        token,
        body: form
      });
      setOpportunity(data.opportunity || null);
      setEditingTransactionId(null);
      setForm({ ...form, title: "", amount: "", type: "expense", category: "Lazer", isSuperfluous: false, date: todayInput() });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function startEditTransaction(transaction) {
    setEditingTransactionId(transaction.id);
    setOpportunity(null);
    setForm({
      title: transaction.title,
      amount: String(transaction.amount),
      type: transaction.type,
      category: transaction.category,
      isSuperfluous: Boolean(transaction.isSuperfluous),
      date: transaction.date ? transaction.date.slice(0, 10) : todayInput()
    });
  }

  function cancelEditTransaction() {
    setEditingTransactionId(null);
    setForm({ title: "", amount: "", type: "expense", category: "Lazer", isSuperfluous: false, date: todayInput() });
  }

  async function submitGoal() {
    setError("");
    try {
      await apiRequest("/goals", {
        method: "POST",
        token,
        body: goalForm
      });
      setGoalForm({ ...goalForm, name: "", targetAmount: "", currentAmount: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitLimit() {
    setError("");
    try {
      await apiRequest("/limits", {
        method: "POST",
        token,
        body: limitForm
      });
      setLimitForm({ ...limitForm, amount: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const widgets = summary?.widgets;
  const tone = widgets?.status === "danger" ? "danger" : widgets?.status === "warning" ? "warning" : "safe";
  const barColor = tone === "danger" ? colors.red : tone === "warning" ? colors.amber : colors.emerald;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View>
        <Text style={styles.eyebrow}>Dashboard comportamental</Text>
        <Text style={styles.title}>Saúde do dinheiro</Text>
        <Text style={styles.subtitle}>
          Janela: {summary?.window?.label || "3 dias finais do mês anterior + dias 1 a 27 do mês atual"}
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!summary ? <LoadingBlock /> : null}
      {widgets ? (
        <View style={styles.metricGrid}>
          <View style={styles.metricCell}>
            <StatCard label="Entradas" value={currency(widgets.income)} />
          </View>
          <View style={styles.metricCell}>
            <StatCard label="Saidas" value={currency(widgets.expenses)} />
          </View>
          <View style={styles.metricCell}>
            <StatCard label="Saldo" value={currency(widgets.balance)} tone={widgets.balance >= 0 ? "safe" : "danger"} />
          </View>
          <View style={[styles.card, { flexBasis: "100%" }]}>
            <Text style={styles.label}>Teto usado</Text>
            <Text style={styles.stat}>{percent(widgets.usagePercent)}</Text>
            <Text style={styles.muted}>
              {widgets.behaviorMessage} Investimentos ficam fora desse calculo.
            </Text>
            <View style={styles.progressOuter}>
              <View style={[styles.progressInner, { backgroundColor: barColor, width: `${Math.min(widgets.usagePercent, 100)}%` }]} />
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.eyebrow}>{editingTransactionId ? "Editar transação" : "Nova transação"}</Text>
          {editingTransactionId ? (
            <Pressable onPress={cancelEditTransaction} style={styles.chip}>
              <Text style={styles.chipText}>Cancelar</Text>
            </Pressable>
          ) : null}
        </View>
        <Field label="Título" value={form.title} onChangeText={(value) => update("title", value)} />
        <Field label="Valor" value={form.amount} keyboardType="numeric" onChangeText={(value) => update("amount", value)} />
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.chipRow}>
          {[
            ["expense", "Saída"],
            ["income", "Entrada"]
          ].map(([value, label]) => {
            const active = form.type === value;
            return (
              <Pressable key={value} onPress={() => update("type", value)} style={[styles.chip, active ? styles.chipActive : null]}>
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.label}>Setor</Text>
        <View style={styles.chipRow}>
          {categoryOptions.map((category) => {
            const active = form.category === category;
            return (
              <Pressable key={category} onPress={() => update("category", category)} style={[styles.chip, active ? styles.chipActive : null]}>
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{categoryLabel(category)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Data" value={form.date} onChangeText={(value) => update("date", value)} />
        <Button onPress={submit}>{editingTransactionId ? "Salvar edição" : "Registrar com Raio-X"}</Button>
      </View>

      {opportunity ? (
        <View style={[styles.card, { borderColor: colors.amber }]}>
          <Text style={styles.eyebrow}>Raio-X da Compra</Text>
          {opportunity.messages.map((message) => (
            <Text key={message} style={styles.subtitle}>
              {message}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Ultimos 5 itens</Text>
        {(summary?.recentTransactions || []).map((transaction) => (
          <View key={transaction.id} style={styles.listItem}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "900" }}>{transaction.title}</Text>
                <Text style={styles.muted}>
                  {transaction.date?.slice(0, 10)} · {categoryLabel(transaction.category)} · {transaction.type === "income" ? "+" : "-"}
                  {currency(transaction.amount)}
                </Text>
              </View>
              <Pressable onPress={() => startEditTransaction(transaction)} style={styles.chip}>
                <Text style={styles.chipText}>Editar</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Cadastro de meta</Text>
        <Field label="Nome da meta" value={goalForm.name} onChangeText={(value) => updateGoal("name", value)} />
        <Field label="Valor alvo" value={goalForm.targetAmount} keyboardType="numeric" onChangeText={(value) => updateGoal("targetAmount", value)} />
        <Field label="Já aportado" value={goalForm.currentAmount} keyboardType="numeric" onChangeText={(value) => updateGoal("currentAmount", value)} />
        <Field label="Prazo" value={goalForm.dueDate} onChangeText={(value) => updateGoal("dueDate", value)} />
        <Button onPress={submitGoal}>Salvar meta</Button>
        {(summary?.goals || []).map((goal) => (
          <View key={goal.id} style={{ borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 10 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>{goal.name}</Text>
            <Text style={styles.muted}>
              {currency(goal.currentAmount)} de {currency(goal.targetAmount)} · {percent(goal.progress)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Cadastro de limite</Text>
        <Field label="Categoria" value={limitForm.category} onChangeText={(value) => updateLimit("category", value)} />
        <Field label="Limite da categoria" value={limitForm.amount} keyboardType="numeric" onChangeText={(value) => updateLimit("amount", value)} />
        <Button onPress={submitLimit}>Salvar limite</Button>
        {(summary?.limits || []).map((limit) => (
          <View key={limit.id} style={{ borderBottomColor: colors.border, borderBottomWidth: 1, paddingVertical: 10 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>{limit.category}</Text>
            <Text style={styles.muted}>
              {currency(limit.spent)} de {currency(limit.amount)} · {percent(limit.usagePercent)}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
