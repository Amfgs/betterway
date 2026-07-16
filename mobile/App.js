import React from "react";
import { Text, View } from "react-native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { BrandLogo } from "./src/components/BrandLogo";
import { MainApp } from "./src/screens/MainApp";
import { AuthScreen } from "./src/screens/AuthScreen";
import { styles } from "./src/components/ui";

function Root() {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <BrandLogo markHeight={42} />
        <Text style={styles.subtitle}>Restaurando sua sessão...</Text>
      </View>
    );
  }

  return user ? <MainApp /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}
