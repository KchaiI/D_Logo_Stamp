// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ONNX モデルを Metro のアセットとしてバンドルする
config.resolver.assetExts.push('onnx');

module.exports = config;
