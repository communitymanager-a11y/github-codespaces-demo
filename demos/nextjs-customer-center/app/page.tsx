"use client";

import { useEffect, useRef, useState } from "react";
import { ORDERS } from "../lib/orders";

type Item = { kind: "user" | "agent" | "tool"; text: string };
type Approval = { id: string; tool: string; input: Record<string, unknown> };

const yen = (n: number) => `￥${n.toLocaleString("ja-JP")}`;

export default function CustomerCenter() {
  const [items, setItems] = useState<Item[]>([
    { kind: "agent", text: "こんにちは。カスタマーサービスです。ご注文についてお困りのことはありませんか？" },
  ]);
  const [prompt, setPrompt] = useState("");
  const [sessionId, setSessionId] = useState<string>();
  const [approval, setApproval] = useState<Approval>();
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [items, approval]);

  const add = (item: Item) => setItems((prev) => [...prev, item]);

  async function send(text: string) {
    if (!text || loading) return;
    setPrompt("");
    setLoading(true);
    add({ kind: "user", text });

    try {
      const res = await fetch("/api/customer-center", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, sessionId }),
      });
      if (!res.body) throw new Error("レスポンスがありません");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const e = JSON.parse(line);
          if (e.type === "text") add({ kind: "agent", text: e.text });
          else if (e.type === "tool") add({ kind: "tool", text: `🔧 ${e.name}(${JSON.stringify(e.input)})` });
          else if (e.type === "approval") setApproval(e);
          else if (e.type === "done") setSessionId(e.sessionId);
          else if (e.type === "error") add({ kind: "agent", text: `[error] ${e.message}` });
        }
      }
    } catch (error) {
      add({ kind: "agent", text: `[error] ${String(error)}` });
    } finally {
      setLoading(false);
    }
  }

  async function answerApproval(approved: boolean) {
    if (!approval) return;
    const { id } = approval;
    setApproval(undefined);
    await fetch("/api/customer-center/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved }),
    });
  }

  return (
    <>
      <header className="shop-header">
        <div className="shop-logo">
          shop<span>mart</span>
        </div>
        <form className="shop-search" onSubmit={(e) => e.preventDefault()}>
          <input placeholder="shopmart を検索" aria-label="検索" />
          <button type="submit" aria-label="検索">
            🔍
          </button>
        </form>
        <div className="shop-links">
          <div>
            こんにちは<b>アカウント＆リスト</b>
          </div>
          <div>
            返品もこちら<b>注文履歴</b>
          </div>
          <div>
            <b>🛒 カート</b>
          </div>
        </div>
      </header>
      <nav className="shop-nav">
        <span>☰ すべて</span>
        <span>タイムセール</span>
        <span>ギフトカード</span>
        <span>カスタマーサービス</span>
        <span>売れ筋ランキング</span>
        <span>新着商品</span>
      </nav>

      <div className="shop-body">
        <section>
          <h1>ご注文履歴</h1>
          {Object.entries(ORDERS).map(([id, order]) => (
            <div className="card" key={id}>
              <div className="card-head">
                <div>
                  注文番号<b>{id}</b>
                </div>
                <div>
                  合計<b>{yen(order.price)}</b>
                </div>
              </div>
              <div className="card-main">
                <div className="thumb">{order.emoji}</div>
                <div>
                  <h3>{order.item}</h3>
                  <div className={`status ${order.status === "配達完了" ? "done" : "ship"}`}>{order.status}</div>
                  {order.eta && <div>お届け予定: {order.eta}</div>}
                </div>
                <div className="card-actions">
                  <button className="btn" disabled={loading} onClick={() => send(`注文 ${id} の状況を教えてください。`)}>
                    配送状況を問い合わせる
                  </button>
                  <button
                    className="btn sub"
                    disabled={loading}
                    onClick={() => send(`注文 ${id} を返品して返金してほしいです。未使用です。`)}
                  >
                    返品・返金を相談する
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>

        <aside className="chat">
          <div className="chat-box">
            <div className="chat-title">
              カスタマーサービス
              <small>Claude Agent SDK で動いています</small>
            </div>
            <div className="chat-log" ref={logRef}>
              {items.map((item, i) => (
                <p key={i} className={`msg ${item.kind}`}>
                  {item.text}
                </p>
              ))}
              {loading && !approval && <p className="msg tool">対応中...</p>}
            </div>
            {approval && (
              <div className="approve">
                <strong>【担当者の承認待ち】</strong> {approval.tool}
                <pre>{JSON.stringify(approval.input, null, 2)}</pre>
                <button className="btn warn" onClick={() => answerApproval(true)} style={{ marginRight: 8 }}>
                  承認して実行
                </button>
                <button className="btn sub" onClick={() => answerApproval(false)}>
                  却下
                </button>
              </div>
            )}
            <form
              className="chat-form"
              onSubmit={(e) => {
                e.preventDefault();
                send(prompt.trim());
              }}
            >
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(prompt.trim());
                  }
                }}
                rows={2}
                placeholder="お問い合わせ内容を入力（Shift+Enter で改行）"
              />
              <button className="btn" type="submit" disabled={loading}>
                送信
              </button>
            </form>
          </div>
        </aside>
      </div>
    </>
  );
}
