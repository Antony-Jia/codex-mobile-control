import { useEffect, useMemo, useRef } from "react";
import * as Haptics from "expo-haptics";
import { ActivityIndicator, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { AgentSlot } from "@codex-micro/protocol";
import { useTheme, type Palette } from "../theme";

const CARD_WIDTH = 276;
const GAP = 10;
const labels: Record<AgentSlot["state"], string> = { unassigned: "未分配", idle: "空闲", running: "运行中", needs_input: "待确认", completed_unread: "已完成", error: "异常" };

export function SlotGrid({ slots, onSelect, onManage, onCreate, openingSlotId }: { slots: AgentSlot[]; onSelect: (id: number) => void; onManage: () => void; onCreate: () => void; openingSlotId: number | null }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const colors = t.slot;
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
        {openingSlotId === slot.slotId ? <View style={styles.opening}><ActivityIndicator size="small" color={t.accent} /><Text style={styles.openingText}>桌面打开中</Text></View> : <View style={[styles.badge, { borderColor: colors[slot.state] }]}><Text style={[styles.badgeText, { color: colors[slot.state] }]}>{slot.selected ? `当前 · ${labels[slot.state]}` : labels[slot.state]}</Text></View>}
      </Pressable>)}
    </ScrollView>
  </View>;
}

const createStyles = (t: Palette) => StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 2 },
  headingText: { color: t.textSecondary, fontSize: 10, fontWeight: "900", letterSpacing: 2.5 },
  hint: { color: t.textFaint, fontSize: 8, marginTop: 2, letterSpacing: 0.5 },
  headingActions: { flexDirection: "row", gap: 14, alignItems: "center" },
  headingButton: { color: t.accentDim, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  headingButtonStrong: { color: t.accent, fontSize: 9, fontWeight: "900", letterSpacing: 1, textShadowColor: t.glow, textShadowRadius: t.mode === "dark" ? 6 : 0, textShadowOffset: { width: 0, height: 0 } },
  list: { gap: GAP, paddingRight: 42, paddingVertical: 4 },
  slot: { width: CARD_WIDTH, height: 88, borderWidth: 1, borderColor: t.border, borderRadius: 15, backgroundColor: t.surface, paddingRight: 10, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  selected: { backgroundColor: t.accentBg, borderColor: t.accentBorder, borderWidth: 2, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.5 : 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  light: { width: 6, alignSelf: "stretch", borderRadius: 5, marginLeft: 7, shadowOpacity: 0.95, shadowRadius: 10, elevation: 8 },
  number: { width: 30, height: 30, marginHorizontal: 8, borderRadius: 15, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.borderStrong, alignItems: "center", justifyContent: "center" },
  numberText: { color: t.textSecondary, fontSize: 12, fontWeight: "800" },
  text: { flex: 1, minWidth: 0 },
  title: { color: t.textPrimary, fontWeight: "700", fontSize: 13 },
  project: { color: t.textMuted, fontSize: 9, marginTop: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  badge: { minWidth: 49, marginLeft: 7, paddingVertical: 5, paddingHorizontal: 7, borderRadius: 11, borderWidth: 1, alignItems: "center" },
  badgeText: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  opening: { minWidth: 66, marginLeft: 7, alignItems: "center", gap: 3 },
  openingText: { color: t.accent, fontSize: 7, fontWeight: "900", letterSpacing: 0.5 },
});
