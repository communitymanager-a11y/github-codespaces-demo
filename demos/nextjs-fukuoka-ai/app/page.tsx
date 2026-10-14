"use client";

import { useState } from "react";
import styles from "./page.module.css";

type Message = { role: "user" | "assistant"; content: string };

const EXAMPLES = [
  "今号で一番大きなお知らせは何ですか?",
  "福岡市の人口を教えてください。",
  "市役所への問い合わせ先を教えてください。",
  "子育て家庭向けのイベントはありますか?",
];

export default function FukuokaAI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    const next: Message[] = [...messages, { role: "user", content: question }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/fukuoka-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      if (!res.body || !res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, content: last.content + chunk };
          return copy;
        });
      }
    } catch (error) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: `[error] ${String(error)}` };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <svg className={styles.forest} viewBox="0 0 1200 180" preserveAspectRatio="none" aria-hidden>
        <path d="M0 180V120l40-70 40 70 30-45 40 70 50-90 50 90 40-60 40 80 60-100 60 100 40-50 40 70 50-80 50 80 40-60 40 70 60-110 60 110 40-60 40 70 50-90 50 90 40-50 40 60 50-80 50 80 40-70 40 90V180z" fill="#9fd3a8" opacity="0.7" />
        <path d="M0 180v-40l30-50 30 50 40-70 40 70 30-40 40 60 50-80 50 80 40-50 40 60 40-70 40 70 50-90 50 90 40-60 40 70 40-50 40 60 50-80 50 80 40-50 40 60 50-70 50 70 40-60 40 60V180z" fill="#5fae7a" />
        <path d="M0 180v-20l40-40 40 40 50-60 50 60 40-30 40 50 60-70 60 70 50-50 50 60 50-60 50 60 60-80 60 80 50-50 50 60 50-50 50 50 60-70 60 70 50-40 50 40V180z" fill="#2f7d50" />
      </svg>

      <main className={styles.main}>
        <header className={styles.header}>
          <span className={styles.badge}>🌿 みどり豊かな福岡市</span>
          <h1 className={styles.title}>🌳 福岡市AI もりの相談所 🌳</h1>
          <p className={styles.lead}>
            「福岡市政だより 10月1日号」をもとに、やさしくお答えします。
            <a
              href="https://www.city.fukuoka.lg.jp/shicho/koho/shisei/shisei/documents/20261001.txt"
              target="_blank"
              rel="noreferrer"
            >
              出典
            </a>
          </p>
        </header>

        {messages.length === 0 && (
          <section className={styles.welcome}>
            <div>🦉 こんにちは! 市政だよりのことなら、なんでも聞いてくださいね。</div>
            <div className={styles.chips}>
              {EXAMPLES.map((q) => (
                <button key={q} className={styles.chip} onClick={() => ask(q)}>
                  🍃 {q}
                </button>
              ))}
            </div>
          </section>
        )}

        <div className={styles.log}>
          {messages.map((m, i) => (
            <div
              key={i}
              className={`${styles.row} ${m.role === "user" ? styles.rowUser : ""}`}
            >
              <div className={styles.avatar}>{m.role === "user" ? "🐿️" : "🦉"}</div>
              <div
                className={`${styles.bubble} ${
                  m.role === "user" ? styles.bubbleUser : styles.bubbleAi
                }`}
              >
                {m.content || "🍃 調べています..."}
              </div>
            </div>
          ))}
        </div>

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            className={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="知りたいことを入力してね"
          />
          <button type="submit" className={styles.send} disabled={loading}>
            {loading ? "回答中..." : "質問する"}
          </button>
        </form>
      </main>
    </div>
  );
}
