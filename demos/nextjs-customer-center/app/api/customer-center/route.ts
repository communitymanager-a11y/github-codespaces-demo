import { query } from "@anthropic-ai/claude-agent-sdk";
import { SYSTEM_PROMPT, pendingApprovals, supportServer } from "../../../lib/support";

// 1 行 1 イベントの JSON（NDJSON）で画面にストリームする
export async function POST(request: Request) {
  const { prompt, sessionId } = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        for await (const message of query({
          prompt,
          options: {
            systemPrompt: SYSTEM_PROMPT,
            mcpServers: { support: supportServer },
            tools: [], // Read / Bash などの組み込みツールは使わせない
            // 参照系は自動で許可。issue_refund は含めないので canUseTool に確認が飛ぶ
            allowedTools: ["mcp__support__lookup_order", "mcp__support__search_faq", "mcp__support__escalate_to_human"],
            canUseTool: (toolName, input) =>
              new Promise((resolve) => {
                const id = crypto.randomUUID();
                pendingApprovals.set(id, (approved) =>
                  resolve(
                    approved
                      ? { behavior: "allow", updatedInput: input }
                      : { behavior: "deny", message: "担当者が返金を承認しませんでした。お客様にその旨を伝えてください。" },
                  ),
                );
                send({ type: "approval", id, tool: toolName.replace("mcp__support__", ""), input });
              }),
            resume: sessionId, // 2 回目以降は前回のセッションを再開して会話を続ける
            maxTurns: 10,
          },
        })) {
          if (message.type === "assistant") {
            for (const block of message.message.content) {
              if (block.type === "tool_use") {
                send({ type: "tool", name: block.name.replace("mcp__support__", ""), input: block.input });
              } else if (block.type === "text") {
                send({ type: "text", text: block.text });
              }
            }
          } else if (message.type === "result") {
            send({ type: "done", sessionId: message.session_id });
          }
        }
      } catch (error) {
        send({ type: "error", message: String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
