import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import * as ScreenOrientation from "expo-screen-orientation";
import { PairingScreen } from "../src/components/PairingScreen";
import { SlotGrid } from "../src/components/SlotGrid";
import { ControlDeck } from "../src/components/ControlDeck";
import { GamepadSurface } from "../src/components/GamepadSurface";
import { SessionPicker } from "../src/components/SessionPicker";
import { commandId, useController } from "../src/store/controller";

const effortLabels = { low: "低", medium: "中", high: "高", xhigh: "极高" } as const;

export default function Home() {
  const store = useController();
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

  const statusColor = store.status === "connected" && store.state.codexHealth === "ready" ? "#24d17e" : store.status === "error" || store.state.codexHealth === "error" ? "#ff4057" : "#ffb020";
  const statusText = store.status === "connected" ? `CONNECTED · CODEX ${store.state.codexHealth.toUpperCase()}` : store.status.toUpperCase();

  if (store.status === "loading") return <View style={styles.loading}><Text style={styles.muted}>Loading…</Text></View>;
  if (!store.connection) return <PairingScreen />;

  return <SafeAreaView style={styles.root}>
    <StatusBar style="light" />
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
        <TextInput value={draft} onChangeText={setDraft} multiline placeholder={threadId ? (planMode ? "描述目标，Codex 会先制定方案…" : "输入消息，将追加到这个 Codex 会话…") : "请先选择或新建 Codex 会话"} placeholderTextColor="#58707b" style={styles.input} editable={Boolean(threadId) && !sending} />
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
        {tab === "history" && historyLoading ? <View style={styles.historyLoading}><ActivityIndicator color="#50dfff" /><Text style={styles.historyLoadingTitle}>正在检查历史信息…</Text><Text style={styles.historyLoadingHint}>从 Codex 读取该对话的最后一段记录</Text></View> : <ScrollView style={styles.output} nestedScrollEnabled><Text selectable style={[styles.mono, tab === "history" && !historyOutput && styles.emptyHistory]}>{tab === "output" ? output || "暂无输出。" : tab === "diff" ? diff || "暂无代码变更。" : historyOutput || "历史信息已加载，但该对话没有可显示的用户/助手消息。"}</Text></ScrollView>}
      </View>

      <View style={styles.footer}><Pressable onPress={() => threadId && store.send({ type: "thread.fork", requestId: commandId(), threadId })}><Text style={styles.footerButton}>复制会话</Text></Pressable><Pressable onPress={() => selected && selectAndOpen(selected.slotId)}><Text style={styles.footerButton}>桌面打开</Text></Pressable><Pressable onPress={() => { store.send({ type: "thread.list", requestId: commandId() }); store.send({ type: "model.list", requestId: commandId() }); }}><Text style={styles.footerButton}>刷新</Text></Pressable></View>
    </ScrollView>}

    <SessionPicker key={`${sessionsOpen}-${createOnOpen}`} visible={sessionsOpen} startCreating={createOnOpen} slotId={targetSlotId} currentThreadId={threadId} threads={store.state.threads} busy={managingSessions} loading={loadingSessions} defaultCwd={defaultCwd} onClose={() => setSessionsOpen(false)} onAssign={assignSession} onCreate={createSession} onRefresh={() => store.send({ type: "thread.list", requestId: commandId() })} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: "#050a0e", alignItems: "center", justifyContent: "center" },
  root: { flex: 1, backgroundColor: "#050a0e" },
  header: { paddingHorizontal: 18, paddingVertical: 11, borderBottomColor: "#142832", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#dbf8ff", fontWeight: "900", fontSize: 18, letterSpacing: 2 },
  subtitle: { color: "#4d6672", fontSize: 8, letterSpacing: 2 },
  status: { fontSize: 8, fontWeight: "800", maxWidth: 170, textAlign: "right" },
  content: { padding: 14, maxWidth: 900, alignSelf: "center", width: "100%", paddingBottom: 30 },
  composer: { marginTop: 10, backgroundColor: "#0a141a", borderRadius: 14, borderWidth: 1, borderColor: "#17313e", padding: 10 },
  composerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 5 },
  composerTarget: { flex: 1, minWidth: 0 },
  composerTitle: { color: "#7c98a4", fontSize: 10, fontWeight: "800" },
  running: { color: "#48aee9", fontSize: 8, marginTop: 3 },
  persisted: { color: "#36d991", fontSize: 8, fontWeight: "800", marginTop: 3 },
  configPill: { maxWidth: "62%", flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "#1e5264", backgroundColor: "#0c2631", paddingHorizontal: 8, paddingVertical: 4 },
  configPillLabel: { color: "#5f8796", fontSize: 8, marginRight: 5 },
  configPillValue: { color: "#67ddfa", fontSize: 9, fontWeight: "900", flexShrink: 1 },
  input: { minHeight: 72, color: "white", textAlignVertical: "top", fontSize: 13 },
  composerButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  send: { backgroundColor: "#087d9d", minWidth: 90, alignItems: "center", paddingHorizontal: 22, paddingVertical: 10, borderRadius: 9 },
  disabled: { opacity: 0.35 },
  stop: { backgroundColor: "#8a2938", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 9 },
  actionText: { color: "white", fontWeight: "900", fontSize: 11 },
  errorBox: { marginTop: 10, padding: 11, borderRadius: 11, borderWidth: 1, borderColor: "#98394a", backgroundColor: "#271017" },
  errorTitle: { color: "#ff7386", fontWeight: "900", fontSize: 11 },
  errorText: { color: "#ffc0c9", fontSize: 10, marginTop: 4 },
  errorHint: { color: "#925764", fontSize: 8, marginTop: 5 },
  console: { marginTop: 10, borderRadius: 14, backgroundColor: "#071018", borderWidth: 1, borderColor: "#16303d", overflow: "hidden" },
  tabs: { flexDirection: "row", gap: 20, padding: 12, borderBottomWidth: 1, borderBottomColor: "#142832" },
  tab: { color: "#5d7480", fontSize: 11, fontWeight: "800" },
  tabActive: { color: "#58ddff" },
  turn: { color: "#607783", fontSize: 10, marginLeft: "auto" },
  output: { height: 230, padding: 12 },
  mono: { color: "#b8ccd5", fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
  historyLoading: { height: 230, alignItems: "center", justifyContent: "center", gap: 7 },
  historyLoadingTitle: { color: "#bdebf5", fontSize: 11, fontWeight: "900" },
  historyLoadingHint: { color: "#63828e", fontSize: 8 },
  emptyHistory: { color: "#68838d", textAlign: "center", marginTop: 28 },
  approval: { marginTop: 10, padding: 14, backgroundColor: "#251d0b", borderColor: "#9b6813", borderWidth: 1, borderRadius: 14 },
  approvalTitle: { color: "#ffbd45", fontWeight: "900", letterSpacing: 1 },
  approvalBody: { color: "#ffe7bd", fontFamily: "monospace", marginTop: 8 },
  approvalReason: { color: "#a98a55", marginTop: 6 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  approve: { flex: 1, padding: 12, borderRadius: 9, backgroundColor: "#16784c", alignItems: "center" },
  decline: { flex: 1, padding: 12, borderRadius: 9, backgroundColor: "#8a2938", alignItems: "center" },
  footer: { flexDirection: "row", justifyContent: "space-around", marginTop: 14 },
  footerButton: { color: "#5faec2", fontSize: 11, fontWeight: "800" },
  muted: { color: "#708995" },
});
