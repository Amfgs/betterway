import React from "react";
import { SafeAreaView, StatusBar, Text, View } from "react-native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { BrandLogo } from "./src/components/BrandLogo";
import { MainApp } from "./src/screens/MainApp";
import { AuthScreen } from "./src/screens/AuthScreen";
import { Button, styles } from "./src/components/ui";

function SessionUnlock() {
  const { biometric, unlockError, unlockWithBiometrics, usePasswordInstead } = useAuth();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.unlockScreen}>
        <BrandLogo markHeight={48} />
        <View style={styles.unlockCopy}>
          <Text style={styles.title}>Abra sua Better Way</Text>
          <Text style={styles.subtitle}>Use {biometric.label.toLowerCase()} para continuar sem digitar sua senha.</Text>
        </View>
        {unlockError ? <Text style={styles.error}>{unlockError}</Text> : null}
        <View style={styles.unlockActions}>
          <Button tone="brand" onPress={unlockWithBiometrics}>Desbloquear</Button>
          <Button tone="brandLink" onPress={usePasswordInstead}>Entrar com e-mail e senha</Button>
        </View>
        <Text style={styles.muted}>Sua senha não fica salva no aparelho.</Text>
      </View>
    </SafeAreaView>
  );
}

function Root() {
  const { user, booting, locked } = useAuth();

  if (booting) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <BrandLogo markHeight={42} />
        <Text style={styles.subtitle}>Restaurando sua sessão...</Text>
      </View>
    );
  }

  if (locked) return <SessionUnlock />;
  return user ? <MainApp /> : <AuthScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#f3f6f2" />
      <Root />
    </AuthProvider>
  );
}
