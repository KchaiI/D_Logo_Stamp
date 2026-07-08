/**
 * アプリ全体で共有する型定義と定数。
 */

/** 1件のスタンプ獲得記録 */
export type StampRecord = {
  /** 獲得日 (YYYY-MM-DD) */
  date: string;
  /**
   * スタンプ画像のパス。
   * documentDirectory からの相対パス（例: "stamps/2026-07-08_xxx.jpg"）で保存する。
   * アプリ更新でコンテナの絶対パスが変わっても壊れないようにするため。
   */
  imagePath: string;
  /** 獲得時刻 (epoch ms) */
  createdAt: number;
  /** 検出スコア (0..1) */
  score: number;
  /** 検出矩形 [x1, y1, x2, y2]（撮影画像ピクセル座標） */
  box: [number, number, number, number];
};

/** 日付 → スタンプ記録 */
export type StampsByDate = Record<string, StampRecord>;

/** MMKV の保存キー */
export const STAMPS_KEY = "stamps_by_date";

/** 1件の検出結果（座標は撮影画像ピクセルスケール, xyxy） */
export type Detection = {
  box: [number, number, number, number];
  score: number;
};
