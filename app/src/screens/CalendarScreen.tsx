/**
 * カレンダー画面。
 *
 * - 日付セルに、その日の代表スタンプ（選んだロゴ）をサムネイル表示する
 * - 日付タップでその日に獲得した全スタンプを一覧表示する
 * - 一覧のロゴをタップすると、その日の代表（カレンダーに出すロゴ）を切り替える
 * - 未獲得日は「この日のスタンプはありません」
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Calendar, type DateData } from "react-native-calendars";
import {
  getTodayKey,
  loadStamps,
  resolveStampImageUri,
  setSelectedStamp,
} from "../storage/stamps";
import type { DayStamps, StampsByDate } from "../types";

const PURPLE = "#522886";

/** dayComponent に渡ってくる props のうち、使う部分だけ */
type DayCellProps = {
  date?: DateData;
  state?: string;
};

function findSelectedRecord(day: DayStamps | undefined) {
  if (day == null) return undefined;
  return day.records.find((r) => r.id === day.selectedId) ?? day.records[0];
}

export function CalendarScreen() {
  const [stamps, setStamps] = useState<StampsByDate>({});
  const [selectedDate, setSelectedDate] = useState<string>(getTodayKey());

  // 画面表示のたびに端末内ストレージから読み直す
  useEffect(() => {
    setStamps(loadStamps());
  }, []);

  const day = stamps[selectedDate];
  const records = day?.records ?? [];

  const handlePickRepresentative = useCallback(
    (id: string) => {
      setSelectedStamp(selectedDate, id);
      setStamps(loadStamps());
    },
    [selectedDate],
  );

  const renderDay = useCallback(
    ({ date, state }: DayCellProps) => {
      if (date == null) return <View style={styles.dayCell} />;
      const dayStamps = stamps[date.dateString];
      const rep = findSelectedRecord(dayStamps);
      const isSelected = date.dateString === selectedDate;
      const count = dayStamps?.records.length ?? 0;

      return (
        <Pressable
          style={[styles.dayCell, isSelected && styles.dayCellSelected]}
          onPress={() => setSelectedDate(date.dateString)}
        >
          <Text
            style={[
              styles.dayNum,
              state === "disabled" && styles.dayNumDisabled,
              state === "today" && styles.dayNumToday,
            ]}
          >
            {date.day}
          </Text>
          {rep != null ? (
            <View>
              <Image
                source={{ uri: resolveStampImageUri(rep) }}
                style={styles.dayThumb}
                resizeMode="cover"
              />
              {count > 1 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{count}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.dayThumbPlaceholder} />
          )}
        </Pressable>
      );
    },
    [stamps, selectedDate],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Calendar
        dayComponent={renderDay}
        theme={{
          todayTextColor: PURPLE,
          arrowColor: PURPLE,
        }}
      />

      <View style={styles.detail}>
        <Text style={styles.dateLabel}>{selectedDate}</Text>
        {records.length === 0 ? (
          <Text style={styles.emptyText}>この日のスタンプはありません</Text>
        ) : (
          <>
            {records.length > 1 && (
              <Text style={styles.hintText}>
                タップしたロゴをカレンダーに表示します
              </Text>
            )}
            <View style={styles.stampGrid}>
              {records.map((rec) => {
                const isRep = rec.id === day?.selectedId;
                return (
                  <Pressable
                    key={rec.id}
                    style={[
                      styles.stampCard,
                      isRep && styles.stampCardSelected,
                    ]}
                    onPress={() => handlePickRepresentative(rec.id)}
                  >
                    <Image
                      source={{ uri: resolveStampImageUri(rec) }}
                      style={styles.stampImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.metaText}>
                      {new Date(rec.createdAt).toLocaleTimeString()}
                    </Text>
                    <Text style={styles.metaText}>
                      スコア {rec.score.toFixed(2)}
                    </Text>
                    {isRep && (
                      <Text style={styles.repLabel}>カレンダー表示中</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </>
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
  // --- 日付セル ---
  dayCell: {
    width: 46,
    minHeight: 58,
    alignItems: "center",
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  dayCellSelected: {
    borderColor: PURPLE,
    backgroundColor: "#f4effa",
  },
  dayNum: {
    fontSize: 13,
    color: "#222",
  },
  dayNumDisabled: {
    color: "#c5c5c5",
  },
  dayNumToday: {
    color: PURPLE,
    fontWeight: "bold",
  },
  dayThumb: {
    width: 34,
    height: 34,
    borderRadius: 6,
    marginTop: 2,
    backgroundColor: "#f4effa",
  },
  dayThumbPlaceholder: {
    width: 34,
    height: 34,
    marginTop: 2,
  },
  countBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: PURPLE,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  // --- 日別詳細 ---
  detail: {
    padding: 16,
    gap: 8,
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#222",
  },
  hintText: {
    fontSize: 12,
    color: "#777",
  },
  stampGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  stampCard: {
    alignItems: "center",
    gap: 4,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#f4effa",
  },
  stampCardSelected: {
    borderColor: PURPLE,
  },
  stampImage: {
    width: 132,
    height: 132,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  metaText: {
    fontSize: 12,
    color: "#777",
  },
  repLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: PURPLE,
  },
  emptyText: {
    fontSize: 14,
    color: "#777",
    paddingVertical: 24,
    textAlign: "center",
  },
});
