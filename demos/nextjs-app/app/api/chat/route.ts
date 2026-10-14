import { query } from "@anthropic-ai/claude-agent-sdk";

export async function POST(request: Request) {
  const { prompt } = await request.json();

  try {
    let result = "";
    for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
      if (message.type === "result" && message.subtype === "success") {
        result = message.result;
      }
    }
    return Response.json({ result });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
