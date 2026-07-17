import * as Haptics from "expo-haptics";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Effort, ModelOption } from "@codex-micro/protocol";

type Props = {
  effort: Effort;
  model: string | null;
  models: ModelOption[];
  planMode: boolean;
  expanded: boolean;
  onEffort: (value: Effort) => void;
  onModel: (value: string) => void;
  onPlanMode: (value: boolean) => void;
  onExpanded: (value: boolean) => void;
};

const allEfforts: Effort[] = ["low", "medium", "high", "xhigh"];
const effortLabels: Record<Effort, string> = { low: "低", medium: "中", high: "高", xhigh: "极高" };
const tap = (action: () => void) => { void Haptics.selectionAsync(); action(); };

export function ControlDeck(props: Props) {
  const selectedModel = props.models.find((item) => item.model === props.model);
  const efforts = selectedModel?.supportedEfforts.length ? selectedModel.supportedEfforts : allEfforts;
  const summary = `${props.planMode ? "先给方案" : "直接执行"} · ${selectedModel?.displayName ?? "读取模型中"} · ${effortLabels[props.effort]}`;

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

      <Text style={styles.label}>模型</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modelRow}>
        {props.models.length ? props.models.map((item) => <Pressable key={item.id} accessibilityLabel={item.displayName} accessibilityState={{ selected: props.model === item.model }} onPress={() => tap(() => props.onModel(item.model))} style={[styles.modelChip, props.model === item.model && styles.active]}><Text numberOfLines={1} style={[styles.modelText, props.model === item.model && styles.activeText]}>{item.displayName}</Text>{item.isDefault && <Text style={styles.defaultText}>默认</Text>}</Pressable>) : <Text style={styles.empty}>正在读取 Codex 模型…</Text>}
      </ScrollView>

      <View style={styles.reasonHeader}><Text style={styles.label}>推理强度</Text>{selectedModel && <Text numberOfLines={1} style={styles.modelHint}>{selectedModel.displayName}</Text>}</View>
      <View style={styles.effortRow}>{efforts.map((value) => <Pressable key={value} accessibilityLabel={`推理强度${effortLabels[value]}`} accessibilityState={{ selected: props.effort === value }} onPress={() => tap(() => props.onEffort(value))} style={[styles.effortChip, props.effort === value && styles.active]}><Text style={[styles.segmentText, props.effort === value && styles.activeText]}>{effortLabels[value]}</Text></Pressable>)}</View>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  root: { marginTop: 10, borderRadius: 13, borderWidth: 1, borderColor: "#17313e", backgroundColor: "#09141a", overflow: "hidden" },
  header: { minHeight: 58, paddingHorizontal: 13, paddingVertical: 10, flexDirection: "row", alignItems: "center" },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: "#d9edf5", fontSize: 12, fontWeight: "900", letterSpacing: 0.8 },
  summary: { color: "#66808b", fontSize: 10, marginTop: 3 },
  chevron: { color: "#61dfff", fontSize: 10, fontWeight: "800", marginLeft: 10 },
  body: { borderTopWidth: 1, borderTopColor: "#142832", padding: 12 },
  label: { color: "#6f8793", fontSize: 10, letterSpacing: 1.5, fontWeight: "800", marginBottom: 7 },
  segmentRow: { flexDirection: "row", gap: 7, marginBottom: 12 },
  segment: { flex: 1, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: "#203743", backgroundColor: "#101e25", alignItems: "center" },
  segmentText: { color: "#8197a1", fontSize: 11, fontWeight: "700" },
  active: { borderColor: "#42d8ff", backgroundColor: "#123746" },
  activeText: { color: "#74e6ff", fontWeight: "900" },
  modelRow: { gap: 7, paddingBottom: 12 },
  modelChip: { minWidth: 112, maxWidth: 180, paddingVertical: 9, paddingHorizontal: 11, borderRadius: 9, borderWidth: 1, borderColor: "#203743", backgroundColor: "#101e25" },
  modelText: { color: "#a5b7bf", fontSize: 11, fontWeight: "800" },
  defaultText: { color: "#56808f", fontSize: 8, marginTop: 3 },
  empty: { color: "#667d88", fontSize: 11, paddingVertical: 8 },
  reasonHeader: { flexDirection: "row", justifyContent: "space-between" },
  modelHint: { color: "#526c77", fontSize: 9, maxWidth: "55%" },
  effortRow: { flexDirection: "row", gap: 7 },
  effortChip: { flex: 1, paddingVertical: 10, borderRadius: 9, borderWidth: 1, borderColor: "#203743", backgroundColor: "#101e25", alignItems: "center" },
});
