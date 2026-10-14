#!/usr/bin/env bash
# コンテナ作成後に 1 回だけ実行される（devcontainer.json の postCreateCommand）
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Python 仮想環境 (.venv) を作成"
uv venv --allow-existing .venv
uv pip install --python .venv/bin/python -r demos/agent-sdk-python/requirements.txt

echo "==> Agent SDK (TypeScript) デモの依存をインストール"
npm install --prefix demos/agent-sdk-ts

echo "==> Next.js デモの依存をインストール"
for app in nextjs-chat nextjs-customer-center nextjs-fukuoka-ai; do
  npm install --prefix demos/$app
done

echo "==> MuJoCo (ブラウザ) デモの依存をインストール"
npm install --prefix demos/mujoco-web

echo "==> セットアップ完了"
