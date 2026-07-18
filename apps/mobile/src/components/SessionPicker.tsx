import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { ThreadSummary } from "@codex-micro/protocol";
import { useTheme, type Palette } from "../theme";

type Props = {
  visible: boolean;
  startCreating: boolean;
  slotId: number;
  currentThreadId: string | null;
  threads: ThreadSummary[];
  busy: boolean;
  loading: boolean;
  defaultCwd: string;
  onClose: () => void;
  onAssign: (threadId: string) => void;
  onCreate: (cwd: string) => void;
  onRefresh: () => void;
};

const formatTime = (value: number) => new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

export function SessionPicker({ visible, startCreating, slotId, currentThreadId, threads, busy, loading, defaultCwd, onClose, onAssign, onCreate, onRefresh }: Props) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [query, setQuery] = useState("");
  const [cwd, setCwd] = useState(defaultCwd);
  const [creating, setCreating] = useState(startCreating);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return threads;
    return threads.filter((thread) => `${thread.title}\n${thread.cwd ?? ""}\n${thread.id}`.toLocaleLowerCase().includes(needle));
  }, [query, threads]);

  const close = () => { setCreating(false); setQuery(""); onClose(); };

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View><Text style={styles.title}>Codex 会话</Text><Text style={styles.subtitle}>选择后，消息将追加到该会话 · 快捷位 {slotId}</Text></View>
          <Pressable onPress={close}><Text style={styles.close}>关闭</Text></Pressable>
        </View>

        {creating ? <View style={styles.createBox}>
          <Text style={styles.label}>新会话工作目录</Text>
          <TextInput value={cwd} onChangeText={setCwd} autoCapitalize="none" autoCorrect={false} placeholder="例如 D:\\Code\\project" placeholderTextColor={t.textMuted} style={styles.cwdInput} />
          <Text style={styles.help}>留空时使用 Companion 的默认工作目录。</Text>
          <View style={styles.createActions}>
            <Pressable onPress={() => setCreating(false)} style={styles.secondary}><Text style={styles.secondaryText}>返回列表</Text></Pressable>
            <Pressable disabled={busy} onPress={() => onCreate(cwd.trim())} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? "创建中…" : "创建并选中"}</Text></Pressable>
          </View>
        </View> : <>
          <View style={styles.toolbar}>
            <TextInput value={query} onChangeText={setQuery} placeholder="搜索标题、项目路径或会话 ID" placeholderTextColor={t.textMuted} style={styles.search} />
            <Pressable onPress={onRefresh}><Text style={styles.refresh}>刷新</Text></Pressable>
            <Pressable onPress={() => { setCwd(defaultCwd); setCreating(true); }}><Text style={styles.newThread}>新建</Text></Pressable>
          </View>
          {loading && <View style={styles.loading}><ActivityIndicator color={t.accent} /><View><Text style={styles.loadingTitle}>正在加载 Codex 历史会话…</Text><Text style={styles.loadingHint}>等待桌面 Companion 返回会话列表</Text></View></View>}
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
            {filtered.map((thread) => {
              const active = thread.id === currentThreadId;
              return <Pressable key={thread.id} disabled={busy} onPress={() => onAssign(thread.id)} style={[styles.row, active && styles.active]}>
                <View style={styles.rowText}><Text numberOfLines={2} style={styles.threadTitle}>{thread.title}</Text><Text numberOfLines={1} style={styles.meta}>{thread.cwd ?? "未记录工作目录"} · {formatTime(thread.updatedAt)}</Text></View>
                <Text style={[styles.choose, active && styles.current]}>{active ? "当前" : "选择"}</Text>
              </Pressable>;
            })}
            {!loading && !filtered.length && <Text style={styles.empty}>{query.trim() ? "没有匹配的 Codex 会话。" : "历史会话已加载，但列表为空。"}</Text>}
          </ScrollView>
        </>}
      </View>
    </View>
  </Modal>;
}

const createStyles = (t: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: t.overlay, justifyContent: "flex-end" },
  sheet: { maxHeight: "86%", minHeight: "58%", backgroundColor: t.sheet, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: t.borderStrong, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 13 },
  title: { color: t.textPrimary, fontSize: 17, fontWeight: "900" },
  subtitle: { color: t.textMuted, fontSize: 9, marginTop: 4 },
  close: { color: t.accent, fontSize: 11, fontWeight: "800", padding: 5 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  search: { flex: 1, height: 40, borderRadius: 11, borderWidth: 1, borderColor: t.border, backgroundColor: t.inputBg, color: t.textPrimary, paddingHorizontal: 12, fontSize: 11 },
  refresh: { color: t.accentDim, fontSize: 10, fontWeight: "800" },
  newThread: { color: t.accent, fontSize: 10, fontWeight: "900" },
  list: { flex: 1 },
  loading: { minHeight: 72, borderRadius: 12, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.accentBg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 },
  loadingTitle: { color: t.textPrimary, fontSize: 11, fontWeight: "900" },
  loadingHint: { color: t.textMuted, fontSize: 8, marginTop: 4 },
  row: { minHeight: 67, borderBottomWidth: 1, borderBottomColor: t.divider, flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 9 },
  active: { backgroundColor: t.accentBg, borderRadius: 11, borderBottomColor: t.accentBorder },
  rowText: { flex: 1, minWidth: 0 },
  threadTitle: { color: t.textPrimary, fontSize: 12, fontWeight: "700" },
  meta: { color: t.textMuted, fontSize: 8, marginTop: 5 },
  choose: { color: t.accent, fontSize: 9, fontWeight: "900", marginLeft: 10 },
  current: { color: t.success },
  empty: { color: t.textMuted, textAlign: "center", marginTop: 40 },
  createBox: { paddingTop: 10 },
  label: { color: t.textSecondary, fontSize: 11, fontWeight: "800", marginBottom: 8 },
  cwdInput: { height: 46, borderRadius: 11, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.inputBg, color: t.textPrimary, paddingHorizontal: 12, fontSize: 12 },
  help: { color: t.textMuted, fontSize: 9, marginTop: 7 },
  createActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  secondary: { paddingHorizontal: 16, paddingVertical: 11 },
  secondaryText: { color: t.textSecondary, fontWeight: "800", fontSize: 10 },
  primary: { backgroundColor: t.primary, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 11 },
  primaryText: { color: "#ffffff", fontWeight: "900", fontSize: 10 },
  disabled: { opacity: 0.4 },
});
