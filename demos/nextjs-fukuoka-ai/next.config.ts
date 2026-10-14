import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Agent SDK は claude の実行ファイルを子プロセスで起動するため、バンドルせず Node.js から直接読み込む
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
  // Codespaces のポート転送 URL からの開発サーバーへのアクセスを許可する
  allowedDevOrigins: ["*.app.github.dev"],
};

export default nextConfig;
