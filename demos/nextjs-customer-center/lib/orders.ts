// モックの注文データ（エージェントのツールと画面の注文履歴で共有する）
export type Order = { item: string; emoji: string; price: number; status: string; eta: string | null };

export const ORDERS: Record<string, Order> = {
  A1001: { item: "ワイヤレスイヤホン", emoji: "🎧", price: 12800, status: "配送中", eta: "2日後" },
  A1002: { item: "モバイルバッテリー", emoji: "🔋", price: 4980, status: "配達完了", eta: null },
  A1003: { item: "USB-C ケーブル", emoji: "🔌", price: 1480, status: "準備中", eta: "5日後" },
};
