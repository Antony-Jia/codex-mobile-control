import { useMemo } from "react";
import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Effort, ModelOption, PermissionMode } from "@codex-micro/protocol";
import { PermissionModePicker, permissionModeOptions } from "./PermissionModePicker";
import { useTheme, type Palette } from "../theme";

type Props = {
  effort: Effort;
  model: string | null;
  models: ModelOption[];
  permissionMode: PermissionMode;
  planMode: boolean;
  expanded: boolean;
  onEffort: (value: Effort) => void;
  onModel: (value: string) => void;
  onPermissionMode: (value: PermissionMode) => void;
  onPlanMode: (value: boolean) => void;
  onExpanded: (value: boolean) => void;
};

const allEfforts: Effort[] = ["low", "medium", "high", "xhigh"];
const effortLabels: Record<Effort, string> = { low: "低", medium: "中", high: "高", xhigh: "极高" };
const tap = (action: () => void) => { void Haptics.selectionAsync(); action(); };

export function ControlDeck(props: Props) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const selectedModel = props.models.find((item) => item.model === props.model);
  const efforts = selectedModel?.supportedEfforts.length ? selectedModel.supportedEfforts : allEfforts;
  const permissionLabel = permissionModeOptions.find((item) => item.value === props.permissionMode)?.label ?? "请求批准";
  const summary = `${props.planMode ? "先给方案" : "直接执行"} · ${permissionLabel} · ${selectedModel?.displayName ?? "读取模型中"} · ${effortLabels[props.effort]}`;

  return <View style={styles.root}>
    <Pressable accessibilityLabel={props.expanded ? "收起运行设置" : "展开运行设置"} style={styles.header} onPress={() => props.onExpanded(!props.expanded)}>
      <View style={styles.headerText}>
        <Text style={styles.title}>运行设置</Text>
        <Text numberOfLines={1} style={styles.summary}>{summary}</Text>
      </View>
      <Text style={styles.chevron}>{props.expanded ? "收起 ︿" : "展开 ﹀"}</Text>
    </Pressable>

    {props.expanded && <View style={styles.body}>
      <Text style={styles.label}>执行方式</Text>
      <View style={styles.segmentRow}>
        <Pressable accessibilityState={{ selected: !props.planMode }} style={[styles.segment, !props.planMode && styles.active]} onPress={() => tap(() => props.onPlanMode(false))}><Text style={[styles.segmentText, !props.planMode && styles.activeText]}>直接执行</Text></Pressable>
        <Pressable accessibilityState={{ selected: props.planMode }} style={[styles.segment, props.planMode && styles.active]} onPress={() => tap(() => props.onPlanMode(true))}><Text style={[styles.segmentText, props.planMode && styles.activeText]}>先给方案</Text></Pressable>
      </View>

      <Text style={styles.label}>权限模式</Text>
      <PermissionModePicker value={props.permissionMode} onChange={props.onPermissionMode} />

      <Text style={styles.label}>模型</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modelRow}>
        {props.models.length ? props.models.map((item) => <Pressable key={item.id} accessibilityLabel={item.displayName} accessibilityState={{ selected: props.model === item.model }} onPress={() => tap(() => props.onModel(item.model))} style={[styles.modelChip, props.model === item.model && styles.active]}><Text numberOfLines={1} style={[styles.modelText, props.model === item.model && styles.activeText]}>{item.displayName}</Text>{item.isDefault && <Text style={styles.defaultText}>默认</Text>}</Pressable>) : <Text style={styles.empty}>正在读取 Codex 模型…</Text>}
      </ScrollView>

      <View style={styles.reasonHeader}><Text style={styles.label}>推理强度</Text>{selectedModel && <Text numberOfLines={1} style={styles.modelHint}>{selectedModel.displayName}</Text>}</View>
      <View style={styles.effortRow}>{efforts.map((value) => <Pressable key={value} accessibilityLabel={`推理强度${effortLabels[value]}`} accessibilityState={{ selected: props.effort === value }} onPress={() => tap(() => props.onEffort(value))} style={[styles.effortChip, props.effort === value && styles.active]}><Text style={[styles.segmentText, props.effort === value && styles.activeText]}>{effortLabels[value]}</Text></Pressable>)}</View>
    </View>}
  </View>;
}

const createStyles = (t: Palette) => StyleSheet.create({
  root: { marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, overflow: "hidden", shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.12 : 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  header: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 11, flexDirection: "row", alignItems: "center" },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: t.textPrimary, fontSize: 12, fontWeight: "900", letterSpacing: 1.2 },
  summary: { color: t.textMuted, fontSize: 10, marginTop: 3, letterSpacing: 0.3 },
  chevron: { color: t.accent, fontSize: 10, fontWeight: "800", marginLeft: 10, letterSpacing: 1, textShadowColor: t.glow, textShadowRadius: t.mode === "dark" ? 6 : 0, textShadowOffset: { width: 0, height: 0 } },
  body: { borderTopWidth: 1, borderTopColor: t.divider, padding: 13 },
  label: { color: t.textMuted, fontSize: 10, letterSpacing: 2, fontWeight: "800", marginBottom: 7 },
  segmentRow: { flexDirection: "row", gap: 7, marginBottom: 12 },
  segment: { flex: 1, paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceAlt, alignItems: "center" },
  segmentText: { color: t.textSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  active: { borderColor: t.accentBorder, backgroundColor: t.accentBg, shadowColor: t.glow, shadowOpacity: t.mode === "dark" ? 0.35 : 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 3 },
  activeText: { color: t.accent, fontWeight: "900" },
  modelRow: { gap: 7, paddingBottom: 12 },
  modelChip: { minWidth: 112, maxWidth: 180, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceAlt },
  modelText: { color: t.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  defaultText: { color: t.textMuted, fontSize: 8, marginTop: 3, letterSpacing: 1 },
  empty: { color: t.textMuted, fontSize: 11, paddingVertical: 8 },
  reasonHeader: { flexDirection: "row", justifyContent: "space-between" },
  modelHint: { color: t.textFaint, fontSize: 9, maxWidth: "55%" },
  effortRow: { flexDirection: "row", gap: 7 },
  effortChip: { flex: 1, paddingVertical: 11, borderRadius: 11, borderWidth: 1, borderColor: t.border, backgroundColor: t.surfaceAlt, alignItems: "center" },
});
