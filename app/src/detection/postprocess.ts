/**
 * YOLOv8n 後処理。
 *
 * ONNX 出力 [1, 5, N]（5 = cx, cy, w, h, conf。1クラスなので 5）に対して:
 *   1. 信頼度 conf でフィルタリング
 *   2. xywh → xyxy 変換
 *   3. NMS で重複枠を削除
 *   4. 640 スケールの座標を元画像スケールへ戻す（単純リサイズ前提）
 *
 * アルゴリズムの骨格は設計書の検証済みロジックに従う。閾値のみ調整可。
 */
import type { Detection } from "../types";
import { MODEL_SIZE } from "./preprocess";

export const CONF_THRESHOLD = 0.25;
export const IOU_THRESHOLD = 0.45;

/**
 * 1. conf フィルタ + 2. xywh → xyxy。
 * 座標は 640 スケールのまま返す。
 *
 * @param data   出力テンソルの生データ（長さ 5 * numAnchors）
 * @param numAnchors アンカー数（出力 dims の最後の次元。YOLOv8n@640 なら 8400）
 */
export function decodeOutput(
  data: Float32Array,
  numAnchors: number,
  confThreshold: number = CONF_THRESHOLD,
): Detection[] {
  const detections: Detection[] = [];
  for (let i = 0; i < numAnchors; i++) {
    const conf = data[4 * numAnchors + i];
    if (conf < confThreshold) continue;
    const cx = data[i];
    const cy = data[numAnchors + i];
    const w = data[2 * numAnchors + i];
    const h = data[3 * numAnchors + i];
    detections.push({
      box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2],
      score: conf,
    });
  }
  return detections;
}

function iou(a: [number, number, number, number], b: [number, number, number, number]): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const areaA = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
  const areaB = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  const union = areaA + areaB - inter;
  return union <= 0 ? 0 : inter / union;
}

/** 3. NMS（スコア降順の貪欲法） */
export function nms(
  detections: Detection[],
  iouThreshold: number = IOU_THRESHOLD,
): Detection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept: Detection[] = [];
  for (const det of sorted) {
    let suppressed = false;
    for (const k of kept) {
      if (iou(det.box, k.box) > iouThreshold) {
        suppressed = true;
        break;
      }
    }
    if (!suppressed) kept.push(det);
  }
  return kept;
}

/**
 * 4. 640 スケール → 元画像スケール変換（単純リサイズの逆変換）+ 画像内 clamp。
 */
export function scaleToOriginal(
  detections: Detection[],
  originalWidth: number,
  originalHeight: number,
): Detection[] {
  const scaleX = originalWidth / MODEL_SIZE;
  const scaleY = originalHeight / MODEL_SIZE;
  return detections.map((det) => {
    const x1 = Math.min(Math.max(det.box[0] * scaleX, 0), originalWidth);
    const y1 = Math.min(Math.max(det.box[1] * scaleY, 0), originalHeight);
    const x2 = Math.min(Math.max(det.box[2] * scaleX, 0), originalWidth);
    const y2 = Math.min(Math.max(det.box[3] * scaleY, 0), originalHeight);
    return { box: [x1, y1, x2, y2] as [number, number, number, number], score: det.score };
  });
}
