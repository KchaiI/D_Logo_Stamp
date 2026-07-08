/**
 * カレンダー画面。
 *
 * - react-native-calendars で獲得済み日付を markedDates 表示
 * - 日付タップでその日のスタンプ画像を表示
 * - 未獲得日は「この日のスタンプはありません」
 */
import React, { useEffect, useMemo, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Calendar, type DateData } from "react-native-calendars";
import {
  getTodayKey,
  loadStamps,
  resolveStampImageUri,
} from "../storage/stamps";
import type { StampsByDate } from "../types";

const PURPLE = "#522886";

type DayMarking = {
  marked?: boolean;
  dotColor?: string;
  selected?: boolean;
  selectedColor?: string;
};

export function CalendarScreen() {
  const [stamps, setStamps] = useState<StampsByDate>({});
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKey());

  // 画面表示のたびに端末内ストレージから読み直す
  useEffect(() => {
    setStamps(loadStamps());
  }, []);

  const markedDates = useMemo(() => {
    const marks: Record<string, DayMarking> = {};
    for (const date of Object.keys(stamps)) {
      marks[date] = { marked: true, dotColor: PURPLE };
    }
    marks[selectedDate] = {
      ...(marks[selectedDate] ?? {}),
      selected: true,
      selectedColor: PURPLE,
    };
    return marks;
  }, [stamps, selectedDate]);

  const record = stamps[selectedDate];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Calendar
        markedDates={markedDates}
        onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
        theme={{
          todayTextColor: PURPLE,
          arrowColor: PURPLE,
        }}
      />

      <View style={styles.detail}>
        <Text style={styles.dateLabel}>{selectedDate}</Text>
        {record != null ? (
          <View style={styles.stampCard}>
            <Image
              source={{ uri: resolveStampImageUri(record) }}
              style={styles.stampImage}
              resizeMode="contain"
            />
            <Text style={styles.scoreText}>
              検出スコア: {record.score.toFixed(2)}
            </Text>
            <Text style={styles.metaText}>
              獲得時刻: {new Date(record.createdAt).toLocaleTimeString()}
            </Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>この日のスタンプはありません</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    paddingBottom: 32,
  },
  detail: {
    padding: 16,
    gap: 8,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#222",
  },
  stampCard: {
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#f4effa",
  },
  stampImage: {
    width: 220,
    height: 220,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  scoreText: {
    fontSize: 14,
    color: "#333",
  },
  metaText: {
    fontSize: 12,
    color: "#777",
  },
  emptyText: {
    fontSize: 14,
    color: "#777",
    paddingVertical: 24,
    textAlign: "center",
  },
});
