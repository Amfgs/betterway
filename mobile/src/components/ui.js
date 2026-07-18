import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export const colors = {
  bg: "#f3f6f2",
  panel: "#ffffff",
  panelSoft: "#edf2ee",
  text: "#15201b",
  muted: "#66736d",
  border: "#dfe6e1",
  emerald: "#0d6b4f",
  amber: "#c98212",
  red: "#d94b43",
  ink: "#07120e",
  brandDeep: "#0d6b4f",
  brandBright: "#1fbd82",
  brandLime: "#b8f34a"
};

export function Button({ children, disabled = false, onPress, tone = "primary" }) {
  const isGhost = tone === "ghost";
  const isLink = tone === "link";
  const isBrand = tone === "brand";
  const isBrandLink = tone === "brandLink";
  const isDanger = tone === "danger";
  const container = isLink || isBrandLink ? styles.linkButton : isGhost ? styles.ghostButton : isBrand ? styles.brandButton : isDanger ? styles.dangerButton : styles.primaryButton;
  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, container, disabled ? { opacity: 0.45 } : null, pressed ? { opacity: 0.75 } : null]}>
      <Text style={[styles.buttonText, isGhost ? styles.ghostText : null, isLink ? styles.linkText : null, isBrandLink ? styles.brandLinkText : null]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function Field({ editable = true, label, value, onChangeText, keyboardType = "default", secureTextEntry = false, placeholder, ...inputProps }) {
  const [passwordVisible, setPasswordVisible] = React.useState(false);
  const input = (
    <TextInput
      autoCapitalize="none"
      editable={editable}
      keyboardType={keyboardType}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      secureTextEntry={secureTextEntry && !passwordVisible}
      style={[styles.input, !editable ? styles.inputCalculated : null, secureTextEntry ? styles.inputWithAction : null]}
      value={String(value ?? "")}
      {...inputProps}
    />
  );
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {secureTextEntry ? (
        <View style={styles.inputActionWrap}>
          {input}
          <Pressable
            accessibilityLabel={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setPasswordVisible((current) => !current)}
            style={styles.inputAction}
          >
            <Text style={styles.inputActionText}>{passwordVisible ? "Ocultar" : "Mostrar"}</Text>
          </Pressable>
        </View>
      ) : input}
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
  appFrame: {
    flex: 1
  },
  appFrameWide: {
    flexDirection: "row"
  },
  appBody: {
    flex: 1,
    minWidth: 0
  },
  areaScreen: {
    flex: 1
  },
  areaSwitcher: {
    alignSelf: "center",
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 4,
    width: "auto"
  },
  areaSwitcherItem: {
    alignItems: "center",
    borderRadius: 6,
    minHeight: 38,
    minWidth: 116,
    justifyContent: "center",
    paddingHorizontal: 18
  },
  areaSwitcherItemActive: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1
  },
  areaSwitcherText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  areaSwitcherTextActive: {
    color: colors.text,
    fontWeight: "800"
  },
  inputCalculated: {
    backgroundColor: colors.panelSoft,
    color: colors.emerald,
    fontWeight: "800"
  },
  content: {
    alignSelf: "center",
    maxWidth: 940,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 104,
    gap: 12,
    width: "100%"
  },
  authContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12
  },
  title: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "800",
    lineHeight: 34
  },
  eyebrow: {
    color: colors.emerald,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22
  },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    gap: 4
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    borderRadius: 6,
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 11
  },
  segmentBtnActive: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1
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
    borderRadius: 8,
    borderWidth: 1,
    padding: 15
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
  listItemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800"
  },
  moneyValue: {
    color: colors.text,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    fontWeight: "800"
  },
  moneyValuePositive: {
    color: colors.emerald
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
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
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    padding: 8
  },
  avatarChoiceActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald
  },
  avatarImage: {
    borderRadius: 7,
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
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  inputActionWrap: {
    position: "relative"
  },
  inputWithAction: {
    paddingRight: 76
  },
  inputAction: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12,
    position: "absolute",
    right: 0,
    top: 0
  },
  inputActionText: {
    color: colors.emerald,
    fontSize: 12,
    fontWeight: "800"
  },
  button: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  primaryButton: {
    backgroundColor: colors.emerald
  },
  brandButton: {
    backgroundColor: colors.brandDeep
  },
  dangerButton: {
    backgroundColor: colors.red
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
    borderRadius: 8,
    borderWidth: 1,
    color: "#991b1b",
    padding: 12
  },
  success: {
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderRadius: 8,
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
    borderTopColor: colors.border,
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    left: 0,
    paddingHorizontal: 6,
    paddingVertical: 5,
    position: "absolute",
    right: 0
  },
  tabItem: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 3,
    paddingVertical: 6
  },
  tabItemActive: {
    backgroundColor: "#e7f2ed"
  },
  tabItemPressed: {
    opacity: 0.68
  },
  navRail: {
    backgroundColor: colors.panel,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 16,
    width: 112
  },
  navRailItem: {
    flex: 0,
    minHeight: 64
  },
  tabText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700"
  },
  tabTextActive: {
    color: colors.emerald,
    fontWeight: "800"
  },
  authHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginBottom: 2
  },
  authHeaderCopy: {
    flex: 1,
    gap: 2
  },
  authTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30
  },
  authSurface: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 11,
    padding: 15
  },
  authStepRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  authFieldGrid: {
    flexDirection: "row",
    gap: 10
  },
  authFieldCell: {
    flex: 1,
    minWidth: 0
  },
  fieldHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17
  },
  fieldHintError: {
    color: colors.red
  },
  fieldHintSuccess: {
    color: colors.emerald,
    fontWeight: "700"
  },
  sessionChoice: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 48
  },
  sessionChoiceTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  checkbox: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 5,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22
  },
  checkboxActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald
  },
  checkboxMark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900"
  },
  info: {
    backgroundColor: "#edf5fb",
    borderColor: "#c7dceb",
    borderRadius: 8,
    borderWidth: 1,
    color: "#285c7a",
    fontSize: 13,
    lineHeight: 19,
    padding: 12
  },
  localSettingsToggle: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center"
  },
  localSettingsToggleText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  unlockScreen: {
    alignSelf: "center",
    flex: 1,
    justifyContent: "center",
    maxWidth: 420,
    paddingHorizontal: 24,
    width: "100%"
  },
  unlockCopy: {
    gap: 6,
    marginBottom: 20,
    marginTop: 28
  },
  unlockActions: {
    gap: 4,
    marginTop: 12
  }
});
