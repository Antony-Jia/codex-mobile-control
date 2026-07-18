import { useMemo, useState } from "react";
import * as Haptics from "expo-haptics";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { PermissionMode } from "@codex-micro/protocol";
import { useTheme, type Palette } from "../theme";

export const permissionModeOptions: Array<{ value: PermissionMode; label: string; description: string }> = [
  { value: "ask", label: "请求批准", description: "需要你确认敏感操作" },
  { value: "auto", label: "替我审批", description: "由 Codex 自动审查并处理批准" },
  { value: "full", label: "完全访问权限", description: "不请求批准，使用完全访问沙箱" },
];

type Props = {
  value: PermissionMode;
  onChange: (value: PermissionMode) => void;
  compact?: boolean;
};

export function PermissionModePicker({ value, onChange, compact = false }: Props) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [visible, setVisible] = useState(false);
  const selected = permissionModeOptions.find((item) => item.value === value) ?? permissionModeOptions[0];
  const choose = (next: PermissionMode) => {
    void Haptics.selectionAsync();
    onChange(next);
    setVisible(false);
  };

  const control = compact
    ? <Pressable accessibilityLabel="切换权限模式" style={styles.compactButton} onPress={() => setVisible(true)}><Text numberOfLines={1} style={styles.compactText}>{selected.label}</Text><Text style={styles.compactChevron}>⌄</Text></Pressable>
    : <View style={styles.inlineRow}>{permissionModeOptions.map((item) => <Pressable key={item.value} accessibilityLabel={item.label} accessibilityState={{ selected: value === item.value }} style={[styles.inlineOption, value === item.value && styles.active]} onPress={() => choose(item.value)}><Text numberOfLines={1} style={[styles.optionText, value === item.value && styles.activeText]}>{item.label}</Text></Pressable>)}</View>;

  return <>
    {control}
    {compact && <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>权限模式</Text>
          {permissionModeOptions.map((item) => <Pressable key={item.value} accessibilityState={{ selected: value === item.value }} style={[styles.modalOption, value === item.value && styles.active]} onPress={() => choose(item.value)}><View style={styles.modalOptionText}><Text style={[styles.optionText, value === item.value && styles.activeText]}>{item.label}</Text><Text style={styles.description}>{item.description}</Text></View>{value === item.value && <Text style={styles.check}>✓</Text>}</Pressable>)}
        </View>
      </View>
    </Modal>}
  </>;
}

const createStyles = (t: Palette) => StyleSheet.create({
  inlineRow: { flexDirection: "row", gap: 7, marginBottom: 12 },
  inlineOption: { flex: 1, minWidth: 0, paddingVertical: 11, paddingHorizontal: 5, borderRadius: 11, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceAlt, alignItems: "center" },
  optionText: { color: t.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 0.2 },
  active: { borderColor: t.accentBorder, backgroundColor: t.accentBg, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.35 : 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  activeText: { color: t.accent, fontWeight: "900" },
  compactButton: { maxWidth: 118, minWidth: 86, height: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: t.accentBorder, backgroundColor: t.accentBg },
  compactText: { color: t.accent, flexShrink: 1, fontSize: 9, fontWeight: "900", letterSpacing: 0.2 },
  compactChevron: { color: t.accent, fontSize: 13, lineHeight: 14, fontWeight: "900" },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.58)" },
  modalCard: { width: "86%", maxWidth: 420, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.4 : 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  modalTitle: { color: t.textPrimary, fontSize: 15, fontWeight: "900", letterSpacing: 1, marginBottom: 12 },
  modalOption: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13, paddingVertical: 9, marginTop: 7, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceAlt },
  modalOptionText: { flex: 1, minWidth: 0 },
  description: { color: t.textMuted, fontSize: 10, marginTop: 4, letterSpacing: 0.2 },
  check: { color: t.accent, fontSize: 18, fontWeight: "900", marginLeft: 10 },
});
