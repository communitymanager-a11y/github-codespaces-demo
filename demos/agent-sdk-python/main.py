import asyncio
import sys

from claude_agent_sdk import ClaudeAgentOptions, ResultMessage, query

# 実行例: .venv/bin/python demos/agent-sdk-python/main.py "好きな質問"
PROMPT = sys.argv[1] if len(sys.argv) > 1 else "GitHub Codespaces を一文で説明してください。"


async def main() -> None:
    async for message in query(prompt=PROMPT, options=ClaudeAgentOptions(max_turns=1)):
        if isinstance(message, ResultMessage) and message.subtype == "success":
            print(message.result)


if __name__ == "__main__":
    asyncio.run(main())
