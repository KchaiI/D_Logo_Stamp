# 同志社ロゴ スタンプラリーアプリ

カメラで撮影した写真から同志社大学のロゴを **端末内（オンデバイス）AI推論** で検出し、検出したロゴ部分を切り抜いて日付ごとの「スタンプ」として記録する iOS アプリです。

サーバーやクラウドは一切使わず、撮影画像・スタンプ画像・獲得履歴のすべてを端末内に永続化するオフライン完結型のアプリとして設計しています。

## デモフロー

1. カメラで同志社ロゴを撮影する
2. アプリ内の YOLOv8n（ONNX）モデルがロゴを検出し、検出枠とスコアを表示する
3. 「スタンプを獲得」で検出矩形部分を切り抜き、その日のスタンプとして保存する
4. カレンダー画面で、日付セルごとに獲得したスタンプ（ロゴ画像）が表示される
5. 日付をタップすると、その日に獲得したスタンプの一覧が見られる

## 主な機能

- **カメラ撮影**: `react-native-vision-camera` による背面カメラ撮影
- **オンデバイスロゴ検出**: `onnxruntime-react-native` で YOLOv8n の ONNX モデルを端末内実行。ネットワーク不要
- **検出枠の描画**: `react-native-svg` で撮影画像上に検出枠とスコアをオーバーレイ表示
- **スタンプ切り抜き**: 検出矩形で `expo-image-manipulator` によりロゴ部分をクロップ
- **端末内永続化**:
  - スタンプ画像 → `expo-file-system` の `documentDirectory/stamps/`
  - 獲得履歴メタデータ（日付・スコア・検出矩形など） → `react-native-mmkv`
- **カレンダー表示**: `react-native-calendars` をカスタマイズし、日付セル内に獲得スタンプのサムネイルを表示
- **1日の獲得ルール切り替え**: 1日1個 / 1日複数個を開発用フラグ（`app/src/config.ts`）で切り替え可能。複数獲得した日は、カレンダーに表示する代表ロゴを一覧から選択できる

## 推論モデル

物体検出モデルとして **YOLOv8n**（Ultralytics）を使用しています。

| 項目 | 内容 |
|---|---|
| ベースモデル | YOLOv8n（nano。モバイル実行を想定した最軽量構成） |
| タスク | 同志社ロゴの1クラス物体検出 |
| 学習データ | ロゴ画像を実写背景（動画から抽出したフレーム・写真素材）に合成して作成 |
| 入力 | 640×640 RGB（`[1, 3, 640, 640]` の Float32、0〜1 正規化、NCHW） |
| 出力 | `[1, 5, 8400]` の単一テンソル（各候補が `cx, cy, w, h, conf`） |
| フォーマット | ONNX（opset 12） |
| 実行環境 | `onnxruntime-react-native` によるオンデバイス推論 |

### 推論パイプライン（`app/src/detection/`)

1. **前処理** (`preprocess.ts`): 撮影画像を 640×640 にリサイズ → 0〜1 正規化 → NCHW の `Float32Array` に変換（`react-native-nitro-image` でネイティブにピクセル取得）
2. **推論** (`model.ts`, `detect.ts`): ONNX Runtime の `InferenceSession` を1つ生成して使い回し、`[1, 5, 8400]` の出力を得る
3. **後処理** (`postprocess.ts`):
   - 信頼度 `conf` によるフィルタリング
   - `xywh` → `xyxy` 変換
   - NMS（Non-Maximum Suppression）で重複枠を削除
   - 640 スケールの座標を元画像スケールへ逆変換 + 画像内へクランプ
   - 最高スコアの検出をスタンプ候補として採用

## 技術スタック

- **React Native 0.86 / Expo SDK 57**（Expo Development Build 前提。ネイティブモジュールを含むため Expo Go では動作しません）
- **TypeScript**
- 推論: `onnxruntime-react-native`
- カメラ: `react-native-vision-camera`
- 画像処理: `expo-image-manipulator` / `react-native-nitro-image`
- 永続化: `expo-file-system` + `react-native-mmkv`
- UI: `react-native-svg` / `react-native-calendars`
- ビルド・配布: EAS Build → TestFlight

## データ設計

獲得履歴は日付をキーに MMKV へ JSON で保存します。

```ts
type StampRecord = {
  id: string;                              // 記録の一意ID
  date: string;                            // 獲得日 (YYYY-MM-DD)
  imagePath: string;                       // スタンプ画像（documentDirectory 相対パス）
  createdAt: number;                       // 獲得時刻 (epoch ms)
  score: number;                           // 検出スコア
  box: [number, number, number, number];   // 検出矩形 (xyxy, 撮影画像ピクセル座標)
};

type DayStamps = {
  records: StampRecord[]; // その日に獲得した記録（獲得順）
  selectedId: string;     // カレンダーの日付セルに表示する代表記録のID
};

type StampsByDate = Record<string, DayStamps>; // 日付 → その日の記録
```

- 画像パスは `documentDirectory` からの相対パスで保存し、アプリ更新でコンテナの絶対パスが変わっても壊れないようにしています
- 旧形式（1日1件のみ）のデータは読み込み時に自動で新形式へ移行します

## ディレクトリ構成

```
.
├── app/                     # React Native (Expo) アプリ本体
│   ├── App.tsx              # ルート（カメラ / カレンダーのタブ切替）
│   ├── assets/models/       # ONNX モデル (doshisha_logo_yolov8n_v1.onnx)
│   └── src/
│       ├── config.ts        # 開発用フラグ（1日複数スタンプの切り替え）
│       ├── detection/       # 前処理・ONNX 推論・YOLO 後処理
│       ├── stamp/           # 検出矩形によるスタンプ切り抜き
│       ├── storage/         # expo-file-system + MMKV による永続化
│       ├── screens/         # カメラ画面・カレンダー画面
│       └── components/      # 検出枠オーバーレイなど
├── ml/                      # 学習データ作成用の素材（ロゴ・背景画像）
└── docs/                    # 設計ドキュメント
```

## セットアップと実行

ネイティブモジュール（VisionCamera / ONNX Runtime など）を含むため、**Expo Development Build** が必要です。

```bash
cd app
npm install

# Development Build を作成（初回・ネイティブ依存変更時のみ）
eas build --profile development --platform ios

# ビルドを実機にインストール後、開発サーバーを起動
npx expo start --dev-client
```

実機での動作確認が前提です（カメラとオンデバイス推論を使うため、シミュレーターでは検証できません）。

### TestFlight 配布

```bash
cd app
eas build --profile production --platform ios
eas submit --platform ios
```

ビルド番号は EAS 側で自動インクリメントされます（`eas.json` の `autoIncrement`）。

## 設計方針

- **オフライン完結**: 推論も保存も端末内で完結し、サーバー送信は行わない
- **データ永続化がアプリの特徴**: Firebase 等の外部サービスに頼らず、画像とメタデータを端末内に保存する
- 詳細な設計は [docs/logo_app_design.md](docs/logo_app_design.md) を参照
