import { useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";
import { ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { AgentSlot } from "@codex-micro/protocol";

const CARD_WIDTH = 276;
const GAP = 10;
const colors: Record<AgentSlot["state"], string> = { unassigned: "#1a252b", idle: "#dceaf0", running: "#168cff", needs_input: "#ffb020", completed_unread: "#24d17e", error: "#ff4057" };
const labels: Record<AgentSlot["state"], string> = { unassigned: "未分配", idle: "空闲", running: "运行中", needs_input: "待确认", completed_unread: "已完成", error: "异常" };

export function SlotGrid({ slots, onSelect, onManage, onCreate, openingSlotId }: { slots: AgentSlot[]; onSelect: (id: number) => void; onManage: () => void; onCreate: () => void; openingSlotId: number | null }) {
  const scroll = useRef<ScrollView>(null);
  const selectedIndex = slots.findIndex((slot) => slot.selected);

  useEffect(() => {
    if (selectedIndex >= 0) scroll.current?.scrollTo({ x: selectedIndex * (CARD_WIDTH + GAP), animated: true });
  }, [selectedIndex]);

  const selectVisible = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.max(0, Math.min(slots.length - 1, Math.round(event.nativeEvent.contentOffset.x / (CARD_WIDTH + GAP))));
    const slot = slots[index];
    if (slot && !slot.selected) { void Haptics.selectionAsync(); onSelect(slot.slotId); }
  };

  return <View>
    <View style={styles.heading}><View><Text style={styles.headingText}>CODEX 会话</Text><Text style={styles.hint}>最近 10 个 · 左右滑动切换</Text></View><View style={styles.headingActions}><Pressable onPress={onManage}><Text style={styles.headingButton}>选择会话</Text></Pressable><Pressable onPress={onCreate}><Text style={styles.headingButtonStrong}>新建</Text></Pressable></View></View>
    <ScrollView ref={scroll} horizontal snapToInterval={CARD_WIDTH + GAP} decelerationRate="fast" showsHorizontalScrollIndicator={false} onMomentumScrollEnd={selectVisible} contentContainerStyle={styles.list}>
      {slots.map((slot) => <Pressable key={slot.slotId} accessibilityLabel={`${slot.slotId}, ${slot.title ?? "未分配"}, ${slot.projectName ?? ""}${slot.selected ? ", 当前会话，再次点击取消" : ""}`} accessibilityState={{ selected: slot.selected }} onPress={() => { void Haptics.selectionAsync(); onSelect(slot.slotId); }} style={[styles.slot, slot.selected && styles.selected]}>
        <View style={[styles.light, { backgroundColor: colors[slot.state], shadowColor: colors[slot.state] }]} />
        <View style={styles.number}><Text style={styles.numberText}>{slot.slotId}</Text></View>
        <View style={styles.text}><Text numberOfLines={1} style={styles.title}>{slot.title ?? "未分配会话"}</Text><Text numberOfLines={1} style={styles.project}>{slot.projectName ?? "选择会话或新建"}</Text></View>
        {openingSlotId === slot.slotId ? <View style={styles.opening}><ActivityIndicator size="small" color="#68e3ff" /><Text style={styles.openingText}>桌面打开中</Text></View> : <View style={[styles.badge, { borderColor: colors[slot.state] }]}><Text style={[styles.badgeText, { color: colors[slot.state] }]}>{slot.selected ? `当前 · ${labels[slot.state]}` : labels[slot.state]}</Text></View>}
      </Pressable>)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 },
  headingText: { color: "#79909a", fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  hint: { color: "#405964", fontSize: 8, marginTop: 2 },
  headingActions: { flexDirection: "row", gap: 14 },
  headingButton: { color: "#70adbd", fontSize: 9, fontWeight: "800" },
  headingButtonStrong: { color: "#51dbfb", fontSize: 9, fontWeight: "900" },
  list: { gap: GAP, paddingRight: 42 },
  slot: { width: CARD_WIDTH, height: 88, borderWidth: 1, borderColor: "#18323e", borderRadius: 13, backgroundColor: "#0b151b", paddingRight: 10, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  selected: { backgroundColor: "#112b37", borderColor: "#4edcff", borderWidth: 2 },
  light: { width: 6, alignSelf: "stretch", borderRadius: 5, marginLeft: 7, shadowOpacity: 0.9, shadowRadius: 8, elevation: 6 },
  number: { width: 30, height: 30, marginHorizontal: 8, borderRadius: 15, backgroundColor: "#15262f", alignItems: "center", justifyContent: "center" },
  numberText: { color: "#91a8b3", fontSize: 12, fontWeight: "800" },
  text: { flex: 1, minWidth: 0 },
  title: { color: "#eaf7fc", fontWeight: "700", fontSize: 13 },
  project: { color: "#708893", fontSize: 9, marginTop: 5, textTransform: "uppercase" },
  badge: { minWidth: 49, marginLeft: 7, paddingVertical: 5, paddingHorizontal: 7, borderRadius: 11, borderWidth: 1, alignItems: "center" },
  badgeText: { fontSize: 8, fontWeight: "800" },
  opening: { minWidth: 66, marginLeft: 7, alignItems: "center", gap: 3 },
  openingText: { color: "#68e3ff", fontSize: 7, fontWeight: "900" },
});
