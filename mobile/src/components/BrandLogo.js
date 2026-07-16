import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

const brandMark = require("../assets/brand/betterway-mark.png");

export function BrandLogo({ light = false, markHeight = 38, style, withWordmark = true }) {
  return (
    <View style={[styles.row, style]}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={brandMark}
        style={{ width: Math.round(markHeight * 1.5), height: markHeight }}
      />
      {withWordmark ? (
        <Text style={[styles.wordmark, light ? styles.wordmarkLight : null]}>
          Better <Text style={styles.accent}>Way</Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  wordmark: {
    color: "#10221c",
    fontSize: 20,
    fontWeight: "900"
  },
  wordmarkLight: {
    color: "#ffffff"
  },
  accent: {
    color: "#b8f34a"
  }
});
