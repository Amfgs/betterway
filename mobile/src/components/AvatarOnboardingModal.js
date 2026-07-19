import React, { useState } from "react";
import { Image, Modal, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { avatarOptions } from "../utils/avatars";
import { Button, colors, styles } from "./ui";

export function AvatarOnboardingModal() {
  const { updateProfile, user } = useAuth();
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const visible = Boolean(user && !user.avatarUrl);

  async function confirmAvatar() {
    if (!selected || saving) return;
    setSaving(true);
    setError("");
    try {
      await updateProfile({ avatarUrl: selected });
    } catch (avatarError) {
      setError(avatarError.message || "Não foi possível salvar seu avatar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal animationType="fade" onRequestClose={() => {}} presentationStyle="fullScreen" visible={visible}>
      <SafeAreaView style={[styles.screen, { backgroundColor: "#f3f6f2" }]}>
        <ScrollView contentContainerStyle={{ gap: 18, padding: 18, paddingBottom: 28 }}>
          <View>
            <Text style={styles.eyebrow}>Seu primeiro passo</Text>
            <Text style={styles.title}>Escolha como você aparece</Text>
            <Text style={styles.subtitle}>Seu avatar identifica o perfil para os amigos. Você poderá trocá-lo quando quiser.</Text>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {avatarOptions.map((avatar) => {
              const active = selected === avatar.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={avatar.value}
                  onPress={() => setSelected(avatar.value)}
                  style={{
                    alignItems: "center",
                    backgroundColor: active ? "#dcfce7" : "#ffffff",
                    borderColor: active ? colors.emerald : colors.border,
                    borderRadius: 8,
                    borderWidth: active ? 2 : 1,
                    padding: 7,
                    width: "31%"
                  }}
                >
                  <Image source={avatar.source} style={{ aspectRatio: 1, borderRadius: 7, width: "100%" }} />
                  <Text numberOfLines={1} style={{ color: active ? colors.emerald : colors.text, fontSize: 12, fontWeight: "900", marginTop: 7 }}>{avatar.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button disabled={!selected || saving} onPress={confirmAvatar}>{saving ? "Salvando..." : "Usar este avatar"}</Button>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
