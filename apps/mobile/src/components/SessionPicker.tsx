import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { ThreadSummary } from "@codex-micro/protocol";

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
          <TextInput value={cwd} onChangeText={setCwd} autoCapitalize="none" autoCorrect={false} placeholder="例如 D:\\Code\\project" placeholderTextColor="#526b76" style={styles.cwdInput} />
          <Text style={styles.help}>留空时使用 Companion 的默认工作目录。</Text>
          <View style={styles.createActions}>
            <Pressable onPress={() => setCreating(false)} style={styles.secondary}><Text style={styles.secondaryText}>返回列表</Text></Pressable>
            <Pressable disabled={busy} onPress={() => onCreate(cwd.trim())} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? "创建中…" : "创建并选中"}</Text></Pressable>
          </View>
        </View> : <>
          <View style={styles.toolbar}>
            <TextInput value={query} onChangeText={setQuery} placeholder="搜索标题、项目路径或会话 ID" placeholderTextColor="#526b76" style={styles.search} />
            <Pressable onPress={onRefresh}><Text style={styles.refresh}>刷新</Text></Pressable>
            <Pressable onPress={() => { setCwd(defaultCwd); setCreating(true); }}><Text style={styles.newThread}>新建</Text></Pressable>
          </View>
          {loading && <View style={styles.loading}><ActivityIndicator color="#50dfff" /><View><Text style={styles.loadingTitle}>正在加载 Codex 历史会话…</Text><Text style={styles.loadingHint}>等待桌面 Companion 返回会话列表</Text></View></View>}
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0, 5, 8, 0.82)", justifyContent: "flex-end" },
  sheet: { maxHeight: "86%", minHeight: "58%", backgroundColor: "#081218", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: "#214353", padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 13 },
  title: { color: "#e1f8ff", fontSize: 17, fontWeight: "900" },
  subtitle: { color: "#66808b", fontSize: 9, marginTop: 4 },
  close: { color: "#62cde8", fontSize: 11, fontWeight: "800", padding: 5 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  search: { flex: 1, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#1b3946", backgroundColor: "#0c1a21", color: "white", paddingHorizontal: 11, fontSize: 11 },
  refresh: { color: "#6e9fac", fontSize: 10, fontWeight: "800" },
  newThread: { color: "#50dfff", fontSize: 10, fontWeight: "900" },
  list: { flex: 1 },
  loading: { minHeight: 72, borderRadius: 12, borderWidth: 1, borderColor: "#1d4c5d", backgroundColor: "#0b2029", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 },
  loadingTitle: { color: "#bdebf5", fontSize: 11, fontWeight: "900" },
  loadingHint: { color: "#63828e", fontSize: 8, marginTop: 4 },
  row: { minHeight: 67, borderBottomWidth: 1, borderBottomColor: "#132a34", flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 7 },
  active: { backgroundColor: "#102c38", borderRadius: 10, borderBottomColor: "#36cdeb" },
  rowText: { flex: 1, minWidth: 0 },
  threadTitle: { color: "#d9edf4", fontSize: 12, fontWeight: "700" },
  meta: { color: "#667f8a", fontSize: 8, marginTop: 5 },
  choose: { color: "#58cae5", fontSize: 9, fontWeight: "900", marginLeft: 10 },
  current: { color: "#35db91" },
  empty: { color: "#6b818b", textAlign: "center", marginTop: 40 },
  createBox: { paddingTop: 10 },
  label: { color: "#a9c3cd", fontSize: 11, fontWeight: "800", marginBottom: 8 },
  cwdInput: { height: 46, borderRadius: 10, borderWidth: 1, borderColor: "#255063", backgroundColor: "#0c1a21", color: "white", paddingHorizontal: 12, fontSize: 12 },
  help: { color: "#5d747e", fontSize: 9, marginTop: 7 },
  createActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
  secondary: { paddingHorizontal: 16, paddingVertical: 11 },
  secondaryText: { color: "#75909b", fontWeight: "800", fontSize: 10 },
  primary: { backgroundColor: "#087d9d", paddingHorizontal: 20, paddingVertical: 11, borderRadius: 9 },
  primaryText: { color: "white", fontWeight: "900", fontSize: 10 },
  disabled: { opacity: 0.4 },
});
