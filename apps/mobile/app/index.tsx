import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import * as ScreenOrientation from "expo-screen-orientation";
import { useTheme, type Palette } from "../src/theme";
import { PairingScreen } from "../src/components/PairingScreen";
import { SlotGrid } from "../src/components/SlotGrid";
import { ControlDeck } from "../src/components/ControlDeck";
import { GamepadSurface } from "../src/components/GamepadSurface";
import { SessionPicker } from "../src/components/SessionPicker";
import { commandId, useController } from "../src/store/controller";

const effortLabels = { low: "低", medium: "中", high: "高", xhigh: "极高" } as const;

export default function Home() {
  const store = useController();
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"output" | "diff" | "history">("output");
  const [planMode, setPlanMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [createOnOpen, setCreateOnOpen] = useState(false);
  const [openingRequestId, setOpeningRequestId] = useState<string | null>(null);
  const [openingSlotId, setOpeningSlotId] = useState<number | null>(null);
  const [gamepadMode, setGamepadMode] = useState(false);

  useEffect(() => { void store.boot(); void activateKeepAwakeAsync("controller"); return () => void deactivateKeepAwake("controller"); }, []);
  useEffect(() => {
    const orientation = gamepadMode ? ScreenOrientation.OrientationLock.LANDSCAPE : ScreenOrientation.OrientationLock.PORTRAIT_UP;
    void ScreenOrientation.lockAsync(orientation).catch((error) => console.warn("Screen orientation lock failed", error));
  }, [gamepadMode]);

  const selected = store.state.slots.find((slot) => slot.selected);
  const threadId = selected?.threadId ?? null;
  const approval = store.state.approvals.find((item) => item.threadId === threadId);
  const output = threadId ? store.state.outputs[threadId] ?? "" : "";
  const diff = threadId ? store.state.diffs[threadId] ?? "" : "";
  const historyOutput = threadId ? store.state.threadHistories?.[threadId] ?? store.state.previousOutputs?.[threadId] ?? "" : "";
  const turnId = threadId ? store.state.activeTurns[threadId] : undefined;
  const sending = Object.values(store.pendingRequests).some((type) => type === "turn.start" || type === "turn.steer");
  const selectedModel = store.state.models.find((item) => item.model === store.model);
  const runConfig = `${selectedModel?.displayName ?? "读取模型中"} · ${effortLabels[store.effort]}`;
  const managingSessions = Object.values(store.pendingRequests).some((type) => type === "thread.create" || type === "slot.assign");
  const loadingSessions = Object.values(store.pendingRequests).some((type) => type === "thread.list");
  const historyLoading = Object.values(store.pendingRequests).some((type) => type === "thread.history");
  const targetSlotId = selected?.slotId ?? store.state.selectedSlotId ?? 1;
  const defaultCwd = selected?.threadId ? store.state.threads.find((thread) => thread.id === selected.threadId)?.cwd ?? "" : "";

  useEffect(() => {
    if (!openingRequestId || store.pendingRequests[openingRequestId]) return;
    const timer = setTimeout(() => { setOpeningRequestId(null); setOpeningSlotId(null); }, 350);
    return () => clearTimeout(timer);
  }, [openingRequestId, store.pendingRequests]);

  useEffect(() => {
    if (!threadId || store.status !== "connected") return;
    store.send({ type: "thread.history", requestId: commandId(), threadId });
  }, [threadId, store.status]);

  const openSessions = (create = false) => {
    setCreateOnOpen(create);
    setSessionsOpen(true);
    store.send({ type: "thread.list", requestId: commandId() });
  };

  const assignSession = (nextThreadId: string) => {
    store.send({ type: "slot.assign", requestId: commandId(), slotId: targetSlotId, threadId: nextThreadId });
    if (store.state.selectedSlotId !== targetSlotId) store.send({ type: "slot.select", requestId: commandId(), slotId: targetSlotId });
    setSessionsOpen(false);
  };

  const createSession = (cwd: string) => {
    store.send({ type: "thread.create", requestId: commandId(), cwd: cwd || undefined, slotId: targetSlotId });
    setSessionsOpen(false);
  };

  const selectAndOpen = (slotId: number) => {
    const slot = store.state.slots.find((item) => item.slotId === slotId);
    store.selectSlot(slotId);
    if (!slot?.threadId) { openSessions(false); return; }
    const requestId = commandId();
    setOpeningSlotId(slotId); setOpeningRequestId(requestId);
    store.send({ type: "desktop.openThread", requestId, threadId: slot.threadId });
  };

  const send = () => {
    if (!threadId || !draft.trim() || sending) return;
    try {
      const text = draft.trim();
      const requestId = commandId();
      store.send(turnId
        ? { type: "turn.steer", requestId, threadId, turnId, text }
        : { type: "turn.start", requestId, idempotencyKey: commandId(), threadId, text, model: store.model ?? undefined, effort: store.effort, planMode });
      setDraft("");
    } catch (error) { Alert.alert("发送失败", String(error)); }
  };

  const statusColor = store.status === "connected" && store.state.codexHealth === "ready" ? t.success : store.status === "error" || store.state.codexHealth === "error" ? t.danger : t.warning;
  const statusText = store.status === "connected" ? `CONNECTED · CODEX ${store.state.codexHealth.toUpperCase()}` : store.status.toUpperCase();

  if (store.status === "loading") return <View style={styles.loading}><Text style={styles.muted}>Loading…</Text></View>;
  if (!store.connection) return <PairingScreen />;

  return <SafeAreaView style={styles.root}>
    <StatusBar style={t.statusBar} />
    {!gamepadMode && <View style={styles.header}>
      <Pressable accessibilityLabel={gamepadMode ? "切换到控制台模式" : "切换到游戏手柄模式"} onPress={() => { void Haptics.selectionAsync(); setGamepadMode((value) => !value); }}><Text style={styles.brand}>CODEX MICRO</Text><Text style={styles.subtitle}>{gamepadMode ? "GAMEPAD CONTROL SURFACE" : "ANDROID CONTROL SURFACE"}</Text></Pressable>
      <Pressable onLongPress={() => void store.disconnect()}><Text style={[styles.status, { color: statusColor }]}>● {statusText}</Text></Pressable>
    </View>}

    {gamepadMode ? <GamepadSurface
      slots={store.state.slots} selectedSlotId={store.state.selectedSlotId} openingSlotId={openingSlotId}
      output={output} diff={diff} historyOutput={historyOutput} historyLoading={historyLoading} tab={tab} effort={store.effort} model={store.model} models={store.state.models}
      planMode={planMode} draft={draft} threadId={threadId} turnId={turnId} sending={sending} commandError={store.commandError}
      onSelectSlot={selectAndOpen} onEffort={store.setEffort} onModel={store.setModel} onPlanMode={setPlanMode} onDraft={setDraft} onSend={send}
      onStop={() => turnId && threadId && store.send({ type: "turn.interrupt", requestId: commandId(), threadId, turnId })}
      onTab={setTab} onOpenSessions={() => openSessions(false)} onCreate={() => openSessions(true)} onClearError={store.clearCommandError} onToggleMode={() => { void Haptics.selectionAsync(); setGamepadMode(false); }}
    /> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SlotGrid slots={store.state.slots} onSelect={selectAndOpen} onManage={() => openSessions(false)} onCreate={() => openSessions(true)} openingSlotId={openingSlotId} />

      <View style={styles.composer}>
        <View style={styles.composerHeader}>
          <View style={styles.composerTarget}><Text numberOfLines={1} style={styles.composerTitle}>{selected?.threadId ? `追加到：${selected.title ?? `会话 ${selected.slotId}`}` : "尚未选择 Codex 会话"}</Text>{turnId ? <Text style={styles.running}>运行中，可继续调整</Text> : output ? <Text style={styles.persisted}>✓ 已写入 Codex</Text> : null}</View>
          <View style={styles.configPill}><Text style={styles.configPillLabel}>下次发送</Text><Text numberOfLines={1} style={styles.configPillValue}>{runConfig}</Text></View>
        </View>
        <TextInput value={draft} onChangeText={setDraft} multiline placeholder={threadId ? (planMode ? "描述目标，Codex 会先制定方案…" : "输入消息，将追加到这个 Codex 会话…") : "请先选择或新建 Codex 会话"} placeholderTextColor={t.textMuted} style={styles.input} editable={Boolean(threadId) && !sending} />
        <View style={styles.composerButtons}>
          {turnId && <Pressable style={styles.stop} onPress={() => store.send({ type: "turn.interrupt", requestId: commandId(), threadId: threadId!, turnId })}><Text style={styles.actionText}>停止</Text></Pressable>}
          <Pressable disabled={!threadId || !draft.trim() || sending} style={[styles.send, (!threadId || !draft.trim() || sending) && styles.disabled]} onPress={send}><Text style={styles.actionText}>{sending ? "发送中…" : turnId ? "调整任务" : planMode ? "获取方案" : "发送"}</Text></Pressable>
        </View>
      </View>

      {store.commandError && <Pressable style={styles.errorBox} onPress={store.clearCommandError}><Text style={styles.errorTitle}>命令未执行</Text><Text selectable style={styles.errorText}>{store.commandError}</Text><Text style={styles.errorHint}>点击关闭</Text></Pressable>}

      <ControlDeck effort={store.effort} model={store.model} models={store.state.models} planMode={planMode} expanded={settingsOpen} onEffort={store.setEffort} onModel={store.setModel} onPlanMode={setPlanMode} onExpanded={setSettingsOpen} />

      {approval && <View style={styles.approval}>
        <Text style={styles.approvalTitle}>需要确认</Text><Text style={styles.approvalBody}>{approval.command ?? approval.title}</Text><Text style={styles.approvalReason}>{approval.reason}</Text>
        <View style={styles.actions}><Pressable style={styles.approve} onPress={() => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); store.send({ type: "approval.respond", requestId: commandId(), approvalRequestId: approval.id, decision: "accept" }); }}><Text style={styles.actionText}>允许</Text></Pressable><Pressable style={styles.decline} onPress={() => store.send({ type: "approval.respond", requestId: commandId(), approvalRequestId: approval.id, decision: "decline" })}><Text style={styles.actionText}>拒绝</Text></Pressable></View>
      </View>}

      <View style={styles.console}>
        <View style={styles.tabs}><Pressable onPress={() => setTab("output")}><Text style={[styles.tab, tab === "output" && styles.tabActive]}>输出</Text></Pressable><Pressable onPress={() => setTab("diff")}><Text style={[styles.tab, tab === "diff" && styles.tabActive]}>变更</Text></Pressable><Pressable onPress={() => setTab("history")}><Text style={[styles.tab, tab === "history" && styles.tabActive]}>历史信息</Text></Pressable><Text style={styles.turn}>{!threadId ? "未选择会话" : turnId ? "运行中" : "空闲"}</Text></View>
        {tab === "history" && historyLoading ? <View style={styles.historyLoading}><ActivityIndicator color={t.accent} /><Text style={styles.historyLoadingTitle}>正在检查历史信息…</Text><Text style={styles.historyLoadingHint}>从 Codex 读取该对话的最后一段记录</Text></View> : <ScrollView style={styles.output} nestedScrollEnabled><Text selectable style={[styles.mono, tab === "history" && !historyOutput && styles.emptyHistory]}>{tab === "output" ? output || "暂无输出。" : tab === "diff" ? diff || "暂无代码变更。" : historyOutput || "历史信息已加载，但该对话没有可显示的用户/助手消息。"}</Text></ScrollView>}
      </View>

      <View style={styles.footer}><Pressable onPress={() => threadId && store.send({ type: "thread.fork", requestId: commandId(), threadId })}><Text style={styles.footerButton}>复制会话</Text></Pressable><Pressable onPress={() => selected && selectAndOpen(selected.slotId)}><Text style={styles.footerButton}>桌面打开</Text></Pressable><Pressable onPress={() => { store.send({ type: "thread.list", requestId: commandId() }); store.send({ type: "model.list", requestId: commandId() }); }}><Text style={styles.footerButton}>刷新</Text></Pressable></View>
    </ScrollView>}

    <SessionPicker key={`${sessionsOpen}-${createOnOpen}`} visible={sessionsOpen} startCreating={createOnOpen} slotId={targetSlotId} currentThreadId={threadId} threads={store.state.threads} busy={managingSessions} loading={loadingSessions} defaultCwd={defaultCwd} onClose={() => setSessionsOpen(false)} onAssign={assignSession} onCreate={createSession} onRefresh={() => store.send({ type: "thread.list", requestId: commandId() })} />
  </SafeAreaView>;
}

const createStyles = (t: Palette) => StyleSheet.create({
  loading: { flex: 1, backgroundColor: t.appBg, alignItems: "center", justifyContent: "center" },
  root: { flex: 1, backgroundColor: t.appBg },
  header: { paddingHorizontal: 18, paddingVertical: 12, borderBottomColor: t.borderStrong, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: t.surfaceAlt, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.1 : 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  brand: { color: t.textPrimary, fontWeight: "900", fontSize: 18, letterSpacing: 3.5, textShadowColor: t.glow, textShadowRadius: t.mode === "dark" ? 12 : 0, textShadowOffset: { width: 0, height: 0 } },
  subtitle: { color: t.textFaint, fontSize: 8, letterSpacing: 3, marginTop: 2, fontWeight: "800" },
  status: { fontSize: 8, fontWeight: "800", maxWidth: 170, textAlign: "right", letterSpacing: 0.8, textShadowColor: t.glow, textShadowRadius: t.mode === "dark" ? 6 : 0, textShadowOffset: { width: 0, height: 0 } },
  content: { padding: 14, maxWidth: 900, alignSelf: "center", width: "100%", paddingBottom: 14 },
  composer: { marginTop: 10, backgroundColor: t.surface, borderRadius: 16, borderWidth: 1, borderColor: t.borderStrong, padding: 12, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.12 : 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  composerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 },
  composerTarget: { flex: 1, minWidth: 0 },
  composerTitle: { color: t.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  running: { color: t.running, fontSize: 8, marginTop: 3, fontWeight: "800", letterSpacing: 0.5, textShadowColor: t.running, textShadowRadius: t.mode === "dark" ? 6 : 0, textShadowOffset: { width: 0, height: 0 } },
  persisted: { color: t.success, fontSize: 8, fontWeight: "800", marginTop: 3, letterSpacing: 0.5 },
  configPill: { maxWidth: "62%", flexDirection: "row", alignItems: "center", borderRadius: 11, borderWidth: 1, borderColor: t.accentBorder, backgroundColor: t.accentBg, paddingHorizontal: 9, paddingVertical: 5, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.25 : 0.1, shadowRadius: 8, elevation: 2 },
  configPillLabel: { color: t.textMuted, fontSize: 8, marginRight: 5, letterSpacing: 1 },
  configPillValue: { color: t.accent, fontSize: 9, fontWeight: "900", flexShrink: 1, letterSpacing: 0.3 },
  input: { minHeight: 56, color: t.textPrimary, textAlignVertical: "top", fontSize: 13, letterSpacing: 0.2 },
  composerButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  send: { backgroundColor: t.primary, minWidth: 90, alignItems: "center", paddingHorizontal: 22, paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: t.primaryBorder, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.55 : 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  disabled: { opacity: 0.35 },
  stop: { backgroundColor: t.declineBtn, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: t.errorBorder },
  actionText: { color: "#ffffff", fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  errorBox: { marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: t.errorBorder, backgroundColor: t.errorBg, shadowColor: t.danger, shadowOpacity: t.mode === "dark" ? 0.25 : 0.08, shadowRadius: 12, elevation: 3 },
  errorTitle: { color: t.errorTitle, fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  errorText: { color: t.errorText, fontSize: 10, marginTop: 4, letterSpacing: 0.3 },
  errorHint: { color: t.errorHint, fontSize: 8, marginTop: 5, letterSpacing: 0.5 },
  console: { marginTop: 10, borderRadius: 16, backgroundColor: t.surfaceAlt, borderWidth: 1, borderColor: t.borderStrong, overflow: "hidden", shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.1 : 0.03, shadowRadius: 10, elevation: 2 },
  tabs: { flexDirection: "row", gap: 20, padding: 13, borderBottomWidth: 1, borderBottomColor: t.divider, alignItems: "center" },
  tab: { color: t.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  tabActive: { color: t.accent, textShadowColor: t.glow, textShadowRadius: t.mode === "dark" ? 8 : 0, textShadowOffset: { width: 0, height: 0 } },
  turn: { color: t.textMuted, fontSize: 10, marginLeft: "auto", letterSpacing: 0.5, fontWeight: "800" },
  output: { height: 150, padding: 13 },
  mono: { color: t.textSecondary, fontFamily: "monospace", fontSize: 12, lineHeight: 18, letterSpacing: 0.3 },
  historyLoading: { height: 150, alignItems: "center", justifyContent: "center", gap: 7 },
  historyLoadingTitle: { color: t.textPrimary, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  historyLoadingHint: { color: t.textMuted, fontSize: 8, letterSpacing: 0.3 },
  emptyHistory: { color: t.textMuted, textAlign: "center", marginTop: 28 },
  approval: { marginTop: 10, padding: 14, backgroundColor: t.approvalBg, borderColor: t.approvalBorder, borderWidth: 1, borderRadius: 16, shadowColor: t.warning, shadowOpacity: t.mode === "dark" ? 0.25 : 0.08, shadowRadius: 12, elevation: 3 },
  approvalTitle: { color: t.approvalTitle, fontWeight: "900", letterSpacing: 1.5 },
  approvalBody: { color: t.approvalBody, fontFamily: "monospace", marginTop: 8, letterSpacing: 0.3 },
  approvalReason: { color: t.approvalReason, marginTop: 6, letterSpacing: 0.3 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  approve: { flex: 1, padding: 12, borderRadius: 11, backgroundColor: t.approveBtn, alignItems: "center", borderWidth: 1, borderColor: t.success, shadowColor: t.success, shadowOpacity: t.mode === "dark" ? 0.35 : 0.12, shadowRadius: 10, elevation: 3 },
  decline: { flex: 1, padding: 12, borderRadius: 11, backgroundColor: t.declineBtn, alignItems: "center", borderWidth: 1, borderColor: t.danger },
  footer: { flexDirection: "row", justifyContent: "space-around", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.divider },
  footerButton: { color: t.accentDim, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  muted: { color: t.textMuted, letterSpacing: 0.5 },
});
