import React, { useState } from "react";
import { Feather } from "@expo/vector-icons";
import { Pressable, SafeAreaView, Text, useWindowDimensions, View } from "react-native";
import { DashboardScreen } from "./DashboardScreen";
import { FriendsScreen } from "./FriendsScreen";
import { InvestmentsScreen } from "./InvestmentsScreen";
import { NewsScreen } from "./NewsScreen";
import { ProfileScreen } from "./ProfileScreen";
import { SimulatorScreen } from "./SimulatorScreen";
import { styles } from "../components/ui";

const tabs = [
  { key: "dashboard", icon: "home", label: "Início" },
  { key: "investments", icon: "trending-up", label: "Investir" },
  { key: "friends", icon: "users", label: "Amigos" },
  { key: "news", icon: "file-text", label: "Notícias" },
  { key: "profile", icon: "user", label: "Perfil" }
];

function InvestmentsArea() {
  const [view, setView] = useState("portfolio");
  return (
    <View style={styles.areaScreen}>
      <View style={styles.areaSwitcher}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: view === "portfolio" }}
          onPress={() => setView("portfolio")}
          style={[styles.areaSwitcherItem, view === "portfolio" ? styles.areaSwitcherItemActive : null]}
        >
          <Text style={[styles.areaSwitcherText, view === "portfolio" ? styles.areaSwitcherTextActive : null]}>Carteira</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: view === "simulator" }}
          onPress={() => setView("simulator")}
          style={[styles.areaSwitcherItem, view === "simulator" ? styles.areaSwitcherItemActive : null]}
        >
          <Text style={[styles.areaSwitcherText, view === "simulator" ? styles.areaSwitcherTextActive : null]}>Simular</Text>
        </Pressable>
      </View>
      {view === "portfolio" ? <InvestmentsScreen /> : <SimulatorScreen />}
    </View>
  );
}

function Navigation({ activeTab, onSelect, rail = false }) {
  return (
    <View style={rail ? styles.navRail : styles.tabBar}>
      {tabs.map((item) => {
        const active = activeTab === item.key;
        return (
          <Pressable
            accessibilityLabel={item.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={item.key}
            onPress={() => onSelect(item.key)}
            style={({ pressed }) => [styles.tabItem, rail ? styles.navRailItem : null, active ? styles.tabItemActive : null, pressed ? styles.tabItemPressed : null]}
          >
            <Feather color={active ? "#0d6b4f" : "#66736d"} name={item.icon} size={20} />
            <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MainApp() {
  const [tab, setTab] = useState("dashboard");
  const { width } = useWindowDimensions();
  const useRail = width >= 760;
  const Screen = tab === "investments"
    ? InvestmentsArea
    : tab === "friends"
      ? FriendsScreen
      : tab === "news"
        ? NewsScreen
        : tab === "profile"
          ? ProfileScreen
          : DashboardScreen;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.appFrame, useRail ? styles.appFrameWide : null]}>
        {useRail ? <Navigation activeTab={tab} onSelect={setTab} rail /> : null}
        <View style={styles.appBody}><Screen /></View>
        {!useRail ? <Navigation activeTab={tab} onSelect={setTab} /> : null}
      </View>
    </SafeAreaView>
  );
}
