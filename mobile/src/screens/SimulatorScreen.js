import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { apiRequest } from "../api/client";
import { Button, Field, StatCard, colors, styles } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { currency, percent } from "../utils/formatters";

const frequencyOptions = [
  ["monthly", "Mensal"],
  ["quarterly", "Trimestral"],
  ["semiannual", "Semestral"],
  ["yearly", "Anual"]
];

const investmentTypeOptions = [
  ["treasury_selic", "Tesouro Selic", "10.5"],
  ["cdb", "CDB / CDI", "11"],
  ["treasury_ipca", "Tesouro IPCA+", "7"],
  ["fii", "FIIs", "10"],
  ["stock", "Ações", "12"],
  ["crypto", "Cripto", "18"],
  ["custom", "Personalizado", ""]
];

export function SimulatorScreen() {
  const { token } = useAuth();
  const [form, setForm] = useState({
    investmentType: "cdb",
    initialAmount: "5000",
    recurringContribution: "700",
    contributionFrequency: "monthly",
    annualRate: "12",
    months: "120",
    annualContributionIncrease: "0",
    extraContribution: "0",
    extraContributionMonth: "0"
  });
  const [summary, setSummary] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [projection, setProjection] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiRequest("/transactions/summary", { token }),
      apiRequest("/assets/portfolio", { token })
    ])
      .then(([summaryData, portfolioData]) => {
        setSummary(summaryData);
        setPortfolio(portfolioData.portfolio);
      })
      .catch((err) => setError(err.message));
  }, [token]);

  const context = useMemo(() => {
    const widgets = summary?.widgets || {};
    const bankBalance = Number(widgets.bankBalance || 0);
    const windowBalance = Number(widgets.balance || 0);
    const income = Number(widgets.income || 0);
    const expensesForLimit = Number(widgets.expensesForLimit || 0);
    return {
      bankBalance,
      windowBalance,
      suggestedContribution: Math.max(windowBalance, income - expensesForLimit, 0),
      portfolioValue: Number(portfolio?.totals?.currentValue || widgets.investedCost || 0)
    };
  }, [portfolio, summary]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateInvestmentType(value) {
    const option = investmentTypeOptions.find(([key]) => key === value);
    setProjection(null);
    setForm((current) => ({
      ...current,
      investmentType: value,
      annualRate: option?.[2] || current.annualRate
    }));
  }

  function applyPreset(fields) {
    setProjection(null);
    setForm((current) => ({ ...current, ...fields }));
  }

  async function submit() {
    setError("");
    try {
      const data = await apiRequest("/simulator/compound", {
        method: "POST",
        token,
        body: {
          ...form,
          monthlyContribution: form.recurringContribution
        }
      });
      setProjection(data.projection);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View>
        <Text style={styles.eyebrow}>Simulador projetivo</Text>
        <Text style={styles.title}>Investir com seus dados</Text>
        <Text style={styles.subtitle}>Aplique X, adicione Y, espere Z e veja quanto pode render.</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.metricGrid}>
        <View style={styles.metricCell}>
          <StatCard label="Saldo" value={currency(context.bankBalance)} />
        </View>
        <View style={styles.metricCell}>
          <StatCard label="Sobra" value={currency(context.windowBalance)} tone={context.windowBalance >= 0 ? "safe" : "danger"} />
        </View>
        <View style={[styles.metricCell, { flexBasis: "100%" }]}>
          <StatCard label="Carteira atual" value={currency(context.portfolioValue)} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Atalhos</Text>
        <View style={styles.chipRow}>
          <Pressable onPress={() => applyPreset({ initialAmount: String(Math.max(context.bankBalance, 0).toFixed(2)) })} style={styles.chip}>
            <Text style={styles.chipText}>Usar saldo</Text>
          </Pressable>
          <Pressable onPress={() => applyPreset({ recurringContribution: String(Math.max(context.suggestedContribution, 0).toFixed(2)) })} style={styles.chip}>
            <Text style={styles.chipText}>Usar sobra</Text>
          </Pressable>
          <Pressable onPress={() => applyPreset({ initialAmount: String(Math.max(context.portfolioValue, 0).toFixed(2)) })} style={styles.chip}>
            <Text style={styles.chipText}>Usar carteira</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>Parâmetros</Text>
        <Text style={styles.label}>Tipo de investimento</Text>
        <View style={styles.chipRow}>
          {investmentTypeOptions.map(([value, label]) => {
            const active = form.investmentType === value;
            return (
              <Pressable key={value} onPress={() => updateInvestmentType(value)} style={[styles.chip, active ? styles.chipActive : null]}>
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Aplicar agora" value={form.initialAmount} keyboardType="numeric" onChangeText={(value) => update("initialAmount", value)} />
        <Field label="Adicionar recorrente" value={form.recurringContribution} keyboardType="numeric" onChangeText={(value) => update("recurringContribution", value)} />
        <Text style={styles.label}>Frequência</Text>
        <View style={styles.chipRow}>
          {frequencyOptions.map(([value, label]) => {
            const active = form.contributionFrequency === value;
            return (
              <Pressable key={value} onPress={() => update("contributionFrequency", value)} style={[styles.chip, active ? styles.chipActive : null]}>
                <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Field label="Taxa anual (%)" value={form.annualRate} keyboardType="numeric" onChangeText={(value) => update("annualRate", value)} />
        <Field label="Tempo em meses" value={form.months} keyboardType="numeric" onChangeText={(value) => update("months", value)} />
        <Field label="Reajuste anual do aporte (%)" value={form.annualContributionIncrease} keyboardType="numeric" onChangeText={(value) => update("annualContributionIncrease", value)} />
        <Field label="Aporte extra" value={form.extraContribution} keyboardType="numeric" onChangeText={(value) => update("extraContribution", value)} />
        <Field label="Mês do aporte extra" value={form.extraContributionMonth} keyboardType="numeric" onChangeText={(value) => update("extraContributionMonth", value)} />
        <Button onPress={submit}>Projetar rendimento</Button>
      </View>

      {projection ? (
        <>
          <View style={[styles.card, { borderColor: colors.emerald }]}>
            <Text style={styles.eyebrow}>Resumo</Text>
            <Text style={styles.subtitle}>
              Aplicando {currency(form.initialAmount)} em {investmentTypeOptions.find(([value]) => value === form.investmentType)?.[1] || "investimento"} e adicionando {currency(form.recurringContribution)}, o valor projetado em {projection.months} meses é {currency(projection.finalAmount)}.
            </Text>
          </View>
          <StatCard label="Montante final" value={currency(projection.finalAmount)} tone="safe" />
          <StatCard label="Total aportado" value={currency(projection.totalInvested)} />
          <StatCard label="Juros gerados" value={currency(projection.totalInterest)} detail={`Taxa mensal: ${percent(projection.monthlyRate * 100)}`} tone="safe" />
          <StatCard label="Retorno sobre aporte" value={percent(projection.returnPercent)} tone="safe" />
          <View style={styles.card}>
            <Text style={styles.eyebrow}>Evolução resumida</Text>
            <View style={{ height: 150, flexDirection: "row", alignItems: "flex-end", gap: 5 }}>
              {projection.series.filter((_, index) => index % Math.max(Math.floor(projection.series.length / 12), 1) === 0).slice(0, 12).map((point) => {
                const ratio = point.balance / Math.max(projection.finalAmount, 1);
                return <View key={point.month} style={{ backgroundColor: colors.emerald, borderRadius: 8, flex: 1, height: 18 + ratio * 110 }} />;
              })}
            </View>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
