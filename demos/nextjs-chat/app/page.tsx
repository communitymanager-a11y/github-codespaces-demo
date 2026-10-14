"use client";

import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("Next.js を一文で説明してください。");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setAnswer("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!res.body) {
      setAnswer("[error] レスポンスがありません");
      setLoading(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Next.js × Claude Agent SDK</h1>
      <form onSubmit={handleSubmit}>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          style={{ width: "100%", fontSize: 16 }}
        />
        <button type="submit" disabled={loading} style={{ marginTop: 8, fontSize: 16 }}>
          {loading ? "考え中..." : "送信"}
        </button>
      </form>
      {answer && <pre style={{ whiteSpace: "pre-wrap", marginTop: 24 }}>{answer}</pre>}
    </main>
  );
}
