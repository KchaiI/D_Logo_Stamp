/**
 * ONNX モデル（YOLOv8n・同志社ロゴ1クラス）のロード。
 *
 * - モデルは Metro アセットとしてバンドルする（metro.config.js で "onnx" を assetExts に追加済み）
 * - expo-asset でローカルファイルへ解決してから onnxruntime-react-native に渡す
 * - セッションはアプリ内で1つだけ作り、使い回す
 */
import { Asset } from "expo-asset";
import { InferenceSession } from "onnxruntime-react-native";

let sessionPromise: Promise<InferenceSession> | null = null;

async function createSession(): Promise<InferenceSession> {
  const asset = Asset.fromModule(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("../../assets/models/doshisha_logo_yolov8n_v1.onnx"),
  );
  await asset.downloadAsync();
  const localUri = asset.localUri ?? asset.uri;
  if (localUri == null) {
    throw new Error("ONNX モデルアセットのローカルパスを解決できませんでした");
  }
  // onnxruntime-react-native はプレーンなファイルパスを想定しているため file:// を外す
  const path = localUri.startsWith("file://")
    ? localUri.slice("file://".length)
    : localUri;
  return InferenceSession.create(path);
}

/**
 * 共有の InferenceSession を返す。初回呼び出しでロードする。
 * ロード失敗時は次回呼び出しで再試行できるようにキャッシュを破棄する。
 */
export function getSession(): Promise<InferenceSession> {
  if (sessionPromise == null) {
    sessionPromise = createSession().catch((e: unknown) => {
      sessionPromise = null;
      throw e;
    });
  }
  return sessionPromise;
}
