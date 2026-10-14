import asyncio
import json
import sys
import warnings
from typing import Any

from claude_agent_sdk import (
    AssistantMessage,
    CanUseToolShadowedWarning,
    ClaudeAgentOptions,
    ClaudeSDKClient,
    PermissionResultAllow,
    PermissionResultDeny,
    ResultMessage,
    TextBlock,
    ToolUseBlock,
    create_sdk_mcp_server,
    tool,
)

# 実行例: .venv/bin/python demos/customer-center-python/main.py
# 1 行だけ試すとき: .venv/bin/python demos/customer-center-python/main.py "注文 A1001 はいつ届きますか？"

# 参照系ツールを自動許可して issue_refund だけ承認するのは意図どおりなので、警告は出さない
warnings.filterwarnings("ignore", category=CanUseToolShadowedWarning)

# --- モックデータ（実際のシステムの代わり） ---

ORDERS = {
    "A1001": {"item": "ワイヤレスイヤホン", "price": 12800, "status": "配送中", "eta": "2日後"},
    "A1002": {"item": "モバイルバッテリー", "price": 4980, "status": "配達完了", "eta": None},
    "A1003": {"item": "USB-C ケーブル", "price": 1480, "status": "準備中", "eta": "5日後"},
}

FAQ = [
    {"q": "返品したい", "a": "商品到着から 14 日以内、未使用の場合のみ返品を受け付けます。送料はお客様負担です。"},
    {"q": "支払い方法", "a": "クレジットカード、コンビニ払い、銀行振込に対応しています。"},
    {"q": "配送日数", "a": "通常は注文から 3〜5 営業日でお届けします。離島は +2 日かかります。"},
    {"q": "営業時間", "a": "カスタマーセンターは平日 9:00〜18:00 です。"},
]


def text_result(data: Any) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": json.dumps(data, ensure_ascii=False)}]}


# --- ツール定義 ---


@tool("lookup_order", "注文番号から注文状況を調べる", {"order_id": str})
async def lookup_order(args: dict[str, Any]) -> dict[str, Any]:
    order = ORDERS.get(args["order_id"].upper())
    return text_result(order or {"error": f"注文 {args['order_id']} は見つかりません"})


@tool("search_faq", "よくある質問から関連する回答を探す", {"keyword": str})
async def search_faq(args: dict[str, Any]) -> dict[str, Any]:
    hits = [f for f in FAQ if args["keyword"] in f["q"] or args["keyword"] in f["a"]]
    return text_result(hits or {"error": "該当する FAQ はありません"})


@tool("issue_refund", "注文を返金する（担当者の承認が必要）", {"order_id": str, "reason": str})
async def issue_refund(args: dict[str, Any]) -> dict[str, Any]:
    order = ORDERS.get(args["order_id"].upper())
    if not order:
        return text_result({"error": f"注文 {args['order_id']} は見つかりません"})
    return text_result({"refunded": order["price"], "order_id": args["order_id"].upper()})


@tool("escalate_to_human", "人間のオペレーターに引き継ぐ", {"summary": str})
async def escalate_to_human(args: dict[str, Any]) -> dict[str, Any]:
    return text_result({"ticket_id": "T-0001", "summary": args["summary"], "status": "オペレーターに引き継ぎ済み"})


SERVER = create_sdk_mcp_server(
    name="support",
    tools=[lookup_order, search_faq, issue_refund, escalate_to_human],
)

SYSTEM_PROMPT = """あなたは通販サイトのカスタマーセンターの担当者です。
- 丁寧な日本語で、簡潔に回答してください。
- 注文の状況は lookup_order、一般的な質問は search_faq で必ず確認してから答えてください。推測で答えないでください。
- 返金は issue_refund で行います。返品ポリシーを FAQ で確認し、条件を満たす場合のみ実行してください。
- 自分で解決できない場合やお客様が怒っている場合は escalate_to_human で引き継いでください。"""


# --- 返金だけは人間（このデモでは端末の入力）が承認する ---


async def approve_refund(tool_name: str, tool_input: dict[str, Any], _context: Any):
    answer = await asyncio.to_thread(
        input, f"\n[承認待ち] {tool_name} {json.dumps(tool_input, ensure_ascii=False)} を実行しますか？ (y/N) "
    )
    if answer.strip().lower() == "y":
        return PermissionResultAllow()
    return PermissionResultDeny(message="担当者が返金を承認しませんでした。お客様にその旨を伝えてください。")


OPTIONS = ClaudeAgentOptions(
    system_prompt=SYSTEM_PROMPT,
    mcp_servers={"support": SERVER},
    tools=[],  # Read / Bash などの組み込みツールは使わせない
    # 参照系は自動で許可。issue_refund は含めないので can_use_tool に確認が飛ぶ
    allowed_tools=["mcp__support__lookup_order", "mcp__support__search_faq", "mcp__support__escalate_to_human"],
    can_use_tool=approve_refund,
    max_turns=10,
)


async def ask(client: ClaudeSDKClient, prompt: str) -> None:
    await client.query(prompt)
    async for message in client.receive_response():
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, ToolUseBlock):
                    print(f"  🔧 {block.name.removeprefix('mcp__support__')}({json.dumps(block.input, ensure_ascii=False)})")
                elif isinstance(block, TextBlock):
                    print(f"\n担当者: {block.text}\n")
        elif isinstance(message, ResultMessage) and message.subtype != "success":
            print(f"エラー: {message.subtype}")


async def main() -> None:
    async with ClaudeSDKClient(options=OPTIONS) as client:
        if len(sys.argv) > 1:
            await ask(client, sys.argv[1])
            return
        print("カスタマーセンターへようこそ（終了は Ctrl+D か「quit」）")
        print("例: 注文 A1001 はいつ届きますか？ / A1002 を返品して返金してほしい\n")
        while True:
            try:
                prompt = (await asyncio.to_thread(input, "お客様: ")).strip()
            except EOFError:
                break
            if prompt in ("quit", "exit"):
                break
            if prompt:
                await ask(client, prompt)


if __name__ == "__main__":
    asyncio.run(main())
