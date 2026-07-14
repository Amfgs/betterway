import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DashboardScreen } from "./DashboardScreen";
import { FriendsScreen } from "./FriendsScreen";
import { InvestmentsScreen } from "./InvestmentsScreen";
import { NewsScreen } from "./NewsScreen";
import { ProfileScreen } from "./ProfileScreen";
import { SimulatorScreen } from "./SimulatorScreen";
import { styles } from "../components/ui";

const tabs = [
  ["dashboard", "DB", "Painel"],
  ["investments", "IV", "Ativos"],
  ["simulator", "SM", "Simular"],
  ["friends", "AM", "Amigos"],
  ["news", "NT", "Notícias"],
  ["profile", "PF", "Perfil"]
];

export function MainApp() {
  const [tab, setTab] = useState("dashboard");
  const Screen =
    tab === "investments"
      ? InvestmentsScreen
      : tab === "simulator"
        ? SimulatorScreen
        : tab === "friends"
          ? FriendsScreen
          : tab === "news"
            ? NewsScreen
            : tab === "profile"
              ? ProfileScreen
              : DashboardScreen;

  return (
    <View style={styles.screen}>
      <Screen />
      <View style={styles.tabBar}>
        {tabs.map(([key, icon, label]) => {
          const active = tab === key;
          return (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tabItem, active ? styles.tabItemActive : null]}>
              <Text style={[styles.tabIcon, active ? styles.tabIconActive : null]}>{icon}</Text>
              <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
