/**
 * カメラ画面。
 *
 * - カメラ権限リクエスト
 * - 背面カメラのプレビュー表示
 * - 撮影 → ONNX 推論（同志社ロゴ検出）→ 検出枠 + スコア表示
 * - 検出できたら「スタンプを獲得」
 *   （1日1個 / 複数個は ALLOW_MULTIPLE_STAMPS_PER_DAY で切り替え）
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
} from "react-native-vision-camera";
import { DetectionOverlay } from "../components/DetectionOverlay";
import { ALLOW_MULTIPLE_STAMPS_PER_DAY } from "../config";
import { detectLogo } from "../detection/detect";
import { cropStamp } from "../stamp/crop";
import {
  getTodayKey,
  hasStampForDate,
  saveStamp,
} from "../storage/stamps";
import type { Detection } from "../types";

const PURPLE = "#522886";

type Captured = {
  uri: string;
  width: number;
  height: number;
};

type AnalysisState =
  | { phase: "analyzing" }
  | {
      phase: "done";
      detections: Detection[];
      best: Detection | null;
      inferenceMs: number;
    }
  | { phase: "error"; message: string };

type StampState = "idle" | "saving" | "saved" | "already";

export function CameraScreen() {
  const { hasPermission, requestPermission, canRequestPermission } =
    useCameraPermission();
  const device = useCameraDevice("back");
  const photoOutput = usePhotoOutput();
  const outputs = useMemo(() => [photoOutput], [photoOutput]);

  const [isCapturing, setIsCapturing] = useState(false);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState | null>(null);
  const [stampState, setStampState] = useState<StampState>("idle");
  // 保存後の「今日◯個目」表示用（複数モードのみ使用）
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const isReviewing = captured != null;

  const handleTakePhoto = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const photo = await photoOutput.capturePhoto({}, {});
      let imageOrNull = null;
      try {
        imageOrNull = await photo.toImageAsync();
      } finally {
        photo.dispose();
      }
      const image = imageOrNull;
      try {
        // 表示・切り抜き用に、推論と同じピクセルの JPEG を保存する
        const tmpPath = await image.saveToTemporaryFileAsync("jpg", 0.9);
        const uri = tmpPath.startsWith("file://") ? tmpPath : `file://${tmpPath}`;
        setCaptured({ uri, width: image.width, height: image.height });
        setStampState("idle");
        setSavedCount(null);
        setAnalysis({ phase: "analyzing" });

        const result = await detectLogo(image);
        setAnalysis({ phase: "done", ...result });
      } finally {
        image.dispose();
      }
    } catch (e) {
      setAnalysis({
        phase: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, photoOutput]);

  const handleRetake = useCallback(() => {
    setCaptured(null);
    setAnalysis(null);
    setStampState("idle");
    setSavedCount(null);
  }, []);

  const handleSaveStamp = useCallback(
    async (best: Detection) => {
      if (captured == null || stampState === "saving") return;
      setStampState("saving");
      try {
        const today = getTodayKey();
        if (!ALLOW_MULTIPLE_STAMPS_PER_DAY && hasStampForDate(today)) {
          setStampState("already");
          return;
        }
        const cropped = await cropStamp(
          captured.uri,
          best.box,
          captured.width,
          captured.height,
        );
        const result = await saveStamp(today, cropped.uri, best.score, best.box);
        if (result.status === "saved") {
          setSavedCount(result.countForDate);
          setStampState("saved");
        } else {
          setStampState("already");
        }
      } catch (e) {
        Alert.alert(
          "保存に失敗しました",
          e instanceof Error ? e.message : String(e),
        );
        setStampState("idle");
      }
    },
    [captured, stampState],
  );

  // --- 権限がない場合 ---
  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>カメラ権限が必要です</Text>
        <Text style={styles.permissionBody}>
          同志社ロゴを撮影してスタンプを記録するためにカメラを使用します。
        </Text>
        {canRequestPermission ? (
          <Pressable style={styles.primaryButton} onPress={requestPermission}>
            <Text style={styles.primaryButtonText}>カメラを許可する</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.primaryButton}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.primaryButtonText}>設定アプリで許可する</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // --- 撮影後のレビュー表示 ---
  if (isReviewing) {
    const detections =
      analysis?.phase === "done" ? analysis.detections : [];
    const best = analysis?.phase === "done" ? analysis.best : null;
    // 複数モードでは「獲得済み」による保存ブロックはしない
    const alreadyToday =
      !ALLOW_MULTIPLE_STAMPS_PER_DAY && hasStampForDate(getTodayKey());

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.reviewContent}>
        <View
          style={[
            styles.imageWrapper,
            { aspectRatio: captured.width / captured.height },
          ]}
        >
          <RNImage
            source={{ uri: captured.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          <DetectionOverlay
            imageWidth={captured.width}
            imageHeight={captured.height}
            detections={detections}
          />
        </View>

        {analysis?.phase === "analyzing" && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={PURPLE} />
            <Text style={styles.statusText}>ロゴを検出中…</Text>
          </View>
        )}

        {analysis?.phase === "error" && (
          <Text style={styles.errorText}>検出エラー: {analysis.message}</Text>
        )}

        {analysis?.phase === "done" && (
          <>
            {best != null ? (
              <Text style={styles.statusText}>
                同志社ロゴを検出しました（スコア {best.score.toFixed(2)} /{" "}
                {analysis.inferenceMs}ms）
              </Text>
            ) : (
              <Text style={styles.statusText}>
                ロゴを検出できませんでした。もう一度撮影してください。
              </Text>
            )}

            {stampState === "saved" && (
              <Text style={styles.successText}>
                {ALLOW_MULTIPLE_STAMPS_PER_DAY && savedCount != null
                  ? `今日${savedCount}個目のスタンプを獲得しました！カレンダーで確認できます。`
                  : "今日のスタンプを獲得しました！カレンダーで確認できます。"}
              </Text>
            )}
            {(stampState === "already" ||
              (best != null && stampState === "idle" && alreadyToday)) && (
              <Text style={styles.infoText}>今日はすでに獲得済みです</Text>
            )}

            {best != null &&
              !alreadyToday &&
              stampState !== "saved" &&
              stampState !== "already" && (
                <Pressable
                  style={[
                    styles.primaryButton,
                    stampState === "saving" && styles.buttonDisabled,
                  ]}
                  disabled={stampState === "saving"}
                  onPress={() => void handleSaveStamp(best)}
                >
                  <Text style={styles.primaryButtonText}>
                    {stampState === "saving" ? "保存中…" : "スタンプを獲得"}
                  </Text>
                </Pressable>
              )}
          </>
        )}

        <Pressable style={styles.secondaryButton} onPress={handleRetake}>
          <Text style={styles.secondaryButtonText}>撮り直す</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // --- カメラプレビュー ---
  if (device == null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={PURPLE} />
        <Text style={styles.statusText}>背面カメラを準備中…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!isReviewing}
        outputs={outputs}
        onError={(error) => {
          console.error("Camera error:", error);
        }}
      />
      {analysis?.phase === "error" && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{analysis.message}</Text>
        </View>
      )}
      <View style={styles.shutterContainer}>
        <Pressable
          style={[styles.shutterButton, isCapturing && styles.buttonDisabled]}
          disabled={isCapturing}
          onPress={() => void handleTakePhoto()}
        >
          {isCapturing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
    gap: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#222",
  },
  permissionBody: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
  },
  reviewContent: {
    padding: 16,
    gap: 12,
  },
  imageWrapper: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    color: "#eee",
  },
  successText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#00e676",
  },
  infoText: {
    fontSize: 14,
    color: "#ffd54f",
  },
  errorText: {
    fontSize: 14,
    color: "#ff5252",
  },
  primaryButton: {
    backgroundColor: PURPLE,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  secondaryButton: {
    borderColor: "#888",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#ddd",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  shutterContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shutterButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#fff",
  },
  errorBanner: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(180, 30, 30, 0.85)",
    borderRadius: 8,
    padding: 12,
  },
  errorBannerText: {
    color: "#fff",
    fontSize: 13,
  },
});
