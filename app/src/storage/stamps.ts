/**
 * スタンプの端末内永続化。
 *
 * - スタンプ画像: expo-file-system の documentDirectory/stamps/ に保存
 * - メタデータ: react-native-mmkv（キー STAMPS_KEY）に JSON で保存
 * - 1日の獲得数上限は ALLOW_MULTIPLE_STAMPS_PER_DAY（src/config.ts）で切り替える
 *   - false のときは従来どおり1日1個ルール
 * - 各日付は複数記録 + カレンダー表示用の代表ID（selectedId）を持つ
 * - 旧形式（日付 → 単一 StampRecord）のデータは読み込み時に新形式へ移行する
 *
 * サーバー送信は行わない。すべて端末内で完結する。
 */
import { Directory, File, Paths } from "expo-file-system";
import { createMMKV } from "react-native-mmkv";
import { ALLOW_MULTIPLE_STAMPS_PER_DAY } from "../config";
import {
  STAMPS_KEY,
  type DayStamps,
  type StampRecord,
  type StampsByDate,
} from "../types";

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

/** 新規記録用の一意ID */
function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 1日分の保存値を DayStamps へ正規化する。
 * 旧形式（単一 StampRecord）は records 1件 + それを代表にして移行する。
 * 解釈できない値は null（その日付を無視）。
 */
function normalizeDay(value: unknown): DayStamps | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const v = value as Record<string, unknown>;

  // 新形式: { records: [...], selectedId: "..." }
  if (Array.isArray(v.records)) {
    const records = (v.records as StampRecord[]).filter(
      (r) => r != null && typeof r.imagePath === "string",
    );
    if (records.length === 0) return null;
    const selectedId =
      typeof v.selectedId === "string" &&
      records.some((r) => r.id === v.selectedId)
        ? v.selectedId
        : records[0].id;
    return { records, selectedId };
  }

  // 旧形式: 単一 StampRecord（id なし）
  if (typeof v.imagePath === "string") {
    const record = { ...(value as StampRecord) };
    if (typeof record.id !== "string") {
      // createdAt から決定的に生成し、読み込みごとに id が変わらないようにする
      record.id = `legacy_${record.createdAt}`;
    }
    return { records: [record], selectedId: record.id };
  }

  return null;
}

/** 全スタンプ記録を読み込む。旧形式は移行し、壊れていたら空を返す */
export function loadStamps(): StampsByDate {
  const json = storage.getString(STAMPS_KEY);
  if (json == null) return {};
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const result: StampsByDate = {};
    for (const [date, value] of Object.entries(parsed)) {
      const day = normalizeDay(value);
      if (day != null) result[date] = day;
    }
    return result;
  } catch {
    return {};
  }
}

/** 指定日の全スタンプ記録（獲得順、なければ空配列） */
export function getStampsForDate(date: string): StampRecord[] {
  return loadStamps()[date]?.records ?? [];
}

/** 指定日の代表スタンプ（カレンダー表示用。なければ undefined） */
export function getSelectedStamp(date: string): StampRecord | undefined {
  const day = loadStamps()[date];
  if (day == null) return undefined;
  return day.records.find((r) => r.id === day.selectedId) ?? day.records[0];
}

/** その日に1つでもスタンプがあるか（1日1個ルールの判定にも使う） */
export function hasStampForDate(date: string): boolean {
  return (loadStamps()[date]?.records.length ?? 0) > 0;
}

/** カレンダーに表示する代表スタンプを切り替える */
export function setSelectedStamp(date: string, id: string): void {
  const all = loadStamps();
  const day = all[date];
  if (day == null || !day.records.some((r) => r.id === id)) return;
  all[date] = { ...day, selectedId: id };
  storage.set(STAMPS_KEY, JSON.stringify(all));
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
  | { status: "saved"; record: StampRecord; countForDate: number }
  | { status: "already"; record: StampRecord };

/**
 * スタンプを保存する。
 *
 * @param date 獲得日 (YYYY-MM-DD)
 * @param croppedImageUri 切り抜き済みスタンプ画像（cache 上）の file:// URI
 * @param score 検出スコア
 * @param box 検出矩形 [x1, y1, x2, y2]（撮影画像ピクセル座標）
 *
 * ALLOW_MULTIPLE_STAMPS_PER_DAY が false で、すでにその日の記録がある場合は
 * 保存せず既存の代表記録を返す（1日1個ルール）。
 * true の場合は同じ日に何件でも追加する（代表は最初の1件のまま維持）。
 */
export async function saveStamp(
  date: string,
  croppedImageUri: string,
  score: number,
  box: [number, number, number, number],
): Promise<SaveStampResult> {
  const all = loadStamps();
  const day = all[date];

  if (day != null && !ALLOW_MULTIPLE_STAMPS_PER_DAY) {
    const selected =
      day.records.find((r) => r.id === day.selectedId) ?? day.records[0];
    return { status: "already", record: selected };
  }

  // documentDirectory/stamps/ を用意
  const dir = new Directory(Paths.document, STAMPS_DIR_NAME);
  dir.create({ intermediates: true, idempotent: true });

  // cache 上の切り抜き画像を documentDirectory へ移動
  // （1日複数保存できるため、同日でも衝突しないよう乱数を含める）
  const filename = `${date}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}.jpg`;
  const dest = new File(dir, filename);
  const src = new File(croppedImageUri);
  await src.move(dest);

  const record: StampRecord = {
    id: generateId(),
    date,
    imagePath: `${STAMPS_DIR_NAME}/${filename}`,
    createdAt: Date.now(),
    score,
    box,
  };

  const next: DayStamps =
    day == null
      ? { records: [record], selectedId: record.id }
      : { records: [...day.records, record], selectedId: day.selectedId };
  all[date] = next;
  storage.set(STAMPS_KEY, JSON.stringify(all));

  return { status: "saved", record, countForDate: next.records.length };
}
