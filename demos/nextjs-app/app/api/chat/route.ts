import { query } from "@anthropic-ai/claude-agent-sdk";

export async function POST(request: Request) {
  const { prompt } = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let streamed = false;
        for await (const message of query({
          prompt,
          options: { maxTurns: 1, includePartialMessages: true },
        })) {
          if (message.type === "stream_event") {
            const event = message.event;
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              streamed = true;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          } else if (
            message.type === "result" &&
            message.subtype === "success" &&
            !streamed
          ) {
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
