import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export const colors = {
  bg: "#f6f8fb",
  panel: "#ffffff",
  panelSoft: "#eef5f2",
  text: "#111827",
  muted: "#667085",
  border: "#d9e2ec",
  emerald: "#059669",
  amber: "#d97706",
  red: "#dc2626",
  ink: "#0f172a",
  brandDeep: "#0d6b4f",
  brandBright: "#1fbd82",
  brandLime: "#b8f34a"
};

export function Button({ children, disabled = false, onPress, tone = "primary" }) {
  const isGhost = tone === "ghost";
  const isLink = tone === "link";
  const isBrand = tone === "brand";
  const isBrandLink = tone === "brandLink";
  const container = isLink || isBrandLink ? styles.linkButton : isGhost ? styles.ghostButton : isBrand ? styles.brandButton : styles.primaryButton;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, container, disabled ? { opacity: 0.45 } : null, pressed ? { opacity: 0.75 } : null]}>
      <Text style={[styles.buttonText, isGhost ? styles.ghostText : null, isLink ? styles.linkText : null, isBrandLink ? styles.brandLinkText : null]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Field({ editable = true, label, value, onChangeText, keyboardType = "default", secureTextEntry = false, placeholder, ...inputProps }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        editable={editable}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        style={[styles.input, !editable ? styles.inputCalculated : null]}
        value={String(value ?? "")}
        {...inputProps}
      />
    </View>
  );
}

export function StatCard({ label, value, detail, tone = "neutral" }) {
  const toneColor = tone === "safe" ? colors.emerald : tone === "warning" ? colors.amber : tone === "danger" ? colors.red : colors.border;
  return (
    <View style={[styles.card, { borderColor: toneColor }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.stat}>{value}</Text>
      {detail ? <Text style={styles.muted}>{detail}</Text> : null}
    </View>
  );
}

export function LoadingBlock() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.emerald} />
      <Text style={styles.muted}>Carregando...</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg
  },
  inputCalculated: {
    backgroundColor: colors.panelSoft,
    color: colors.emerald,
    fontWeight: "800"
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 118,
    gap: 14
  },
  authContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 28,
    gap: 14
  },
  heroPanel: {
    backgroundColor: "#0c0c16",
    borderRadius: 18,
    padding: 18,
    gap: 8,
    shadowColor: colors.brandBright,
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 }
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36
  },
  eyebrow: {
    color: colors.emerald,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  heroSubtitle: {
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 22
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10
  },
  authBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(31,189,130,0.16)",
    borderColor: "rgba(184,243,74,0.34)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginBottom: 12
  },
  authBadgeText: {
    color: "#d7ff87",
    fontSize: 12,
    fontWeight: "800"
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#e3f3eb",
    borderRadius: 14,
    padding: 4,
    gap: 4
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    paddingVertical: 11
  },
  segmentBtnActive: {
    backgroundColor: colors.panel,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }
  },
  segmentText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: colors.ink
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }
  },
  cardRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "stretch"
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  metricCell: {
    flexBasis: "48%",
    flexGrow: 1
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10
  },
  listItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: 4,
    paddingVertical: 12
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  chipActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  chipTextActive: {
    color: "#ffffff"
  },
  avatarChoice: {
    alignItems: "center",
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 8
  },
  avatarChoiceActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald
  },
  avatarImage: {
    borderRadius: 14,
    height: 58,
    width: 58
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  stat: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4
  },
  field: {
    gap: 6
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  button: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  primaryButton: {
    backgroundColor: colors.emerald
  },
  brandButton: {
    backgroundColor: colors.brandDeep
  },
  ghostButton: {
    backgroundColor: "#ffffff",
    borderColor: colors.border,
    borderWidth: 1
  },
  linkButton: {
    paddingVertical: 8
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  ghostText: {
    color: colors.text
  },
  linkText: {
    color: colors.emerald
  },
  brandLinkText: {
    color: colors.brandDeep
  },
  loading: {
    alignItems: "center",
    gap: 8,
    padding: 20
  },
  error: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderRadius: 12,
    borderWidth: 1,
    color: "#991b1b",
    padding: 12
  },
  success: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderRadius: 12,
    borderWidth: 1,
    color: "#065f46",
    padding: 12
  },
  progressOuter: {
    backgroundColor: colors.panelSoft,
    borderRadius: 999,
    height: 8,
    marginTop: 10,
    overflow: "hidden"
  },
  progressInner: {
    backgroundColor: colors.emerald,
    borderRadius: 999,
    height: 8
  },
  tabBar: {
    backgroundColor: "#ffffff",
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    bottom: 14,
    flexDirection: "row",
    gap: 4,
    left: 12,
    padding: 6,
    position: "absolute",
    right: 12,
    shadowColor: "#0f172a",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }
  },
  tabItem: {
    alignItems: "center",
    borderRadius: 16,
    flex: 1,
    gap: 3,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 3,
    paddingVertical: 7
  },
  tabItemActive: {
    backgroundColor: colors.ink
  },
  tabIcon: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "900"
  },
  tabIconActive: {
    color: "#ffffff"
  },
  tabText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900"
  },
  tabTextActive: {
    color: "#ffffff"
  }
});
