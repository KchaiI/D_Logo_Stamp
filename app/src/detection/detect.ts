/**
 * 検出パイプラインの統合: nitro Image → 前処理 → ONNX 推論 → 後処理。
 */
import { Tensor } from "onnxruntime-react-native";
import type { Image } from "react-native-nitro-image";
import type { Detection } from "../types";
import { getSession } from "./model";
import { imageToTensorData, MODEL_SIZE } from "./preprocess";
import { decodeOutput, nms, scaleToOriginal } from "./postprocess";

export type DetectionResult = {
  /** NMS 済み・元画像ピクセルスケールの全検出（スコア降順） */
  detections: Detection[];
  /** 最高スコアの検出（スタンプ候補）。検出なしなら null */
  best: Detection | null;
  /** 推論（run のみ）の所要時間 ms */
  inferenceMs: number;
};

/**
 * 撮影画像から同志社ロゴを検出する。
 * 返る座標は image の (width, height) ピクセルスケール。
 */
export async function detectLogo(image: Image): Promise<DetectionResult> {
  const session = await getSession();

  // 前処理: 640×640 単純リサイズ・0..1 正規化・NCHW
  const tensorData = await imageToTensorData(image);
  const inputTensor = new Tensor("float32", tensorData, [
    1,
    3,
    MODEL_SIZE,
    MODEL_SIZE,
  ]);

  const inputName = session.inputNames[0];
  if (inputName == null) {
    throw new Error("ONNX モデルに入力がありません");
  }

  const start = Date.now();
  const results = await session.run({ [inputName]: inputTensor });
  const inferenceMs = Date.now() - start;

  // 出力名は固定しない: 最初の出力を使う
  const firstOutputName = session.outputNames[0];
  const output =
    (firstOutputName != null ? results[firstOutputName] : undefined) ??
    Object.values(results)[0];
  if (output == null) {
    throw new Error("ONNX 推論結果が空です");
  }

  // 期待形状は [1, 5, N]（N = 8400 @ 640）。N は dims から取る
  const dims = output.dims;
  if (dims.length !== 3 || dims[0] !== 1 || dims[1] !== 5) {
    throw new Error(`想定外の出力形状: [${dims.join(", ")}]`);
  }
  const numAnchors = dims[2];
  const data = output.data;
  if (!(data instanceof Float32Array)) {
    throw new Error(`想定外の出力データ型: ${output.type}`);
  }

  // 後処理: conf フィルタ → xywh→xyxy → NMS → 元画像スケールへ
  const decoded = decodeOutput(data, numAnchors);
  const suppressed = nms(decoded);
  const detections = scaleToOriginal(suppressed, image.width, image.height);
  detections.sort((a, b) => b.score - a.score);

  return {
    detections,
    best: detections.length > 0 ? detections[0] : null,
    inferenceMs,
  };
}
