import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { api, getErrorMessage } from "../api/client";
import { useAuth } from "../context/AuthContext";

export function NewsPage({ embedded = false }) {
  const { user, updateProfile } = useAuth();
  const [articles, setArticles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/news")
      .then((response) => setArticles(response.data.articles))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  function markNewsViewed() {
    if (user?.onboarding?.viewedNews) return;
    updateProfile({ onboarding: { viewedNews: true } })
      .then(() => window.dispatchEvent(new Event("betterway:progress-refresh")))
      .catch(() => {});
  }

  return (
    <div className={`${embedded ? "embedded-page" : "workspace-page"} space-y-6`}>
      {!embedded ? <div>
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Central de informação</p>
        <h1 className="text-3xl font-black">Notícias de economia e mercado</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Feed real atualizado via NewsAPI ou Google News RSS.</p>
      </div> : null}
      {error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm font-medium text-red-600 dark:text-red-300">{error}</p> : null}
      {!articles.length && !error ? (
        <p className="rounded-lg border border-black/5 bg-white p-4 text-sm text-zinc-500 shadow-soft dark:border-white/10 dark:bg-neutral-900 dark:text-zinc-400">
          Buscando notícias reais atualizadas...
        </p>
      ) : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-tour="latest-news">
        {articles.map((article, index) => (
          <article key={`${article.title}-${article.publishedAt}`} className={`flex min-h-60 flex-col rounded-lg border border-black/5 bg-white p-5 shadow-soft dark:border-white/10 dark:bg-neutral-900 ${index === 0 ? "md:col-span-2 xl:col-span-2" : ""}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400">{article.source}</p>
              {article.category ? <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-bold text-zinc-500 dark:bg-neutral-800 dark:text-zinc-300">{article.category}</span> : null}
            </div>
            <h2 className={`mt-3 font-black leading-snug ${index === 0 ? "text-2xl" : "text-lg"}`}>{article.title}</h2>
            <p className="mt-3 line-clamp-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{article.description || "Sem resumo disponível."}</p>
            <div className="mt-auto pt-4">
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                {article.publishedAt ? new Date(article.publishedAt).toLocaleString("pt-BR") : "Publicação recente"}
              </p>
              <a className="inline-flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-bold dark:border-white/10" href={article.url} onClick={markNewsViewed} rel="noreferrer" target="_blank">
                Ler fonte
                <ExternalLink size={15} />
              </a>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
