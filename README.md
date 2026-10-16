# GitHub Codespaces Demo

## 概要

GitHub Codespaces が非エンジニア向けのワークショップで使えるかの検証用のリポジトリ

a

## 検証内容

- Claude Code CLI を自動インストールして、Claude API 経由でコード生成
- Claude Code VSCode Extension を自動インストールして、Claude API 経由でコード生成
- Claude Agent SDK を自動インストールして、簡単なデモをTypeScript/Pythonで作成し、実行
- JupyterNotebook をVSCodeで開いて、コードを実行
- Next.jsを自動インストールして、デモと連携
- MuJoCo（物理シミュレーター）をブラウザで動かし、ボタン・音声・Web カメラで操作できるかを検証
- このリポジトリは公開し、Codespaces を README.md に記載されたリンクから開始できるかを検証

## 使い方（ワークショップ参加者向け）

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/hayatoshibahara/github-codespaces-demo)

1. 上のボタンを押す
2. 「Recommended secrets」の `ANTHROPIC_API_KEY` に Claude API キーを入力して「Create codespace」を押す
3. 数分待つと VSCode が開き、必要なものが自動でインストールされる

### デモの実行

| デモ | 実行方法 |
| --- | --- |
| Claude Code CLI | ターミナルで `claude` |
| Claude Code VSCode 拡張 | 左のサイドバーの Claude アイコン |
| Agent SDK (TypeScript) | `npm start --prefix demos/agent-sdk-ts` |
| Agent SDK (Python) | `.venv/bin/python demos/agent-sdk-python/main.py` |
| Agent SDK カスタマーセンター (Python) | `.venv/bin/python demos/customer-center-python/main.py`（対話形式。返金は端末で `y` を入力して承認） |
| Next.js カスタマーセンター | `npm run dev --prefix demos/nextjs-customer-center` → ポート 3001（返金は画面のボタンで承認） |
| Next.js 福岡市AI(市政だより) | `npm run dev --prefix demos/nextjs-fukuoka-ai` → ポート 3002 |
| Jupyter Notebook | `demos/notebook/demo.ipynb` を開き、カーネルに `.venv` を選んで実行 |
| Next.js チャット | `npm run dev --prefix demos/nextjs-chat` → 自動で開くブラウザのタブ（ポート 3000） |
| MuJoCo ロボット（ブラウザ） | `npm run dev --prefix demos/mujoco-web` → ポート 3003（ボタン・音声・Web カメラで操作。下記参照） |

### MuJoCo ロボットデモ（ブラウザ）

MuJoCo の公式 WebAssembly 版（`@mujoco/mujoco`）を使い、物理シミュレーションと 3D 描画をすべてブラウザ内で行う。Codespace はファイルを配信するだけなので、GPU は不要。

- **ボタン**: 上・下・前・後ろ・左・右でアームの手先を動かし、「つかむ」「はなす」で赤い箱をつかむ
- **音声**: 「🎤 聞き取り開始」を押して「前、下、下、下、つかんで、上、左、はなして」のように話す（文字入力欄でも同じ操作ができる）
- **カメラ**: 「📷 カメラ開始」を押すと、Web カメラの映像が画面右とシミュレーター内のモニターに映る

> マイクとカメラは、VS Code 内のプレビュー（Simple Browser）では許可できないことがある。ポートタブの地球儀アイコンから **Chrome か Edge で開く**。音声認識は Firefox では使えない。

### 作ったものを自分の GitHub にアップロードする

1. 左のサイドバーの「ソース管理」アイコンを開く
2. 上の入力欄に変更内容のメッセージ（例：`ワークショップの成果物`）を書いて「コミット」を押す
   - 「すべての変更をステージしてコミットしますか？」と聞かれたら「はい」
   - このとき、自分のアカウントにこのリポジトリのコピー（フォーク）が自動で作られる
3. 「変更の同期」（または「Publish Branch」）を押す
4. `https://github.com/<自分のユーザー名>/github-codespaces-demo` を開くと、アップロードされたコードが見られる。この URL を共有する

> フォークは公開リポジトリになる。API キーは Codespaces の Secret で渡しているのでファイルには含まれず、アップロードされない。

## 開発環境の構成

`.devcontainer/Dockerfile` に、インストールするものをすべて明示している（devcontainer features は使っていない）。

- Ubuntu 24.04 / Python 3.12（apt）/ uv / Node.js 24（NodeSource）/ Claude Code CLI
- コンテナ作成後に `.devcontainer/post-create.sh` が Python 仮想環境（`.venv`）と npm の依存をインストールする

### ローカル（rootless Docker）で動かす場合

rootless Docker ではコンテナ内の root がホストの自分のユーザーに対応するため、root で起動する。

```sh
export DEVCONTAINER_USER=root
code .   # → 「Reopen in Container」
```

`secrets` は Codespaces 専用なので、ローカルではコンテナ内のターミナルで `export ANTHROPIC_API_KEY=sk-ant-...` を実行する。
