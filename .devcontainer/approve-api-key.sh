#!/usr/bin/env bash
# コンテナ起動のたびに実行される（devcontainer.json の postStartCommand）。
#
# Claude Code は対話モード（VSCode 拡張・ターミナルの claude）で ANTHROPIC_API_KEY を使う前に
# 「Detected a custom API key in your environment」の承認を 1 回求める（既定は No）。
# 拡張ではこの確認に答えられず "Not logged in" になるため、~/.claude.json に承認済みとして記録する。
# あわせて、テーマ選択とフォルダの信頼確認の画面も省く。
set -euo pipefail

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ANTHROPIC_API_KEY が設定されていません（Codespaces の Secret を確認してください）"
  exit 0
fi

CONFIG=~/.claude.json
[ -f "$CONFIG" ] || echo '{}' > "$CONFIG"

# Claude Code はキーの末尾 20 文字で承認済みかどうかを判定する
jq --arg key "${ANTHROPIC_API_KEY: -20}" --arg dir "$PWD" '
  .customApiKeyResponses.approved = ((.customApiKeyResponses.approved // []) + [$key] | unique)
  | .hasCompletedOnboarding = true
  | .projects[$dir].hasTrustDialogAccepted = true
' "$CONFIG" > "$CONFIG.tmp" && mv "$CONFIG.tmp" "$CONFIG"
