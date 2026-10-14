import { readFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";

// 市政だより(UTF-8 に変換済み。元データは Shift_JIS/cp932)
const SOURCE_URL =
  "https://www.city.fukuoka.lg.jp/shicho/koho/shisei/shisei/documents/20261001.txt";
const SOURCE_FILE = path.join(process.cwd(), "data", "fukuoka-shicho", "20261001.txt");

let cachedText: string | null = null;
async function loadShicho() {
  cachedText ??= await readFile(SOURCE_FILE, "utf-8");
  return cachedText;
}

function buildSystemPrompt(shicho: string) {
  return `あなたは福岡市の「市政だより」をもとに市民の質問へ答える、福岡市AIアシスタントです。
福岡市役所の親切な職員のように、やさしく丁寧な言葉づかいで回答してください。

# 回答のルール
- 回答は、下の【市政だより 10月1日号】に書かれている内容だけを根拠にしてください。
- 書かれていないこと・分からないことは、推測せず「市政だよりには載っていませんでした」と正直に伝え、市役所代表電話 092-711-4111 など、記事に載っている問い合わせ先を案内してください。
- 日時・場所・費用・申込方法・締切・電話番号など、市民が行動するときに必要な情報は、省略せず正確に伝えてください。
- 回答の最後に、根拠にした記事の見出しなどを一言添えてください。
- 長くなりすぎないよう、箇条書きなども使って読みやすくまとめてください。
- 冒頭は「お問い合わせありがとうございます」のような一言から始めても構いませんが、毎回同じ定型文にならないようにしてください。
- 最新・正確な情報は公式サイトや窓口で確認してもらうよう、必要に応じて添えてください。

# 出典
${SOURCE_URL}

【市政だより 10月1日号】
${shicho}`;
}

type Message = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const { messages } = (await request.json()) as { messages: Message[] };
  if (!Array.isArray(messages) || messages.length === 0 || messages.at(-1)?.role !== "user") {
    return Response.json({ error: "messages が不正です" }, { status: 400 });
  }

  const shicho = await loadShicho();
  const history = messages
    .map((m) => `${m.role === "user" ? "市民" : "職員"}: ${m.content}`)
    .join("\n\n");
  const prompt = `これまでの会話:\n\n${history}\n\n最後の「市民」の質問に、職員として回答してください。`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let streamed = false;
        for await (const message of query({
          prompt,
          options: {
            systemPrompt: buildSystemPrompt(shicho),
            tools: [],
            maxTurns: 1,
            includePartialMessages: true,
          },
        })) {
          if (message.type === "stream_event") {
            const event = message.event;
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              streamed = true;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          } else if (message.type === "result" && message.subtype === "success" && !streamed) {
            controller.enqueue(encoder.encode(message.result));
          }
        }
      } catch (error) {
        controller.enqueue(encoder.encode(`\n[error] ${String(error)}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
