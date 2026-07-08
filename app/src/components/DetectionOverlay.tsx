/**
 * 撮影画像の上に検出枠とスコアを描画する SVG オーバーレイ。
 *
 * 親 View が撮影画像と同じアスペクト比であることを前提に、
 * viewBox を画像ピクセル座標に合わせて全体へ引き伸ばす。
 * これで検出座標（画像ピクセル）をそのまま渡せる。
 */
import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import type { Detection } from "../types";

type Props = {
  imageWidth: number;
  imageHeight: number;
  detections: Detection[];
};

export function DetectionOverlay({ imageWidth, imageHeight, detections }: Props) {
  // 画像サイズに対する相対値で線幅・文字サイズを決める（表示倍率に依存しない）
  const strokeWidth = Math.max(imageWidth, imageHeight) * 0.004;
  const fontSize = Math.max(imageWidth, imageHeight) * 0.03;

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="none"
    >
      {detections.map((det, index) => {
        const [x1, y1, x2, y2] = det.box;
        const labelY = y1 - fontSize * 0.4;
        return (
          <React.Fragment key={index}>
            <Rect
              x={x1}
              y={y1}
              width={x2 - x1}
              height={y2 - y1}
              fill="none"
              stroke="#00e676"
              strokeWidth={strokeWidth}
            />
            <SvgText
              x={x1}
              // 枠が画面上端に近いときはラベルを枠の内側に出す
              y={labelY < fontSize ? y1 + fontSize : labelY}
              fill="#00e676"
              fontSize={fontSize}
              fontWeight="bold"
            >
              {det.score.toFixed(2)}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
