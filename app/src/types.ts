/**
 * アプリ全体で共有する型定義と定数。
 */

/** 1件のスタンプ獲得記録 */
export type StampRecord = {
  /** 記録の一意ID（1日複数個の記録・代表選択に使う） */
  id: string;
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

/** 1日分のスタンプ記録（複数）と、カレンダーに表示する代表スタンプのID */
export type DayStamps = {
  /** その日に獲得した記録（獲得順） */
  records: StampRecord[];
  /** カレンダーの日付セルに表示する代表記録の id */
  selectedId: string;
};

/** 日付 → その日のスタンプ記録 */
export type StampsByDate = Record<string, DayStamps>;

/** MMKV の保存キー */
export const STAMPS_KEY = "stamps_by_date";

/** 1件の検出結果（座標は撮影画像ピクセルスケール, xyxy） */
export type Detection = {
  box: [number, number, number, number];
  score: number;
};
