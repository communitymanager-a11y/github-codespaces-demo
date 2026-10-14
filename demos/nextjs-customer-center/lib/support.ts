import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { ORDERS } from "./orders";

// --- モックデータ（実際のシステムの代わり。注文は lib/orders.ts） ---

const FAQ = [
  { q: "返品したい", a: "商品到着から 14 日以内、未使用の場合のみ返品を受け付けます。送料はお客様負担です。" },
  { q: "支払い方法", a: "クレジットカード、コンビニ払い、銀行振込に対応しています。" },
  { q: "配送日数", a: "通常は注文から 3〜5 営業日でお届けします。離島は +2 日かかります。" },
  { q: "営業時間", a: "カスタマーセンターは平日 9:00〜18:00 です。" },
];

const textResult = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data) }],
});

// --- ツール定義 ---

export const supportServer = createSdkMcpServer({
  name: "support",
  tools: [
    tool("lookup_order", "注文番号から注文状況を調べる", { order_id: z.string() }, async ({ order_id }) =>
      textResult(ORDERS[order_id.toUpperCase()] ?? { error: `注文 ${order_id} は見つかりません` }),
    ),
    tool("search_faq", "よくある質問から関連する回答を探す", { keyword: z.string() }, async ({ keyword }) => {
      const hits = FAQ.filter((f) => f.q.includes(keyword) || f.a.includes(keyword));
      return textResult(hits.length ? hits : { error: "該当する FAQ はありません" });
    }),
    tool(
      "issue_refund",
      "注文を返金する（担当者の承認が必要）",
      { order_id: z.string(), reason: z.string() },
      async ({ order_id }) => {
        const order = ORDERS[order_id.toUpperCase()];
        return textResult(
          order ? { refunded: order.price, order_id: order_id.toUpperCase() } : { error: `注文 ${order_id} は見つかりません` },
        );
      },
    ),
    tool("escalate_to_human", "人間のオペレーターに引き継ぐ", { summary: z.string() }, async ({ summary }) =>
      textResult({ ticket_id: "T-0001", summary, status: "オペレーターに引き継ぎ済み" }),
    ),
  ],
});

export const SYSTEM_PROMPT = `あなたは通販サイトのカスタマーセンターの担当者です。
- 丁寧な日本語で、簡潔に回答してください。
- 注文の状況は lookup_order、一般的な質問は search_faq で必ず確認してから答えてください。推測で答えないでください。
- 返金は issue_refund で行います。返品ポリシーを FAQ で確認し、条件を満たす場合のみ実行してください。
- 自分で解決できない場合やお客様が怒っている場合は escalate_to_human で引き継いでください。`;

// --- 返金の承認待ち（開発サーバー 1 プロセス内で共有する。HMR で消えないよう globalThis に置く） ---

type Pending = Map<string, (approved: boolean) => void>;
const g = globalThis as unknown as { __pendingApprovals?: Pending };
export const pendingApprovals: Pending = (g.__pendingApprovals ??= new Map());
