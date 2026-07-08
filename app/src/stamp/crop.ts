/**
 * スタンプ切り抜き: 検出矩形で撮影画像を crop する。
 *
 * expo-image-manipulator を使い、crop 範囲は画像外にはみ出さないよう clamp する。
 * 結果は cache 上の JPEG（file:// URI）として返る。永続化は storage/stamps.ts が行う。
 */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export type CropResult = {
  uri: string;
  width: number;
  height: number;
};

/**
 * @param imageUri 撮影画像の file:// URI
 * @param box 検出矩形 [x1, y1, x2, y2]（撮影画像ピクセル座標）
 * @param imageWidth 撮影画像の幅
 * @param imageHeight 撮影画像の高さ
 */
export async function cropStamp(
  imageUri: string,
  box: [number, number, number, number],
  imageWidth: number,
  imageHeight: number,
): Promise<CropResult> {
  // 画像内に clamp した整数矩形を作る
  const originX = Math.min(Math.max(Math.floor(box[0]), 0), imageWidth - 1);
  const originY = Math.min(Math.max(Math.floor(box[1]), 0), imageHeight - 1);
  const width = Math.max(1, Math.min(Math.ceil(box[2]) - originX, imageWidth - originX));
  const height = Math.max(1, Math.min(Math.ceil(box[3]) - originY, imageHeight - originY));

  const context = ImageManipulator.manipulate(imageUri).crop({
    originX,
    originY,
    width,
    height,
  });
  const rendered = await context.renderAsync();
  try {
    const result = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: 0.9,
    });
    return { uri: result.uri, width: result.width, height: result.height };
  } finally {
    rendered.release();
    context.release();
  }
}
