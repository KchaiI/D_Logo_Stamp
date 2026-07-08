/**
 * スタンプの端末内永続化。
 *
 * - スタンプ画像: expo-file-system の documentDirectory/stamps/ に保存
 * - メタデータ: react-native-mmkv（キー STAMPS_KEY）に JSON で保存
 * - 1日1個ルール: StampsByDate[date] の有無で判定
 *
 * サーバー送信は行わない。すべて端末内で完結する。
 */
import { Directory, File, Paths } from "expo-file-system";
import { createMMKV } from "react-native-mmkv";
import { STAMPS_KEY, type StampRecord, type StampsByDate } from "../types";

const storage = createMMKV();

const STAMPS_DIR_NAME = "stamps";

/** 端末ローカル時刻での今日の日付キー (YYYY-MM-DD) */
export function getTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 全スタンプ記録を読み込む。壊れていたら空を返す */
export function loadStamps(): StampsByDate {
  const json = storage.getString(STAMPS_KEY);
  if (json == null) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as StampsByDate;
    }
    return {};
  } catch {
    return {};
  }
}

/** 指定日のスタンプ記録（なければ undefined） */
export function getStampForDate(date: string): StampRecord | undefined {
  return loadStamps()[date];
}

/** 1日1個ルールの判定 */
export function hasStampForDate(date: string): boolean {
  return loadStamps()[date] != null;
}

/**
 * 記録の imagePath（documentDirectory 相対）を表示用の file:// URI に解決する。
 */
export function resolveStampImageUri(record: StampRecord): string {
  if (record.imagePath.startsWith("file://")) {
    // 旧形式（絶対 URI）への保険
    return record.imagePath;
  }
  return new File(Paths.document, record.imagePath).uri;
}

export type SaveStampResult =
  | { status: "saved"; record: StampRecord }
  | { status: "already"; record: StampRecord };

/**
 * スタンプを保存する。
 *
 * @param date 獲得日 (YYYY-MM-DD)
 * @param croppedImageUri 切り抜き済みスタンプ画像（cache 上）の file:// URI
 * @param score 検出スコア
 * @param box 検出矩形 [x1, y1, x2, y2]（撮影画像ピクセル座標）
 *
 * すでにその日の記録がある場合は保存せず既存記録を返す（1日1個ルール）。
 */
export async function saveStamp(
  date: string,
  croppedImageUri: string,
  score: number,
  box: [number, number, number, number],
): Promise<SaveStampResult> {
  const existing = getStampForDate(date);
  if (existing != null) {
    return { status: "already", record: existing };
  }

  // documentDirectory/stamps/ を用意
  const dir = new Directory(Paths.document, STAMPS_DIR_NAME);
  dir.create({ intermediates: true, idempotent: true });

  // cache 上の切り抜き画像を documentDirectory へ移動
  const filename = `${date}_${Date.now().toString(36)}.jpg`;
  const dest = new File(dir, filename);
  const src = new File(croppedImageUri);
  await src.move(dest);

  const record: StampRecord = {
    date,
    imagePath: `${STAMPS_DIR_NAME}/${filename}`,
    createdAt: Date.now(),
    score,
    box,
  };

  const all = loadStamps();
  all[date] = record;
  storage.set(STAMPS_KEY, JSON.stringify(all));

  return { status: "saved", record };
}
