import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import type { AgentSlot, Effort, ModelOption } from "@codex-micro/protocol";
import { useTheme, type Palette } from "../theme";

type Props = {
  slots: AgentSlot[];
  selectedSlotId: number | null;
  openingSlotId: number | null;
  output: string;
  diff: string;
  historyOutput: string;
  historyLoading: boolean;
  tab: "output" | "diff" | "history";
  effort: Effort;
  model: string | null;
  models: ModelOption[];
  planMode: boolean;
  draft: string;
  threadId: string | null;
  turnId?: string;
  sending: boolean;
  commandError: string | null;
  onSelectSlot: (slotId: number) => void;
  onEffort: (effort: Effort) => void;
  onModel: (model: string) => void;
  onPlanMode: (value: boolean) => void;
  onDraft: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onTab: (tab: "output" | "diff" | "history") => void;
  onOpenSessions: () => void;
  onCreate: () => void;
  onClearError: () => void;
  onToggleMode: () => void;
};

const efforts: Array<{ value: Effort; label: string }> = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "xhigh", label: "极高" },
];

function RotaryDial({
  accessibilityLabel,
  value,
  size,
  onStep,
}: {
  accessibilityLabel: string;
  value: string;
  size: number;
  onStep: (delta: number) => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const rotation = useRef(new Animated.Value(0)).current;
  const stepRef = useRef(onStep);
  const lastStep = useRef(0);
  stepRef.current = onStep;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3,
    onPanResponderGrant: () => { lastStep.current = 0; },
    onPanResponderMove: (_, gesture) => {
      const step = Math.trunc(gesture.dx / 30);
      if (step !== lastStep.current) {
        stepRef.current(step - lastStep.current);
        lastStep.current = step;
        void Haptics.selectionAsync();
      }
      rotation.setValue(Math.max(-42, Math.min(42, gesture.dx * 0.55)));
    },
    onPanResponderRelease: () => {
      Animated.spring(rotation, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 8 }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(rotation, { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 8 }).start();
    },
  })).current;

  const rotate = rotation.interpolate({ inputRange: [-42, 42], outputRange: ["-42deg", "42deg"] });
  return <View style={styles.dialGroup}>
    <View accessibilityLabel={accessibilityLabel} style={[styles.dialOuter, { width: size, height: size, borderRadius: size / 2 }]} {...pan.panHandlers}>
      <Animated.View style={[styles.dialFace, { width: size - 14, height: size - 14, borderRadius: (size - 14) / 2, transform: [{ rotate }] }]}>
        <View style={styles.dialPointer} />
        <View style={styles.dialHub} />
      </Animated.View>
      <View pointerEvents="none" style={styles.dialCopy}>
        <Text numberOfLines={2} style={styles.dialValue}>{value}</Text>
      </View>
    </View>
  </View>;
}

function EffortSlider({ effort, onEffort }: { effort: Effort; onEffort: (value: Effort) => void }) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const effortIndex = Math.max(0, efforts.findIndex((item) => item.value === effort));
  const indexRef = useRef(effortIndex);
  const onEffortRef = useRef(onEffort);
  const widthRef = useRef(1);
  const startRef = useRef(0);
  const draggingRef = useRef(false);
  const position = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(1);
  indexRef.current = effortIndex;
  onEffortRef.current = onEffort;

  const usable = Math.max(1, trackWidth - 18);
  const snapTo = (index: number, haptic = false) => {
    const bounded = Math.max(0, Math.min(3, index));
    if (bounded !== indexRef.current) {
      indexRef.current = bounded;
      onEffortRef.current(efforts[bounded].value);
      if (haptic) void Haptics.selectionAsync();
    }
    Animated.spring(position, { toValue: bounded * usable / 3, useNativeDriver: false, speed: 24, bounciness: 0 }).start();
  };

  useEffect(() => {
    if (!draggingRef.current) position.setValue(effortIndex * usable / 3);
  }, [effortIndex, usable, position]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      draggingRef.current = true;
      startRef.current = indexRef.current * Math.max(1, widthRef.current - 18) / 3;
      position.stopAnimation();
    },
    onPanResponderMove: (_, gesture) => {
      const localUsable = Math.max(1, widthRef.current - 18);
      const x = Math.max(0, Math.min(localUsable, startRef.current + gesture.dx));
      position.setValue(x);
      const next = Math.max(0, Math.min(3, Math.round(x / localUsable * 3)));
      if (next !== indexRef.current) {
        indexRef.current = next;
        onEffortRef.current(efforts[next].value);
        void Haptics.selectionAsync();
      }
    },
    onPanResponderRelease: () => {
      draggingRef.current = false;
      const localUsable = Math.max(1, widthRef.current - 18);
      Animated.spring(position, { toValue: indexRef.current * localUsable / 3, useNativeDriver: false, speed: 24, bounciness: 0 }).start();
    },
    onPanResponderTerminate: () => {
      draggingRef.current = false;
      const localUsable = Math.max(1, widthRef.current - 18);
      Animated.spring(position, { toValue: indexRef.current * localUsable / 3, useNativeDriver: false, speed: 24, bounciness: 0 }).start();
    },
  })).current;

  return <View style={styles.effortCard}>
    <View
      style={styles.effortTrack}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        widthRef.current = width;
        setTrackWidth(width);
      }}
      {...pan.panHandlers}
    >
      <View style={styles.effortRail}>
        <View style={[styles.effortSegment, { backgroundColor: "#24c982" }]} />
        <View style={[styles.effortSegment, { backgroundColor: "#9fc84a" }]} />
        <View style={[styles.effortSegment, { backgroundColor: "#f0a43a" }]} />
        <View style={[styles.effortSegment, { backgroundColor: "#e34b5f" }]} />
      </View>
      {[0, 1, 2, 3].map((index) => <View key={index} pointerEvents="none" style={[styles.effortNode, { left: 5 + index * usable / 3 }]} />)}
      <Animated.View style={[styles.effortThumb, { left: position }]} />
      <View style={styles.effortLabels} pointerEvents="box-none">
        {efforts.map((item, index) => <Pressable accessibilityLabel={item.label} key={item.value} onPress={() => snapTo(index, true)} style={styles.effortLabelHit} />)}
      </View>
    </View>
  </View>;
}

export function GamepadSurface({
  slots, selectedSlotId, openingSlotId, output, diff, historyOutput, historyLoading, tab, effort, model, models, planMode, draft,
  threadId, turnId, sending, commandError, onSelectSlot, onEffort, onModel, onPlanMode, onDraft,
  onSend, onStop, onTab, onOpenSessions, onCreate, onClearError, onToggleMode,
}: Props) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { height } = useWindowDimensions();
  const compact = height < 560;
  const dialSize = Math.max(108, Math.min(compact ? 132 : 154, height * 0.29));
  const selectedIndex = Math.max(0, slots.findIndex((slot) => slot.slotId === selectedSlotId));
  const selected = slots[selectedIndex];
  const modelIndex = Math.max(0, models.findIndex((item) => item.model === model));
  const currentModel = models[modelIndex];
  const currentEffort = efforts.find((item) => item.value === effort);
  const slotIndexRef = useRef(selectedIndex);
  const modelIndexRef = useRef(modelIndex);
  slotIndexRef.current = selectedIndex;
  modelIndexRef.current = modelIndex;

  const moveSlot = (delta: number) => {
    if (!slots.length || !delta) return;
    const next = (slotIndexRef.current + delta % slots.length + slots.length) % slots.length;
    slotIndexRef.current = next;
    onSelectSlot(slots[next].slotId);
  };
  const cycleModel = (delta: number) => {
    if (!models.length || !delta) return;
    const next = (modelIndexRef.current + delta % models.length + models.length) % models.length;
    modelIndexRef.current = next;
    onModel(models[next].model);
  };
  const [panelMode, setPanelMode] = useState<"input" | "output">("input");
  const [outputMode, setOutputMode] = useState<"output" | "diff" | "history">("output");
  useEffect(() => { setOutputMode(tab); }, [tab]);
  const visibleOutput = useMemo(() => outputMode === "history" ? historyOutput : outputMode === "diff" ? diff : output, [diff, historyOutput, output, outputMode]);

  const selectOutputMode = (next: "output" | "diff" | "history") => {
    setOutputMode(next);
    onTab(next);
  };

  return <View style={styles.page}>
    <View style={[styles.shell, compact && styles.shellCompact]}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="切换到控制台模式" onPress={onToggleMode} style={styles.logo}>
          <Text style={styles.logoText}>CODEX MICRO</Text>
        </Pressable>
        <Pressable accessibilityLabel="新建会话" style={styles.createButton} onPress={onCreate}><Text style={styles.createButtonText}>＋</Text></Pressable>
      </View>

      <View style={styles.deck}>
        <View style={styles.sideRail}>
          <View style={styles.dialStack}>
            <RotaryDial accessibilityLabel="最近10个任务旋钮" value={selected?.title ?? "—"} size={dialSize} onStep={moveSlot} />
          </View>
          <View style={styles.sideActions}>
            <Pressable accessibilityLabel="上一个任务" style={styles.iconButton} onPress={() => { void Haptics.selectionAsync(); moveSlot(-1); }}><Text style={styles.iconButtonText}>‹</Text></Pressable>
            <Pressable accessibilityLabel="下一个任务" style={styles.iconButton} onPress={() => { void Haptics.selectionAsync(); moveSlot(1); }}><Text style={styles.iconButtonText}>›</Text></Pressable>
          </View>
        </View>

        <View style={styles.workspace}>
          <EffortSlider effort={effort} onEffort={onEffort} />
          <View style={styles.unifiedPanel}>
            <View style={styles.panelTabs}>
              <Pressable onPress={() => setPanelMode("input")}><Text style={[styles.mainTab, panelMode === "input" && styles.tabActive]}>输入</Text></Pressable>
              <Pressable onPress={() => setPanelMode("output")}><Text style={[styles.mainTab, panelMode === "output" && styles.tabActive]}>输出</Text></Pressable>
              {panelMode === "output" && <View style={styles.secondaryTabs}>
                <Pressable onPress={() => selectOutputMode("output")}><Text style={[styles.tab, outputMode === "output" && styles.tabActive]}>输出</Text></Pressable>
                <Pressable onPress={() => selectOutputMode("diff")}><Text style={[styles.tab, outputMode === "diff" && styles.tabActive]}>变更</Text></Pressable>
                <Pressable onPress={() => selectOutputMode("history")}><Text style={[styles.tab, outputMode === "history" && styles.tabActive]}>历史信息</Text></Pressable>
              </View>}
              {openingSlotId && <ActivityIndicator style={styles.opening} size="small" color={t.accent} />}
            </View>
            {panelMode === "input" ? <View style={styles.inputPane}>
              <TextInput value={draft} onChangeText={onDraft} multiline editable={Boolean(threadId) && !sending} style={styles.input} />
              <View style={styles.inputActions}>
                {turnId && <Pressable style={styles.stop} onPress={onStop}><Text style={styles.actionText}>■</Text></Pressable>}
                <Pressable disabled={!threadId || !draft.trim() || sending} style={[styles.send, (!threadId || !draft.trim() || sending) && styles.disabled]} onPress={onSend}><Text style={styles.actionText}>↵</Text></Pressable>
              </View>
            </View> : outputMode === "history" && historyLoading ? <View style={styles.historyLoading}>
              <ActivityIndicator color={t.accent} />
              <Text style={styles.historyLoadingTitle}>正在检查历史信息…</Text>
              <Text style={styles.historyLoadingHint}>从 Codex 读取该对话的最后一段记录</Text>
            </View> : <ScrollView nestedScrollEnabled style={styles.output} contentContainerStyle={styles.outputContent}>
              <Text selectable style={[styles.mono, !visibleOutput && styles.emptyHistory]}>{visibleOutput || (outputMode === "history" ? "历史信息已加载，但该对话没有可显示的用户/助手消息。" : outputMode === "diff" ? "暂无代码变更。" : "暂无输出。")}</Text>
            </ScrollView>}
          </View>
        </View>

        <View style={styles.sideRail}>
          <View style={styles.dialStack}>
            <RotaryDial accessibilityLabel="模型旋钮" value={currentModel?.displayName ?? "—"} size={dialSize} onStep={cycleModel} />
            <Text numberOfLines={1} style={styles.runStatus}>{currentModel?.displayName ?? "—"} · {currentEffort?.label ?? "—"}</Text>
          </View>
          <View style={styles.sideActions}>
            <Pressable style={[styles.sideButton, planMode && styles.sideButtonActive]} onPress={() => { void Haptics.selectionAsync(); onPlanMode(!planMode); }}>
              <Text style={styles.sideButtonText}>{planMode ? "方案模式 ✓" : "方案模式"}</Text>
            </Pressable>
            <Pressable style={styles.sideButton} onPress={onOpenSessions}><Text style={styles.sideButtonText}>模型 / 会话</Text></Pressable>
          </View>
        </View>
      </View>

      {commandError && <Pressable style={styles.errorBox} onPress={onClearError}><Text numberOfLines={2} style={styles.errorText}>{commandError}</Text></Pressable>}
    </View>
  </View>;
}

const createStyles = (t: Palette) => StyleSheet.create({
  page: { flex: 1, backgroundColor: t.appBg, padding: 8 },
  shell: { flex: 1, minHeight: 0, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, padding: 12, overflow: "hidden" },
  shellCompact: { padding: 9, borderRadius: 18 },
  header: { height: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 4 },
  logo: { minWidth: 220 },
  logoText: { color: t.textPrimary, fontWeight: "900", fontSize: 15, letterSpacing: 3, textShadowColor: t.glow, textShadowRadius: t.mode === "dark" ? 10 : 0, textShadowOffset: { width: 0, height: 0 } },
  createButton: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: t.accentBg, borderWidth: 1, borderColor: t.accentBorder },
  createButtonText: { color: t.accent, fontSize: 20, lineHeight: 22, fontWeight: "500" },
  deck: { flex: 1, minHeight: 0, flexDirection: "row", gap: 10 },
  sideRail: { width: 146, minHeight: 0, alignItems: "center", justifyContent: "space-between" },
  dialStack: { alignSelf: "stretch", alignItems: "center", marginTop: 48 },
  dialGroup: { alignItems: "center" },
  dialOuter: { borderWidth: 2, borderColor: t.accentBorder, backgroundColor: t.surfaceAlt, alignItems: "center", justifyContent: "center", shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.3 : 0.15, shadowRadius: 10, elevation: 3 },
  dialFace: { position: "absolute", borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.accentBg, alignItems: "center" },
  dialPointer: { position: "absolute", top: 8, width: 4, height: 22, borderRadius: 2, backgroundColor: t.accent },
  dialHub: { position: "absolute", top: "50%", marginTop: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: t.surfaceAlt, borderWidth: 2, borderColor: t.accentBorder },
  dialCopy: { position: "absolute", left: 17, right: 17, top: 38, bottom: 24, alignItems: "center", justifyContent: "center" },
  dialValue: { color: t.textPrimary, fontSize: 11, lineHeight: 15, fontWeight: "800", textAlign: "center" },
  runStatus: { alignSelf: "stretch", marginTop: 7, paddingHorizontal: 4, color: t.textSecondary, fontSize: 9, lineHeight: 12, fontWeight: "800", textAlign: "center" },
  sideActions: { alignSelf: "stretch", gap: 7, flexShrink: 1, flexDirection: "row", justifyContent: "center" },
  iconButton: { width: 46, height: 38, borderRadius: 12, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.borderStrong, alignItems: "center", justifyContent: "center" },
  iconButtonText: { color: t.accent, fontSize: 26, lineHeight: 28, fontWeight: "500" },
  sideButton: { minHeight: 36, flexGrow: 1, maxHeight: 52, borderRadius: 12, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.borderStrong, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  sideButtonActive: { backgroundColor: t.primary, borderColor: t.primaryBorder },
  sideButtonText: { color: t.textPrimary, fontSize: 10, lineHeight: 14, textAlign: "center", fontWeight: "800" },
  workspace: { flex: 1, minWidth: 0, minHeight: 0, gap: 8 },
  effortCard: { height: 42, borderRadius: 12, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surfaceAlt, paddingHorizontal: 12, paddingVertical: 5 },
  effortTrack: { flex: 1, justifyContent: "center" },
  effortRail: { position: "absolute", left: 9, right: 9, height: 8, borderRadius: 4, overflow: "hidden", flexDirection: "row" },
  effortSegment: { flex: 1 },
  effortNode: { position: "absolute", marginLeft: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: "#f4fbfd", borderWidth: 1, borderColor: "rgba(0,0,0,0.35)" },
  effortThumb: { position: "absolute", width: 18, height: 18, borderRadius: 9, backgroundColor: "#ffffff", borderWidth: 3, borderColor: t.accentBorder, shadowColor: t.glow, shadowOpacity: 0.6, shadowRadius: 5, elevation: 3 },
  effortLabels: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  effortLabelHit: { width: "25%", height: "100%", alignItems: "center", justifyContent: "center" },
  unifiedPanel: { flex: 1, minHeight: 0, borderRadius: 15, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceAlt, overflow: "hidden" },
  panelTabs: { height: 40, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: t.divider },
  mainTab: { color: t.textMuted, fontSize: 12, fontWeight: "900" },
  secondaryTabs: { flexDirection: "row", alignItems: "center", gap: 14, marginLeft: 10, paddingLeft: 16, borderLeftWidth: 1, borderLeftColor: t.divider },
  opening: { marginLeft: "auto" },
  inputPane: { flex: 1, minHeight: 0, padding: 10 },
  input: { flex: 1, minHeight: 40, color: t.textPrimary, fontSize: 13, lineHeight: 18, textAlignVertical: "top", padding: 0 },
  inputActions: { flexDirection: "row", justifyContent: "flex-end", gap: 7 },
  send: { backgroundColor: t.primary, width: 48, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
  stop: { backgroundColor: t.declineBtn, width: 48, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
  disabled: { opacity: 0.35 },
  actionText: { color: "#ffffff", fontSize: 10, fontWeight: "900" },
  tab: { color: t.textMuted, fontSize: 10, fontWeight: "800" },
  tabActive: { color: t.accent },
  output: { flex: 1 },
  outputContent: { padding: 10 },
  mono: { color: t.textSecondary, fontFamily: "monospace", fontSize: 10, lineHeight: 15 },
  historyLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 7 },
  historyLoadingTitle: { color: t.textPrimary, fontSize: 11, fontWeight: "900" },
  historyLoadingHint: { color: t.textMuted, fontSize: 8 },
  emptyHistory: { color: t.textMuted, textAlign: "center", marginTop: 28 },
  errorBox: { position: "absolute", left: 170, right: 170, bottom: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: t.errorBorder, backgroundColor: t.errorBg },
  errorText: { color: t.errorText, fontSize: 8 },
});
