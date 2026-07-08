/**
 * 前処理: 撮影画像 → Float32 テンソルデータ [1, 3, 640, 640]
 *
 * - 640×640 への単純リサイズ（学習時と同じ。letterbox は使わない）
 * - 0〜1 正規化
 * - NCHW（プレーナ RGB）の Float32Array を作る
 *
 * ピクセル取得は react-native-nitro-image（VisionCamera v5 の Photo.toImage() が
 * 返す Image 型）で行う。JS 側での JPEG デコードは不要。
 */
import type { Image } from "react-native-nitro-image";

export const MODEL_SIZE = 640;

type ChannelLayout = { r: number; g: number; b: number; stride: number };

const CHANNEL_LAYOUTS: Record<string, ChannelLayout | undefined> = {
  RGBA: { r: 0, g: 1, b: 2, stride: 4 },
  BGRA: { r: 2, g: 1, b: 0, stride: 4 },
  ARGB: { r: 1, g: 2, b: 3, stride: 4 },
  ABGR: { r: 3, g: 2, b: 1, stride: 4 },
  RGBX: { r: 0, g: 1, b: 2, stride: 4 },
  BGRX: { r: 2, g: 1, b: 0, stride: 4 },
  XRGB: { r: 1, g: 2, b: 3, stride: 4 },
  XBGR: { r: 3, g: 2, b: 1, stride: 4 },
  RGB: { r: 0, g: 1, b: 2, stride: 3 },
  BGR: { r: 2, g: 1, b: 0, stride: 3 },
};

/**
 * nitro Image を 640×640 にリサイズし、NCHW / RGB / 0..1 の Float32Array に変換する。
 */
export async function imageToTensorData(image: Image): Promise<Float32Array> {
  const needsResize =
    image.width !== MODEL_SIZE || image.height !== MODEL_SIZE;
  const resized = needsResize
    ? await image.resizeAsync(MODEL_SIZE, MODEL_SIZE)
    : image;

  try {
    const raw = await resized.toRawPixelDataAsync();
    const layout = CHANNEL_LAYOUTS[raw.pixelFormat];
    if (layout == null) {
      throw new Error(`未対応のピクセルフォーマット: ${raw.pixelFormat}`);
    }

    const src = new Uint8Array(raw.buffer);
    const width = raw.width;
    const height = raw.height;
    // 行パディング（bytesPerRow > width * stride）があっても正しく読めるように
    // 行バイト数はバッファ長から求める
    const rowBytes = Math.floor(src.byteLength / height);
    if (rowBytes < width * layout.stride) {
      throw new Error(
        `ピクセルバッファが小さすぎます: ${src.byteLength} bytes for ${width}x${height} (${raw.pixelFormat})`,
      );
    }

    const plane = width * height;
    const out = new Float32Array(3 * plane);
    let i = 0;
    for (let y = 0; y < height; y++) {
      let p = y * rowBytes;
      for (let x = 0; x < width; x++) {
        out[i] = src[p + layout.r] / 255; // R
        out[plane + i] = src[p + layout.g] / 255; // G
        out[2 * plane + i] = src[p + layout.b] / 255; // B
        p += layout.stride;
        i++;
      }
    }
    return out;
  } finally {
    if (needsResize) {
      resized.dispose();
    }
  }
}
