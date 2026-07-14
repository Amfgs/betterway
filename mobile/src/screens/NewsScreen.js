import React, { useEffect, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { apiRequest } from "../api/client";
import { Button, LoadingBlock, colors, styles } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export function NewsScreen() {
  const { token } = useAuth();
  const [articles, setArticles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest("/news", { token })
      .then((data) => setArticles(data.articles))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View>
        <Text style={styles.eyebrow}>Central de informação</Text>
        <Text style={styles.title}>Notícias</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!articles.length && !error ? <LoadingBlock /> : null}
      {articles.map((article) => (
        <View key={`${article.title}-${article.publishedAt}`} style={styles.card}>
          <Text style={styles.eyebrow}>{article.source}</Text>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>{article.title}</Text>
          <Text style={styles.subtitle}>{article.description || "Sem resumo disponível."}</Text>
          <Button tone="ghost" onPress={() => Linking.openURL(article.url)}>
            Ler fonte
          </Button>
        </View>
      ))}
    </ScrollView>
  );
}
