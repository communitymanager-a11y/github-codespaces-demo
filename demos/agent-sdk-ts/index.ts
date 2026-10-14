import { query } from "@anthropic-ai/claude-agent-sdk";

// 実行例: npm start -- "好きな質問"
const prompt = process.argv[2] ?? "GitHub Codespaces を一文で説明してください。";

try {
  for await (const message of query({ prompt, options: { maxTurns: 1 } })) {
    if (message.type === "result" && message.subtype === "success") {
      console.log(message.result);
    }
  }
} catch (error) {
  console.error(`Query failed: ${error}`);
  process.exit(1);
}
