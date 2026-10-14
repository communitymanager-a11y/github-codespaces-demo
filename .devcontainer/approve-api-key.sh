#!/usr/bin/env bash
# コンテナ起動のたびに実行される（devcontainer.json の postStartCommand）。
#
# Claude Code は対話モード（VSCode 拡張・ターミナルの claude）で ANTHROPIC_API_KEY を使う前に
# 「Detected a custom API key in your environment」の承認を 1 回求める（既定は No）。
# 拡張ではこの確認に答えられず "Not logged in" になるため、~/.claude.json に承認済みとして記録しておく。
# あわせて、ワークスペースのフォルダを信頼済みにするなど、初回の確認画面を省く。
set -euo pipefail

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ANTHROPIC_API_KEY が設定されていません（Codespaces の Secret を確認してください）"
  exit 0
fi

WORKSPACE="$(cd "$(dirname "$0")/.." && pwd)"

python3 - "$WORKSPACE" <<'EOF'
import json
import os
import sys
from pathlib import Path

path = Path.home() / ".claude.json"
config = json.loads(path.read_text()) if path.exists() else {}

# Claude Code はキーの末尾 20 文字で承認済みかどうかを判定する
key_suffix = os.environ["ANTHROPIC_API_KEY"][-20:]
responses = config.setdefault("customApiKeyResponses", {"approved": [], "rejected": []})
responses.setdefault("approved", [])
responses.setdefault("rejected", [])
if key_suffix not in responses["approved"]:
    responses["approved"].append(key_suffix)
if key_suffix in responses["rejected"]:
    responses["rejected"].remove(key_suffix)

# ターミナルの claude で初回に出るテーマ選択画面を省く
config.setdefault("hasCompletedOnboarding", True)
config.setdefault("projects", {}).setdefault(sys.argv[1], {})["hasTrustDialogAccepted"] = True

path.write_text(json.dumps(config, indent=2))
print("Claude Code に ANTHROPIC_API_KEY を承認済みとして登録しました")
EOF
