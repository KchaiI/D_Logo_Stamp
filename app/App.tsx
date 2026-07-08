/**
 * 同志社ロゴ スタンプラリーアプリのルート。
 *
 * ナビゲーションライブラリは使わず、シンプルなタブ切替で
 * カメラ画面とカレンダー画面を出し分ける。
 * 画面はタブ切替のたびにマウントし直すので、カレンダーは常に最新の保存内容を読む。
 */
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { CameraScreen } from "./src/screens/CameraScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";

const PURPLE = "#522886";

type Tab = "camera" | "calendar";

export default function App() {
  const [tab, setTab] = useState<Tab>("camera");

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style={tab === "camera" ? "light" : "dark"} />
      <View style={styles.screen}>
        {tab === "camera" ? <CameraScreen /> : <CalendarScreen />}
      </View>
      <View style={styles.tabBar}>
        <TabButton
          label="カメラ"
          active={tab === "camera"}
          onPress={() => setTab("camera")}
        />
        <TabButton
          label="カレンダー"
          active={tab === "calendar"}
          onPress={() => setTab("calendar")}
        />
      </View>
    </SafeAreaView>
  );
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.tabButton} onPress={onPress}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  screen: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ccc",
    backgroundColor: "#fff",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabLabel: {
    fontSize: 14,
    color: "#999",
  },
  tabLabelActive: {
    color: PURPLE,
    fontWeight: "bold",
  },
});
